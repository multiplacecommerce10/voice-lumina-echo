import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const logSearchSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  weeks: z.number().int().min(1).max(26).optional().default(8),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["all", "success", "error"]).optional().default("all"),
  leadId: z.string().optional(),
});

function normalizeDateRange(data: z.infer<typeof logSearchSchema>) {
  let fromIso: string | null = null;
  let toIso: string | null = null;

  if (data.dateFrom) {
    const d = new Date(data.dateFrom);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(0, 0, 0, 0);
      fromIso = d.toISOString();
    }
  }
  if (data.dateTo) {
    const d = new Date(data.dateTo);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      toIso = d.toISOString();
    }
  }

  return { fromIso, toIso };
}

/** Outbound class.weekly_reminder attempts, plus weekly aggregation for the admin panel. */
export const getClassReminderLog = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => logSearchSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { fromIso, toIso } = normalizeDateRange(data);
    const since = fromIso ?? new Date(Date.now() - data.weeks * 7 * 86400000).toISOString();
    const until = toIso ?? new Date().toISOString();

    // Base query for the list view.
    let listQuery = supabaseAdmin
      .from("webhook_audit_log")
      .select(
        "id, flow, event, target_url, response_status, duration_ms, attempts, ok, error_reason, request_payload, response_body, created_at, lead_id",
      )
      .eq("flow", "class-reminder")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status === "success") {
      listQuery = listQuery.eq("ok", true);
    } else if (data.status === "error") {
      listQuery = listQuery.eq("ok", false);
    }

    const { data: rawEntries, error } = await listQuery;

    if (error) {
      return { ok: false as const, error: error.message, entries: [], weekly: [], totals: null };
    }

    // Filter by lead ID in memory since lead_id may be in the column or payload.
    const leadId = data.leadId?.trim().toLowerCase();
    const entries = (rawEntries ?? []).filter((row) => {
      if (!leadId) return true;
      const colLead = String(row.lead_id ?? "").toLowerCase();
      const payload = (row.request_payload ?? {}) as Record<string, unknown>;
      const payloadLeadId = String((payload as { lead_id?: string }).lead_id ?? "").toLowerCase();
      const extraLeadId = String(
        ((payload.extra ?? {}) as Record<string, unknown>).lead_id ?? "",
      ).toLowerCase();
      return colLead.includes(leadId) || payloadLeadId.includes(leadId) || extraLeadId.includes(leadId);
    });

    // Aggregation query respects the date range but ignores status/lead filters.
    let aggQuery = supabaseAdmin
      .from("webhook_audit_log")
      .select("ok, created_at, request_payload")
      .eq("flow", "class-reminder")
      .gte("created_at", since)
      .lte("created_at", until);

    const { data: all } = await aggQuery;

    const buckets = new Map<string, { week: string; sent: number; failed: number; recipients: Set<string> }>();
    let sent = 0;
    let failed = 0;
    for (const row of all ?? []) {
      const d = new Date(row.created_at as string);
      const day = d.getUTCDay();
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      const key = monday.toISOString().slice(0, 10);
      const bucket =
        buckets.get(key) ?? { week: key, sent: 0, failed: 0, recipients: new Set<string>() };
      if (row.ok) {
        bucket.sent++;
        sent++;
      } else {
        bucket.failed++;
        failed++;
      }
      const email = (row.request_payload as { email?: string } | null)?.email;
      if (email) bucket.recipients.add(email.toLowerCase());
      buckets.set(key, bucket);
    }

    const weekly = [...buckets.values()]
      .sort((a, b) => (a.week < b.week ? 1 : -1))
      .map((b) => ({ week: b.week, sent: b.sent, failed: b.failed, recipients: b.recipients.size }));

    // Daily aggregation for the charts.
    const dayBuckets = new Map<string, { day: string; sent: number; failed: number }>();
    for (const row of all ?? []) {
      const key = new Date(row.created_at as string).toISOString().slice(0, 10);
      const b = dayBuckets.get(key) ?? { day: key, sent: 0, failed: 0 };
      if (row.ok) b.sent++;
      else b.failed++;
      dayBuckets.set(key, b);
    }
    const daily = [...dayBuckets.values()].sort((a, b) => (a.day < b.day ? -1 : 1));

    return {
      ok: true as const,
      error: null,
      entries,
      weekly,
      daily,
      totals: { sent, failed, total: sent + failed, windowWeeks: data.weeks },
      fetchedAt: new Date().toISOString(),
    };
  });

/** Runs the class reminder sweep on demand (dry-run by default). */
export const runClassReminderSweepNow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        dryRun: z.boolean().optional().default(true),
        force: z.boolean().optional().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { runClassReminderSweep } = await import("@/lib/class-reminders.server");
    try {
      const result = await runClassReminderSweep({ dryRun: data.dryRun, force: data.force });
      return { ok: true as const, error: null, result };
    } catch (e) {
      return { ok: false as const, error: String(e), result: null };
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const listSchema = z.object({
  status: z.string().trim().max(40).optional().default("all"),
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

/** Subscriptions with next charge, schedule and reminder state for the admin panel. */
export const getSubscriptionsSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("subscription_billing")
      .select("*")
      .order("next_charge_at", { ascending: true, nullsFirst: false })
      .limit(data.limit);

    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.search) query = query.or(`email.ilike.%${data.search}%,full_name.ilike.%${data.search}%`);

    const { data: rows, error } = await query;
    if (error) {
      return { ok: false as const, error: error.message, subscriptions: [], counts: {}, totals: null };
    }

    const { data: all } = await supabaseAdmin
      .from("subscription_billing")
      .select("status, amount_per_cycle, next_charge_at, last_reminder_sent_at");

    const counts: Record<string, number> = {};
    let mrr = 0;
    let dueIn7 = 0;
    let remindersSent = 0;
    const now = Date.now();
    for (const row of all ?? []) {
      const key = (row.status as string) ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      if (key === "active" || key === "trialing") mrr += Number(row.amount_per_cycle ?? 0);
      if (row.next_charge_at && new Date(row.next_charge_at as string).getTime() - now < 7 * 86400000) dueIn7 += 1;
      if (row.last_reminder_sent_at) remindersSent += 1;
    }

    return {
      ok: true as const,
      error: null,
      subscriptions: rows ?? [],
      counts,
      totals: { total: (all ?? []).length, mrr, dueIn7, remindersSent },
      fetchedAt: new Date().toISOString(),
    };
  });

/** Reminder webhook attempts sent to Taskade. */
export const getReminderLog = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional().default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entries, error } = await supabaseAdmin
      .from("webhook_audit_log")
      .select("id, flow, event, response_status, duration_ms, attempts, ok, error_reason, request_payload, created_at")
      .ilike("event", "%renewal_reminder%")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) return { ok: false as const, error: error.message, entries: [] };
    return { ok: true as const, error: null, entries: entries ?? [], fetchedAt: new Date().toISOString() };
  });

/** Runs the reminder sweep on demand (dry-run by default). */
export const runReminderSweepNow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ dryRun: z.boolean().optional().default(true) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { runBillingReminderSweep } = await import("@/lib/billing-reminders.server");
    const result = await runBillingReminderSweep({ dryRun: data.dryRun });
    return { ok: true as const, dryRun: data.dryRun, result };
  });

/** Renders the personalized renewal reminder email for one subscription (no send). */
export const previewReminderEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().trim().min(3).max(120),
        offsetDays: z.number().int().min(0).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReminderPayload, pickReminderOffset } = await import("@/lib/billing-reminders.server");

    const { data: row, error } = await supabaseAdmin
      .from("subscription_billing")
      .select("*")
      .eq("stripe_subscription_id", data.subscriptionId)
      .maybeSingle();

    if (error || !row) return { ok: false as const, error: error?.message ?? "subscription_not_found" };
    if (!row.next_charge_at) return { ok: false as const, error: "no_next_charge_scheduled" };

    const remaining = Math.max(
      0,
      Math.ceil((new Date(row.next_charge_at as string).getTime() - Date.now()) / 86400000),
    );
    const offset = data.offsetDays ?? pickReminderOffset(remaining);
    const built = buildReminderPayload(row, offset, data.offsetDays ?? remaining);

    const payload = JSON.parse(JSON.stringify(built.payload)) as Record<string, any>;
    return { ok: true as const, error: null, preview: built.preview, payload };
  });

/** Full reminder send history for one subscription (timing, payload, Taskade response). */
export const getSubscriptionReminderHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().trim().min(3).max(120),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("webhook_audit_log")
      .select(
        "id, flow, event, target_url, response_status, response_body, duration_ms, attempts, ok, error_reason, request_payload, created_at",
      )
      .ilike("event", "%renewal_reminder%")
      .eq("request_payload->extra->>stripe_subscription_id", data.subscriptionId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) return { ok: false as const, error: error.message, entries: [] };

    const entries = (rows ?? []).map((row: any) => {
      const extra = (row.request_payload?.extra ?? {}) as Record<string, any>;
      const offset = extra.reminder_offset_days ?? null;
      return {
        id: row.id,
        createdAt: row.created_at,
        timingLabel: offset != null ? `D-${offset}` : "unscheduled",
        offsetDays: offset,
        daysUntilCharge: extra.billing_days_until_next_charge ?? null,
        chargeAt: extra.billing_next_charge_at ?? null,
        chargeAtFormatted: extra.billing_next_charge_at_formatted ?? null,
        dryRun: extra.dry_run === true,
        subject: extra.email_subject ?? null,
        ok: row.ok,
        responseStatus: row.response_status,
        responseBody: row.response_body,
        durationMs: row.duration_ms,
        attempts: row.attempts,
        errorReason: row.error_reason,
        targetUrl: row.target_url,
        payload: row.request_payload,
      };
    });

    return { ok: true as const, error: null, entries, fetchedAt: new Date().toISOString() };
  });

/** Sends a real test reminder to Taskade for one subscription (flagged as a test). */
export const sendTestReminder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().trim().min(3).max(120),
        offsetDays: z.number().int().min(0).max(30).optional(),
        testEmail: z.string().trim().email().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReminderPayload, pickReminderOffset } = await import("@/lib/billing-reminders.server");
    const { forwardToTaskade } = await import("@/lib/taskade.server");

    const { data: row, error } = await supabaseAdmin
      .from("subscription_billing")
      .select("*")
      .eq("stripe_subscription_id", data.subscriptionId)
      .maybeSingle();

    if (error || !row) return { ok: false as const, error: error?.message ?? "subscription_not_found" };
    if (!row.next_charge_at) return { ok: false as const, error: "no_next_charge_scheduled" };

    const remaining = Math.max(
      0,
      Math.ceil((new Date(row.next_charge_at as string).getTime() - Date.now()) / 86400000),
    );
    const offset = data.offsetDays ?? pickReminderOffset(remaining);
    const target = data.testEmail ?? (row.email as string | null) ?? null;
    const built = buildReminderPayload({ ...row, email: target }, offset, data.offsetDays ?? remaining);

    const forward = await forwardToTaskade({
      ...built.payload,
      environment: "sandbox",
      email: target,
      extra: {
        ...built.payload.extra,
        test_send: true,
        test_mode: "sandbox",
        student_email: target,
        sent_from: "admin_panel",
      },
    });

    return {
      ok: forward.ok,
      error: forward.ok ? null : forward.message ?? forward.reason,
      sentTo: target,
      offsetDays: offset,
      status: forward.status ?? null,
      attempts: forward.attempts,
      preview: built.preview,
    };
  });

/** Re-sends the renewal reminder for one subscription (dry-run or real). */
export const resendReminder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().trim().min(3).max(120),
        offsetDays: z.number().int().min(0).max(30).optional(),
        dryRun: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReminderPayload, pickReminderOffset } = await import("@/lib/billing-reminders.server");
    const { forwardToTaskade } = await import("@/lib/taskade.server");

    const { data: row, error } = await supabaseAdmin
      .from("subscription_billing")
      .select("*")
      .eq("stripe_subscription_id", data.subscriptionId)
      .maybeSingle();

    if (error || !row) return { ok: false as const, error: error?.message ?? "subscription_not_found" };
    if (!row.next_charge_at) return { ok: false as const, error: "no_next_charge_scheduled" };

    const remaining = Math.max(
      0,
      Math.ceil((new Date(row.next_charge_at as string).getTime() - Date.now()) / 86400000),
    );
    const offset = data.offsetDays ?? pickReminderOffset(remaining);
    const built = buildReminderPayload(row, offset, data.offsetDays ?? remaining);

    const forward = await forwardToTaskade({
      ...built.payload,
      extra: {
        ...built.payload.extra,
        resend: true,
        sent_from: "admin_panel_resend",
        ...(data.dryRun ? { dry_run: true } : {}),
      },
    });

    if (forward.ok && !data.dryRun) {
      await supabaseAdmin
        .from("subscription_billing")
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          last_reminder_offset_days: offset,
          last_reminder_charge_at: row.next_charge_at,
        })
        .eq("stripe_subscription_id", data.subscriptionId);
    }

    return {
      ok: forward.ok,
      error: forward.ok ? null : forward.message ?? forward.reason,
      dryRun: data.dryRun,
      offsetDays: offset,
      status: forward.status ?? null,
      attempts: forward.attempts,
      sentTo: (row.email as string | null) ?? null,
    };
  });

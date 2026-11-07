import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const filterSchema = z.object({
  status: z.string().trim().max(40).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

/** Live snapshot of lead states for the monitoring/debug screen. */
export const getLeadsSnapshot = createServerFn({ method: "POST" })
  .validator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, full_name, email, phone, plan_intended, status, source, utm_source, utm_medium, utm_campaign, stripe_session_id, checkout_started_at, abandoned_at, abandon_reason, recovery_email_sent_at, recovery_attempts, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: leads, error } = await query;
    if (error) {
      return { ok: false as const, error: error.message, leads: [], counts: {} };
    }

    const { data: allStatuses } = await supabaseAdmin.from("leads").select("status");
    const counts: Record<string, number> = {};
    for (const row of allStatuses ?? []) {
      const key = (row.status as string) ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return {
      ok: true as const,
      error: null,
      leads: leads ?? [],
      counts,
      fetchedAt: new Date().toISOString(),
    };
  });

/** Configuration + connectivity check for the Taskade webhooks. */
export const checkWebhookHealth = createServerFn({ method: "POST" }).handler(async () => {
  const enrollment = process.env.TASKADE_WEBHOOK_URL ?? null;
  const recovery = process.env.TASKADE_RECOVERY_WEBHOOK_URL ?? null;

  const mask = (u: string | null) =>
    u ? u.replace(/(flow\/)([^/]+)/, (_m, p, id: string) => `${p}${id.slice(0, 6)}…${id.slice(-4)}`) : null;

  return {
    enrollmentConfigured: Boolean(enrollment),
    recoveryConfigured: Boolean(recovery),
    enrollmentUrl: mask(enrollment),
    recoveryUrl: mask(recovery),
    dryRun: process.env.TASKADE_DRY_RUN === "1" || process.env.TASKADE_DRY_RUN?.toLowerCase() === "true",
  };
});

/** Sends a test recovery email for a real lead via Hostinger (dry-run by default). */
export const testRecoveryForLead = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), live: z.boolean().optional().default(false) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { LEAD_SELECT } = await import("@/lib/lead-recovery.server");
    const { buildRecoveryEmail } = await import("@/lib/recovery-email");

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select(LEAD_SELECT)
      .eq("id", data.leadId)
      .maybeSingle();

    if (error || !lead) return { ok: false as const, reason: "lead_not_found" };

    let resumeCode = lead.resume_code ?? null;
    if (!resumeCode) {
      const { newResumeCode } = await import("@/lib/resume-code.server");
      resumeCode = newResumeCode();
      await supabaseAdmin.from("leads").update({ resume_code: resumeCode }).eq("id", lead.id);
    }

    const draft = buildRecoveryEmail({
      leadId: lead.id,
      fullName: lead.full_name,
      planIntended: lead.plan_intended,
      resumeCode,
    });

    if (!data.live) {
      console.log(`[testRecoveryForLead] DRY-RUN would email ${lead.email}: ${draft.subject}`);
      return { ok: true as const, result: { ok: true, dryRun: true, subject: draft.subject } };
    }

    const { sendHostingerMail } = await import("@/lib/hostinger-mail.server");
    const sent = await sendHostingerMail("confirm", {
      to: lead.email.toLowerCase(),
      subject: `[TEST] ${draft.subject}`,
      html: draft.bodyHtml,
      text: draft.bodyText,
    });
    return { ok: true as const, result: sent };
  });

/** Recent webhook audit entries (payloads, status codes and processing time). */
export const getWebhookAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        direction: z.enum(["all", "inbound", "outbound"]).optional().default("all"),
        flow: z.string().trim().max(40).optional(),
        limit: z.number().int().min(1).max(100).optional().default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("webhook_audit_log")
      .select(
        "id, direction, flow, event, target_url, lead_id, correlation_id, request_payload, response_status, response_body, duration_ms, attempts, ok, error_reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.direction !== "all") query = query.eq("direction", data.direction);
    if (data.flow && data.flow !== "all") query = query.eq("flow", data.flow);

    const { data: entries, error } = await query;
    if (error) return { ok: false as const, error: error.message, entries: [], stats: null };

    const { data: recent } = await supabaseAdmin
      .from("webhook_audit_log")
      .select("ok, duration_ms")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = recent ?? [];
    const durations = rows.map((r) => r.duration_ms ?? 0).filter((d) => d > 0);
    const stats = {
      total: rows.length,
      failures: rows.filter((r) => !r.ok).length,
      avgMs: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      maxMs: durations.length ? Math.max(...durations) : 0,
    };

    return {
      ok: true as const,
      error: null,
      entries: entries ?? [],
      stats,
      fetchedAt: new Date().toISOString(),
    };
  });

/** Full transition timeline for a single lead (states + webhook events). */
export const getLeadTimeline = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select(
        "id, full_name, email, plan_intended, status, source, stripe_session_id, created_at, updated_at, checkout_started_at, abandoned_at, abandon_reason, recovery_email_sent_at, recovery_attempts",
      )
      .eq("id", data.leadId)
      .maybeSingle();

    if (error || !lead) return { ok: false as const, error: error?.message ?? "lead_not_found", events: [] };

    const { data: hooks } = await supabaseAdmin
      .from("webhook_audit_log")
      .select("id, direction, flow, event, response_status, duration_ms, attempts, ok, error_reason, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: true })
      .limit(100);

    type Ev = {
      key: string;
      at: string;
      kind: "state" | "webhook";
      label: string;
      detail: string | null;
      tone: "captured" | "checkout_started" | "abandoned" | "paid" | "webhook" | "error";
      attempts: number | null;
    };

    const events: Ev[] = [];

    events.push({
      key: "captured",
      at: lead.created_at as string,
      kind: "state",
      label: "captured",
      detail: `Lead capturado pelo formulário${lead.source ? ` (${lead.source})` : ""}`,
      tone: "captured",
      attempts: null,
    });

    if (lead.checkout_started_at) {
      events.push({
        key: "checkout_started",
        at: lead.checkout_started_at as string,
        kind: "state",
        label: "checkout_started",
        detail: `Checkout iniciado${lead.plan_intended ? ` — plano ${lead.plan_intended}` : ""}`,
        tone: "checkout_started",
        attempts: null,
      });
    }

    if (lead.abandoned_at) {
      events.push({
        key: "abandoned",
        at: lead.abandoned_at as string,
        kind: "state",
        label: "abandoned",
        detail: (lead.abandon_reason as string) ?? "Checkout não concluído em 30 minutos",
        tone: "abandoned",
        attempts: null,
      });
    }

    if (lead.recovery_email_sent_at) {
      events.push({
        key: "recovery_sent",
        at: lead.recovery_email_sent_at as string,
        kind: "state",
        label: "recovery_email",
        detail: "Webhook de recuperação disparado ao Taskade",
        tone: "abandoned",
        attempts: (lead.recovery_attempts as number) ?? 0,
      });
    }

    if (lead.status === "paid") {
      events.push({
        key: "paid",
        at: (lead.updated_at as string) ?? (lead.created_at as string),
        kind: "state",
        label: "paid",
        detail: lead.stripe_session_id ? `Pagamento confirmado (${lead.stripe_session_id})` : "Pagamento confirmado",
        tone: "paid",
        attempts: null,
      });
    }

    for (const h of hooks ?? []) {
      events.push({
        key: `hook-${h.id}`,
        at: h.created_at as string,
        kind: "webhook",
        label: `${h.direction === "inbound" ? "recebido" : "enviado"}: ${h.event ?? h.flow}`,
        detail: [
          h.response_status != null ? `HTTP ${h.response_status}` : null,
          h.duration_ms != null ? `${h.duration_ms} ms` : null,
          h.ok ? "OK" : `FALHA${h.error_reason ? ` — ${h.error_reason}` : ""}`,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: h.ok ? "webhook" : "error",
        attempts: (h.attempts as number) ?? null,
      });
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const first = events[0] ? new Date(events[0].at).getTime() : null;
    const last = events.length ? new Date(events[events.length - 1]!.at).getTime() : null;

    return {
      ok: true as const,
      error: null,
      lead,
      events,
      totalDurationMs: first != null && last != null ? last - first : 0,
      webhookAttempts: (hooks ?? []).reduce((sum, h) => sum + ((h.attempts as number) ?? 1), 0),
      recoveryAttempts: (lead.recovery_attempts as number) ?? 0,
    };
  });

/** Runs the 30-minute abandoned-checkout sweep on demand. */
export const runAbandonedSweepNow = createServerFn({ method: "POST" }).handler(async () => {
  const { runAbandonedSweep } = await import("@/lib/lead-recovery.server");
  return await runAbandonedSweep();
});


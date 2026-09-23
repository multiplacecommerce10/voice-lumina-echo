// Server-only audit trail for every webhook we send or receive.
// Powers the real-time audit panel at /debug/leads.

export type AuditEntry = {
  direction: "outbound" | "inbound";
  flow: string; // "enrollment" | "recovery" | "stripe" | "recovery_sweep"
  event?: string | null;
  targetUrl?: string | null;
  leadId?: string | null;
  correlationId?: string | null;
  requestPayload?: unknown;
  responseStatus?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  attempts?: number | null;
  ok: boolean;
  errorReason?: string | null;
};

function maskUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/(flow\/)([^/]+)/, (_m, p, id: string) =>
    `${p}${id.slice(0, 6)}…${id.slice(-4)}`,
  );
}

/** Never throws — auditing must not break the request it is observing. */
export async function recordWebhookAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("webhook_audit_log").insert({
      direction: entry.direction,
      flow: entry.flow,
      event: entry.event ?? null,
      target_url: maskUrl(entry.targetUrl),
      lead_id: entry.leadId ?? null,
      correlation_id: entry.correlationId ?? null,
      request_payload: (entry.requestPayload ?? null) as never,
      response_status: entry.responseStatus ?? null,
      response_body: entry.responseBody ? entry.responseBody.slice(0, 2000) : null,
      duration_ms: entry.durationMs ?? null,
      attempts: entry.attempts ?? null,
      ok: entry.ok,
      error_reason: entry.errorReason ?? null,
    });
  } catch (e) {
    console.error("[webhook-audit] failed to record entry:", e);
  }
}

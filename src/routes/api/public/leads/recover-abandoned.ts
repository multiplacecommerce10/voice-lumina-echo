import { createFileRoute } from "@tanstack/react-router";

/**
 * Safety-net sweep: any lead that reached checkout but never paid within the
 * 30-minute grace window gets flagged as abandoned and receives one recovery
 * email. Meant to be called by a scheduler (e.g. every 5 minutes).
 */
async function handleSweep() {
  const startedAt = Date.now();
  const { recordWebhookAudit } = await import("@/lib/webhook-audit.server");
  try {
    const { runAbandonedSweep } = await import("@/lib/lead-recovery.server");
    const result = await runAbandonedSweep();

    await recordWebhookAudit({
      direction: "inbound",
      flow: "recovery_sweep",
      event: "cron.recover_abandoned",
      targetUrl: "/api/public/leads/recover-abandoned",
      requestPayload: result,
      responseStatus: result.error ? 500 : 200,
      durationMs: Date.now() - startedAt,
      attempts: 1,
      ok: !result.error,
      errorReason: result.error ?? null,
    });

    if (result.error) return Response.json({ error: result.error }, { status: 500 });
    return Response.json({
      processed: result.processed,
      recoveryEmailsSent: result.recoveryEmailsSent,
    });
  } catch (e) {
    console.error("[recover-abandoned]", e);
    await recordWebhookAudit({
      direction: "inbound",
      flow: "recovery_sweep",
      event: "cron.recover_abandoned",
      targetUrl: "/api/public/leads/recover-abandoned",
      responseStatus: 500,
      durationMs: Date.now() - startedAt,
      attempts: 1,
      ok: false,
      errorReason: String(e),
    });
    return Response.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/leads/recover-abandoned")({
  server: {
    handlers: {
      POST: handleSweep,
      GET: handleSweep,
    },
  },
});

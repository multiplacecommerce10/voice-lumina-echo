// Forwarder to Taskade webhook flow.
// Used to send welcome emails and member-area credentials after
// enrollment submission and successful payment.

type ForwardPayload = {
  event: string; // e.g. "enrollment.form_submitted", "checkout.session.completed"
  environment?: "sandbox" | "live";
  lead_id?: string | null;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  plan?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  status?: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_event_id?: string | null;
  client_reference_id?: string | null;
  attribution_summary?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  landing_url?: string | null;
  referrer?: string | null;
  occurred_at?: string;
  extra?: Record<string, unknown>;
};

export type TaskadeForwardResult =
  | { ok: true; attempts: number; status: number; correlationId: string; dryRun?: boolean }
  | {
      ok: false;
      attempts: number;
      status: number | null;
      correlationId: string;
      reason: "not_configured" | "client_error" | "server_error" | "network_error" | "timeout";
      message: string;
    };

function isDryRunEnabled(payload: ForwardPayload): boolean {
  const extra = payload.extra as { dry_run?: boolean; force_live?: boolean } | undefined;
  if (extra?.force_live === true) return false;
  if (extra?.dry_run === true) return true;
  const flag = process.env.TASKADE_DRY_RUN;
  return flag === "1" || flag?.toLowerCase() === "true";
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 400;
const REQUEST_TIMEOUT_MS = 8000;

type FailureReason =
  | "not_configured"
  | "client_error"
  | "server_error"
  | "network_error"
  | "timeout";

function friendlyMessage(reason: FailureReason): string {
  switch (reason) {
    case "not_configured":
      return "Taskade webhook is not configured (TASKADE_WEBHOOK_URL missing). Skipped forwarding.";
    case "client_error":
      return "Taskade rejected the payload (4xx). Check the flow's expected fields and webhook URL.";
    case "server_error":
      return "Taskade is temporarily unavailable (5xx). Retries exhausted; will need to be replayed.";
    case "network_error":
      return "Could not reach Taskade (network error). Retries exhausted.";
    case "timeout":
      return "Taskade did not respond in time. Retries exhausted.";
    default:
      return "Unknown Taskade forwarding error.";
  }
}

function newCorrelationId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function forwardToTaskade(
  payload: ForwardPayload,
  options?: { flow?: "enrollment" | "recovery" | "class-reminder" },
): Promise<TaskadeForwardResult> {
  const correlationId = newCorrelationId();
  const startedAt = Date.now();
  const flow = options?.flow ?? "enrollment";
  const url =
    flow === "recovery"
      ? process.env.TASKADE_RECOVERY_WEBHOOK_URL ?? process.env.TASKADE_WEBHOOK_URL
      : flow === "class-reminder"
        ? process.env.TASKADE_CLASS_WEBHOOK_URL ?? process.env.TASKADE_WEBHOOK_URL
        : process.env.TASKADE_WEBHOOK_URL;
  const dryRun = isDryRunEnabled(payload);

  const parsedBody = {
    ...payload,
    correlation_id: correlationId,
    occurred_at: payload.occurred_at ?? new Date().toISOString(),
    ...(dryRun ? { dry_run: true } : {}),
  };
  const body = JSON.stringify(parsedBody);

  const { recordWebhookAudit } = await import("@/lib/webhook-audit.server");
  const leadId =
    (payload.lead_id as string | null | undefined) ??
    ((payload.extra as { lead_id?: string } | undefined)?.lead_id ?? null);

  const audit = (fields: {
    ok: boolean;
    status?: number | null;
    responseBody?: string | null;
    attempts?: number;
    errorReason?: string | null;
  }) =>
    recordWebhookAudit({
      direction: "outbound",
      flow: dryRun ? `${flow} (dry-run)` : flow,
      event: payload.event,
      targetUrl: url ?? null,
      leadId,
      correlationId,
      requestPayload: parsedBody,
      responseStatus: fields.status ?? null,
      responseBody: fields.responseBody ?? null,
      durationMs: Date.now() - startedAt,
      attempts: fields.attempts ?? 0,
      ok: fields.ok,
      errorReason: fields.errorReason ?? null,
    });

  if (dryRun) {
    console.log(
      `[taskade:${correlationId}] DRY-RUN event="${payload.event}" — payload NOT sent. Body:`,
      body,
    );
    await audit({ ok: true, status: 200, responseBody: "dry-run — not sent" });
    return { ok: true, attempts: 0, status: 200, correlationId, dryRun: true };
  }

  if (!url) {
    const message = friendlyMessage("not_configured");
    console.warn(`[taskade:${correlationId}] ${message}`);
    await audit({ ok: false, errorReason: message });
    return {
      ok: false,
      attempts: 0,
      status: null,
      correlationId,
      reason: "not_configured",
      message,
    };
  }



  let lastStatus: number | null = null;
  let lastReason: "client_error" | "server_error" | "network_error" | "timeout" = "network_error";
  let lastErrMsg = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": correlationId,
          "X-Event": payload.event,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      lastStatus = res.status;

      if (res.ok) {
        const okBody = await res.text().catch(() => "");
        console.log(
          `[taskade:${correlationId}] forwarded event="${payload.event}" attempt=${attempt} status=${res.status}`,
        );
        await audit({ ok: true, status: res.status, responseBody: okBody, attempts: attempt });
        return { ok: true, attempts: attempt, status: res.status, correlationId };
      }


      // 4xx: don't retry — the payload is wrong.
      if (res.status >= 400 && res.status < 500) {
        const responseText = await res.text().catch(() => "");
        lastReason = "client_error";
        lastErrMsg = `HTTP ${res.status} ${responseText.slice(0, 300)}`;
        console.error(
          `[taskade:${correlationId}] client error (no retry) status=${res.status} body="${responseText.slice(0, 300)}"`,
        );
        break;
      }

      // 5xx: retry
      lastReason = "server_error";
      lastErrMsg = `HTTP ${res.status}`;
      console.warn(
        `[taskade:${correlationId}] attempt ${attempt}/${MAX_ATTEMPTS} failed with ${res.status}, retrying…`,
      );
    } catch (e) {
      clearTimeout(timeout);
      const err = e as Error;
      const isAbort = err.name === "AbortError";
      lastReason = isAbort ? "timeout" : "network_error";
      lastStatus = null;
      lastErrMsg = err.message || String(err);
      console.warn(
        `[taskade:${correlationId}] attempt ${attempt}/${MAX_ATTEMPTS} ${lastReason}: ${lastErrMsg}`,
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      // Exponential backoff with jitter: 400ms, ~1.2s, ~3.6s
      const backoff = BASE_DELAY_MS * Math.pow(3, attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);
    }
  }

  const message = `${friendlyMessage(lastReason)} (${lastErrMsg})`;
  console.error(
    `[taskade:${correlationId}] giving up after ${MAX_ATTEMPTS} attempts — ${message}`,
  );
  await audit({
    ok: false,
    status: lastStatus,
    responseBody: lastErrMsg,
    attempts: MAX_ATTEMPTS,
    errorReason: `${lastReason}: ${message}`,
  });

  return {
    ok: false,
    attempts: MAX_ATTEMPTS,
    status: lastStatus,
    correlationId,
    reason: lastReason,
    message,
  };
}

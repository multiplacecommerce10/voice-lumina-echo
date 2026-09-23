// Forwarder to Make.com webhook. Server-only.
// Normalizes payloads so Make scenarios don't need to parse raw Stripe JSON.

type ForwardPayload = {
  event: string; // e.g. "checkout.session.completed", "enrollment.form_submitted"
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
  // Anything extra (e.g. raw metadata)
  extra?: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;

export async function forwardToMake(payload: ForwardPayload): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn("[make] MAKE_WEBHOOK_URL not configured; skipping forward");
    return;
  }

  const body = JSON.stringify({
    ...payload,
    occurred_at: payload.occurred_at ?? new Date().toISOString(),
  });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        console.log("[make] forwarded", payload.event, "status", res.status);
        return;
      }
      lastErr = new Error(`Make responded ${res.status}`);
      console.warn(`[make] attempt ${attempt} failed: HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
      console.warn(`[make] attempt ${attempt} error:`, (e as Error).message);
    }
    // Backoff: 300ms, 900ms
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt - 1)));
    }
  }
  console.error("[make] giving up after retries:", lastErr);
}

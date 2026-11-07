/**
 * Dedicated PayPal webhook endpoint (separate from Stripe's).
 *   live:    /api/public/paypal/webhook/live
 *   sandbox: /api/public/paypal/webhook/sandbox
 *
 * 1. Verifies the delivery with PayPal (verify-webhook-signature, this env's webhook id).
 * 2. Records the event id (idempotent per event).
 * 3. Re-fetches the subscription (and, for sales, the transaction) from PayPal.
 * 4. Atomically binds the checkout intent to the FIRST subscription presenting it.
 * 5. Applies the pure lifecycle with optimistic concurrency; notifications are
 *    persisted with the state, drained to the outbox, then delivered (sandbox never sends).
 * 6. Marks the event processed only after the outbox drain succeeded.
 */

import { createFileRoute } from "@tanstack/react-router";
import type { PayPalEnv } from "@/lib/paypal-plans";

async function handle(request: Request, envParam: string): Promise<Response> {
  if (envParam !== "live" && envParam !== "sandbox") return new Response("Not found", { status: 404 });
  const env = envParam as PayPalEnv;
  const raw = await request.text();
  if (raw.length > 200_000) return new Response("Too large", { status: 413 });

  const { paypalConfig, verifyPayPalWebhook, fetchSubscription, fetchSale, applySaleFacts } = await import("@/lib/paypal.server");
  if (!paypalConfig(env).complete) return new Response("Not configured", { status: 503 });

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(env, request.headers, raw);
  } catch (e) {
    console.error("[paypal-webhook] verification error:", e instanceof Error ? e.message : e);
    return new Response("Verification unavailable", { status: 500 }); // PayPal retries
  }
  if (!verified) return new Response("Invalid signature", { status: 401 });

  const { normalizePayPalEvent, applyPayPalEvent, PAYPAL_HANDLED_EVENTS } = await import("@/lib/paypal-lifecycle");
  const payload = JSON.parse(raw);
  const normalized = normalizePayPalEvent(payload);
  if (!normalized) return new Response("Bad event", { status: 400 });
  if (!(PAYPAL_HANDLED_EVENTS as readonly string[]).includes(normalized.eventType) || !normalized.subscriptionId) {
    return Response.json({ ok: true, ignored: normalized.eventType });
  }

  const state = await import("@/lib/paypal-state.server");
  try {
    const claim = await state.claimEvent(env, normalized, payload);
    const subId = normalized.subscriptionId;
    if (!claim.fresh) {
      await state.drainNotifications(env, subId);
      return Response.json({ ok: true, duplicate: true });
    }

    let ev = normalized;
    if (ev.eventType === "PAYMENT.SALE.COMPLETED" || ev.eventType === "PAYMENT.SALE.DENIED") {
      const facts = ev.transactionId ? applySaleFacts(ev, await fetchSale(env, ev.transactionId)) : null;
      if (!facts) {
        await state.finishEvent(env, ev.eventId, "rejected:sale_not_confirmed", ev.transactionId);
        return Response.json({ ok: true, outcome: "rejected:sale_not_confirmed" });
      }
      ev = facts;
    }

    const sub = await fetchSubscription(env, subId);
    if (sub?.customId) await state.bindIntent(env, sub.customId, sub.id); // first subscription wins
    const intent = await state.loadIntent(env, sub?.customId ?? null);
    const result = await applyPayPalEvent({
      repo: state.supabasePayPalRepo(env),
      env,
      event: ev,
      sub,
      intent,
      now: () => Date.now(),
    });
    await state.drainNotifications(env, subId);
    await state.finishEvent(env, ev.eventId, result.outcome, ev.transactionId);
    if (result.outcome.startsWith("rejected:")) {
      console.error("[paypal-webhook] rejected", env, ev.eventType, result.outcome);
    }
    // Delivery failures stay in the outbox for retry by the scheduler.
    try {
      await state.runOutbox();
    } catch (e) {
      console.error("[paypal-webhook] outbox delivery deferred:", e instanceof Error ? e.message : e);
    }
    return Response.json({ ok: true, outcome: result.outcome });
  } catch (e) {
    console.error("[paypal-webhook] processing failed:", e instanceof Error ? e.message : e);
    return new Response("Processing error", { status: 500 }); // PayPal retries
  }
}

export const Route = createFileRoute("/api/public/paypal/webhook/$env")({
  server: {
    handlers: {
      POST: ({ request, params }) => handle(request, params.env),
    },
  },
});

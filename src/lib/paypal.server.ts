/**
 * PayPal REST client (server-only). Sandbox and live are fully isolated:
 * separate hosts, separate credentials, separate webhook ids.
 *
 * Secrets (presence-checked only, values never logged):
 *   PAYPAL_{SANDBOX|LIVE}_CLIENT_ID
 *   PAYPAL_{SANDBOX|LIVE}_CLIENT_SECRET
 *   PAYPAL_{SANDBOX|LIVE}_WEBHOOK_ID
 */

import type { PayPalEnv } from "@/lib/paypal-plans";
import type { VerifiedSubscription } from "@/lib/paypal-lifecycle";

export const PAYPAL_API_BASE: Record<PayPalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

function key(env: PayPalEnv, name: "CLIENT_ID" | "CLIENT_SECRET" | "WEBHOOK_ID") {
  return `PAYPAL_${env === "live" ? "LIVE" : "SANDBOX"}_${name}`;
}

export function paypalConfig(env: PayPalEnv) {
  const clientId = process.env[key(env, "CLIENT_ID")] ?? "";
  const clientSecret = process.env[key(env, "CLIENT_SECRET")] ?? "";
  const webhookId = process.env[key(env, "WEBHOOK_ID")] ?? "";
  return {
    clientId,
    clientSecret,
    webhookId,
    /** Checkout may only be offered when confirmation can be verified end-to-end. */
    complete: !!clientId && !!clientSecret && !!webhookId,
  };
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function getAccessToken(env: PayPalEnv, fetchImpl: FetchLike = fetch): Promise<string> {
  const cfg = paypalConfig(env);
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`PayPal ${env} credentials missing`);
  const res = await fetchImpl(`${PAYPAL_API_BASE[env]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal ${env} OAuth failed: HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`PayPal ${env} OAuth returned no token`);
  return json.access_token;
}

export async function fetchSubscription(
  env: PayPalEnv,
  subscriptionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<VerifiedSubscription | null> {
  if (!/^I-[A-Z0-9]{6,40}$/.test(subscriptionId)) return null;
  const token = await getAccessToken(env, fetchImpl);
  const res = await fetchImpl(`${PAYPAL_API_BASE[env]}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PayPal ${env} subscription fetch failed: HTTP ${res.status}`);
  const j = (await res.json()) as any;
  return {
    id: String(j.id),
    planId: String(j.plan_id ?? ""),
    status: String(j.status ?? ""),
    customId: typeof j.custom_id === "string" ? j.custom_id : null,
    startTime: typeof j.start_time === "string" && !Number.isNaN(Date.parse(j.start_time)) ? new Date(j.start_time).toISOString() : null,
  };
}

export type VerifiedSale = {
  id: string;
  state: string;
  amount: string | null;
  currency: string | null;
  subscriptionId: string | null;
  /** When the charge actually happened according to PayPal (not webhook delivery). */
  occurredAt: string | null;
};

/** Transaction facts from PayPal for a sale referenced by a webhook. */
export async function fetchSale(env: PayPalEnv, saleId: string, fetchImpl: FetchLike = fetch): Promise<VerifiedSale | null> {
  if (!/^[A-Z0-9]{6,40}$/.test(saleId)) return null;
  const token = await getAccessToken(env, fetchImpl);
  const res = await fetchImpl(`${PAYPAL_API_BASE[env]}/v1/payments/sale/${saleId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PayPal ${env} sale fetch failed: HTTP ${res.status}`);
  const j = (await res.json()) as any;
  const t = j.create_time ?? j.update_time;
  return {
    id: String(j.id),
    state: String(j.state ?? ""),
    amount: j.amount?.total != null ? String(j.amount.total) : null,
    currency: j.amount?.currency != null ? String(j.amount.currency) : null,
    subscriptionId: typeof j.billing_agreement_id === "string" ? j.billing_agreement_id : null,
    occurredAt: typeof t === "string" && !Number.isNaN(Date.parse(t)) ? new Date(t).toISOString() : null,
  };
}

/**
 * Replaces delivery-derived sale facts with PayPal's own transaction record.
 * Returns null when the sale cannot be confirmed (wrong subscription, not completed).
 */
export function applySaleFacts<E extends { eventType: string; subscriptionId: string | null; amount: string | null; currency: string | null; occurredAt: string }>(
  ev: E,
  sale: VerifiedSale | null,
): E | null {
  if (!sale || sale.subscriptionId !== ev.subscriptionId) return null;
  if (ev.eventType === "PAYMENT.SALE.COMPLETED" && sale.state.toLowerCase() !== "completed") return null;
  return { ...ev, amount: sale.amount, currency: sale.currency, occurredAt: sale.occurredAt ?? ev.occurredAt };
}

const SIG_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

/**
 * Verifies a webhook delivery with PayPal's verify-webhook-signature API
 * against THIS environment's webhook id. Returns false on any doubt.
 */
export async function verifyPayPalWebhook(
  env: PayPalEnv,
  headers: Headers,
  rawBody: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const cfg = paypalConfig(env);
  if (!cfg.webhookId) return false;
  for (const h of SIG_HEADERS) if (!headers.get(h)) return false;
  const certUrl = headers.get("paypal-cert-url")!;
  try {
    const u = new URL(certUrl);
    if (u.protocol !== "https:" || !(u.hostname === "api.paypal.com" || u.hostname.endsWith(".paypal.com"))) return false;
  } catch {
    return false;
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const token = await getAccessToken(env, fetchImpl);
  const res = await fetchImpl(`${PAYPAL_API_BASE[env]}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: certUrl,
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: cfg.webhookId,
      webhook_event: event,
    }),
  });
  if (!res.ok) return false;
  const j = (await res.json()) as { verification_status?: string };
  return j.verification_status === "SUCCESS";
}

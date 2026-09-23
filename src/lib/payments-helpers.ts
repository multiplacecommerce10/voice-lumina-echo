/**
 * Runtime helpers for the payment server functions. Kept out of
 * `payments.functions.ts` so that module contains only server-function
 * declarations (server-fn splitting removes runtime siblings).
 */

import {
  LEGACY_ONE_TIME_KEYS,
  LEGACY_RECURRING_KEYS,
  RECURRING_PRICE_KEYS,
} from "@/lib/subscription-catalog";

/** Lookup keys purchasable today (recurring subscriptions). */
export const OFFERED_PRICE_KEYS = RECURRING_PRICE_KEYS;

/** Retired keys: resolvable for historical records, never purchasable. */
export const HISTORICAL_PRICE_KEYS = [
  ...LEGACY_ONE_TIME_KEYS,
  ...LEGACY_RECURRING_KEYS,
] as const;

/** Stable identifier for this Checkout integration (recurring v2). */
export const INTEGRATION_IDENTIFIER_BASE = "consciousvoice_sub_v2";

/** Compliant integration identifier: stable base + 8 random letters. */
export function buildIntegrationIdentifier(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += letters[b % 26];
  return `${INTEGRATION_IDENTIFIER_BASE}_${suffix}`;
}

const ALLOWED_RETURN_HOSTS = ["consciousvoice.tecendosom.com", "localhost", "127.0.0.1"];

function isAllowedReturnHost(hostname: string): boolean {
  return (
    ALLOWED_RETURN_HOSTS.includes(hostname) ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovable.dev")
  );
}

/** Allowlisted origin taken from a client-supplied URL. Never trusted verbatim. */
export function safeOrigin(candidate: string): string {
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol === "https:" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1") &&
      isAllowedReturnHost(parsed.hostname)
    ) {
      return parsed.origin;
    }
  } catch {
    // fall through to the default origin
  }
  return "https://consciousvoice.tecendosom.com";
}

/**
 * Never trust a client-supplied return URL verbatim. We keep only the origin
 * (after allowlisting it) and rebuild the path/query ourselves.
 */
export function buildReturnUrl(candidate: string): string {
  return `${safeOrigin(candidate)}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
}

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
] as const;

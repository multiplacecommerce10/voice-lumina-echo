/**
 * Focused tests for the recurring checkout catalog.
 *
 * Run: bun run scripts/checkout-catalog-test.ts
 *
 * Verifies, without touching Stripe or the network:
 *  1. Exactly the six recurring lookup keys are purchasable.
 *  2. Retired one-time and 12-month keys are rejected (but still resolvable
 *     for historical records).
 *  3. Amounts, tiers and durations match the confirmed offer.
 *  4. The checkout server function uses subscription mode, no
 *     payment_method_types, and a compliant integration identifier.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RECURRING_PRICE_KEYS,
  LEGACY_ONE_TIME_KEYS,
  LEGACY_RECURRING_KEYS,
  SUBSCRIPTION_CATALOG,
  OFFERING_VERSION,
  durationMonthsFromLookupKey,
  tierFromLookupKey,
} from "../src/lib/subscription-catalog";
import {
  OFFERED_PRICE_KEYS,
  HISTORICAL_PRICE_KEYS,
  buildIntegrationIdentifier,
  buildReturnUrl,
} from "../src/lib/payments-helpers";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

/** Mirrors the inputValidator rules of createCheckoutSession. */
function isPurchasable(priceId: string): boolean {
  if (!/^[a-zA-Z0-9_-]+$/.test(priceId)) return false;
  if ((HISTORICAL_PRICE_KEYS as readonly string[]).includes(priceId)) return false;
  return (OFFERED_PRICE_KEYS as readonly string[]).includes(priceId);
}

console.log("=== Six recurring keys are purchasable ===");
const expected: [string, "live" | "complete", 1 | 3 | 6, number][] = [
  ["live_sub_1m_v1", "live", 1, 147.0],
  ["live_sub_3m_v1", "live", 3, 418.95],
  ["live_sub_6m_v1", "live", 6, 793.8],
  ["complete_sub_1m_v1", "complete", 1, 197.0],
  ["complete_sub_3m_v1", "complete", 3, 561.45],
  ["complete_sub_6m_v1", "complete", 6, 1063.8],
];
check("exactly six offered keys", OFFERED_PRICE_KEYS.length === 6);
for (const [key, tier, months, amount] of expected) {
  const entry = SUBSCRIPTION_CATALOG[tier][months];
  check(
    `${key} — US$${amount} every ${months} month(s), tier ${tier}`,
    isPurchasable(key) &&
      entry.lookupKey === key &&
      entry.amountUsd === amount &&
      tierFromLookupKey(key) === tier &&
      durationMonthsFromLookupKey(key) === months,
  );
}
check("offering version is 2026-08-17", OFFERING_VERSION === "2026-08-17");

console.log("\n=== Retired keys are rejected ===");
for (const key of LEGACY_ONE_TIME_KEYS) {
  check(`one-time key rejected: ${key}`, !isPurchasable(key));
}
for (const key of LEGACY_RECURRING_KEYS) {
  check(`legacy recurring key rejected: ${key}`, !isPurchasable(key));
}
check(
  "no 12-month key is offered",
  !RECURRING_PRICE_KEYS.some((k) => k.includes("12m")),
);
check("unknown key rejected", !isPurchasable("live_sub_9m_v1"));
check("injection-shaped key rejected", !isPurchasable("live_sub_1m_v1'; --"));
check(
  "retired keys stay resolvable for history",
  HISTORICAL_PRICE_KEYS.includes("live_pkg_12m" as never),
);

console.log("\n=== Checkout session parameters ===");
const src = readFileSync(
  resolve(import.meta.dirname, "../src/lib/payments.functions.ts"),
  "utf8",
);
check('mode is "subscription"', /mode:\s*"subscription"/.test(src));
check("embedded ui mode", /ui_mode:\s*"embedded_page"/.test(src));
check(
  "no payment_method_types is ever set",
  !/payment_method_types\s*:/.test(src),
);
check("no trial period is configured", !src.includes("trial_period_days"));
check("flexible billing mode is requested", src.includes('billing_mode: { type: "flexible" }'));
check("metadata is attached to subscription_data", /subscription_data:\s*\{[\s\S]*?metadata,/.test(src));
check("metadata is attached to the session", /\n\s{8}metadata,\n/.test(src));
check("recurring prices are enforced at runtime", src.includes('stripePrice.type !== "recurring"'));
check("API version pinned to 2026-06-24.dahlia", readFileSync(
  resolve(import.meta.dirname, "../src/lib/stripe.server.ts"),
  "utf8",
).includes('apiVersion: "2026-06-24.dahlia"'));

const id1 = buildIntegrationIdentifier();
const id2 = buildIntegrationIdentifier();
check(
  "integration identifier has an 8-random-letter suffix",
  /^consciousvoice_sub_v2_[a-z]{8}$/.test(id1) && id1 !== id2,
  id1,
);

console.log("\n=== Return URL is never trusted verbatim ===");
check(
  "hostile return URL falls back to the canonical origin",
  buildReturnUrl("https://evil.example.com/steal") ===
    "https://consciousvoice.tecendosom.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
);
check(
  "allowlisted origin is preserved",
  buildReturnUrl("http://localhost:8080/x").startsWith("http://localhost:8080/checkout/return"),
);

console.log("\n=== Wise / manual transfer never enters subscription checkout ===");
const pricing = readFileSync(
  resolve(import.meta.dirname, "../src/components/PricingPlans.tsx"),
  "utf8",
);
check(
  "Wise buttons open the external transfer link, not Stripe checkout",
  /openLeadCapture\("(live|complete)", "wise"\)/.test(pricing),
);
check(
  "Wise is labeled as a non-renewing manual transfer",
  /manual transfer — does not renew/.test(pricing),
);
check(
  "Stripe path is labeled as automatically renewing",
  /Renews automatically/i.test(pricing),
);
check(
  "pricing maps only the six recurring keys",
  RECURRING_PRICE_KEYS.every((k) => pricing.includes(k)) &&
    !LEGACY_ONE_TIME_KEYS.some((k) => pricing.includes(k)),
);

// ── Stripe rejects expansions deeper than 4 levels (property_expansion_max_depth) ──
console.log("\n=== Stripe expand paths stay within 4 levels ===");
const expandSources = [
  "src/lib/payments.functions.ts",
  "src/lib/billing-summary.server.ts",
  "src/lib/subscription-webhook.server.ts",
];
const deepExpands: string[] = [];
for (const file of expandSources) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g)) {
    const path = match[1]!;
    if (path.split(".").length > 4 && /\.(price|product|data|items)\b/.test(path)) {
      deepExpands.push(`${file}: ${path}`);
    }
  }
}
check(
  `no expand path exceeds 4 levels (${deepExpands.join(", ") || "none"})`,
  deepExpands.length === 0,
);

console.log(
  failures === 0 ? "\nALL CATALOG TESTS PASSED" : `\n${failures} CATALOG TEST FAILURE(S)`,
);
process.exit(failures ? 1 : 0);

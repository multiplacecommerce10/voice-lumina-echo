/**
 * PayPal subscription plan ALLOWLIST (client-safe, no secrets).
 *
 * Only these six plans may be sold. Each one charges the FULL selected period
 * up front (1, 3 or 6 months) and renews for the same period and price until
 * canceled — mirroring the Stripe catalog in subscription-catalog.ts.
 *
 * Live and sandbox maps are isolated: a live plan id is never valid in the
 * sandbox and vice versa. Sandbox plans have NOT been created yet; until real
 * sandbox plan ids are added here, PayPal checkout stays unavailable in the
 * sandbox environment. Never invent ids.
 *
 * Retired/incorrect historical plan ids live in paypal-legacy.ts for record
 * resolution only and are never offered.
 */

import { SUBSCRIPTION_CATALOG, type DurationMonths, type Tier } from "@/lib/subscription-catalog";

export type PayPalEnv = "sandbox" | "live";

export type PayPalPlan = {
  planId: string;
  tier: Tier;
  durationMonths: DurationMonths;
  /** Exact amount charged every cycle, as PayPal formats it ("418.95"). */
  amount: string;
  currency: "USD";
  lookupKey: string;
};

function plan(planId: string, tier: Tier, months: DurationMonths): PayPalPlan {
  const entry = SUBSCRIPTION_CATALOG[tier][months];
  return {
    planId,
    tier,
    durationMonths: months,
    amount: entry.amountUsd.toFixed(2),
    currency: "USD",
    lookupKey: entry.lookupKey,
  };
}

export const PAYPAL_PLANS: Record<PayPalEnv, readonly PayPalPlan[]> = {
  live: [
    plan("P-83B50311XC174031ENH2OWOY", "live", 1),
    plan("P-2RP31644M2379422RNLMSIJI", "live", 3),
    plan("P-94J85509T80508630NLMSIWY", "live", 6),
    plan("P-6BL44529PA8913407NH3OW2A", "complete", 1),
    plan("P-4XE1994779840341MNLMSJAQ", "complete", 3),
    plan("P-3B7436587Y5077510NLMSJLY", "complete", 6),
  ],
  // Real sandbox plan ids, created 2026-10-22 under product
  // PROD-4JU04504SG988094R ("The Power of Conscious Voice — Sandbox").
  // Same amounts/cycles as live; sandbox-only, never valid in live.
  sandbox: [
    plan("P-11M19538U6046553VNLMYWYI", "live", 1),
    plan("P-9G316434YE6629704NLMYWYI", "live", 3),
    plan("P-2FK06868YJ502912MNLMYWYQ", "live", 6),
    plan("P-8R014182FL7802749NLMYWYY", "complete", 1),
    plan("P-6YD011175T774454WNLMYWYY", "complete", 3),
    plan("P-88M85339S80335405NLMYWZA", "complete", 6),
  ],
};

export function findPayPalPlan(env: PayPalEnv, planId: string | null | undefined): PayPalPlan | null {
  if (!planId) return null;
  return PAYPAL_PLANS[env].find((p) => p.planId === planId) ?? null;
}

export function paypalPlanFor(env: PayPalEnv, tier: Tier, months: DurationMonths): PayPalPlan | null {
  return PAYPAL_PLANS[env].find((p) => p.tier === tier && p.durationMonths === months) ?? null;
}

/**
 * RECURRING SUBSCRIPTION CATALOG — single source of truth (client-safe).
 *
 * Each selected period is charged in FULL, UP FRONT, and renews automatically
 * for the same full period at the same price until canceled.
 *
 * Lookup keys are versioned (`_v1`). The historical one-time `*_pkg_*` keys are
 * preserved for record resolution only and must never be offered again.
 */

export type Tier = "live" | "complete";
export type DurationMonths = 1 | 3 | 6;

export const OFFERING_VERSION = "2026-08-17";

/** Days of continued access after a failed renewal, before suspension. */
export const GRACE_PERIOD_DAYS = 7;

export type CatalogEntry = {
  lookupKey: string;
  tier: Tier;
  durationMonths: DurationMonths;
  /** Amount charged every renewal cycle, in USD major units. */
  amountUsd: number;
};

export const SUBSCRIPTION_CATALOG: Record<Tier, Record<DurationMonths, CatalogEntry>> = {
  live: {
    1: { lookupKey: "live_sub_1m_v1", tier: "live", durationMonths: 1, amountUsd: 147.0 },
    3: { lookupKey: "live_sub_3m_v1", tier: "live", durationMonths: 3, amountUsd: 418.95 },
    6: { lookupKey: "live_sub_6m_v1", tier: "live", durationMonths: 6, amountUsd: 793.8 },
  },
  complete: {
    1: { lookupKey: "complete_sub_1m_v1", tier: "complete", durationMonths: 1, amountUsd: 197.0 },
    3: { lookupKey: "complete_sub_3m_v1", tier: "complete", durationMonths: 3, amountUsd: 561.45 },
    6: { lookupKey: "complete_sub_6m_v1", tier: "complete", durationMonths: 6, amountUsd: 1063.8 },
  },
};

export const RECURRING_PRICE_KEYS = [
  "live_sub_1m_v1",
  "live_sub_3m_v1",
  "live_sub_6m_v1",
  "complete_sub_1m_v1",
  "complete_sub_3m_v1",
  "complete_sub_6m_v1",
] as const;

/** Historical one-time prepaid keys — resolvable, never offered. */
export const LEGACY_ONE_TIME_KEYS = [
  "live_pkg_1m",
  "live_pkg_3m",
  "live_pkg_6m",
  "live_pkg_12m",
  "replay_pkg_1m",
  "replay_pkg_3m",
  "replay_pkg_6m",
  "replay_pkg_12m",
] as const;

/** Historical monthly-recurring keys from the first (retired) model. */
export const LEGACY_RECURRING_KEYS = [
  "live_cohort_1m",
  "live_cohort_3m",
  "live_cohort_6m",
  "live_cohort_12m",
  "replay_access_1m",
  "replay_access_3m",
  "replay_access_6m",
  "replay_access_12m",
] as const;

export function tierFromLookupKey(key: string | null | undefined): Tier | null {
  if (!key) return null;
  if (key.startsWith("live_")) return "live";
  if (key.startsWith("complete_") || key.startsWith("replay_")) return "complete";
  return null;
}

export function durationMonthsFromLookupKey(key: string | null | undefined): number | null {
  if (!key) return null;
  const m = key.match(/_(\d+)m(?:_v\d+)?$/);
  return m ? Number(m[1]) : null;
}

export function isRecurringLookupKey(key: string | null | undefined): boolean {
  return !!key && (RECURRING_PRICE_KEYS as readonly string[]).includes(key);
}

export function catalogEntry(tier: Tier, months: DurationMonths): CatalogEntry {
  return SUBSCRIPTION_CATALOG[tier][months];
}

/** "every 3 months" / "every month" */
export function intervalLabel(months: number): string {
  return months === 1 ? "every month" : `every ${months} months`;
}

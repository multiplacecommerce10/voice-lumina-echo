/**
 * Single source of truth for what each tier of "The Power of Conscious Voice"
 * actually includes. Browser- and server-safe: no secrets, no Node APIs.
 *
 * Every surface (landing page, pricing cards, FAQ, membership summary,
 * enrollment metadata, Stripe metadata, Taskade fulfillment payloads) must
 * read from here so no two screens can contradict each other.
 */

export type Tier = "live" | "complete";

/** Durations currently offered for new enrollment. 12 months is retired. */
export const OFFERED_DURATIONS = [1, 3, 6] as const;
export type OfferedDuration = (typeof OFFERED_DURATIONS)[number];

/**
 * Historical durations that may still appear in past records / recovery codes.
 * They must never be offered again for new enrollment.
 */
export const LEGACY_DURATIONS = [12] as const;

export function isOfferedDuration(months: number): months is OfferedDuration {
  return (OFFERED_DURATIONS as readonly number[]).includes(months);
}

/** Shared course model — identical for both tiers. */
export const COURSE_MODEL = {
  weekly_live_class_minutes: 90,
  private_sessions_30m_per_30d: 2,
  initial_mapping_minutes: 10,
  certificate_eligibility_after_active_months: 6,
  certificate_requires_foundations_completion: true,
  certificate_requires_transformation_portfolio: true,
  cohort_start_date: "2026-09-01",
  cohort_max_active_students: 30,
  rolling_admission_requires_human_review: true,
  portfolio_name: "Conscious Voice Transformation Portfolio",
  portfolio_subtitle:
    "A documented journey of vocal, expressive and creative development",
} as const;

export interface Entitlements {
  tier: Tier;
  foundations_library_access: boolean;
  replay_access: boolean;
  /** ISO date of the student's own enrollment, or null when no replay access. */
  replay_access_from: string | null;
  historical_cohort_archive: boolean;
  vocal_artistic_analysis: boolean;
  monthly_vip_access: boolean;
  private_sessions_30m_per_30d: number;
  initial_mapping_minutes: number;
  certificate_eligibility_after_active_months: number;
  certificate_requires_foundations_completion: boolean;
  certificate_requires_transformation_portfolio: boolean;
}

const BASE = {
  historical_cohort_archive: false,
  foundations_library_access: true,
  private_sessions_30m_per_30d: COURSE_MODEL.private_sessions_30m_per_30d,
  initial_mapping_minutes: COURSE_MODEL.initial_mapping_minutes,
  certificate_eligibility_after_active_months:
    COURSE_MODEL.certificate_eligibility_after_active_months,
  certificate_requires_foundations_completion:
    COURSE_MODEL.certificate_requires_foundations_completion,
  certificate_requires_transformation_portfolio:
    COURSE_MODEL.certificate_requires_transformation_portfolio,
} as const;

/**
 * Resolve the entitlement contract for a tier.
 *
 * @param studentEnrolledAt ISO timestamp of the student's own confirmed
 * enrollment. Replays for the Complete tier begin strictly from this date —
 * there is no historical cohort archive for anyone.
 */
export function resolveEntitlements(
  tier: Tier,
  studentEnrolledAt: string | null = null,
): Entitlements {
  const isComplete = tier === "complete";
  return {
    tier,
    ...BASE,
    replay_access: isComplete,
    replay_access_from: isComplete ? studentEnrolledAt : null,
    vocal_artistic_analysis: isComplete,
    monthly_vip_access: isComplete,
  };
}

/** Human-readable benefit list per tier, for pricing cards and previews. */
export const TIER_BENEFITS: Record<Tier, string[]> = {
  live: [
    "Weekly 90-minute live cohort class",
    "Two individual 30-minute sessions in each active 30-day cycle",
    "Method Foundations Library — recorded foundational vocal-technique videos",
    "10-minute initial pedagogical voice and expressive mapping in your first individual session",
    "Personalized learning priorities drawn from that mapping",
    "Certificate of Completion eligibility after six active months",
  ],
  complete: [
    "Class replay access, starting from your own enrollment date",
    "Detailed Vocal and Artistic Identity Analysis with a personalized learning plan",
    "One additional exclusive monthly VIP gathering",
  ],
};

export const TIER_LABELS: Record<Tier, string> = {
  live: "International Online Course",
  complete: "Complete Course Access",
};

/** Compact strings for Stripe metadata (values must stay short). */
export function entitlementsToMetadata(
  e: Entitlements,
): Record<string, string> {
  return {
    ent_tier: e.tier,
    ent_foundations_library: String(e.foundations_library_access),
    ent_replay_access: String(e.replay_access),
    ent_replay_access_from: e.replay_access_from ?? "",
    ent_historical_archive: String(e.historical_cohort_archive),
    ent_vocal_artistic_analysis: String(e.vocal_artistic_analysis),
    ent_monthly_vip: String(e.monthly_vip_access),
    ent_private_sessions_per_30d: String(e.private_sessions_30m_per_30d),
    ent_initial_mapping_minutes: String(e.initial_mapping_minutes),
    ent_certificate_after_months: String(
      e.certificate_eligibility_after_active_months,
    ),
  };
}

/** Tier implied by a price lookup key (`live_pkg_3m`, `replay_pkg_6m`). */
export function tierFromPriceKey(priceKey: string | null | undefined): Tier {
  return priceKey?.startsWith("live_") ? "live" : "complete";
}

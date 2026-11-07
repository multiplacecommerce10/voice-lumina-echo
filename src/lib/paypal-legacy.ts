// HISTORICAL PayPal plan ids — NEVER offered for new enrollments.
//
// These were created for earlier pricing models (incorrect amounts/cadence,
// or the retired 12-month duration). They stay here only so old records can
// still be recognised. Sellable plans live exclusively in paypal-plans.ts.
// External deactivation of these plans is done by the owner in PayPal.

export const RETIRED_PAYPAL_PLAN_IDS = [
  "P-31S34058PL511644TNH3O5WI", // old Live 3m
  "P-8UT23197GE272604CNH3PK5A", // old Live 6m
  "P-4VG65084JS4404322NH3PUNY", // old Live 12m (duration retired)
  "P-8CU14539NS630574WNH3OONQ", // old Complete 3m
  "P-7MX24597C4962493DNH3PDJI", // old Complete 6m
  "P-500961059D378105BNH3PQ3A", // old Complete 12m (duration retired)
] as const;

export function isRetiredPayPalPlan(planId: string | null | undefined): boolean {
  return !!planId && (RETIRED_PAYPAL_PLAN_IDS as readonly string[]).includes(planId);
}

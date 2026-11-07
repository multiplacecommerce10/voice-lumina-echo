/**
 * Single access rule shared by server code and tests. Mirrors the SQL
 * function public.has_active_membership() (RLS for the course).
 *
 * - Only `environment = 'live'` rows grant access, except rows explicitly
 *   flagged `courtesy_access` (owner-authorized sandbox courtesy/test seats).
 * - Access is bounded by dates, never by whether the scheduler already ran:
 *   active  → current_period_end must be in the future;
 *   grace   → grace_expires_at must be in the future.
 */
export type AccessRow = {
  environment?: string | null;
  courtesy_access?: boolean | null;
  access_status: string | null;
  current_period_end: string | null;
  grace_expires_at: string | null;
};

export function isMembershipActive(row: AccessRow | null | undefined, now: number): boolean {
  if (!row) return false;
  if (row.environment !== "live" && row.courtesy_access !== true) return false;
  if (row.access_status === "active") {
    return !!row.current_period_end && now < Date.parse(row.current_period_end);
  }
  if (row.access_status === "past_due_grace" || row.access_status === "grace") {
    return !!row.grace_expires_at && now < Date.parse(row.grace_expires_at);
  }
  return false;
}

// Shared "fictitious member" marker.
//
// Every record created for testing carries this chancela so it is visible,
// filterable and removable before the course goes on sale. Taskade tags any
// payload whose test_kind is "manual_test" as a "Fictitious member".

export const FICTITIOUS_TEST_KIND = "manual_test" as const;
export const FICTITIOUS_LABEL = "Fictitious member" as const;

/** Fields added to every test payload, at top level and inside `extra`. */
export const FICTITIOUS_MARKER = {
  is_test: true,
  test_mode: true,
  test_kind: FICTITIOUS_TEST_KIND,
  member_type: "fictitious",
  member_label: FICTITIOUS_LABEL,
  delete_before_launch: true,
} as const;

export type FictitiousMarker = typeof FICTITIOUS_MARKER;

/** Merges the marker into a Taskade payload (top level + `extra`). */
export function markFictitious<T extends Record<string, unknown>>(payload: T): T {
  const extra = (payload.extra ?? {}) as Record<string, unknown>;
  return {
    ...payload,
    ...FICTITIOUS_MARKER,
    extra: { ...extra, ...FICTITIOUS_MARKER },
  } as T;
}

/** Marker stored on a lead row (inside `answers`). */
export function fictitiousAnswers(extra?: Record<string, unknown>) {
  return { ...(extra ?? {}), ...FICTITIOUS_MARKER, marked_at: new Date().toISOString() };
}

/**
 * True when a lead row is a test record: explicit marker, or an obvious test
 * address/name kept from earlier manual checks.
 */
export function isFictitiousLead(lead: {
  email?: string | null;
  full_name?: string | null;
  source?: string | null;
  answers?: unknown;
}): boolean {
  const answers =
    lead.answers && typeof lead.answers === "object" && !Array.isArray(lead.answers)
      ? (lead.answers as Record<string, unknown>)
      : {};
  if (answers.is_test === true || answers.test_kind === FICTITIOUS_TEST_KIND) return true;
  if (answers.member_type === "fictitious") return true;

  const email = (lead.email ?? "").toLowerCase();
  const name = (lead.full_name ?? "").toLowerCase();
  const source = (lead.source ?? "").toLowerCase();

  if (source.includes("test") || source.includes("debug")) return true;
  if (/\+test|@example\.|@test\.|mailinator|lovable-test/.test(email)) return true;
  if (/(^|\b)(test|teste|fictitious|dummy|lovable test)\b/.test(name)) return true;
  return false;
}

/** Confirmation phrase required before deleting the test records. */
export const PURGE_CONFIRMATION = "DELETE FICTITIOUS MEMBERS";

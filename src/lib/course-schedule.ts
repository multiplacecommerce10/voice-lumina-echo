// Shared (browser-safe) course schedule helpers.
// Live classes: every Tuesday, 12:30–14:00 UTC, starting September 1, 2026.

export const COURSE_START_UTC = new Date(Date.UTC(2026, 8, 1, 12, 30));
export const CLASS_DURATION_MINUTES = 90;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** First class at or after `from` (weekly cadence from the course start). */
export function getNextClassAfter(from: Date = new Date()): Date {
  if (from.getTime() <= COURSE_START_UTC.getTime()) return new Date(COURSE_START_UTC);
  const weeks = Math.ceil((from.getTime() - COURSE_START_UTC.getTime()) / WEEK_MS);
  return new Date(COURSE_START_UTC.getTime() + weeks * WEEK_MS);
}

/** 1-based index of a class date within the course (week number). */
export function getClassNumber(classDate: Date): number {
  return Math.round((classDate.getTime() - COURSE_START_UTC.getTime()) / WEEK_MS) + 1;
}

export function classEnd(classDate: Date): Date {
  return new Date(classDate.getTime() + CLASS_DURATION_MINUTES * 60000);
}

export function isValidTimeZone(tz?: string | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** "Tuesday, September 1, 2026 at 9:30 AM – 11:00 AM (Brasilia Standard Time)" */
export function formatClassInTimeZone(classDate: Date, timeZone: string) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(classDate);
  const timeOpts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  const startLabel = new Intl.DateTimeFormat("en-US", timeOpts).format(classDate);
  const endLabel = new Intl.DateTimeFormat("en-US", timeOpts).format(classEnd(classDate));
  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" })
      .formatToParts(classDate)
      .find((p) => p.type === "timeZoneName")?.value ?? tz;

  return {
    timeZone: tz,
    dayLabel,
    startLabel,
    endLabel,
    timeZoneName: tzName,
    full: `${dayLabel} at ${startLabel} – ${endLabel} (${tzName})`,
  };
}

/** Course start formatted for a student's timezone (plus the UTC reference). */
export function formatCourseStart(timeZone: string) {
  return {
    utc: formatClassInTimeZone(COURSE_START_UTC, "UTC"),
    local: formatClassInTimeZone(COURSE_START_UTC, timeZone),
    iso: COURSE_START_UTC.toISOString(),
  };
}

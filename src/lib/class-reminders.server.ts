// Sends a weekly live-class reminder to Taskade 2 days before each class,
// localized to every enrolled student's own timezone.
import {
  COURSE_START_UTC,
  formatClassInTimeZone,
  getClassNumber,
  getNextClassAfter,
  isValidTimeZone,
} from "@/lib/course-schedule";

export const CLASS_REMINDER_LEAD_DAYS = 2;

export type ClassReminderStudent = {
  email: string;
  fullName: string | null;
  leadId: string | null;
  planName: string | null;
  timezone: string;
  environment: "sandbox" | "live";
};

export function buildClassReminderPayload(
  student: ClassReminderStudent,
  classDate: Date,
  options?: { membershipUrl?: string | null },
) {
  const local = formatClassInTimeZone(classDate, student.timezone);
  const utc = formatClassInTimeZone(classDate, "UTC");
  const classNumber = getClassNumber(classDate);
  const isFirstClass = classDate.getTime() === COURSE_START_UTC.getTime();

  const firstName = student.fullName?.trim().split(/\s+/)[0] ?? null;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null;
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,";

  const subject = isFirstClass
    ? `${displayName ? `${displayName}, o` : "O"}ur first class is in 2 days — ${local.dayLabel}`
    : `Your next class is in 2 days — ${local.dayLabel}, ${local.startLabel}`;
  const preheader = `${local.dayLabel} at ${local.startLabel} (${local.timeZoneName}).`;
  const intro = `${greeting} your ${isFirstClass ? "first" : `week ${classNumber}`} live class with Cuca Medina happens in 2 days: ${local.full}.`;
  const signoff = "See you in class — Cuca Medina, Conscious Voice";
  const paragraphs = [
    intro,
    `That is ${utc.dayLabel} at ${utc.startLabel} UTC — we already converted it to your timezone (${local.timeZone}) above, so just follow your local time.`,
    "Classes run for 90 minutes on Zoom. Arrive a few minutes early, bring water and a quiet space where you can sing freely.",
    signoff,
  ];

  return {
    preview: {
      subject,
      preheader,
      greeting,
      paragraphs,
      signoff,
      to: student.email,
      localFull: local.full,
    },
    payload: {
      event: "class.weekly_reminder" as const,
      environment: student.environment,
      lead_id: student.leadId,
      email: student.email,
      full_name: student.fullName,
      plan: student.planName,
      extra: {
        language: "en",
        language_name: "English",
        locale: "en-US",
        email_language_instruction:
          "Write this reminder entirely in English (US). Do not use Portuguese.",
        email_tone_instruction:
          "Warm and encouraging. Always state the class date and time in the student's own timezone.",
        student_first_name: displayName,
        student_full_name: student.fullName,
        student_email: student.email,
        student_timezone: local.timeZone,
        student_timezone_name: local.timeZoneName,
        greeting,
        email_subject: subject,
        email_preheader: preheader,
        email_intro: intro,
        email_body: paragraphs.join("\n\n"),
        email_signoff: signoff,
        cta_label: "Open my membership",
        cta_url: options?.membershipUrl ?? null,
        reminder_lead_days: CLASS_REMINDER_LEAD_DAYS,
        class_number: classNumber,
        is_first_class: isFirstClass,
        class_starts_at: classDate.toISOString(),
        class_starts_at_utc_formatted: utc.full,
        class_local_day: local.dayLabel,
        class_local_start: local.startLabel,
        class_local_end: local.endLabel,
        class_local_formatted: local.full,
        course_start_at: COURSE_START_UTC.toISOString(),
        course_start_utc_formatted: formatClassInTimeZone(COURSE_START_UTC, "UTC").full,
        course_start_local_formatted: formatClassInTimeZone(COURSE_START_UTC, student.timezone)
          .full,
        class_summary_text: `Your next live class: ${local.full}.`,
      } as Record<string, unknown>,
    },
  };
}

export type ClassReminderSweepResult = {
  class_at: string | null;
  scanned: number;
  sent: number;
  skipped: number;
  failures: number;
  details: { email: string; timezone: string; ok: boolean }[];
};

/**
 * Runs daily. When a class is exactly `CLASS_REMINDER_LEAD_DAYS` away,
 * notifies every active student in their own timezone.
 */
export async function runClassReminderSweep(options?: {
  dryRun?: boolean;
  force?: boolean;
}): Promise<ClassReminderSweepResult> {
  const result: ClassReminderSweepResult = {
    class_at: null,
    scanned: 0,
    sent: 0,
    skipped: 0,
    failures: 0,
    details: [],
  };

  const now = new Date();
  const nextClass = getNextClassAfter(now);
  const hoursAway = (nextClass.getTime() - now.getTime()) / 3600000;
  result.class_at = nextClass.toISOString();

  // Only fire on the day that sits `lead days` before the class.
  const windowStart = CLASS_REMINDER_LEAD_DAYS * 24 - 12;
  const windowEnd = CLASS_REMINDER_LEAD_DAYS * 24 + 12;
  if (!options?.force && (hoursAway < windowStart || hoursAway > windowEnd)) {
    return result;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs, error } = await supabaseAdmin
    .from("subscription_billing")
    .select(
      "lead_id, email, full_name, plan_name, environment, status, membership_url",
    )
    .in("status", ["active", "trialing", "past_due"]);

  if (error) {
    console.error("[class-reminders] query failed:", error);
    return result;
  }

  // Timezone lives in the enrollment answers.
  const leadIds = (subs ?? []).map((s) => s.lead_id).filter(Boolean) as string[];
  const emails = (subs ?? []).map((s) => s.email?.toLowerCase()).filter(Boolean) as string[];
  const tzByLead = new Map<string, string>();
  const tzByEmail = new Map<string, string>();
  if (leadIds.length || emails.length) {
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id, email, answers")
      .or(
        [
          leadIds.length ? `id.in.(${leadIds.join(",")})` : "",
          emails.length ? `email.in.(${emails.map((e) => `"${e}"`).join(",")})` : "",
        ]
          .filter(Boolean)
          .join(","),
      );
    for (const lead of leads ?? []) {
      const tz = (lead.answers as { timezone?: string } | null)?.timezone;
      if (isValidTimeZone(tz)) {
        tzByLead.set(lead.id as string, tz);
        if (lead.email) tzByEmail.set(String(lead.email).toLowerCase(), tz);
      }
    }
  }

  // Dedupe: skip students already notified for this exact class.
  const sentAlready = new Set<string>();
  if (!options?.force) {
    const since = new Date(Date.now() - 6 * 86400000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("webhook_audit_log")
      .select("request_payload, ok, created_at")
      .eq("event", "class.weekly_reminder")
      .eq("ok", true)
      .gte("created_at", since);
    for (const log of logs ?? []) {
      const p = log.request_payload as
        | { email?: string; extra?: { class_starts_at?: string } }
        | null;
      if (p?.email && p.extra?.class_starts_at === nextClass.toISOString()) {
        sentAlready.add(p.email.toLowerCase());
      }
    }
  }

  const { forwardToTaskade } = await import("@/lib/taskade.server");

  const seen = new Set<string>();
  for (const sub of subs ?? []) {
    const email = (sub.email as string | null)?.toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.scanned++;

    if (sentAlready.has(email)) {
      result.skipped++;
      continue;
    }

    const timezone =
      (sub.lead_id ? tzByLead.get(sub.lead_id as string) : null) ??
      tzByEmail.get(email) ??
      "UTC";

    const built = buildClassReminderPayload(
      {
        email,
        fullName: (sub.full_name as string | null) ?? null,
        leadId: (sub.lead_id as string | null) ?? null,
        planName: (sub.plan_name as string | null) ?? null,
        timezone,
        environment: (sub.environment as "sandbox" | "live") ?? "live",
      },
      nextClass,
      { membershipUrl: (sub.membership_url as string | null) ?? null },
    );

    const forward = await forwardToTaskade(
      {
        ...built.payload,
        extra: { ...built.payload.extra, ...(options?.dryRun ? { dry_run: true } : {}) },
      },
      { flow: "class-reminder" },
    );

    result.details.push({ email, timezone, ok: forward.ok });
    if (forward.ok) result.sent++;
    else result.failures++;
  }

  return result;
}

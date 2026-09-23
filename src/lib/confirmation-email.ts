// Builder for the paid-enrollment confirmation / receipt email.
// Shared by the webhook sender and the pre-send preview screen,
// so what you review is byte-for-byte what gets sent to Taskade.

import {
  buildChecklistHtml,
  buildEmailButton,
  buildEmailDocument,
  buildEmailHero,
  EMAIL_BRAND,
  escapeHtml,
} from "@/lib/email-branding";
import { planLabel } from "@/lib/recovery-email";

export const COURSE_NAME = "The Power of Conscious Voice — Tecendo Som";
export const DEFAULT_MEMBERSHIP_URL = "https://thepowerofconsciousvoice.world/";

export type ConfirmationEmailInput = {
  fullName: string | null;
  email: string | null;
  planIntended: string | null;
  tier: "live" | "complete" | null;
  durationMonths: number | null;
  totalFormatted: string | null;
  amountPerCycleFormatted: string | null;
  isRecurring: boolean;
  isRenewal: boolean;
  billingIntervalMonths: number | null;
  nextChargeAtFormatted: string | null;
  courseStartFormatted: string;
  nextClassFormatted: string;
  membershipUrl: string | null;
};

export type ConfirmationEmailDraft = {
  courseName: string;
  fullName: string;
  firstName: string;
  greetingName: string;
  greetingLine: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  planText: string;
  totalText: string;
  checklist: string[];
  isRenewal: boolean;
};

function buildWelcomeChecklist(input: ConfirmationEmailInput): string[] {
  const isComplete = input.tier === "complete";
  const checklist: string[] = [
    "Save the weekly live class in your calendar: Tuesdays, 90 minutes, starting September 1, 2026.",
    "Log in to the member area to confirm your access and explore the Method Foundations Library.",
    "Book your first individual 30-minute session — it includes the 10-minute initial voice and expressive mapping.",
    "Join your first live class on time with your camera on and a quiet, private space.",
  ];
  if (isComplete) {
    checklist.push(
      "Schedule your Detailed Vocal and Artistic Identity Analysis with your personalized learning plan.",
      "Watch for your exclusive monthly VIP gathering invitation — RSVP as soon as you receive it.",
    );
  }
  checklist.push(
    "Start with the Method Foundations Library warm-ups and posture modules before your first live class.",
    "Questions? Reply to this email — we read every message and respond within 1–2 business days.",
  );
  return checklist;
}

function buildRenewalChecklist(input: ConfirmationEmailInput): string[] {
  const checklist = [
    "Your access continues uninterrupted — no action is needed to keep your place.",
    "Confirm the next live class in your calendar.",
    "Continue booking your individual 30-minute sessions each active 30-day cycle.",
    "Keep exploring the Method Foundations Library and track your progress.",
  ];
  if (input.tier === "complete") {
    checklist.push("Watch for the next exclusive monthly VIP gathering invitation.");
  }
  checklist.push(
    "Questions or billing changes? Reply to this email — we respond within 1–2 business days.",
  );
  return checklist;
}

/** Approved short welcome email for a first-time paid enrollment. */
function buildFirstTimeBodyText(greetingName: string): string {
  return [
    `Dear ${greetingName},`,
    "",
    "Your enrollment in The Power of Conscious Voice is officially confirmed.",
    "",
    "I am truly happy to welcome you.",
    "",
    "Choosing to dedicate time and attention to your voice is a meaningful decision. This course was carefully designed to help you develop your vocal technique, deepen your awareness of your own resources and discover new expressive possibilities — while preserving the individuality of your voice.",
    "",
    "What happens next",
    "",
    "You will soon receive a second email with the information you need to access your member area.",
    "",
    "Please keep this message as confirmation of your enrollment.",
    "",
    "I look forward to accompanying you on this journey of vocal discovery, technical development and artistic expression.",
    "",
    "Welcome to The Power of Conscious Voice.",
    "",
    "Warmly,",
    "Cuca Medina",
    "The Power of Conscious Voice",
    "Tecendo Som",
    "Tecendo Som Team",
  ].join("\n");
}

/** Approved short welcome email — branded HTML version. */
function buildFirstTimeBodyHtml(greetingName: string): string {
  const paragraphStyle = `font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;`;
  const closingStyle = `font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:24px 0 0;`;

  return `
<p style="${paragraphStyle}">Dear ${escapeHtml(greetingName)},</p>

<p style="${paragraphStyle}">Your enrollment in The Power of Conscious Voice is officially confirmed.</p>

<p style="${paragraphStyle}">I am truly happy to welcome you.</p>

<p style="${paragraphStyle}">Choosing to dedicate time and attention to your voice is a meaningful decision. This course was carefully designed to help you develop your vocal technique, deepen your awareness of your own resources and discover new expressive possibilities — while preserving the individuality of your voice.</p>

<h2 style="font-family:${EMAIL_BRAND.fontDisplay};font-size:20px;color:${EMAIL_BRAND.ink};margin:28px 0 14px;font-weight:600;">What happens next</h2>

<p style="${paragraphStyle}">You will soon receive a second email with the information you need to access your member area.</p>

<p style="${paragraphStyle}">Please keep this message as confirmation of your enrollment.</p>

<p style="${closingStyle}">I look forward to accompanying you on this journey of vocal discovery, technical development and artistic expression.</p>

<p style="${closingStyle}">Welcome to The Power of Conscious Voice.</p>

<p style="${closingStyle}">Warmly,<br />Cuca Medina<br />The Power of Conscious Voice<br />Tecendo Som<br />Tecendo Som Team</p>
`.trim();
}

export function buildConfirmationEmail(input: ConfirmationEmailInput): ConfirmationEmailDraft {
  const fullName = (input.fullName ?? "").trim();
  const firstName = fullName.split(/\s+/)[0] || "";
  const greetingName = firstName || "there";
  const planText = planLabel(input.planIntended);
  const membershipUrl = input.membershipUrl || DEFAULT_MEMBERSHIP_URL;

  const totalText =
    input.isRecurring && input.billingIntervalMonths && input.billingIntervalMonths > 1
      ? `You have been charged ${input.totalFormatted} for the full ${input.durationMonths}-month commitment. This subscription renews every ${input.billingIntervalMonths} months for the same amount until you cancel.`
      : input.isRecurring
        ? `You have been charged ${input.totalFormatted} for the full ${input.durationMonths}-month commitment. This subscription renews monthly for the same amount until you cancel.`
        : `You have been charged ${input.totalFormatted} for the full ${input.durationMonths ?? ""}-month access period. There is no automatic renewal and no further charge.`;

  const nextChargeText =
    input.isRecurring && input.nextChargeAtFormatted
      ? `Your next charge is scheduled for ${input.nextChargeAtFormatted}.`
      : "";

  const checklist = input.isRenewal ? buildRenewalChecklist(input) : buildWelcomeChecklist(input);

  const subject = input.isRenewal
    ? `${greetingName}, your renewal in The Power of Conscious Voice is confirmed`
    : `${greetingName}, welcome to The Power of Conscious Voice — enrollment confirmed`;

  // First-time enrollment uses the approved short welcome copy.
  if (!input.isRenewal) {
    const bodyText = buildFirstTimeBodyText(greetingName);
    const bodyHtml = buildEmailDocument({
      previewText: "Enrollment Confirmed",
      hero: buildEmailHero({
        headline: "Enrollment Confirmed",
        subheadline: "Welcome to The Power of Conscious Voice",
        greetingName,
      }),
      bodyHtml: buildFirstTimeBodyHtml(greetingName),
    });

    return {
      courseName: COURSE_NAME,
      fullName,
      firstName,
      greetingName,
      greetingLine: `Dear ${greetingName},`,
      subject,
      bodyText,
      bodyHtml,
      planText,
      totalText,
      checklist,
      isRenewal: false,
    };
  }

  // Renewal branch keeps the existing receipt/checklist/schedule content.
  const intro = `Welcome back to ${COURSE_NAME}. Your subscription has renewed successfully, and your access continues without interruption.`;
  const closing = "Thank you for continuing this journey with us. It is an honor to keep walking beside your voice.";

  const bodyText = [
    `Dear ${greetingName},`,
    "",
    intro,
    "",
    `Plan: ${planText}`,
    `Total paid: ${input.totalFormatted}`,
    "",
    totalText,
    nextChargeText,
    "",
    "Your next steps:",
    ...checklist.map((item, i) => `${i + 1}. ${item}`),
    "",
    `Member area: ${membershipUrl}`,
    `Your next live class: ${input.nextClassFormatted}`,
    `Course start: ${input.courseStartFormatted}`,
    "",
    closing,
    "",
    "With warmth,",
    "Cuca Medina — Tecendo Som",
    "",
    "Priscila Medina Gubert — ME (Tecendo Som) | CNPJ 07.331.609/0001-92 | Avenida Orleães, 104, Porto Alegre, RS, Brazil",
    "Questions? Write to contact@tecendosom.com — we read every message.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const bodyHtml = buildConfirmationHtml({
    greetingName,
    intro,
    closing,
    planText,
    totalFormatted: input.totalFormatted,
    totalText,
    nextChargeText,
    checklist,
    membershipUrl,
    nextClassFormatted: input.nextClassFormatted,
    courseStartFormatted: input.courseStartFormatted,
    isRenewal: true,
  });

  return {
    courseName: COURSE_NAME,
    fullName,
    firstName,
    greetingName,
    greetingLine: `Dear ${greetingName},`,
    subject,
    bodyText,
    bodyHtml,
    planText,
    totalText,
    checklist,
    isRenewal: true,
  };
}

function buildConfirmationHtml(props: {
  greetingName: string;
  intro: string;
  closing: string;
  planText: string;
  totalFormatted: string | null;
  totalText: string;
  nextChargeText: string;
  checklist: string[];
  membershipUrl: string;
  nextClassFormatted: string;
  courseStartFormatted: string;
  isRenewal: boolean;
}): string {
  const heading = props.isRenewal ? "Renewal Confirmed" : "Enrollment Confirmed";
  const subheadline = props.isRenewal
    ? "Your access continues uninterrupted"
    : "Welcome to The Power of Conscious Voice";

  const bodyInner = `
<p style="font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;">${escapeHtml(props.intro)}</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.cream};border-radius:12px;margin:20px 0;border:1px solid ${EMAIL_BRAND.border};">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${EMAIL_BRAND.muted};margin:0 0 8px;">Plan</p>
      <p style="font-family:${EMAIL_BRAND.fontDisplay};font-size:22px;color:${EMAIL_BRAND.ink};margin:0 0 16px;font-weight:600;">${escapeHtml(props.planText)}</p>
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${EMAIL_BRAND.muted};margin:0 0 8px;">Total paid</p>
      <p style="font-family:${EMAIL_BRAND.fontDisplay};font-size:28px;color:${EMAIL_BRAND.gold};margin:0;font-weight:600;">${escapeHtml(props.totalFormatted ?? "")}</p>
    </td>
  </tr>
</table>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:0 0 18px;">${escapeHtml(props.totalText)} ${props.nextChargeText ? escapeHtml(props.nextChargeText) : ""}</p>

<h2 style="font-family:${EMAIL_BRAND.fontDisplay};font-size:20px;color:${EMAIL_BRAND.ink};margin:28px 0 14px;font-weight:600;">${props.isRenewal ? "What’s next" : "What happens next"}</h2>
${buildChecklistHtml(props.checklist)}

${buildEmailButton("Go to member area", props.membershipUrl)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;border-top:1px solid ${EMAIL_BRAND.border};padding-top:20px;">
  <tr>
    <td style="font-family:${EMAIL_BRAND.fontSans};font-size:14px;line-height:1.6;color:${EMAIL_BRAND.inkLight};">
      <p style="margin:0 0 6px;"><strong>Next live class:</strong> ${escapeHtml(props.nextClassFormatted)}</p>
      <p style="margin:0;"><strong>Course start:</strong> ${escapeHtml(props.courseStartFormatted)}</p>
    </td>
  </tr>
</table>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:24px 0 0;">${escapeHtml(props.closing)}</p>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:18px 0 0;">With warmth,<br />Cuca Medina — Tecendo Som</p>
`.trim();

  return buildEmailDocument({
    previewText: heading,
    hero: buildEmailHero({
      headline: heading,
      subheadline,
      greetingName: props.greetingName,
    }),
    bodyHtml: bodyInner,
  });
}

/** Quality checks run before a confirmation email is attached to the payload. */
export function auditConfirmationEmail(draft: ConfirmationEmailDraft, email: string | null) {
  const issues: { level: "error" | "warning"; message: string }[] = [];
  if (!email) issues.push({ level: "error", message: "Recipient has no email address." });
  if (!draft.firstName)
    issues.push({
      level: "warning",
      message: 'No first name on the enrollment — the email will say "Hello there,".',
    });
  if (
    /[([{]\s*(name|first[_ ]?name)\s*[)\]}]/i.test(draft.bodyText) ||
    /\(\s*\w+\s*\)/.test(draft.greetingLine)
  )
    issues.push({ level: "error", message: "Greeting contains a placeholder/parenthesis around the name." });
  if (/tecendo som course/i.test(draft.bodyText) || /tecendo som course/i.test(draft.subject))
    issues.push({ level: "error", message: 'Wrong course name ("Tecendo Som Course").' });

  // Receipt/checklist requirements apply only to renewals now.
  // First-time enrollments use the intentionally short welcome copy.
  if (draft.isRenewal) {
    if (!draft.totalText || !draft.totalText.includes("$"))
      issues.push({ level: "error", message: "Total paid is missing or not formatted." });
    if (!draft.planText || draft.planText === "Your enrollment")
      issues.push({ level: "warning", message: "Plan label is missing or generic." });
    if (draft.checklist.length < 4)
      issues.push({ level: "error", message: "Next-step checklist is too short." });
  }

  if (
    /[ãõçáéíóúâêô]/i.test(
      draft.bodyText.replace(/Cuca Medina|Tecendo Som|Orleães/g, ""),
    )
  )
    issues.push({ level: "warning", message: "Body may contain Portuguese text — all comms must be English." });
  if (/\{\{|\}\}|\$\{|%[sd]|<\/?[a-zA-Z][^>]*>|&[a-z]+;/i.test(draft.bodyText))
    issues.push({ level: "error", message: "Plain-text body contains leftover code, merge tags or HTML artifacts." });
  if (/[ \t]+\n|\n{3,}| {2,}/.test(draft.bodyText))
    issues.push({ level: "warning", message: "Plain-text body has irregular spacing." });
  if (!draft.bodyHtml || !draft.bodyHtml.includes("<!DOCTYPE html>"))
    issues.push({ level: "error", message: "HTML body is missing or not a complete document." });
  if (!draft.bodyHtml?.includes(EMAIL_BRAND.courseName))
    issues.push({ level: "warning", message: "HTML hero may be missing the course name." });
  if (draft.subject.length > 100)
    issues.push({ level: "warning", message: `Subject is long (${draft.subject.length} chars).` });
  return issues;
}

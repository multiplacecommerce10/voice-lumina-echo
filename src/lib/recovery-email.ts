// Builder for the abandoned-checkout recovery email.
// Shared by the sender (lead-recovery.server.ts) and the pre-send preview screen,
// so what you review is byte-for-byte what gets sent.

import {
  buildEmailButton,
  buildEmailDocument,
  buildEmailHero,
  EMAIL_BRAND,
  escapeHtml,
} from "@/lib/email-branding";

export const RESUME_BASE_URL = "https://voice-lumina-echo.lovable.app/";
export const COURSE_NAME = "The Power of Conscious Voice — Tecendo Som";

export function planLabel(planIntended: string | null): string {
  if (!planIntended) return "Your enrollment";
  const [tier, dur] = planIntended.split("__");
  const months = (dur ?? "").replace("m", "");
  const name =
    tier === "live" ? "International Online Course" : "Complete Course Access";
  return months ? `${name} (${months} month${months === "1" ? "" : "s"})` : name;
}

export function buildResumeUrl(resumeCode: string | null, leadId: string): string {
  return `${RESUME_BASE_URL}?resume=${resumeCode ?? ""}&lead=${leadId}&utm_source=recovery&utm_medium=email&utm_campaign=abandoned_checkout#pricing`;
}

export type RecoveryEmailInput = {
  leadId: string;
  fullName: string | null;
  planIntended: string | null;
  resumeCode: string | null;
};

export type RecoveryEmailDraft = {
  courseName: string;
  fullName: string;
  firstName: string;
  greetingName: string;
  greetingLine: string;
  planText: string;
  resumeUrl: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export function buildRecoveryEmail(input: RecoveryEmailInput): RecoveryEmailDraft {
  const fullName = (input.fullName ?? "").trim();
  const firstName = fullName.split(/\s+/)[0] || "";
  const greetingName = firstName || "there";
  const planText = planLabel(input.planIntended);
  const resumeUrl = buildResumeUrl(input.resumeCode, input.leadId);

  const subject = `${greetingName}, your place in The Power of Conscious Voice is waiting for you`;
  const bodyText = [
    `Dear ${greetingName},`,
    "",
    `It was a pleasure to see you begin your enrollment in ${COURSE_NAME}. I noticed the final step is still open, and I would not want you to miss your place in the cohort.`,
    "",
    `Your selected plan: ${planText}.`,
    "",
    "Everything you entered is safely saved, so you can continue from exactly where you left off — it takes only a moment to complete.",
    "",
    `Resume my enrollment: ${resumeUrl}`,
    "",
    "Should any question arise, simply reply to this message. I read every email personally and will be glad to help.",
    "",
    "With warmth,",
    "Cuca Medina — Tecendo Som",
  ].join("\n");

  const bodyHtml = buildRecoveryHtml({ greetingName, planText, resumeUrl });

  return {
    courseName: COURSE_NAME,
    fullName,
    firstName,
    greetingName,
    greetingLine: `Dear ${greetingName},`,
    planText,
    resumeUrl,
    subject,
    bodyText,
    bodyHtml,
  };
}

function buildRecoveryHtml(props: {
  greetingName: string;
  planText: string;
  resumeUrl: string;
}): string {
  const bodyInner = `
<p style="font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;">Dear ${escapeHtml(props.greetingName)},</p>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;">It was a pleasure to see you begin your enrollment in <strong style="color:${EMAIL_BRAND.ink};">${EMAIL_BRAND.courseNameFull}</strong>. I noticed the final step is still open, and I would not want you to miss your place in the cohort.</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.cream};border-radius:12px;margin:20px 0;border:1px solid ${EMAIL_BRAND.border};">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${EMAIL_BRAND.muted};margin:0 0 8px;">Your selected plan</p>
      <p style="font-family:${EMAIL_BRAND.fontDisplay};font-size:22px;color:${EMAIL_BRAND.ink};margin:0;font-weight:600;">${escapeHtml(props.planText)}</p>
    </td>
  </tr>
</table>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:0 0 18px;">Everything you entered is safely saved, so you can continue from exactly where you left off — it takes only a moment to complete.</p>

${buildEmailButton("Resume my enrollment", props.resumeUrl)}

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:24px 0 0;">Should any question arise, simply reply to this message. I read every email personally and will be glad to help.</p>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:18px 0 0;">With warmth,<br />Cuca Medina — Tecendo Som</p>
`.trim();

  return buildEmailDocument({
    previewText: "Your place in the cohort is still reserved",
    hero: buildEmailHero({
      headline: "Your place is waiting for you",
      subheadline: EMAIL_BRAND.courseNameFull,
      greetingName: props.greetingName,
    }),
    bodyHtml: bodyInner,
  });
}

/** Quality checks run before a send is allowed. */
export function auditRecoveryEmail(draft: RecoveryEmailDraft, email: string | null) {
  const issues: { level: "error" | "warning"; message: string }[] = [];
  if (!email) issues.push({ level: "error", message: "Lead has no email address." });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
    issues.push({ level: "error", message: `Invalid email address: "${email}".` });
  if (!draft.firstName)
    issues.push({ level: "warning", message: 'No first name on the lead — the email will say "Hello there,".' });
  if (/[([{]\s*(name|first[_ ]?name)\s*[)\]}]/i.test(draft.bodyText) || /\(\s*\w+\s*\)/.test(draft.greetingLine))
    issues.push({ level: "error", message: "Greeting contains a placeholder/parenthesis around the name." });
  if (/tecendo som course/i.test(draft.bodyText) || /tecendo som course/i.test(draft.subject))
    issues.push({ level: "error", message: 'Wrong course name ("Tecendo Som Course").' });
  if (!draft.resumeUrl.includes("resume=") || draft.resumeUrl.includes("resume=&"))
    issues.push({ level: "error", message: "Resume link is missing its recovery code." });
  if (/[ãõçáéíóúâêô]/i.test(draft.bodyText.replace(/Cuca Medina|Tecendo Som|Orleães/g, "")))
    issues.push({ level: "warning", message: "Body may contain Portuguese text — all comms must be English." });
  if (/\{\{|\}\}|\$\{|%[sd]|<\/?[a-zA-Z][^>]*>|&[a-z]+;/i.test(draft.bodyText))
    issues.push({ level: "error", message: "Plain-text body contains leftover code, merge tags or HTML artifacts." });
  if (/[ \t]+\n|\n{3,}| {2,}/.test(draft.bodyText))
    issues.push({ level: "warning", message: "Plain-text body has irregular spacing." });
  if (!draft.bodyHtml || !draft.bodyHtml.includes("<!DOCTYPE html>"))
    issues.push({ level: "error", message: "HTML body is missing or not a complete document." });
  if (!draft.bodyHtml?.includes(EMAIL_BRAND.courseName))
    issues.push({ level: "warning", message: "HTML hero may be missing the course name." });
  if (draft.subject.length > 90)
    issues.push({ level: "warning", message: `Subject is long (${draft.subject.length} chars).` });
  return issues;
}

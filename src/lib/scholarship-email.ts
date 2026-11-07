// Branded confirmation email for Global Solidarity Scholarship applicants.
// Same visual identity as the paid-enrollment welcome email. Sent by Taskade
// from the enrollment mailbox; this module only builds subject/HTML/text.
import {
  EMAIL_BRAND,
  buildEmailDocument,
  buildEmailHero,
  emphasiseCourseName,
  escapeHtml,
} from "@/lib/email-branding";


export type ScholarshipEmailDraft = {
  greetingName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

const PARAGRAPHS = [
  "Thank you for applying for a Global Solidarity Scholarship for The Power of Conscious Voice. Your application has been received.",
  "Sharing your voice journey and your hopes for this course is a meaningful step, and I am grateful for your trust.",
];

const NEXT_STEPS = [
  "Every application is reviewed personally and with care. Our team will contact you soon by email with the outcome and, if a seat is granted, the details to complete your enrollment.",
  "Please keep this message as confirmation that your application was received. Submitting an application does not guarantee a seat.",
];

const CLOSING = "Thank you for wishing to walk this path of vocal discovery and artistic expression with us.";
const SIGNATURE = ["Warmly,", "Cuca Medina"];

export function buildScholarshipApplicationEmail(fullName: string): ScholarshipEmailDraft {
  const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "";
  const greetingName = firstName || "there";
  const subject = `${greetingName}, we received your scholarship application — The Power of Conscious Voice`;

  const bodyText = [
    `Dear ${greetingName},`,
    "",
    ...PARAGRAPHS.flatMap((p) => [p, ""]),
    "What happens next",
    "",
    ...NEXT_STEPS.flatMap((p) => [p, ""]),
    CLOSING,
    "",
    ...SIGNATURE,
  ].join("\n");

  const p = `font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;`;
  const c = `font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:24px 0 0;`;
  const inner = [
    `<p style="${p}">Dear ${escapeHtml(greetingName)},</p>`,
    ...PARAGRAPHS.map((t) => `<p style="${p}">${emphasiseCourseName(escapeHtml(t))}</p>`),
    `<h2 style="font-family:${EMAIL_BRAND.fontDisplay};font-size:20px;color:${EMAIL_BRAND.ink};margin:28px 0 14px;font-weight:600;">What happens next</h2>`,
    ...NEXT_STEPS.map((t) => `<p style="${p}">${escapeHtml(t)}</p>`),
    `<p style="${c}">${escapeHtml(CLOSING)}</p>`,
    `<p style="${c}">${SIGNATURE.map(escapeHtml).join("<br />")}</p>`,
  ].join("\n\n");

  const bodyHtml = buildEmailDocument({
    previewText: "Scholarship application received",
    hero: buildEmailHero({
      headline: "Application Received",
      courseBanner: false,
      scholarshipBanner: true,
    }),
    bodyHtml: inner,
  });

  return { greetingName, subject, bodyText, bodyHtml };
}

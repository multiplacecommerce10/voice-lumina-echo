// Builder for the SECOND enrollment email: member-area access credentials.
//
// Flow: the enrollment webhook (flow_key = "payment_confirmed") triggers the
// Taskade automation, which sends two emails from
// subscription@consciousvoice.tecendosom.com:
//   1. Welcome / enrollment confirmation  -> src/lib/confirmation-email.ts
//   2. Member-area access credentials     -> this file
//
// The credentials themselves are created by Taskade (member area), so this
// email intentionally keeps two merge tokens that Taskade must replace before
// sending: {{member_username}} and {{member_password}}.

import {
  buildChecklistHtml,
  buildEmailButton,
  buildEmailDocument,
  buildEmailHero,
  EMAIL_BRAND,
  escapeHtml,
} from "@/lib/email-branding";

export const CREDENTIALS_TOKENS = ["{{member_username}}", "{{member_password}}"] as const;

export type AccessCredentialsEmailInput = {
  fullName: string | null;
  membershipUrl: string | null;
  tier: "live" | "complete" | null;
};

export type AccessCredentialsEmailDraft = {
  subject: string;
  greetingName: string;
  bodyText: string;
  bodyHtml: string;
  steps: string[];
  requiredTokens: string[];
};

export function buildAccessCredentialsEmail(
  input: AccessCredentialsEmailInput,
): AccessCredentialsEmailDraft {
  const fullName = (input.fullName ?? "").trim();
  const greetingName = fullName.split(/\s+/)[0] || "there";
  const membershipUrl = input.membershipUrl || EMAIL_BRAND.membershipUrl;

  const steps = [
    "Open the member area using the button below.",
    "Sign in with the username and password shown above.",
    "Set a new password of your own on first sign-in.",
    "Explore the Method Foundations Library and confirm your weekly live class.",
  ];
  if (input.tier === "complete") {
    steps.push(
      "Your Complete benefits are already active: class replays from your enrollment date, the Vocal and Artistic Identity Analysis and the monthly VIP gathering.",
    );
  }
  steps.push("Keep these credentials private — they are personal and non-transferable.");

  const subject = `${greetingName}, here is your member area access — The Power of Conscious Voice`;

  const intro =
    "Your student account is ready. Below are the credentials to enter the member area, where your classes, materials and individual sessions live.";
  const closing =
    "If anything does not work on your first sign-in, simply reply to this email and we will help you right away.";

  const bodyText = [
    `Dear ${greetingName},`,
    "",
    intro,
    "",
    "Your access credentials:",
    "Username: {{member_username}}",
    "Password: {{member_password}}",
    "",
    `Member area: ${membershipUrl}`,
    "",
    "How to get started:",
    ...steps.map((step, i) => `${i + 1}. ${step}`),
    "",
    closing,
    "",
    "With warmth,",
    "Cuca Medina — Tecendo Som",
    "",
    "Priscila Medina Gubert — ME (Tecendo Som) | CNPJ 07.331.609/0001-92 | Avenida Orleães, 104, Porto Alegre, RS, Brazil",
    "Questions? Write to contact@tecendosom.com — we read every message.",
  ].join("\n");

  const bodyInner = `
<p style="font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;">${escapeHtml(intro)}</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.cream};border-radius:12px;margin:20px 0;border:1px solid ${EMAIL_BRAND.border};">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${EMAIL_BRAND.muted};margin:0 0 8px;">Username</p>
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:18px;color:${EMAIL_BRAND.ink};margin:0 0 16px;font-weight:600;">{{member_username}}</p>
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${EMAIL_BRAND.muted};margin:0 0 8px;">Password</p>
      <p style="font-family:${EMAIL_BRAND.fontSans};font-size:18px;color:${EMAIL_BRAND.gold};margin:0;font-weight:600;">{{member_password}}</p>
    </td>
  </tr>
</table>

<h2 style="font-family:${EMAIL_BRAND.fontDisplay};font-size:20px;color:${EMAIL_BRAND.ink};margin:28px 0 14px;font-weight:600;">How to get started</h2>
${buildChecklistHtml(steps)}

${buildEmailButton("Enter the member area", membershipUrl)}

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:24px 0 0;">${escapeHtml(closing)}</p>

<p style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.inkLight};margin:18px 0 0;">With warmth,<br />Cuca Medina — Tecendo Som</p>
`.trim();

  const bodyHtml = buildEmailDocument({
    previewText: "Your member area access",
    hero: buildEmailHero({
      headline: "Your Member Access",
      subheadline: "Username and password for The Power of Conscious Voice",
      greetingName,
    }),
    bodyHtml: bodyInner,
  });

  return {
    subject,
    greetingName,
    bodyText,
    bodyHtml,
    steps,
    requiredTokens: [...CREDENTIALS_TOKENS],
  };
}

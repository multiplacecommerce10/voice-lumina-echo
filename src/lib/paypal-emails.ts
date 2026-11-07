/**
 * Provider-aware PayPal student emails. NEVER contain passwords:
 * new accounts receive a one-time set-password link; existing accounts are
 * told to sign in (or use "Forgot password?") with their current login.
 */
import {
  buildEmailButton,
  buildEmailDocument,
  buildEmailHero,
  escapeHtml,
} from "@/lib/email-branding";

const SITE = "https://consciousvoice.tecendosom.com";
const PAYPAL_AUTOPAY_URL = "https://www.paypal.com/myaccount/autopay/";

type Draft = { subject: string; bodyHtml: string; bodyText: string };

function first(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

function doc(preview: string, headline: string, name: string, paras: string[], button?: [string, string]): string {
  const body = `
<p style="margin:0 0 16px;">Hello ${escapeHtml(first(name))},</p>
${paras.map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p)}</p>`).join("\n")}
${button ? buildEmailButton(button[0], button[1]) : ""}
<p style="margin:24px 0 0;">With warmth,<br/>Cuca Medina — Tecendo Som Team</p>`;
  return buildEmailDocument({ previewText: preview, hero: buildEmailHero({ headline }), bodyHtml: body });
}

function text(name: string, paras: string[], link?: string) {
  return [`Hello ${first(name)},`, "", ...paras.flatMap((p) => [p, ""]), link ?? "", "", "With warmth,", "Cuca Medina — Tecendo Som Team"].join("\n");
}

export function buildPayPalAccountAccessEmail(input: {
  fullName: string | null;
  email: string;
  /** One-time set-password link for a NEW account; null for an existing account. */
  setPasswordUrl: string | null;
}): Draft {
  if (input.setPasswordUrl) {
    const paras = [
      `Your member account for The Power of Conscious Voice has been created with ${input.email}.`,
      "Use the secure link below to choose your own password. The link works once and expires; if it has expired, use “Forgot password?” on the sign-in page.",
      "You can also sign in with Google or Microsoft if they use this same email address.",
    ];
    return {
      subject: "Set your password — The Power of Conscious Voice",
      bodyHtml: doc("Set your password", "Your member area is ready", input.fullName ?? "", paras, ["Set my password", input.setPasswordUrl]),
      bodyText: text(input.fullName ?? "", paras, input.setPasswordUrl),
    };
  }
  const paras = [
    `Your enrollment is linked to your existing account (${input.email}). Your password has not been changed.`,
    "Sign in as usual. If you don't remember your password, choose “Forgot password?” on the sign-in page to receive a secure reset link.",
  ];
  return {
    subject: "Your member area access — The Power of Conscious Voice",
    bodyHtml: doc("Your member area access", "Your member area is ready", input.fullName ?? "", paras, ["Sign in", `${SITE}/login`]),
    bodyText: text(input.fullName ?? "", paras, `${SITE}/login`),
  };
}

export type PayPalNoticeKind =
  | "payment_failed_initial"
  | "grace_notice"
  | "access_suspended_notice"
  | "cancellation_scheduled_notice";

function fmt(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    : "the end of your paid period";
}

export function buildPayPalNoticeEmail(
  kind: PayPalNoticeKind,
  input: { fullName: string | null; graceExpiresAt: string | null; currentPeriodEnd: string | null },
): Draft {
  const n = input.fullName ?? "";
  const manage = "You can review or update your payment method in PayPal under Settings → Payments → Automatic payments.";
  const map: Record<PayPalNoticeKind, { subject: string; headline: string; paras: string[] }> = {
    payment_failed_initial: {
      subject: "Your PayPal payment did not go through",
      headline: "Payment not completed",
      paras: ["PayPal reported that your first payment for The Power of Conscious Voice was not completed, so your enrollment has not started and no access was opened.", manage],
    },
    grace_notice: {
      subject: "Action needed: your PayPal renewal payment failed",
      headline: "Renewal payment failed",
      paras: [`PayPal could not collect your renewal payment. Your access continues until ${fmt(input.graceExpiresAt)} while the payment is retried.`, manage],
    },
    access_suspended_notice: {
      subject: "Your member access is paused",
      headline: "Access paused",
      paras: ["We could not confirm your renewal payment within the 7-day grace period, so your member access is paused. A successful payment through PayPal restores it automatically.", manage],
    },
    cancellation_scheduled_notice: {
      subject: "Your PayPal subscription was cancelled",
      headline: "Cancellation confirmed",
      paras: [`Your subscription will not renew. You keep full access until ${fmt(input.currentPeriodEnd)}, and you will not be charged again.`],
    },
  };
  const m = map[kind];
  const btn: [string, string] | undefined = kind === "cancellation_scheduled_notice" ? undefined : ["Open PayPal automatic payments", PAYPAL_AUTOPAY_URL];
  return { subject: m.subject, bodyHtml: doc(m.subject, m.headline, n, m.paras, btn), bodyText: text(n, m.paras, btn?.[1]) };
}

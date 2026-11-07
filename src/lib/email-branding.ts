// Shared email branding for member-facing emails.
// Emails are rendered as HTML inline and forwarded to Taskade,
// which must use the provided HTML verbatim when email_body_html is present.
import scholarshipBannerAsset from "@/assets/scholarships-email-banner.png.asset.json";
import courseBannerAsset from "@/assets/hero-conscious-voice-banner.png.asset.json";
import footerLogoAsset from "@/assets/tecendo-som-round-logo.png.asset.json";

// Sender identities (Hostinger professional mailboxes). Taskade must send
// each automation from the matching mailbox — never from a Taskade address.
export const EMAIL_SENDERS = {
  payment_confirmed: "subscription@consciousvoice.tecendosom.com",
  cart_recovery: "contact@confirm.tecendosom.com",
  name: "Cuca Medina — Tecendo Som",
} as const;

export type EmailFlowKey = keyof typeof EMAIL_SENDERS extends infer K
  ? K extends "payment_confirmed" | "cart_recovery" ? K : never
  : never;

export function senderInstruction(flow: EmailFlowKey): string {
  return `Send this email FROM ${EMAIL_SENDERS[flow]} (sender name "${EMAIL_SENDERS.name}"). Do not send from any other address.`;
}

export const EMAIL_BRAND = {
  // Course / brand names
  courseName: "The Power of Conscious Voice",
  courseNameFull: "The Power of Conscious Voice — Tecendo Som",
  siteUrl: "https://voice-lumina-echo.lovable.app",
  membershipUrl: "https://consciousvoice.tecendosom.com/members",
  contactEmail: "contact@tecendosom.com",

  // Colors — kept close to the site palette but email-safe
  ink: "#0F0F14",
  heroBackground: "#000000",
  inkLight: "#2A2A3C",
  cream: "#F5F3EF",
  white: "#FFFFFF",
  gold: "#C9A227",
  goldLight: "#E8D49A",
  cyan: "#4AA3B3",
  purple: "#1E1A3A",
  purpleLight: "#2E2852",
  muted: "#6B6B7B",
  faintText: "#9A9AA5",
  border: "#E5E3DF",

  // Fonts
  fontDisplay: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  fontSans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

/** Absolute URL for an asset that lives in the published public folder. */
export function emailAssetUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${EMAIL_BRAND.siteUrl}${clean}`;
}

// Cropped banner: ends just below "With Cuca Medina" — the description,
// "Limited Spots" and the contact lines that sat below it are not shown in emails.
// Served from the project CDN, so it resolves in previews and after publish.
const COURSE_IMAGE_URL =
  `https://consciousvoice.tecendosom.com${courseBannerAsset.url}`;
const FOOTER_LOGO_URL = `https://consciousvoice.tecendosom.com${footerLogoAsset.url}`;

/** Small HTML escape helper so props cannot break the template. */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Course name rendered bold and a touch larger than body copy, with the whole
 * name held on a single line so it never splits across two lines.
 */
export function buildCourseNameHtml(props?: { color?: string; size?: number }): string {
  const color = props?.color ?? EMAIL_BRAND.ink;
  const size = props?.size ?? 18;
  return `<strong class="cv-course" style="color:${color};font-size:${size}px;font-weight:700;white-space:nowrap;">${EMAIL_BRAND.courseName}</strong>`;
}

/**
 * Wraps the first occurrence of the course name inside an already-escaped
 * HTML fragment with the bold single-line treatment above.
 */
export function emphasiseCourseName(
  escapedHtml: string,
  props?: { color?: string; size?: number },
): string {
  return escapedHtml.replace(EMAIL_BRAND.courseName, buildCourseNameHtml(props));
}


/** Hero section used at the top of every member-facing email. */
export function buildEmailHero(props?: {
  headline?: string | null;
  subheadline?: string | null;
  greetingName?: string | null;
  scholarshipBanner?: boolean;
  courseBanner?: boolean;
}): string {
  const headline = escapeHtml(props?.headline ?? "Your journey begins here");
  const subheadline = props?.subheadline ? escapeHtml(props.subheadline) : "";
  const greeting = props?.greetingName ? `Hello ${escapeHtml(props.greetingName)},` : "";
  const showCourseBanner = props?.courseBanner !== false;

  return `
<!-- Hero -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${EMAIL_BRAND.heroBackground}" style="background-color:${EMAIL_BRAND.heroBackground};border-radius:0 0 24px 24px;">
  ${showCourseBanner ? `<tr>
    <td align="center" style="padding:0;">
      <img src="${COURSE_IMAGE_URL}" alt="The Power of Conscious Voice — amber profile and sound" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    </td>
  </tr>` : ""}
  ${props?.scholarshipBanner ? `<tr>
    <td align="center" style="padding:0;">
      <img src="https://consciousvoice.tecendosom.com${scholarshipBannerAsset.url}" alt="Global Solidarity Scholarships — Voice as Access. Art as Bridge." width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    </td>
  </tr>` : ""}
  <tr>
    <td align="center" style="padding:24px 24px 32px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
        <tr>
          <td align="center" style="font-family:${EMAIL_BRAND.fontDisplay};font-size:28px;line-height:1.25;color:${EMAIL_BRAND.goldLight};font-weight:600;padding-bottom:8px;">
            ${headline}
          </td>
        </tr>
        ${
          subheadline
            ? `<tr>
          <td align="center" style="font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.5;color:${EMAIL_BRAND.cream};opacity:0.9;padding-bottom:16px;">
            ${subheadline}
          </td>
        </tr>`
            : ""
        }
        ${
          greeting
            ? `<tr>
          <td align="center" style="font-family:${EMAIL_BRAND.fontSans};font-size:14px;line-height:1.5;color:${EMAIL_BRAND.cream};padding-top:8px;">
            ${greeting}
          </td>
        </tr>`
            : ""
        }
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/** Primary CTA button for emails. */
export function buildEmailButton(label: string, href: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:8px;background:linear-gradient(135deg, ${EMAIL_BRAND.gold} 0%, #B08D1E 100%);" bgcolor="${EMAIL_BRAND.gold}">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;font-family:${EMAIL_BRAND.fontSans};font-size:15px;font-weight:600;color:${EMAIL_BRAND.ink};text-decoration:none;padding:14px 28px;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>
`.trim();
}

/** Wraps a hero + body content in a full email-safe HTML document. */
export function buildEmailDocument(props: {
  previewText: string;
  hero: string;
  bodyHtml: string;
  footerHtml?: string;
}): string {
  const footer = props.footerHtml ?? buildEmailFooter();
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(props.previewText)}</title>
  <style>
    /* Very narrow screens: keep the bold course name on one line without overflow. */
    @media only screen and (max-width:359px) {
      .cv-course { font-size:15px !important; }
      .cv-body { padding:28px 18px 20px !important; }
    }
  </style>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.white};font-family:${EMAIL_BRAND.fontSans};color:${EMAIL_BRAND.ink};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(props.previewText)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.white};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:${EMAIL_BRAND.white};border-radius:24px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};">
          <tr>
            <td>
              ${props.hero}
            </td>
          </tr>
          <tr>
            <td class="cv-body" style="padding:32px 32px 24px;">
              ${props.bodyHtml}
            </td>
          </tr>
          <tr>
            <td>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Standard footer with legal identity and contact.
 *  `unsubscribeUrl` (recovery email only) adds a small opt-out line below the
 *  contact email, in a muted grey different from every other color used. */
export function buildEmailFooter(props?: { unsubscribeUrl?: string | null }): string {
  const unsubscribeLine = props?.unsubscribeUrl
    ? `<p style="margin:6px 0 0;font-family:${EMAIL_BRAND.fontSans};font-size:11px;line-height:1.5;color:${EMAIL_BRAND.faintText};">If you no longer wish to receive these reminders, <a href="${escapeHtml(props.unsubscribeUrl)}" target="_blank" style="color:${EMAIL_BRAND.faintText};text-decoration:underline;">unsubscribe here</a>.</p>`
    : "";
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.cream};border-top:1px solid ${EMAIL_BRAND.border};">
  <tr>
    <td width="104" valign="top" align="left" style="padding:24px 0 24px 24px;">
      <img src="${FOOTER_LOGO_URL}" alt="Tecendo Som" width="104" height="104" style="display:block;width:104px;height:104px;border:0;border-radius:50%;" />
    </td>
    <td style="padding:24px 24px 24px 10px;font-family:${EMAIL_BRAND.fontSans};font-size:12px;line-height:1.6;color:${EMAIL_BRAND.muted};text-align:center;">
      <p style="margin:0 0 8px;"><strong style="color:${EMAIL_BRAND.inkLight};">The Power of Conscious Voice</strong></p>
      <p style="margin:0 0 8px;">Tecendo Som — ME · CNPJ 07.331.609/0001-92</p>
      <p style="margin:0 0 8px;">Avenida Orleães, 104 — Guarujá — Porto Alegre, RS — 91770-620 — Brazil</p>
      <p style="margin:0 0 4px;">Questions? <a href="mailto:${EMAIL_BRAND.contactEmail}" style="color:${EMAIL_BRAND.cyan};text-decoration:none;">${EMAIL_BRAND.contactEmail}</a></p>
      ${unsubscribeLine}
    </td>
  </tr>
</table>
`.trim();
}

/** Convert a plain-text checklist into an HTML ordered list. */
export function buildChecklistHtml(items: string[]): string {
  const lis = items
    .map((item) => `<li style="margin-bottom:10px;line-height:1.55;">${escapeHtml(item)}</li>`)
    .join("");
  return `<ol style="margin:0 0 0 20px;padding:0;font-family:${EMAIL_BRAND.fontSans};font-size:15px;line-height:1.55;color:${EMAIL_BRAND.inkLight};">${lis}</ol>`;
}

/**
 * Simple branded email for operational reminders (class reminders, renewal
 * reminders). Paragraphs are plain text; the signoff is included in them.
 * Sent directly via Hostinger — no downstream automation.
 */
export function buildReminderEmail(props: {
  previewText: string;
  headline: string;
  paragraphs: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): { html: string; text: string } {
  const paragraphsHtml = props.paragraphs
    .map(
      (p) =>
        `<p style="font-family:${EMAIL_BRAND.fontSans};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};margin:0 0 18px;">${escapeHtml(p)}</p>`,
    )
    .join("");
  const cta =
    props.ctaLabel && props.ctaUrl ? buildEmailButton(props.ctaLabel, props.ctaUrl) : "";
  const html = buildEmailDocument({
    previewText: props.previewText,
    hero: buildEmailHero({ headline: props.headline }),
    bodyHtml: `${paragraphsHtml}${cta}`,
  });
  const text = [...props.paragraphs, ...(props.ctaUrl ? [`\n${props.ctaUrl}`] : [])].join("\n\n");
  return { html, text };
}

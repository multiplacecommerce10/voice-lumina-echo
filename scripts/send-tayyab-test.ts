import { buildConfirmationEmail, auditConfirmationEmail } from "@/lib/confirmation-email";
import { buildAccessCredentialsEmail } from "@/lib/access-credentials-email";
import { EMAIL_SENDERS, senderInstruction } from "@/lib/email-branding";
import { FICTITIOUS_MARKER } from "@/lib/fictitious";

const to = "tayabazeem786@gmail.com";
const fullName = "Tayyab Azeem";
const membershipUrl = "https://thepowerofconsciousvoice.world/";

const confirmation = buildConfirmationEmail({
  fullName,
  email: to,
  planIntended: "complete__6m",
  tier: "complete",
  durationMonths: 6,
  totalFormatted: "$1,482.00",
  amountPerCycleFormatted: "$247.00",
  isRecurring: false,
  isRenewal: false,
  billingIntervalMonths: null,
  nextChargeAtFormatted: null,
  courseStartFormatted: "Tuesday, September 1, 2026 at 7:00 PM",
  nextClassFormatted: "Tuesday, September 1, 2026 at 7:00 PM",
  membershipUrl,
});
console.log("audit issues:", JSON.stringify(auditConfirmationEmail(confirmation, to)));

const credentials = buildAccessCredentialsEmail({
  fullName,
  membershipUrl,
  tier: "complete",
});

const emailSequence = [
  {
    order: 1,
    key: "welcome_confirmation",
    subject: confirmation.subject,
    body_html: confirmation.bodyHtml,
    body_text: confirmation.bodyText,
    sender_email: EMAIL_SENDERS.payment_confirmed,
    sender_name: EMAIL_SENDERS.name,
    requires_tokens: [] as string[],
  },
  {
    order: 2,
    key: "member_credentials",
    subject: credentials.subject,
    body_html: credentials.bodyHtml,
    body_text: credentials.bodyText,
    sender_email: EMAIL_SENDERS.payment_confirmed,
    sender_name: EMAIL_SENDERS.name,
    requires_tokens: credentials.requiredTokens,
  },
];

const emailSequenceInstruction =
  "Send these emails in order, both FROM subscription@consciousvoice.tecendosom.com. Email 1 (welcome_confirmation) goes out immediately. Email 2 (member_credentials) goes out right after the member account is created, and you MUST replace {{member_username}} and {{member_password}} with the real credentials before sending. Use subject and body_html verbatim; fall back to body_text only if HTML is not supported. Never rewrite the copy.";

const eventId = `evt_test_tayyab_${Date.now()}`;

const core = {
  flow_key: "payment_confirmed",
  dedupe_key: `payment:${eventId}`,
  payment_status: "paid",
  enrollment_status: "completed",
  fulfillment_ready: true,
  lead_id: `lead_test_tayyab_${Date.now()}`,
  resume_code: null,
  email: to,
  full_name: fullName,
  email_subject: confirmation.subject,
  email_body_text: confirmation.bodyText,
  email_body_html: confirmation.bodyHtml,
  sender_email: EMAIL_SENDERS.payment_confirmed,
  sender_name: EMAIL_SENDERS.name,
  sender_instruction: senderInstruction("payment_confirmed"),
  email_sequence: emailSequence,
  email_sequence_instruction: emailSequenceInstruction,
  credentials_email_subject: credentials.subject,
  credentials_email_body_text: credentials.bodyText,
  credentials_email_body_html: credentials.bodyHtml,
  credentials_email_required_tokens: credentials.requiredTokens,
  language: "en",
  locale: "en-US",
};

const payload = {
  event: "checkout.session.completed",
  environment: "sandbox",
  ...FICTITIOUS_MARKER,
  ...core,
  plan: "complete__6m",
  tier: "complete",
  duration_months: 6,
  amount_total: 148200,
  currency: "usd",
  status: "complete",
  stripe_event_id: eventId,
  student_enrolled_at: new Date().toISOString(),
  occurred_at: new Date().toISOString(),
  form_answers: {
    full_name: fullName,
    email: to,
    phone: "+92 321 4238265",
    country: "Pakistan",
    city: "Lahore",
    profession: "Professional singer",
    experience: "More than 20 years of professional singing career",
    main_goal: "Refine and improve vocal technique",
    music_level: "Professional",
    styles: ["Hindustani classical", "Semi-classical"],
  },
  extra: {
    ...FICTITIOUS_MARKER,
    ...core,
    email_greeting_instruction:
      "Use the subject and body exactly as provided. Do not rewrite. Never wrap the first name in brackets or placeholders.",
  },
};

const res = await fetch(process.env.TASKADE_WEBHOOK_URL!, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Event": "checkout.session.completed" },
  body: JSON.stringify(payload),
});
console.log("status:", res.status, (await res.text()).slice(0, 300));
console.log("email1 subject:", confirmation.subject);
console.log("email2 subject:", credentials.subject);

// Server-only helpers for abandoned-checkout recovery.

import { buildRecoveryEmail, planLabel } from "@/lib/recovery-email";
import { EMAIL_SENDERS, senderInstruction } from "@/lib/email-branding";



export type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  plan_intended: string | null;
  status: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  landing_url: string | null;
  referrer: string | null;
  resume_code: string | null;
  recovery_attempts: number | null;
  recovery_email_sent_at: string | null;
  answers: unknown;
  source: string | null;
  stripe_session_id?: string | null;
};




/**
 * Sends the recovery email payload to the Taskade flow and stamps the lead.
 * Returns true when the webhook accepted the payload.
 */
export async function sendRecoveryEmail(lead: LeadRow, reason: string): Promise<boolean> {
  if (!lead.email) return false;

  const { forwardToTaskade } = await import("@/lib/taskade.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const attempt = (lead.recovery_attempts ?? 0) + 1;
  const answers =
    lead.answers && typeof lead.answers === "object" && !Array.isArray(lead.answers)
      ? (lead.answers as Record<string, unknown>)
      : {};

  // Make sure the lead owns a resume code before the email goes out.
  let resumeCode = lead.resume_code ?? null;
  if (!resumeCode) {
    const { newResumeCode } = await import("@/lib/resume-code.server");
    resumeCode = newResumeCode();
    await supabaseAdmin.from("leads").update({ resume_code: resumeCode }).eq("id", lead.id);
  }

  const draft = buildRecoveryEmail({
    leadId: lead.id,
    fullName: lead.full_name,
    planIntended: lead.plan_intended,
    resumeCode,
  });

  // Hard gate: never send a draft that fails error-level checks (e.g. invalid email).
  const { auditRecoveryEmail } = await import("@/lib/recovery-email");
  const blockingIssues = auditRecoveryEmail(draft, lead.email).filter((i) => i.level === "error");
  if (blockingIssues.length > 0) {
    console.error(
      "[lead-recovery] send blocked",
      JSON.stringify({ lead_id: lead.id, issues: blockingIssues.map((i) => i.message) }),
    );
    return false;
  }

  const {
    resumeUrl,
    fullName,
    firstName,
    greetingName,
    courseName,
    subject: emailSubject,
    bodyText: emailBodyText,
    bodyHtml: emailBodyHtml,
  } = draft;


  const payload = {
    event: "checkout.abandoned" as const,
    // Top-level status fields the Taskade flow branches on:
    // payment_status = "unpaid" → send payment guidance.
    payment_status: "unpaid" as const,
    enrollment_status: "incomplete" as const,
    // Which Taskade automation owns this payload, plus a stable idempotency
    // key so a replay of the same recovery attempt is ignored downstream.
    flow_key: "cart_recovery" as const,
    dedupe_key: `recovery:${lead.id}:${attempt}`,
    course_name: courseName,
    email_subject: emailSubject,
    email_body_text: emailBodyText,
    email_body_html: emailBodyHtml,
    sender_email: EMAIL_SENDERS.cart_recovery,
    sender_name: EMAIL_SENDERS.name,
    sender_instruction: senderInstruction("cart_recovery"),
    full_name: fullName,
    first_name: firstName,
    greeting_name: greetingName,
    email: lead.email,
    lead_id: lead.id,
    resume_code: resumeCode,
    phone: lead.phone ?? "",
    plan: lead.plan_intended ?? null,

    attribution_summary: null,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_term: lead.utm_term,
    utm_content: lead.utm_content,
    gclid: lead.gclid,
    fbclid: lead.fbclid,
    landing_url: lead.landing_url,
    referrer: lead.referrer,
    extra: {
      flow_key: "cart_recovery",
      dedupe_key: `recovery:${lead.id}:${attempt}`,
      payment_status: "unpaid",
      enrollment_status: "incomplete",
      email: lead.email,
      full_name: fullName,
      lead_id: lead.id,
      plan_label: planLabel(lead.plan_intended),
      abandon_reason: reason,
      recovery_attempt: attempt,
      resume_code: resumeCode,
      resume_url: resumeUrl,
      cta_label: "Complete my enrollment",
      email_kind: "abandoned_checkout_recovery",
      first_name: firstName,
      greeting_name: greetingName,
      greeting_line: `Hello ${greetingName},`,
      course_name: courseName,
      email_subject: emailSubject,
      email_body_text: emailBodyText,
      email_body_html: emailBodyHtml,
      sender_email: EMAIL_SENDERS.cart_recovery,
      sender_name: EMAIL_SENDERS.name,
      sender_instruction: senderInstruction("cart_recovery"),
      email_greeting_instruction:
        "Send the email using the HTML version in email_body_html. If the email provider cannot send HTML, fall back to the plain text in email_body_text. Use the subject exactly as email_subject. Do not rewrite, do not invent a course name, and never wrap the first name in parentheses, brackets or placeholder markers. The course is always called 'The Power of Conscious Voice — Tecendo Som'.",
      // All student-facing communication must be written in English.
      language: "en",
      language_name: "English",
      locale: "en-US",
      email_language_instruction:
        "Write this email entirely in English (US). Do not use Portuguese.",
      source: lead.source ?? null,
      // Full enrollment-form answers (goal, voice_type, experience_level, city, country, etc.)
      ...(answers as Record<string, unknown>),
      answers,
    },
  };


  const { isFictitiousLead, markFictitious } = await import("@/lib/fictitious");
  const finalPayload = isFictitiousLead(lead) ? markFictitious(payload) : payload;
  const result = await forwardToTaskade(finalPayload, { flow: "recovery" });
  const ok = result.ok === true;
  console.log(
    "[lead-recovery] webhook result",
    JSON.stringify({ lead_id: lead.id, attempt, ok, result }),
  );

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("leads")
      .update({
        recovery_attempts: attempt,
        ...(ok ? { recovery_email_sent_at: new Date().toISOString() } : {}),
      })
      .eq("id", lead.id);
  } catch (e) {
    console.error("[sendRecoveryEmail] stamp failed:", e);
  }

  return Boolean(ok);
}

export const LEAD_SELECT =
  "id, full_name, email, phone, plan_intended, status, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, landing_url, referrer, resume_code, recovery_attempts, recovery_email_sent_at, answers, source, stripe_session_id";

export const ABANDON_GRACE_MINUTES = 30;

/**
 * Flags every lead that reached checkout more than 30 minutes ago without
 * paying and fires the abandoned-checkout webhook once per lead.
 */
export async function runAbandonedSweep(): Promise<{
  processed: number;
  recoveryEmailsSent: number;
  error?: string;
  leads: { id: string; email: string | null; sent: boolean }[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const cutoff = new Date(Date.now() - ABANDON_GRACE_MINUTES * 60 * 1000).toISOString();
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(LEAD_SELECT)
    .in("status", ["checkout_started", "captured"])
    .is("recovery_email_sent_at", null)
    .not("checkout_started_at", "is", null)
    .lt("checkout_started_at", cutoff)
    .limit(25);

  if (error) {
    return { processed: 0, recoveryEmailsSent: 0, error: error.message, leads: [] };
  }

  const results: { id: string; email: string | null; sent: boolean }[] = [];
  let sent = 0;
  for (const lead of (leads ?? []) as LeadRow[]) {
    // Never chase someone who actually paid.
    if (await isLeadAlreadyPaid(lead)) {
      results.push({ id: lead.id, email: lead.email, sent: false });
      continue;
    }
    await supabaseAdmin
      .from("leads")
      .update({
        status: "abandoned",
        abandoned_at: new Date().toISOString(),
        abandon_reason: "timeout_no_payment",
      })
      .eq("id", lead.id);
    const ok = await sendRecoveryEmail(lead, "timeout_no_payment");
    if (ok) sent += 1;
    results.push({ id: lead.id, email: lead.email, sent: ok });
  }

  return { processed: leads?.length ?? 0, recoveryEmailsSent: sent, leads: results };
}

/** Statuses that mean the person already completed (or is completing) payment. */
export const NON_RECOVERABLE_LEAD_STATUSES = ["paid", "checkout_completed"];

/**
 * Last-resort safety check before any recovery email: asks Stripe whether the
 * lead's checkout session was actually paid. Protects against the case where
 * the success redirect fires `pagehide` before the webhook lands.
 */
export async function isLeadAlreadyPaid(lead: {
  id: string;
  status?: string | null;
  stripe_session_id?: string | null;
}): Promise<boolean> {
  if (lead.status && NON_RECOVERABLE_LEAD_STATUSES.includes(lead.status)) return true;
  const sessionId = lead.stripe_session_id;
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return false;
  try {
    const { createStripeClient } = await import("@/lib/stripe.server");
    const env = sessionId.startsWith("cs_live_") ? "live" : "sandbox";
    const session = await createStripeClient(env).checkout.sessions.retrieve(sessionId);
    const paid =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (paid) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("leads").update({ status: "paid" }).eq("id", lead.id);
    }
    return paid;
  } catch (e) {
    console.warn("[lead-recovery] paid check failed", e);
    return false;
  }
}

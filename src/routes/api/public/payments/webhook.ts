import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  classifyPaymentLifecycle,
  buildLifecycleContractFields,
  buildLifecycleExtraFields,
} from "@/lib/payment-lifecycle";
import { resolveEntitlements, type Tier } from "@/lib/entitlements";
import { EMAIL_SENDERS, senderInstruction } from "@/lib/email-branding";
import { subscriptionContractFields } from "@/lib/subscription-state.server";
import { GRACE_PERIOD_DAYS } from "@/lib/subscription-catalog";
import { isMakeForwardingEnabled, MAKE_DISABLED_RESULT } from "@/lib/make-flag";

import {
  COURSE_START_UTC,
  formatClassInTimeZone,
  getNextClassAfter,
} from "@/lib/course-schedule";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

const RELEVANT_EVENT_PREFIXES = [
  "checkout.session.",
  "payment_intent.",
  "customer.subscription.",
  "invoice.",
  "charge.",
  "credit_note.",
];

const FORWARDED_EVENTS = new Set([
  "checkout.session.completed",
  // Delayed-notification methods (SEPA, Bacs, boleto, OXXO) settle later.
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  // Recurring subscription lifecycle. `invoice.paid` is the CANONICAL event
  // that creates or renews paid access.
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  // Refunds never auto-revoke access — they open a human review.
  "charge.refunded",
  "credit_note.created",
]);


function extractFromObject(obj: any) {
  const metadata: Record<string, string> = obj?.metadata ?? {};
  const utms: Record<string, string> = {};
  for (const k of UTM_KEYS) if (metadata[k]) utms[k] = metadata[k];

  return {
    object_id: obj?.id ?? null,
    checkout_session_id: obj?.object === "checkout.session" ? obj?.id : null,
    payment_intent_id:
      obj?.object === "payment_intent"
        ? obj?.id
        : obj?.payment_intent ?? null,
    customer_email:
      obj?.customer_details?.email ??
      obj?.customer_email ??
      obj?.receipt_email ??
      null,
    amount_total: obj?.amount_total ?? obj?.amount ?? null,
    currency: obj?.currency ?? null,
    status: obj?.status ?? null,
    client_reference_id: obj?.client_reference_id ?? null,
    utms,
    metadata,
    landing_url: metadata.landing_url ?? null,
    referrer: metadata.referrer ?? null,
    attribution_summary: metadata.attribution_summary ?? null,
  };
}

async function logEvent(event: any, env: StripeEnv) {
  const obj = event?.data?.object ?? {};
  const fields = extractFromObject(obj);

  // Lazy import to keep service-role client out of the client bundle.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const row = {
    stripe_event_id: event.id,
    event_type: event.type,
    environment: env,
    object_id: fields.object_id,
    checkout_session_id: fields.checkout_session_id,
    payment_intent_id: fields.payment_intent_id,
    customer_email: fields.customer_email,
    amount_total: fields.amount_total,
    currency: fields.currency,
    status: fields.status,
    client_reference_id: fields.client_reference_id,
    utm_source: fields.utms.utm_source ?? null,
    utm_medium: fields.utms.utm_medium ?? null,
    utm_campaign: fields.utms.utm_campaign ?? null,
    utm_term: fields.utms.utm_term ?? null,
    utm_content: fields.utms.utm_content ?? null,
    gclid: fields.utms.gclid ?? null,
    fbclid: fields.utms.fbclid ?? null,
    landing_url: fields.landing_url,
    referrer: fields.referrer,
    attribution_summary: fields.attribution_summary,
    metadata: fields.metadata ?? {},
    raw_event: event,
  };

  // Structured console log for quick auditing in worker logs.
  console.log("[stripe-webhook]", JSON.stringify({
    env,
    type: event.type,
    event_id: event.id,
    object_id: fields.object_id,
    checkout_session_id: fields.checkout_session_id,
    payment_intent_id: fields.payment_intent_id,
    amount_total: fields.amount_total,
    currency: fields.currency,
    status: fields.status,
    customer_email: fields.customer_email,
    client_reference_id: fields.client_reference_id,
    attribution_summary: fields.attribution_summary,
    utms: fields.utms,
    landing_url: fields.landing_url,
    referrer: fields.referrer,
  }));

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .upsert(row, { onConflict: "stripe_event_id" });

  if (error) {
    console.error("[stripe-webhook] insert failed:", error.message);
    throw error;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const { recordWebhookAudit } = await import("@/lib/webhook-audit.server");
        const auditInbound = (fields: {
          ok: boolean;
          status: number;
          event?: string | null;
          payload?: unknown;
          error?: string | null;
        }) =>
          recordWebhookAudit({
            direction: "inbound",
            flow: "stripe",
            event: fields.event ?? null,
            targetUrl: "/api/public/payments/webhook",
            correlationId: null,
            requestPayload: fields.payload ?? null,
            responseStatus: fields.status,
            durationMs: Date.now() - startedAt,
            attempts: 1,
            ok: fields.ok,
            errorReason: fields.error ?? null,
          });

        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[stripe-webhook] invalid env query param:", rawEnv);
          await auditInbound({ ok: false, status: 200, error: `invalid env: ${rawEnv}` });
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;

        let event: any;
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("[stripe-webhook] signature verification failed:", e);
          await auditInbound({ ok: false, status: 400, error: "signature verification failed" });
          return new Response("Invalid signature", { status: 400 });
        }


        try {
          const isRelevant = RELEVANT_EVENT_PREFIXES.some((p) =>
            event.type?.startsWith(p),
          );
          if (isRelevant) {
            await logEvent(event, env);
          } else {
            console.log("[stripe-webhook] ignored type:", event.type);
          }

          // Forward selected events to Make for downstream automations.
          if (FORWARDED_EVENTS.has(event.type)) {
            const obj = event?.data?.object ?? {};
            const f = extractFromObject(obj);
            const metaLeadId = (f.metadata?.lead_id as string | undefined) ?? null;

            // CORE lifecycle persistence. Deliberately OUTSIDE the
            // notification try/catch: if this throws, the handler must
            // return 500 so Stripe retries the event. This is what decides
            // whether an invoice is an initial payment, a renewal, a
            // grace-period failure or a suspension.
            const { processSubscriptionEvent } = await import(
              "@/lib/subscription-webhook.server"
            );
            const subEvent = await processSubscriptionEvent({
              event,
              env,
              leadId: metaLeadId,
              email: f.customer_email,
              fullName: null,
            });
            const leadId = metaLeadId ?? subEvent.row?.lead_id ?? null;

            // Only optional downstream forwarding (Make/Taskade) is isolated.
            try {


              // Idempotency: Stripe retries deliver the same invoice twice.
              // The state machine already recorded it — do not notify again.
              if (subEvent.duplicate) {
                console.log(
                  "[stripe-webhook] duplicate invoice event ignored:",
                  event.type,
                  event.id,
                );
                await auditInbound({
                  ok: true,
                  status: 200,
                  event: event.type,
                  payload: { id: event.id, type: event.type, duplicate: true },
                });
                return Response.json({ received: true, duplicate: true });
              }

              // Decide ONCE whether this event may trigger paid enrollment.
              const lifecycle = classifyPaymentLifecycle(event.type, obj, subEvent.ctx);
              console.log(
                "[stripe-webhook] lifecycle",
                JSON.stringify({
                  type: event.type,
                  fulfillment_ready: lifecycle.fulfillment_ready,
                  payment_lifecycle_status: lifecycle.payment_lifecycle_status,
                  stripe_payment_status: lifecycle.stripe_payment_status,
                  access_status: subEvent.row?.access_status ?? null,
                  reason: lifecycle.reason,
                }),
              );

              // Enrich with lead data (name/phone/plan) when we have a lead_id.
              let leadFullName: string | null = null;
              let leadPhone: string | null = null;
              let leadPlan: string | null = null;
              let leadEmail: string | null = null;
              let leadTimezone: string | null = null;
              let leadResumeCode: string | null = null;
              if (leadId) {
                try {
                  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                  const { data: lead } = await supabaseAdmin
                    .from("leads")
                    .select("full_name, phone, plan_intended, email, answers, resume_code")
                    .eq("id", leadId)
                    .maybeSingle();
                  if (lead) {
                    leadFullName = (lead.full_name as string) ?? null;
                    leadPhone = (lead.phone as string) ?? null;
                    leadPlan = (lead.plan_intended as string) ?? null;
                    leadEmail = (lead.email as string) ?? null;
                    leadResumeCode = (lead.resume_code as string) ?? null;
                    leadTimezone =
                      ((lead.answers as { timezone?: string } | null)?.timezone as string) ?? null;
                  }
                } catch (e) {
                  console.warn("[stripe-webhook] lead lookup failed:", e);
                }

                // Stop the abandoned-checkout recovery flow for this person.
                // "paid" once payment is confirmed; "checkout_completed" while a
                // completed session still waits for the paid invoice.
                const paidNow =
                  lifecycle.fulfillment_ready ||
                  lifecycle.stripe_payment_status === "paid" ||
                  lifecycle.stripe_payment_status === "no_payment_required";
                const leadStatus = paidNow
                  ? "paid"
                  : lifecycle.payment_lifecycle_status === "awaiting_invoice_paid"
                    ? "checkout_completed"
                    : null;
                if (leadStatus) {
                  try {
                    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                    await supabaseAdmin
                      .from("leads")
                      .update({ status: leadStatus })
                      .eq("id", leadId)
                      .neq("status", "paid");
                  } catch (e) {
                    console.warn("[stripe-webhook] lead status update failed:", e);
                  }
                }
              }



              // Backfill identity onto the subscription record.
              if (subEvent.row && (leadId || leadFullName || leadEmail)) {
                try {
                  const { associateCheckout } = await import("@/lib/subscription-state.server");
                  await associateCheckout({
                    env,
                    subscriptionId: subEvent.row.stripe_subscription_id,
                    customerId: subEvent.row.stripe_customer_id,
                    leadId,
                    email: f.customer_email ?? leadEmail,
                    fullName: leadFullName,
                  });
                } catch (e) {
                  console.warn("[stripe-webhook] identity backfill failed:", e);
                }
              }

              // Billing/subscription details (monthly cycle + next charge)
              // so Taskade's welcome email can restate them to the student.
              let billing: Awaited<
                ReturnType<typeof import("@/lib/billing-summary.server").buildBillingSummary>
              > = null;
              try {
                const obj2 = obj as { id?: string; subscription?: unknown };
                const sessionId =
                  f.checkout_session_id ??
                  (typeof obj2.id === "string" && obj2.id.startsWith("cs_") ? obj2.id : null);
                const subscriptionId =
                  typeof obj2.subscription === "string"
                    ? obj2.subscription
                    : typeof (obj as { id?: string }).id === "string" &&
                        String((obj as { id?: string }).id).startsWith("sub_")
                      ? String((obj as { id?: string }).id)
                      : null;
                if (sessionId || subscriptionId) {
                  const { buildBillingSummary } = await import("@/lib/billing-summary.server");
                  const origin = new URL(request.url).origin;
                  billing = await buildBillingSummary({
                    environment: env,
                    checkoutSessionId: sessionId,
                    subscriptionId,
                    siteUrl: origin.includes("localhost") ? null : origin,
                  });
                }
                // Only legacy recurring subscriptions get a subscription_billing
                // row (renewal reminders), and only once the payment settled.
                // One-time prepaid purchases have no renewal, so we
                // deliberately create nothing here.
                if (billing?.is_subscription && lifecycle.fulfillment_ready) {
                  const { upsertSubscriptionBilling } = await import(
                    "@/lib/billing-reminders.server"
                  );
                  await upsertSubscriptionBilling({
                    billing,
                    environment: env,
                    leadId,
                    email: f.customer_email ?? leadEmail,
                    fullName: leadFullName,
                    checkoutSessionId: sessionId,
                  });
                }
              } catch (e) {
                console.warn("[stripe-webhook] billing summary failed:", e);
              }

              // Entitlements are member access. They are attached ONLY when the
              // payment is actually confirmed (fulfillment_ready), so an
              // unpaid/pending/failed/expired event can never grant access.
              const resolvedTier: Tier | null =
                (subEvent.row?.tier as Tier | null) ??
                (f.metadata?.tier as Tier | undefined) ??
                (billing?.tier === "live" || billing?.tier === "complete" ? billing.tier : null);
              // Enrollment date is written once by the first paid invoice and
              // is NEVER moved by a renewal.
              const studentEnrolledAt = lifecycle.fulfillment_ready
                ? (subEvent.row?.student_enrolled_at ??
                   billing?.started_at ??
                   new Date().toISOString())
                : null;
              const entitlements =
                lifecycle.fulfillment_ready && resolvedTier
                  ? resolveEntitlements(resolvedTier, studentEnrolledAt)
                  : null;

              const studentTz = leadTimezone || "UTC";
              const courseStartUtc = formatClassInTimeZone(COURSE_START_UTC, "UTC");
              const courseStartLocal = formatClassInTimeZone(COURSE_START_UTC, studentTz);
              const nextClass = getNextClassAfter(new Date());
              const nextClassLocal = formatClassInTimeZone(nextClass, studentTz);

              // Build the confirmation/receipt email only when payment is
              // actually settled. Taskade must use email_subject and
              // email_body_text verbatim instead of rewriting with its own
              // template.
              let confirmationEmail: Awaited<
                ReturnType<typeof import("@/lib/confirmation-email").buildConfirmationEmail>
              > | null = null;
              if (lifecycle.fulfillment_ready) {
                const {
                  buildConfirmationEmail,
                  auditConfirmationEmail,
                } = await import("@/lib/confirmation-email");
                const draftInput = {
                  fullName: leadFullName,
                  email: f.customer_email ?? leadEmail,
                  planIntended: leadPlan,
                  tier: resolvedTier,
                  durationMonths:
                    billing?.duration_months ?? subEvent.row?.duration_months ?? null,
                  totalFormatted: billing?.total_commitment_formatted ?? null,
                  amountPerCycleFormatted: billing?.amount_per_cycle_formatted ?? null,
                  isRecurring: billing?.is_subscription ?? (subEvent.row ? true : false),
                  isRenewal: lifecycle.payment_lifecycle_status === "paid_renewal",
                  billingIntervalMonths:
                    billing?.is_subscription && billing?.duration_months
                      ? billing.duration_months
                      : null,
                  nextChargeAtFormatted: billing?.next_charge_at_formatted ?? null,
                  courseStartFormatted: courseStartLocal.full,
                  nextClassFormatted: nextClassLocal.full,
                  membershipUrl: billing?.membership_url ?? null,
                };
                const draft = buildConfirmationEmail(draftInput);
                const issues = auditConfirmationEmail(draft, f.customer_email ?? leadEmail);
                if (issues.some((i) => i.level === "error")) {
                  console.error(
                    "[stripe-webhook] confirmation email audit failed",
                    JSON.stringify({ issues, draft }),
                  );
                } else {
                  confirmationEmail = draft;
                }
              }

              // Second enrollment email: member-area credentials. Only for a
              // first paid enrollment (never on a renewal) and only when the
              // payment is actually settled.
              let credentialsEmail: Awaited<
                ReturnType<
                  typeof import("@/lib/access-credentials-email").buildAccessCredentialsEmail
                >
              > | null = null;
              if (
                lifecycle.fulfillment_ready &&
                lifecycle.payment_lifecycle_status !== "paid_renewal"
              ) {
                const { buildAccessCredentialsEmail } = await import(
                  "@/lib/access-credentials-email"
                );
                credentialsEmail = buildAccessCredentialsEmail({
                  fullName: leadFullName,
                  membershipUrl: billing?.membership_url ?? null,
                  tier: resolvedTier,
                });
              }

              // Ordered email sequence the enrollment automation must send,
              // both from subscription@consciousvoice.tecendosom.com.
              const emailSequence = [
                ...(confirmationEmail
                  ? [
                      {
                        order: 1,
                        key: "welcome_confirmation",
                        subject: confirmationEmail.subject,
                        body_html: confirmationEmail.bodyHtml,
                        body_text: confirmationEmail.bodyText,
                        sender_email: EMAIL_SENDERS.payment_confirmed,
                        sender_name: EMAIL_SENDERS.name,
                        requires_tokens: [] as string[],
                      },
                    ]
                  : []),
                ...(credentialsEmail
                  ? [
                      {
                        order: 2,
                        key: "member_credentials",
                        subject: credentialsEmail.subject,
                        body_html: credentialsEmail.bodyHtml,
                        body_text: credentialsEmail.bodyText,
                        sender_email: EMAIL_SENDERS.payment_confirmed,
                        sender_name: EMAIL_SENDERS.name,
                        requires_tokens: credentialsEmail.requiredTokens,
                      },
                    ]
                  : []),
              ];
              const emailSequenceInstruction =
                "Send these emails in order, both FROM subscription@consciousvoice.tecendosom.com. Email 1 (welcome_confirmation) goes out immediately. Email 2 (member_credentials) goes out right after the member account is created, and you MUST replace {{member_username}} and {{member_password}} with the real credentials before sending. Use subject and body_html verbatim; fall back to body_text only if HTML is not supported. Never rewrite the copy.";



              const forwardPayload = {
                event: event.type,
                environment: env,
                // === Fulfillment gate — automations MUST branch on these ===
                // Send welcome / access credentials ONLY when
                // fulfillment_ready === true. Field names are contract-tested
                // (src/lib/webhook-contract.ts) — do not rename or inline.
                ...buildLifecycleContractFields(lifecycle),
                // Top-level status fields the Taskade flow branches on:
                // payment_status = "unpaid" → payment guidance;
                // enrollment_status = "completed" → enrollment confirmation.
                payment_status: lifecycle.fulfillment_ready ? "paid" : "unpaid",
                enrollment_status: lifecycle.fulfillment_ready ? "completed" : "incomplete",
                // Which Taskade automation owns this payload, plus a stable
                // idempotency key so a Stripe retry cannot send twice.
                flow_key: "payment_confirmed" as const,
                dedupe_key: `payment:${event.id}`,
                email_subject: confirmationEmail?.subject ?? null,
                email_body_text: confirmationEmail?.bodyText ?? null,
                email_body_html: confirmationEmail?.bodyHtml ?? null,
                sender_email: EMAIL_SENDERS.payment_confirmed,
                sender_name: EMAIL_SENDERS.name,
                sender_instruction: senderInstruction("payment_confirmed"),
                email_sequence: emailSequence,
                email_sequence_instruction: emailSequenceInstruction,
                credentials_email_subject: credentialsEmail?.subject ?? null,
                credentials_email_body_text: credentialsEmail?.bodyText ?? null,
                credentials_email_body_html: credentialsEmail?.bodyHtml ?? null,
                credentials_email_required_tokens: credentialsEmail?.requiredTokens ?? null,
                lead_id: leadId,
                resume_code: leadResumeCode,


                email: f.customer_email ?? leadEmail,
                phone: leadPhone,
                full_name: leadFullName,
                plan: leadPlan,
                amount_total: f.amount_total,
                currency: f.currency,
                status: f.status,
                stripe_session_id: f.checkout_session_id,
                stripe_payment_intent_id: f.payment_intent_id,
                stripe_event_id: event.id,
                client_reference_id: f.client_reference_id,
                attribution_summary: f.attribution_summary,
                utm_source: f.utms.utm_source ?? null,
                utm_medium: f.utms.utm_medium ?? null,
                utm_campaign: f.utms.utm_campaign ?? null,
                utm_term: f.utms.utm_term ?? null,
                utm_content: f.utms.utm_content ?? null,
                gclid: f.utms.gclid ?? null,
                fbclid: f.utms.fbclid ?? null,
                landing_url: f.landing_url,
                referrer: f.referrer,
                extra: {
                  // Mirrored fulfillment gate so scenarios reading only `extra`
                  // still cannot confuse pending/failed/expired with paid.
                  ...buildLifecycleExtraFields(lifecycle),
                  // Mirrored identity/routing fields: Taskade reads these paths
                  // inside trigger.body.extra in both flows.
                  flow_key: "payment_confirmed",
                  dedupe_key: `payment:${event.id}`,
                  lead_id: leadId,
                  resume_code: leadResumeCode,
                  email: f.customer_email ?? leadEmail,
                  full_name: leadFullName,
                  payment_status: lifecycle.fulfillment_ready ? "paid" : "unpaid",
                  enrollment_status: lifecycle.fulfillment_ready ? "completed" : "incomplete",

                  // All student-facing communication must be written in English.
                  language: "en",
                  language_name: "English",
                  locale: "en-US",
                  email_language_instruction:
                    "Write this email entirely in English (US). Do not use Portuguese.",
                  // Confirmation/receipt email content (built by the application,
                  // must be sent verbatim by Taskade — never rewritten).
                  email_subject: confirmationEmail?.subject ?? null,
                  email_body_text: confirmationEmail?.bodyText ?? null,
                  email_body_html: confirmationEmail?.bodyHtml ?? null,
                  sender_email: EMAIL_SENDERS.payment_confirmed,
                  sender_name: EMAIL_SENDERS.name,
                  sender_instruction: senderInstruction("payment_confirmed"),
                  email_sequence: emailSequence,
                  email_sequence_instruction: emailSequenceInstruction,
                  credentials_email_subject: credentialsEmail?.subject ?? null,
                  credentials_email_body_text: credentialsEmail?.bodyText ?? null,
                  credentials_email_body_html: credentialsEmail?.bodyHtml ?? null,
                  credentials_email_required_tokens: credentialsEmail?.requiredTokens ?? null,
                  email_greeting_instruction:
                    "Send the email using the HTML version in email_body_html. If the email provider cannot send HTML, fall back to the plain text in email_body_text. Use the subject exactly as email_subject. Do not rewrite, do not invent a course name, and never wrap the first name in parentheses, brackets or placeholder markers. The course is always called 'The Power of Conscious Voice — Tecendo Som'.",
                  confirmation_plan_text: confirmationEmail?.planText ?? null,
                  confirmation_total_text: confirmationEmail?.totalText ?? null,
                  confirmation_checklist: confirmationEmail?.checklist ?? null,

                  // Purchase details. Current product model = ONE-TIME PREPAID:
                  // a single payment covering the whole access period, with no
                  // renewal and no next charge. `billing_is_subscription` is
                  // true only for legacy historical recurring records.
                  purchase_type: subEvent.row
                    ? "recurring_subscription"
                    : billing?.is_subscription
                      ? "subscription_legacy"
                      : "one_time_prepaid",
                  auto_renew: subEvent.row ? true : (billing?.is_subscription ?? false),
                  is_one_time_prepaid: subEvent.row
                    ? false
                    : billing
                      ? !billing.is_subscription
                      : null,
                  // === Recurring subscription contract (additive) ===
                  ...subscriptionContractFields(subEvent.row),
                  grace_period_days: GRACE_PERIOD_DAYS,
                  billing_is_subscription: billing?.is_subscription ?? null,
                  billing_plan_name: billing?.plan_name ?? null,
                  billing_tier: billing?.tier ?? null,
                  billing_interval: billing?.interval ?? null,
                  // Length of prepaid access (months) for one-time purchases.
                  billing_duration_months: billing?.duration_months ?? null,
                  access_months: billing?.is_subscription ? null : (billing?.duration_months ?? null),
                  // For one-time purchases both fields carry the single total paid.
                  billing_amount_per_cycle: billing?.amount_per_cycle ?? null,
                  billing_amount_per_cycle_formatted: billing?.amount_per_cycle_formatted ?? null,
                  billing_total_commitment: billing?.total_commitment ?? null,
                  billing_total_commitment_formatted: billing?.total_commitment_formatted ?? null,
                  total_paid_formatted: billing?.is_subscription
                    ? null
                    : (billing?.total_commitment_formatted ?? null),
                  billing_currency: billing?.currency ?? null,
                  billing_subscription_status: billing?.subscription_status ?? null,
                  // Access start (Checkout Session creation for one-time buys).
                  billing_started_at: billing?.started_at ?? null,
                  billing_started_at_formatted: billing?.started_at_formatted ?? null,
                  access_started_at_formatted: billing?.is_subscription
                    ? null
                    : (billing?.started_at_formatted ?? null),
                  // Always null for one-time prepaid purchases — never write
                  // "next charge" copy for them.
                  billing_next_charge_at: billing?.next_charge_at ?? null,
                  billing_next_charge_at_formatted: billing?.next_charge_at_formatted ?? null,
                  billing_days_until_next_charge: billing?.days_until_next_charge ?? null,
                  billing_cancel_at_period_end: billing?.cancel_at_period_end ?? null,
                  billing_card_last4: billing?.card_last4 ?? null,
                  // For one-time buys this lists the ACCESS months, not charges.
                  billing_schedule: billing?.billing_schedule ?? [],
                  billing_schedule_is_access_only: billing ? !billing.is_subscription : null,
                  billing_summary_text: billing?.billing_summary_text ?? null,
                  // === Member entitlements (present only when paid) ===
                  // null until fulfillment_ready === true. Automations must not
                  // grant portal/replay access on a null entitlements object.
                  entitlements,
                  student_enrolled_at: studentEnrolledAt,
                  replay_access_from: entitlements?.replay_access_from ?? null,
                  membership_url: billing?.membership_url ?? null,
                  // Course schedule — start date + next class in the student's timezone.
                  student_timezone: studentTz,
                  student_timezone_name: courseStartLocal.timeZoneName,
                  course_start_at: COURSE_START_UTC.toISOString(),
                  course_start_utc_formatted: courseStartUtc.full,
                  course_start_local_formatted: courseStartLocal.full,
                  course_start_summary_text: `Your course starts on ${courseStartLocal.full} (your local time) — ${courseStartUtc.full}.`,
                  class_cadence: "Weekly live 90-minute classes, every Tuesday",
                  next_class_at: nextClass.toISOString(),
                  next_class_local_formatted: nextClassLocal.full,
                },
              };

              // Taskade is the active downstream automation. Make stays
              // opt-in behind MAKE_FORWARDING_ENABLED="true" — when the flag
              // is unset/false we never even import the forwarder.
              const { forwardToTaskade } = await import("@/lib/taskade.server");
              const makeEnabled = isMakeForwardingEnabled();
              const jobs: Promise<unknown>[] = [forwardToTaskade(forwardPayload)];
              if (makeEnabled) {
                const { forwardToMake } = await import("@/lib/make.server");
                jobs.push(forwardToMake(forwardPayload));
              } else {
                console.log(
                  "[stripe-webhook] downstream forwarding:",
                  JSON.stringify(MAKE_DISABLED_RESULT),
                );
              }
              await Promise.allSettled(jobs);
            } catch (e) {
              console.error("[stripe-webhook] downstream forward failed:", e);
            }

          }
          await auditInbound({
            ok: true,
            status: 200,
            event: event?.type ?? null,
            payload: { id: event?.id, type: event?.type, object: event?.data?.object ?? null },
          });
          return Response.json({ received: true });
        } catch (e) {
          console.error("[stripe-webhook] handler error:", e);
          // Core processing of a signature-verified event failed (e.g. the
          // event row could not be persisted). Answer 500 so Stripe retries
          // instead of silently dropping a paid purchase. Optional Make /
          // Taskade forwarding failures are caught above and stay isolated.
          await auditInbound({
            ok: false,
            status: 500,
            event: event?.type ?? null,
            payload: { id: event?.id, type: event?.type },
            error: String(e),
          });
          return new Response("Webhook processing error", { status: 500 });
        }

      },
    },
  },
});

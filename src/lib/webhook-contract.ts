/**
 * Outbound webhook payload CONTRACT (Make / Taskade).
 *
 * These are the exact field names and value domains the automation scenarios
 * branch on. Renaming or dropping any of them silently breaks enrollment
 * emails, so the contract is asserted by
 * `scripts/webhook-contract-test.ts`.
 */

import type { PaymentLifecycleStatus, EmailKind } from "./payment-lifecycle";

/** Fields Make/Taskade read at the top level of the payload. */
export const REQUIRED_TOP_LEVEL_FIELDS = [
  "event",
  "environment",
  "fulfillment_ready",
  "payment_lifecycle_status",
  "is_pending_delayed_payment",
  "stripe_payment_status",
  "payment_lifecycle_reason",
  "lead_id",
  "email",
  "full_name",
  "plan",
  "amount_total",
  "currency",
  "stripe_session_id",
  "stripe_event_id",
  "extra",
] as const;

/** Fields Make/Taskade read inside `extra`. */
export const REQUIRED_EXTRA_FIELDS = [
  "fulfillment_ready",
  "payment_lifecycle_status",
  "is_pending_delayed_payment",
  "email_kind",
  "fulfillment_instruction",
] as const;

export const ALLOWED_LIFECYCLE_STATUSES: readonly PaymentLifecycleStatus[] = [
  "paid",
  "paid_renewal",
  "past_due_grace",
  "access_suspended",
  "cancellation_scheduled",
  "refund_review",
  "pending_payment",
  "awaiting_invoice_paid",
  "failed",
  "expired",
  "subscription_lifecycle",
  "unknown",
];

export const ALLOWED_EMAIL_KINDS: readonly EmailKind[] = [
  "welcome_access",
  "renewal_confirmation",
  "payment_pending_notice",
  "payment_failed_recovery",
  "payment_recovery_grace",
  "access_suspended_notice",
  "cancellation_scheduled_notice",
  "refund_review_notice",
  "checkout_expired_recovery",
  "no_email",
];

/**
 * Additive subscription fields. They are always present on the payload (null
 * when the purchase is not a recurring subscription), so existing scenarios
 * keep working while new ones can branch on renewal/grace/cancellation state.
 */
export const REQUIRED_SUBSCRIPTION_EXTRA_FIELDS = [
  "is_recurring_subscription",
  "subscription_status",
  "billing_interval_months",
  "current_period_start",
  "current_period_end",
  "cancel_at_period_end",
  "grace_expires_at",
  "access_status",
  "entitlements",
  "replay_access_from",
  "paid_active_months",
  "certificate_active_months_required",
  "certificate_months_remaining",
] as const;

/** Only these statuses may ever be paired with fulfillment_ready === true. */
export const FULFILLABLE_STATUSES: readonly PaymentLifecycleStatus[] = ["paid", "paid_renewal"];

/** Email kinds allowed to carry member credentials / access grants. */
export const FULFILLABLE_EMAIL_KINDS: readonly EmailKind[] = [
  "welcome_access",
  "renewal_confirmation",
];

type AnyRecord = Record<string, unknown>;

/**
 * Validates a payload against the Make/Taskade contract.
 * Returns a list of human-readable violations (empty = valid).
 */
export function validateWebhookPayload(payload: unknown): string[] {
  const errors: string[] = [];
  if (typeof payload !== "object" || payload === null) {
    return ["payload is not an object"];
  }
  const p = payload as AnyRecord;

  for (const key of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(key in p)) errors.push(`missing top-level field: ${key}`);
  }

  const extra = p.extra;
  if (typeof extra !== "object" || extra === null) {
    errors.push("extra is not an object");
  } else {
    for (const key of REQUIRED_EXTRA_FIELDS) {
      if (!(key in (extra as AnyRecord)))
        errors.push(`missing extra field: ${key}`);
    }
    for (const key of REQUIRED_SUBSCRIPTION_EXTRA_FIELDS) {
      if (!(key in (extra as AnyRecord)))
        errors.push(`missing extra subscription field: ${key}`);
    }
  }

  // Types / value domains
  if (typeof p.fulfillment_ready !== "boolean")
    errors.push("fulfillment_ready must be a boolean");
  if (typeof p.is_pending_delayed_payment !== "boolean")
    errors.push("is_pending_delayed_payment must be a boolean");
  if (
    !ALLOWED_LIFECYCLE_STATUSES.includes(
      p.payment_lifecycle_status as PaymentLifecycleStatus,
    )
  )
    errors.push(
      `payment_lifecycle_status "${String(p.payment_lifecycle_status)}" is not in the contract`,
    );
  if (!(typeof p.stripe_payment_status === "string" || p.stripe_payment_status === null))
    errors.push("stripe_payment_status must be a string or null");
  if (typeof p.payment_lifecycle_reason !== "string")
    errors.push("payment_lifecycle_reason must be a string");

  const e = (extra ?? {}) as AnyRecord;
  if (!ALLOWED_EMAIL_KINDS.includes(e.email_kind as EmailKind))
    errors.push(`extra.email_kind "${String(e.email_kind)}" is not in the contract`);

  // Mirrored gate must agree with the top level.
  if (e.fulfillment_ready !== p.fulfillment_ready)
    errors.push("extra.fulfillment_ready disagrees with top-level fulfillment_ready");
  if (e.payment_lifecycle_status !== p.payment_lifecycle_status)
    errors.push("extra.payment_lifecycle_status disagrees with top-level value");
  if (e.is_pending_delayed_payment !== p.is_pending_delayed_payment)
    errors.push("extra.is_pending_delayed_payment disagrees with top-level value");

  // Safety invariants
  if (
    p.fulfillment_ready === true &&
    !FULFILLABLE_STATUSES.includes(p.payment_lifecycle_status as PaymentLifecycleStatus)
  )
    errors.push(
      `fulfillment_ready true is only allowed with status "paid" (got "${String(p.payment_lifecycle_status)}")`,
    );
  if (
    p.fulfillment_ready === true &&
    !FULFILLABLE_EMAIL_KINDS.includes(e.email_kind as EmailKind)
  )
    errors.push(
      "fulfillment_ready true must map to extra.email_kind welcome_access or renewal_confirmation",
    );
  if (p.fulfillment_ready === false && FULFILLABLE_EMAIL_KINDS.includes(e.email_kind as EmailKind))
    errors.push("access-granting email must never be sent when fulfillment_ready is false");
  // A renewal must never re-issue first-time credentials, and a first payment
  // must never be reported as a renewal.
  if (p.payment_lifecycle_status === "paid_renewal" && e.email_kind !== "renewal_confirmation")
    errors.push("paid_renewal must map to extra.email_kind renewal_confirmation");
  if (p.payment_lifecycle_status === "paid" && e.email_kind !== "welcome_access")
    errors.push("paid must map to extra.email_kind welcome_access");
  // Access-preserving states must never suspend access downstream.
  if (
    (p.payment_lifecycle_status === "past_due_grace" ||
      p.payment_lifecycle_status === "cancellation_scheduled" ||
      p.payment_lifecycle_status === "refund_review") &&
    (extra as AnyRecord)?.access_status === "suspended"
  )
    errors.push(
      `access must remain open while payment_lifecycle_status is "${String(p.payment_lifecycle_status)}"`,
    );
  if (p.fulfillment_ready === true && p.is_pending_delayed_payment === true)
    errors.push("a payment cannot be both settled and pending");

  return errors;
}

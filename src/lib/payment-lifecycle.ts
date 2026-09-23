/**
 * Payment lifecycle classification for Stripe webhook events.
 *
 * Single source of truth deciding whether an event may trigger paid
 * enrollment / welcome-access fulfillment. Delayed-notification methods
 * (SEPA, Bacs, boleto, OXXO) fire `checkout.session.completed` when the
 * payment is SUBMITTED, not when the money arrives — `payment_status`
 * stays "unpaid" until settlement, days later. Only `paid` and
 * `no_payment_required` are final at completion time.
 */

export type PaymentLifecycleStatus =
  | "paid"
  /** Renewal invoice paid — access continues, no new welcome credentials. */
  | "paid_renewal"
  | "pending_payment"
  /**
   * Subscription Checkout completed. The card was charged by Stripe, but
   * access/welcome is granted ONLY by the canonical `invoice.paid` event.
   */
  | "awaiting_invoice_paid"
  | "failed"
  /** Renewal failed; access preserved inside the 7-day grace window. */
  | "past_due_grace"
  /** Grace/Smart Retries exhausted — member access must be suspended. */
  | "access_suspended"
  /** Cancellation requested; access stays until current_period_end. */
  | "cancellation_scheduled"
  /** Refund/credit note issued — needs human access review, never auto-revoke. */
  | "refund_review"
  | "expired"
  | "subscription_lifecycle"
  | "unknown";

/** Extra context the webhook resolves before classifying subscription events. */
export interface LifecycleContext {
  /** True when a paid invoice is a renewal rather than the first payment. */
  isRenewal?: boolean;
  /** Persisted access state after the event was applied. */
  accessStatus?: string | null;
  /** True when a failed payment was recovered inside the grace window. */
  recovered?: boolean;
  /** True when cancel_at_period_end was just set. */
  cancelAtPeriodEnd?: boolean;
  /**
   * True when the Checkout Session is `mode: "subscription"`. Such a session
   * must NEVER fulfill on its own — `invoice.paid` is canonical.
   */
  isSubscriptionCheckout?: boolean;
  /**
   * True when a failing invoice is the FIRST invoice of the subscription
   * (no paid invoice yet). No grace period applies: access stays pending.
   */
  isInitialFailure?: boolean;
}

export interface PaymentLifecycle {
  /** True ONLY when the purchase is settled and access may be granted. */
  fulfillment_ready: boolean;
  payment_lifecycle_status: PaymentLifecycleStatus;
  /** Delayed method submitted but not settled yet — wait for async events. */
  is_pending_delayed: boolean;
  /** Raw Stripe payment_status when the object is a Checkout Session. */
  stripe_payment_status: string | null;
  /** Short, machine-readable reason for the decision (for logs/automations). */
  reason: string;
}


const FULFILLABLE_PAYMENT_STATUSES = new Set(["paid", "no_payment_required"]);

export function classifyPaymentLifecycle(
  eventType: string,
  obj: { payment_status?: unknown; status?: unknown } | null | undefined,
  ctx: LifecycleContext = {},
): PaymentLifecycle {
  const paymentStatus =
    typeof obj?.payment_status === "string" ? obj.payment_status : null;

  // Subscription Checkout Sessions never fulfill on their own — the canonical
  // paid-access event for a recurring plan is `invoice.paid`.
  const subscriptionCheckoutGate = (): PaymentLifecycle => ({
    fulfillment_ready: false,
    payment_lifecycle_status: "awaiting_invoice_paid",
    is_pending_delayed: false,
    stripe_payment_status: paymentStatus,
    reason:
      "subscription checkout completed — access is granted only by the canonical invoice.paid event",
  });

  switch (eventType) {
    case "checkout.session.completed": {
      if (ctx.isSubscriptionCheckout) return subscriptionCheckoutGate();
      if (paymentStatus && FULFILLABLE_PAYMENT_STATUSES.has(paymentStatus)) {
        return {
          fulfillment_ready: true,
          payment_lifecycle_status: "paid",
          is_pending_delayed: false,
          stripe_payment_status: paymentStatus,
          reason: `checkout completed with payment_status=${paymentStatus}`,
        };
      }
      // "unpaid" (or missing) => delayed notification method still settling.
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "pending_payment",
        is_pending_delayed: true,
        stripe_payment_status: paymentStatus,
        reason:
          "checkout completed but payment not settled (delayed method) — awaiting async_payment_succeeded",
      };
    }

    case "checkout.session.async_payment_succeeded":
      if (ctx.isSubscriptionCheckout) return subscriptionCheckoutGate();
      return {
        fulfillment_ready: true,
        payment_lifecycle_status: "paid",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus ?? "paid",
        reason: "delayed payment settled",
      };

    case "checkout.session.async_payment_failed":
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "failed",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: "delayed payment failed after checkout",
      };

    case "payment_intent.payment_failed":
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "failed",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: "payment intent failed",
      };

    case "checkout.session.expired":
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "expired",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: "checkout session expired before payment",
      };

    // ---- Recurring subscription lifecycle -------------------------------
    // invoice.paid is the CANONICAL paid-access event.
    case "invoice.paid":
      return {
        fulfillment_ready: true,
        payment_lifecycle_status: ctx.isRenewal ? "paid_renewal" : "paid",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus ?? "paid",
        reason: ctx.recovered
          ? "failed payment recovered within grace — access restored"
          : ctx.isRenewal
            ? "renewal invoice paid — access continues"
            : "initial subscription invoice paid — access granted",
      };

    case "invoice.payment_failed":
      // A grace period only exists for RENEWALS. If the very first invoice
      // fails, nothing was ever paid: access stays pending, never active.
      if (ctx.isInitialFailure) {
        return {
          fulfillment_ready: false,
          payment_lifecycle_status: "failed",
          is_pending_delayed: false,
          stripe_payment_status: paymentStatus,
          reason:
            "initial subscription invoice failed — no access is granted and no grace period applies",
        };
      }
      return {
        fulfillment_ready: false,
        payment_lifecycle_status:
          ctx.accessStatus === "suspended" ? "access_suspended" : "past_due_grace",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason:
          ctx.accessStatus === "suspended"
            ? "renewal unpaid after retries and grace period — suspend access"
            : "renewal payment failed — access preserved during the 7-day grace period",
      };

    case "invoice.payment_action_required":
      if (ctx.isInitialFailure) {
        return {
          fulfillment_ready: false,
          payment_lifecycle_status: "failed",
          is_pending_delayed: true,
          stripe_payment_status: paymentStatus,
          reason:
            "initial subscription invoice needs customer authentication — access is not granted yet",
        };
      }
      return {
        fulfillment_ready: false,
        payment_lifecycle_status:
          ctx.accessStatus === "suspended" ? "access_suspended" : "past_due_grace",
        is_pending_delayed: true,
        stripe_payment_status: paymentStatus,
        reason: "renewal needs customer authentication (3DS) — access preserved during grace",
      };


    case "charge.refunded":
    case "credit_note.created":
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "refund_review",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: "refund or credit note issued — access requires human review",
      };

    case "customer.subscription.deleted":
    case "customer.subscription.paused":
      return {
        fulfillment_ready: false,
        payment_lifecycle_status:
          ctx.accessStatus === "active" ? "cancellation_scheduled" : "access_suspended",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason:
          ctx.accessStatus === "active"
            ? "subscription ended in Stripe but the paid period still covers access"
            : "subscription ended and the paid period is over — suspend access",
      };

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.resumed":
      if (ctx.cancelAtPeriodEnd) {
        return {
          fulfillment_ready: false,
          payment_lifecycle_status: "cancellation_scheduled",
          is_pending_delayed: false,
          stripe_payment_status: paymentStatus,
          reason: "cancellation scheduled — access continues until current_period_end",
        };
      }
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "subscription_lifecycle",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: "subscription state change — no fulfillment decision",
      };

    default:
      return {
        fulfillment_ready: false,
        payment_lifecycle_status: "unknown",
        is_pending_delayed: false,
        stripe_payment_status: paymentStatus,
        reason: `unclassified event: ${eventType}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Payload contract helpers
// ---------------------------------------------------------------------------
// The webhook builds its outbound payload from these helpers so the exact
// field names/values Make/Taskade branch on live in one place and can be
// contract-tested. See src/lib/webhook-contract.ts.

export type EmailKind =
  | "welcome_access"
  | "renewal_confirmation"
  | "payment_pending_notice"
  | "payment_failed_recovery"
  | "payment_recovery_grace"
  | "access_suspended_notice"
  | "cancellation_scheduled_notice"
  | "refund_review_notice"
  | "checkout_expired_recovery"
  | "no_email";

export interface LifecycleContractFields {
  fulfillment_ready: boolean;
  payment_lifecycle_status: PaymentLifecycleStatus;
  is_pending_delayed_payment: boolean;
  stripe_payment_status: string | null;
  payment_lifecycle_reason: string;
}

export interface LifecycleExtraFields {
  fulfillment_ready: boolean;
  payment_lifecycle_status: PaymentLifecycleStatus;
  is_pending_delayed_payment: boolean;
  email_kind: EmailKind;
  fulfillment_instruction: string;
}

/** Top-level fulfillment-gate fields sent to Make/Taskade. */
export function buildLifecycleContractFields(
  lifecycle: PaymentLifecycle,
): LifecycleContractFields {
  return {
    fulfillment_ready: lifecycle.fulfillment_ready,
    payment_lifecycle_status: lifecycle.payment_lifecycle_status,
    is_pending_delayed_payment: lifecycle.is_pending_delayed,
    stripe_payment_status: lifecycle.stripe_payment_status,
    payment_lifecycle_reason: lifecycle.reason,
  };
}

export function resolveEmailKind(lifecycle: PaymentLifecycle): EmailKind {
  if (lifecycle.fulfillment_ready) {
    return lifecycle.payment_lifecycle_status === "paid_renewal"
      ? "renewal_confirmation"
      : "welcome_access";
  }
  switch (lifecycle.payment_lifecycle_status) {
    // Subscription checkout is not an access event — the welcome email is
    // sent by invoice.paid only.
    case "awaiting_invoice_paid":
      return "no_email";
    case "pending_payment":
      return "payment_pending_notice";

    case "failed":
      return "payment_failed_recovery";
    case "past_due_grace":
      return "payment_recovery_grace";
    case "access_suspended":
      return "access_suspended_notice";
    case "cancellation_scheduled":
      return "cancellation_scheduled_notice";
    case "refund_review":
      return "refund_review_notice";
    case "expired":
      return "checkout_expired_recovery";
    default:
      return "no_email";
  }
}

/** Mirrored gate inside `extra`, for scenarios that read only `extra`. */
export function buildLifecycleExtraFields(
  lifecycle: PaymentLifecycle,
): LifecycleExtraFields {
  return {
    fulfillment_ready: lifecycle.fulfillment_ready,
    payment_lifecycle_status: lifecycle.payment_lifecycle_status,
    is_pending_delayed_payment: lifecycle.is_pending_delayed,
    email_kind: resolveEmailKind(lifecycle),
    fulfillment_instruction: lifecycle.fulfillment_ready
      ? lifecycle.payment_lifecycle_status === "paid_renewal"
        ? "Renewal is paid. Keep member access open and send a renewal receipt. Do NOT issue new credentials."
        : "Payment is settled. Send the welcome email with member area access."
      : lifecycle.payment_lifecycle_status === "awaiting_invoice_paid"
        ? "Do NOT send welcome or access credentials yet. Wait for the invoice.paid event of this subscription."
        : lifecycle.payment_lifecycle_status === "past_due_grace"
          ? "Keep member access open during the grace period and ask the student to update their payment method."
          : lifecycle.payment_lifecycle_status === "access_suspended"
            ? "Suspend member access now and tell the student how to restore it."
            : lifecycle.payment_lifecycle_status === "cancellation_scheduled"
              ? "Keep member access open until the scheduled end date. Do NOT revoke access now."
              : lifecycle.payment_lifecycle_status === "refund_review"
                ? "Do NOT revoke access automatically. A human must review this refund."
                : "Do NOT send welcome or access credentials. Payment is not settled.",

  };
}

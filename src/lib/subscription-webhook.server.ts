/**
 * Turns a Stripe event into persisted subscription lifecycle state and the
 * classification context the payment-lifecycle gate needs.
 *
 * `invoice.paid` is the ONLY event that grants or renews paid access.
 */

import type { StripeEnv } from "@/lib/stripe.server";
import { createStripeClient } from "@/lib/stripe.server";
import type { LifecycleContext } from "@/lib/payment-lifecycle";
import {
  applyInvoiceActionRequired,
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  associateCheckout,
  flagRefundReview,
  syncSubscription,
  type MemberSubscriptionRow,
} from "@/lib/subscription-state.server";

export type SubscriptionEventResult = {
  row: MemberSubscriptionRow | null;
  ctx: LifecycleContext;
  /** True when this exact invoice was already processed (idempotent replay). */
  duplicate: boolean;
};

function subIdFrom(obj: any): string | null {
  if (typeof obj?.subscription === "string") return obj.subscription;
  if (obj?.subscription?.id) return obj.subscription.id;
  const parent = obj?.parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent?.id) return parent.id;
  if (typeof obj?.id === "string" && obj.id.startsWith("sub_")) return obj.id;
  return null;
}

/**
 * `critical: true` is used by the canonical access event (`invoice.paid`):
 * a retrieve failure must propagate so the webhook returns 500 and Stripe
 * retries, otherwise tier/duration/certificate months can stay permanently
 * incomplete when events arrive out of order. Association-only events stay
 * best-effort.
 */
async function retrieveSub(env: StripeEnv, id: string | null, critical = false) {
  if (!id) return null;
  try {
    const stripe = createStripeClient(env);
    return await stripe.subscriptions.retrieve(id, {
      expand: ["items.data.price.product", "default_payment_method"],
    });
  } catch (e) {
    if (critical) throw e;
    console.warn("[subscription-webhook] subscription retrieve failed:", e);
    return null;
  }
}

export async function processSubscriptionEvent(params: {
  event: any;
  env: StripeEnv;
  leadId: string | null;
  email: string | null;
  fullName: string | null;
}): Promise<SubscriptionEventResult> {
  const { event, env } = params;
  const obj = event?.data?.object ?? {};
  const type: string = event?.type ?? "";
  const empty: SubscriptionEventResult = { row: null, ctx: {}, duplicate: false };

  // NOTE: no try/catch here on purpose. Core lifecycle persistence failures
  // MUST propagate so the webhook route returns 500 and Stripe retries.
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (obj?.mode !== "subscription") return empty;
      const subscriptionId = subIdFrom(obj);
      if (!subscriptionId) return { row: null, ctx: { isSubscriptionCheckout: true }, duplicate: false };
      // Association ONLY — access is granted by invoice.paid.
      const row = await associateCheckout({
        env,
        subscriptionId,
        customerId:
          typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null),
        leadId: params.leadId,
        email: params.email ?? obj?.customer_details?.email ?? null,
        fullName: params.fullName,
        metadata: obj?.metadata ?? null,
      });
      const sub = await retrieveSub(env, subscriptionId);
      const synced = sub ? await syncSubscription({ env, sub }) : row;
      return {
        row: synced ?? row,
        ctx: {
          isSubscriptionCheckout: true,
          accessStatus: (synced ?? row)?.access_status ?? "pending",
        },
        duplicate: false,
      };
    }

    case "invoice.paid": {
      const subscriptionId = subIdFrom(obj);
      if (!subscriptionId) return empty;
      const before = await retrieveSub(env, subscriptionId, true);
      const applied = await applyInvoicePaid({ env, invoice: obj, sub: before });
      return {
        row: applied.row,
        ctx: {
          isRenewal: applied.isRenewal,
          recovered: applied.recovered,
          accessStatus: applied.row?.access_status ?? "active",
          cancelAtPeriodEnd: applied.row?.cancel_at_period_end ?? false,
        },
        duplicate: applied.duplicate,
      };
    }

    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const subscriptionId = subIdFrom(obj);
      if (!subscriptionId) return empty;
      const sub = await retrieveSub(env, subscriptionId);
      const applied =
        type === "invoice.payment_failed"
          ? await applyInvoicePaymentFailed({ env, invoice: obj, sub })
          : await applyInvoiceActionRequired({ env, invoice: obj, sub });
      return {
        row: applied.row,
        ctx: {
          accessStatus: applied.row?.access_status ?? null,
          isInitialFailure: applied.isInitialFailure,
        },
        duplicate: false,
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const row = await syncSubscription({ env, sub: obj });
      return {
        row,
        ctx: {
          accessStatus: row?.access_status ?? null,
          cancelAtPeriodEnd: Boolean(obj?.cancel_at_period_end),
        },
        duplicate: false,
      };
    }

    case "charge.refunded":
    case "credit_note.created": {
      let subscriptionId = subIdFrom(obj);
      if (!subscriptionId && typeof obj?.invoice === "string") {
        try {
          const stripe = createStripeClient(env);
          const inv = await stripe.invoices.retrieve(obj.invoice);
          subscriptionId = subIdFrom(inv);
        } catch {
          // non-fatal: refund review can proceed without the subscription link
        }
      }
      const row = await flagRefundReview({ env, subscriptionId });
      return { row, ctx: { accessStatus: row?.access_status ?? null }, duplicate: false };
    }

    default:
      return empty;
  }
}


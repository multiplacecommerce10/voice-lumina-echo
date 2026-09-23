import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import {
  entitlementsToMetadata,
  resolveEntitlements,
  tierFromPriceKey,
} from "@/lib/entitlements";
import {
  GRACE_PERIOD_DAYS,
  OFFERING_VERSION,
  durationMonthsFromLookupKey,
  tierFromLookupKey,
} from "@/lib/subscription-catalog";
import type { MemberSubscriptionRow } from "@/lib/subscription-state.server";

import {
  HISTORICAL_PRICE_KEYS,
  OFFERED_PRICE_KEYS,
  UTM_KEYS,
  buildIntegrationIdentifier,
  buildReturnUrl,
  safeOrigin,
} from "@/lib/payments-helpers";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

export type PackageConsent = {
  termsVersion?: string;
  privacyVersion?: string;
  refundVersion?: string;
  acceptedAt?: string;
  immediateAccessAt?: string;
  marketingOptIn?: boolean;
};


export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    customerEmail?: string;
    returnUrl: string;
    environment: StripeEnv;
    utms?: Record<string, string>;
    landingUrl?: string;
    referrer?: string;
    leadId?: string;
    consent?: PackageConsent;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if ((HISTORICAL_PRICE_KEYS as readonly string[]).includes(data.priceId)) {
      throw new Error(`Price is retired and no longer purchasable: ${data.priceId}`);
    }
    if (!(OFFERED_PRICE_KEYS as readonly string[]).includes(data.priceId)) {
      throw new Error(`Price is not available for purchase: ${data.priceId}`);
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (data.leadId && !/^[a-f0-9-]{36}$/.test(data.leadId)) {
      throw new Error("Invalid leadId");
    }
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], limit: 1 });
      if (!prices.data.length) throw new Error(`Price not found: ${data.priceId}`);
      const stripePrice = prices.data[0];

      // Fail closed: the card path only sells recurring subscriptions now.
      if (stripePrice.type !== "recurring" || !stripePrice.recurring) {
        throw new Error(
          `Price ${data.priceId} is not a recurring price. Checkout was blocked.`,
        );
      }
      if (!stripePrice.active) throw new Error(`Price ${data.priceId} is not active.`);

      const productId = typeof stripePrice.product === "string"
        ? stripePrice.product
        : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      const productDescription = product.name;

      // Build attribution metadata (Stripe limits: 50 keys, 500 chars each)
      const metadata: Record<string, string> = {};
      if (data.utms) {
        for (const key of UTM_KEYS) {
          const value = data.utms[key];
          if (value) metadata[key] = String(value).slice(0, 480);
        }
      }
      if (data.landingUrl) metadata.landing_url = data.landingUrl.slice(0, 480);
      if (data.referrer) metadata.referrer = data.referrer.slice(0, 480);
      metadata.captured_at = new Date().toISOString();
      if (data.leadId) metadata.lead_id = data.leadId;

      // Package identity — recurring, full period charged up front.
      const months =
        durationMonthsFromLookupKey(data.priceId) ??
        stripePrice.recurring.interval_count ??
        null;
      metadata.package = data.priceId;
      metadata.tier = data.priceId.startsWith("live_") ? "live" : "complete";
      metadata.duration_months = months ? String(months) : "";
      metadata.access_months = months ? String(months) : "";
      metadata.purchase_type = "recurring_subscription";
      metadata.auto_renew = "true";
      metadata.offering_version = OFFERING_VERSION;
      metadata.grace_period_days = String(GRACE_PERIOD_DAYS);
      // Entitlement contract resolved from the single source of truth. Access
      // (and Complete replay eligibility) starts on the student's own
      // confirmed enrollment date, which only exists after payment confirms.
      Object.assign(
        metadata,
        entitlementsToMetadata(resolveEntitlements(tierFromPriceKey(data.priceId), null)),
      );

      // Legal acceptance record (versions + timestamps).
      if (data.consent) {
        if (data.consent.termsVersion) metadata.terms_version = data.consent.termsVersion;
        if (data.consent.privacyVersion) metadata.privacy_version = data.consent.privacyVersion;
        if (data.consent.refundVersion) metadata.refund_version = data.consent.refundVersion;
        if (data.consent.acceptedAt) metadata.legal_accepted_at = data.consent.acceptedAt;
        if (data.consent.immediateAccessAt)
          metadata.immediate_access_requested_at = data.consent.immediateAccessAt;
        metadata.marketing_opt_in = data.consent.marketingOptIn ? "true" : "false";
      }

      // One-line condensed summary for quick scan in the Stripe dashboard.
      const summaryParts = [
        data.utms?.utm_source && `src=${data.utms.utm_source}`,
        data.utms?.utm_medium && `med=${data.utms.utm_medium}`,
        data.utms?.utm_campaign && `cmp=${data.utms.utm_campaign}`,
        data.utms?.utm_content && `cnt=${data.utms.utm_content}`,
        data.utms?.utm_term && `trm=${data.utms.utm_term}`,
        data.utms?.gclid && `gclid=${data.utms.gclid}`,
        data.utms?.fbclid && `fbclid=${data.utms.fbclid}`,
      ].filter(Boolean) as string[];
      const attributionSummary = summaryParts.length > 0
        ? summaryParts.join(" | ").slice(0, 480)
        : "direct";
      metadata.attribution_summary = attributionSummary;

      // client_reference_id: prefer leadId (joinable with our `leads` table),
      // fall back to utm summary, else "direct". Stripe allows [A-Za-z0-9_-], max 200.
      const clientReferenceId = data.leadId
        ? data.leadId
        : (() => {
            const parts = [
              data.utms?.utm_source,
              data.utms?.utm_medium,
              data.utms?.utm_campaign,
            ].filter(Boolean) as string[];
            return parts.length > 0
              ? parts.join("__").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200)
              : "direct";
          })();

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        // Recurring subscription: the full selected period is charged
        // immediately (no trial) and renews automatically for the same period.
        // Dynamic Payment Methods are left to Stripe (no payment_method_types).
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: buildReturnUrl(data.returnUrl),
        client_reference_id: clientReferenceId,
        integration_identifier: buildIntegrationIdentifier(),
        subscription_data: {
          description: productDescription,
          metadata,
          // Flexible billing mode (dahlia): per-item periods and accurate
          // proration bookkeeping for multi-month intervals.
          billing_mode: { type: "flexible" },
        },
        metadata,
        ...(data.customerEmail && { customer_email: data.customerEmail }),
      } as any);


      // Link the Stripe session back to our lead row so the webhook can
      // join cleanly and mark status transitions.
      if (data.leadId && session.id) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("leads")
            .update({ stripe_session_id: session.id, status: "checkout_started" })
            .eq("id", data.leadId);
        } catch (e) {
          console.error("[createCheckoutSession] failed to link lead:", e);
        }
      }

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Stripe Billing Portal session.
 *
 * The customer is NEVER taken from the client: we accept only a Checkout
 * Session id, retrieve it from Stripe and use the customer recorded on it.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; returnUrl?: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      if (session.mode !== "subscription") {
        return {
          error: "This purchase is not a recurring enrollment, so there is no billing portal.",
        };
      }
      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      if (!customerId) throw new Error("No billing account is linked to this purchase yet.");

      // Portal capabilities: update payment method, see invoices, cancel at
      // period end. Plan/duration switching is deliberately disabled — those
      // changes require manual pedagogical review.
      // The configuration is created ONCE and reused deterministically; we
      // never create a new one on every button click.
      const MANAGED_KEY = "conscious_voice_portal_v1";
      const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
      const managed = existing.data.find(
        (c) => (c.metadata as Record<string, string> | null)?.lovable_managed === MANAGED_KEY,
      );

      const configurationId =
        managed?.id ??
        (
          await stripe.billingPortal.configurations.create({
            metadata: { lovable_managed: MANAGED_KEY },
            business_profile: {
              headline: "The Power of Conscious Voice — manage your enrollment",
            },
            features: {
              payment_method_update: { enabled: true },
              invoice_history: { enabled: true },
              customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
              subscription_update: { enabled: false },
              subscription_cancel: {
                enabled: true,
                mode: "at_period_end",
                cancellation_reason: {
                  enabled: true,
                  options: [
                    "too_expensive",
                    "missing_features",
                    "switched_service",
                    "unused",
                    "other",
                  ],
                },
              },
            },
          } as any)
        ).id;

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        configuration: configurationId,
        return_url: `${safeOrigin(data.returnUrl ?? "")}/membership?session_id=${encodeURIComponent(data.sessionId)}`,
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


export type CheckoutSummary = {
  status: "complete" | "open" | "expired" | "unknown";
  paymentStatus: string | null;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
  priceLookupKey: string | null;
  productName: string | null;
  tier: "live" | "complete" | null;
  durationMonths: number | null;
};

export const getCheckoutSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSummary | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price.product"],
      });
      const item = session.line_items?.data[0];
      const price = item?.price ?? null;
      const product = price && typeof price.product !== "string" ? price.product : null;
      const lookupKey = price?.lookup_key ?? null;
      // Current recurring keys (live_sub_* / complete_sub_*) resolve through the
      // shared catalog helpers; legacy one-time keys fall back to prefix parsing.
      const tier: CheckoutSummary["tier"] =
        tierFromLookupKey(lookupKey) ??
        (lookupKey?.startsWith("live_pkg_") || lookupKey?.startsWith("live_cohort_")
          ? "live"
          : lookupKey?.startsWith("replay_pkg_") || lookupKey?.startsWith("replay_access_")
            ? "complete"
            : null);
      const durationMatch = lookupKey?.match(/_(\d+)m$/);
      return {
        status: (session.status as CheckoutSummary["status"]) ?? "unknown",
        paymentStatus: session.payment_status ?? null,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        priceLookupKey: lookupKey,
        productName: product && "name" in product ? product.name : null,
        tier,
        durationMonths:
          durationMonthsFromLookupKey(lookupKey) ??
          (durationMatch ? Number(durationMatch[1]) : null),
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * One-time prepaid purchase summary for /membership. Never reports a payment
 * as successful unless Stripe says the session is complete AND paid.
 */
export type PrepaidAccessSummary = {
  /** true only when status === "complete" and payment_status is paid/no_payment_required */
  paid: boolean;
  status: "complete" | "open" | "expired" | "unknown";
  paymentStatus: string | null;
  planName: string | null;
  tier: "live" | "complete" | null;
  packageKey: string | null;
  durationMonths: number | null;
  amountPaid: number | null; // minor units
  currency: string | null;
  purchasedAt: string | null; // ISO, from Checkout Session created
  accessEndsAt: string | null; // ISO, purchasedAt + durationMonths
  customerEmail: string | null;
};

export const getPrepaidAccessSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<PrepaidAccessSummary | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price.product"],
      });

      const price = session.line_items?.data?.[0]?.price ?? null;
      const product = price && typeof price.product !== "string" ? price.product : null;
      const lookupKey = price?.lookup_key ?? null;
      const tier: PrepaidAccessSummary["tier"] =
        lookupKey?.startsWith("live_pkg_") || lookupKey?.startsWith("live_cohort_")
          ? "live"
          : lookupKey?.startsWith("replay_pkg_") || lookupKey?.startsWith("replay_access_")
            ? "complete"
            : null;
      const durationMatch = lookupKey?.match(/_(\d+)m$/);
      const months = durationMatch ? Number(durationMatch[1]) : null;

      const status = (session.status as PrepaidAccessSummary["status"]) ?? "unknown";
      const paymentStatus = session.payment_status ?? null;
      const paid =
        status === "complete" &&
        (paymentStatus === "paid" || paymentStatus === "no_payment_required");

      const createdIso = session.created ? new Date(session.created * 1000).toISOString() : null;
      let accessEndsAt: string | null = null;
      if (createdIso && months && months > 0) {
        const end = new Date(createdIso);
        end.setMonth(end.getMonth() + months);
        accessEndsAt = end.toISOString();
      }

      return {
        paid,
        status,
        paymentStatus,
        planName: product && "name" in product ? product.name : null,
        tier,
        packageKey: lookupKey,
        durationMonths: months,
        amountPaid: session.amount_total ?? null,
        currency: session.currency ?? null,
        purchasedAt: createdIso,
        accessEndsAt,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * LEGACY — kept for historical one-time prepaid purchases. The CURRENT
 * product is a recurring subscription; use `getSubscriptionAccessSummary`.
 */

export type SubscriptionSummary = {
  found: boolean;
  status: string | null;
  planName: string | null;
  tier: "live" | "complete" | null;
  durationMonths: number | null;
  interval: string | null;
  amountPerCycle: number | null;
  currency: string | null;
  startedAt: string | null;
  nextChargeAt: string | null;
  cancelAtPeriodEnd: boolean;
  customerEmail: string | null;
  last4: string | null;
};

export const getSubscriptionSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<SubscriptionSummary | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        // Stripe allows at most 4 expansion levels; expanding the product through the
        // subscription item is 5 and returns property_expansion_max_depth.
        // The product comes from line_items instead.
        expand: [
          "subscription.default_payment_method",
          "subscription.items.data.price",
          "line_items.data.price.product",
        ],
      });

      const email = session.customer_details?.email ?? session.customer_email ?? null;
      const sub = typeof session.subscription === "string" ? null : session.subscription;

      const fallbackPrice = session.line_items?.data?.[0]?.price ?? null;
      const item = sub?.items?.data?.[0] ?? null;
      const price = item?.price ?? fallbackPrice;
      const product = price && typeof price.product !== "string" ? price.product : null;
      const lookupKey = price?.lookup_key ?? null;
      const tier: SubscriptionSummary["tier"] = lookupKey?.startsWith("live_pkg_") || lookupKey?.startsWith("live_cohort_")
        ? "live"
        : lookupKey?.startsWith("replay_pkg_") || lookupKey?.startsWith("replay_access_")
        ? "complete"
        : null;
      const durationMatch = lookupKey?.match(/_(\d+)m$/);

      const periodEnd =
        (item as unknown as { current_period_end?: number } | null)?.current_period_end ??
        (sub as unknown as { current_period_end?: number } | null)?.current_period_end ??
        null;
      const started =
        (sub as unknown as { start_date?: number } | null)?.start_date ?? null;

      const pm = sub && typeof sub.default_payment_method !== "string"
        ? sub.default_payment_method
        : null;

      return {
        found: Boolean(sub),
        status: sub?.status ?? null,
        planName: product && "name" in product ? product.name : null,
        tier,
        durationMonths:
          durationMonthsFromLookupKey(lookupKey) ??
          (durationMatch ? Number(durationMatch[1]) : null),
        interval: price?.recurring?.interval ?? null,
        amountPerCycle: price?.unit_amount ?? session.amount_total ?? null,
        currency: price?.currency ?? session.currency ?? null,
        startedAt: started ? new Date(started * 1000).toISOString() : null,
        nextChargeAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        customerEmail: email,
        last4: pm?.card?.last4 ?? null,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Recurring subscription summary for /membership.
 *
 * Access is driven by our OWN persisted lifecycle row whenever one exists
 * (`member_subscriptions.access_status`), reconciled first so an expired
 * grace window reads as suspended even while Stripe still says `past_due`.
 * Stripe is used only as a narrow fallback when no row exists yet and the
 * initial Checkout Session is confirmed paid.
 */
export type SubscriptionAccessSummary = {
  found: boolean;
  /** True when the student currently has paid access. */
  active: boolean;
  status: string | null;
  planName: string | null;
  tier: "live" | "complete" | null;
  priceLookupKey: string | null;
  /** Length of each billing period, in months (1, 3 or 6). */
  intervalMonths: number | null;
  /** Amount charged every renewal cycle, in minor units. */
  amountPerPeriod: number | null;
  currency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  startedAt: string | null;
  customerEmail: string | null;
  last4: string | null;
  /** Set when a renewal failed: access continues until this instant. */
  graceExpiresAt: string | null;
  /** Persisted access state: pending | active | past_due_grace | suspended | canceled. */
  accessStatus: string | null;
  /** Canonical enrollment date from our DB — drives Complete replay entitlement. */
  studentEnrolledAt: string | null;
  paidActiveMonths: number | null;
  certificateMonthsRequired: number;
  certificateMonthsRemaining: number | null;
};


export const getSubscriptionAccessSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<SubscriptionAccessSummary | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        // Stripe allows at most 4 expansion levels; expanding the product through the
        // subscription item is 5 and returns property_expansion_max_depth.
        // The product comes from line_items instead.
        expand: [
          "subscription.default_payment_method",
          "subscription.items.data.price",
          "line_items.data.price.product",
        ],
      });

      const sub = typeof session.subscription === "string" ? null : session.subscription;
      const item = sub?.items?.data?.[0] ?? null;
      const price = item?.price ?? session.line_items?.data?.[0]?.price ?? null;
      const linePrice = session.line_items?.data?.[0]?.price ?? null;
      const product =
        linePrice && typeof linePrice.product !== "string"
          ? linePrice.product
          : price && typeof price.product !== "string"
            ? price.product
            : null;
      const lookupKey = price?.lookup_key ?? null;
      const tier = tierFromLookupKey(lookupKey);
      const intervalMonths =
        durationMonthsFromLookupKey(lookupKey) ?? price?.recurring?.interval_count ?? null;

      const unix = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;
      const periodStart = unix(
        (item as unknown as { current_period_start?: number } | null)?.current_period_start ??
          (sub as unknown as { current_period_start?: number } | null)?.current_period_start,
      );
      const periodEnd = unix(
        (item as unknown as { current_period_end?: number } | null)?.current_period_end ??
          (sub as unknown as { current_period_end?: number } | null)?.current_period_end,
      );

      const pm =
        sub && typeof sub.default_payment_method !== "string" ? sub.default_payment_method : null;

      // Our persisted lifecycle row is the source of truth for access. It is
      // reconciled first so an EXPIRED grace window reads as suspended even
      // while Stripe still reports `past_due`.
      // Fail closed: a lifecycle read/reconciliation failure must surface as a
      // server-function error, never fall back to Stripe status.
      let row: MemberSubscriptionRow | null = null;
      if (sub?.id) {
        const { getReconciledRow } = await import("@/lib/subscription-state.server");
        row = await getReconciledRow(data.environment, sub.id);
      }

      // No Stripe-status fallback: access is granted only by a persisted row
      // created by the canonical `invoice.paid` event.
      const { evaluateAccess } = await import("@/lib/subscription-state.server");
      const active = row ? evaluateAccess(row).active : false;

      const certificateMonthsRequired = 6;

      return {
        found: Boolean(sub) || Boolean(row),
        active,
        status: row?.status ?? sub?.status ?? null,
        planName: product && "name" in product ? product.name : null,
        tier: tier ?? row?.tier ?? null,
        priceLookupKey: lookupKey ?? row?.price_lookup_key ?? null,
        intervalMonths: intervalMonths ?? row?.duration_months ?? null,
        amountPerPeriod: price?.unit_amount ?? session.amount_total ?? null,
        currency: price?.currency ?? session.currency ?? null,
        currentPeriodStart: row?.current_period_start ?? periodStart,
        currentPeriodEnd: row?.current_period_end ?? periodEnd,
        cancelAtPeriodEnd: row?.cancel_at_period_end ?? sub?.cancel_at_period_end ?? false,
        canceledAt:
          row?.canceled_at ?? unix((sub as unknown as { canceled_at?: number } | null)?.canceled_at),
        // Canonical enrollment date comes from our DB (first paid invoice),
        // NOT from Stripe's subscription start_date.
        // Stays null until the persisted invoice.paid enrollment date exists.
        startedAt: row?.student_enrolled_at ?? null,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
        last4: pm?.card?.last4 ?? null,
        graceExpiresAt: row?.grace_expires_at ?? null,
        accessStatus: row?.access_status ?? null,
        studentEnrolledAt: row?.student_enrolled_at ?? null,
        paidActiveMonths: row?.paid_active_months ?? null,
        certificateMonthsRequired,
        certificateMonthsRemaining: row
          ? Math.max(0, certificateMonthsRequired - row.paid_active_months)
          : null,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


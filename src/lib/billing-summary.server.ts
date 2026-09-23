// Builds a human-readable billing summary (monthly cycle + next charge)
// for downstream automations (Taskade welcome email).
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import {
  durationMonthsFromLookupKey,
  tierFromLookupKey,
} from "@/lib/subscription-catalog";

export type BillingSummary = {
  is_subscription: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  plan_name: string | null;
  tier: "live" | "complete" | null;
  price_lookup_key: string | null;
  interval: string | null;
  duration_months: number | null;
  amount_per_cycle: number | null; // major unit
  amount_per_cycle_formatted: string | null;
  total_commitment: number | null; // major unit
  total_commitment_formatted: string | null;
  currency: string | null;
  subscription_status: string | null;
  started_at: string | null; // ISO
  started_at_formatted: string | null;
  next_charge_at: string | null; // ISO
  next_charge_at_formatted: string | null;
  days_until_next_charge: number | null;
  cancel_at_period_end: boolean;
  card_last4: string | null;
  billing_schedule: { month: number; date: string }[];
  membership_url: string | null;
  billing_summary_text: string | null;
};

function money(amountMinor: number | null, currency: string | null): string | null {
  if (amountMinor == null || !currency) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export async function buildBillingSummary(params: {
  environment: StripeEnv;
  checkoutSessionId?: string | null;
  subscriptionId?: string | null;
  siteUrl?: string | null;
}): Promise<BillingSummary | null> {
  const { environment, checkoutSessionId } = params;
  try {
    const stripe = createStripeClient(environment);

    let sub: any = null;
    let sessionAmount: number | null = null;
    let sessionCurrency: string | null = null;

    if (checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        // Max 4 expansion levels in Stripe — keep price only on the subscription item.
        expand: [
          "subscription.default_payment_method",
          "subscription.items.data.price",
          "line_items.data.price.product",
        ],
      } as any);
      sessionAmount = (session as any).amount_total ?? null;
      sessionCurrency = (session as any).currency ?? null;
      sub = typeof (session as any).subscription === "string" ? null : (session as any).subscription;
      if (!sub && (session as any).line_items?.data?.[0]?.price) {
        // ── LEGACY one-time prepaid package (historical purchases only) ────
        const price = (session as any).line_items.data[0].price;
        const product = price && typeof price.product !== "string" ? price.product : null;
        const lookupKey: string | null = price?.lookup_key ?? null;
        const months = durationMonthsFromLookupKey(lookupKey);

        const createdUnix: number | null = (session as any).created ?? null;
        const startedAt = createdUnix ? new Date(createdUnix * 1000).toISOString() : null;

        // Access months (informational only — no payment is due on these dates).
        const accessSchedule: { month: number; date: string }[] = [];
        if (startedAt && months && months > 0) {
          for (let i = 0; i < months; i++) {
            const d = new Date(startedAt);
            d.setMonth(d.getMonth() + i);
            accessSchedule.push({ month: i + 1, date: d.toISOString().slice(0, 10) });
          }
        }
        let accessEndsFormatted: string | null = null;
        if (startedAt && months && months > 0) {
          const end = new Date(startedAt);
          end.setMonth(end.getMonth() + months);
          accessEndsFormatted = longDate(end.toISOString());
        }

        const siteUrlOnce = params.siteUrl ?? "https://consciousvoice.tecendosom.com";
        const totalFormatted = money(sessionAmount, sessionCurrency);

        const oneTimeText = [
          product?.name ? `Plan: ${product.name}.` : null,
          totalFormatted
            ? `You made a single prepaid payment of ${totalFormatted}.`
            : "You made a single prepaid payment.",
          months
            ? `It covers your full access period of ${months} month${months === 1 ? "" : "s"}.`
            : null,
          startedAt ? `Your access started on ${longDate(startedAt)}.` : null,
          accessEndsFormatted ? `It runs until ${accessEndsFormatted}.` : null,
          "There is no automatic renewal and no further charge — nothing to cancel.",
        ]
          .filter(Boolean)
          .join(" ");

        return {
          is_subscription: false,
          stripe_subscription_id: null,
          stripe_customer_id:
            typeof (session as any).customer === "string"
              ? (session as any).customer
              : ((session as any).customer?.id ?? null),
          plan_name: product?.name ?? null,
          tier: tierFromLookupKey(lookupKey),
          price_lookup_key: lookupKey,
          interval: null,
          duration_months: months,
          // One-time: there is no "cycle". Both fields carry the single total.
          amount_per_cycle: sessionAmount != null ? sessionAmount / 100 : null,
          amount_per_cycle_formatted: totalFormatted,
          total_commitment: sessionAmount != null ? sessionAmount / 100 : null,
          total_commitment_formatted: totalFormatted,
          currency: sessionCurrency,
          subscription_status: null,
          started_at: startedAt,
          started_at_formatted: longDate(startedAt),
          // Deliberately null: never use next-charge language for prepaid buys.
          next_charge_at: null,
          next_charge_at_formatted: null,
          days_until_next_charge: null,
          cancel_at_period_end: false,
          card_last4: null,
          billing_schedule: accessSchedule,
          membership_url: `${siteUrlOnce}/membership?session_id=${encodeURIComponent(checkoutSessionId)}`,
          billing_summary_text: oneTimeText,
        };
      }
    } else if (params.subscriptionId) {
      sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
        expand: ["default_payment_method", "items.data.price.product"],
      } as any);
    }

    if (!sub) return null;

    const item = sub.items?.data?.[0] ?? null;
    const price = item?.price ?? null;
    const product = price && typeof price.product !== "string" ? price.product : null;
    const lookupKey: string | null = price?.lookup_key ?? null;
    const durationMatch = lookupKey?.match(/_(\d+)m$/);
    const months = durationMatch ? Number(durationMatch[1]) : null;
    const currency: string | null = price?.currency ?? sessionCurrency ?? null;
    const unit: number | null = price?.unit_amount ?? sessionAmount ?? null;

    const periodEndUnix: number | null =
      item?.current_period_end ?? sub.current_period_end ?? null;
    const startUnix: number | null = sub.start_date ?? null;
    const startedAt = startUnix ? new Date(startUnix * 1000).toISOString() : null;
    const nextChargeAt = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

    const pm =
      sub.default_payment_method && typeof sub.default_payment_method !== "string"
        ? sub.default_payment_method
        : null;

    const schedule: { month: number; date: string }[] = [];
    if (startedAt && months && months > 0) {
      for (let i = 0; i < months; i++) {
        const d = new Date(startedAt);
        d.setMonth(d.getMonth() + i);
        schedule.push({ month: i + 1, date: d.toISOString().slice(0, 10) });
      }
    }

    const total = unit != null && months ? unit * months : null;
    const perCycleFormatted = money(unit, currency);
    const nextFormatted = longDate(nextChargeAt);
    const days = nextChargeAt
      ? Math.max(0, Math.ceil((new Date(nextChargeAt).getTime() - Date.now()) / 86400000))
      : null;

    const siteUrl = params.siteUrl ?? "https://consciousvoice.tecendosom.com";
    const membershipUrl = checkoutSessionId
      ? `${siteUrl}/membership?session_id=${encodeURIComponent(checkoutSessionId)}`
      : `${siteUrl}/membership`;

    const textParts = [
      product?.name ? `Plan: ${product.name}.` : null,
      perCycleFormatted ? `You are charged ${perCycleFormatted} every month.` : null,
      months ? `Your commitment runs for ${months} month${months === 1 ? "" : "s"}.` : null,
      nextFormatted
        ? `Your next charge is on ${nextFormatted}${days != null ? ` (in ${days} day${days === 1 ? "" : "s"})` : ""}.`
        : null,
      pm?.card?.last4 ? `Card on file ends in ${pm.card.last4}.` : null,
      "Billing stops automatically at the end of your commitment.",
    ].filter(Boolean);

    return {
      is_subscription: true,
      stripe_subscription_id: sub.id ?? null,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
      plan_name: product?.name ?? null,
      tier: tierFromLookupKey(lookupKey),
      price_lookup_key: lookupKey,
      interval: price?.recurring?.interval ?? null,
      duration_months: months,
      amount_per_cycle: unit != null ? unit / 100 : null,
      amount_per_cycle_formatted: perCycleFormatted,
      total_commitment: total != null ? total / 100 : null,
      total_commitment_formatted: money(total, currency),
      currency,
      subscription_status: sub.status ?? null,
      started_at: startedAt,
      started_at_formatted: longDate(startedAt),
      next_charge_at: nextChargeAt,
      next_charge_at_formatted: nextFormatted,
      days_until_next_charge: days,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      card_last4: pm?.card?.last4 ?? null,
      billing_schedule: schedule,
      membership_url: membershipUrl,
      billing_summary_text: textParts.join(" "),
    };
  } catch (e) {
    console.warn("[billing-summary] failed:", e);
    return null;
  }
}

/**
 * Recurring-subscription lifecycle persistence.
 *
 * `invoice.paid` is the CANONICAL event that creates or renews paid access.
 * `checkout.session.completed` only associates lead ⇄ customer ⇄ subscription
 * and must never independently grant access.
 */

import { GRACE_PERIOD_DAYS, durationMonthsFromLookupKey, tierFromLookupKey } from "@/lib/subscription-catalog";
import type { StripeEnv } from "@/lib/stripe.server";

export type AccessStatus =
  | "pending"
  | "active"
  | "past_due_grace"
  | "suspended"
  | "canceled"
  | "refund_review";

export type MemberSubscriptionRow = {
  id: string;
  lead_id: string | null;
  email: string | null;
  full_name: string | null;
  environment: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  price_lookup_key: string | null;
  tier: "live" | "complete" | null;
  duration_months: number | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  first_payment_failed_at: string | null;
  grace_expires_at: string | null;
  last_invoice_id: string | null;
  last_invoice_paid_at: string | null;
  access_status: AccessStatus;
  student_enrolled_at: string | null;
  paid_active_months: number;
  paid_invoice_count: number;
  processed_invoice_ids: string[];
  metadata: Record<string, unknown> | null;
};

const iso = (unix: unknown): string | null =>
  typeof unix === "number" && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readRow(
  subscriptionId: string,
  env: StripeEnv,
): Promise<MemberSubscriptionRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("member_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  if (error) throw new Error(`member_subscriptions read failed: ${error.message}`);
  return (data as MemberSubscriptionRow | null) ?? null;
}

async function writeRow(
  subscriptionId: string,
  env: StripeEnv,
  patch: Record<string, unknown>,
): Promise<MemberSubscriptionRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("member_subscriptions")
    .upsert(
      {
        stripe_subscription_id: subscriptionId,
        environment: env,
        ...patch,
      },
      { onConflict: "stripe_subscription_id,environment" },
    )
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[subscription-state] upsert failed:", error.message);
    throw error;
  }
  return (data as MemberSubscriptionRow | null) ?? null;
}

/** Shared fields derived from a Stripe Subscription object. */
export function subscriptionFacts(sub: any) {
  const item = sub?.items?.data?.[0] ?? null;
  const price = item?.price ?? null;
  const lookupKey: string | null = price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;
  return {
    stripe_customer_id:
      typeof sub?.customer === "string" ? sub.customer : (sub?.customer?.id ?? null),
    stripe_price_id: price?.id ?? null,
    price_lookup_key: lookupKey,
    tier: tierFromLookupKey(lookupKey),
    duration_months:
      durationMonthsFromLookupKey(lookupKey) ?? price?.recurring?.interval_count ?? null,
    status: sub?.status ?? null,
    current_period_start: iso(item?.current_period_start ?? sub?.current_period_start),
    current_period_end: iso(item?.current_period_end ?? sub?.current_period_end),
    cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
    canceled_at: iso(sub?.canceled_at),
  };
}

function stripNulls(o: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

/**
 * Associates lead/customer/subscription at checkout time. Never grants access:
 * `access_status` is only ever moved forward by `invoice.paid`.
 */
export async function associateCheckout(params: {
  env: StripeEnv;
  subscriptionId: string;
  customerId: string | null;
  leadId: string | null;
  email: string | null;
  fullName: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<MemberSubscriptionRow | null> {
  const existing = await readRow(params.subscriptionId, params.env);
  return writeRow(params.subscriptionId, params.env, {
    ...stripNulls({
      stripe_customer_id: params.customerId,
      lead_id: params.leadId,
      email: params.email,
      full_name: params.fullName,
      metadata: params.metadata ?? null,
    }),
    access_status: existing?.access_status ?? "pending",
  });
}

/** Refreshes stored subscription facts. Does not change access by itself. */
export async function syncSubscription(params: {
  env: StripeEnv;
  sub: any;
}): Promise<MemberSubscriptionRow | null> {
  const sub = params.sub;
  if (!sub?.id) return null;
  const facts = subscriptionFacts(sub);
  const existing = await readRow(sub.id, params.env);

  let access: AccessStatus = existing?.access_status ?? "pending";
  // Canceled/unpaid in Stripe: keep access until the paid period truly ends.
  if (sub.status === "canceled" || sub.status === "unpaid") {
    const periodEnd = facts.current_period_end ? new Date(facts.current_period_end).getTime() : 0;
    const graceEnd = existing?.grace_expires_at
      ? new Date(existing.grace_expires_at).getTime()
      : 0;
    const stillCovered = Date.now() < Math.max(periodEnd, graceEnd);
    access = stillCovered ? (access === "active" ? "active" : access) : "suspended";
    if (sub.status === "canceled" && !stillCovered) access = "canceled";
  } else if (sub.status === "paused") {
    access = "suspended";
  } else if (sub.status === "active" && existing?.access_status === "suspended") {
    // A resumed/repaired subscription only regains access on invoice.paid.
    access = "suspended";
  }

  return writeRow(sub.id, params.env, {
    ...facts,
    metadata: sub.metadata ?? existing?.metadata ?? null,
    lead_id: existing?.lead_id ?? (sub.metadata?.lead_id as string | undefined) ?? null,
    access_status: access,
  });
}

/**
 * CANONICAL paid-access event. Idempotent per invoice id.
 * - initial: access active, `student_enrolled_at` set once and never reset
 * - renewal: period extended, entitlements preserved, grace/failure cleared
 */
export async function applyInvoicePaid(params: {
  env: StripeEnv;
  invoice: any;
  sub: any | null;
}): Promise<{
  row: MemberSubscriptionRow | null;
  duplicate: boolean;
  isRenewal: boolean;
  recovered: boolean;
}> {
  const invoice = params.invoice;
  const subscriptionId: string | null =
    (typeof invoice?.subscription === "string" ? invoice.subscription : invoice?.subscription?.id) ??
    (typeof invoice?.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : null) ??
    params.sub?.id ??
    null;
  if (!subscriptionId) return { row: null, duplicate: false, isRenewal: false, recovered: false };

  const existing = await readRow(subscriptionId, params.env);
  const invoiceId: string | null = invoice?.id ?? null;
  const already =
    !!invoiceId && (existing?.processed_invoice_ids ?? []).includes(invoiceId);
  if (already) {
    // Replayed event: counters, enrollment date and notifications stay put.
    return {
      row: existing,
      duplicate: true,
      isRenewal: (existing?.paid_invoice_count ?? 0) > 1,
      recovered: false,
    };
  }

  const facts = params.sub ? subscriptionFacts(params.sub) : null;
  const paidAt =
    iso(invoice?.status_transitions?.paid_at) ?? iso(invoice?.created) ?? new Date().toISOString();
  const isRenewal = (existing?.paid_invoice_count ?? 0) > 0;
  // "Recovered" = we were in a failure/grace/suspended state and a payment landed.
  const recovered =
    isRenewal &&
    (!!existing?.first_payment_failed_at ||
      existing?.access_status === "past_due_grace" ||
      existing?.access_status === "suspended");
  const months = facts?.duration_months ?? existing?.duration_months ?? null;

  const row = await writeRow(subscriptionId, params.env, {
    ...(facts ? stripNulls(facts) : {}),
    cancel_at_period_end: facts?.cancel_at_period_end ?? existing?.cancel_at_period_end ?? false,
    last_invoice_id: invoiceId,
    last_invoice_paid_at: paidAt,
    first_payment_failed_at: null,
    grace_expires_at: null,
    access_status: "active",
    // Enrollment date is written once and is NEVER moved by a renewal.
    student_enrolled_at: existing?.student_enrolled_at ?? paidAt,
    paid_invoice_count: (existing?.paid_invoice_count ?? 0) + 1,
    // Certificate progress counts only paid active periods.
    paid_active_months: (existing?.paid_active_months ?? 0) + (months ?? 0),
    processed_invoice_ids: invoiceId
      ? [...(existing?.processed_invoice_ids ?? []), invoiceId]
      : (existing?.processed_invoice_ids ?? []),
    ...(existing?.lead_id ? {} : stripNulls({ lead_id: invoice?.metadata?.lead_id ?? null })),
  });

  return { row, duplicate: false, isRenewal, recovered };
}

function subscriptionIdOf(invoice: any, sub: any | null): string | null {
  return (
    (typeof invoice?.subscription === "string" ? invoice.subscription : invoice?.subscription?.id) ??
    (typeof invoice?.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : null) ??
    sub?.id ??
    null
  );
}

/**
 * Failure/authentication-required handling.
 *
 * The 7-calendar-day grace period exists ONLY for renewals, i.e. after at
 * least one invoice was successfully paid. If the FIRST invoice fails, no
 * access was ever granted: the row stays `pending` with no grace deadline.
 * Repeated renewal failures preserve the ORIGINAL failure timestamp/deadline.
 */
export async function applyInvoicePaymentFailed(params: {
  env: StripeEnv;
  invoice: any;
  sub: any | null;
}): Promise<{ row: MemberSubscriptionRow | null; isInitialFailure: boolean }> {
  const subscriptionId = subscriptionIdOf(params.invoice, params.sub);
  if (!subscriptionId) return { row: null, isInitialFailure: true };

  const existing = await readRow(subscriptionId, params.env);
  const facts = params.sub ? subscriptionFacts(params.sub) : null;
  const isInitialFailure =
    (existing?.paid_invoice_count ?? 0) === 0 || !existing?.student_enrolled_at;

  if (isInitialFailure) {
    // Never grant access, never open a grace window for an unpaid enrollment.
    const row = await writeRow(subscriptionId, params.env, {
      ...(facts ? stripNulls(facts) : {}),
      first_payment_failed_at: existing?.first_payment_failed_at ?? new Date().toISOString(),
      grace_expires_at: null,
      access_status:
        existing?.access_status === "canceled" ? "canceled" : ("pending" as AccessStatus),
    });
    return { row, isInitialFailure: true };
  }

  const failedAt = existing?.first_payment_failed_at ?? new Date().toISOString();
  const graceExpires =
    existing?.grace_expires_at ??
    new Date(new Date(failedAt).getTime() + GRACE_PERIOD_DAYS * 86400000).toISOString();
  const expired = Date.now() > new Date(graceExpires).getTime();

  const row = await writeRow(subscriptionId, params.env, {
    ...(facts ? stripNulls(facts) : {}),
    first_payment_failed_at: failedAt,
    grace_expires_at: graceExpires,
    access_status: expired ? "suspended" : "past_due_grace",
  });
  return { row, isInitialFailure: false };
}

/** 3DS / authentication required — same initial-vs-renewal distinction. */
export async function applyInvoiceActionRequired(params: {
  env: StripeEnv;
  invoice: any;
  sub: any | null;
}): Promise<{ row: MemberSubscriptionRow | null; isInitialFailure: boolean }> {
  return applyInvoicePaymentFailed(params);
}

/**
 * Pure access evaluation for a persisted row (no I/O).
 * `past_due_grace` only counts as access strictly BEFORE the deadline;
 * at or after `grace_expires_at` access evaluates as suspended.
 */
export function evaluateAccess(
  row: MemberSubscriptionRow | null,
  now: number = Date.now(),
): { active: boolean; effectiveStatus: AccessStatus | null; graceExpired: boolean } {
  if (!row) return { active: false, effectiveStatus: null, graceExpired: false };
  const graceExpired =
    row.access_status === "past_due_grace" &&
    !!row.grace_expires_at &&
    now >= new Date(row.grace_expires_at).getTime();
  if (graceExpired) return { active: false, effectiveStatus: "suspended", graceExpired: true };
  const active =
    row.access_status === "active" ||
    (row.access_status === "past_due_grace" && !graceExpired) ||
    (row.access_status === "refund_review" && !!row.student_enrolled_at);
  return { active, effectiveStatus: row.access_status, graceExpired: false };
}

/**
 * Server-side reconciliation: atomically flips an EXPIRED grace window to
 * `suspended`. Safe to call on every read and from a scheduler — the update
 * is conditional, so concurrent callers converge on the same result.
 */
export async function reconcileSubscriptionAccess(params: {
  env: StripeEnv;
  subscriptionId: string;
  row?: MemberSubscriptionRow | null;
}): Promise<MemberSubscriptionRow | null> {
  const row = params.row ?? (await readRow(params.subscriptionId, params.env));
  if (!row) return null;
  const { graceExpired } = evaluateAccess(row);
  if (!graceExpired) return row;

  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("member_subscriptions")
    .update({ access_status: "suspended", updated_at: nowIso })
    .eq("stripe_subscription_id", params.subscriptionId)
    .eq("environment", params.env)
    .eq("access_status", "past_due_grace")
    .lte("grace_expires_at", nowIso)
    .select("*")
    .maybeSingle();
  // Never synthesize a suspension the database did not accept.
  if (error) throw new Error(`reconcileSubscriptionAccess failed: ${error.message}`);
  // No row returned means a concurrent caller already suspended it; re-read.
  return (data as MemberSubscriptionRow | null) ?? (await readRow(params.subscriptionId, params.env));
}

/** Batch reconciliation used by the daily scheduler route. */
export async function reconcileExpiredGracePeriods(env: StripeEnv): Promise<{
  scanned: number;
  suspended: number;
  subscription_ids: string[];
}> {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data: candidates, error: scanError } = await db
    .from("member_subscriptions")
    .select("stripe_subscription_id")
    .eq("environment", env)
    .eq("access_status", "past_due_grace")
    .lte("grace_expires_at", nowIso);
  if (scanError) throw new Error(`reconcile scan failed: ${scanError.message}`);

  const ids = ((candidates as { stripe_subscription_id: string }[] | null) ?? []).map(
    (r) => r.stripe_subscription_id,
  );
  if (ids.length === 0) return { scanned: 0, suspended: 0, subscription_ids: [] };

  const { data: updated, error: updateError } = await db
    .from("member_subscriptions")
    .update({ access_status: "suspended", updated_at: nowIso })
    .eq("environment", env)
    .eq("access_status", "past_due_grace")
    .lte("grace_expires_at", nowIso)
    .select("stripe_subscription_id");
  if (updateError) throw new Error(`reconcile update failed: ${updateError.message}`);

  const done = ((updated as { stripe_subscription_id: string }[] | null) ?? []).map(
    (r) => r.stripe_subscription_id,
  );
  return { scanned: ids.length, suspended: done.length, subscription_ids: done };
}

/** Reads a lifecycle row (reconciled) for a subscription id. */
export async function getReconciledRow(
  env: StripeEnv,
  subscriptionId: string,
): Promise<MemberSubscriptionRow | null> {
  const row = await readRow(subscriptionId, env);
  if (!row) return null;
  return reconcileSubscriptionAccess({ env, subscriptionId, row });
}


/** Refunds require explicit human review; access is never silently revoked. */
export async function flagRefundReview(params: {
  env: StripeEnv;
  subscriptionId: string | null;
}): Promise<MemberSubscriptionRow | null> {
  if (!params.subscriptionId) return null;
  const existing = await readRow(params.subscriptionId, params.env);
  if (!existing) return null;
  return writeRow(params.subscriptionId, params.env, {
    metadata: { ...(existing.metadata ?? {}), refund_review_opened_at: new Date().toISOString() },
  });
}

/** Additive subscription fields for the Make/Taskade payload. */
export function subscriptionContractFields(row: MemberSubscriptionRow | null) {
  if (!row) {
    return {
      is_recurring_subscription: false,
      stripe_subscription_id: null,
      stripe_customer_id: null,
      subscription_status: null,
      billing_interval_months: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: null,
      scheduled_end_date: null,
      grace_expires_at: null,
      access_status: null,
      paid_active_months: null,
      certificate_active_months_required: 6,
      certificate_months_remaining: null,
    };
  }
  const required = 6;
  return {
    is_recurring_subscription: true,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_customer_id: row.stripe_customer_id,
    subscription_status: row.status,
    billing_interval_months: row.duration_months,
    current_period_start: row.current_period_start,
    current_period_end: row.current_period_end,
    cancel_at_period_end: row.cancel_at_period_end,
    scheduled_end_date: row.cancel_at_period_end ? row.current_period_end : null,
    grace_expires_at: row.grace_expires_at,
    access_status: row.access_status,
    paid_active_months: row.paid_active_months,
    certificate_active_months_required: required,
    certificate_months_remaining: Math.max(0, required - row.paid_active_months),
  };
}

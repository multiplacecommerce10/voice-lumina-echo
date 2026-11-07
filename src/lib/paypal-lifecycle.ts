/**
 * PayPal subscription lifecycle — PURE state machine (no I/O, injectable clock).
 *
 * Rules (authoritative course offer):
 * - The PayPal JS SDK `onApprove` NEVER grants access. Neither does
 *   BILLING.SUBSCRIPTION.ACTIVATED. Only a verified PAYMENT.SALE.COMPLETED,
 *   whose amount/currency/plan/beneficiary match the server allowlist and the
 *   server-side checkout intent, opens or renews access.
 * - Renewal extends the paid period; the enrollment date never moves and no
 *   new credentials are issued.
 * - Cancellation keeps access until the end of the paid period.
 * - A failed FIRST payment never grants access and opens no grace period.
 * - A failed RENEWAL keeps access for 7 days counted from the FIRST failure;
 *   repeated failures never extend that deadline. Afterwards access is
 *   suspended. A later successful payment restores access.
 * - Idempotent per event id AND per transaction id.
 */

import { GRACE_PERIOD_DAYS } from "@/lib/subscription-catalog";
import { findPayPalPlan, type PayPalEnv, type PayPalPlan } from "@/lib/paypal-plans";
import { isMembershipActive } from "@/lib/membership-access";

export const DAY_MS = 86_400_000;

export type PayPalAccessStatus =
  | "pending"
  | "active"
  | "past_due_grace"
  | "suspended"
  | "canceled";

export type PayPalSubState = {
  access_status: PayPalAccessStatus | string;
  status: string | null;
  tier: "live" | "complete" | null;
  duration_months: number | null;
  price_lookup_key: string | null;
  stripe_price_id: string | null; // holds the PayPal plan id for provider=paypal
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  first_payment_failed_at: string | null;
  grace_expires_at: string | null;
  student_enrolled_at: string | null;
  paid_invoice_count: number;
  paid_active_months: number;
  processed_invoice_ids: string[];
  processed_event_ids: string[];
  last_invoice_id: string | null;
  last_invoice_paid_at: string | null;
  lead_id: string | null;
  email: string | null;
  full_name: string | null;
  metadata: Record<string, unknown> | null;
  /** Contractual calendar anchor (PayPal subscription start_time). Periods = anchor + n·months. */
  period_anchor_at?: string | null;
  /** Durable notifications waiting to be copied into the outbox (written atomically with state). */
  pending_notifications?: PendingNotification[];
};

export type NotificationKind =
  | "welcome_and_access"
  | "renewal_receipt"
  | "payment_failed_initial"
  | "grace_notice"
  | "access_suspended_notice"
  | "cancellation_scheduled_notice"
  | "refund_review";

export type PendingNotification = { key: string; kind: NotificationKind };

export type NormalizedPayPalEvent = {
  eventId: string;
  eventType: string;
  subscriptionId: string | null;
  transactionId: string | null;
  amount: string | null;
  currency: string | null;
  /** PayPal create_time of the event (ISO). */
  occurredAt: string;
};

/** Subscription facts fetched from the PayPal API server-side (never from the browser). */
export type VerifiedSubscription = {
  id: string;
  planId: string;
  status: string;
  customId: string | null;
  /** PayPal start_time — the contractual billing anchor. */
  startTime?: string | null;
};

export type CheckoutIntent = {
  id: string;
  leadId: string;
  environment: PayPalEnv;
  planId: string;
  email: string | null;
  fullName: string | null;
  /** Subscription atomically bound to this intent server-side (first one wins). */
  boundSubscriptionId: string | null;
  /** Validated human admission decision copied from the lead at intent creation. */
  admissionApproved: boolean;
};

export type PayPalEffect =
  | "welcome_and_credentials"
  | "renewal_receipt"
  | "payment_failed_initial"
  | "grace_notice"
  | "access_suspended_notice"
  | "cancellation_scheduled_notice"
  | "refund_review"
  | "none";

export type ReduceResult = {
  next: PayPalSubState | null;
  effect: PayPalEffect;
  outcome: string;
  /** True when nothing must be persisted (duplicate or rejected). */
  noop: boolean;
};

export const PAYPAL_HANDLED_EVENTS = [
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.PENDING",
  "PAYMENT.SALE.DENIED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
] as const;

/** Extracts the fields we need from a raw PayPal webhook event. */
export function normalizePayPalEvent(raw: any): NormalizedPayPalEvent | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.event_type !== "string") return null;
  const r = raw.resource ?? {};
  const type: string = raw.event_type;
  const isSale = type.startsWith("PAYMENT.SALE.");
  const subscriptionId: string | null = isSale
    ? (typeof r.billing_agreement_id === "string" ? r.billing_agreement_id : null)
    : (typeof r.id === "string" ? r.id : null);
  // Refund/reversal resources reference the original sale.
  const transactionId: string | null = isSale
    ? type === "PAYMENT.SALE.REFUNDED" || type === "PAYMENT.SALE.REVERSED"
      ? (r.sale_id ?? r.id ?? null)
      : (r.id ?? null)
    : null;
  const amount = r.amount?.total ?? r.amount?.value ?? null;
  const currency = r.amount?.currency ?? r.amount?.currency_code ?? null;
  return {
    eventId: raw.id,
    eventType: type,
    subscriptionId,
    transactionId,
    amount: amount != null ? String(amount) : null,
    currency: currency != null ? String(currency) : null,
    occurredAt:
      typeof raw.create_time === "string" && !Number.isNaN(Date.parse(raw.create_time))
        ? new Date(raw.create_time).toISOString()
        : new Date(0).toISOString(),
  };
}

export function emptyState(intent: CheckoutIntent | null, plan: PayPalPlan | null): PayPalSubState {
  return {
    access_status: "pending",
    status: null,
    tier: plan?.tier ?? null,
    duration_months: plan?.durationMonths ?? null,
    price_lookup_key: plan?.lookupKey ?? null,
    stripe_price_id: plan?.planId ?? null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    first_payment_failed_at: null,
    grace_expires_at: null,
    student_enrolled_at: null,
    paid_invoice_count: 0,
    paid_active_months: 0,
    processed_invoice_ids: [],
    processed_event_ids: [],
    last_invoice_id: null,
    last_invoice_paid_at: null,
    lead_id: intent?.leadId ?? null,
    email: intent?.email?.toLowerCase() ?? null,
    full_name: intent?.fullName ?? null,
    metadata: intent ? { paypal_intent_id: intent.id } : null,
    period_anchor_at: null,
    pending_notifications: [],
  };
}

export function addMonthsUtc(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

/** Validates subscription ⇄ allowlist ⇄ server intent. Returns a reason when invalid. */
export function validateBinding(
  env: PayPalEnv,
  sub: VerifiedSubscription | null,
  intent: CheckoutIntent | null,
): { ok: true; plan: PayPalPlan } | { ok: false; reason: string } {
  if (!sub) return { ok: false, reason: "subscription_not_verified" };
  const plan = findPayPalPlan(env, sub.planId);
  if (!plan) return { ok: false, reason: "plan_not_allowlisted" };
  if (!intent) return { ok: false, reason: "intent_missing" };
  if (intent.environment !== env) return { ok: false, reason: "intent_environment_mismatch" };
  if (sub.customId !== intent.id) return { ok: false, reason: "beneficiary_mismatch" };
  if (intent.planId !== sub.planId) return { ok: false, reason: "intent_plan_mismatch" };
  if (intent.boundSubscriptionId !== sub.id) {
    return { ok: false, reason: intent.boundSubscriptionId ? "intent_bound_to_other_subscription" : "intent_not_bound" };
  }
  if (!intent.admissionApproved) return { ok: false, reason: "admission_not_approved" };
  return { ok: true, plan };
}

const EFFECT_KIND: Partial<Record<PayPalEffect, NotificationKind>> = {
  welcome_and_credentials: "welcome_and_access",
  renewal_receipt: "renewal_receipt",
  payment_failed_initial: "payment_failed_initial",
  grace_notice: "grace_notice",
  access_suspended_notice: "access_suspended_notice",
  cancellation_scheduled_notice: "cancellation_scheduled_notice",
  refund_review: "refund_review",
};

/** Deterministic dedupe key per business fact (not per delivery). */
export function notificationKey(subId: string, effect: PayPalEffect, s: PayPalSubState, ev?: NormalizedPayPalEvent): string {
  switch (effect) {
    case "welcome_and_credentials": return `${subId}:welcome`;
    case "renewal_receipt": return `${subId}:renewal:${s.last_invoice_id}`;
    case "payment_failed_initial": return `${subId}:initial_failed`;
    case "grace_notice": return `${subId}:grace:${s.first_payment_failed_at}`;
    case "access_suspended_notice": return `${subId}:suspended:${s.grace_expires_at}`;
    case "cancellation_scheduled_notice": return `${subId}:cancel:${s.canceled_at}`;
    case "refund_review": return `${subId}:refund:${ev?.transactionId ?? ev?.eventId}`;
    default: return `${subId}:none`;
  }
}

export function withNotification(s: PayPalSubState, subId: string, effect: PayPalEffect, ev?: NormalizedPayPalEvent): PayPalSubState {
  const kind = EFFECT_KIND[effect];
  if (!kind) return s;
  const key = notificationKey(subId, effect, s, ev);
  const list = s.pending_notifications ?? [];
  if (list.some((n) => n.key === key)) return s;
  return { ...s, pending_notifications: [...list, { key, kind }] };
}

function withEvent(s: PayPalSubState, ev: NormalizedPayPalEvent): PayPalSubState {
  return { ...s, processed_event_ids: [...s.processed_event_ids, ev.eventId].slice(-200) };
}

function reduceCore(input: {
  env: PayPalEnv;
  state: PayPalSubState | null;
  event: NormalizedPayPalEvent;
  sub: VerifiedSubscription | null;
  intent: CheckoutIntent | null;
  now: number;
}): ReduceResult {
  const { env, event: ev, now } = input;
  const reject = (outcome: string): ReduceResult => ({ next: input.state, effect: "none", outcome, noop: true });

  if (input.state?.processed_event_ids.includes(ev.eventId)) return reject("duplicate_event");

  const binding = validateBinding(env, input.sub, input.intent);
  if (!binding.ok) return reject(`rejected:${binding.reason}`);
  const plan = binding.plan;

  const base = input.state ?? emptyState(input.intent, plan);
  // A subscription can never switch plan silently (tier/duration changes need human review).
  if (base.stripe_price_id && base.stripe_price_id !== plan.planId) return reject("rejected:plan_changed");
  const s: PayPalSubState = { ...base, status: input.sub!.status ?? base.status };
  const nowIso = new Date(now).toISOString();
  const paidCount = s.paid_invoice_count;

  switch (ev.eventType) {
    case "BILLING.SUBSCRIPTION.CREATED":
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
      // Association only. Activation alone never grants enrollment.
      return { next: withEvent(s, ev), effect: "none", outcome: "associated", noop: false };

    case "PAYMENT.SALE.PENDING":
      return { next: withEvent(s, ev), effect: "none", outcome: "payment_pending", noop: false };

    case "PAYMENT.SALE.COMPLETED": {
      if (!ev.transactionId) return reject("rejected:missing_transaction");
      if (s.processed_invoice_ids.includes(ev.transactionId)) {
        return { next: withEvent(s, ev), effect: "none", outcome: "duplicate_transaction", noop: false };
      }
      if (ev.currency !== plan.currency) return reject("rejected:currency_mismatch");
      if (ev.amount === null || Number(ev.amount).toFixed(2) !== plan.amount) {
        return reject("rejected:amount_mismatch");
      }
      const isRenewal = paidCount > 0;
      const recovered =
        isRenewal &&
        (!!s.first_payment_failed_at || s.access_status === "past_due_grace" || s.access_status === "suspended");
      const paidAt = ev.occurredAt;
      // Calendar is anchored to the CONTRACT (PayPal start_time), never to
      // webhook delivery time: late payments gain no days, early ones lose none,
      // and month-end anchors clamp per period (Jan 31 → Feb 28 → Mar 31).
      const anchor = s.period_anchor_at ?? input.sub!.startTime ?? paidAt;
      const start = addMonthsUtc(anchor, plan.durationMonths * paidCount);
      const end = addMonthsUtc(anchor, plan.durationMonths * (paidCount + 1));
      const next: PayPalSubState = {
        ...s,
        access_status: "active",
        period_anchor_at: anchor,
        current_period_start: start,
        current_period_end: end,
        first_payment_failed_at: null,
        grace_expires_at: null,
        student_enrolled_at: s.student_enrolled_at ?? paidAt,
        paid_invoice_count: paidCount + 1,
        paid_active_months: s.paid_active_months + plan.durationMonths,
        processed_invoice_ids: [...s.processed_invoice_ids, ev.transactionId],
        last_invoice_id: ev.transactionId,
        last_invoice_paid_at: paidAt,
      };
      return {
        next: withEvent(next, ev),
        effect: isRenewal ? "renewal_receipt" : "welcome_and_credentials",
        outcome: isRenewal ? (recovered ? "renewal_recovered" : "renewal_paid") : "initial_paid",
        noop: false,
      };
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED": {
      // Order by occurrence, not delivery: a failure that happened before the
      // latest successful payment (or before the current paid period began)
      // is stale and must never reopen grace or suspend retroactively.
      const occ = Date.parse(ev.occurredAt);
      if (
        paidCount > 0 &&
        ((s.last_invoice_paid_at && occ <= Date.parse(s.last_invoice_paid_at)) ||
          (s.current_period_start && occ < Date.parse(s.current_period_start)))
      ) {
        return { next: withEvent(s, ev), effect: "none", outcome: "stale_failure_ignored", noop: false };
      }
      if (paidCount === 0) {
        const first = !s.first_payment_failed_at;
        return {
          next: withEvent(
            {
              ...s,
              access_status: s.access_status === "canceled" ? "canceled" : "pending",
              first_payment_failed_at: s.first_payment_failed_at ?? ev.occurredAt,
              grace_expires_at: null,
            },
            ev,
          ),
          effect: first ? "payment_failed_initial" : "none",
          outcome: "initial_failure_no_access",
          noop: false,
        };
      }
      if (s.access_status === "canceled") {
        return { next: withEvent(s, ev), effect: "none", outcome: "failure_after_cancel", noop: false };
      }
      const firstFailure = !s.first_payment_failed_at;
      const failedAt = s.first_payment_failed_at ?? ev.occurredAt;
      const grace =
        s.grace_expires_at ?? new Date(Date.parse(failedAt) + GRACE_PERIOD_DAYS * DAY_MS).toISOString();
      const expired = now >= Date.parse(grace);
      const nextStatus = expired ? "suspended" : "past_due_grace";
      const wasSuspended = s.access_status === "suspended";
      return {
        next: withEvent(
          { ...s, first_payment_failed_at: failedAt, grace_expires_at: grace, access_status: nextStatus },
          ev,
        ),
        effect: expired ? (wasSuspended ? "none" : "access_suspended_notice") : firstFailure ? "grace_notice" : "none",
        outcome: expired ? "renewal_failed_suspended" : "renewal_failed_grace",
        noop: false,
      };
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const periodEnd = s.current_period_end ? Date.parse(s.current_period_end) : 0;
      const covered = paidCount > 0 && now < periodEnd && s.access_status !== "suspended";
      const wasActive = s.access_status === "active" || s.access_status === "past_due_grace";
      return {
        next: withEvent(
          {
            ...s,
            cancel_at_period_end: true,
            canceled_at: s.canceled_at ?? ev.occurredAt ?? nowIso,
            access_status: covered ? s.access_status : paidCount > 0 ? "canceled" : "canceled",
          },
          ev,
        ),
        effect: covered && wasActive ? "cancellation_scheduled_notice" : "none",
        outcome: covered ? "cancellation_scheduled" : "canceled",
        noop: false,
      };
    }

    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.SALE.REVERSED":
      // Never auto-revoke: a human reviews refunds.
      return {
        next: withEvent(
          { ...s, metadata: { ...(s.metadata ?? {}), refund_review_opened_at: nowIso, refund_event: ev.eventType } },
          ev,
        ),
        effect: "refund_review",
        outcome: "refund_review",
        noop: false,
      };

    default:
      return { next: withEvent(s, ev), effect: "none", outcome: "ignored_event_type", noop: false };
  }
}

/**
 * Time-based reconciliation for PayPal rows (pure). PayPal does not send a
 * "period ended" event, so the scheduler applies:
 * - grace deadline passed → suspended
 * - cancellation scheduled and paid period over → canceled
 * - paid period over with no renewal payment → grace from period end (7 days)
 */
export function reconcilePayPalState(
  s: PayPalSubState,
  now: number,
  subId = "sub",
): { next: PayPalSubState; changed: boolean; effect: PayPalEffect } {
  const r = reconcileCore(s, now);
  return r.changed ? { ...r, next: withNotification(r.next, subId, r.effect) } : r;
}

function reconcileCore(
  s: PayPalSubState,
  now: number,
): { next: PayPalSubState; changed: boolean; effect: PayPalEffect } {
  const end = s.current_period_end ? Date.parse(s.current_period_end) : null;
  if (s.access_status === "past_due_grace" && s.grace_expires_at && now >= Date.parse(s.grace_expires_at)) {
    return { next: { ...s, access_status: "suspended" }, changed: true, effect: "access_suspended_notice" };
  }
  if (s.access_status === "active" && end !== null && now >= end) {
    if (s.cancel_at_period_end) {
      return { next: { ...s, access_status: "canceled" }, changed: true, effect: "none" };
    }
    const failedAt = s.first_payment_failed_at ?? new Date(end).toISOString();
    const grace = s.grace_expires_at ?? new Date(Date.parse(failedAt) + GRACE_PERIOD_DAYS * DAY_MS).toISOString();
    const expired = now >= Date.parse(grace);
    return {
      next: {
        ...s,
        first_payment_failed_at: failedAt,
        grace_expires_at: grace,
        access_status: expired ? "suspended" : "past_due_grace",
      },
      changed: true,
      effect: expired ? "access_suspended_notice" : "grace_notice",
    };
  }
  return { next: s, changed: false, effect: "none" };
}

/** Pure access check shared by tests (mirrors has_active_membership()). */
export function paypalHasAccess(s: PayPalSubState | null, now: number, env: PayPalEnv = "live"): boolean {
  if (!s) return false;
  return isMembershipActive({ ...s, environment: env, courtesy_access: false }, now);
}

export function reducePayPalEvent(input: {
  env: PayPalEnv;
  state: PayPalSubState | null;
  event: NormalizedPayPalEvent;
  sub: VerifiedSubscription | null;
  intent: CheckoutIntent | null;
  now: number;
}): ReduceResult {
  const r = reduceCore(input);
  if (r.noop || !r.next || r.effect === "none" || !input.event.subscriptionId) return r;
  return { ...r, next: withNotification(r.next, input.event.subscriptionId, r.effect, input.event) };
}

// ---------------------------------------------------------------------------
// Optimistic-concurrency application (repository injected; used by server + tests)
// ---------------------------------------------------------------------------

export interface PayPalStateRepo {
  load(subscriptionId: string): Promise<{ state: PayPalSubState; version: number } | null>;
  /** Insert when expectedVersion === null; otherwise update iff version matches. */
  save(subscriptionId: string, expectedVersion: number | null, next: PayPalSubState): Promise<boolean>;
}

export async function applyPayPalEvent(params: {
  repo: PayPalStateRepo;
  env: PayPalEnv;
  event: NormalizedPayPalEvent;
  sub: VerifiedSubscription | null;
  intent: CheckoutIntent | null;
  now: () => number;
  maxAttempts?: number;
}): Promise<ReduceResult> {
  const subId = params.event.subscriptionId;
  if (!subId) return { next: null, effect: "none", outcome: "rejected:missing_subscription", noop: true };
  const attempts = params.maxAttempts ?? 25;
  for (let i = 0; i < attempts; i++) {
    const loaded = await params.repo.load(subId);
    const result = reducePayPalEvent({
      env: params.env,
      state: loaded?.state ?? null,
      event: params.event,
      sub: params.sub,
      intent: params.intent,
      now: params.now(),
    });
    if (result.noop || !result.next) return result;
    const ok = await params.repo.save(subId, loaded ? loaded.version : null, result.next);
    if (ok) return result;
  }
  throw new Error("paypal state: concurrent update retries exhausted");
}

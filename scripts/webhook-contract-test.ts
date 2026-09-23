/**
 * Contract tests for the Stripe -> Make/Taskade webhook payload.
 *
 * Run: bun run scripts/webhook-contract-test.ts
 *
 * Verifies, without touching Stripe or the network:
 *  1. Each Stripe event produces the exact fulfillment-gate fields
 *     (fulfillment_ready, payment_lifecycle_status, stripe_payment_status,
 *     is_pending_delayed_payment, payment_lifecycle_reason, extra.email_kind).
 *  2. Assembled payloads satisfy the Make/Taskade contract validator.
 *  3. The live webhook route still emits the contract fields (source check).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyPaymentLifecycle,
  buildLifecycleContractFields,
  buildLifecycleExtraFields,
  type EmailKind,
  type PaymentLifecycleStatus,
} from "../src/lib/payment-lifecycle";
import {
  validateWebhookPayload,
  REQUIRED_TOP_LEVEL_FIELDS,
  REQUIRED_EXTRA_FIELDS,
  REQUIRED_SUBSCRIPTION_EXTRA_FIELDS,
} from "../src/lib/webhook-contract";
import type { LifecycleContext } from "../src/lib/payment-lifecycle";
import {
  RECURRING_PRICE_KEYS,
  SUBSCRIPTION_CATALOG,
  GRACE_PERIOD_DAYS,
  durationMonthsFromLookupKey,
  tierFromLookupKey,
} from "../src/lib/subscription-catalog";
import { resolveEntitlements } from "../src/lib/entitlements";
import { evaluateAccess } from "../src/lib/subscription-state.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

/** Mirrors the shape the webhook route builds, minus irrelevant lead fields. */
function buildPayload(
  eventType: string,
  obj: Record<string, unknown>,
  ctx: LifecycleContext = {},
  subFields: Record<string, unknown> = {},
) {
  const lifecycle = classifyPaymentLifecycle(eventType, obj, ctx);
  return {
    event: eventType,
    environment: "sandbox",
    ...buildLifecycleContractFields(lifecycle),
    lead_id: "lead_123",
    email: "student@example.com",
    full_name: "Test Student",
    plan: "live_pkg_3",
    amount_total: 29700,
    currency: "usd",
    stripe_session_id: "cs_test_123",
    stripe_event_id: "evt_test_123",
    extra: {
      ...buildLifecycleExtraFields(lifecycle),
      language: "en",
      // Additive subscription contract (always present, null when N/A).
      is_recurring_subscription: false,
      subscription_status: null,
      billing_interval_months: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: null,
      grace_expires_at: null,
      access_status: ctx.accessStatus ?? null,
      entitlements: null,
      replay_access_from: null,
      paid_active_months: null,
      certificate_active_months_required: 6,
      certificate_months_remaining: null,
      ...subFields,
    },
  };
}

interface Scenario {
  name: string;
  event: string;
  obj: Record<string, unknown>;
  ctx?: LifecycleContext;
  fulfillment_ready: boolean;
  status: PaymentLifecycleStatus;
  stripe_payment_status: string | null;
  pending: boolean;
  email_kind: EmailKind;
}

const scenarios: Scenario[] = [
  {
    name: "completed + paid (card)",
    event: "checkout.session.completed",
    obj: { payment_status: "paid", status: "complete" },
    fulfillment_ready: true,
    status: "paid",
    stripe_payment_status: "paid",
    pending: false,
    email_kind: "welcome_access",
  },
  {
    name: "completed + no_payment_required (100% coupon)",
    event: "checkout.session.completed",
    obj: { payment_status: "no_payment_required", status: "complete" },
    fulfillment_ready: true,
    status: "paid",
    stripe_payment_status: "no_payment_required",
    pending: false,
    email_kind: "welcome_access",
  },
  {
    name: "completed + unpaid (SEPA/boleto pending)",
    event: "checkout.session.completed",
    obj: { payment_status: "unpaid", status: "complete" },
    fulfillment_ready: false,
    status: "pending_payment",
    stripe_payment_status: "unpaid",
    pending: true,
    email_kind: "payment_pending_notice",
  },
  {
    name: "async_payment_succeeded",
    event: "checkout.session.async_payment_succeeded",
    obj: { payment_status: "paid", status: "complete" },
    fulfillment_ready: true,
    status: "paid",
    stripe_payment_status: "paid",
    pending: false,
    email_kind: "welcome_access",
  },
  {
    name: "async_payment_failed",
    event: "checkout.session.async_payment_failed",
    obj: { payment_status: "unpaid", status: "complete" },
    fulfillment_ready: false,
    status: "failed",
    stripe_payment_status: "unpaid",
    pending: false,
    email_kind: "payment_failed_recovery",
  },
  {
    name: "session expired",
    event: "checkout.session.expired",
    obj: { payment_status: "unpaid", status: "expired" },
    fulfillment_ready: false,
    status: "expired",
    stripe_payment_status: "unpaid",
    pending: false,
    email_kind: "checkout_expired_recovery",
  },
  {
    name: "payment_intent.payment_failed",
    event: "payment_intent.payment_failed",
    obj: {},
    fulfillment_ready: false,
    status: "failed",
    stripe_payment_status: null,
    pending: false,
    email_kind: "payment_failed_recovery",
  },
  {
    name: "subscription created (association only)",
    event: "customer.subscription.created",
    obj: { status: "active" },
    fulfillment_ready: false,
    status: "subscription_lifecycle",
    stripe_payment_status: null,
    pending: false,
    email_kind: "no_email",
  },
  {
    name: "invoice.paid — initial payment grants access",
    event: "invoice.paid",
    obj: { status: "paid" },
    ctx: { isRenewal: false, accessStatus: "active" },
    fulfillment_ready: true,
    status: "paid",
    stripe_payment_status: "paid",
    pending: false,
    email_kind: "welcome_access",
  },
  {
    name: "invoice.paid — renewal keeps access, no new credentials",
    event: "invoice.paid",
    obj: { status: "paid" },
    ctx: { isRenewal: true, accessStatus: "active" },
    fulfillment_ready: true,
    status: "paid_renewal",
    stripe_payment_status: "paid",
    pending: false,
    email_kind: "renewal_confirmation",
  },
  {
    name: "invoice.paid — recovery inside grace restores access",
    event: "invoice.paid",
    obj: { status: "paid" },
    ctx: { isRenewal: true, recovered: true, accessStatus: "active" },
    fulfillment_ready: true,
    status: "paid_renewal",
    stripe_payment_status: "paid",
    pending: false,
    email_kind: "renewal_confirmation",
  },
  {
    name: "invoice.payment_failed — 7-day grace, access preserved",
    event: "invoice.payment_failed",
    obj: {},
    ctx: { accessStatus: "past_due_grace" },
    fulfillment_ready: false,
    status: "past_due_grace",
    stripe_payment_status: null,
    pending: false,
    email_kind: "payment_recovery_grace",
  },
  {
    name: "invoice.payment_failed after grace — suspend access",
    event: "invoice.payment_failed",
    obj: {},
    ctx: { accessStatus: "suspended" },
    fulfillment_ready: false,
    status: "access_suspended",
    stripe_payment_status: null,
    pending: false,
    email_kind: "access_suspended_notice",
  },
  {
    name: "invoice.payment_action_required — access preserved",
    event: "invoice.payment_action_required",
    obj: {},
    ctx: { accessStatus: "past_due_grace" },
    fulfillment_ready: false,
    status: "past_due_grace",
    stripe_payment_status: null,
    pending: true,
    email_kind: "payment_recovery_grace",
  },
  {
    name: "cancel at period end — access until scheduled end",
    event: "customer.subscription.updated",
    obj: { status: "active", cancel_at_period_end: true },
    ctx: { accessStatus: "active", cancelAtPeriodEnd: true },
    fulfillment_ready: false,
    status: "cancellation_scheduled",
    stripe_payment_status: null,
    pending: false,
    email_kind: "cancellation_scheduled_notice",
  },
  {
    name: "subscription deleted while period still paid",
    event: "customer.subscription.deleted",
    obj: { status: "canceled" },
    ctx: { accessStatus: "active" },
    fulfillment_ready: false,
    status: "cancellation_scheduled",
    stripe_payment_status: null,
    pending: false,
    email_kind: "cancellation_scheduled_notice",
  },
  {
    name: "subscription deleted after paid period — suspend",
    event: "customer.subscription.deleted",
    obj: { status: "canceled" },
    ctx: { accessStatus: "canceled" },
    fulfillment_ready: false,
    status: "access_suspended",
    stripe_payment_status: null,
    pending: false,
    email_kind: "access_suspended_notice",
  },
  {
    name: "charge.refunded — human review, never auto-revoke",
    event: "charge.refunded",
    obj: {},
    ctx: { accessStatus: "active" },
    fulfillment_ready: false,
    status: "refund_review",
    stripe_payment_status: null,
    pending: false,
    email_kind: "refund_review_notice",
  },
  {
    name: "unknown event is inert",
    event: "customer.discount.created",
    obj: {},
    fulfillment_ready: false,
    status: "unknown",
    stripe_payment_status: null,
    pending: false,
    email_kind: "no_email",
  },
];

console.log("=== Field-level contract per event ===");
for (const s of scenarios) {
  const p = buildPayload(s.event, s.obj, s.ctx ?? {}) as Record<string, any>;
  const ok =
    p.fulfillment_ready === s.fulfillment_ready &&
    p.payment_lifecycle_status === s.status &&
    p.stripe_payment_status === s.stripe_payment_status &&
    p.is_pending_delayed_payment === s.pending &&
    typeof p.payment_lifecycle_reason === "string" &&
    p.extra.email_kind === s.email_kind;
  check(
    s.name,
    ok,
    `got ready=${p.fulfillment_ready} status=${p.payment_lifecycle_status} stripe=${String(p.stripe_payment_status)} pending=${p.is_pending_delayed_payment} email_kind=${p.extra.email_kind}`,
  );
}

console.log("\n=== Payload validates against the Make/Taskade contract ===");
for (const s of scenarios) {
  const errors = validateWebhookPayload(buildPayload(s.event, s.obj, s.ctx ?? {}));
  check(`contract valid: ${s.name}`, errors.length === 0, errors.join("; "));
}

console.log("\n=== Validator rejects contract violations ===");
const paid = buildPayload("checkout.session.completed", { payment_status: "paid" }) as Record<string, any>;
const renamed = { ...paid } as Record<string, any>;
delete renamed.fulfillment_ready;
check("missing fulfillment_ready is rejected", validateWebhookPayload(renamed).length > 0);

const lying = JSON.parse(JSON.stringify(paid));
lying.fulfillment_ready = true;
lying.payment_lifecycle_status = "pending_payment";
lying.extra.payment_lifecycle_status = "pending_payment";
check("ready=true with pending status is rejected", validateWebhookPayload(lying).length > 0);

const desynced = JSON.parse(JSON.stringify(paid));
desynced.extra.fulfillment_ready = false;
check("desynced extra mirror is rejected", validateWebhookPayload(desynced).length > 0);

const wrongEmail = JSON.parse(
  JSON.stringify(buildPayload("checkout.session.expired", { payment_status: "unpaid" })),
);
wrongEmail.extra.email_kind = "welcome_access";
check(
  "welcome_access on a non-fulfilled event is rejected",
  validateWebhookPayload(wrongEmail).length > 0,
);

const badStatus = JSON.parse(JSON.stringify(paid));
badStatus.payment_lifecycle_status = "settled";
badStatus.extra.payment_lifecycle_status = "settled";
check("unknown status value is rejected", validateWebhookPayload(badStatus).length > 0);

console.log("\n=== Live webhook route emits the contract ===");
const routeSrc = readFileSync(
  resolve(import.meta.dirname, "../src/routes/api/public/payments/webhook.ts"),
  "utf8",
);
check(
  "route spreads buildLifecycleContractFields()",
  routeSrc.includes("...buildLifecycleContractFields(lifecycle)"),
);
check(
  "route spreads buildLifecycleExtraFields() into extra",
  routeSrc.includes("...buildLifecycleExtraFields(lifecycle)"),
);
for (const key of REQUIRED_TOP_LEVEL_FIELDS) {
  // Gate fields come from the spread helper; the rest must be literal keys.
  const fromHelper = [
    "fulfillment_ready",
    "payment_lifecycle_status",
    "is_pending_delayed_payment",
    "stripe_payment_status",
    "payment_lifecycle_reason",
  ].includes(key);
  if (fromHelper) continue;
  check(`route emits top-level "${key}"`, new RegExp(`\\n\\s*${key}:`).test(routeSrc));
}
check(
  `helper covers all extra gate fields (${REQUIRED_EXTRA_FIELDS.length})`,
  REQUIRED_EXTRA_FIELDS.every(
    (k) => k in buildLifecycleExtraFields(classifyPaymentLifecycle("checkout.session.completed", { payment_status: "paid" })),
  ),
);

console.log("\n=== Recurring catalog (6 prices, 1/3/6 months, no 12-month) ===");
check("exactly six recurring prices are offered", RECURRING_PRICE_KEYS.length === 6);
const expectedCatalog: [string, number, number][] = [
  ["live_sub_1m_v1", 1, 147.0],
  ["live_sub_3m_v1", 3, 418.95],
  ["live_sub_6m_v1", 6, 793.8],
  ["complete_sub_1m_v1", 1, 197.0],
  ["complete_sub_3m_v1", 3, 561.45],
  ["complete_sub_6m_v1", 6, 1063.8],
];
for (const [key, months, amount] of expectedCatalog) {
  const tier = tierFromLookupKey(key)!;
  const entry = (SUBSCRIPTION_CATALOG as any)[tier][months];
  check(
    `catalog ${key} = US$${amount} every ${months} month(s)`,
    entry.lookupKey === key && entry.amountUsd === amount && entry.durationMonths === months,
  );
}
check(
  "no 12-month recurring price is offered",
  !RECURRING_PRICE_KEYS.some((k) => durationMonthsFromLookupKey(k) === 12),
);
check("grace period is 7 calendar days", GRACE_PERIOD_DAYS === 7);

console.log("\n=== Entitlements survive renewal ===");
const enrolled = "2026-09-05T10:00:00.000Z";
const completeInitial = resolveEntitlements("complete", enrolled);
const completeRenewal = resolveEntitlements("complete", enrolled);
check(
  "Complete replay date is preserved across renewals",
  completeInitial.replay_access_from === enrolled &&
    completeRenewal.replay_access_from === enrolled,
);
check("Complete tier has replay access", completeInitial.replay_access === true);
const live = resolveEntitlements("live", enrolled);
check(
  "Live tier never gets replays",
  live.replay_access === false && live.replay_access_from === null,
);

console.log("\n=== Subscription fields are on every payload ===");
for (const s2 of scenarios) {
  const p2 = buildPayload(s2.event, s2.obj, s2.ctx ?? {}) as Record<string, any>;
  check(
    `subscription fields present: ${s2.name}`,
    REQUIRED_SUBSCRIPTION_EXTRA_FIELDS.every((k) => k in p2.extra),
  );
}

console.log("\n=== Wise / manual transfer stays non-recurring ===");
const pricingSrc = readFileSync(
  resolve(import.meta.dirname, "../src/components/PricingPlans.tsx"),
  "utf8",
);
check(
  "Wise path is labeled as a non-renewing manual transfer",
  /manual transfer|does not renew|no automatic renewal/i.test(pricingSrc),
);
check(
  "Stripe path advertises automatic renewal",
  /renews automatically|automatically renews/i.test(pricingSrc),
);
check(
  "pricing uses the recurring lookup keys",
  RECURRING_PRICE_KEYS.every((k) => pricingSrc.includes(k)),
);

console.log("\n=== invoice.paid is the canonical access event ===");
const webhookSrc = readFileSync(
  resolve(import.meta.dirname, "../src/routes/api/public/payments/webhook.ts"),
  "utf8",
);
check("route processes subscription events before classifying", webhookSrc.includes("processSubscriptionEvent"));
check("route short-circuits duplicate invoice deliveries", webhookSrc.includes("subEvent.duplicate"));
check("route forwards invoice.paid", webhookSrc.includes('"invoice.paid"'));
const stateSrc = readFileSync(
  resolve(import.meta.dirname, "../src/lib/subscription-state.server.ts"),
  "utf8",
);
check(
  "student_enrolled_at is never reset by a renewal",
  stateSrc.includes("student_enrolled_at: existing?.student_enrolled_at ?? paidAt"),
);
check(
  "duplicate invoices are ignored by id",
  stateSrc.includes("processed_invoice_ids"),
);

const paymentsSrc = readFileSync(
  resolve(import.meta.dirname, "../src/lib/payments.functions.ts"),
  "utf8",
);
const subWebhookSrc = readFileSync(
  resolve(import.meta.dirname, "../src/lib/subscription-webhook.server.ts"),
  "utf8",
);
const reconcileSrc = readFileSync(
  resolve(import.meta.dirname, "../src/routes/api/public/payments/reconcile-access.ts"),
  "utf8",
);

console.log("\n=== Phase 2: subscription lifecycle gating ===");

const subCheckout = { mode: "subscription", payment_status: "paid" };
const lcSubCheckout = classifyPaymentLifecycle("checkout.session.completed", subCheckout, {
  isSubscriptionCheckout: true,
});
check(
  "a. subscription checkout paid => no fulfillment, no welcome",
  lcSubCheckout.fulfillment_ready === false &&
    lcSubCheckout.payment_lifecycle_status === "awaiting_invoice_paid" &&
    buildLifecycleExtraFields(lcSubCheckout).email_kind === "no_email",
);
const lcSubAsync = classifyPaymentLifecycle(
  "checkout.session.async_payment_succeeded",
  subCheckout,
  { isSubscriptionCheckout: true },
);
check(
  "a2. subscription async payment succeeded => still no welcome",
  lcSubAsync.fulfillment_ready === false &&
    buildLifecycleExtraFields(lcSubAsync).email_kind === "no_email",
);

const lcOneTime = classifyPaymentLifecycle("checkout.session.completed", {
  mode: "payment",
  payment_status: "paid",
});
check(
  "b. legacy one-time checkout paid => fulfillment + welcome",
  lcOneTime.fulfillment_ready === true &&
    lcOneTime.payment_lifecycle_status === "paid" &&
    buildLifecycleExtraFields(lcOneTime).email_kind === "welcome_access",
);

const lcInitialFail = classifyPaymentLifecycle("invoice.payment_failed", {}, {
  isInitialFailure: true,
  accessStatus: "pending",
});
const lcInitialAction = classifyPaymentLifecycle("invoice.payment_action_required", {}, {
  isInitialFailure: true,
  accessStatus: "pending",
});
check(
  "c. initial invoice failure => failed, no grace, no access",
  lcInitialFail.fulfillment_ready === false &&
    lcInitialFail.payment_lifecycle_status === "failed" &&
    lcInitialAction.payment_lifecycle_status === "failed",
);

const lcRenewalFail = classifyPaymentLifecycle("invoice.payment_failed", {}, {
  isInitialFailure: false,
  accessStatus: "past_due_grace",
});
check(
  "d. renewal failure => 7-day grace with access preserved",
  lcRenewalFail.payment_lifecycle_status === "past_due_grace" &&
    GRACE_PERIOD_DAYS === 7 &&
    buildLifecycleExtraFields(lcRenewalFail).email_kind === "payment_recovery_grace",
);

const nowMs = Date.now();
const baseRow = {
  id: "row_1",
  lead_id: null,
  email: null,
  full_name: null,
  environment: "sandbox",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  stripe_price_id: "price_1",
  price_lookup_key: "complete_sub_3m_v1",
  tier: "complete" as const,
  duration_months: 3,
  status: "past_due",
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  canceled_at: null,
  first_payment_failed_at: new Date(nowMs - 8 * 86400000).toISOString(),
  grace_expires_at: new Date(nowMs - 86400000).toISOString(),
  last_invoice_id: "in_2",
  last_invoice_paid_at: null,
  access_status: "past_due_grace" as const,
  student_enrolled_at: new Date(nowMs - 90 * 86400000).toISOString(),
  paid_active_months: 3,
  paid_invoice_count: 1,
  processed_invoice_ids: ["in_1"],
  metadata: null,
};

const expiredEval = evaluateAccess(baseRow, nowMs);
check(
  "e. grace expiry => suspended even while Stripe still says past_due",
  expiredEval.active === false &&
    expiredEval.graceExpired === true &&
    expiredEval.effectiveStatus === "suspended",
);
const insideGrace = evaluateAccess(
  { ...baseRow, grace_expires_at: new Date(nowMs + 86400000).toISOString() },
  nowMs,
);
check("e2. inside grace => access preserved", insideGrace.active === true);
check(
  "e3. pending / suspended / canceled never grant access",
  ["pending", "suspended", "canceled"].every(
    (st) => evaluateAccess({ ...baseRow, access_status: st as any }, nowMs).active === false,
  ) && evaluateAccess({ ...baseRow, access_status: "active" }, nowMs).active === true,
);

const lcRecovered = classifyPaymentLifecycle("invoice.paid", {}, {
  isRenewal: true,
  recovered: true,
  accessStatus: "active",
});
check(
  "f. recovery => paid_renewal, renewal receipt, no new credentials",
  lcRecovered.fulfillment_ready === true &&
    lcRecovered.payment_lifecycle_status === "paid_renewal" &&
    buildLifecycleExtraFields(lcRecovered).email_kind === "renewal_confirmation" &&
    /recovered/.test(lcRecovered.reason),
);
check(
  "f2. invoice.paid preserves the original enrollment date and clears grace",
  stateSrc.includes("student_enrolled_at: existing?.student_enrolled_at ?? paidAt") &&
    stateSrc.includes("grace_expires_at: null"),
);

check(
  "g. duplicate invoice => early return before any counter update",
  /if \(already\) \{[\s\S]*?duplicate: true/.test(stateSrc) &&
    webhookSrc.includes("duplicate: true"),
);

const lcCancelScheduled = classifyPaymentLifecycle(
  "customer.subscription.updated",
  { status: "active", cancel_at_period_end: true },
  { cancelAtPeriodEnd: true, accessStatus: "active" },
);
check(
  "h. cancel_at_period_end => access kept until the period end",
  lcCancelScheduled.payment_lifecycle_status === "cancellation_scheduled" &&
    /until/i.test(buildLifecycleExtraFields(lcCancelScheduled).fulfillment_instruction),
);

const enrolledAt2 = new Date(nowMs - 30 * 86400000).toISOString();
const complete2 = resolveEntitlements("complete", enrolledAt2);
const live2 = resolveEntitlements("live", enrolledAt2);
check(
  "i. Complete replay date preserved; Live replay false",
  complete2.replay_access === true &&
    complete2.replay_access_from === enrolledAt2 &&
    live2.replay_access === false,
);

console.log("\n=== Phase 2: source guarantees ===");
check(
  "core lifecycle persistence runs outside the notification try/catch",
  webhookSrc.indexOf("const subEvent = await processSubscriptionEvent") <
    webhookSrc.indexOf("// Only optional downstream forwarding"),
);
check(
  "subscription-webhook no longer swallows core errors",
  !readFileSync(
    resolve(import.meta.dirname, "../src/lib/subscription-webhook.server.ts"),
    "utf8",
  ).includes("[subscription-webhook] processing failed"),
);
check(
  "portal reuses a managed configuration instead of creating one per click",
  paymentsSrc.includes("lovable_managed") &&
    paymentsSrc.includes("billingPortal.configurations.list"),
);
check(
  "portal rejects non-subscription checkout sessions",
  paymentsSrc.includes('session.mode !== "subscription"'),
);
check(
  "membership summary is driven by the persisted access row",
  paymentsSrc.includes("getReconciledRow") && paymentsSrc.includes("evaluateAccess"),
);
check(
  "reconciliation route is bearer-protected",
  reconcileSrc.includes("PAYMENTS_RECONCILE_SECRET") && reconcileSrc.includes("401"),
);

console.log("\n=== Phase 2.1: fail-closed access hardening ===");
check(
  "no Stripe-status fallback grants access before a persisted row",
  !paymentsSrc.includes('(sub?.status === "active" || sub?.status === "trialing")'),
);
check(
  "access is false when no lifecycle row exists",
  paymentsSrc.includes("const active = row ? evaluateAccess(row).active : false"),
);
check(
  "lifecycle row read is not wrapped in a warn-and-continue catch",
  !paymentsSrc.includes("[membership] lifecycle row read failed"),
);
check(
  "startedAt stays null until the persisted enrollment date exists",
  paymentsSrc.includes("startedAt: row?.student_enrolled_at ?? null"),
);
check(
  "invoice.paid subscription retrieve is critical (propagates)",
  subWebhookSrc.includes("retrieveSub(env, subscriptionId, true)") &&
    subWebhookSrc.includes("if (critical) throw e;"),
);
check(
  "grace expiry is at-or-after the deadline in code",
  evaluateAccess(
    {
      access_status: "past_due_grace",
      grace_expires_at: new Date(1_700_000_000_000).toISOString(),
      student_enrolled_at: "2026-09-01T00:00:00.000Z",
    } as never,
    1_700_000_000_000,
  ).effectiveStatus === "suspended",
);
check(
  "one millisecond before the deadline still has access",
  evaluateAccess(
    {
      access_status: "past_due_grace",
      grace_expires_at: new Date(1_700_000_000_000).toISOString(),
      student_enrolled_at: "2026-09-01T00:00:00.000Z",
    } as never,
    1_699_999_999_999,
  ).active === true,
);
check(
  "reconciliation SQL uses inclusive lte semantics",
  stateSrc.includes('.lte("grace_expires_at", nowIso)') &&
    !stateSrc.includes('.lt("grace_expires_at", nowIso)'),
);
check(
  "reconciliation checks Supabase errors instead of synthesizing suspension",
  stateSrc.includes("reconcileSubscriptionAccess failed") &&
    stateSrc.includes("reconcile scan failed") &&
    stateSrc.includes("reconcile update failed") &&
    !stateSrc.includes('{ ...row, access_status: "suspended" }'),
);
check(
  "reconciliation route exposes POST only",
  reconcileSrc.includes("POST: ({ request })") && !/\bGET:/.test(reconcileSrc),
);
check(
  "getCheckoutSummary resolves current recurring lookup keys",
  paymentsSrc.includes("tierFromLookupKey(lookupKey) ??") &&
    paymentsSrc.includes("durationMonthsFromLookupKey(lookupKey) ??"),
);

console.log("\n=== Phase 4: downstream forwarding flags ===");
const enrollmentSrc = readFileSync(
  resolve(import.meta.dirname, "../src/lib/enrollment.functions.ts"),
  "utf8",
);
const makeFlagSrc = readFileSync(
  resolve(import.meta.dirname, "../src/lib/make-flag.ts"),
  "utf8",
);
check(
  "Make forwarding is off unless MAKE_FORWARDING_ENABLED === 'true'",
  makeFlagSrc.includes('process.env.MAKE_FORWARDING_ENABLED === "true"'),
);
check(
  "flag module exposes the make_forwarded=false audit marker",
  makeFlagSrc.includes("make_forwarded: false") &&
    makeFlagSrc.includes("make_disabled_by_flag: true"),
);
check(
  "flag is off by default in this environment",
  process.env.MAKE_FORWARDING_ENABLED !== "true",
);
for (const [label, src] of [
  ["stripe webhook", routeSrc],
  ["enrollment", enrollmentSrc],
] as const) {
  check(
    `${label} imports make.server only inside the flag branch`,
    /if \(\s*(?:makeEnabled|isMakeForwardingEnabled\(\))\s*\)\s*\{\s*const \{ forwardToMake \} = await import\("@\/lib\/make\.server"\);/.test(
      src,
    ),
  );
  check(
    `${label} still forwards to Taskade unconditionally`,
    src.includes('const { forwardToTaskade } = await import("@/lib/taskade.server");') &&
      src.includes("jobs: Promise<unknown>[] = [forwardToTaskade(forwardPayload)]"),
  );
  check(
    `${label} logs MAKE_DISABLED_RESULT when the flag is off`,
    src.includes("MAKE_DISABLED_RESULT"),
  );
}

console.log(
  failures === 0
    ? "\nALL CONTRACT TESTS PASSED"
    : `\n${failures} CONTRACT TEST FAILURE(S)`,
);
process.exit(failures ? 1 : 0);

/**
 * Deterministic PayPal lifecycle tests (SIMULATED — no network, no PayPal account).
 * Run: bun run scripts/paypal-lifecycle-test.ts
 */
import {
  applyPayPalEvent,
  normalizePayPalEvent,
  paypalHasAccess,
  reconcilePayPalState,
  reducePayPalEvent,
  DAY_MS,
  type CheckoutIntent,
  type NormalizedPayPalEvent,
  type PayPalStateRepo,
  type PayPalSubState,
  type VerifiedSubscription,
} from "../src/lib/paypal-lifecycle";
import { PAYPAL_PLANS, findPayPalPlan } from "../src/lib/paypal-plans";
import { RETIRED_PAYPAL_PLAN_IDS } from "../src/lib/paypal-legacy";
import { verifyPayPalWebhook } from "../src/lib/paypal.server";

let failures = 0;
let passed = 0;
function check(name: string, cond: boolean) {
  if (cond) passed++;
  else {
    failures++;
    console.error("FAIL:", name);
  }
}

const T0 = Date.parse("2026-11-01T12:00:00Z");
const env = "live" as const;
let seq = 0;
const ev = (type: string, extra: Partial<NormalizedPayPalEvent> = {}): NormalizedPayPalEvent => ({
  eventId: `WH-${++seq}`,
  eventType: type,
  subscriptionId: "I-TESTSUB0001",
  transactionId: null,
  amount: null,
  currency: null,
  occurredAt: new Date(T0).toISOString(),
  ...extra,
});
const sale = (amount: string, at: number, txn = `TX-${++seq}`, currency = "USD") =>
  ev("PAYMENT.SALE.COMPLETED", { transactionId: txn, amount, currency, occurredAt: new Date(at).toISOString() });

function ctx(planId: string) {
  const intent: CheckoutIntent = { id: "11111111-1111-1111-1111-111111111111", leadId: "22222222-2222-2222-2222-222222222222", environment: env, planId, email: "Student@Example.com", fullName: "Test Student", boundSubscriptionId: "I-TESTSUB0001", admissionApproved: true };
  const sub: VerifiedSubscription = { id: "I-TESTSUB0001", planId, status: "ACTIVE", customId: intent.id, startTime: new Date(T0).toISOString() };
  return { intent, sub };
}
function step(state: PayPalSubState | null, e: NormalizedPayPalEvent, planId: string, now: number) {
  const { intent, sub } = ctx(planId);
  return reducePayPalEvent({ env, state, event: e, sub, intent, now });
}

// --- Allowlist ---------------------------------------------------------------
check("exactly six live plans", PAYPAL_PLANS.live.length === 6);
// Real sandbox plans created 2026-10-22 (product PROD-4JU04504SG988094R); live ids must stay invalid in sandbox.
const expectedSandbox: Record<string, [string, string, number]> = {
  "P-11M19538U6046553VNLMYWYI": ["live", "147.00", 1],
  "P-9G316434YE6629704NLMYWYI": ["live", "418.95", 3],
  "P-2FK06868YJ502912MNLMYWYQ": ["live", "793.80", 6],
  "P-8R014182FL7802749NLMYWYY": ["complete", "197.00", 1],
  "P-6YD011175T774454WNLMYWYY": ["complete", "561.45", 3],
  "P-88M85339S80335405NLMYWZA": ["complete", "1063.80", 6],
};
check("six real sandbox plans present", PAYPAL_PLANS.sandbox.length === 6);
for (const [planId, [tier, amount, months]] of Object.entries(expectedSandbox)) {
  const p = findPayPalPlan("sandbox", planId);
  check(`sandbox ${planId} matches ${tier}/${months}m/${amount}`, !!p && p.tier === tier && p.durationMonths === months && p.amount === amount);
  check(`sandbox ${planId} not valid in live`, !findPayPalPlan("live", planId));
}
for (const id of RETIRED_PAYPAL_PLAN_IDS) check(`retired ${id} not sellable`, !findPayPalPlan("live", id));
const expected: Record<string, [string, string, number]> = {
  "P-83B50311XC174031ENH2OWOY": ["live", "147.00", 1],
  "P-2RP31644M2379422RNLMSIJI": ["live", "418.95", 3],
  "P-94J85509T80508630NLMSIWY": ["live", "793.80", 6],
  "P-6BL44529PA8913407NH3OW2A": ["complete", "197.00", 1],
  "P-4XE1994779840341MNLMSJAQ": ["complete", "561.45", 3],
  "P-3B7436587Y5077510NLMSJLY": ["complete", "1063.80", 6],
};
for (const liveId of Object.keys(expected)) {
  check(`live ${liveId} not valid in sandbox`, !findPayPalPlan("sandbox", liveId));
}

// --- Six combinations: activation alone no access; exact amount grants; renewal extends ---
for (const [planId, [tier, amount, months]] of Object.entries(expected)) {
  const p = findPayPalPlan("live", planId)!;
  check(`${planId} tier/amount/months`, p.tier === tier && p.amount === amount && p.durationMonths === months);
  check(`${planId} live plan invalid in sandbox`, !findPayPalPlan("sandbox", planId));
  const a = step(null, ev("BILLING.SUBSCRIPTION.ACTIVATED"), planId, T0);
  check(`${planId} activation no access`, a.next!.access_status === "pending" && !paypalHasAccess(a.next, T0));
  const wrong = step(a.next, sale((Number(amount) - 0.01).toFixed(2), T0), planId, T0);
  check(`${planId} wrong amount rejected`, wrong.noop && wrong.outcome === "rejected:amount_mismatch");
  const eur = step(a.next, sale(amount, T0, "TX-EUR", "EUR"), planId, T0);
  check(`${planId} wrong currency rejected`, eur.noop && eur.outcome === "rejected:currency_mismatch");
  const paid = step(a.next, sale(amount, T0), planId, T0);
  const s = paid.next!;
  check(`${planId} paid grants access`, s.access_status === "active" && paypalHasAccess(s, T0));
  check(`${planId} welcome+credentials`, paid.effect === "welcome_and_credentials");
  check(`${planId} enrolled at payment`, s.student_enrolled_at === new Date(T0).toISOString());
  const endMonth = new Date(s.current_period_end!).getUTCMonth();
  check(`${planId} full period ${months}m`, endMonth === (new Date(T0).getUTCMonth() + months) % 12);
  const renewAt = Date.parse(s.current_period_end!);
  const r = step(s, sale(amount, renewAt), planId, renewAt);
  check(`${planId} renewal keeps enrollment date`, r.next!.student_enrolled_at === s.student_enrolled_at);
  check(`${planId} renewal no new credentials`, r.effect === "renewal_receipt");
  check(`${planId} renewal extends`, Date.parse(r.next!.current_period_end!) > renewAt);
  check(`${planId} months counted`, r.next!.paid_active_months === months * 2);
}

const PLAN = "P-83B50311XC174031ENH2OWOY";

// --- Binding / beneficiary ---
{
  const { intent, sub } = ctx(PLAN);
  const bad = reducePayPalEvent({ env, state: null, event: sale("147.00", T0), sub: { ...sub, customId: "other" }, intent, now: T0 });
  check("beneficiary mismatch rejected", bad.outcome === "rejected:beneficiary_mismatch");
  const noIntent = reducePayPalEvent({ env, state: null, event: sale("147.00", T0), sub, intent: null, now: T0 });
  check("missing intent rejected", noIntent.outcome === "rejected:intent_missing");
  const retired = reducePayPalEvent({ env, state: null, event: sale("147.00", T0), sub: { ...sub, planId: RETIRED_PAYPAL_PLAN_IDS[0] }, intent: { ...intent, planId: RETIRED_PAYPAL_PLAN_IDS[0] }, now: T0 });
  check("retired plan rejected", retired.outcome === "rejected:plan_not_allowlisted");
  const sbx = reducePayPalEvent({ env: "sandbox", state: null, event: sale("147.00", T0), sub, intent: { ...intent, environment: "sandbox" }, now: T0 });
  check("live plan rejected in sandbox", sbx.outcome === "rejected:plan_not_allowlisted");
  const unverified = reducePayPalEvent({ env, state: null, event: sale("147.00", T0), sub: null, intent, now: T0 });
  check("unverified subscription rejected", unverified.noop);
}

// --- Pending ---
{
  const p = step(null, ev("PAYMENT.SALE.PENDING", { transactionId: "TX-P", amount: "147.00", currency: "USD" }), PLAN, T0);
  check("pending no access", p.next!.access_status === "pending" && !paypalHasAccess(p.next, T0) && p.effect === "none");
}

// --- Duplicates / out of order ---
{
  const e = sale("147.00", T0, "TX-DUP");
  const first = step(null, e, PLAN, T0);
  const sameEvent = step(first.next, e, PLAN, T0);
  check("duplicate event noop", sameEvent.noop && sameEvent.outcome === "duplicate_event");
  const sameTxn = step(first.next, { ...e, eventId: "WH-OTHER" }, PLAN, T0);
  check("duplicate transaction no double count", sameTxn.outcome === "duplicate_transaction" && sameTxn.next!.paid_invoice_count === 1 && sameTxn.effect === "none");
  // Activated arriving AFTER payment does not undo access.
  const late = step(first.next, ev("BILLING.SUBSCRIPTION.ACTIVATED"), PLAN, T0 + 1000);
  check("late activation keeps access", late.next!.access_status === "active");
  // Cancellation BEFORE payment event: payment still opens paid period, cancel flag kept.
  const c = step(null, ev("BILLING.SUBSCRIPTION.CANCELLED"), PLAN, T0);
  check("cancel before any payment → canceled, no access", c.next!.access_status === "canceled" && !paypalHasAccess(c.next, T0));
}

// --- Concurrency (in-memory repo with CAS + interleaved loads) ---
async function concurrency() {
  const store = new Map<string, { state: PayPalSubState; version: number }>();
  const repo: PayPalStateRepo = {
    async load(id) {
      const v = store.get(id);
      return v ? { state: structuredClone(v.state), version: v.version } : null;
    },
    async save(id, expected, next) {
      await new Promise((r) => setTimeout(r, Math.random() * 3));
      const cur = store.get(id);
      if (expected === null ? !!cur : cur?.version !== expected) return false;
      store.set(id, { state: structuredClone(next), version: (cur?.version ?? 0) + 1 });
      return true;
    },
  };
  const { intent, sub } = ctx(PLAN);
  const e = sale("147.00", T0, "TX-CONC");
  const runs = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      applyPayPalEvent({ repo, env, event: { ...e, eventId: `WH-C-${i}` }, sub, intent, now: () => T0 }),
    ),
  );
  const welcomes = runs.filter((r) => r.effect === "welcome_and_credentials").length;
  const s = store.get("I-TESTSUB0001")!.state;
  check("concurrent: one welcome only", welcomes === 1);
  check("concurrent: paid once", s.paid_invoice_count === 1 && s.paid_active_months === 1);
}

// --- Failures + grace with controllable clock ---
{
  const init = step(null, ev("BILLING.SUBSCRIPTION.PAYMENT.FAILED"), PLAN, T0);
  check("initial failure no access", init.next!.access_status === "pending" && !init.next!.grace_expires_at && !paypalHasAccess(init.next, T0 + DAY_MS));
  check("initial failure notice", init.effect === "payment_failed_initial");

  const paid = step(null, sale("147.00", T0), PLAN, T0).next!;
  const F = Date.parse(paid.current_period_end!) + 3600_000;
  const f1 = step(paid, ev("BILLING.SUBSCRIPTION.PAYMENT.FAILED", { occurredAt: new Date(F).toISOString() }), PLAN, F);
  check("renewal failure → grace", f1.next!.access_status === "past_due_grace" && f1.effect === "grace_notice");
  const deadline = F + 7 * DAY_MS;
  check("grace deadline = first failure + 7d", Date.parse(f1.next!.grace_expires_at!) === deadline);
  const f2 = step(f1.next, ev("BILLING.SUBSCRIPTION.PAYMENT.FAILED", { occurredAt: new Date(F + 3 * DAY_MS).toISOString() }), PLAN, F + 3 * DAY_MS);
  check("repeat failure does not extend", f2.next!.grace_expires_at === f1.next!.grace_expires_at && f2.effect === "none");
  check("access before deadline", paypalHasAccess(f2.next, deadline - 1));
  check("no access exactly at deadline", !paypalHasAccess(f2.next, deadline));
  check("reconcile before deadline: no change", !reconcilePayPalState(f2.next!, deadline - 1).changed);
  const atDl = reconcilePayPalState(f2.next!, deadline);
  check("reconcile exactly at deadline suspends", atDl.next.access_status === "suspended");
  const after = reconcilePayPalState(f2.next!, deadline + DAY_MS);
  check("reconcile after deadline suspends", after.next.access_status === "suspended" && after.effect === "access_suspended_notice");
  const f3 = step(f2.next, ev("BILLING.SUBSCRIPTION.SUSPENDED", { occurredAt: new Date(deadline + 1).toISOString() }), PLAN, deadline + 1);
  check("failure event after deadline suspends", f3.next!.access_status === "suspended");
  const rec = step(after.next, sale("147.00", deadline + 2 * DAY_MS), PLAN, deadline + 2 * DAY_MS);
  check("recovery restores", rec.next!.access_status === "active" && rec.outcome === "renewal_recovered" && !rec.next!.grace_expires_at);
  check("recovery no new credentials", rec.effect === "renewal_receipt");
  check("recovery keeps enrollment date", rec.next!.student_enrolled_at === paid.student_enrolled_at);

  // Missed renewal with no PayPal failure event: grace counted from period end.
  const end = Date.parse(paid.current_period_end!);
  const miss = reconcilePayPalState(paid, end + DAY_MS);
  check("missed renewal → grace from period end", miss.next.access_status === "past_due_grace" && Date.parse(miss.next.grace_expires_at!) === end + 7 * DAY_MS);
}

// --- Cancellation preserves paid period ---
{
  const paid = step(null, sale("147.00", T0), PLAN, T0).next!;
  const c = step(paid, ev("BILLING.SUBSCRIPTION.CANCELLED"), PLAN, T0 + DAY_MS);
  check("cancel keeps access", c.next!.access_status === "active" && c.next!.cancel_at_period_end && c.effect === "cancellation_scheduled_notice");
  const end = Date.parse(paid.current_period_end!);
  check("cancel: no change before end", !reconcilePayPalState(c.next!, end - 1).changed);
  const done = reconcilePayPalState(c.next!, end);
  check("cancel: canceled at period end (no grace)", done.next.access_status === "canceled" && !paypalHasAccess(done.next, end));
}

// --- Refund never auto-revokes ---
{
  const paid = step(null, sale("147.00", T0, "TX-R"), PLAN, T0).next!;
  const r = step(paid, ev("PAYMENT.SALE.REFUNDED", { transactionId: "TX-R" }), PLAN, T0 + DAY_MS);
  check("refund → review, access kept", r.effect === "refund_review" && r.next!.access_status === "active");
}

// --- Normalization ---
{
  const n = normalizePayPalEvent({ id: "WH-1", event_type: "PAYMENT.SALE.COMPLETED", create_time: "2026-11-01T00:00:00Z", resource: { id: "S1", billing_agreement_id: "I-ABCDEF12", amount: { total: "147.00", currency: "USD" } } });
  check("normalize sale", n?.subscriptionId === "I-ABCDEF12" && n.transactionId === "S1" && n.amount === "147.00");
  check("normalize rejects junk", normalizePayPalEvent({ foo: 1 }) === null);
}

// --- Signature verification (mocked PayPal API) ---
async function signatures() {
  process.env.PAYPAL_SANDBOX_CLIENT_ID = "test-id";
  process.env.PAYPAL_SANDBOX_CLIENT_SECRET = "test-secret";
  process.env.PAYPAL_SANDBOX_WEBHOOK_ID = "WH-TEST";
  const good = new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "t1",
    "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "2026-11-01T00:00:00Z",
  });
  const mk = (status: string) => async (url: string) =>
    url.endsWith("/oauth2/token")
      ? new Response(JSON.stringify({ access_token: "tok" }))
      : new Response(JSON.stringify({ verification_status: status }));
  const body = JSON.stringify({ id: "WH-1", event_type: "PAYMENT.SALE.COMPLETED" });
  check("valid signature accepted", await verifyPayPalWebhook("sandbox", good, body, mk("SUCCESS")));
  check("FAILURE status rejected", !(await verifyPayPalWebhook("sandbox", good, body, mk("FAILURE"))));
  const missing = new Headers(good);
  missing.delete("paypal-transmission-sig");
  check("missing header rejected", !(await verifyPayPalWebhook("sandbox", missing, body, mk("SUCCESS"))));
  const evil = new Headers(good);
  evil.set("paypal-cert-url", "https://evil.example.com/cert");
  check("foreign cert url rejected", !(await verifyPayPalWebhook("sandbox", evil, body, mk("SUCCESS"))));
  check("malformed body rejected", !(await verifyPayPalWebhook("sandbox", good, "{not json", mk("SUCCESS"))));
  // Missing-configuration fixture must not depend on the project's real secrets.
  const previousLiveWebhook = process.env.PAYPAL_LIVE_WEBHOOK_ID;
  delete process.env.PAYPAL_LIVE_WEBHOOK_ID;
  try {
    check("live env without webhook id rejected", !(await verifyPayPalWebhook("live", good, body, mk("SUCCESS"))));
  } finally {
    if (previousLiveWebhook !== undefined) process.env.PAYPAL_LIVE_WEBHOOK_ID = previousLiveWebhook;
  }
}

await concurrency();
await signatures();
await import("./paypal-hardening-test.ts").then((m) => m.run(check));
console.log(`paypal lifecycle: ${passed} passed, ${failures} failed`);
if (failures) process.exit(1);

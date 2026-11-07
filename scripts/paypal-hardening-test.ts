/**
 * SIMULATED tests for the review blockers (no network, no PayPal account, no emails).
 * Executed from scripts/paypal-lifecycle-test.ts.
 */
import { readFileSync } from "node:fs";
import {
  applyPayPalEvent,
  paypalHasAccess,
  reconcilePayPalState,
  reducePayPalEvent,
  validateBinding,
  DAY_MS,
  type CheckoutIntent,
  type NormalizedPayPalEvent,
  type PayPalStateRepo,
  type PayPalSubState,
  type VerifiedSubscription,
} from "../src/lib/paypal-lifecycle";
import { isMembershipActive } from "../src/lib/membership-access";
import {
  drainPendingNotifications,
  processOutbox,
  type OutboxInsert,
  type OutboxRow,
  type OutboxStore,
} from "../src/lib/notification-outbox";
import { applySaleFacts } from "../src/lib/paypal.server";
import { admissionAllowsCheckout, consentIsCurrent } from "../src/lib/paypal-admission";
import { buildPayPalAccountAccessEmail, buildPayPalNoticeEmail } from "../src/lib/paypal-emails";

type Check = (name: string, cond: boolean) => void;
const PLAN = "P-83B50311XC174031ENH2OWOY"; // Live 1m 147.00
const PLAN3 = "P-2RP31644M2379422RNLMSIJI"; // Live 3m 418.95
const SUB = "I-HARDEN0001";
let n = 0;
const iso = (t: number | string) => new Date(t).toISOString();
const ev = (type: string, at: number, extra: Partial<NormalizedPayPalEvent> = {}): NormalizedPayPalEvent => ({
  eventId: `WH-H-${++n}`, eventType: type, subscriptionId: SUB, transactionId: null, amount: null, currency: null, occurredAt: iso(at), ...extra,
});
const sale = (at: number, amount = "147.00") => ev("PAYMENT.SALE.COMPLETED", at, { transactionId: `TXH${++n}`, amount, currency: "USD" });
function mk(planId: string, start: number, over: Partial<CheckoutIntent> = {}) {
  const intent: CheckoutIntent = { id: "33333333-3333-3333-3333-333333333333", leadId: "44444444-4444-4444-4444-444444444444", environment: "live", planId, email: "a@b.co", fullName: "A B", boundSubscriptionId: SUB, admissionApproved: true, ...over };
  const sub: VerifiedSubscription = { id: SUB, planId, status: "ACTIVE", customId: intent.id, startTime: iso(start) };
  return { intent, sub };
}
function stepper(planId: string, start: number) {
  const { intent, sub } = mk(planId, start);
  return (s: PayPalSubState | null, e: NormalizedPayPalEvent, now: number) =>
    reducePayPalEvent({ env: "live", state: s, event: e, sub, intent, now });
}

export async function run(check: Check) {
  const T0 = Date.parse("2026-11-01T12:00:00Z");

  // (1) No password reset / no password in email.
  const stateSrc = readFileSync(new URL("../src/lib/paypal-state.server.ts", import.meta.url), "utf8");
  check("[1] no updateUserById in PayPal flow", !stateSrc.includes("updateUserById"));
  check("[1] createUser without password", !/createUser\(\{[^}]*password/s.test(stateSrc));
  const newAcc = buildPayPalAccountAccessEmail({ fullName: "A B", email: "a@b.co", setPasswordUrl: "https://x.test/link" });
  const oldAcc = buildPayPalAccountAccessEmail({ fullName: "A B", email: "a@b.co", setPasswordUrl: null });
  check("[1] new account email has set-password link, no password value", newAcc.bodyText.includes("https://x.test/link") && !/password:\s*\S/i.test(newAcc.bodyText));
  check("[1] existing account told password unchanged + forgot password", oldAcc.bodyText.includes("has not been changed") && oldAcc.bodyText.includes("Forgot password?"));

  // (2) Intent binding: other subscription / unbound / no admission rejected.
  {
    const { intent, sub } = mk(PLAN, T0);
    check("[2] bound to other subscription rejected", validateBinding("live", sub, { ...intent, boundSubscriptionId: "I-OTHER00001" }).ok === false &&
      (validateBinding("live", sub, { ...intent, boundSubscriptionId: "I-OTHER00001" }) as any).reason === "intent_bound_to_other_subscription");
    check("[2] unbound intent rejected", (validateBinding("live", sub, { ...intent, boundSubscriptionId: null }) as any).reason === "intent_not_bound");
    check("[7] admission not approved rejected", (validateBinding("live", sub, { ...intent, admissionApproved: false }) as any).reason === "admission_not_approved");
    // Concurrent binding (in-memory model of UPDATE … WHERE paypal_subscription_id IS NULL).
    let bound: string | null = null;
    const bind = async (subId: string) => {
      await new Promise((r) => setTimeout(r, Math.random() * 4));
      if (bound === null) { bound = subId; return "bound"; }
      return bound === subId ? "already_bound" : "conflict";
    };
    const subs = ["I-RACE000001", "I-RACE000002", "I-RACE000003", "I-RACE000001", "I-RACE000002"];
    const res = await Promise.all(subs.map(bind));
    const winner = bound as string | null;
    check("[2] concurrent bind: exactly one winner", res.filter((r) => r === "bound").length === 1);
    check("[2] concurrent bind: only winner's events validate", subs.every((sid) =>
      validateBinding("live", { ...sub, id: sid }, { ...intent, boundSubscriptionId: winner }).ok === (sid === winner)));
  }

  // (3) Stale failure after recovery; late cancellation.
  {
    const step = stepper(PLAN, T0);
    const paid = step(null, sale(T0), T0).next!;
    const end1 = Date.parse(paid.current_period_end!);
    const failAt = end1 + 3600_000;
    const failEv = ev("BILLING.SUBSCRIPTION.PAYMENT.FAILED", failAt);
    const g = step(paid, failEv, failAt).next!;
    const recAt = failAt + 2 * DAY_MS;
    const rec = step(g, sale(recAt), recAt).next!;
    check("[3] recovered active", rec.access_status === "active" && !rec.grace_expires_at);
    // The same failure (another delivery id) arrives late, after recovery.
    const late = step(rec, { ...failEv, eventId: "WH-LATE-FAIL" }, recAt + DAY_MS);
    check("[3] stale failure ignored after recovery", late.outcome === "stale_failure_ignored" && late.next!.access_status === "active" && !late.next!.grace_expires_at && late.effect === "none");
    const veryLate = step(rec, ev("BILLING.SUBSCRIPTION.SUSPENDED", failAt + DAY_MS), recAt + 30 * DAY_MS);
    check("[3] stale suspension never suspends retroactively", veryLate.outcome === "stale_failure_ignored" && paypalHasAccess(veryLate.next, recAt + DAY_MS));
    // Late cancellation delivered after period end.
    const cancelAt = T0 + DAY_MS;
    const lateCancel = step(paid, ev("BILLING.SUBSCRIPTION.CANCELLED", cancelAt), end1 + 5 * DAY_MS);
    check("[3] late cancel after period end → canceled, no access", lateCancel.next!.access_status === "canceled" && !paypalHasAccess(lateCancel.next, end1 + 5 * DAY_MS) && lateCancel.next!.canceled_at === iso(cancelAt));
    const inTimeCancel = step(paid, ev("BILLING.SUBSCRIPTION.CANCELLED", cancelAt), cancelAt + DAY_MS);
    check("[3] cancel keeps paid period only", paypalHasAccess(inTimeCancel.next, end1 - 1) && !paypalHasAccess(inTimeCancel.next, end1));
  }

  // (4) Contractual calendar: day 31, February, leap year, late/early renewal.
  {
    const A = Date.parse("2027-01-31T10:00:00Z");
    const step = stepper(PLAN, A);
    const p1 = step(null, sale(A + 3 * 3600_000), A + 3 * 3600_000).next!; // paid 3h after start
    check("[4] Jan 31 → Feb 28", p1.current_period_end === "2027-02-28T10:00:00.000Z" && p1.current_period_start === iso(A));
    const late = Date.parse("2027-03-05T00:00:00Z"); // renewal paid 5 days late
    const p2 = step(p1, sale(late), late).next!;
    check("[4] late renewal gains no days (Feb 28 → Mar 31)", p2.current_period_start === "2027-02-28T10:00:00.000Z" && p2.current_period_end === "2027-03-31T10:00:00.000Z");
    const early = Date.parse("2027-03-29T00:00:00Z"); // paid 2 days early
    const p3 = step(p2, sale(early), early).next!;
    check("[4] early renewal loses no days (Mar 31 → Apr 30)", p3.current_period_end === "2027-04-30T10:00:00.000Z");
    check("[4] enrollment date never moves", p3.student_enrolled_at === p1.student_enrolled_at);
    const L = Date.parse("2028-01-31T00:00:00Z");
    const leap = stepper(PLAN, L)(null, sale(L), L).next!;
    check("[4] leap year Jan 31 → Feb 29", leap.current_period_end === "2028-02-29T00:00:00.000Z");
    const Q = Date.parse("2026-11-30T00:00:00Z");
    const s3 = stepper(PLAN3, Q);
    const q1 = s3(null, sale(Q, "418.95"), Q).next!;
    const q2 = s3(q1, sale(Date.parse(q1.current_period_end!) + 4 * DAY_MS, "418.95"), Date.parse(q1.current_period_end!) + 4 * DAY_MS).next!;
    check("[4] 3m Nov 30 → Feb 28 → May 30", q1.current_period_end === "2027-02-28T00:00:00.000Z" && q2.current_period_end === "2027-05-30T00:00:00.000Z");
    // Out-of-order delivery of two renewals yields the same period.
    const a = sale(Date.parse("2027-02-28T11:00:00Z"));
    const b = sale(Date.parse("2027-03-31T11:00:00Z"));
    const ab = step(step(p1, a, 0).next, b, 0).next!;
    const ba = step(step(p1, b, 0).next, a, 0).next!;
    check("[4] renewal order-independent", ab.current_period_end === ba.current_period_end && ab.paid_invoice_count === 3);
  }

  // (5) Access: live only (+ explicit courtesy), date-bounded without scheduler.
  {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const row = { access_status: "active", current_period_end: "2026-11-12T00:00:00Z", grace_expires_at: null };
    check("[5] live active in period", isMembershipActive({ ...row, environment: "live" }, now));
    check("[5] sandbox row denied", !isMembershipActive({ ...row, environment: "sandbox" }, now));
    check("[5] explicit sandbox courtesy allowed", isMembershipActive({ ...row, environment: "sandbox", courtesy_access: true }, now));
    check("[5] active past period end denied without scheduler", !isMembershipActive({ ...row, environment: "live", current_period_end: "2026-11-09T00:00:00Z" }, now));
    check("[5] active without period end denied", !isMembershipActive({ ...row, environment: "live", current_period_end: null }, now));
    check("[5] canceled denied", !isMembershipActive({ ...row, environment: "live", access_status: "canceled" }, now));
    check("[5] grace bounded", isMembershipActive({ environment: "live", access_status: "past_due_grace", current_period_end: null, grace_expires_at: "2026-11-10T00:00:01Z" }, now) &&
      !isMembershipActive({ environment: "live", access_status: "past_due_grace", current_period_end: null, grace_expires_at: "2026-11-10T00:00:00Z" }, now));
    const step = stepper(PLAN, T0);
    const paid = step(null, sale(T0), T0).next!;
    check("[5] paypalHasAccess(sandbox) false", !paypalHasAccess(paid, T0, "sandbox"));
    const c = step(paid, ev("BILLING.SUBSCRIPTION.CANCELLED", T0 + DAY_MS), T0 + DAY_MS).next!;
    const recon = reconcilePayPalState(c, Date.parse(c.current_period_end!) + 10 * DAY_MS, SUB);
    check("[5] reconcile never extends canceled period", recon.next.current_period_end === c.current_period_end && recon.next.access_status === "canceled");
    const sql = readFileSync(new URL("../drizzle/migrations/0010_paypal_hardening.sql", import.meta.url), "utf8");
    check("[5] SQL has_active_membership filters env + dates", sql.includes("environment = 'live' OR courtesy_access") && sql.includes("current_period_end > now()") && sql.includes("grace_expires_at > now()"));
  }

  // (6) /membership: PayPal never reaches Stripe.
  {
    const pay = readFileSync(new URL("../src/lib/payments.functions.ts", import.meta.url), "utf8");
    check("[6] Stripe summary/portal only accept cs_ session ids", (pay.match(/\^cs_\(test\|live\)_/g) ?? []).length >= 2 && !/^cs_/.test("I-ABC123456"));
    const mem = readFileSync(new URL("../src/routes/membership.tsx", import.meta.url), "utf8");
    check("[6] membership has PayPal branch before Stripe calls", mem.includes('if (provider === "paypal") return <PayPalMembership />'));
    const notice = buildPayPalNoticeEmail("grace_notice", { fullName: "A", graceExpiresAt: "2026-12-08T00:00:00Z", currentPeriodEnd: null });
    check("[8] grace notice is PayPal-aware, no Stripe portal", notice.bodyText.includes("PayPal") && !/stripe|billing portal/i.test(notice.bodyText));
  }

  // (7)+(8) Durable outbox.
  {
    const store = new Map<string, { state: PayPalSubState; version: number }>();
    const repo: PayPalStateRepo = {
      async load(id) { const v = store.get(id); return v ? { state: structuredClone(v.state), version: v.version } : null; },
      async save(id, exp, next) {
        await new Promise((r) => setTimeout(r, Math.random() * 2));
        const cur = store.get(id);
        if (exp === null ? !!cur : cur?.version !== exp) return false;
        store.set(id, { state: structuredClone(next), version: (cur?.version ?? 0) + 1 });
        return true;
      },
    };
    const { intent, sub } = mk(PLAN, T0);
    const e = sale(T0);
    await Promise.all(Array.from({ length: 6 }, (_, i) => applyPayPalEvent({ repo, env: "live", event: { ...e, eventId: `WH-O-${i}` }, sub, intent, now: () => T0 })));
    check("[7] notification persisted with state", store.get(SUB)!.state.pending_notifications!.length === 1);

    const outbox = new Map<string, OutboxRow & { status: string; next: number }>();
    let crash = true;
    const insert = async (rows: OutboxInsert[]) => {
      for (const r of rows) if (!outbox.has(r.dedupe_key)) outbox.set(r.dedupe_key, { ...r, id: r.dedupe_key, attempts: 0, status: "pending", next: 0 });
      if (crash) { crash = false; throw new Error("simulated crash after insert"); }
    };
    let threw = false;
    try { await drainPendingNotifications({ repo, env: "live", subscriptionId: SUB, insert }); } catch { threw = true; }
    check("[7] crash keeps notification in row", threw && store.get(SUB)!.state.pending_notifications!.length === 1);
    await drainPendingNotifications({ repo, env: "live", subscriptionId: SUB, insert });
    await drainPendingNotifications({ repo, env: "live", subscriptionId: SUB, insert });
    check("[7] retry drains without duplicates (confirmation + account)", outbox.size === 2 && store.get(SUB)!.state.pending_notifications!.length === 0);

    const mkStore = (): OutboxStore => ({
      async claimDue(now) { return [...outbox.values()].filter((r) => (r.status === "pending" || r.status === "failed") && r.next <= now); },
      async markSent(id) { outbox.get(id)!.status = "sent"; },
      async markSkipped(id, st) { outbox.get(id)!.status = st; },
      async markFailed(id, _e, next) { const r = outbox.get(id)!; r.attempts++; r.status = next === null ? "dead" : "failed"; r.next = next ?? Infinity; },
    });
    const sent: string[] = [];
    let fail = true;
    const deliver = async (r: OutboxRow) => { if (fail && r.kind === "account_access") { fail = false; throw new Error("smtp down"); } sent.push(r.dedupe_key); };
    let clock = T0;
    const r1 = await processOutbox({ store: mkStore(), deliver, now: () => clock });
    check("[7] first run: one sent, one failed for retry", r1.sent === 1 && r1.failed === 1);
    const r2 = await processOutbox({ store: mkStore(), deliver, now: () => clock });
    check("[7] retry waits for backoff", r2.sent === 0);
    clock += 10 * 60_000;
    await processOutbox({ store: mkStore(), deliver, now: () => clock });
    await processOutbox({ store: mkStore(), deliver, now: () => clock + DAY_MS });
    check("[7] each email delivered exactly once", sent.length === 2 && new Set(sent).size === 2);

    // Sandbox never sends.
    const sbx = new Map<string, any>([["k", { id: "k", dedupe_key: "k", environment: "sandbox", provider: "paypal", kind: "welcome_confirmation", subscription_id: SUB, recipient: "a@b.co", attempts: 0, status: "pending" }]]);
    let sbxSent = 0;
    const rs = await processOutbox({
      store: { async claimDue() { return [...sbx.values()].filter((r) => r.status === "pending"); }, async markSent() {}, async markSkipped(id, st) { sbx.get(id).status = st; }, async markFailed() {} },
      deliver: async () => { sbxSent++; },
      now: () => T0,
    });
    check("[7] sandbox recorded, never sent", sbxSent === 0 && rs.skipped === 1 && sbx.get("k").status === "skipped_sandbox");

    // (8) Grace/suspension/cancellation become persisted notifications.
    const step = stepper(PLAN, T0);
    const paid = step(null, sale(T0), T0).next!;
    const F = Date.parse(paid.current_period_end!) + 3600_000;
    const g = step(paid, ev("BILLING.SUBSCRIPTION.PAYMENT.FAILED", F), F).next!;
    check("[8] grace notice persisted", g.pending_notifications!.some((x) => x.kind === "grace_notice"));
    const susp = reconcilePayPalState(g, F + 8 * DAY_MS, SUB).next;
    check("[8] suspension notice persisted by scheduler", susp.pending_notifications!.some((x) => x.kind === "access_suspended_notice"));
    const c = step(paid, ev("BILLING.SUBSCRIPTION.CANCELLED", T0 + DAY_MS), T0 + DAY_MS).next!;
    check("[8] cancellation notice persisted", c.pending_notifications!.some((x) => x.kind === "cancellation_scheduled_notice"));
    const again = reconcilePayPalState(susp, F + 9 * DAY_MS, SUB);
    check("[8] no duplicate suspension notice", !again.changed);
  }

  // (7) Admission + consent rules; (4) sale facts from PayPal.
  {
    const V = { terms: "2026-08-17", privacy: "2026-08-17", refund: "2026-08-17" };
    const ok = { termsVersion: V.terms, privacyVersion: V.privacy, refundVersion: V.refund, acceptedAt: iso(T0) };
    check("[7] only approved admission allows checkout", admissionAllowsCheckout("approved") && !admissionAllowsCheckout("not_reviewed") && !admissionAllowsCheckout(null) && !admissionAllowsCheckout("declined"));
    check("[7] current consent accepted", consentIsCurrent(ok, V, T0 + 3600_000));
    check("[7] old terms version rejected", !consentIsCurrent({ ...ok, termsVersion: "2026-01-01" }, V, T0));
    check("[7] stale consent rejected", !consentIsCurrent(ok, V, T0 + 2 * DAY_MS));
    const base = { eventType: "PAYMENT.SALE.COMPLETED", subscriptionId: SUB, amount: "1.00", currency: "EUR", occurredAt: iso(T0 + 9 * DAY_MS) };
    const facts = applySaleFacts(base, { id: "S", state: "completed", amount: "147.00", currency: "USD", subscriptionId: SUB, occurredAt: iso(T0) });
    check("[4] sale facts override delivery data", facts?.amount === "147.00" && facts.currency === "USD" && facts.occurredAt === iso(T0));
    check("[4] sale of other subscription rejected", applySaleFacts(base, { id: "S", state: "completed", amount: "147.00", currency: "USD", subscriptionId: "I-OTHER0001", occurredAt: null }) === null);
    check("[4] non-completed sale rejected", applySaleFacts(base, { id: "S", state: "pending", amount: "147.00", currency: "USD", subscriptionId: SUB, occurredAt: null }) === null);
  }
}

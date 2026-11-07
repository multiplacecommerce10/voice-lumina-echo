import { describe, test, expect } from "bun:test";
import { validateStripeCatalogPrice, validateCheckoutAdmission } from "../src/lib/checkout-validation";
import { verifyWebhook } from "../src/lib/stripe.server";
import { evaluateAccess } from "../src/lib/subscription-state.server";
import { isMembershipActive } from "../src/lib/membership-access";
import { LEGAL_VERSIONS } from "../src/lib/legal";

const now = Date.parse("2026-11-07T03:23:00Z");
const consent = { termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy,
  refundVersion: LEGAL_VERSIONS.refund, acceptedAt: new Date(now).toISOString() };
const prices = [
  ["live_sub_1m_v1", 14700, 1], ["live_sub_3m_v1", 41895, 3], ["live_sub_6m_v1", 79380, 6],
  ["complete_sub_1m_v1", 19700, 1], ["complete_sub_3m_v1", 56145, 3], ["complete_sub_6m_v1", 106380, 6],
] as const;
const price = { active: true, type: "recurring", currency: "usd", unit_amount: 14700,
  recurring: { interval: "month", interval_count: 1 }, lookup_key: "live_sub_1m_v1" };

describe("Exact recurring offer", () => {
  for (const [key, amount, months] of prices) test(`${key}: ${amount} cents every ${months} months`, () => {
    expect(validateStripeCatalogPrice(key, { ...price, lookup_key: key, unit_amount: amount,
      recurring: { interval: "month", interval_count: months } }).durationMonths).toBe(months);
  });
  for (const [name, patch] of Object.entries({ currency: { currency: "eur" }, amount: { unit_amount: 14701 },
    interval: { recurring: { interval: "year", interval_count: 1 } }, duration: { recurring: { interval: "month", interval_count: 12 } },
    inactive: { active: false }, oneTime: { type: "one_time", recurring: null }, wrongKey: { lookup_key: "complete_sub_1m_v1" } })) {
    test(`reject ${name} mismatch`, () => expect(() => validateStripeCatalogPrice("live_sub_1m_v1", { ...price, ...patch })).toThrow());
  }
});

describe("Human admission and current consent", () => {
  const lead = { email: "fixture@example.com", admission_status: "approved" };
  test("approved lead and current versions pass", () => expect(validateCheckoutAdmission(lead, consent, now)).toBe("fixture@example.com"));
  test("missing lead rejects", () => expect(() => validateCheckoutAdmission(null, consent, now)).toThrow());
  for (const status of [null, "pending", "rejected"]) test(`no approval: ${status}`, () => expect(() => validateCheckoutAdmission({ ...lead, admission_status: status }, consent, now)).toThrow());
  test("missing consent rejects", () => expect(() => validateCheckoutAdmission(lead, undefined, now)).toThrow());
  for (const field of ["termsVersion", "privacyVersion", "refundVersion"] as const) test(`outdated ${field}`, () => expect(() => validateCheckoutAdmission(lead, { ...consent, [field]: "old" }, now)).toThrow());
  test("older than 24 hours rejects", () => expect(() => validateCheckoutAdmission(lead, { ...consent, acceptedAt: new Date(now - 86400001).toISOString() }, now)).toThrow());
  test("more than 5 minutes future rejects", () => expect(() => validateCheckoutAdmission(lead, { ...consent, acceptedAt: new Date(now + 300001).toISOString() }, now)).toThrow());
});

describe("Date-bounded access parity", () => {
  const base = { environment: "live", courtesy_access: false, access_status: "active", current_period_end: new Date(now + 1).toISOString(), grace_expires_at: null };
  const cases = [
    ["live future period", {}, true], ["missing period", { current_period_end: null }, false],
    ["invalid period", { current_period_end: "invalid" }, false], ["at period end", { current_period_end: new Date(now).toISOString() }, false],
    ["sandbox", { environment: "sandbox" }, false], ["explicit courtesy", { environment: "sandbox", courtesy_access: true }, true],
    ["expired courtesy", { environment: "sandbox", courtesy_access: true, current_period_end: new Date(now).toISOString() }, false],
    ["grace future", { access_status: "past_due_grace", grace_expires_at: new Date(now + 1).toISOString() }, true],
    ["grace missing", { access_status: "past_due_grace" }, false],
    ["grace invalid", { access_status: "past_due_grace", grace_expires_at: "invalid" }, false],
    ["grace boundary", { access_status: "past_due_grace", grace_expires_at: new Date(now).toISOString() }, false],
    ["refund review", { access_status: "refund_review" }, false],
  ] as const;
  for (const [name, patch, expected] of cases) test(name, () => {
    const row = { ...base, ...patch };
    expect(evaluateAccess(row as never, now).active).toBe(expected);
    expect(evaluateAccess(row as never, now).active).toBe(isMembershipActive(row, now));
  });
});

describe("Stripe signed fixtures, local only", () => {
  async function fixture(timestamp: string, livemode: boolean, signatureValid = true) {
    const secret = "local-test-only-not-a-provider-credential";
    const body = JSON.stringify({ id: "evt_fixture", type: "fixture", livemode, data: { object: {} } });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`))).toString("hex");
    const req = new Request("http://localhost/fixture", { method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${signatureValid ? signature : "00"}` } });
    const previous = process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
    process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = secret;
    try { return await verifyWebhook(req, "sandbox"); }
    finally { if (previous === undefined) delete process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET; else process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = previous; }
  }
  test("valid sandbox event passes", async () => expect((await fixture(String(Math.floor(Date.now()/1000)), false)).id).toBe("evt_fixture"));
  test("wrong livemode rejects", async () => expect(fixture(String(Math.floor(Date.now()/1000)), true)).rejects.toThrow("environment mismatch"));
  for (const timestamp of ["NaN", "Infinity", "invalid"]) test(`non-finite timestamp ${timestamp}`, async () => expect(fixture(timestamp, false)).rejects.toThrow("timestamp"));
  test("stale signed fixture rejects", async () => expect(fixture(String(Math.floor(Date.now()/1000)-301), false)).rejects.toThrow());
  test("bad signature rejects", async () => expect(fixture(String(Math.floor(Date.now()/1000)), false, false)).rejects.toThrow());
});
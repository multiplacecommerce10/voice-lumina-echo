import { mock, test, expect, beforeEach } from "bun:test";
import { profileAnswers } from "../src/lib/enrollment-profile";
// Exercise the real handlers with an RPC-builder shim and provider/database mocks.
// No network or persisted writes: all side effects below are in-memory spies.
mock.module("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (x: any) => x;
  const builder = { validator: (fn: any) => { validate = fn; return builder; },
    handler: (fn: any) => async ({ data }: any) => fn({ data: validate(data) }) };
  return builder;
} }));
let lead: any;
let price: any;
const create = mock(async () => ({ id: "cs_test_fixture", client_secret: "local-fixture" }));
const update = mock(() => ({ eq: async () => ({ error: null }) }));
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: async () => ({ data: { id: "local-attempt", session_id: null }, error: null }), from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lead, error: null }) }) }), update,
}) } }));
const retrieve = mock(async () => ({ subscription: { status: "active", items: { data: [{ price }] } }, line_items: { data: [] } }));
mock.module("@/lib/stripe.server", () => ({ createStripeClient: () => ({ prices: { list: async () => ({ data: [price] }) },
  products: { retrieve: async () => ({ name: "Fixture course" }) }, checkout: { sessions: { create, retrieve } } }),
  getStripeErrorMessage: (e: any) => e.message }));
const { createCheckoutSession, getSubscriptionSummary } = await import("../src/lib/payments.functions");
const timestamp = new Date().toISOString();
const input = () => ({ priceId: "live_sub_1m_v1", leadId: "00000000-0000-4000-8000-000000000001", environment: "sandbox" as const,
  customerEmail: "untrusted@example.com", returnUrl: "http://localhost:8080", consent: { termsVersion: "2026-08-17", privacyVersion: "2026-08-17", refundVersion: "2026-08-17", acceptedAt: timestamp, immediateAccessAt: timestamp } });
beforeEach(() => { create.mockClear(); update.mockClear(); lead = { email: "approved@example.com", full_name: "Local Fixture", phone: "+55 123456", admission_status: "approved", answers: { ...profileAnswers({ fullName: "Local Fixture", email: "approved@example.com", phone: "+55 123456", birthDate: "1980-01-01", country: "Brazil", city: "Fixture", address: "Fixture", profession: "Singer", musicLevel: "Beginner", academicExperience: "None", musicalPreferences: "Voice", motivation: "Practice" }), legal_consent: input().consent } };
  price = { id: "price_fixture", product: "prod_fixture", lookup_key: "live_sub_1m_v1", active: true, type: "recurring", currency: "usd", unit_amount: 14700, recurring: { interval: "month", interval_count: 1 } }; });
test("valid checkout preserves upfront automatic renewal and server lead email", async () => {
  await createCheckoutSession({ data: input() });
  expect(create).toHaveBeenCalledTimes(1);
  const params = create.mock.calls[0]?.[0] as any;
  expect(params.mode).toBe("subscription"); expect(params.customer_email).toBe("approved@example.com");
  expect(params.line_items[0].quantity).toBe(1); expect(params.metadata.auto_renew).toBe("true");
  expect(params.subscription_data.trial_period_days).toBeUndefined();
});
for (const [name, mutate] of [
  ["missing lead", () => { lead = null; }], ["unapproved lead", () => { lead.admission_status = "pending"; }],
  ["wrong currency", () => { price.currency = "eur"; }], ["wrong amount", () => { price.unit_amount = 1; }],
  ["wrong interval", () => { price.recurring.interval = "year"; }], ["wrong duration", () => { price.recurring.interval_count = 12; }],
] as const) test(`${name} blocks before session creation`, async () => { mutate(); const r = await createCheckoutSession({ data: input() }); expect("error" in r).toBe(true); expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); });
test("stale consent blocks before creation", async () => { const data = input(); data.consent.acceptedAt = "2020-01-01T00:00:00Z"; expect("error" in await createCheckoutSession({ data })).toBe(true); expect(create).not.toHaveBeenCalled(); });
for (const [key, tier] of [["live_sub_1m_v1", "live"], ["complete_sub_6m_v1", "complete"]] as const) test(`summary resolves ${key}`, async () => {
  price.lookup_key = key;
  const r = await getSubscriptionSummary({ data: { sessionId: "cs_test_fixture", environment: "sandbox" } });
  expect("tier" in r && r.tier).toBe(tier);
});
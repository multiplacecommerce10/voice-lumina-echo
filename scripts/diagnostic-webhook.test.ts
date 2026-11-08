import { mock, test, expect, beforeEach } from "bun:test";
import { createHmac } from "node:crypto";

mock.module("@tanstack/react-router", () => ({ createFileRoute: () => (config: any) => config }));
const audit = mock(async (_entry: any) => {});
const persist = mock(async (..._args: any[]) => ({ error: null }));
const accountUpdate = mock(async (..._args: any[]) => ({ error: null }));
const createUser = mock(async (..._args: any[]) => ({ data: { user: null }, error: { message: "already exists" } }));
const listUsers = mock(async () => ({ data: { users: [{ id: "existing-fixture", email: "owner@example.com" }] } }));
const generateLink = mock(async (..._args: any[]) => ({ data: { properties: { action_link: "https://example.com/local-set-password" } }, error: null }));
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ upsert: persist, insert: persist }),
  auth: { admin: { createUser, listUsers, updateUserById: accountUpdate, generateLink } },
} }));
mock.module("@/lib/webhook-audit.server", () => ({ recordWebhookAudit: audit }));
const lifecycle = mock(async (..._args: any[]) => ({ row: null, ctx: {}, duplicate: false }));
mock.module("@/lib/subscription-webhook.server", () => ({ processSubscriptionEvent: lifecycle }));
mock.module("@/lib/billing-summary.server", () => ({ buildBillingSummary: async () => null }));
const sendMail = mock(async (..._args: any[]) => ({ ok: true }));
mock.module("@/lib/hostinger-mail.server", () => ({ sendHostingerMail: sendMail }));
mock.module("@/lib/confirmation-email", () => ({ buildConfirmationEmail: () => ({ subject: "fixture", bodyHtml: "fixture", bodyText: "fixture" }), auditConfirmationEmail: () => [] }));
const automate = mock(async (..._args: any[]) => {});
mock.module("@/lib/make.server", () => ({ forwardToMake: automate }));
const { Route } = await import("../src/routes/api/public/payments/webhook");
const handler = (Route as any).server.handlers.POST;
const secret = "local-fixture-only-diagnostic-signing";
const oldSecret = process.env.PAYMENTS_LIVE_WEBHOOK_SECRET;
const oldMake = process.env.MAKE_FORWARDING_ENABLED;
process.env.PAYMENTS_LIVE_WEBHOOK_SECRET = secret;
process.env.MAKE_FORWARDING_ENABLED = "true";
process.on("exit", () => {
  if (oldSecret === undefined) delete process.env.PAYMENTS_LIVE_WEBHOOK_SECRET; else process.env.PAYMENTS_LIVE_WEBHOOK_SECRET = oldSecret;
  if (oldMake === undefined) delete process.env.MAKE_FORWARDING_ENABLED; else process.env.MAKE_FORWARDING_ENABLED = oldMake;
});
beforeEach(() => { for (const spy of [audit, persist, accountUpdate, createUser, listUsers, generateLink, lifecycle, sendMail, automate]) spy.mockClear(); });
function event(type = "checkout.session.completed", marked = true) {
  return { id: "evt_local_fixture", object: "event", livemode: true, type, data: { object: {
    id: type.startsWith("checkout.") ? "cs_live_fixture" : "pi_fixture", mode: "payment", currency: "usd",
    amount_total: 100, amount: 100, payment_status: "paid", customer_details: { email: "owner@example.com" },
    metadata: marked ? { payment_diagnostic: "conscious_voice_usd1_v1" } : {},
  } } };
}
async function deliver(e: any, signature: "valid" | "false" | "unsigned" = "valid") {
  const body = JSON.stringify(e), t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", signature === "false" ? "wrong-local-fixture" : secret).update(`${t}.${body}`).digest("hex");
  return handler({ request: new Request("https://example.com/api/public/payments/webhook?env=live", { method: "POST", body,
    headers: signature === "unsigned" ? {} : { "stripe-signature": `t=${t},v1=${sig}` } }) });
}
for (const type of ["checkout.session.completed", "checkout.session.expired", "payment_intent.succeeded", "charge.succeeded", "charge.refunded"]) {
  test(`signed live USD 1 ${type} is audit-only`, async () => {
    const response = await deliver(event(type)); expect(response.status).toBe(200);
    expect((await response.json()).diagnostic).toBe(true); expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]?.[0].requestPayload.amount_minor).toBe(100);
    for (const spy of [persist, lifecycle, createUser, accountUpdate, generateLink, sendMail, automate]) expect(spy).not.toHaveBeenCalled();
  });
}
for (const signature of ["false", "unsigned"] as const) test(`${signature} diagnostic is rejected before processing`, async () => {
  expect((await deliver(event(), signature)).status).toBe(400);
  expect(audit.mock.calls[0]?.[0].ok).toBe(false); expect(lifecycle).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled();
});
test("marked wrong amount is audited and rejected, not treated as course", async () => {
  const e = event(); e.data.object.amount_total = 14700;
  expect((await deliver(e)).status).toBe(400); expect(lifecycle).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled();
});
test("unmarked ordinary event still reaches persistence and lifecycle", async () => {
  const e = event("checkout.session.expired", false);
  expect((await deliver(e)).status).toBe(200); expect(persist).toHaveBeenCalled(); expect(lifecycle).toHaveBeenCalledTimes(1);
});
test("existing account paid flow never updates or emails a password", async () => {
  expect((await deliver(event("checkout.session.completed", false))).status).toBe(200);
  expect(lifecycle).toHaveBeenCalledTimes(1); expect(accountUpdate).not.toHaveBeenCalled();
  expect(createUser).not.toHaveBeenCalled(); expect(generateLink).not.toHaveBeenCalled();
});
test("new account chooses password through link without any password mutation", async () => {
  const { prepareStripeAccountAccess } = await import("../src/lib/stripe-account-access.server");
  const admin = { listUsers: mock(async () => ({ data: { users: [] } })),
    createUser: mock(async (p: any) => ({ data: { user: { id: "new-fixture", user_metadata: p.user_metadata } }, error: null })),
    generateLink, updateUserById: accountUpdate };
  await prepareStripeAccountAccess(admin, { email: "new@example.com", fullName: "Fixture", eventId: "evt_new" });
  expect(admin.createUser.mock.calls[0]?.[0].password).toBeUndefined();
  expect(generateLink.mock.calls[0]?.[0].type).toBe("recovery"); expect(accountUpdate).not.toHaveBeenCalled();
});
for (const signature of ["valid", "false", "unsigned"] as const) test(`BRL ${signature} signature gate preserves course isolation`,async()=>{
 const e=event(); e.data.object.currency="brl"; e.data.object.metadata={payment_diagnostic:"conscious_voice_brl1_v1"};
 expect((await deliver(e,signature)).status).toBe(signature==="valid"?200:400);
 expect(lifecycle).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled(); expect(createUser).not.toHaveBeenCalled();
});

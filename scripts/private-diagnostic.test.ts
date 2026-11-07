import { test, expect, mock, beforeEach } from "bun:test";
import { assertPayPalOrder, invitationValid, diagnosticFormSchema, assertDiagnosticOrigin, PAYPAL_DIAGNOSTIC_PAYEE } from "../src/lib/private-diagnostic-rules";
import { diagnosticStart, diagnosticPayPalReturn, hashDiagnosticToken } from "../src/lib/private-diagnostic.server";
import { classifyDiagnosticEvent } from "../src/lib/payment-diagnostic";

const token = "a".repeat(64), id = "11111111-1111-4111-8111-111111111111";
const profile = { fullName: "Local Fixture", birthDate: "1980-01-01", email: "fixture@example.com", phone: "+55 123456", country: "Brazil", city: "Local", address: "Fixture only", profession: "Educator", musicLevel: "Beginner", academicExperience: "None yet", musicalPreferences: "Singing", motivation: "Local test" };
let row: any, valid = true, createCalls = 0, captures = 0, approved = true, completed = false, pendingCapture = false;
let stripeCreates = 0;
let stripeParams: any;
const stripeSession = () => ({ id: "cs_live_fixture", livemode: true, metadata: { payment_diagnostic: "conscious_voice_usd1_v1", diagnostic_attempt: id }, mode: "payment", currency: "usd", amount_total: 100, ui_mode: "embedded_page", status: "open", payment_status: "unpaid", client_secret: "local-fixture-only", automatic_tax: { enabled: false }, total_details: { amount_tax: 0, amount_discount: 0 } });
mock.module("../src/lib/stripe.server", () => ({ createStripeClient: () => ({ prices: { list: async () => ({ data: [{ currency: "usd", unit_amount: 100, type: "one_time", product: "prod_fixture" }] }) }, products: { retrieve: async () => ({ name: "Convidado especial — US$ 1", metadata: { lovable_external_id: "conscious_voice_private_guest" } }) }, checkout: { sessions: { create: async (params: any, options: any) => { stripeCreates++; stripeParams = params; expect(options.idempotencyKey).toBe(`cv-diag-stripe-${id}`); return stripeSession(); }, retrieve: async () => stripeSession() } } }) }));
function order() { return { id: "TESTORDER12345", intent: "CAPTURE", status: completed ? "COMPLETED" : approved ? "APPROVED" : "PAYER_ACTION_REQUIRED", purchase_units: [{ reference_id: id, custom_id: `conscious_voice_usd1_v1:${id}`, payee: { merchant_id: PAYPAL_DIAGNOSTIC_PAYEE }, amount: { value: "1.00", currency_code: "USD" }, ...(completed ? { payments: { captures: [{ id: "CAPTUREFIXTURE", status: pendingCapture ? "PENDING" : "COMPLETED", amount: { value: "1.00", currency_code: "USD" } }] } } : {}) }], links: [{ rel: "payer-action", href: "https://www.paypal.com/checkoutnow?token=TESTORDER12345" }] }; }
const fetchSpy = mock(async (url: any, init: any = {}) => {
  if (String(url).includes("oauth2")) return Response.json({ access_token: "local-fixture" });
  if (init.method === "POST" && String(url).endsWith("/orders")) { createCalls++; expect(init.headers["PayPal-Request-Id"]).toBe(`cv-diag-create-${id}`); const body = JSON.parse(init.body); expect(body.purchase_units[0].amount).toEqual({ value: "1.00", currency_code: "USD" }); expect(body.intent).toBe("CAPTURE"); expect(body.purchase_units[0].description).toBe("Convidado especial — US$ 1"); return Response.json(order()); }
  if (init.method === "POST" && String(url).endsWith("/capture")) { captures++; completed = true; expect(init.headers["PayPal-Request-Id"]).toBe(`cv-diag-capture-${id}`); return Response.json(order()); }
  return Response.json(order());
});
mock.module("../src/lib/paypal.server", () => ({ getAccessToken: async () => "local-fixture", PAYPAL_API_BASE: { live: "https://local-fixture.invalid" } }));
const db: any = {
  from(table: string) {
    if (!table.startsWith("payment_diagnostic_")) throw new Error(`Forbidden course table: ${table}`);
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table.endsWith("invites") ? valid ? { id: "invite-fixture", expires_at: new Date(Date.now() + 3600000).toISOString(), revoked_at: null } : null : row, error: null }), update(fields: any) { return { eq: async () => { Object.assign(row, fields); return { error: null }; } }; } }; return q;
  },
  async rpc(name: string, args: any) { if (name === "reserve_payment_diagnostic") { row ??= { id, invite_id: "invite-fixture", provider: args.p_provider, created_at: new Date().toISOString(), status: "reserved", provider_id: null }; return { data: [row], error: null }; }
    if (name === "claim_diagnostic_creation") { if (row.capture_lock_until) return { data: [], error: null }; row.capture_lock_until = "fixture-lock"; return { data: [row], error: null }; }
    if (name === "cancel_diagnostic_attempt") { if (row.status === "capturing") return {data:false,error:null}; row.status="cancelled"; return {data:true,error:null}; }
    if (name === "claim_diagnostic_capture") { if (row.status === "capturing") return { data: [], error: null }; row.status = "capturing"; return { data: [row], error: null }; } throw new Error("Forbidden RPC"); },
};
beforeEach(() => { row = null; valid = true; createCalls = 0; captures = 0; stripeCreates = 0; approved = true; completed = false; pendingCapture = false; globalThis.fetch = fetchSpy as any; fetchSpy.mockClear(); });
test("expired, revoked, invalid invitations fail", async () => {
  expect(invitationValid(null)).toBe(false); expect(invitationValid({ expires_at: "invalid", revoked_at: null })).toBe(false);
  expect(invitationValid({ expires_at: new Date(Date.now()-1).toISOString(), revoked_at: null })).toBe(false);
  expect(invitationValid({ expires_at: new Date(Date.now()+1000).toISOString(), revoked_at: "now" })).toBe(false);
  valid = false; await expect(diagnosticStart(db, token, "paypal")).rejects.toThrow(); expect(createCalls).toBe(0);
});
test("form requires every shared field and explicit consent", () => {
  expect(diagnosticFormSchema.safeParse({ token, profile, consent: true, provider: "paypal" }).success).toBe(true);
  for (const key of Object.keys(profile)) expect(diagnosticFormSchema.safeParse({ token, profile: { ...profile, [key]: "" }, consent: true, provider: "paypal" }).success).toBe(false);
  expect(diagnosticFormSchema.safeParse({ token, profile, consent: false, provider: "paypal" }).success).toBe(false);
});
test("cross-origin and missing-origin writes rejected", () => { expect(() => assertDiagnosticOrigin(null, "https://site.test")).toThrow(); expect(() => assertDiagnosticOrigin("https://evil.test", "https://site.test")).toThrow(); expect(() => assertDiagnosticOrigin("https://site.test", "https://site.test", "cross-site")).toThrow(); expect(() => assertDiagnosticOrigin("https://site.test", "https://site.test", "same-origin")).not.toThrow(); });
test("authorized Stripe is one-time 100 USD, no automatic tax, exact offer and isolated metadata", async () => {
  await diagnosticStart(db, token, "stripe"); expect(stripeCreates).toBe(1);
  expect(stripeParams.mode).toBe("payment"); expect(stripeParams.ui_mode).toBe("embedded_page");
  expect(stripeParams.integration_identifier).toMatch(/^consciousvoice_sub_v2_[a-z]{8}$/);
  expect(stripeParams.line_items).toEqual([{ quantity: 1, price_data: { currency: "usd", unit_amount: 100, tax_behavior: "inclusive", product: "prod_fixture" } }]);
  expect(stripeParams.automatic_tax).toBeUndefined(); expect(stripeParams.subscription_data).toBeUndefined(); expect(stripeParams.customer).toBeUndefined();
  expect(stripeParams.payment_intent_data.description).toBe("Convidado especial — US$ 1");
  expect(stripeParams.metadata).toEqual({ payment_diagnostic: "conscious_voice_usd1_v1", diagnostic_attempt: id });
  expect(stripeParams.payment_intent_data.metadata).toEqual(stripeParams.metadata); expect(captures).toBe(0);
  await diagnosticStart(db, token, "stripe"); expect(stripeCreates).toBe(1);
});
test("concurrent Stripe starts create only one session", async () => { await Promise.allSettled([diagnosticStart(db,token,"stripe"),diagnosticStart(db,token,"stripe")]); expect(stripeCreates).toBe(1); });
test("repeat provider start reuses one order; no profile persisted", async () => { const a = await diagnosticStart(db, token, "paypal"), b = await diagnosticStart(db, token, "paypal"); expect(a.id).toBe(b.id); expect(createCalls).toBe(1); expect(row.profile).toBeUndefined(); expect(captures).toBe(0); });
test("concurrent provider starts allow only one creation call", async () => { await Promise.allSettled([diagnosticStart(db,token,"paypal"),diagnosticStart(db,token,"paypal")]); expect(createCalls).toBe(1); expect(captures).toBe(0); });
async function input() { await diagnosticStart(db, token, "paypal"); return { token, attempt: id, state: await hashDiagnosticToken(`${token}:${id}:paypal-return`), order: "TESTORDER12345", action: "read" as const }; }
test("wrong return state or order denied", async () => { const i = await input(); await expect(diagnosticPayPalReturn(db, { ...i, state: "b".repeat(64) })).rejects.toThrow(); await expect(diagnosticPayPalReturn(db, { ...i, order: "WRONGORDER123" })).rejects.toThrow(); expect(captures).toBe(0); });
test("approval/read never captures and cancelled cannot be paid", async () => { const i = await input(); expect((await diagnosticPayPalReturn(db,i)).approved).toBe(true); expect(captures).toBe(0); expect((await diagnosticPayPalReturn(db,{...i,action:"cancel"})).status).toBe("cancelled"); await expect(diagnosticPayPalReturn(db,{...i,action:"capture"})).rejects.toThrow(); expect(captures).toBe(0); });
test("unapproved capture rejected", async () => { const i=await input(); approved=false; await expect(diagnosticPayPalReturn(db,{...i,action:"capture"})).rejects.toThrow(); expect(captures).toBe(0); });
test("concurrent capture and replay produce one confirmed payment", async () => { const i=await input(); await Promise.all([diagnosticPayPalReturn(db,{...i,action:"capture"}),diagnosticPayPalReturn(db,{...i,action:"capture"})]); expect(captures).toBe(1); expect(row.status).toBe("paid"); expect((await diagnosticPayPalReturn(db,{...i,action:"capture"})).status).toBe("paid"); expect(captures).toBe(1); });
test("pending capture is not paid", async () => { const i=await input(); pendingCapture=true; expect((await diagnosticPayPalReturn(db,{...i,action:"capture"})).status).toBe("pending"); expect(row.paid_at).toBeUndefined(); });
test("wrong amount, currency, payee, reference or subscription intent denied", () => {
  const bound={id,provider_id:"TESTORDER12345",payee_id:PAYPAL_DIAGNOSTIC_PAYEE};
  for (const mutation of [(o:any)=>o.intent="SUBSCRIPTION",(o:any)=>o.purchase_units[0].amount.value="2.00",(o:any)=>o.purchase_units[0].amount.currency_code="BRL",(o:any)=>o.purchase_units[0].payee.merchant_id="OTHER",(o:any)=>o.purchase_units[0].reference_id="OTHER",(o:any)=>o.purchase_units[0].custom_id="OTHER"]) { const o=order(); mutation(o); expect(()=>assertPayPalOrder(o,bound)).toThrow(); }
});
test("diagnostic webhook facts reject excess tax totals, currency and subscriptions", () => { const e:any={livemode:true,type:"checkout.session.completed",data:{object:{metadata:{payment_diagnostic:"conscious_voice_usd1_v1"},amount_total:100,currency:"usd",mode:"payment"}}}; expect(classifyDiagnosticEvent(e,"live")?.valid).toBe(true); for(const fields of [{amount_total:101},{currency:"brl"},{mode:"subscription"},{subscription:"sub_x"}]) expect(classifyDiagnosticEvent({...e,data:{object:{...e.data.object,...fields}}},"live")?.valid).toBe(false); });
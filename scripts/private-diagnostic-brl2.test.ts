import { test, expect } from "bun:test";
import { diagnosticOffer, assertPayPalOrder } from "../src/lib/private-diagnostic-rules";
import { classifyDiagnosticEvent } from "../src/lib/payment-diagnostic";
const ev = (o: any) => ({ livemode: true, type: "checkout.session.completed", data: { object: { mode: "payment", ...o } } });
test("R$2 offer binds exact BRL 200 Stripe-only catalog", () => {
  const o = diagnosticOffer({ currency: "brl", amount_minor: 200, stripe_only: true }, "stripe");
  expect(o).toMatchObject({ amount: 200, currency: "brl", priceKey: "conscious_voice_private_guest_brl2_200", productName: "Special Guest — R$ 2", marker: "conscious_voice_brl2_v1", receiptAmount: "R$ 2.00" });
  expect(diagnosticOffer({ currency: "brl", amount_minor: 100, stripe_only: true }).marker).toBe("conscious_voice_brl1_v1");
  expect(diagnosticOffer({ currency: "usd", amount_minor: 100, stripe_only: false }).amount).toBe(100);
});
test("rejects USD200, other BRL amounts, PayPal and non-Stripe-only BRL2", () => {
  for (const b of [{ currency: "usd", amount_minor: 200, stripe_only: false }, { currency: "brl", amount_minor: 300, stripe_only: true }, { currency: "brl", amount_minor: 200, stripe_only: false }, { currency: "brl", amount_minor: 150, stripe_only: true }]) expect(() => diagnosticOffer(b)).toThrow();
  expect(() => diagnosticOffer({ currency: "brl", amount_minor: 200, stripe_only: true }, "paypal")).toThrow();
  expect(() => assertPayPalOrder({}, { id: "a", provider_id: "o", payee_id: null, currency: "brl", amount_minor: 200 })).toThrow();
});
test("webhook classification ties BRL2 marker to exactly 200 BRL", () => {
  const m = { payment_diagnostic: "conscious_voice_brl2_v1" };
  expect(classifyDiagnosticEvent(ev({ metadata: m, currency: "brl", amount_total: 200 }), "live")?.valid).toBe(true);
  for (const f of [{ amount_total: 100 }, { currency: "usd" }, { amount_total: 201 }]) expect(classifyDiagnosticEvent(ev({ metadata: m, currency: "brl", amount_total: 200, ...f }), "live")?.valid).toBe(false);
  expect(classifyDiagnosticEvent(ev({ metadata: m, currency: "brl", amount_total: 200 }), "sandbox")?.valid).toBe(false);
  expect(classifyDiagnosticEvent(ev({ metadata: { payment_diagnostic: "conscious_voice_brl1_v1" }, currency: "brl", amount_total: 200 }), "live")?.valid).toBe(false);
  expect(classifyDiagnosticEvent(ev({ metadata: { payment_diagnostic: "conscious_voice_usd1_v1" }, currency: "usd", amount_total: 200 }), "live")?.valid).toBe(false);
});

import { test, expect } from "bun:test";
import { validateOfficialInvoice } from "../src/lib/stripe-invoice-validation";
const sub = { id: "sub_fixture", livemode: true, items: { data: [{ quantity: 1, price: { lookup_key: "live_sub_3m_v1", active: true, type: "recurring", currency: "usd", unit_amount: 41895, recurring: { interval: "month", interval_count: 3 } } }] } };
const invoice = { id: "in_fixture", subscription: "sub_fixture", livemode: true, status: "paid", currency: "usd", amount_paid: 41895, amount_due: 41895 };
test("3-month Live exact 5 percent discount full term", () => expect(validateOfficialInvoice(invoice, sub, "live")?.amountUsd).toBe(418.95));
for (const change of [{ currency: "brl" }, { amount_paid: 100 }, { amount_due: 41896 }, { livemode: false }, { subscription: "sub_other" }, { status: "open" }]) test(`reject invoice ${Object.keys(change)[0]}`, () => expect(() => validateOfficialInvoice({ ...invoice, ...change }, sub, "live")).toThrow());
test("sandbox invoice cannot enter live", () => expect(() => validateOfficialInvoice(invoice, { ...sub, livemode: false }, "live")).toThrow());
test("quantity mutation rejected", () => expect(() => validateOfficialInvoice(invoice, { ...sub, items: { data: [{ ...sub.items.data[0], quantity: 2 }] } }, "live")).toThrow());
import { z } from "zod";
import { profileSchema } from "./enrollment-profile";
import { PAYMENT_DIAGNOSTIC, PAYMENT_DIAGNOSTIC_BRL, DIAGNOSTIC_LABEL } from "./payment-diagnostic";

export const PRIVATE_DIAGNOSTIC_VERSION = "private-guest-complete7d-saved-form-v4-20261107";
export const DIAGNOSTIC_ORIGIN = "https://consciousvoice.tecendosom.com";
export const PAYPAL_DIAGNOSTIC_PAYEE = "HNX3W9XUAPL7Y";
export const DIAGNOSTIC_TAX_NOTICE = "One real US$1 payment. Automatic tax calculation is off for this private test, as authorized by the owner. This does not establish a tax exemption.";
export const DIAGNOSTIC_PRICE_KEY = "conscious_voice_private_guest_usd1";
export const PRIVATE_BRL_VERSION = "private-guest-brl1-bound-v1-20261108";
export function diagnosticOffer(binding: { currency: string; amount_minor: number; stripe_only?: boolean }, provider?: string) {
  if (binding.amount_minor !== 100 || !["usd", "brl"].includes(binding.currency) ||
      (binding.currency === "brl" && (binding.stripe_only === false || (provider && provider !== "stripe"))) ||
      (binding.currency === "usd" && binding.stripe_only === true)) throw new Error("Private payment offer mismatch");
  const brl = binding.currency === "brl";
  return { currency: brl ? "brl" : "usd", amount: 100, stripeOnly: brl,
    priceKey: brl ? "conscious_voice_private_guest_brl1" : DIAGNOSTIC_PRICE_KEY,
    productKey: brl ? "conscious_voice_private_guest_brl" : "conscious_voice_private_guest",
    productName: brl ? "Special Guest — R$ 1" : DIAGNOSTIC_LABEL,
    marker: brl ? PAYMENT_DIAGNOSTIC_BRL : PAYMENT_DIAGNOSTIC,
    displayAmount: brl ? "R$ 1" : "US$ 1", receiptAmount: brl ? "R$ 1.00" : "US$ 1.00" };
}
export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const diagnosticSaveSchema = z.object({ token: invitationTokenSchema, profile: profileSchema, consent: z.literal(true) });
export const diagnosticFormSchema = diagnosticSaveSchema.extend({ provider: z.enum(["stripe", "paypal"]) });
export function invitationValid(invite: { expires_at: string; revoked_at: string | null } | null, now = Date.now()) {
  return !!invite && !invite.revoked_at && Number.isFinite(Date.parse(invite.expires_at)) && Date.parse(invite.expires_at) > now;
}
export function assertDiagnosticOrigin(origin: string | null, requestOrigin: string, fetchSite?: string | null) {
  if (!origin || origin !== requestOrigin || fetchSite === "cross-site") throw new Error("Request not permitted");
}
export function assertPayPalOrder(order: any, attempt: { id: string; provider_id: string | null; payee_id: string | null; currency?: string; amount_minor?: number }) {
  if (attempt.currency !== undefined) diagnosticOffer({ currency: attempt.currency, amount_minor: attempt.amount_minor ?? 0 }, "paypal");
  const units = order.purchase_units;
  if (order.id !== attempt.provider_id || order.intent !== "CAPTURE" || !Array.isArray(units) || units.length !== 1) throw new Error("Order does not match this test");
  const unit = units[0];
  if (unit.reference_id !== attempt.id || unit.custom_id !== `${PAYMENT_DIAGNOSTIC}:${attempt.id}` || unit.amount?.currency_code !== "USD" || unit.amount?.value !== "1.00" || unit.payee?.merchant_id !== PAYPAL_DIAGNOSTIC_PAYEE || attempt.payee_id !== PAYPAL_DIAGNOSTIC_PAYEE) throw new Error("Order payment facts do not match");
  const captures = unit.payments?.captures ?? [];
  if (captures.length > 1) throw new Error("Unexpected captures");
  const capture = captures[0];
  if (capture && (capture.amount?.currency_code !== "USD" || capture.amount?.value !== "1.00")) throw new Error("Capture facts do not match");
  return { approved: order.status === "APPROVED", paid: order.status === "COMPLETED" && capture?.status === "COMPLETED", captureId: capture?.id ?? null };
}
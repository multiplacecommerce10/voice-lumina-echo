import { z } from "zod";
import { profileSchema } from "./enrollment-profile";
import { PAYMENT_DIAGNOSTIC } from "./payment-diagnostic";

export const PRIVATE_DIAGNOSTIC_VERSION = "private-payer-v1-20261107";
export const DIAGNOSTIC_ORIGIN = "https://consciousvoice.tecendosom.com";
export const PAYPAL_DIAGNOSTIC_PAYEE = "HNX3W9XUAPL7Y";
export const STRIPE_TAX_BLOCK = "Stripe declined tax settings and registrations for this Brazilian account. Requested tax collection is unresolved; Stripe checkout is blocked. No exemption has been assumed.";
export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const diagnosticFormSchema = z.object({ token: invitationTokenSchema, profile: profileSchema, consent: z.literal(true), provider: z.enum(["stripe", "paypal"]) });
export function invitationValid(invite: { expires_at: string; revoked_at: string | null } | null, now = Date.now()) {
  return !!invite && !invite.revoked_at && Number.isFinite(Date.parse(invite.expires_at)) && Date.parse(invite.expires_at) > now;
}
export function assertDiagnosticOrigin(origin: string | null, requestOrigin: string, fetchSite?: string | null) {
  if (!origin || origin !== requestOrigin || fetchSite === "cross-site") throw new Error("Request not permitted");
}
export function assertPayPalOrder(order: any, attempt: { id: string; provider_id: string | null; payee_id: string | null }) {
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
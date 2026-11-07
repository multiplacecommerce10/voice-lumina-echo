import { SUBSCRIPTION_CATALOG } from "@/lib/subscription-catalog";
import { admissionAllowsCheckout, consentIsCurrent } from "@/lib/paypal-admission";
import { LEGAL_VERSIONS } from "@/lib/legal";

export function validateStripeCatalogPrice(key: string, price: {
  active: boolean; type: string; currency: string; unit_amount: number | null;
  recurring?: { interval: string; interval_count: number } | null;
  lookup_key?: string | null;
}) {
  const entry = Object.values(SUBSCRIPTION_CATALOG).flatMap(Object.values).find(e => e.lookupKey === key);
  if (!entry || price.lookup_key !== key || !price.active || price.type !== "recurring" ||
      price.currency !== "usd" || price.unit_amount !== Math.round(entry.amountUsd * 100) ||
      price.recurring?.interval !== "month" || price.recurring.interval_count !== entry.durationMonths) {
    throw new Error("The payment price does not match the approved catalog. Checkout was blocked.");
  }
  return entry;
}

export function validateCheckoutAdmission(
  lead: { email?: string | null; admission_status?: string | null } | null,
  consent: { termsVersion?: string; privacyVersion?: string; refundVersion?: string; acceptedAt?: string } | undefined,
  now: number,
) {
  if (!lead?.email) throw new Error("Please complete your enrollment details first.");
  if (!admissionAllowsCheckout(lead.admission_status)) {
    throw new Error("Enrollment is currently by review. Please request consideration and we will contact you.");
  }
  if (!consent?.termsVersion || !consent.privacyVersion || !consent.acceptedAt ||
      !consentIsCurrent({ ...consent, termsVersion: consent.termsVersion, privacyVersion: consent.privacyVersion, acceptedAt: consent.acceptedAt }, LEGAL_VERSIONS, now)) {
    throw new Error("Please review and accept the current terms before paying.");
  }
  return lead.email.toLowerCase();
}
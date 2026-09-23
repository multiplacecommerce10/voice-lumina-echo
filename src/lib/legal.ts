// Single source of truth for the seller's legal identity and document versions.
// Used by the footer, legal pages and the checkout consent record.

/**
 * Registered business address. Change ONLY here to move to a fiscal address:
 * every legal page, checkout disclosure and footer reads from these fields.
 */
export const LEGAL_ADDRESS = {
  street: "Avenida Orleães",
  number: "104",
  district: "Guarujá",
  city: "Porto Alegre",
  state: "RS",
  postalCode: "91770-620",
  country: "Brazil",
} as const;

/** "Avenida Orleães, 104 — Guarujá — Porto Alegre, RS — 91770-620 — Brazil" */
export const LEGAL_ADDRESS_FULL = `${LEGAL_ADDRESS.street}, ${LEGAL_ADDRESS.number} — ${LEGAL_ADDRESS.district} — ${LEGAL_ADDRESS.city}, ${LEGAL_ADDRESS.state} — ${LEGAL_ADDRESS.postalCode} — ${LEGAL_ADDRESS.country}`;

export const LEGAL = {
  sellerName: "Priscila Medina Gubert - ME",
  cnpj: "07.331.609/0001-92",
  /** Short public location for compact/promotional surfaces. */
  location: "Porto Alegre, RS, Brazil",
  address: LEGAL_ADDRESS,
  addressFull: LEGAL_ADDRESS_FULL,
  contactEmail: "contact@tecendosom.com",
  brand: "Tecendo Som",
  courseName: "The Power of Conscious Voice",
  effectiveDate: "August 17, 2026",
  withdrawalDays: 14,
  currency: "USD",
} as const;

/** Bump a version when the wording of that document materially changes. */
export const LEGAL_VERSIONS = {
  // Bumped: billing moved from one-time prepaid packages to automatically
  // renewing subscriptions (full period charged up front, 7-day grace on a
  // failed renewal, cancellation effective at period end).
  terms: "2026-08-17",
  privacy: "2026-08-17",
  refund: "2026-08-17",
} as const;

/** Plain-language billing terms reused across pricing, checkout and legal. */
export const BILLING_TERMS = {
  graceDays: 7,
  summary:
    "The full amount for the period you choose (1, 3 or 6 months) is charged up front and renews automatically for the same period, at the same price, until you cancel.",
  cancellation:
    "You may cancel at any time in the billing portal. Cancellation takes effect at the end of the period you have already paid for, and you keep access until then.",
  failedPayment:
    "If a renewal payment fails, the card is retried automatically and your access continues for 7 calendar days. If the payment is still unpaid after that window, access is suspended until it succeeds.",
  manualTransfer:
    "International bank transfers (Wise) are confirmed manually and cover a single period only. They do not renew automatically.",
} as const;

export const LEGAL_LINKS = [
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms-of-service", label: "Terms of Service" },
  { to: "/refund-policy", label: "Refund Policy" },
] as const;

export const LEGAL_IDENTITY_LINE = `${LEGAL.sellerName} · CNPJ ${LEGAL.cnpj} · ${LEGAL.location} · ${LEGAL.contactEmail}`;

/** Full legal identity, including the registered business address. */
export const LEGAL_IDENTITY_LINE_FULL = `${LEGAL.sellerName} · CNPJ ${LEGAL.cnpj} · ${LEGAL_ADDRESS_FULL} · ${LEGAL.contactEmail}`;

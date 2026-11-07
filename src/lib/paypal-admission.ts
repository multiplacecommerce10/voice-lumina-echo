/** Pure admission/consent rules for PayPal checkout (shared by server + tests). */

/** Only a recorded human approval on the lead allows checkout (rolling admission). */
export function admissionAllowsCheckout(status: string | null | undefined): boolean {
  return status === "approved";
}

export function consentIsCurrent(
  c: { termsVersion: string; privacyVersion: string; refundVersion?: string; acceptedAt: string },
  current: { terms: string; privacy: string; refund: string },
  now: number,
): boolean {
  const at = Date.parse(c.acceptedAt);
  if (Number.isNaN(at) || at > now + 5 * 60_000 || now - at > 24 * 3600_000) return false;
  return c.termsVersion === current.terms && c.privacyVersion === current.privacy && c.refundVersion === current.refund;
}

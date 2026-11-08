/** Server-created marker; never an alternative course checkout permission. */
export const PAYMENT_DIAGNOSTIC = "conscious_voice_usd1_v1";
export const PAYMENT_DIAGNOSTIC_BRL = "conscious_voice_brl1_v1";
export const PAYMENT_DIAGNOSTIC_BRL2 = "conscious_voice_brl2_v1";
/** Exact whitelisted facts per server marker; no other currency/amount is recognized. */
export const DIAGNOSTIC_MARKER_FACTS: Record<string, { currency: string; amount: number }> = {
  [PAYMENT_DIAGNOSTIC]: { currency: "usd", amount: 100 },
  [PAYMENT_DIAGNOSTIC_BRL]: { currency: "brl", amount: 100 },
  [PAYMENT_DIAGNOSTIC_BRL2]: { currency: "brl", amount: 200 },
};
export const DIAGNOSTIC_LABEL = "Convidado especial — US$ 1";
/** Visible English title only; provider objects and exact catalog validation keep DIAGNOSTIC_LABEL. */
export const DIAGNOSTIC_DISPLAY_LABEL = "Special Guest";

export function classifyDiagnosticEvent(event: { livemode?: boolean; type?: string; data?: { object?: any } }, env: string) {
  const obj = event.data?.object;
  const marker = obj?.metadata?.payment_diagnostic;
  const facts = typeof marker === "string" && Object.prototype.hasOwnProperty.call(DIAGNOSTIC_MARKER_FACTS, marker) ? DIAGNOSTIC_MARKER_FACTS[marker] : null;
  if (!facts) return null;
  const amount = obj.amount_total ?? obj.amount;
  const valid = env === "live" && event.livemode === true &&
    /^(checkout\.session\.|payment_intent\.|charge\.)/.test(event.type ?? "") &&
    obj.currency === facts.currency && amount === facts.amount &&
    (obj.mode === undefined || obj.mode === "payment") && !obj.subscription &&
    !obj.metadata.lead_id && !obj.metadata.tier && !obj.metadata.package;
  return { valid, amount, currency: obj.currency, objectId: obj.id };
}
/** Server-created marker; never an alternative course checkout permission. */
export const PAYMENT_DIAGNOSTIC = "conscious_voice_usd1_v1";
export const DIAGNOSTIC_LABEL = "Convidado especial — US$ 1";
/** Visible English title only; provider objects and exact catalog validation keep DIAGNOSTIC_LABEL. */
export const DIAGNOSTIC_DISPLAY_LABEL = "Special Guest — US$ 1";

export function classifyDiagnosticEvent(event: { livemode?: boolean; type?: string; data?: { object?: any } }, env: string) {
  const obj = event.data?.object;
  if (obj.metadata?.payment_diagnostic !== PAYMENT_DIAGNOSTIC) return null;
  const amount = obj.amount_total ?? obj.amount;
  const valid = env === "live" && event.livemode === true &&
    /^(checkout\.session\.|payment_intent\.|charge\.)/.test(event.type ?? "") &&
    obj.currency === "usd" && amount === 100 &&
    (obj.mode === undefined || obj.mode === "payment") && !obj.subscription &&
    !obj.metadata.lead_id && !obj.metadata.tier && !obj.metadata.package;
  return { valid, amount, currency: obj.currency, objectId: obj.id };
}
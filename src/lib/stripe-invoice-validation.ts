import { validateStripeCatalogPrice } from "./checkout-validation";
import { OFFERED_PRICE_KEYS, HISTORICAL_PRICE_KEYS } from "./payments-helpers";

/** Exact canonical invoice facts for currently offered plans; historical records remain separate. */
export function validateOfficialInvoice(invoice: any, sub: any, environment: string) {
  const key = sub?.items?.data?.[0]?.price?.lookup_key;
  if ((HISTORICAL_PRICE_KEYS as readonly string[]).includes(key)) return null;
  if (!(OFFERED_PRICE_KEYS as readonly string[]).includes(key)) throw new Error("Unknown course invoice catalog");
  const entry = validateStripeCatalogPrice(key, sub.items.data[0].price);
  const subscription = typeof invoice.subscription === "string" ? invoice.subscription : invoice.parent?.subscription_details?.subscription;
  if (sub.items.data.length !== 1 || sub.items.data[0].quantity !== 1 || sub.livemode !== (environment === "live") || invoice.livemode !== (environment === "live") || subscription !== sub.id || invoice.status !== "paid" || invoice.currency !== "usd" || invoice.amount_paid !== Math.round(entry.amountUsd * 100) || invoice.amount_due !== Math.round(entry.amountUsd * 100)) throw new Error("Course invoice payment facts mismatch");
  return entry;
}
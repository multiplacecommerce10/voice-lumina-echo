// UTM capture & persistence for GA4 attribution.
// Captures on first landing, persists in sessionStorage, exposes a getter
// that can be passed to backend calls (Stripe metadata, enrollment row, etc).
//
// PRIVACY: attribution data (UTM, gclid, fbclid, referrer, landing URL) is
// optional, non-essential data. Nothing is persisted or returned unless the
// visitor has allowed analytics or marketing in the privacy preferences.

import { attributionAllowed } from "@/lib/consent";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

const STORAGE_KEY = "ts_utm_v1";
const LANDING_KEY = "ts_landing_v1";
const REFERRER_KEY = "ts_referrer_v1";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Read UTMs from the current URL and persist them if any are present.
 * No-op without analytics/marketing consent.
 */
export function captureUtms(): UtmParams {
  const storage = safeStorage();
  if (!storage) return {};
  if (!attributionAllowed()) return {};


  const url = new URL(window.location.href);
  const found: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value) found[key] = value.slice(0, 200);
  }

  if (Object.keys(found).length > 0) {
    // First-touch wins: only store if not already captured this session.
    if (!storage.getItem(STORAGE_KEY)) {
      storage.setItem(STORAGE_KEY, JSON.stringify(found));
      storage.setItem(LANDING_KEY, window.location.href.slice(0, 500));
      storage.setItem(REFERRER_KEY, (document.referrer || "").slice(0, 500));
    }
  } else if (!storage.getItem(STORAGE_KEY)) {
    // No UTMs but still record landing + referrer once for context.
    storage.setItem(LANDING_KEY, window.location.href.slice(0, 500));
    storage.setItem(REFERRER_KEY, (document.referrer || "").slice(0, 500));
  }

  return getUtms();
}

/** Get the persisted UTM params for this session. */
export function getUtms(): UtmParams {
  const storage = safeStorage();
  if (!storage) return {};
  if (!attributionAllowed()) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmParams) : {};
  } catch {
    return {};
  }
}

/** Returns landing URL + referrer captured at first visit (for attribution). */
export function getAttributionContext(): {
  utms: UtmParams;
  landingUrl: string;
  referrer: string;
} {
  const storage = safeStorage();
  if (!attributionAllowed()) return { utms: {}, landingUrl: "", referrer: "" };
  return {
    utms: getUtms(),
    landingUrl: storage?.getItem(LANDING_KEY) ?? "",
    referrer: storage?.getItem(REFERRER_KEY) ?? "",
  };
}

/** Flatten UTMs into a short string (for spreadsheets / logs). */
export function utmsToString(utms: UtmParams): string {
  return Object.entries(utms)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Check if there are any UTMs in the current URL or sessionStorage. */
export function hasUtms(): boolean {
  const url = new URL(window.location.href);
  for (const key of UTM_KEYS) {
    if (url.searchParams.get(key)) return true;
  }
  return Object.keys(getUtms()).length > 0;
}

/** Re-run capture then return the merged UTMs (URL wins over storage for current click). */
export function ensureUtmsCaptured(): UtmParams {
  return captureUtms();
}

/** Append persisted UTMs to a URL so cross-page navigation keeps attribution. */
export function appendUtmsToUrl(url: string): string {
  const utms = getUtms();
  if (Object.keys(utms).length === 0) return url;

  const out = new URL(url, window.location.origin);
  for (const [key, value] of Object.entries(utms)) {
    if (value && !out.searchParams.has(key)) {
      out.searchParams.set(key, value);
    }
  }
  return out.pathname + out.search + out.hash;
}

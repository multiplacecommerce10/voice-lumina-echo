// Privacy preference store.
//
// Necessary technologies (session, checkout, security) are always on and are
// not covered by this store. Analytics and marketing stay OFF until the person
// makes an affirmative choice, and the choice can be changed at any time with
// the same number of clicks it took to give it.

export type ConsentState = {
  version: number;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string | null;
};

export const CONSENT_VERSION = 1;
const STORAGE_KEY = "cv_privacy_consent_v1";
export const CONSENT_EVENT = "cv-consent-change";

export const DEFAULT_CONSENT: ConsentState = {
  version: CONSENT_VERSION,
  analytics: false,
  marketing: false,
  decidedAt: null,
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getConsent(): ConsentState {
  const storage = safeLocalStorage();
  if (!storage) return DEFAULT_CONSENT;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return DEFAULT_CONSENT;
    return {
      version: CONSENT_VERSION,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function hasDecided(): boolean {
  return getConsent().decidedAt !== null;
}

export function analyticsAllowed(): boolean {
  return getConsent().analytics;
}

export function marketingAllowed(): boolean {
  return getConsent().marketing;
}

/** Attribution (UTM / gclid / fbclid / referrer) is analytics-or-marketing data. */
export function attributionAllowed(): boolean {
  const c = getConsent();
  return c.analytics || c.marketing;
}

export function setConsent(next: { analytics: boolean; marketing: boolean }): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    analytics: next.analytics,
    marketing: next.marketing,
    decidedAt: new Date().toISOString(),
  };
  const storage = safeLocalStorage();
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — the choice simply won't persist
  }
  if (!state.analytics || !state.marketing) clearNonEssentialStorage(state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  }
  if (state.analytics) loadAnalytics();
  else disableAnalytics();
  return state;
}

/** Remove optional data we may have stored under a previous, broader choice. */
function clearNonEssentialStorage(state: ConsentState) {
  try {
    if (!state.analytics && !state.marketing) {
      window.sessionStorage.removeItem("ts_utm_v1");
      window.sessionStorage.removeItem("ts_landing_v1");
      window.sessionStorage.removeItem("ts_referrer_v1");
    }
    if (!state.analytics) window.localStorage.removeItem("cta_clicks_v1");
  } catch {
    // ignore
  }
}

export const GA_MEASUREMENT_ID = "G-CRYX0DYS76";
/** Google's documented opt-out flag: window['ga-disable-<MEASUREMENT_ID>'] = true. */
export const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;
let analyticsLoaded = false;

/** Injects Google Analytics — only ever called after analytics consent. */
export function loadAnalytics() {
  if (typeof window === "undefined") return;
  if (!analyticsAllowed()) return;

  // Withdrawal may have set the documented opt-out flag earlier in this
  // page's life. Clear it first, otherwise gtag stays muted after re-consent.
  try {
    (window as unknown as Record<string, unknown>)[GA_DISABLE_FLAG] = false;
  } catch {
    // ignore
  }

  const existing = document.getElementById("ga-consent-script");
  if (analyticsLoaded && existing) return;
  if (existing) {
    // Script tag survived; just re-arm the config so sends resume.
    analyticsLoaded = true;
    pushGtagConfig();
    return;
  }
  analyticsLoaded = true;

  const script = document.createElement("script");
  script.id = "ga-consent-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.id = "ga-consent-inline";
  inline.text = `window['${GA_DISABLE_FLAG}']=false;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true});`;
  document.head.appendChild(inline);
}

function pushGtagConfig() {
  try {
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag === "function") {
      w.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
      });
      w.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
    }
  } catch {
    // ignore
  }
}

/**
 * Withdrawal of analytics consent. GA cannot be "unloaded" from a page that
 * already executed it, so we do everything Google documents plus best-effort
 * cleanup:
 *  1. set window['ga-disable-G-XXXX'] = true — the documented kill switch that
 *     makes any further gtag/analytics.js send a no-op;
 *  2. push a Consent Mode denial so a still-resident tag stops storing;
 *  3. remove the script elements we injected (safe: we own those ids);
 *  4. expire first-party _ga / _ga_* cookies on this host and its parent
 *     domains, across the common paths.
 */
export function disableAnalytics() {
  if (typeof window === "undefined") return;

  try {
    (window as unknown as Record<string, unknown>)[GA_DISABLE_FLAG] = true;
  } catch {
    // ignore
  }

  try {
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
    // Drop anything queued but not yet sent.
    if (Array.isArray(w.dataLayer)) w.dataLayer.length = 0;
  } catch {
    // ignore
  }

  // Only remove the elements this module created.
  for (const id of ["ga-consent-script", "ga-consent-inline"]) {
    try {
      document.getElementById(id)?.remove();
    } catch {
      // ignore
    }
  }
  analyticsLoaded = false;

  clearGoogleAnalyticsCookies();
}

/** Best-effort removal of first-party GA cookies (_ga and _ga_*). */
export function clearGoogleAnalyticsCookies() {
  if (typeof document === "undefined") return;
  try {
    const names = document.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim())
      .filter((n): n is string => !!n && (n === "_ga" || n.startsWith("_ga_") || n === "_gid"));

    const host = window.location.hostname;
    const parts = host.split(".");
    const domains: (string | null)[] = [null, host];
    for (let i = 1; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));

    const paths = ["/", window.location.pathname];
    const expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT";

    for (const name of names) {
      for (const path of paths) {
        for (const domain of domains) {
          document.cookie = `${name}=; ${expired}; path=${path}${domain ? `; domain=${domain}` : ""}`;
        }
      }
    }
  } catch {
    // ignore — cookie access can throw in restricted contexts
  }
}

/** Opens the preference panel from anywhere (e.g. footer control). */
export const OPEN_PREFERENCES_EVENT = "cv-open-privacy-preferences";
export function openPrivacyPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
}

// Lightweight client-side CTA tracking.
// Pushes events to window.dataLayer (GA4 / GTM compatible) and keeps a local
// counter in localStorage so we can inspect mobile vs desktop click volume
// without a third-party tool while we iterate on the layout.

type CTAId = "join" | "replay" | "scholarship";
type CTALocation = "final_cta" | "pricing" | "hero" | "nav" | "scholarships_section";

import { analyticsAllowed } from "@/lib/consent";

const STORAGE_KEY = "cta_clicks_v1";

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 640px)").matches;
}

export function trackCTAClick(cta: CTAId, location: CTALocation = "final_cta") {
  if (typeof window === "undefined") return;
  // Optional measurement: nothing is pushed or stored without consent.
  if (!analyticsAllowed()) return;

  const device = isMobile() ? "mobile" : "desktop";
  const payload = {
    event: "cta_click",
    cta_id: cta,
    cta_location: location,
    device,
    viewport_width: window.innerWidth,
    timestamp: new Date().toISOString(),
  };

  // GA4 / GTM
  // @ts-expect-error – dataLayer is injected by GTM when present
  window.dataLayer = window.dataLayer || [];
  // @ts-expect-error – see above
  window.dataLayer.push(payload);

  // Local aggregation for quick inspection in DevTools:
  // JSON.parse(localStorage.getItem("cta_clicks_v1"))
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : { counts: {}, events: [] };
    const key = `${device}:${location}:${cta}`;
    store.counts[key] = (store.counts[key] ?? 0) + 1;
    store.events.push(payload);
    // Cap history to last 200 events to avoid bloating storage
    if (store.events.length > 200) store.events = store.events.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage may be unavailable (private mode, quota) – fail silently
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[cta_click]", payload);
  }
}

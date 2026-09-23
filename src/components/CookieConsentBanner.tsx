import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CONSENT_EVENT,
  OPEN_PREFERENCES_EVENT,
  getConsent,
  hasDecided,
  loadAnalytics,
  setConsent,
  type ConsentState,
} from "@/lib/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = getConsent();
    setAnalytics(current.analytics);
    setMarketing(current.marketing);
    if (current.analytics) loadAnalytics();
    if (!hasDecided()) setVisible(true);

    const openPanel = () => {
      const c = getConsent();
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
      setPanelOpen(true);
      setVisible(true);
    };
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      if (detail) {
        setAnalytics(detail.analytics);
        setMarketing(detail.marketing);
      }
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, openPanel);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => {
      window.removeEventListener(OPEN_PREFERENCES_EVENT, openPanel);
      window.removeEventListener(CONSENT_EVENT, onChange);
    };
  }, []);

  if (!visible) return null;

  const decide = (next: { analytics: boolean; marketing: boolean }) => {
    setConsent(next);
    setPanelOpen(false);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy preferences"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-background/95 backdrop-blur shadow-2xl p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
          Privacy preferences
        </p>
        <p className="text-sm text-foreground/85 leading-relaxed">
          We use strictly necessary storage to run this site, keep your session and
          process your enrollment securely. Analytics and marketing technologies stay
          off unless you turn them on. You can change your choice at any time.{" "}
          <Link to="/privacy-policy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>

        {panelOpen && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">Strictly necessary</span>
                <span className="text-xs text-muted-foreground">Always active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Session, security, enrollment and checkout storage. Required for the
                site to work.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="text-sm font-medium block">Analytics</span>
                <span className="text-xs text-muted-foreground">
                  Google Analytics and campaign attribution (UTM, gclid, fbclid,
                  referrer). Loads only after you allow it.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="text-sm font-medium block">Marketing</span>
                <span className="text-xs text-muted-foreground">
                  Measuring campaign performance and showing you relevant offers.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="button"
            onClick={() => decide({ analytics: true, marketing: true })}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => decide({ analytics: false, marketing: false })}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-muted"
          >
            Reject non-essential
          </button>
          {panelOpen ? (
            <button
              type="button"
              onClick={() => decide({ analytics, marketing })}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-primary/50 text-primary text-sm font-semibold"
            >
              Save my choices
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Manage preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

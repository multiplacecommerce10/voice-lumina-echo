import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { COURSE_MODEL, TIER_BENEFITS } from "@/lib/entitlements";
import type { PackageConsent } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
// PayPal is intentionally NOT rendered: the existing PayPal integration is a
// recurring subscription product, which contradicts our one-time prepaid
// packages. The plan IDs below are preserved for a future one-time order flow.
import { StripeEmbeddedCheckout } from "./StripeEmbeddedCheckout";
import { LeadCaptureModal } from "./LeadCaptureModal";
import { resumeLead } from "@/lib/leads.functions";
import { ensureUtmsCaptured } from "@/lib/utm";
import { markCheckoutStarted, markCheckoutAbandoned } from "@/lib/lead-recovery.functions";


type Duration = "1" | "3" | "6";

// Legacy PayPal recurring plan IDs are preserved in src/lib/paypal-legacy.ts.

// Recurring subscription prices (USD): the full selected period is charged
// today and renews automatically for the same period until canceled.
const STRIPE_PRICES: Record<"live" | "complete", Record<Duration, string>> = {
  live: {
    "1": "live_sub_1m_v1",
    "3": "live_sub_3m_v1",
    "6": "live_sub_6m_v1",
  },
  complete: {
    "1": "complete_sub_1m_v1",
    "3": "complete_sub_3m_v1",
    "6": "complete_sub_6m_v1",
  },
};

const WISE_LINKS: Record<"live" | "complete", Record<Duration, string>> = {
  live: {
    "1": "https://wise.com/pay/r/msmPyGUWfMlAHf4",
    "3": "https://wise.com/pay/r/N0RkNU83KMrRUp8",
    "6": "https://wise.com/pay/r/wVB8lWczXmsKVoA",
  },
  complete: {
    "1": "https://wise.com/pay/r/_ymIpjyEDuIUVPE",
    "3": "https://wise.com/pay/r/fMj6ypWB21H4NQ4",
    "6": "https://wise.com/pay/r/qe9bJB99OGeTVEM",
  },
};

const durations: { id: Duration; label: string; sublabel: string; discount: number }[] = [
  { id: "1", label: "1 Month", sublabel: "flexible rhythm", discount: 0 },
  { id: "3", label: "3 Months", sublabel: "5% off", discount: 0.05 },
  { id: "6", label: "6 Months", sublabel: "10% off", discount: 0.10 },
];

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(n * 100) / 100);
}

function PriceBlock({ basePerMonth, duration, accent }: { basePerMonth: number; duration: Duration; accent: "primary" | "secondary" }) {
  const months = parseInt(duration, 10);
  const config = durations.find((d) => d.id === duration)!;
  const monthly = basePerMonth * (1 - config.discount);
  const total = monthly * months;
  const savings = basePerMonth * months - total;

  return (
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
        Charged today, then {months === 1 ? "every month" : `every ${months} months`}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl text-foreground">
          US${formatPrice(total)}
        </span>
        <span className="text-muted-foreground">
          for {months} {months === 1 ? "month" : "months"}
        </span>
      </div>
      <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
        Paid in full up front · Renews automatically every {months === 1 ? "month" : `${months} months`}{" "}
        at the same price until you cancel.
      </p>
      <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
        Equivalent to US${formatPrice(monthly)}/month — shown only for comparison, not billed monthly.
        {months > 1 && (
          <>
            {" · "}
            <span className={accent === "primary" ? "text-primary" : "text-secondary"}>
              save US${formatPrice(savings)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function PricingPlans() {
  const [duration, setDuration] = useState<Duration>("6");
  const [pendingPlan, setPendingPlan] = useState<
    {
      priceId: string;
      label: string;
      planIntended: string;
      method: "stripe" | "wise";
      wiseUrl?: string;
    } | null
  >(null);
  const [activeCheckout, setActiveCheckout] = useState<
    { priceId: string; leadId: string; email: string; consent?: PackageConsent } | null
  >(null);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const [resumeWelcome, setResumeWelcome] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  const startCheckout = useServerFn(markCheckoutStarted);
  const abandonCheckout = useServerFn(markCheckoutAbandoned);
  const resume = useServerFn(resumeLead);
  const abandonedRef = useRef<string | null>(null);

  // Every purchase path — card or international transfer — goes through the
  // same lead capture + legal acknowledgements before any payment page opens.
  const openLeadCapture = (tier: "live" | "complete", method: "stripe" | "wise" = "stripe") => {
    ensureUtmsCaptured();
    const priceId = STRIPE_PRICES[tier][duration];
    const planIntended = `${tier}__${duration}m`;
    const base =
      tier === "live"
        ? `International Online Course (${duration} month${duration === "1" ? "" : "s"})`
        : `Complete Course Access (${duration} month${duration === "1" ? "" : "s"})`;
    const label = method === "wise" ? `${base} — international transfer` : base;
    setPendingPlan({
      priceId,
      label,
      planIntended,
      method,
      ...(method === "wise" ? { wiseUrl: WISE_LINKS[tier][duration] } : {}),
    });
  };

  // Recovery email link: ?resume=CODE restores the exact plan the lead left behind
  // and reopens the secure payment step with their details already known.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("resume")) return;
    resumedRef.current = true;

    const code = (params.get("resume") ?? "").trim().toUpperCase();
    if (!code) {
      setResumeError(
        "This enrollment link is missing its recovery code. Please open the most recent email we sent you, or simply choose your plan below.",
      );
      return;
    }
    if (!/^[A-Z2-9]{6,40}$/.test(code)) {
      setResumeError(
        "That recovery code doesn't look valid. Please use the button in your enrollment email, or choose your plan below to continue.",
      );
      return;
    }

    setResumeLoading(true);
    resume({ data: { code } })
      .then((result) => {
        if ("error" in result || !result.email) {
          setResumeError(
            "We couldn't find an enrollment for that recovery code — it may have expired or already been completed. You can pick your plan below to continue.",
          );
          return;
        }
        const [tier, dur] = (result.planIntended ?? "live__6m").split("__");
        const parsedTier: "live" | "complete" = tier === "complete" ? "complete" : "live";
        const parsedDuration = ((dur ?? "6m").replace("m", "") || "6") as Duration;
        const safeDuration: Duration = (["1", "3", "6"] as Duration[]).includes(
          parsedDuration,
        )
          ? parsedDuration
          : "6";
        setResumeError(null);
        setDuration(safeDuration);
        setResumeWelcome(result.fullName?.split(" ")[0] ?? null);
        setActiveCheckout({
          priceId: STRIPE_PRICES[parsedTier][safeDuration],
          leadId: result.leadId,
          email: result.email,
        });
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      })
      .catch(() => {
        setResumeError(
          "We couldn't restore your enrollment right now. Please try the email link again in a moment, or choose your plan below.",
        );
      })
      .finally(() => setResumeLoading(false));
  }, [resume]);


  // Flag the lead as "reached payment" as soon as the checkout opens.
  useEffect(() => {
    if (!activeCheckout) return;
    abandonedRef.current = null;
    startCheckout({ data: { leadId: activeCheckout.leadId } }).catch(() => {});
  }, [activeCheckout, startCheckout]);


  const reportAbandon = (leadId: string, reason: string) => {
    if (abandonedRef.current === leadId) return;
    abandonedRef.current = leadId;
    abandonCheckout({ data: { leadId, reason } }).catch(() => {});
  };

  // Person closes the tab / navigates away mid-checkout.
  useEffect(() => {
    if (!activeCheckout) return;
    const handler = () => reportAbandon(activeCheckout.leadId, "left_page");
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [activeCheckout]);

  const closeCheckout = (reason: string) => {
    if (activeCheckout) {
      reportAbandon(activeCheckout.leadId, reason);
      setRecoveryNotice(true);
    }
    setActiveCheckout(null);
    setPendingPlan(null);
  };

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
      {pendingPlan && !activeCheckout && (
        <LeadCaptureModal
          planLabel={pendingPlan.label}
          planIntended={pendingPlan.planIntended}
          method={pendingPlan.method}
          onClose={() => setPendingPlan(null)}
          onCaptured={({ leadId, email, consent }) => {
            if (pendingPlan.method === "wise" && pendingPlan.wiseUrl) {
              // External one-time transfer: the consent record is already
              // stored with the lead; continue in the same tab.
              startCheckout({ data: { leadId } }).catch(() => {});
              setPendingPlan(null);
              window.location.href = pendingPlan.wiseUrl;
              return;
            }
            setActiveCheckout({ priceId: pendingPlan.priceId, leadId, email, consent });
          }}
        />
      )}
      {resumeLoading && !activeCheckout && (
        <div className="mb-8 mx-auto max-w-2xl glass-card rounded-2xl p-5 text-center ring-1 ring-primary/20">
          <p className="text-foreground/80">Restoring your enrollment…</p>
        </div>
      )}
      {resumeError && !activeCheckout && (
        <div
          role="alert"
          className="mb-8 mx-auto max-w-2xl glass-card rounded-2xl p-5 text-center ring-1 ring-destructive/40"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-destructive mb-2">
            Recovery link
          </p>
          <p className="text-foreground/90">{resumeError}</p>
          <button
            onClick={() => setResumeError(null)}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {recoveryNotice && !activeCheckout && (
        <div className="mb-8 mx-auto max-w-2xl glass-card rounded-2xl p-5 text-center ring-1 ring-primary/30">
          <p className="text-foreground/90">
            Your place is saved. We've kept your details and sent you an email with a link
            to finish your enrollment whenever you're ready.
          </p>
          <button
            onClick={() => setRecoveryNotice(false)}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {activeCheckout && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => closeCheckout("closed_backdrop")}
        >
          <div className="min-h-screen flex items-start justify-center p-4 sm:p-8">
            <div
              className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => closeCheckout("closed_checkout")}
                className="absolute -top-3 -right-3 z-10 w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted shadow-lg"
                aria-label="Close checkout"
              >
                ✕
              </button>
              {resumeWelcome !== null && (
                <div className="px-4 pt-5 text-center">
                  <p className="text-xs uppercase tracking-[0.25em] text-primary mb-1">
                    Welcome back
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resumeWelcome ? `${resumeWelcome}, we` : "We"} restored exactly where you
                    stopped — your details and plan are ready. Just complete the payment below.
                  </p>
                </div>
              )}
              <div className="p-2 sm:p-4">

                <StripeEmbeddedCheckout
                  priceId={activeCheckout.priceId}
                  customerEmail={activeCheckout.email}
                  leadId={activeCheckout.leadId}
                  consent={activeCheckout.consent}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Continuous Enrollment</p>
        <h2 className="font-display text-4xl lg:text-5xl">Choose your rhythm of study</h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Your chosen period is charged in full today and renews automatically for the same period,
          at the same price, until you cancel. Cancel any time from your billing portal — your
          access stays open until the end of the period you already paid for.
        </p>
      </div>

      {/* Duration toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-border/60 p-1 bg-card/40 backdrop-blur">
          {durations.map((d) => (
            <button
              key={d.id}
              onClick={() => setDuration(d.id)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                duration === d.id
                  ? "bg-gradient-to-r from-primary/20 to-secondary/15 text-foreground ring-1 ring-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-medium">{d.label}</span>
              {d.discount > 0 && (
                <span className={`ml-2 text-xs ${duration === d.id ? "text-primary" : "text-muted-foreground/70"}`}>
                  {d.sublabel}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        {/* International Online Course */}
        <div className="relative glass-card rounded-3xl p-8 lg:p-10 ring-glow-gold flex flex-col">
          <div className="absolute -top-3 left-8 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground text-xs font-semibold uppercase tracking-wider">
            Live Course
          </div>
          <h3 className="font-display text-3xl text-primary text-glow-gold mb-2">International Online Course</h3>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            For students who attend the weekly live cohort class and study the method
            through real-time guidance, individual sessions and the recorded Method
            Foundations Library. Class replays are not included in this tier.
          </p>
          <PriceBlock basePerMonth={147} duration={duration} accent="primary" />
          <ul className="space-y-3 mb-8 text-foreground/85 flex-1">
            {[
              ...TIER_BENEFITS.live,
              "Private student portal, guided practices and study materials",
              "Real-time Q&A during the live class",
            ].map((b) => (
              <li key={b} className="flex gap-3">
                <span className="text-primary mt-1">✦</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-[11px] uppercase tracking-[0.18em] text-primary/80">
            <span className="px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5">For singers & educators</span>
            <span className="px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5">Learning across the month</span>
          </div>
          <p className="text-center text-sm text-foreground/80 font-medium mb-2">
            Start your live-class enrollment
          </p>
          <button
            onClick={() => openLeadCapture("live")}
            className="block text-center w-full px-6 py-4 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.02] transition-transform"
          >
            Enroll now
          </button>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground/70 tracking-wider uppercase">Powered by</span>
            <span className="text-[13px] font-bold text-[#635BFF] tracking-tight lowercase">stripe</span>
          </div>
          <button
            type="button"
            onClick={() => openLeadCapture("live", "wise")}
            className="mt-3 flex items-center justify-center gap-2 w-full px-6 py-3 rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>
            International bank transfer (manual transfer — does not renew)
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Weekly 90-min live class · 2 individual 30-min sessions per 30-day cycle · Tuesdays 9:30–11:00 (São Paulo)
          </p>
          <p className="text-[11px] text-muted-foreground/70 text-center mt-2">
            ✧ The exclusive monthly VIP gathering is not included in this tier — it is part of
            Complete Course Access.
          </p>

          <p className="text-[11px] text-muted-foreground/70 text-center mt-2 italic">
            Card payments renew automatically for the same full period at the same price until you
            cancel. If a renewal fails, you keep access for 7 days while the payment is retried.
          </p>
          <p className="text-[11px] text-muted-foreground/70 text-center mt-2 italic">
            Card not working in your country? The manual international transfer via Wise works
            worldwide — including Pakistan, India and most regions. It covers a single period and
            does not renew: we confirm it by hand and contact you before each new period.
          </p>
        </div>

        {/* Complete Course Access */}
        <div className="relative glass-card rounded-3xl p-8 lg:p-10 ring-glow-cyan flex flex-col border border-secondary/40">
          <div className="absolute -top-3 left-8 px-4 py-1 rounded-full bg-gradient-to-r from-secondary to-[oklch(0.65_0.18_220)] text-secondary-foreground text-xs font-semibold uppercase tracking-wider">
            Course + Recordings
          </div>
          <div className="absolute -top-3 right-8 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-[10px] font-semibold uppercase tracking-widest">
            Recommended
          </div>
          <h3 className="font-display text-3xl text-secondary text-glow-cyan mb-2">Complete Course Access</h3>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Everything in the live tier, plus class replays from your own enrollment
            date, a detailed Vocal and Artistic Identity Analysis and an exclusive
            monthly VIP gathering.
          </p>
          <PriceBlock basePerMonth={197} duration={duration} accent="secondary" />
          <p className="text-sm text-foreground/80 mb-3 italic">
            Includes everything in the International Online Course, plus:
          </p>
          <ul className="space-y-3 mb-8 text-foreground/85 flex-1">
            {[
              ...TIER_BENEFITS.complete,
              "Review each class at your own rhythm — ideal for distant time zones",
            ].map((b) => (
              <li key={b} className="flex gap-3">
                <span className="text-secondary mt-1">✧</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mb-6 rounded-2xl border border-secondary/35 bg-secondary/5 px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-secondary mb-1">
              Complete only · Monthly VIP gathering
            </p>
            <p className="text-sm text-foreground/85 leading-relaxed">
              One exclusive online gathering with Cuca Medina each month, reserved for Complete
              members. After enrolment you confirm your place (RSVP) in your membership area and
              receive an email reminder before each gathering.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/80 italic">
              Date is announced each month. Duration and recording policy are confirmed with the
              invitation.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-[11px] uppercase tracking-[0.18em] text-secondary/85">
            <span className="px-2.5 py-1 rounded-full border border-secondary/30 bg-secondary/5">For singers & educators</span>
            <span className="px-2.5 py-1 rounded-full border border-secondary/30 bg-secondary/5">Study at your own rhythm</span>
            <span className="px-2.5 py-1 rounded-full border border-secondary/30 bg-secondary/5">Monthly VIP gathering</span>
          </div>

          <p className="text-center text-sm text-foreground/80 font-medium mb-2">
            Live classes + replays from your start date
          </p>
          <button
            onClick={() => openLeadCapture("complete")}
            className="block text-center w-full px-6 py-4 rounded-full bg-gradient-to-r from-secondary to-[oklch(0.65_0.18_220)] text-secondary-foreground font-semibold shadow-glow-cyan hover:scale-[1.02] transition-transform"
          >
            Enroll now
          </button>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground/70 tracking-wider uppercase">Powered by</span>
            <span className="text-[13px] font-bold text-[#635BFF] tracking-tight lowercase">stripe</span>
          </div>
          <button
            type="button"
            onClick={() => openLeadCapture("complete", "wise")}
            className="mt-3 flex items-center justify-center gap-2 w-full px-6 py-3 rounded-full border border-secondary/40 bg-secondary/5 hover:bg-secondary/10 text-secondary text-sm font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>
            International bank transfer (manual transfer — does not renew)
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Live classes + replays from your own enrollment date · no recordings from before you joined
          </p>
          <p className="text-[11px] text-muted-foreground/70 text-center mt-2 italic">
            Card payments renew automatically for the same full period at the same price until you
            cancel. If a renewal fails, you keep access for 7 days while the payment is retried.
          </p>
          <p className="text-[11px] text-muted-foreground/70 text-center mt-2 italic">
            Card not working in your country? The manual international transfer via Wise works
            worldwide — including Pakistan, India and most regions. It covers a single period and
            does not renew: we confirm it by hand and contact you before each new period.
          </p>
        </div>
      </div>

      <div className="mt-10 max-w-3xl mx-auto text-center space-y-3">
        <p className="text-sm text-muted-foreground italic">
          Discounts reflect a gesture of gratitude for committed study — not a
          discount on the value of the work.
        </p>
        <p className="text-sm text-primary/90">
          The Founding Cohort begins September 1, 2026 and holds a maximum of{" "}
          {COURSE_MODEL.cohort_max_active_students} active students. After it begins, admission
          continues only after a personal pedagogical review by Cuca Medina — a free place is
          never claimed automatically. If the cohort is full or under review, you can join the
          waiting list and request consideration.
        </p>
        <p className="text-sm text-muted-foreground">
          Your place is confirmed once payment is confirmed and admission is permitted. Your
          access, learning cycle and — for Complete Course Access — replay eligibility all begin
          on your own confirmed enrollment date. Card enrollments renew automatically for the same
          full period until canceled; cancellation takes effect at the end of the period you have
          already paid for. Changing tier or duration requires a short personal review — write to
          us and we will arrange it.
        </p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          Prices in USD. Your bank may apply conversion or international fees. Sold by{" "}
          {LEGAL.sellerName} · CNPJ {LEGAL.cnpj} · {LEGAL.addressFull} ·{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>
          . By enrolling you accept our{" "}
          <Link to="/terms-of-service" className="text-primary hover:underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </Link>{" "}
          (14-day withdrawal window) and{" "}
          <Link to="/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <figure className="mt-12 max-w-2xl mx-auto px-6">
        <div className="relative glass-card rounded-2xl p-6 lg:p-8 border border-primary/20">
          <span aria-hidden className="absolute -top-4 left-6 font-display text-5xl text-primary/60 leading-none">“</span>
          <blockquote className="text-foreground/90 italic leading-relaxed">
            I created this course for singers and music educators who want
            something deeper than a quick fix — a living practice that unfolds
            week by week, breath by breath. You will not be a number here.
          </blockquote>
          <figcaption className="mt-4 flex items-center justify-center gap-3 text-sm">
            <span className="h-px w-8 bg-primary/40" />
            <span className="font-display text-primary">Cuca Medina</span>
            <span className="text-muted-foreground">· M.Mus., 20+ years teaching voice</span>
          </figcaption>
        </div>
      </figure>
    </section>
  );
}

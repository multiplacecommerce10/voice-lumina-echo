import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  createPortalSession,
  getSubscriptionAccessSummary,
  type SubscriptionAccessSummary,
} from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { LEGAL } from "@/lib/legal";
import { COURSE_MODEL, resolveEntitlements, type Tier } from "@/lib/entitlements";

export const Route = createFileRoute("/membership")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Membership — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "See your enrollment for The Power of Conscious Voice: what you pay each period, when it renews, and when the course begins.",
      },
      { property: "og:title", content: "Your Membership — The Power of Conscious Voice" },
      {
        property: "og:description",
        content:
          "Your plan, billing period, renewal date and course start details in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembershipPage,
});

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null || !currency) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}


function buildSchedule(startIso: string | null, months: number | null) {
  if (!startIso || !months || months < 1) return [];
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];
  const out: { index: number; date: Date; isPast: boolean }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    out.push({ index: i + 1, date: d, isPast: d.getTime() < Date.now() });
  }
  return out;
}

// First class: Tuesday, September 1, 2026, 12:30 UTC (09:30 in São Paulo).
const COURSE_START_UTC = new Date(Date.UTC(2026, 8, 1, 12, 30));

function formatCourseStartUtc(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

function formatCourseStartLocal(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "long",
  }).format(date);
}

function localTimeZoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

function CourseStartCard() {
  const [localInfo, setLocalInfo] = useState<{ time: string; tz: string } | null>(null);

  useEffect(() => {
    setLocalInfo({
      time: formatCourseStartLocal(COURSE_START_UTC),
      tz: localTimeZoneName(),
    });
  }, []);

  return (
    <div className="glass-card rounded-3xl p-8 sm:p-10 ring-glow-cyan">
      <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
        Course start
      </p>
      <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-3">
        {formatCourseStartUtc(COURSE_START_UTC)}
      </h2>
      <p className="text-foreground/80">
        The first live session happens on the date and time above. That is the
        reference in UTC — the time shown in your confirmation and receipt is the
        universal reference for the class.
      </p>
      {localInfo && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
            In your local timezone ({localInfo.tz})
          </p>
          <p className="font-display text-xl text-primary">{localInfo.time}</p>
        </div>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        <span className="text-primary">●</span> Add this to your calendar now. The day is
        Tuesday, September 1, 2026. All sessions recur weekly from this starting point.
      </p>
    </div>
  );
}

function EntitlementsCard({ tier, enrolledAt }: { tier: Tier; enrolledAt: string | null }) {
  const e = resolveEntitlements(tier, enrolledAt);
  const enrolledLabel = (() => {
    if (!e.replay_access_from) return null;
    try {
      return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(e.replay_access_from));
    } catch {
      return null;
    }
  })();

  const rows: { label: string; value: string }[] = [
    { label: "Weekly live cohort class", value: "90 minutes, every Tuesday" },
    {
      label: "Private sessions",
      value: `${e.private_sessions_30m_per_30d} × 30 minutes per active 30-day cycle`,
    },
    {
      label: "Method Foundations Library",
      value: e.foundations_library_access
        ? "Included — recorded foundational vocal-technique videos"
        : "Not included",
    },
    {
      label: "Class replay access",
      value: e.replay_access
        ? enrolledLabel
          ? `Included, from your enrollment date (${enrolledLabel})`
          : "Included, from your own enrollment date"
        : "Not included in this tier",
    },
    {
      label: "Vocal and Artistic Identity Analysis",
      value: e.vocal_artistic_analysis
        ? "Included — personalized plan for technique, style and creative possibilities"
        : "Not included in this tier",
    },
    {
      label: "Monthly VIP gathering",
      value: e.monthly_vip_access ? "Included — one exclusive gathering each month" : "Not included in this tier",
    },
    {
      label: "Initial pedagogical mapping",
      value: `${e.initial_mapping_minutes} minutes in your first private session`,
    },
    {
      label: "Certificate of Completion",
      value: `Certificate of Completion — Professional Development in Singing and Vocal Technique. Eligible after ${e.certificate_eligibility_after_active_months} active months, on completion of the Method Foundations pathway and approval of the ${COURSE_MODEL.portfolio_name}`,
    },
  ];

  return (
    <div className="glass-card rounded-3xl p-8 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-primary mb-5">
        What your access includes
      </p>
      <dl className="divide-y divide-border/60">
        {rows.map((r) => (
          <div key={r.label} className="py-3 sm:flex sm:gap-6">
            <dt className="text-sm text-muted-foreground sm:w-1/3">{r.label}</dt>
            <dd className="text-sm text-foreground/90 sm:flex-1">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-muted-foreground/80 leading-relaxed">
        The Certificate of Completion — Professional Development in Singing and Vocal Technique — is awarded after six active months, completion of the Method Foundations pathway and approval of the Conscious Voice Transformation Portfolio. It documents completed professional development and demonstrated vocal and artistic growth; it is not an academic degree, professional license or automatic outcome of having paid tuition.
      </p>
      <p className="mt-3 text-xs text-muted-foreground/80 leading-relaxed">
        Replays and all access begin on your own confirmed enrollment date — there are no recordings from before you joined and no historical cohort archive.
      </p>
    </div>
  );
}

type VipRsvp = { attending: boolean; remindByEmail: boolean };

function vipStorageKey(sessionId: string | undefined) {
  return `cv_vip_rsvp_${sessionId ?? "anon"}`;
}

function VipGatheringCard({
  tier,
  sessionId,
  email,
}: {
  tier: Tier;
  sessionId?: string;
  email?: string | null;
}) {
  const included = resolveEntitlements(tier).monthly_vip_access;
  const [rsvp, setRsvp] = useState<VipRsvp>({ attending: false, remindByEmail: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(vipStorageKey(sessionId));
      if (raw) setRsvp({ ...{ attending: false, remindByEmail: true }, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [sessionId]);

  const update = (next: Partial<VipRsvp>) => {
    const merged = { ...rsvp, ...next };
    setRsvp(merged);
    try {
      window.localStorage.setItem(vipStorageKey(sessionId), JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  };

  if (!included) {
    return (
      <div className="glass-card rounded-3xl p-8 sm:p-10 opacity-90">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
          Monthly VIP gathering · Complete only
        </p>
        <h2 className="font-display text-2xl text-foreground mb-2">Not included in your tier</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The exclusive monthly VIP gathering with Cuca Medina is part of Complete Course Access.
          Everything else in your study path — the weekly live class, your individual sessions and
          the Method Foundations Library — continues unchanged. To move to Complete, write to{" "}
          {LEGAL.contactEmail}.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-8 sm:p-10 ring-glow-cyan">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="px-3 py-1 rounded-full border border-secondary/40 bg-secondary/10 text-secondary text-[10px] font-semibold uppercase tracking-[0.2em]">
          Complete only
        </span>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Monthly VIP gathering</p>
      </div>
      <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-3">
        One exclusive gathering with Cuca Medina each month
      </h2>
      <p className="text-foreground/80">
        As a Complete member you have one additional exclusive gathering every month, on top of your
        weekly live class and your individual sessions. The date of each gathering is announced in
        advance; its duration and recording policy are confirmed with the invitation.
      </p>

      {loaded && (
        <div className="mt-6 space-y-3">
          <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 px-5 py-4 cursor-pointer">
            <input
              type="checkbox"
              checked={rsvp.attending}
              onChange={(e) => update({ attending: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[oklch(0.72_0.15_200)]"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Reserve my place at the next VIP gathering
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                Your RSVP tells us to keep a seat for you. You can change it at any time.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 px-5 py-4 cursor-pointer">
            <input
              type="checkbox"
              checked={rsvp.remindByEmail}
              onChange={(e) => update({ remindByEmail: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[oklch(0.72_0.15_200)]"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Email me a reminder before each gathering
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                Sent to {email ?? "the address on your enrollment"} with the joining link.
              </span>
            </span>
          </label>

          <p
            className="text-xs text-muted-foreground/85"
            aria-live="polite"
          >
            {rsvp.attending
              ? "Your place is reserved for the next gathering."
              : "No place reserved yet — tick the box above when you want to join."}
            {rsvp.remindByEmail
              ? " Email reminders are on."
              : " Email reminders are off."}
          </p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Your preference is saved on this device and reviewed by the school before each
            gathering. To change the email address used for invitations, write to{" "}
            {LEGAL.contactEmail}.
          </p>
        </div>
      )}
    </div>
  );
}


function MembershipPage() {
  const { session_id } = Route.useSearch();
  const fetchSummary = useServerFn(getSubscriptionAccessSummary);
  const openPortal = useServerFn(createPortalSession);
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: SubscriptionAccessSummary }
    | { status: "error" }
  >({ status: session_id ? "loading" : "idle" });
  const [portal, setPortal] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  useEffect(() => {
    if (!session_id) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetchSummary({ data: { sessionId: session_id, environment: getStripeEnvironment() } })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          console.error("[membership] summary error:", res.error);
          setState({ status: "error" });
        } else setState({ status: "ready", data: res });
      })
      .catch((e) => {
        console.error("[membership] summary failed:", e);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [session_id, fetchSummary]);

  const handleManage = async () => {
    if (!session_id) return;
    setPortal({ busy: true, error: null });
    try {
      const res = await openPortal({
        data: {
          sessionId: session_id,
          returnUrl: `${window.location.origin}/membership?session_id=${session_id}`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in res) {
        setPortal({ busy: false, error: res.error });
        return;
      }
      setPortal({ busy: false, error: null });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setPortal({
        busy: false,
        error: e instanceof Error ? e.message : "Could not open the billing portal.",
      });
    }
  };

  const data = state.status === "ready" ? state.data : null;
  const active = data?.active === true;
  const amountPerPeriod = formatMoney(data?.amountPerPeriod ?? null, data?.currency ?? null);
  const months = data?.intervalMonths ?? null;
  const periodLabel = months ? (months === 1 ? "month" : `${months} months`) : null;
  const schedule = active ? buildSchedule(data?.startedAt ?? null, months) : [];
  const planLabel =
    data?.planName ??
    (data?.tier === "live"
      ? "International Online Course"
      : data?.tier === "complete"
        ? "Complete Course Access"
        : "Your enrollment");

  const longDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-16 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="glass-card rounded-3xl p-8 sm:p-10 ring-glow-gold">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
            Your enrollment
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-3">
            {planLabel}
          </h1>
          <p className="text-foreground/80">
            Your chosen period is paid in full up front and{" "}
            <strong>renews automatically for the same period, at the same price</strong>, until
            you cancel. Cancelling takes effect at the end of the period you have already paid
            for.
          </p>

          {state.status === "loading" && (
            <div className="mt-8 flex items-center gap-3 text-muted-foreground">
              <span className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading your enrollment details…
            </div>
          )}

          {state.status === "error" && (
            <p className="mt-8 text-sm text-amber-500/90">
              We couldn't load your enrollment details right now. Nothing is confirmed on this
              screen — please check the receipt email or write to {LEGAL.contactEmail}.
            </p>
          )}

          {state.status === "idle" && (
            <p className="mt-8 text-sm text-muted-foreground">
              Open this page from your confirmation screen or receipt email to see your
              personal enrollment details.
            </p>
          )}

          {data && !active && data.accessStatus === "suspended" && (
            <p className="mt-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-500/90">
              Your access is currently suspended because a renewal payment was not completed
              within the grace period. Update your payment method below to restore it — your
              original enrollment date and progress are kept.
            </p>
          )}

          {data && !active && data.accessStatus !== "suspended" && (
            <p className="mt-8 text-sm text-amber-500/90">
              This enrollment is not confirmed as paid yet
              {data.status ? ` (status: ${data.status})` : ""}. Some payment methods take a
              little longer to settle. We'll email you as soon as it clears — no action is
              needed from you.
            </p>
          )}


          {data && active && (
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Cell
                label={periodLabel ? `Every ${periodLabel}` : "Each period"}
                value={amountPerPeriod ?? "—"}
              />
              <Cell
                label={data.cancelAtPeriodEnd ? "Access ends" : "Next charge"}
                value={longDate(data.currentPeriodEnd) ?? "—"}
              />
              <Cell
                label="Billing period"
                value={periodLabel ? `${periodLabel} up front` : "—"}
              />
            </div>
          )}

          {data && active && (
            <p className="mt-4 text-sm text-muted-foreground">
              {amountPerPeriod
                ? `${amountPerPeriod} is charged every ${periodLabel ?? "period"}`
                : "Your plan is billed at the start of every period"}
              {longDate(data.startedAt) && `, starting ${longDate(data.startedAt)}`}
              {data.customerEmail && `. Receipts are sent to ${data.customerEmail}`}
              {data.cancelAtPeriodEnd
                ? `. Your cancellation is scheduled: access stays open until ${longDate(data.currentPeriodEnd) ?? "the end of the paid period"} and nothing else will be charged.`
                : `. It renews automatically until you cancel.`}
            </p>
          )}

          {data && data.graceExpiresAt && data.accessStatus === "past_due_grace" && (
            <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-500/90">
              Your last renewal payment did not go through. Your access stays open until{" "}
              {longDate(data.graceExpiresAt) ?? "the end of the grace period"} while the payment
              is retried automatically. Update your payment method below to keep everything
              running.
            </p>
          )}

          {data && data.studentEnrolledAt && (
            <p className="mt-4 text-sm text-muted-foreground">
              Enrolled since {longDate(data.studentEnrolledAt)}
              {data.paidActiveMonths != null &&
                ` · ${data.paidActiveMonths} paid active month${data.paidActiveMonths === 1 ? "" : "s"}`}
              {data.certificateMonthsRemaining != null &&
                (data.certificateMonthsRemaining > 0
                  ? ` · ${data.certificateMonthsRemaining} more month${data.certificateMonthsRemaining === 1 ? "" : "s"} until Certificate eligibility`
                  : " · Certificate eligibility months completed")}
              .
            </p>
          )}

          {data && data.last4 && (
            <p className="mt-3 text-xs text-muted-foreground/80">
              Card ending in {data.last4}.
            </p>
          )}

          {session_id && (
            <div className="mt-8">
              <button
                type="button"
                onClick={handleManage}
                disabled={portal.busy}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-primary/50 text-primary font-semibold text-sm hover:bg-primary/10 transition disabled:opacity-60"
              >
                {portal.busy ? "Opening billing portal…" : "Manage subscription"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                Opens in a new tab. There you can update your payment method, download invoices
                and receipts, and cancel at the end of your paid period. Changing tier or
                duration is done personally — write to {LEGAL.contactEmail}.
              </p>
              {portal.error && (
                <p className="mt-2 text-xs text-amber-500/90">{portal.error}</p>
              )}
            </div>
          )}
        </div>

        {data && active && (data.tier === "live" || data.tier === "complete") && (
          <>
            <EntitlementsCard tier={data.tier} enrolledAt={data.startedAt ?? null} />
            <VipGatheringCard
              tier={data.tier}
              sessionId={session_id}
              email={data.customerEmail ?? null}
            />
          </>
        )}


        <CourseStartCard />

        <div className="glass-card rounded-3xl p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-5">
            How your billing works
          </p>
          <ol className="space-y-5">
            {[
              {
                title: "Full period charged up front",
                body: "The whole amount for the period you chose (1, 3 or 6 months) is charged at checkout. Your access opens as soon as the payment is confirmed and admission is permitted.",
              },
              {
                title: "Automatic renewal, same price",
                body: "At the end of each period the same amount is charged again for the same length of time, keeping your discount, until you cancel.",
              },
              {
                title: "If a renewal payment fails",
                body: "Your card is retried automatically and you keep full access for 7 calendar days. If it is still unpaid after that window, access is suspended until the payment succeeds.",
              },
              {
                title: "Cancel whenever you wish",
                body: "Cancel in the billing portal. It takes effect at the end of the period you already paid for — you keep access until then and are never charged again.",
              },
              {
                title: "Changing tier or duration",
                body: "Switching between Live and Complete, or changing the length of your period, is handled personally after a short review. Write to contact@tecendosom.com and we will arrange it.",
              },
              {
                title: "14-day withdrawal",
                body: "You may withdraw within 14 calendar days of purchase by emailing contact@tecendosom.com. See the Refund Policy for how proportionate deductions apply once access has begun.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full border border-primary/40 text-primary flex items-center justify-center text-sm font-medium">
                  {i + 1}
                </span>
                <div>
                  <h2 className="font-medium text-foreground mb-1">{step.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {schedule.length > 0 && (
          <div className="glass-card rounded-3xl p-8 sm:p-10">
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-5">
              Your current period
            </p>
            <ul className="divide-y divide-border/60">
              {schedule.map((row) => (
                <li key={row.index} className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">
                    Month {row.index}
                  </span>
                  <span className="text-sm text-foreground/90">
                    {new Intl.DateTimeFormat("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(row.date)}
                  </span>
                  <span
                    className={`text-xs uppercase tracking-[0.2em] ${
                      row.isPast ? "text-primary" : "text-muted-foreground/70"
                    }`}
                  >
                    {row.isPast ? "Started" : "Upcoming"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted-foreground/80">
              Months already covered by the payment you made. The next charge happens only at the
              end of this period{data?.cancelAtPeriodEnd ? ", unless your scheduled cancellation takes effect first" : ""}.
            </p>
          </div>
        )}

        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold text-sm"
          >
            Back to home
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground/80 leading-relaxed">
          Sold by {LEGAL.sellerName} · CNPJ {LEGAL.cnpj} · {LEGAL.addressFull} ·{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>
          {" · "}
          <Link to="/terms-of-service" className="text-primary hover:underline">Terms</Link>
          {" · "}
          <Link to="/refund-policy" className="text-primary hover:underline">Refunds</Link>
          {" · "}
          <Link to="/privacy-policy" className="text-primary hover:underline">Privacy</Link>
        </p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

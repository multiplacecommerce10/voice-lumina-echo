import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getCheckoutSummary, type CheckoutSummary } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function formatAmount(amount: number | null, currency: string | null) {
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

const LIVE_NEXT_STEPS = [
  {
    title: "Check your inbox",
    body: "Your receipt is on its way. Within 24 hours you'll receive a welcome email with your private member link.",
  },
  {
    title: "Save the rhythm",
    body: "Live sessions are Tuesdays, 9:30–11:00 (São Paulo time). A calendar invite with the Zoom link arrives before the first class.",
  },
  {
    title: "Prepare your space",
    body: "Find a quiet room, headphones, and water. Cuca will guide you the rest of the way.",
  },
];

const REPLAY_NEXT_STEPS = [
  {
    title: "Check your inbox",
    body: "Your receipt and access details are on their way within 24 hours.",
  },
  {
    title: "Library access",
    body: "You'll receive a link to the full replay library — every session, on your own time.",
  },
  {
    title: "Move at your rhythm",
    body: "Recordings stay available for the duration of your pass, so you can return as often as you need.",
  },
];

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const fetchSummary = useServerFn(getCheckoutSummary);
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: CheckoutSummary }
    | { status: "error" }
  >({ status: session_id ? "loading" : "idle" });

  useEffect(() => {
    if (!session_id) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetchSummary({ data: { sessionId: session_id, environment: getStripeEnvironment() } })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          // Never surface internal Stripe error text to the customer.
          console.error("[checkout-return] summary error:", res.error);
          setState({ status: "error" });
        } else setState({ status: "ready", data: res });
      })
      .catch((e) => {
        console.error("[checkout-return] summary failed:", e);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [session_id, fetchSummary]);

  if (!session_id) {
    return <Shell><EmptyState /></Shell>;
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Checking your payment status…</p>
        </div>
      </Shell>
    );
  }

  // We could not verify the session at all — never imply a confirmed purchase.
  if (state.status === "error") {
    return (
      <Shell>
        <NotConfirmed
          session_id={session_id}
          heading="We couldn't verify this payment"
          body="Your payment may still have gone through, but we can't confirm it on this screen right now. Please check your email for a Stripe receipt, and contact us with the reference below if anything looks wrong."
        />
      </Shell>
    );
  }

  if (state.status !== "ready") return <Shell><EmptyState /></Shell>;

  const summary = state.data;
  const isPaid =
    summary.status === "complete" &&
    (summary.paymentStatus === "paid" || summary.paymentStatus === "no_payment_required");

  if (isPaid) {
    return (
      <Shell>
        <Confirmed session_id={session_id} summary={summary} />
      </Shell>
    );
  }

  const isPending =
    summary.status === "open" ||
    summary.paymentStatus === "unpaid" ||
    summary.paymentStatus === "processing";

  if (isPending) {
    return (
      <Shell>
        <NotConfirmed
          session_id={session_id}
          tone="pending"
          heading="Your payment is still being processed"
          body="Some payment methods take a little longer to settle. Nothing is confirmed yet — as soon as the payment clears we'll email you the confirmation and access details. You don't need to pay again."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <NotConfirmed
        session_id={session_id}
        heading="This checkout was not completed"
        body="We didn't record a completed payment for this session — it may have expired or been cancelled. You can return to the pricing section and start again, or contact us with the reference below."
      />
    </Shell>
  );
}

function NotConfirmed({
  session_id,
  heading,
  body,
  tone = "warning",
}: {
  session_id: string;
  heading: string;
  body: string;
  tone?: "warning" | "pending";
}) {
  return (
    <div className="glass-card rounded-3xl p-10 text-center space-y-5">
      <div
        className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl ${
          tone === "pending" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-500"
        }`}
      >
        {tone === "pending" ? "⧗" : "!"}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl text-foreground">{heading}</h1>
      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">{body}</p>
      <p className="text-xs text-muted-foreground/70 font-mono break-all">
        Ref: {session_id.slice(0, 24)}…
      </p>
      <p className="text-sm text-muted-foreground">
        Support:{" "}
        <a href="mailto:contact@tecendosom.com" className="text-primary hover:underline">
          contact@tecendosom.com
        </a>
      </p>
      <BackHomeButton />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card rounded-3xl p-10 text-center">
      <h1 className="font-display text-3xl mb-4">No session information</h1>
      <p className="text-muted-foreground mb-6">We couldn't find a checkout session.</p>
      <BackHomeButton />
    </div>
  );
}

/** Rendered ONLY for a Stripe session that is complete AND paid. */
function Confirmed({
  session_id,
  summary,
}: {
  session_id: string;
  summary: CheckoutSummary;
}) {
  const tier = summary.tier ?? null;
  const months = summary.durationMonths ?? null;
  const planLabel =
    summary.productName ??
    (tier === "live"
      ? "International Online Course"
      : tier === "complete"
        ? "Complete Course Access"
        : "Your enrollment");
  const tierTag =
    tier === "live"
      ? "International Online Course"
      : tier === "complete"
        ? "Complete Course Access"
        : "Enrollment";
  const durationLabel = months ? `${months} month${months === 1 ? "" : "s"}` : null;
  const amount = formatAmount(summary.amountTotal ?? null, summary.currency ?? null);
  const steps = tier === "complete" ? REPLAY_NEXT_STEPS : LIVE_NEXT_STEPS;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-10 ring-glow-gold text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 text-primary text-2xl mb-5">
          ✦
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
          Enrollment confirmed
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground mb-3">
          Welcome — your seat is held.
        </h1>
        <p className="text-foreground/80 max-w-md mx-auto">
          Thank you for stepping into <span className="italic">The Power of Conscious Voice</span>.
          Cuca and the team will be in touch shortly.
        </p>

        <div className="mt-8 inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 sm:divide-x divide-border/60 rounded-2xl border border-border/60 bg-card/40 px-2 py-3">
          <SummaryCell label="Plan" value={tierTag} />
          {durationLabel && <SummaryCell label="Duration" value={durationLabel} />}
          {amount && <SummaryCell label="Total" value={amount} />}
        </div>

        {summary?.customerEmail && (
          <p className="text-sm text-muted-foreground mt-5">
            Receipt sent to{" "}
            <span className="text-foreground/90 font-medium">{summary.customerEmail}</span>
          </p>
        )}
      </div>

      <div className="glass-card rounded-3xl p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-5">
          Your next steps
        </p>
        <h2 className="font-display text-2xl sm:text-3xl mb-6">
          {planLabel}
        </h2>
        <ol className="space-y-5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full border border-primary/40 text-primary flex items-center justify-center text-sm font-medium">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground/70 font-mono break-all">
            Ref: {session_id.slice(0, 24)}…
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/membership"
              search={{ session_id }}
              className="inline-block px-6 py-3 rounded-full border border-primary/50 text-primary font-semibold text-sm text-center"
            >
              View your enrollment and billing
            </Link>
            <BackHomeButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-2 text-left sm:text-center">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function BackHomeButton() {
  return (
    <Link
      to="/"
      className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold text-sm"
    >
      Back to home
    </Link>
  );
}

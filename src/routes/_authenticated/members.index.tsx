import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyMembership, type Membership } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/")({
  component: MembersHome,
});

function MembersHome() {
  const [state, setState] = useState<
    | { loading: true }
    | { loading: false; email: string; membership: Membership | null; active: boolean }
  >({ loading: true });

  useEffect(() => {
    void getMyMembership().then((res) => {
      if ("error" in res) {
        setState({ loading: false, email: "", membership: null, active: false });
      } else {
        setState({ loading: false, email: res.email, membership: res.membership, active: res.active });
      }
    });
  }, []);

  if (state.loading) {
    return <p className="p-10 text-sm text-muted-foreground">Loading your membership…</p>;
  }

  if (!state.membership) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">No enrollment found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not find an enrollment for <strong>{state.email}</strong>. If you recently
          enrolled, access begins after your payment is confirmed and your admission is reviewed.
        </p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Back to the course page
        </Link>
      </main>
    );
  }

  const m = state.membership;
  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome{m.fullName ? `, ${m.fullName.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Your member area for The Power of Conscious Voice.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {m.tier === "complete" ? "Complete" : m.tier === "live" ? "Live" : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Access</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {m.accessStatus === "active" ? "Active" : m.accessStatus === "grace" ? "Grace period" : m.accessStatus}
          </p>
          {m.currentPeriodEnd && (
            <p className="mt-1 text-xs text-muted-foreground">
              Paid through {new Date(m.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active months</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{m.paidActiveMonths}</p>
          <p className="mt-1 text-xs text-muted-foreground">Certificate eligibility begins at 6</p>
        </div>
      </div>

      {!state.active && (
        <p className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Your access is not active right now. If you believe this is a mistake, contact us at{" "}
          <a className="text-primary underline" href="mailto:contact@tecendosom.com">contact@tecendosom.com</a>.
        </p>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link to="/members/classes" className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted">
          <h2 className="font-semibold text-foreground">Classes & replays</h2>
          <p className="mt-1 text-sm text-muted-foreground">Weekly live class link and your replays.</p>
        </Link>
        <Link to="/members/foundations" className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted">
          <h2 className="font-semibold text-foreground">Foundations Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">The recorded Method Foundations, always available.</p>
        </Link>
        <Link to="/members/sessions" className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted">
          <h2 className="font-semibold text-foreground">Individual sessions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Book your two 30-minute sessions per cycle and watch your recordings.</p>
        </Link>
        <Link to="/members/portfolio" className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted">
          <h2 className="font-semibold text-foreground">Portfolio & certificate</h2>
          <p className="mt-1 text-sm text-muted-foreground">Submit your Transformation Portfolio and track your review.</p>
        </Link>
      </div>
    </main>
  );
}

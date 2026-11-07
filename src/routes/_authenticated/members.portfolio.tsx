import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getMyPortfolio, submitPortfolio, type Portfolio } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/portfolio")({
  component: PortfolioPage,
});

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted — waiting for review",
  in_review: "In review by Cuca Medina",
  approved: "Approved — congratulations!",
  returned: "Returned with guidance — you may resubmit",
};

type State =
  | { loading: true }
  | { loading: false; active: boolean; paidActiveMonths: number; portfolio: Portfolio | null };

function PortfolioPage() {
  const [state, setState] = useState<State>({ loading: true });
  const [initialSampleUrl, setInitialSampleUrl] = useState("");
  const [finalSampleUrl, setFinalSampleUrl] = useState("");
  const [creationUrl, setCreationUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await getMyPortfolio();
    if ("error" in res) {
      setState({ loading: false, active: false, paidActiveMonths: 0, portfolio: null });
    } else {
      setState({
        loading: false,
        active: res.active,
        paidActiveMonths: res.paidActiveMonths,
        portfolio: res.portfolio,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await submitPortfolio({
      data: { initialSampleUrl, finalSampleUrl, creationUrl, reflection },
    });
    if ("error" in res) {
      setNotice(
        res.error === "not_eligible_yet"
          ? "Certificate eligibility begins after six active months."
          : "Could not submit your portfolio. Please check the links and try again.",
      );
    } else {
      setNotice("Portfolio submitted! You will see the review status here.");
      setInitialSampleUrl("");
      setFinalSampleUrl("");
      setCreationUrl("");
      setReflection("");
    }
    setBusy(false);
    await refresh();
  }

  if (state.loading) {
    return <p className="p-10 text-sm text-muted-foreground">Loading your portfolio…</p>;
  }
  if (!state.active) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Access not active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The portfolio opens once your enrollment is active.
        </p>
      </main>
    );
  }

  const eligible = state.paidActiveMonths >= 6;
  const canSubmit = eligible && (!state.portfolio || state.portfolio.status === "returned");

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Portfolio & certificate</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The Certificate of Completion becomes available after six active months, with completion of
        the Foundations pathway and Cuca Medina's approval of your Conscious Voice Transformation
        Portfolio.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your progress</p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {state.paidActiveMonths} of 6 active months
        </p>
        {!eligible && (
          <p className="mt-1 text-sm text-muted-foreground">
            Keep going — eligibility begins after six active months.
          </p>
        )}
      </div>

      {state.portfolio && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest submission</p>
          <p className="mt-1 font-semibold text-foreground">
            {STATUS_LABEL[state.portfolio.status] ?? state.portfolio.status}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted on {new Date(state.portfolio.createdAt).toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
          {state.portfolio.feedback && (
            <p className="mt-3 rounded-md bg-muted p-3 text-sm text-foreground">
              {state.portfolio.feedback}
            </p>
          )}
        </div>
      )}

      {notice && (
        <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>
      )}

      {canSubmit && (
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">
            {state.portfolio?.status === "returned" ? "Resubmit your portfolio" : "Submit your portfolio"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Share links (Drive, SoundCloud, YouTube, etc.) to your materials. All fields are required.
          </p>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="pf-initial">Initial vocal sample</label>
            <input
              id="pf-initial"
              type="url"
              required
              value={initialSampleUrl}
              onChange={(e) => setInitialSampleUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="pf-final">Final vocal sample</label>
            <input
              id="pf-final"
              type="url"
              required
              value={finalSampleUrl}
              onChange={(e) => setFinalSampleUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="pf-creation">Your interpretation or vocal creation</label>
            <input
              id="pf-creation"
              type="url"
              required
              value={creationUrl}
              onChange={(e) => setCreationUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="pf-reflection">Brief reflection</label>
            <textarea
              id="pf-reflection"
              required
              rows={4}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit portfolio"}
          </button>
        </form>
      )}
    </main>
  );
}

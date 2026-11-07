import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { adminListPortfolios, adminReviewPortfolio } from "@/lib/admin-members.functions";

export const Route = createFileRoute("/_authenticated/admin/portfolios")({
  component: AdminPortfoliosPage,
});

type PortfolioRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  feedback: string | null;
  initial_sample_url: string;
  final_sample_url: string;
  creation_url: string;
  reflection: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  returned: "Returned with guidance",
};

function AdminPortfoliosPage() {
  const [portfolios, setPortfolios] = useState<PortfolioRow[] | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await adminListPortfolios();
    setPortfolios("error" in res ? [] : (res.portfolios as PortfolioRow[]));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(p: PortfolioRow, status: "submitted" | "in_review" | "approved" | "returned") {
    setBusy(true);
    setNotice(null);
    const res = await adminReviewPortfolio({
      data: { id: p.id, status, feedback: feedbackDrafts[p.id] ?? p.feedback ?? "" },
    });
    setNotice("error" in res ? "Could not save the review." : "Review saved.");
    setBusy(false);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Transformation Portfolios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review each Conscious Voice Transformation Portfolio. Approval here is one of the
        requirements for the Certificate of Completion.
      </p>

      {notice && <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>}

      {!portfolios || portfolios.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No portfolios submitted yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {portfolios.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{p.full_name ?? p.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.email} · {STATUS_LABEL[p.status] ?? p.status} ·{" "}
                    {new Date(p.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a href={p.initial_sample_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Initial sample
                </a>
                <a href={p.final_sample_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Final sample
                </a>
                <a href={p.creation_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Vocal creation
                </a>
              </div>

              <p className="mt-3 rounded-md bg-muted p-3 text-sm text-foreground">{p.reflection}</p>

              <textarea
                rows={3}
                placeholder="Qualitative feedback / guidance for the student"
                value={feedbackDrafts[p.id] ?? p.feedback ?? ""}
                onChange={(e) => setFeedbackDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => void review(p, "in_review")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                >
                  Mark in review
                </button>
                <button
                  disabled={busy}
                  onClick={() => void review(p, "approved")}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => void review(p, "returned")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-muted disabled:opacity-60"
                >
                  Return with guidance
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

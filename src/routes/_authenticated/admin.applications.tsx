import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  createScholarshipResultLink,
  listScholarshipApplications,
  setScholarshipDecision,
  type ScholarshipApplication,
} from "@/lib/admin-applications.functions";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  head: () => ({
    meta: [
      { title: "Scholarship applications | The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "Admin panel to review Global Solidarity Scholarship applications for The Power of Conscious Voice.",
      },
      { property: "og:title", content: "Scholarship applications | The Power of Conscious Voice" },
      { property: "og:description", content: "Review scholarship applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminApplicationsPage,
});

const DECISION_LABEL: Record<ScholarshipApplication["decision"], string> = {
  pending: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
};

const DECISION_STYLES: Record<ScholarshipApplication["decision"], string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
};

function AdminApplicationsPage() {
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listScholarshipApplications();
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setApplications(result.applications);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(leadId: string, decision: "accepted" | "rejected" | "pending") {
    setBusyId(leadId);
    setError(null);
    const result = await setScholarshipDecision({ data: { leadId, decision } });
    setBusyId(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setApplications((current) =>
      current.map((app) =>
        app.id === leadId
          ? {
              ...app,
              decision,
              status:
                decision === "accepted"
                  ? "scholarship_accepted"
                  : decision === "rejected"
                    ? "scholarship_rejected"
                    : "captured",
            }
          : app,
      ),
    );
  }

  async function copyResultLink(leadId: string) {
    setError(null);
    const result = await createScholarshipResultLink({ data: { leadId } });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const url = `${window.location.origin}/scholarship-result?token=${result.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(leadId);
      window.setTimeout(() => setCopiedId((current) => (current === leadId ? null : current)), 3000);
    } catch {
      // Clipboard may be unavailable; offer the link for manual copy.
      window.prompt("Copy this personal result link:", url);
    }
  }

  const counts = applications.reduce(
    (acc, app) => {
      acc[app.decision] += 1;
      return acc;
    },
    { pending: 0, accepted: 0, rejected: 0 } as Record<ScholarshipApplication["decision"], number>,
  );

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Scholarship applications</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Global Solidarity Scholarship — The Power of Conscious Voice. Review each application
            and mark it as accepted or rejected. Marking a decision never grants access by itself.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              {counts.pending} pending
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">
              {counts.accepted} accepted
            </span>
            <span className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">
              {counts.rejected} rejected
            </span>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scholarship applications received yet.</p>
        ) : (
          <ul className="space-y-4">
            {applications.map((app) => {
              const expanded = expandedId === app.id;
              return (
                <li key={app.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium text-foreground">
                        {app.fullName}
                        {app.freeSeatCandidate && (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary align-middle">
                            Free-seat candidate
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{app.email}</p>
                      {app.phone && (
                        <p className="text-sm text-muted-foreground">{app.phone}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {app.plan ?? "Global Solidarity Scholarship"}
                        {app.city || app.country
                          ? ` · ${[app.city, app.country].filter(Boolean).join(", ")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Received {new Date(app.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${DECISION_STYLES[app.decision]}`}
                      >
                        {DECISION_LABEL[app.decision]}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === app.id || app.decision === "accepted"}
                          onClick={() => void decide(app.id, "accepted")}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busyId === app.id || app.decision === "rejected"}
                          onClick={() => void decide(app.id, "rejected")}
                          className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
                        >
                          Reject
                        </button>
                        {app.decision !== "pending" && (
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => void decide(app.id, "pending")}
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-50"
                          >
                            Reset
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => void copyResultLink(app.id)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
                        >
                          {copiedId === app.id ? "Link copied" : "Copy result link"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : app.id)}
                    className="mt-3 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {expanded ? "Hide application answers" : "Show application answers"}
                  </button>

                  {expanded && (
                    <dl className="mt-3 space-y-3 rounded-md bg-muted/50 p-4 text-sm">
                      <div>
                        <dt className="font-medium text-foreground">Voice journey so far</dt>
                        <dd className="mt-1 whitespace-pre-line text-muted-foreground">
                          {app.voiceJourney ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">What they hope to develop</dt>
                        <dd className="mt-1 whitespace-pre-line text-muted-foreground">
                          {app.goals ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Why a scholarship would help</dt>
                        <dd className="mt-1 whitespace-pre-line text-muted-foreground">
                          {app.whyScholarship ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

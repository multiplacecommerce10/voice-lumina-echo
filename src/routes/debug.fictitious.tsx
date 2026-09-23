import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PURGE_CONFIRMATION } from "@/lib/fictitious";
import {
  listFictitiousLeads,
  markLeadFictitious,
  purgeFictitiousLeads,
} from "@/lib/fictitious.functions";

export const Route = createFileRoute("/debug/fictitious")({
  head: () => ({
    meta: [
      { title: "Fictitious members — test records" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FictitiousPage,
});

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_intended: string | null;
  status: string | null;
  source: string | null;
  created_at: string;
  explicit: boolean;
};

function FictitiousPage() {
  const list = useServerFn(listFictitiousLeads);
  const mark = useServerFn(markLeadFictitious);
  const purge = useServerFn(purgeFictitiousLeads);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [log, setLog] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const res = await list();
    setLoading(false);
    if (res.ok) {
      setLeads(res.leads as LeadRow[]);
      setTotal(res.total);
    } else {
      setLog(res.error ?? "Failed to load");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPurge = async (dryRun: boolean) => {
    setLoading(true);
    const res = await purge({ data: { confirmation, dryRun } });
    setLoading(false);
    setLog(JSON.stringify(res, null, 2));
    if (!dryRun) void refresh();
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-2xl font-semibold">Fictitious members</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Test records carry the “Fictitious member” chancela and must be deleted before the course
        opens for sale. {leads.length} flagged of {total} leads.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mark</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2">{l.full_name ?? "—"}</td>
                <td className="px-3 py-2">{l.email ?? "—"}</td>
                <td className="px-3 py-2">{l.plan_intended ?? "—"}</td>
                <td className="px-3 py-2">{l.status ?? "—"}</td>
                <td className="px-3 py-2">
                  <button
                    className="rounded border border-border px-2 py-1 text-xs"
                    onClick={async () => {
                      await mark({ data: { leadId: l.id, marked: !l.explicit } });
                      void refresh();
                    }}
                  >
                    {l.explicit ? "Remove chancela" : "Apply chancela"}
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                  No fictitious records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-8 rounded-lg border border-destructive/40 p-4">
        <h2 className="text-lg font-medium">Cleanup before launch</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Type <code>{PURGE_CONFIRMATION}</code> to enable deletion. This cannot be undone.
        </p>
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={PURGE_CONFIRMATION}
          className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3 flex gap-2">
          <button
            disabled={loading}
            onClick={() => runPurge(true)}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            Preview
          </button>
          <button
            disabled={loading || confirmation.trim().toUpperCase() !== PURGE_CONFIRMATION}
            onClick={() => runPurge(false)}
            className="rounded bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-40"
          >
            Delete all fictitious members
          </button>
        </div>
        {log && (
          <pre className="mt-4 max-h-64 overflow-auto rounded bg-muted/40 p-3 text-xs">{log}</pre>
        )}
      </section>
    </main>
  );
}

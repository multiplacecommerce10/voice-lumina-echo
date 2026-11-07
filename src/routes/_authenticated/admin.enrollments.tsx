import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { pendingEnrollmentsQuery } from "@/lib/pending-enrollments";
import { useServerFn } from "@tanstack/react-start";
import { setLeadAdmission } from "@/lib/admin-admission.functions";

export const Route = createFileRoute("/_authenticated/admin/enrollments")({
  head: () => ({
    meta: [
      { title: "Enrollments & payments | The Power of Conscious Voice" },
      { name: "description", content: "View enrollments and payments and confirm manual Wise transfers." },
      { property: "og:title", content: "Enrollments & payments | The Power of Conscious Voice" },
      { property: "og:description", content: "View enrollments and confirm Wise transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnrollmentsPage,
});

type Sub = Pick<Tables<"member_subscriptions">, "id" | "full_name" | "email" | "tier" | "duration_months" | "status" | "access_status" | "current_period_end" | "cancel_at_period_end" | "environment">;
type Lead = Pick<Tables<"leads">, "id" | "full_name" | "email" | "plan_intended" | "status" | "created_at" | "admission_status">;
type Manual = Tables<"manual_payments">;

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function EnrollmentsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [pending, setPending] = useState<Lead[]>([]);
  const [manual, setManual] = useState<Manual[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wiseFor, setWiseFor] = useState<Lead | null>(null);
  const [wise, setWise] = useState({ amount: "", reference: "", start: "", end: "", notes: "" });

  const decide = useServerFn(setLeadAdmission);
  async function setAdmission(leadId: string, decision: "approved" | "declined" | "not_reviewed") {
    setError(null);
    const r = await decide({ data: { leadId, decision } });
    if ("error" in r) setError(r.error);
    else void load();
  }

  const load = useCallback(async () => {
    const [s, l, m] = await Promise.all([
      supabase.from("member_subscriptions").select("id, full_name, email, tier, duration_months, status, access_status, current_period_end, cancel_at_period_end, environment").order("created_at", { ascending: false }),
      pendingEnrollmentsQuery(supabase),
      supabase.from("manual_payments").select("*").order("confirmed_at", { ascending: false }),
    ]);
    if (s.error || l.error || m.error) setError("Could not load some data.");
    setSubs(s.data ?? []);
    setPending(l.data ?? []);
    setManual(m.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmWise(e: React.FormEvent) {
    e.preventDefault();
    if (!wiseFor) return;
    setError(null);
    if (!wise.reference.trim()) return setError("Add the Wise transfer reference.");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("manual_payments").insert({
      lead_id: wiseFor.id,
      email: wiseFor.email,
      full_name: wiseFor.full_name,
      method: "wise",
      plan: wiseFor.plan_intended,
      amount_usd: wise.amount ? Number(wise.amount) : null,
      reference: wise.reference.trim(),
      term_start: wise.start || null,
      term_end: wise.end || null,
      notes: wise.notes.trim() || null,
      confirmed_by: u.user?.email ?? null,
    });
    if (error) return setError("Could not record the Wise payment.");
    setWiseFor(null);
    setWise({ amount: "", reference: "", start: "", end: "", notes: "" });
    void load();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Enrollments & payments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Card/PayPal subscriptions are read-only here. Recording a Wise transfer keeps an audit record for one term;
          it does not send emails or open member access automatically.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>
      )}

      <section>
        <h2 className="mb-3 text-xl font-medium text-foreground">Subscriptions ({subs.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr><th className="p-3">Student</th><th className="p-3">Plan</th><th className="p-3">Payment</th><th className="p-3">Access</th><th className="p-3">Paid until</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subs.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>No subscriptions yet.</td></tr>}
              {subs.map((s) => (
                <tr key={s.id}>
                  <td className="p-3 text-foreground">{s.full_name ?? "—"}<div className="text-xs text-muted-foreground">{s.email}</div></td>
                  <td className="p-3">{s.tier ?? "—"} · {s.duration_months ?? "?"} mo{s.environment === "sandbox" && <span className="ml-1 text-xs text-muted-foreground">(test)</span>}</td>
                  <td className="p-3">{s.status ?? "—"}{s.cancel_at_period_end && <div className="text-xs text-destructive">Cancels at term end</div>}</td>
                  <td className="p-3">{s.access_status}</td>
                  <td className="p-3">{fmt(s.current_period_end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-medium text-foreground">Wise transfers confirmed ({manual.length})</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {manual.length === 0 && <li className="p-3 text-sm text-muted-foreground">None yet.</li>}
          {manual.map((m) => (
            <li key={m.id} className="p-3 text-sm">
              <span className="text-foreground">{m.full_name ?? m.email}</span>{" "}
              <span className="text-muted-foreground">· {m.plan ?? "—"} · {m.amount_usd != null ? `US$ ${m.amount_usd}` : "amount n/a"} · ref {m.reference} · term {m.term_start ?? "?"} → {m.term_end ?? "?"} · by {m.confirmed_by ?? "—"} on {fmt(m.confirmed_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-medium text-foreground">Awaiting payment ({pending.length})</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {pending.length === 0 && <li className="p-3 text-sm text-muted-foreground">No pending enrollments.</li>}
          {pending.map((l) => (
            <li key={l.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="text-foreground">{l.full_name}</span>{" "}
                  <span className="text-muted-foreground">· {l.email} · {l.plan_intended ?? "no plan"} · {l.status} · {fmt(l.created_at)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">Admission: {l.admission_status}</span>
                  {l.admission_status !== "approved" && (
                    <button onClick={() => setAdmission(l.id, "approved")} className="text-primary hover:underline">Approve admission</button>
                  )}
                  {l.admission_status !== "declined" && (
                    <button onClick={() => setAdmission(l.id, "declined")} className="text-muted-foreground hover:underline">Decline</button>
                  )}
                  <button onClick={() => setWiseFor(l)} className="text-primary hover:underline">Confirm Wise payment</button>
                </span>
              </div>
              {wiseFor?.id === l.id && (
                <form onSubmit={confirmWise} className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className={input} placeholder="Amount (USD)" type="number" step="0.01" value={wise.amount} onChange={(e) => setWise({ ...wise, amount: e.target.value })} />
                  <input className={input} placeholder="Wise reference *" value={wise.reference} onChange={(e) => setWise({ ...wise, reference: e.target.value })} />
                  <label className="text-xs text-muted-foreground">Term start<input className={input} type="date" value={wise.start} onChange={(e) => setWise({ ...wise, start: e.target.value })} /></label>
                  <label className="text-xs text-muted-foreground">Term end<input className={input} type="date" value={wise.end} onChange={(e) => setWise({ ...wise, end: e.target.value })} /></label>
                  <input className={`${input} sm:col-span-2`} placeholder="Notes" value={wise.notes} onChange={(e) => setWise({ ...wise, notes: e.target.value })} />
                  <div className="flex gap-2">
                    <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Record payment</button>
                    <button type="button" onClick={() => setWiseFor(null)} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getReminderLog,
  getSubscriptionReminderHistory,
  getSubscriptionsSnapshot,
  previewReminderEmail,
  runReminderSweepNow,
  sendTestReminder,
  resendReminder,
} from "@/lib/subscriptions-monitor.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/debug/subscriptions")({
  component: SubscriptionsAdmin,
  head: () => ({
    meta: [
      { title: "Subscriptions Admin — Conscious Voice" },
      {
        name: "description",
        content:
          "Internal admin panel for Conscious Voice subscriptions: next charge, billing schedule and Taskade reminder status.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Subscriptions Admin" },
      { property: "og:description", content: "Internal subscription and reminder monitoring screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = Record<string, any>;

const STATUSES = ["all", "active", "trialing", "past_due", "canceled", "incomplete"] as const;

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function daysUntil(v: string | null | undefined) {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
}

function statusTone(status: string | null) {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-primary/15 text-primary border-primary/30";
    case "past_due":
    case "incomplete":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "canceled":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-accent/20 text-accent-foreground border-accent/40";
  }
}

function money(row: Row) {
  if (row.amount_per_cycle_formatted) return row.amount_per_cycle_formatted as string;
  if (row.amount_per_cycle == null) return "—";
  const cur = (row.currency as string) ?? "usd";
  return `${cur.toUpperCase()} ${Number(row.amount_per_cycle).toFixed(2)}`;
}

function SubscriptionsAdmin() {
  const fetchSnapshot = useServerFn(getSubscriptionsSnapshot);
  const fetchReminders = useServerFn(getReminderLog);
  const runSweep = useServerFn(runReminderSweepNow);
  const fetchPreview = useServerFn(previewReminderEmail);
  const fetchHistory = useServerFn(getSubscriptionReminderHistory);
  const sendTestFn = useServerFn(sendTestReminder);
  const resendFn = useServerFn(resendReminder);

  const [testEmail, setTestEmail] = useState<Record<string, string>>({});
  const [testSending, setTestSending] = useState<string | null>(null);

  const sendTest = async (r: Row, offsetDays?: number) => {
    const subscriptionId = r.stripe_subscription_id as string;
    const email = (testEmail[subscriptionId] ?? r.email ?? "").trim();
    setTestSending(subscriptionId);
    try {
      const res: any = await sendTestFn({
        data: { subscriptionId, offsetDays, testEmail: email || undefined },
      });
      if (res.ok) {
        toast.success(`Test reminder sent to ${res.sentTo ?? "Taskade"} (D-${res.offsetDays})`);
      } else {
        toast.error(res.error ?? "Test send failed");
      }
      await loadHistory(subscriptionId);
    } catch (e: any) {
      toast.error(e?.message ?? "Test send failed");
    } finally {
      setTestSending(null);
    }
  };

  const [resending, setResending] = useState<string | null>(null);

  const resend = async (r: Row, dryRun: boolean, offsetDays?: number) => {
    const subscriptionId = r.stripe_subscription_id as string;
    setResending(subscriptionId);
    try {
      const res: any = await resendFn({ data: { subscriptionId, offsetDays, dryRun } });
      if (res.ok) {
        toast.success(
          `${dryRun ? "Dry-run" : "Reminder"} sent (D-${res.offsetDays})${
            res.sentTo ? ` · ${res.sentTo}` : ""
          }`,
        );
      } else {
        toast.error(res.error ?? "Resend failed");
      }
      await loadHistory(subscriptionId);
      if (!dryRun) void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Resend failed");
    } finally {
      setResending(null);
    }
  };





  const loadHistory = useCallback(
    async (subscriptionId: string) => {
      setHistoryLoading(subscriptionId);
      try {
        const res: any = await fetchHistory({ data: { subscriptionId, limit: 50 } });
        setHistory((prev) => ({ ...prev, [subscriptionId]: res }));
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load reminder history");
      } finally {
        setHistoryLoading(null);
      }
    },
    [fetchHistory],
  );



  const [preview, setPreview] = useState<any>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (subscriptionId: string, offsetDays?: number) => {
    setPreviewFor(subscriptionId);
    setPreviewLoading(true);
    try {
      const res: any = await fetchPreview({ data: { subscriptionId, offsetDays } });
      if (!res.ok) {
        setPreview(null);
        toast.error(res.error);
      } else {
        setPreview(res);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<any>(null);
  const [reminders, setReminders] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, rem] = await Promise.all([
        fetchSnapshot({ data: { status, search: search || undefined, limit: 50 } }),
        fetchReminders({ data: { limit: 30 } }),
      ]);
      setSnapshot(snap);
      setReminders(rem);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot, fetchReminders, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const sweep = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res: any = await runSweep({ data: { dryRun } });
      toast.success(
        `Sweep ${dryRun ? "(dry-run)" : "(live)"}: ${res.result.sent} sent · ${res.result.skipped} skipped · ${res.result.failures} failed`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Sweep failed");
    } finally {
      setBusy(false);
    }
  };

  const totals = snapshot?.totals;
  const rows: Row[] = snapshot?.subscriptions ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Internal · not public</p>
          <h1 className="font-display text-3xl md:text-4xl">Subscriptions admin</h1>
          <p className="text-sm text-muted-foreground">
            Active subscriptions, next charge, billing schedule and the reminder events sent to Taskade.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Subscriptions", value: totals?.total ?? "—" },
            { label: "Monthly recurring", value: totals ? `$${Number(totals.mrr).toFixed(2)}` : "—" },
            { label: "Charging in 7 days", value: totals?.dueIn7 ?? "—" },
            { label: "Reminders sent", value: totals?.remindersSent ?? "—" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                status === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {s.replace("_", " ")}
              {snapshot?.counts?.[s] != null ? ` (${snapshot.counts[s]})` : ""}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="ml-auto w-56 rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void sweep(true)} disabled={busy}>
            Test reminders (dry-run)
          </Button>
          <Button size="sm" onClick={() => void sweep(false)} disabled={busy}>
            Run reminder sweep
          </Button>
        </section>

        {snapshot && !snapshot.ok ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {snapshot.error}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Monthly</th>
                <th className="px-3 py-2">Next charge</th>
                <th className="px-3 py-2">Reminder</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No subscriptions yet.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => {
                const d = daysUntil(r.next_charge_at);
                const open = expanded === r.id;
                const schedule: any[] = Array.isArray(r.billing_schedule) ? r.billing_schedule : [];
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="cursor-pointer border-t border-border hover:bg-muted/30"
                      onClick={() => {
                        const next = open ? null : r.id;
                        setExpanded(next);
                        if (next) void loadHistory(r.stripe_subscription_id);
                      }}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.plan_name ?? r.tier ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.duration_months ? `${r.duration_months} months` : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">{money(r)}</td>
                      <td className="px-3 py-2">
                        <div>{fmt(r.next_charge_at)}</div>
                        <div className="text-xs text-muted-foreground">
                          {d == null ? "—" : d < 0 ? "past" : `in ${d} day${d === 1 ? "" : "s"}`}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.last_reminder_sent_at ? (
                          <>
                            <div>D-{r.last_reminder_offset_days ?? "?"} sent</div>
                            <div className="text-muted-foreground">{fmt(r.last_reminder_sent_at)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">not sent</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={statusTone(r.status)}>
                          {r.status ?? "unknown"}
                          {r.cancel_at_period_end ? " · ending" : ""}
                        </Badge>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={6} className="px-3 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>
                                <span className="text-foreground">Subscription:</span> {r.stripe_subscription_id}
                              </p>
                              <p>
                                <span className="text-foreground">Customer:</span> {r.stripe_customer_id ?? "—"}
                              </p>
                              <p>
                                <span className="text-foreground">Session:</span> {r.stripe_session_id ?? "—"}
                              </p>
                              <p>
                                <span className="text-foreground">Environment:</span> {r.environment}
                              </p>
                              <p>
                                <span className="text-foreground">Card:</span>{" "}
                                {r.card_last4 ? `•••• ${r.card_last4}` : "—"}
                              </p>
                              <p>
                                <span className="text-foreground">Started:</span> {fmt(r.started_at)}
                              </p>
                              <p>
                                <span className="text-foreground">Total commitment:</span>{" "}
                                {r.total_commitment != null
                                  ? `${(r.currency ?? "usd").toUpperCase()} ${Number(r.total_commitment).toFixed(2)}`
                                  : "—"}
                              </p>
                              {r.membership_url ? (
                                <p className="break-all">
                                  <span className="text-foreground">Membership:</span> {r.membership_url}
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                                Billing schedule
                              </p>
                              {schedule.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No schedule stored.</p>
                              ) : (
                                <ol className="space-y-1 text-xs">
                                  {schedule.map((s, i) => (
                                    <li
                                      key={i}
                                      className="flex items-center justify-between rounded border border-border bg-card px-2 py-1"
                                    >
                                      <span>
                                        #{s.index ?? i + 1} · {s.date ?? s.charge_at ?? fmt(s.at)}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {s.amount_formatted ?? s.amount ?? money(r)} {s.status ? `· ${s.status}` : ""}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 space-y-3 border-t border-border pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                Reminder send history
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void loadHistory(r.stripe_subscription_id);
                                }}
                              >
                                Refresh
                              </Button>
                            </div>
                            {historyLoading === r.stripe_subscription_id ? (
                              <p className="text-xs text-muted-foreground">Loading history…</p>
                            ) : history[r.stripe_subscription_id]?.ok === false ? (
                              <p className="text-xs text-destructive">
                                {history[r.stripe_subscription_id].error}
                              </p>
                            ) : (history[r.stripe_subscription_id]?.entries ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No reminder webhooks sent for this subscription yet.
                              </p>
                            ) : (
                              <ol className="space-y-2">
                                {history[r.stripe_subscription_id].entries.map((h: any) => (
                                  <li
                                    key={h.id}
                                    className="rounded-lg border border-border bg-card p-3 text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className={
                                          h.ok
                                            ? "bg-primary/15 text-primary border-primary/30"
                                            : "bg-destructive/15 text-destructive border-destructive/30"
                                        }
                                      >
                                        {h.ok ? "OK" : "FAILED"}
                                      </Badge>
                                      <Badge variant="outline">{h.timingLabel}</Badge>
                                      {h.dryRun ? <Badge variant="outline">dry-run</Badge> : null}
                                      <span className="font-medium">{fmt(h.createdAt)}</span>
                                      <span className="text-muted-foreground">
                                        {h.responseStatus != null ? `HTTP ${h.responseStatus}` : "no response"} ·{" "}
                                        {h.durationMs ?? 0} ms · {h.attempts ?? 1} attempt(s)
                                      </span>
                                    </div>
                                    <p className="mt-1 text-muted-foreground">
                                      Charge: {h.chargeAtFormatted ?? fmt(h.chargeAt)}
                                      {h.daysUntilCharge != null ? ` · ${h.daysUntilCharge} day(s) before` : ""}
                                    </p>
                                    {h.subject ? (
                                      <p className="mt-1">
                                        <span className="text-muted-foreground">Subject:</span> {h.subject}
                                      </p>
                                    ) : null}
                                    {h.errorReason ? (
                                      <p className="mt-1 text-destructive">Error: {h.errorReason}</p>
                                    ) : null}
                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                      <details>
                                        <summary className="cursor-pointer text-muted-foreground">
                                          Payload sent
                                        </summary>
                                        <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2">
                                          {JSON.stringify(h.payload, null, 2)}
                                        </pre>
                                      </details>
                                      <details>
                                        <summary className="cursor-pointer text-muted-foreground">
                                          Taskade response
                                        </summary>
                                        <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 whitespace-pre-wrap">
                                          {h.responseBody || "(empty response body)"}
                                          {h.targetUrl ? `\n\nTarget: ${h.targetUrl}` : ""}
                                        </pre>
                                      </details>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>

                          <div className="mt-4 space-y-3 border-t border-border pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                Reminder email preview
                              </span>
                              {[7, 3, 1].map((d) => (
                                <Button
                                  key={d}
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openPreview(r.stripe_subscription_id, d);
                                  }}
                                >
                                  D-{d}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openPreview(r.stripe_subscription_id);
                                }}
                              >
                                Real timing
                              </Button>
                            </div>

                            <div
                              className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                Test send (sandbox)
                              </span>
                              <input
                                type="email"
                                value={testEmail[r.stripe_subscription_id] ?? (r.email ?? "")}
                                onChange={(ev) =>
                                  setTestEmail((prev) => ({
                                    ...prev,
                                    [r.stripe_subscription_id]: ev.target.value,
                                  }))
                                }
                                placeholder="test@email.com"
                                className="h-8 min-w-56 rounded-md border border-border bg-background px-2 text-xs"
                              />
                              {[7, 3, 1].map((d) => (
                                <Button
                                  key={d}
                                  size="sm"
                                  variant="outline"
                                  disabled={testSending === r.stripe_subscription_id}
                                  onClick={() => void sendTest(r, d)}
                                >
                                  Send D-{d}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                disabled={testSending === r.stripe_subscription_id}
                                onClick={() => void sendTest(r)}
                              >
                                {testSending === r.stripe_subscription_id
                                  ? "Sending…"
                                  : "Send test reminder"}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                Sends the real subscription.renewal_reminder event to Taskade, flagged as a
                                sandbox test.
                              </span>
                            </div>

                            <div
                              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                Resend reminder
                              </span>
                              {[7, 3, 1].map((d) => (
                                <Button
                                  key={`dry-${d}`}
                                  size="sm"
                                  variant="outline"
                                  disabled={resending === r.stripe_subscription_id}
                                  onClick={() => void resend(r, true, d)}
                                >
                                  Dry-run D-{d}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resending === r.stripe_subscription_id}
                                onClick={() => void resend(r, true)}
                              >
                                Dry-run (real timing)
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={resending === r.stripe_subscription_id}
                                onClick={() => void resend(r, false)}
                              >
                                {resending === r.stripe_subscription_id ? "Sending…" : "Resend for real"}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                Re-fires subscription.renewal_reminder to the student's own email; the real
                                send updates the reminder state and appears in the history below.
                              </span>
                            </div>


                            {previewFor === r.stripe_subscription_id ? (
                              previewLoading ? (
                                <p className="text-xs text-muted-foreground">Rendering email…</p>
                              ) : preview?.preview ? (
                                <div className="space-y-3">
                                  <div className="rounded-lg border border-border bg-background p-4">
                                    <p className="text-xs text-muted-foreground">
                                      To: {preview.preview.to ?? "—"} · D-{preview.preview.offset} ·{" "}
                                      {preview.preview.daysLeft} day(s) to charge
                                    </p>
                                    <p className="mt-2 text-base font-semibold">{preview.preview.subject}</p>
                                    <p className="text-xs text-muted-foreground">{preview.preview.preheader}</p>
                                    <div className="mt-3 space-y-2 text-sm leading-relaxed">
                                      {preview.preview.paragraphs.map((p: string, i: number) => (
                                        <p key={i}>{p}</p>
                                      ))}
                                    </div>
                                    {preview.preview.ctaUrl ? (
                                      <a
                                        href={preview.preview.ctaUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                                      >
                                        {preview.preview.ctaLabel}
                                      </a>
                                    ) : null}
                                  </div>
                                  <details onClick={(e) => e.stopPropagation()}>
                                    <summary className="cursor-pointer text-xs text-muted-foreground">
                                      Taskade payload
                                    </summary>
                                    <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                      {JSON.stringify(preview.payload, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              ) : null
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Reminder events sent to Taskade</h2>
          {reminders && !reminders.ok ? (
            <p className="text-sm text-destructive">{reminders.error}</p>
          ) : (reminders?.entries ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminder webhooks recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.entries.map((e: Row) => (
                <li key={e.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        e.ok
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }
                    >
                      {e.ok ? "OK" : "FAILED"}
                    </Badge>
                    <span className="font-medium">{e.event}</span>
                    <span className="text-muted-foreground">
                      {e.response_status != null ? `HTTP ${e.response_status}` : "no response"} ·{" "}
                      {e.duration_ms ?? 0} ms · {e.attempts ?? 1} attempt(s)
                    </span>
                    <span className="ml-auto text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>
                  {e.error_reason ? <p className="mt-1 text-destructive">{e.error_reason}</p> : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">Payload</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2">
                      {JSON.stringify(e.request_payload, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

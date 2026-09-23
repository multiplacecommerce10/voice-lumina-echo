import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { getClassReminderLog, runClassReminderSweepNow } from "@/lib/class-reminders.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

const chartConfig = {
  sent: { label: "Delivered", color: "var(--primary)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig;

const searchSchema = z.object({
  dateFrom: fallback(z.string(), "").default(""),
  dateTo: fallback(z.string(), "").default(""),
  status: fallback(z.enum(["all", "success", "error"]), "all").default("all"),
  leadId: fallback(z.string(), "").default(""),
});

const defaults = { dateFrom: "", dateTo: "", status: "all" as const, leadId: "" };

export const Route = createFileRoute("/debug/class-reminders")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(defaults)] },
  component: ClassRemindersAdmin,
  head: () => ({
    meta: [
      { title: "Class Reminders Admin — Conscious Voice" },
      {
        name: "description",
        content:
          "Internal admin panel to inspect class reminder webhook requests, delivery status and weekly send counts.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Class Reminders Admin" },
      { property: "og:description", content: "Internal monitoring of weekly class reminder deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Entry = Record<string, any>;

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoInput() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function ClassRemindersAdmin() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/debug/class-reminders" });

  const fetchLog = useServerFn(getClassReminderLog);
  const runSweep = useServerFn(runClassReminderSweepNow);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weekly, setWeekly] = useState<{ week: string; sent: number; failed: number; recipients: number }[]>([]);
  const [daily, setDaily] = useState<{ day: string; sent: number; failed: number }[]>([]);
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const [totals, setTotals] = useState<{ sent: number; failed: number; total: number; windowWeeks: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(search.dateFrom ?? weekAgoInput());
  const [dateTo, setDateTo] = useState(search.dateTo ?? todayInput());
  const [status, setStatus] = useState(search.status);
  const [leadId, setLeadId] = useState(search.leadId);

  // Sync local state when the URL changes (e.g. back button).
  useEffect(() => {
    setDateFrom(search.dateFrom || weekAgoInput());
    setDateTo(search.dateTo || todayInput());
    setStatus(search.status);
    setLeadId(search.leadId);
  }, [search.dateFrom, search.dateTo, search.status, search.leadId]);

  const applyFilters = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status,
        leadId: leadId.trim() || undefined,
      }),
    });
  }, [navigate, dateFrom, dateTo, status, leadId]);

  const resetFilters = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        dateFrom: undefined,
        dateTo: undefined,
        status: "all",
        leadId: undefined,
      }),
    });
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await fetchLog({
        data: {
          limit: 50,
          weeks: 8,
          dateFrom: search.dateFrom || undefined,
          dateTo: search.dateTo || undefined,
          status: search.status,
          leadId: search.leadId || undefined,
        },
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setError(null);
        setEntries(res.entries);
        setWeekly(res.weekly);
        setDaily(res.daily ?? []);
        setTotals(res.totals);
        setFetchedAt(res.fetchedAt);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchLog, search.dateFrom, search.dateTo, search.status, search.leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sweep(dryRun: boolean, force: boolean) {
    setBusy(true);
    try {
      const res: any = await runSweep({ data: { dryRun, force } });
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          `Sweep ${dryRun ? "(dry-run) " : ""}done — scanned ${res.result.scanned}, sent ${res.result.sent}, skipped ${res.result.skipped}, failures ${res.result.failures}`,
        );
      await load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  const chartData =
    granularity === "day"
      ? daily.map((d) => ({ label: d.day.slice(5), sent: d.sent, failed: d.failed }))
      : [...weekly]
          .sort((a, b) => (a.week < b.week ? -1 : 1))
          .map((w) => ({ label: w.week.slice(5), sent: w.sent, failed: w.failed }));

  const pieData = [
    { name: "Delivered", value: totals?.sent ?? 0, fill: "var(--color-sent)" },
    { name: "Failed", value: totals?.failed ?? 0, fill: "var(--color-failed)" },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Class reminders — admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deliveries triggered by <code>/api/public/hooks/class-reminders</code>. Updated {fmt(fetchedAt)}.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => void sweep(true, true)} disabled={busy}>
          Run sweep (dry-run)
        </Button>
        <Button size="sm" onClick={() => void sweep(false, false)} disabled={busy}>
          Run sweep (real)
        </Button>
      </div>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filters</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="dateFrom" className="text-xs">
              From
            </Label>
            <Input
              id="dateFrom"
              type="date"
              size={10}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateTo" className="text-xs">
              To
            </Label>
            <Input
              id="dateTo"
              type="date"
              size={10}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs">
              Status
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "all" | "success" | "error")}>
              <SelectTrigger id="status" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leadId" className="text-xs">
              Lead / student ID
            </Label>
            <Input
              id="leadId"
              type="text"
              placeholder="Search lead ID..."
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void applyFilters()} disabled={loading}>
            Apply filters
          </Button>
          <Button size="sm" variant="outline" onClick={() => void resetFilters()} disabled={loading}>
            Reset
          </Button>
        </div>
      </section>

      {error && (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {totals && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total attempts", value: totals.total },
            { label: "Delivered", value: totals.sent },
            { label: "Failed", value: totals.failed },
            { label: "Window", value: `${totals.windowWeeks} weeks` },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sends per {granularity}
            </h2>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={granularity === "day" ? "default" : "outline"}
                onClick={() => setGranularity("day")}
              >
                Daily
              </Button>
              <Button
                size="sm"
                variant={granularity === "week" ? "default" : "outline"}
                onClick={() => setGranularity("week")}
              >
                Weekly
              </Button>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sent" stackId="a" fill="var(--color-sent)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Success rate
          </h2>
          {totals && totals.total > 0 ? (
            <>
              <ChartContainer config={chartConfig} className="mx-auto h-48">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                    {pieData.map((slice) => (
                      <Cell key={slice.name} fill={slice.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <p className="text-center text-2xl font-semibold">
                {((totals.sent / totals.total) * 100).toFixed(1)}%
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {totals.sent} delivered · {totals.failed} failed
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data in this window.</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sends per week
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Week (Mon, UTC)</th>
                <th className="px-3 py-2">Delivered</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Students</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.week} className="border-t border-border">
                  <td className="px-3 py-2">{w.week}</td>
                  <td className="px-3 py-2 text-primary">{w.sent}</td>
                  <td className="px-3 py-2 text-destructive">{w.failed}</td>
                  <td className="px-3 py-2">{w.recipients}</td>
                </tr>
              ))}
              {weekly.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                    No reminders sent in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Latest requests
        </h2>
        <div className="space-y-2">
          {entries.map((e) => {
            const payload = (e.request_payload ?? {}) as any;
            const expanded = open === e.id;
            return (
              <div key={e.id} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : e.id)}
                  className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left"
                >
                  <Badge
                    variant="outline"
                    className={
                      e.ok
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-destructive/30 bg-destructive/15 text-destructive"
                    }
                  >
                    {e.ok ? "success" : "error"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  <span className="text-xs">{payload.email ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    HTTP {e.response_status ?? "—"} · {e.duration_ms ?? "—"}ms · tentativas {e.attempts ?? "—"}
                  </span>
                  {payload?.extra?.student_timezone && (
                    <span className="text-[10px] text-muted-foreground">{payload.extra.student_timezone}</span>
                  )}
                </button>
                {expanded && (
                  <div className="space-y-2 border-t border-border px-3 py-3 text-xs">
                    {e.error_reason && <p className="text-destructive">{e.error_reason}</p>}
                    <pre className="max-h-72 overflow-auto rounded bg-muted/40 p-2">
                      {JSON.stringify(e.request_payload, null, 2)}
                    </pre>
                    {e.response_body && (
                      <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2">{e.response_body}</pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No class reminder requests recorded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

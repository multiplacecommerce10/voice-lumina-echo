import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLeadTimeline } from "@/lib/leads-monitor.functions";
import { Badge } from "@/components/ui/badge";

type TimelineEvent = {
  key: string;
  at: string;
  kind: "state" | "webhook";
  label: string;
  detail: string | null;
  tone: string;
  attempts: number | null;
};

function toneClasses(tone: string) {
  switch (tone) {
    case "paid":
      return { dot: "bg-primary", badge: "bg-primary/15 text-primary border-primary/30" };
    case "abandoned":
      return { dot: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30" };
    case "checkout_started":
      return { dot: "bg-accent", badge: "bg-accent/20 text-accent-foreground border-accent/40" };
    case "error":
      return { dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30" };
    case "webhook":
      return { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" };
    default:
      return { dot: "bg-foreground/40", badge: "bg-muted text-muted-foreground border-border" };
  }
}

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function gap(prev: string | undefined, current: string) {
  if (!prev) return null;
  const ms = new Date(current).getTime() - new Date(prev).getTime();
  if (ms < 1000) return null;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return min > 0 ? `+${min} min ${sec}s` : `+${sec}s`;
}

export function LeadTimeline({ leadId }: { leadId: string }) {
  const fetchTimeline = useServerFn(getLeadTimeline);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    events: TimelineEvent[];
    recoveryAttempts: number;
    webhookAttempts: number;
    totalDurationMs: number;
  }>({ loading: true, error: null, events: [], recoveryAttempts: 0, webhookAttempts: 0, totalDurationMs: 0 });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    fetchTimeline({ data: { leadId } })
      .then((res: any) => {
        if (!active) return;
        if (!res.ok) {
          setState((s) => ({ ...s, loading: false, error: res.error }));
          return;
        }
        setState({
          loading: false,
          error: null,
          events: res.events,
          recoveryAttempts: res.recoveryAttempts,
          webhookAttempts: res.webhookAttempts,
          totalDurationMs: res.totalDurationMs,
        });
      })
      .catch((e) => {
        if (active) setState((s) => ({ ...s, loading: false, error: String(e) }));
      });
    return () => {
      active = false;
    };
  }, [fetchTimeline, leadId]);

  if (state.loading) {
    return <p className="p-3 text-xs text-muted-foreground">Carregando histórico…</p>;
  }
  if (state.error) {
    return <p className="p-3 text-xs text-destructive">Erro ao carregar histórico: {state.error}</p>;
  }

  const totalMin = Math.round(state.totalDurationMs / 60000);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          Duração total do funil: <strong>{totalMin > 0 ? `${totalMin} min` : "< 1 min"}</strong>
        </span>
        <span>
          Tentativas de recuperação: <strong>{state.recoveryAttempts}</strong>
        </span>
        <span>
          Tentativas de webhook: <strong>{state.webhookAttempts}</strong>
        </span>
      </div>

      <ol className="relative space-y-4 border-l border-border pl-5">
        {state.events.map((ev, i) => {
          const tone = toneClasses(ev.tone);
          const delta = gap(state.events[i - 1]?.at, ev.at);
          return (
            <li key={ev.key} className="relative">
              <span
                className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${tone.dot}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={tone.badge}>
                  {ev.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{fmt(ev.at)}</span>
                {delta && <span className="text-[10px] text-muted-foreground">{delta}</span>}
                {ev.attempts != null && (
                  <span className="text-[10px] text-muted-foreground">tentativas: {ev.attempts}</span>
                )}
              </div>
              {ev.detail && <p className="mt-1 text-xs text-muted-foreground">{ev.detail}</p>}
            </li>
          );
        })}
        {state.events.length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhuma transição registrada.</li>
        )}
      </ol>
    </div>
  );
}

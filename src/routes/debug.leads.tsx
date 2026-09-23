import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  checkWebhookHealth,
  getLeadsSnapshot,
  getWebhookAudit,
  runAbandonedSweepNow,
  testRecoveryForLead,
} from "@/lib/leads-monitor.functions";
import { LeadTimeline } from "@/components/debug/LeadTimeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";



export const Route = createFileRoute("/debug/leads")({
  component: LeadsMonitor,
  head: () => ({
    meta: [
      { title: "Lead States Monitor — Conscious Voice" },
      {
        name: "description",
        content:
          "Internal monitor for enrollment lead states: captured, checkout started, abandoned and paid, plus webhook health.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Lead States Monitor" },
      { property: "og:description", content: "Internal lead state and webhook debugging screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Lead = Record<string, any>;

const STATUSES = ["all", "captured", "checkout_started", "abandoned", "paid"] as const;

function statusTone(status: string) {
  switch (status) {
    case "paid":
      return "bg-primary/15 text-primary border-primary/30";
    case "abandoned":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "checkout_started":
      return "bg-accent/20 text-accent-foreground border-accent/40";
    default:
      return "bg-muted text-muted-foreground border-border";
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

function LeadsMonitor() {
  const fetchSnapshot = useServerFn(getLeadsSnapshot);
  const fetchHealth = useServerFn(checkWebhookHealth);
  const runTest = useServerFn(testRecoveryForLead);
  const fetchAudit = useServerFn(getWebhookAudit);
  const runSweep = useServerFn(runAbandonedSweepNow);

  const [status, setStatus] = useState<string>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [auditDirection, setAuditDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [timelineFor, setTimelineFor] = useState<string | null>(null);



  const pushLog = useCallback((line: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${line}`, ...l].slice(0, 40));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await fetchSnapshot({ data: { status, limit: 50 } });
      if (!res.ok) {
        setError(res.error);
        pushLog(`Erro ao carregar leads: ${res.error}`);
      } else {
        setError(null);
        setLeads(res.leads);
        setCounts(res.counts);
        setLastAt(res.fetchedAt);
      }
    } catch (e) {
      setError(String(e));
      pushLog(`Falha de rede: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot, status, pushLog]);

  const loadAudit = useCallback(async () => {
    try {
      const res: any = await fetchAudit({ data: { direction: auditDirection, limit: 30 } });
      if (res.ok) {
        setAudit(res.entries);
        setAuditStats(res.stats);
      } else {
        pushLog(`Erro ao carregar auditoria: ${res.error}`);
      }
    } catch (e) {
      pushLog(`Falha ao carregar auditoria: ${String(e)}`);
    }
  }, [fetchAudit, auditDirection, pushLog]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    void fetchHealth({}).then(setHealth).catch(() => setHealth(null));
  }, [fetchHealth]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      void load();
      void loadAudit();
    }, 10000);
    return () => clearInterval(id);
  }, [auto, load, loadAudit]);

  const test = async (leadId: string, live: boolean) => {
    pushLog(`Disparando webhook de recuperação (${live ? "REAL" : "dry-run"}) para ${leadId}`);
    try {
      const res: any = await runTest({ data: { leadId, live } });
      pushLog(`Resultado: ${JSON.stringify(res.result ?? res)}`);
      toast[res.ok ? "success" : "error"](res.ok ? "Webhook disparado" : "Falhou");
      void loadAudit();
    } catch (e) {
      pushLog(`Erro: ${String(e)}`);
      toast.error("Erro ao disparar webhook");
    }
  };

  const sweepNow = async () => {
    setSweeping(true);
    pushLog("Rodando varredura de checkouts abandonados (30 min)…");
    try {
      const res: any = await runSweep({});
      pushLog(
        `Varredura: ${res.processed} lead(s) analisado(s), ${res.recoveryEmailsSent} webhook(s) de recuperação disparado(s).`,
      );
      toast.success(`Varredura concluída: ${res.recoveryEmailsSent} disparo(s)`);
      void load();
      void loadAudit();
    } catch (e) {
      pushLog(`Erro na varredura: ${String(e)}`);
      toast.error("Erro na varredura");
    } finally {
      setSweeping(false);
    }
  };


  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lead States Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe em tempo real os estados dos leads e depure os webhooks do Taskade.
        </p>
      </header>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Webhooks</h2>
        {health ? (
          <ul className="text-sm space-y-1">
            <li>
              Matrículas (pós-pagamento):{" "}
              <span className={health.enrollmentConfigured ? "text-primary" : "text-destructive"}>
                {health.enrollmentConfigured ? health.enrollmentUrl : "não configurado"}
              </span>
            </li>
            <li>
              Recuperação de leads:{" "}
              <span className={health.recoveryConfigured ? "text-primary" : "text-destructive"}>
                {health.recoveryConfigured ? health.recoveryUrl : "não configurado"}
              </span>
            </li>
            <li>Modo simulação global: {health.dryRun ? "ligado" : "desligado"}</li>
            <li className="text-muted-foreground">
              Regra automática: leads que iniciam o checkout e não pagam em <strong>30 minutos</strong>{" "}
              são marcados como abandonados e disparam o webhook de recuperação.
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
        <Button size="sm" variant="secondary" onClick={() => void sweepNow()} disabled={sweeping}>
          {sweeping ? "Verificando…" : "Rodar varredura de 30 min agora"}
        </Button>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">Auditoria de webhooks</h2>
          <div className="ml-auto flex items-center gap-2">
            {(["all", "inbound", "outbound"] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={auditDirection === d ? "default" : "outline"}
                onClick={() => setAuditDirection(d)}
              >
                {d === "all" ? "todos" : d === "inbound" ? "recebidos" : "enviados"}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => void loadAudit()}>
              Atualizar
            </Button>
          </div>
        </div>

        {auditStats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Eventos (últimos 200)", value: auditStats.total },
              { label: "Falhas", value: auditStats.failures },
              { label: "Tempo médio", value: `${auditStats.avgMs} ms` },
              { label: "Pior tempo", value: `${auditStats.maxMs} ms` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Quando</th>
                <th className="p-3">Direção / Fluxo</th>
                <th className="p-3">Evento</th>
                <th className="p-3">Resposta</th>
                <th className="p-3">Tempo</th>
                <th className="p-3">Payload</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="p-3 text-xs whitespace-nowrap">{fmt(a.created_at)}</td>
                  <td className="p-3 text-xs">
                    <Badge variant="outline">{a.direction}</Badge>
                    <div className="mt-1 text-muted-foreground">{a.flow}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {a.event || "—"}
                    {a.correlation_id ? (
                      <div className="text-[10px] text-muted-foreground">{a.correlation_id}</div>
                    ) : null}
                    {a.target_url ? (
                      <div className="text-[10px] text-muted-foreground">{a.target_url}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs">
                    <span className={a.ok ? "text-primary" : "text-destructive"}>
                      {a.response_status ?? "—"} {a.ok ? "OK" : "FALHA"}
                    </span>
                    {a.attempts ? (
                      <div className="text-muted-foreground">tentativas: {a.attempts}</div>
                    ) : null}
                    {a.error_reason ? (
                      <div className="text-destructive">{a.error_reason}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {a.duration_ms != null ? `${a.duration_ms} ms` : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    >
                      {expanded === a.id ? "Ocultar" : "Ver"}
                    </Button>
                    {expanded === a.id && (
                      <pre className="mt-2 max-h-64 max-w-md overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(a.request_payload, null, 2)}
                        {a.response_body ? `\n\n--- resposta ---\n${a.response_body}` : ""}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum evento de webhook registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {s} {counts[s] !== undefined ? `(${counts[s]})` : s === "all" ? "" : "(0)"}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
          <Button variant={auto ? "default" : "outline"} size="sm" onClick={() => setAuto((a) => !a)}>
            Auto 10s: {auto ? "on" : "off"}
          </Button>
        </div>
      </section>

      {lastAt && (
        <p className="text-xs text-muted-foreground">Última leitura: {fmt(lastAt)}</p>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Lead</th>
              <th className="p-3">Status</th>
              <th className="p-3">Plano</th>
              <th className="p-3">Checkout</th>
              <th className="p-3">Abandono</th>
              <th className="p-3">E-mail recuperação</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-medium">{l.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{l.email}</div>
                    <div className="text-[10px] text-muted-foreground">{l.id}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={statusTone(l.status)}>
                      {l.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">{l.plan_intended || "—"}</td>
                  <td className="p-3 text-xs">{fmt(l.checkout_started_at)}</td>
                  <td className="p-3 text-xs">
                    {fmt(l.abandoned_at)}
                    {l.abandon_reason ? (
                      <div className="text-muted-foreground">{l.abandon_reason}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs">
                    {fmt(l.recovery_email_sent_at)}
                    <div className="text-muted-foreground">tentativas: {l.recovery_attempts ?? 0}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant={timelineFor === l.id ? "default" : "outline"}
                        onClick={() => setTimelineFor(timelineFor === l.id ? null : l.id)}
                      >
                        {timelineFor === l.id ? "Fechar histórico" : "Ver histórico"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void test(l.id, false)}>
                        Simular
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void test(l.id, true)}>
                        Enviar real
                      </Button>
                    </div>
                  </td>
                </tr>
                {timelineFor === l.id && (
                  <tr className="border-t border-border bg-muted/10">
                    <td colSpan={7} className="p-3">
                      <LeadTimeline leadId={l.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum lead neste estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-lg font-medium">Log da sessão</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {log.length ? log.join("\n") : "Sem eventos ainda."}
        </pre>
      </section>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ensureUtmsCaptured, getAttributionContext } from "@/lib/utm";
import { sendTaskadeDryRun, sendTaskadeLive } from "@/lib/taskade-test.functions";

// Schema for the payload sent to Taskade — mirrors enrollment.functions.ts + taskade.server.ts.
// Required = fields the enrollment flow will not accept as empty.
const taskadePayloadSchema = z.object({
  event: z.literal("enrollment.form_submitted"),
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("Email inválido").max(160),
  phone: z.string().trim().min(4, "Telefone muito curto").max(60),
  plan: z.string().max(120).nullable(),
  attribution_summary: z.string().max(1200).nullable(),
  utm_source: z.string().max(200).nullable(),
  utm_medium: z.string().max(200).nullable(),
  utm_campaign: z.string().max(200).nullable(),
  utm_term: z.string().max(200).nullable(),
  utm_content: z.string().max(200).nullable(),
  gclid: z.string().max(200).nullable(),
  fbclid: z.string().max(200).nullable(),
  landing_url: z.string().max(500).nullable(),
  referrer: z.string().max(500).nullable(),
  extra: z.object({
    birth_date: z.string().min(4, "Data de nascimento ausente").max(20),
    address: z.string().max(300),
    city: z.string().trim().min(1, "Cidade obrigatória").max(120),
    country: z.string().trim().min(1, "País obrigatório").max(120),
    music_level: z.string().trim().min(1, "Nível musical obrigatório").max(80),
    profession: z.string().max(160),
    academic_experience: z.string().max(2000),
    musical_preferences: z.string().max(2000),
    motivation: z.string().max(2000),
    utm_id: z.string().max(200).nullable(),
  }),
  occurred_at: z.string().min(1),
});


export const Route = createFileRoute("/debug/taskade")({
  head: () => ({
    meta: [
      { title: "Taskade Payload Preview" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TaskadeDebugPage,
});

type FormShape = {
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  profession: string;
  musicLevel: string;
  academicExperience: string;
  musicalPreferences: string;
  motivation: string;
  plan: string;
};

const initial: FormShape = {
  fullName: "Test Student",
  birthDate: "1990-01-01",
  email: "test@example.com",
  phone: "+351 000 000 000",
  city: "Lisbon",
  country: "Portugal",
  address: "Rua Example 123",
  profession: "Singer",
  musicLevel: "Intermediate — formal study or active practice",
  academicExperience: "Choir since 2015",
  musicalPreferences: "Jazz, Bossa Nova, Soul",
  motivation: "Unlock my vocal range",
  plan: "",
};

function TaskadeDebugPage() {
  const [form, setForm] = useState<FormShape>(initial);
  const [ctx, setCtx] = useState<ReturnType<typeof getAttributionContext>>({
    utms: {},
    landingUrl: "",
    referrer: "",
  });

  useEffect(() => {
    ensureUtmsCaptured();
    setCtx(getAttributionContext());
  }, []);

  const attributionParts = useMemo(() => {
    const utmStr = Object.entries(ctx.utms)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return [
      utmStr,
      ctx.landingUrl ? `landing=${ctx.landingUrl}` : "",
      ctx.referrer ? `referrer=${ctx.referrer}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }, [ctx]);

  const enrollmentPayload = useMemo(
    () => ({
      ...form,
      attribution: attributionParts.slice(0, 1000),
      utmSource: ctx.utms.utm_source || "",
      utmMedium: ctx.utms.utm_medium || "",
      utmCampaign: ctx.utms.utm_campaign || "",
      utmTerm: ctx.utms.utm_term || "",
      utmContent: ctx.utms.utm_content || "",
      utmId: ctx.utms.utm_id || "",
      gclid: ctx.utms.gclid || "",
      fbclid: ctx.utms.fbclid || "",
      landingUrl: ctx.landingUrl || "",
      referrer: ctx.referrer || "",
    }),
    [form, attributionParts, ctx],
  );

  const taskadePayload = useMemo(
    () => ({
      event: "enrollment.form_submitted",
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      plan: form.plan || null,
      attribution_summary: attributionParts || null,
      utm_source: ctx.utms.utm_source || null,
      utm_medium: ctx.utms.utm_medium || null,
      utm_campaign: ctx.utms.utm_campaign || null,
      utm_term: ctx.utms.utm_term || null,
      utm_content: ctx.utms.utm_content || null,
      gclid: ctx.utms.gclid || null,
      fbclid: ctx.utms.fbclid || null,
      landing_url: ctx.landingUrl || null,
      referrer: ctx.referrer || null,
      extra: {
        birth_date: form.birthDate,
        address: form.address,
        city: form.city,
        country: form.country,
        music_level: form.musicLevel,
        profession: form.profession,
        academic_experience: form.academicExperience,
        musical_preferences: form.musicalPreferences,
        motivation: form.motivation,
        utm_id: ctx.utms.utm_id || null,
      },
      occurred_at: "<generated server-side>",
    }),
    [form, attributionParts, ctx],
  );

  const inputCls =
    "w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-primary/60";

  const update = (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Validate the exact JSON that would be POSTed to Taskade (with a stubbed
  // occurred_at so schema doesn't complain about the placeholder string).
  const validation = useMemo(() => {
    const candidate = { ...taskadePayload, occurred_at: new Date().toISOString() };
    const result = taskadePayloadSchema.safeParse(candidate);
    if (result.success) return { ok: true as const, issues: [] as { path: string; message: string }[] };
    return {
      ok: false as const,
      issues: result.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      })),
    };
  }, [taskadePayload]);

  const [forceDownload, setForceDownload] = useState(false);
  const [dryRunState, setDryRunState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; result: unknown }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const dryRunFn = useServerFn(sendTaskadeDryRun);
  const [liveState, setLiveState] = useState<
    | { status: "idle" }
    | { status: "confirm" }
    | { status: "loading" }
    | { status: "done"; result: unknown }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const liveFn = useServerFn(sendTaskadeLive);

  const runDryRun = async () => {
    setDryRunState({ status: "loading" });
    try {
      const payload = { ...taskadePayload, occurred_at: new Date().toISOString() };
      const result = await dryRunFn({ data: { payload } });
      setDryRunState({ status: "done", result });
    } catch (e) {
      setDryRunState({ status: "error", message: (e as Error).message || String(e) });
    }
  };

  const runLive = async () => {
    setLiveState({ status: "loading" });
    try {
      const payload = { ...taskadePayload, occurred_at: new Date().toISOString() };
      const result = await liveFn({ data: { payload } });
      setLiveState({ status: "done", result });
    } catch (e) {
      setLiveState({ status: "error", message: (e as Error).message || String(e) });
    }
  };


  const copy = (obj: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  };

  const download = (obj: unknown, prefix: string) => {
    if (!validation.ok && !forceDownload) return;
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    download(
      {
        exported_at: new Date().toISOString(),
        validation: validation.ok
          ? { status: "valid" }
          : { status: "invalid", issues: validation.issues },
        attribution_context: ctx,
        enrollment_payload: enrollmentPayload,
        taskade_payload: taskadePayload,
      },
      "taskade-audit",
    );
  };

  const disabled = !validation.ok && !forceDownload;
  const dlBtnCls = disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] transition-transform";

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-2">Debug</p>
        <h1 className="font-display text-3xl lg:text-4xl">Taskade Payload Preview</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Página interna (noindex). Mostra o payload exato que é enviado ao webhook do Taskade
          quando o formulário de inscrição é submetido. As UTMs são lidas do sessionStorage — para
          testar, abra esta página com parâmetros:{" "}
          <code className="text-primary">
            ?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=test
          </code>
          .
        </p>
        {/* Validation banner */}
        {validation.ok ? (
          <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
            <span aria-hidden>✓</span>
            <span>Payload válido — todos os campos obrigatórios presentes e no formato correto.</span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <span aria-hidden>⚠</span>
              <span>
                {validation.issues.length} problema{validation.issues.length > 1 ? "s" : ""} de
                validação — corrija antes de baixar
              </span>
            </div>
            <ul className="list-disc pl-6 space-y-1">
              {validation.issues.map((i, idx) => (
                <li key={idx}>
                  <code className="text-destructive/90">{i.path}</code> — {i.message}
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-xs text-destructive/80 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDownload}
                onChange={(e) => setForceDownload(e.target.checked)}
              />
              Baixar mesmo assim (marcado como inválido no arquivo)
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={disabled}
            onClick={downloadAll}
            className={`px-4 py-2 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground text-sm font-semibold shadow-glow-gold ${dlBtnCls}`}
          >
            ⬇ Baixar auditoria completa (JSON)
          </button>
          <button
            disabled={disabled}
            onClick={() => download(taskadePayload, "taskade-payload")}
            className={`px-4 py-2 rounded-full border border-primary/60 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ⬇ Baixar payload do Taskade
          </button>
          <button
            disabled={disabled}
            onClick={() => download(enrollmentPayload, "enrollment-payload")}
            className={`px-4 py-2 rounded-full border border-border/60 text-sm font-semibold hover:border-primary/60 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ⬇ Baixar payload do formulário
          </button>
        </div>

        {/* Dry-run test */}
        <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-primary">Modo de teste (dry-run)</p>
              <p className="text-xs text-muted-foreground">
                Simula o envio ao Taskade sem disparar dados reais. O payload é registrado nos
                logs do servidor com o marcador <code>dry_run: true</code>.
              </p>
            </div>
            <button
              onClick={runDryRun}
              disabled={dryRunState.status === "loading"}
              className="px-4 py-2 rounded-full border border-primary/60 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {dryRunState.status === "loading" ? "Simulando…" : "▶ Simular envio (dry-run)"}
            </button>
          </div>
          {dryRunState.status === "done" && (
            <pre className="mt-3 text-xs bg-background/40 rounded-lg p-3 overflow-x-auto max-h-56 text-emerald-300">
              {JSON.stringify(dryRunState.result, null, 2)}
            </pre>
          )}
          {dryRunState.status === "error" && (
            <p className="mt-3 text-xs text-destructive">Erro: {dryRunState.message}</p>
          )}
        </div>

        {/* Live send test */}
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-amber-300">
                Envio REAL ao Taskade (dados fictícios)
              </p>
              <p className="text-xs text-muted-foreground">
                Dispara o webhook real do Taskade com o payload atual. Use com dados de teste —
                o fluxo do Taskade vai receber e processar como uma inscrição real.
              </p>
            </div>
            {liveState.status === "confirm" ? (
              <div className="flex gap-2">
                <button
                  onClick={runLive}
                  className="px-4 py-2 rounded-full bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
                >
                  Confirmar envio real
                </button>
                <button
                  onClick={() => setLiveState({ status: "idle" })}
                  className="px-4 py-2 rounded-full border border-border/60 text-sm hover:border-primary/60 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLiveState({ status: "confirm" })}
                disabled={!validation.ok || liveState.status === "loading"}
                className="px-4 py-2 rounded-full border border-amber-500/60 text-amber-300 text-sm font-semibold hover:bg-amber-500/10 transition-colors disabled:opacity-50"
              >
                {liveState.status === "loading" ? "Enviando…" : "🚀 Enviar ao Taskade (real)"}
              </button>
            )}
          </div>
          {liveState.status === "done" && (
            <pre className="mt-3 text-xs bg-background/40 rounded-lg p-3 overflow-x-auto max-h-56 text-amber-200">
              {JSON.stringify(liveState.result, null, 2)}
            </pre>
          )}
          {liveState.status === "error" && (
            <p className="mt-3 text-xs text-destructive">Erro: {liveState.message}</p>
          )}
        </div>
      </div>


      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Form inputs */}
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-xl mb-2">Simular campos do formulário</h2>
          {(Object.keys(form) as (keyof FormShape)[]).map((key) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{key}</label>
              {["academicExperience", "musicalPreferences", "motivation", "address"].includes(
                key,
              ) ? (
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form[key]}
                  onChange={update(key)}
                />
              ) : (
                <input className={inputCls} value={form[key]} onChange={update(key)} />
              )}
            </div>
          ))}
        </div>

        {/* Right: Payloads */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">Attribution context (sessionStorage)</h2>
              <button
                onClick={() => copy(ctx)}
                className="text-xs px-3 py-1 rounded-full border border-border/60 hover:border-primary/60"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs bg-background/40 rounded-lg p-3 overflow-x-auto max-h-56">
              {JSON.stringify(ctx, null, 2)}
            </pre>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">Payload → server function</h2>
              <button
                onClick={() => copy(enrollmentPayload)}
                className="text-xs px-3 py-1 rounded-full border border-border/60 hover:border-primary/60"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs bg-background/40 rounded-lg p-3 overflow-x-auto max-h-80">
              {JSON.stringify(enrollmentPayload, null, 2)}
            </pre>
          </div>

          <div className="glass-card rounded-2xl p-6 ring-glow-gold">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-primary">Payload → Taskade webhook</h2>
              <button
                onClick={() => copy(taskadePayload)}
                className="text-xs px-3 py-1 rounded-full border border-primary/60 text-primary hover:bg-primary/10"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs bg-background/40 rounded-lg p-3 overflow-x-auto max-h-96">
              {JSON.stringify(taskadePayload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { approveAndSendRecoveryEmail, previewRecoveryEmail } from "@/lib/email-preview.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/debug/email-preview")({
  component: EmailPreview,
  head: () => ({
    meta: [
      { title: "Email Proofreader — Conscious Voice" },
      {
        name: "description",
        content:
          "Internal screen to proofread the exact recovery email subject and body for a lead before it is sent.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Email Proofreader" },
      { property: "og:description", content: "Review the exact email content before sending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EmailPreview() {
  const preview = useServerFn(previewRecoveryEmail);
  const send = useServerFn(approveAndSendRecoveryEmail);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const v = query.trim();
    if (!v) return;
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(v);
      const r: any = await preview({ data: isUuid ? { leadId: v } : { email: v } });
      setResult(r);
      if (!r.ok) toast.error(r.error);
    } finally {
      setLoading(false);
    }
  };

  const doSend = async () => {
    if (!result?.ok) return;
    setSending(true);
    try {
      const r: any = await send({
        data: { leadId: result.lead.id, approvedSubject: result.draft.subject },
      });
      if (r.ok) toast.success("Email approved and sent.");
      else toast.error(r.error ?? "Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Email proofreader</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Renders the exact subject and body that will be sent for a lead. Nothing leaves the system until
        you approve it here.
      </p>

      <div className="mt-6 flex gap-2">
        <Input
          value={query}
          placeholder="Lead email or lead id"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Preview"}
        </Button>
      </div>

      {result?.ok && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{result.lead.status ?? "—"}</Badge>
            <span>{result.lead.full_name ?? "No name"}</span>
            <span>·</span>
            <span>{result.lead.email}</span>
            <span>·</span>
            <span>{result.lead.plan_intended ?? "no plan"}</span>
            <span>·</span>
            <span>attempts: {result.lead.recovery_attempts ?? 0}</span>
          </div>

          {result.issues.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {result.issues.map((i: any, idx: number) => (
                <li key={idx} className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                  {i.level === "error" ? "Blocking: " : "Warning: "}
                  {i.message}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
              <p className="mt-1 font-medium text-foreground">{result.draft.subject}</p>
            </div>
            <pre className="whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-relaxed text-foreground">
              {result.draft.bodyText}
            </pre>
          </div>

          {result.draft.bodyHtml && (
            <div className="rounded-xl border border-border">
              <div className="border-b border-border px-5 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">HTML preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the branded version Taskade should send when <code>email_body_html</code> is
                  supported.
                </p>
              </div>
              <div
                className="px-0 py-0"
                dangerouslySetInnerHTML={{ __html: result.draft.bodyHtml }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={doSend} disabled={sending || result.blocking}>
              {sending ? "Sending…" : "Approve and send"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`${result.draft.subject}\n\n${result.draft.bodyText}`);
                toast.success("Copied text");
              }}
            >
              Copy text
            </Button>
            {result.draft.bodyHtml && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(result.draft.bodyHtml);
                  toast.success("Copied HTML");
                }}
              >
                Copy HTML
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Note: the automation platform must be mapped to <code>email_subject</code>,{" "}
            <code>email_body_html</code> (preferred) and <code>email_body_text</code> (fallback). Otherwise
            it will keep using its own template.
          </p>
        </section>
      )}

      {result && !result.ok && <p className="mt-6 text-sm text-destructive">{result.error}</p>}
    </main>
  );
}

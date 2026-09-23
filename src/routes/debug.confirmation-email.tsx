import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { previewConfirmationEmail } from "@/lib/confirmation-email-preview.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/debug/confirmation-email")({
  component: ConfirmationEmailPreview,
  head: () => ({
    meta: [
      { title: "Confirmation Email Proofreader — Conscious Voice" },
      {
        name: "description",
        content:
          "Internal screen to proofread the exact paid-enrollment confirmation email subject and body for a student before it is sent.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Confirmation Email Proofreader" },
      {
        property: "og:description",
        content: "Review the exact confirmation email content before sending.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ConfirmationEmailPreview() {
  const preview = useServerFn(previewConfirmationEmail);

  const [query, setQuery] = useState("");
  const [isRenewal, setIsRenewal] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const v = query.trim();
    if (!v) return;
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(v);
      const r: any = await preview({
        data: isUuid ? { leadId: v, isRenewal } : { email: v, isRenewal },
      });
      setResult(r);
      if (!r.ok) toast.error(r.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Confirmation email proofreader</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Renders the exact subject and body that will be sent after a successful payment. The webhook
        sends this automatically; this screen is for manual review and testing.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          placeholder="Lead email or lead id"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <input
            type="checkbox"
            checked={isRenewal}
            onChange={(e) => setIsRenewal(e.target.checked)}
            className="rounded border-border"
          />
          Render as renewal
        </label>
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
            {result.subscription && (
              <>
                <span>·</span>
                <span>{result.subscription.stripe_subscription_id}</span>
                <span>·</span>
                <Badge variant="outline">{result.subscription.access_status}</Badge>
              </>
            )}
          </div>

          {result.issues.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {result.issues.map((i: any, idx: number) => (
                <li
                  key={idx}
                  className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}
                >
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
            The webhook automatically sends these fields on every paid event:{" "}
            <code>email_subject</code>, <code>email_body_html</code> (preferred) and{" "}
            <code>email_body_text</code> (fallback). The automation platform must use them verbatim —
            otherwise it will keep using its own template.
          </p>
        </section>
      )}

      {result && !result.ok && <p className="mt-6 text-sm text-destructive">{result.error}</p>}
    </main>
  );
}

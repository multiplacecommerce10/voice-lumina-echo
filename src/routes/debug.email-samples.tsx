import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { buildConfirmationEmail } from "@/lib/confirmation-email";
import { buildAccessCredentialsEmail } from "@/lib/access-credentials-email";
import { buildRecoveryEmail } from "@/lib/recovery-email";
import { buildScholarshipApplicationEmail } from "@/lib/scholarship-email";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/debug/email-samples")({
  component: EmailSamples,
  head: () => ({
    meta: [
      { title: "Email Samples — Conscious Voice" },
      { name: "description", content: "Internal preview of the four Conscious Voice emails with sample data. Nothing is sent." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Email Samples — Conscious Voice" },
      { property: "og:description", content: "Internal preview of the four emails. Nothing is sent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

// Fictitious sample data only — preview never sends anything.
const NAME = "Jordan Example";
const EMAIL = "jordan@example.com";
const PASSWORD = "Sample-Pass-2026";

function fill(s: string) {
  return s.replaceAll("{{member_username}}", EMAIL).replaceAll("{{member_password}}", PASSWORD);
}

function EmailSamples() {
  const [width, setWidth] = useState(640);
  const samples = useMemo(() => {
    const welcome = buildConfirmationEmail({
      fullName: NAME, email: EMAIL, planIntended: "complete_3m", tier: "complete", durationMonths: 3,
      totalFormatted: null, amountPerCycleFormatted: null, isRecurring: true, isRenewal: false,
      billingIntervalMonths: 3, nextChargeAtFormatted: null, courseStartFormatted: "October 20, 2026",
      nextClassFormatted: "October 20, 2026", membershipUrl: "https://consciousvoice.tecendosom.com/members",
    } as any);
    const creds = buildAccessCredentialsEmail({ fullName: NAME, membershipUrl: "https://consciousvoice.tecendosom.com/members", tier: "complete", username: EMAIL, password: "Cv-SamplePass1!" });
    const rec = buildRecoveryEmail({ leadId: "00000000-0000-0000-0000-000000000000", fullName: NAME, planIntended: "complete_3m", resumeCode: "SAMPLE123" });
    const sch = buildScholarshipApplicationEmail(NAME);
    return [
      { label: "1. Welcome", subject: welcome.subject, html: welcome.bodyHtml },
      { label: "2. Member area credentials", subject: fill(creds.subject), html: fill(creds.bodyHtml) },
      { label: "3. Cart recovery", subject: rec.subject, html: rec.bodyHtml },
      { label: "4. Scholarship application", subject: sch.subject, html: sch.bodyHtml },
    ];
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-foreground">Email samples</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Exact output of the four templates with sample data ({NAME}, {EMAIL}, password {PASSWORD}). Preview only — nothing is sent.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant={width === 640 ? "default" : "outline"} onClick={() => setWidth(640)}>Desktop</Button>
        <Button variant={width === 375 ? "default" : "outline"} onClick={() => setWidth(375)}>Phone</Button>
      </div>
      <div className="mt-8 space-y-12">
        {samples.map((s) => (
          <section key={s.label} className="rounded-xl border border-border">
            <div className="border-b border-border px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-medium text-foreground">Subject: {s.subject}</p>
            </div>
            <div className="flex justify-center bg-muted/40 p-4">
              <iframe title={s.label} srcDoc={s.html} style={{ width, height: 1100 }} className="rounded border border-border bg-background" />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

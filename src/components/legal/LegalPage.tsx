import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";
import { SiteFooter } from "@/components/SiteFooter";

export function LegalPage({
  title,
  subtitle,
  version,
  children,
}: {
  title: string;
  subtitle: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="font-display text-lg text-foreground/90">
            {LEGAL.brand}
          </Link>
          <nav className="flex flex-wrap gap-4 text-xs">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-muted-foreground hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 sm:py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Legal</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight">{title}</h1>
        <p className="mt-4 text-foreground/80 leading-relaxed">{subtitle}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Effective date: {LEGAL.effectiveDate} · Version {version}
        </p>

        <div className="mt-10 space-y-10 legal-body">{children}</div>

        <div className="mt-14 rounded-2xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground leading-relaxed">
          <p className="text-foreground/90 font-medium mb-1">{LEGAL.sellerName}</p>
          <p>CNPJ {LEGAL.cnpj}</p>
          <p>{LEGAL.addressFull}</p>
          <p>
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="text-primary hover:underline"
            >
              {LEGAL.contactEmail}
            </a>
          </p>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Back to the course
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function Section({ id, heading, children }: { id?: string; heading: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">{heading}</h2>
      <div className="space-y-4 text-foreground/85 leading-relaxed [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

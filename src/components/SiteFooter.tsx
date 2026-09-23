import { Link } from "@tanstack/react-router";
import logo from "@/assets/tecendo-som-logo.png";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";
import { openPrivacyPreferences } from "@/lib/consent";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-10 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Tecendo Som" className="h-16 w-16 rounded-full" />
            <div className="flex flex-col">
              <span className="font-display text-lg text-foreground/90">{LEGAL.brand}</span>
              <span className="text-xs text-muted-foreground/80">{LEGAL.courseName}</span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2 text-xs">
            <div className="flex items-center gap-4">
              <a
                href="https://www.cucamedina.art"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/80 hover:text-primary transition-colors"
              >
                cucamedina.art
              </a>
              <span className="text-muted-foreground/30">·</span>
              <a
                href="https://instagram.com/cuca_medina"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/80 hover:text-primary transition-colors inline-flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                </svg>
                Instagram
              </a>
            </div>
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="text-muted-foreground/70 hover:text-primary transition-colors"
            >
              {LEGAL.contactEmail}
            </a>
          </div>
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col gap-3 text-xs text-muted-foreground/80 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            <span className="text-foreground/80">{LEGAL.sellerName}</span> · CNPJ {LEGAL.cnpj} ·{" "}
            {LEGAL.location} · {LEGAL.contactEmail}
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-primary transition-colors">
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openPrivacyPreferences}
              className="hover:text-primary transition-colors underline-offset-2 hover:underline"
            >
              Cookie preferences
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}

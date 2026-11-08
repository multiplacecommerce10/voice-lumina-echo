// Personal, token-gated scholarship result page. Each applicant receives a
// private link (no login); the page reflects the current review decision.
// Sharing the link never grants course access by itself.

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getScholarshipResult, type ScholarshipResultOutcome } from "@/lib/scholarship-result.functions";

type Search = { token?: string };

export const Route = createFileRoute("/scholarship-result")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scholarship result — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "Your personal Global Solidarity Scholarship review result for The Power of Conscious Voice.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Scholarship result — The Power of Conscious Voice" },
      {
        property: "og:description",
        content: "Your personal Global Solidarity Scholarship review result.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScholarshipResultPage,
});

function ScholarshipResultPage() {
  const { token } = Route.useSearch();
  const [result, setResult] = useState<ScholarshipResultOutcome | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token.trim())) {
      setResult({ found: false });
      return;
    }
    getScholarshipResult({ data: { token: token.trim() } })
      .then((outcome) => {
        if (!cancelled) setResult(outcome);
      })
      .catch(() => {
        if (!cancelled) setResult({ found: false });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-12">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            The Power of Conscious Voice
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Global Solidarity Scholarship</p>

          {result === "loading" ? (
            <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
          ) : !result.found ? (
            <>
              <h1 className="mt-8 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
                This link is not valid
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                This personal result link appears to be incomplete or no longer valid. Please use
                the exact link you received, or write to us and we will take care of it right away.
              </p>
              <ContactLine />
            </>
          ) : result.decision === "accepted" ? (
            <>
              <h1 className="mt-8 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
                Congratulations, {result.firstName}!
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                After a careful and personal review of your application, Cuca Medina and her team
                have selected you to receive the{" "}
                <strong className="text-foreground">Global Solidarity Scholarship</strong> for the
                Founding Cohort of The Power of Conscious Voice.
              </p>
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <p className="text-sm font-medium text-foreground">Your next step</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  To secure your place, complete your enrollment. Your individual study cycle and
                  course access begin only after your enrollment is confirmed — the Founding Cohort
                  starts on December 7, 2026.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/"
                  hash="enroll"
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Complete my enrollment
                </Link>
                <Link
                  to="/scholarship-login"
                  search={{ next: "/members" }}
                  className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60"
                >
                  Sign in to my account
                </Link>
              </div>
              <ContactLine />
            </>
          ) : result.decision === "rejected" ? (
            <>
              <h1 className="mt-8 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
                Thank you for applying, {result.firstName}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                After careful and personal consideration, we are not able to offer you a
                scholarship seat in this cohort. Scholarship places are very limited, so this
                decision reflects only that scarcity — never the value of your voice or your
                potential.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                You are very welcome to request consideration again for a future cohort, or to
                begin the course at any time as an enrolled student.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/"
                  hash="enroll"
                  className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60"
                >
                  Explore the course
                </Link>
              </div>
              <ContactLine />
            </>
          ) : (
            <>
              <h1 className="mt-8 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
                Your application is under review
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Thank you for applying for the Global Solidarity Scholarship, {result.firstName}.
                Your application is currently with Cuca Medina and her team. Every application
                receives a personal, human review — and this page will show your result as soon as
                the review is complete.
              </p>
              <ContactLine />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ContactLine() {
  return (
    <p className="mt-8 text-sm text-muted-foreground">
      Questions? Write to{" "}
      <a href="mailto:contact@tecendosom.com" className="text-primary hover:underline">
        contact@tecendosom.com
      </a>
    </p>
  );
}

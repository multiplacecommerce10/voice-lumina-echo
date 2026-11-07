// Opt-out page linked from the abandoned-checkout recovery email footer.
// Marks the lead so the recovery automation never emails that person again.
// Reads lead + code from the URL, then verifies against the lead's resume code.

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

type Search = { lead?: string; code?: string };

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    lead: typeof search.lead === "string" ? search.lead : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Unsubscribe — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "Opt out of enrollment reminder emails from The Power of Conscious Voice — Tecendo Som.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Unsubscribe — The Power of Conscious Voice" },
      {
        property: "og:description",
        content: "Opt out of enrollment reminder emails from The Power of Conscious Voice.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: UnsubscribePage,
});

type UnsubscribeState = "working" | "done" | "already" | "error" | "missing";

function UnsubscribePage() {
  const { lead, code } = Route.useSearch();
  const [state, setState] = useState<UnsubscribeState>("working");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!lead || !code) {
        setState("missing");
        return;
      }
      try {
        const res = await fetch("/api/public/leads/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead, code }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setState("error");
          return;
        }
        const data = (await res.json()) as { already?: boolean };
        setState(data.already ? "already" : "done");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [lead, code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
        {state === "working" && <UnsubscribeHeading title="One moment…" />}
        {state === "done" && (
          <>
            <UnsubscribeHeading title="You have been unsubscribed" />
            <UnsubscribeBody>
              You will no longer receive enrollment reminders about The Power of Conscious Voice.
              If you ever change your mind, your place in the course is waiting for you — you can
              return at any time.
            </UnsubscribeBody>
          </>
        )}
        {state === "already" && (
          <>
            <UnsubscribeHeading title="You are already unsubscribed" />
            <UnsubscribeBody>
              You will no longer receive enrollment reminders about The Power of Conscious Voice.
              If you ever change your mind, you can return at any time.
            </UnsubscribeBody>
          </>
        )}
        {state === "missing" && (
          <>
            <UnsubscribeHeading title="This link is incomplete" />
            <UnsubscribeBody>
              This unsubscribe link appears to be incomplete. Please use the exact link from your
              email, or write to us and we will take care of it right away.
            </UnsubscribeBody>
            <UnsubscribeContact />
          </>
        )}
        {state === "error" && (
          <>
            <UnsubscribeHeading title="We could not complete this request" />
            <UnsubscribeBody>
              The link may have expired or is no longer valid. Write to us and we will remove you
              from future reminders right away.
            </UnsubscribeBody>
            <UnsubscribeContact />
          </>
        )}
      </div>
    </div>
  );
}

function UnsubscribeHeading({ title }: { title: string }) {
  return (
    <h1 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
  );
}

function UnsubscribeBody({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-base leading-relaxed text-muted-foreground">{children}</p>;
}

function UnsubscribeContact() {
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      <a href="mailto:contact@tecendosom.com" className="text-primary hover:underline">
        contact@tecendosom.com
      </a>
    </p>
  );
}

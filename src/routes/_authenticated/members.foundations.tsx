import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getFoundations, type FoundationsItem } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/foundations")({
  component: FoundationsPage,
});

function FoundationsPage() {
  const [state, setState] = useState<
    { loading: true } | { loading: false; active: boolean; items: FoundationsItem[] }
  >({ loading: true });

  useEffect(() => {
    void getFoundations().then((res) => {
      if ("error" in res || !res.active) {
        setState({ loading: false, active: false, items: [] });
      } else {
        setState({ loading: false, active: true, items: res.items });
      }
    });
  }, []);

  if (state.loading) {
    return <p className="p-10 text-sm text-muted-foreground">Loading the Foundations Library…</p>;
  }
  if (!state.active) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Access not active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Foundations Library opens once your enrollment is active.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Method Foundations Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The recorded foundations of the method — study at your own pace, anytime.
      </p>

      {state.items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">The library is being prepared. Check back soon.</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {state.items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">{item.title}</h2>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              )}
              <a
                href={item.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Open material
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

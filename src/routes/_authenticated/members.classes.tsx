import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getClasses, type ClassSession } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/classes")({
  component: ClassesPage,
});

function ClassesPage() {
  const [state, setState] = useState<
    | { loading: true }
    | { loading: false; active: boolean; tier: "live" | "complete" | null; classes: ClassSession[] }
  >({ loading: true });

  useEffect(() => {
    void getClasses().then((res) => {
      if ("error" in res || !res.active) {
        setState({ loading: false, active: false, tier: null, classes: [] });
      } else {
        setState({ loading: false, active: true, tier: res.tier ?? null, classes: res.classes });
      }
    });
  }, []);

  if (state.loading) {
    return <p className="p-10 text-sm text-muted-foreground">Loading classes…</p>;
  }
  if (!state.active) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Access not active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Classes become available once your enrollment is active.
        </p>
      </main>
    );
  }

  const now = Date.now();
  const upcoming = state.classes.filter((c) => new Date(c.startsAt).getTime() >= now);
  const past = state.classes.filter((c) => new Date(c.startsAt).getTime() < now).reverse();

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Classes & replays</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Weekly 90-minute live cohort class. Replays are available on the Complete plan, starting
        from your enrollment date.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No upcoming classes scheduled yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {upcoming.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(c.startsAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
                </p>
              </div>
              {c.liveUrl && (
                <a
                  href={c.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Join live
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-foreground">Replays</h2>
      {state.tier !== "complete" ? (
        <p className="mt-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Class replays are part of the Complete plan. Your Live plan includes the Foundations
          Library and individual guidance instead.
        </p>
      ) : past.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No replays yet — they appear here after each class.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {past.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(c.startsAt).toLocaleDateString("en-US", { dateStyle: "long" })}
                </p>
              </div>
              {c.replayUrl ? (
                <a
                  href={c.replayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Watch replay
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">Replay not available</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

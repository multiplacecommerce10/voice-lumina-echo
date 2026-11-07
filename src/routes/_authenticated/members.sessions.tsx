import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  bookSlot,
  cancelBooking,
  getSessionData,
  type Booking,
  type SessionSlot,
} from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/sessions")({
  component: SessionsPage,
});

type State =
  | { loading: true }
  | { loading: false; active: boolean; slots: SessionSlot[]; bookings: Booking[]; usedThisCycle: number };

function SessionsPage() {
  const [state, setState] = useState<State>({ loading: true });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await getSessionData();
    if ("error" in res || !res.active) {
      setState({ loading: false, active: false, slots: [], bookings: [], usedThisCycle: 0 });
    } else {
      setState({ loading: false, active: true, slots: res.slots, bookings: res.bookings, usedThisCycle: res.usedThisCycle });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function book(slotId: string) {
    setBusy(true);
    setNotice(null);
    const res = await bookSlot({ data: { slotId } });
    if ("error" in res) {
      setNotice(
        res.error === "cycle_limit"
          ? "You already have 2 sessions booked in this 30-day cycle."
          : res.error === "slot_taken"
            ? "That time was just taken — please pick another."
            : "Could not book this session. Please try again.",
      );
    } else {
      setNotice("Session booked! See you there.");
    }
    setBusy(false);
    await refresh();
  }

  async function cancel(bookingId: string) {
    setBusy(true);
    setNotice(null);
    const res = await cancelBooking({ data: { bookingId } });
    if ("error" in res) {
      setNotice("Could not cancel this booking. Please try again.");
    } else {
      setNotice("Booking canceled.");
    }
    setBusy(false);
    await refresh();
  }

  if (state.loading) {
    return <p className="p-10 text-sm text-muted-foreground">Loading sessions…</p>;
  }
  if (!state.active) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Access not active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Individual sessions open once your enrollment is active.
        </p>
      </main>
    );
  }

  const now = Date.now();
  const upcomingBookings = state.bookings.filter(
    (b) => b.status === "booked" && new Date(b.startsAt).getTime() >= now,
  );
  const pastBookings = state.bookings.filter(
    (b) => b.status !== "booked" || new Date(b.startsAt).getTime() < now,
  );
  const freeSlots = state.slots.filter((s) => !s.booked);
  const remaining = Math.max(0, 2 - state.usedThisCycle);

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Individual sessions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Two 30-minute individual sessions per active 30-day cycle. You have{" "}
        <strong className="text-foreground">{remaining}</strong> remaining in this cycle.
      </p>

      {notice && (
        <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-foreground">Your upcoming sessions</h2>
      {upcomingBookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No sessions booked yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {upcomingBookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <p className="min-w-0 flex-1 font-medium text-foreground">
                {new Date(b.startsAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
              </p>
              <button
                disabled={busy}
                onClick={() => void cancel(b.id)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-foreground">Available times</h2>
      {freeSlots.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No open times right now — new times are added regularly.</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {freeSlots.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {new Date(s.startsAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
              </p>
              <button
                disabled={busy || remaining === 0}
                onClick={() => void book(s.id)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Book
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-foreground">Your session recordings</h2>
      {pastBookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Your past sessions and recordings will appear here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {pastBookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {new Date(b.startsAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.status === "booked" ? "Completed" : b.status === "completed" ? "Completed" : "Canceled"}
                </p>
              </div>
              {b.recordingUrl && (
                <a
                  href={b.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Watch recording
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

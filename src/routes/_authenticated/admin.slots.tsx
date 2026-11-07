import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  adminAddSlot,
  adminDeleteSlot,
  adminListSlots,
  adminUpdateBooking,
} from "@/lib/admin-members.functions";

export const Route = createFileRoute("/_authenticated/admin/slots")({
  component: AdminSlotsPage,
});

type Slot = { id: string; starts_at: string };
type BookingRow = {
  id: string;
  slot_id: string;
  email: string;
  full_name: string | null;
  status: string;
  recording_url: string | null;
  created_at: string;
};

function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [recordingDrafts, setRecordingDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await adminListSlots();
    if (!("error" in res)) {
      setSlots(res.slots as Slot[]);
      setBookings(res.bookings as BookingRow[]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await adminAddSlot({ data: { startsAt } });
    setNotice(
      "error" in res
        ? res.error === "duplicate"
          ? "A slot already exists at that exact time."
          : "Could not add the slot."
        : "Slot added.",
    );
    setBusy(false);
    if (!("error" in res)) setStartsAt("");
    await refresh();
  }

  async function removeSlot(id: string) {
    if (!window.confirm("Delete this slot? Any booking on it is removed too.")) return;
    setBusy(true);
    await adminDeleteSlot({ data: { id } });
    setBusy(false);
    await refresh();
  }

  async function saveRecording(b: BookingRow) {
    setBusy(true);
    setNotice(null);
    const res = await adminUpdateBooking({
      data: { id: b.id, recordingUrl: recordingDrafts[b.id] ?? b.recording_url ?? "", status: "completed" },
    });
    setNotice("error" in res ? "Could not save the recording link." : "Recording saved.");
    setBusy(false);
    await refresh();
  }

  const bookedSlotIds = new Set(bookings.filter((b) => b.status === "booked").map((b) => b.slot_id));
  const slotById = new Map(slots.map((s) => [s.id, s]));

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Individual session slots</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Open 30-minute time slots; students book up to 2 per 30-day cycle. After each session, paste
        the recording link so the student can rewatch it.
      </p>

      {notice && <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>}

      <form onSubmit={addSlot} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
        <label className="text-sm text-foreground">
          New slot
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Add slot
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Open slots</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {slots
          .filter((s) => !bookedSlotIds.has(s.id))
          .map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {new Date(s.starts_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
              </p>
              <button
                onClick={() => void removeSlot(s.id)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-muted"
              >
                Delete
              </button>
            </li>
          ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Bookings</h2>
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {bookings.map((b) => {
            const slot = slotById.get(b.slot_id);
            return (
              <li key={b.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {b.full_name ?? b.email} —{" "}
                      {slot
                        ? new Date(slot.starts_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
                        : "(slot removed)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.email} · {b.status}
                      {b.recording_url ? " · recording set" : ""}
                    </p>
                  </div>
                  <select
                    value={b.status}
                    disabled={busy}
                    onChange={async (e) => {
                      setBusy(true);
                      await adminUpdateBooking({ data: { id: b.id, status: e.target.value as "booked" | "completed" | "canceled" } });
                      setBusy(false);
                      await refresh();
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="booked">booked</option>
                    <option value="completed">completed</option>
                    <option value="canceled">canceled</option>
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="url"
                    placeholder="Recording URL"
                    value={recordingDrafts[b.id] ?? b.recording_url ?? ""}
                    onChange={(e) => setRecordingDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void saveRecording(b)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    Save recording
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

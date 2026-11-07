import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { adminDeleteClass, adminListClasses, adminSaveClass } from "@/lib/admin-members.functions";

export const Route = createFileRoute("/_authenticated/admin/classes")({
  component: AdminClassesPage,
});

type ClassRow = {
  id: string;
  title: string;
  starts_at: string;
  live_url: string | null;
  replay_url: string | null;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await adminListClasses();
    setClasses("error" in res ? [] : (res.classes as ClassRow[]));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(c: ClassRow) {
    setEditing(c);
    setTitle(c.title);
    setStartsAt(toLocalInput(c.starts_at));
    setLiveUrl(c.live_url ?? "");
    setReplayUrl(c.replay_url ?? "");
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setStartsAt("");
    setLiveUrl("");
    setReplayUrl("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await adminSaveClass({
      data: { id: editing?.id, title, startsAt, liveUrl, replayUrl },
    });
    setNotice("error" in res ? "Could not save. Please try again." : "Saved.");
    setBusy(false);
    if (!("error" in res)) resetForm();
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this class?")) return;
    setBusy(true);
    await adminDeleteClass({ data: { id } });
    setBusy(false);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Classes & replays</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Schedule weekly live classes and paste replay links afterward. Replays only reach
        Complete-tier students from their own enrollment date.
      </p>

      {notice && <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>}

      <form onSubmit={save} className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">{editing ? "Edit class" : "New class"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Class title"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="url"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="Live room URL (Zoom, Meet…)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="url"
            value={replayUrl}
            onChange={(e) => setReplayUrl(e.target.value)}
            placeholder="Replay URL (after the class)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {editing ? "Save changes" : "Add class"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <ul className="mt-6 space-y-3">
        {(classes ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{c.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(c.starts_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
                {c.live_url ? " · live link set" : ""}
                {c.replay_url ? " · replay set" : ""}
              </p>
            </div>
            <button
              onClick={() => startEdit(c)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Edit
            </button>
            <button
              onClick={() => void remove(c.id)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-muted"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

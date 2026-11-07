import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  adminDeleteFoundationsItem,
  adminListFoundations,
  adminSaveFoundationsItem,
} from "@/lib/admin-members.functions";

export const Route = createFileRoute("/_authenticated/admin/foundations")({
  component: AdminFoundationsPage,
});

type Item = {
  id: string;
  title: string;
  description: string | null;
  media_url: string;
  sort_order: number;
  active: boolean;
};

function AdminFoundationsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await adminListFoundations();
    setItems("error" in res ? [] : (res.items as Item[]));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(item: Item) {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setMediaUrl(item.media_url);
    setSortOrder(item.sort_order);
    setActive(item.active);
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setMediaUrl("");
    setSortOrder(0);
    setActive(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await adminSaveFoundationsItem({
      data: { id: editing?.id, title, description, mediaUrl, sortOrder, active },
    });
    setNotice("error" in res ? "Could not save. Please try again." : "Saved.");
    setBusy(false);
    if (!("error" in res)) resetForm();
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this library item?")) return;
    setBusy(true);
    await adminDeleteFoundationsItem({ data: { id } });
    setBusy(false);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold text-foreground">Foundations Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recorded Method Foundations materials, visible to every active student.
      </p>

      {notice && <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-foreground">{notice}</p>}

      <form onSubmit={save} className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">{editing ? "Edit item" : "New item"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            required
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Media URL (video/audio/document)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">
              Order{" "}
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="ml-1 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visible
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {editing ? "Save changes" : "Add item"}
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
        {(items ?? []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {item.sort_order}. {item.title} {!item.active && <span className="text-xs text-muted-foreground">(hidden)</span>}
              </p>
              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            </div>
            <button
              onClick={() => startEdit(item)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Edit
            </button>
            <button
              onClick={() => void remove(item.id)}
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

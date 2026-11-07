import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  head: () => ({
    meta: [
      { title: "Scholarship programs | The Power of Conscious Voice" },
      { name: "description", content: "Create and manage scholarship programs for The Power of Conscious Voice." },
      { property: "og:title", content: "Scholarship programs | The Power of Conscious Voice" },
      { property: "og:description", content: "Create and manage scholarship programs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProgramsPage,
});

type Program = Tables<"scholarship_programs">;
const EMPTY = { name: "", description: "", seats: "3", discount_percent: "100", deadline: "" };
const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";

function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("scholarship_programs").select("*").order("created_at", { ascending: false });
    if (error) setError("Could not load programs.");
    else setPrograms(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const seats = Number(form.seats);
    const discount = Number(form.discount_percent);
    if (!form.name.trim()) return setError("Name is required.");
    if (!Number.isInteger(seats) || seats < 1) return setError("Seats must be 1 or more.");
    if (!Number.isInteger(discount) || discount < 1 || discount > 100) return setError("Discount must be 1–100%.");
    const row = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      seats,
      discount_percent: discount,
      deadline: form.deadline || null,
    };
    const { error } = editingId
      ? await supabase.from("scholarship_programs").update(row).eq("id", editingId)
      : await supabase.from("scholarship_programs").insert(row);
    if (error) return setError("Could not save the program.");
    setForm(EMPTY);
    setEditingId(null);
    void load();
  }

  async function toggle(p: Program) {
    await supabase.from("scholarship_programs").update({ active: !p.active }).eq("id", p.id);
    void load();
  }

  async function remove(p: Program) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await supabase.from("scholarship_programs").delete().eq("id", p.id);
    void load();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-foreground">Scholarship programs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Register each scholarship offering. Awards always depend on Cuca Medina’s human review.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={save} className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground">Name</span>
          <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Global Solidarity Scholarship" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground">Description</span>
          <textarea className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Seats</span>
          <input type="number" min={1} className={input} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Discount (%)</span>
          <input type="number" min={1} max={100} className={input} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Application deadline</span>
          <input type="date" className={input} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {editingId ? "Save changes" : "Create program"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="mt-6 space-y-3">
        {programs.length === 0 && <p className="text-sm text-muted-foreground">No programs yet.</p>}
        {programs.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-foreground">
                  {p.name}{" "}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${p.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.seats} seat(s) · {p.discount_percent}% off{p.deadline ? ` · deadline ${p.deadline}` : ""}
                </p>
                {p.description && <p className="mt-2 text-sm text-foreground">{p.description}</p>}
              </div>
              <div className="flex gap-2 text-sm">
                <button className="text-primary hover:underline" onClick={() => {
                  setEditingId(p.id);
                  setForm({ name: p.name, description: p.description ?? "", seats: String(p.seats), discount_percent: String(p.discount_percent), deadline: p.deadline ?? "" });
                }}>Edit</button>
                <button className="text-muted-foreground hover:underline" onClick={() => toggle(p)}>{p.active ? "Deactivate" : "Activate"}</button>
                <button className="text-destructive hover:underline" onClick={() => remove(p)}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

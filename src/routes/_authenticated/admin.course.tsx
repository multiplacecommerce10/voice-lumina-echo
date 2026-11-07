import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KIND_LABEL, type Lesson, type LessonItem, type Module, type Slide } from "@/lib/course";

export const Route = createFileRoute("/_authenticated/admin/course")({
  head: () => ({ meta: [{ title: "Course admin — The Power of Conscious Voice" }, { name: "robots", content: "noindex" }] }),
  component: AdminCourse,
});

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const btn = "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground";
const ghost = "rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted";

function AdminCourse() {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [m, l] = await Promise.all([
      supabase.from("course_modules").select("*").order("sort_order"),
      supabase.from("course_lessons").select("*").order("sort_order"),
    ]);
    setModules((m.data ?? []) as Module[]); setLessons((l.data ?? []) as Lesson[]);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const run = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) toast.error("Could not save"); else { toast.success("Saved"); await reload(); } };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Course modules</h1>
        <p className="text-sm text-muted-foreground">Netflix-style modules shown to every active student (Live and Complete).</p>
      </div>
      <button className={btn} onClick={() => run(supabase.from("course_modules").insert({ title: "New module", sort_order: modules.length + 1 }))}>+ Add module</button>

      {modules.map((m) => (
        <section key={m.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <ModuleEditor m={m} onSave={(v) => run(supabase.from("course_modules").update(v).eq("id", m.id))}
            onDelete={() => confirm("Delete this module and all its lessons?") && run(supabase.from("course_modules").delete().eq("id", m.id))} />
          <ul className="space-y-2">
            {lessons.filter((l) => l.module_id === m.id).map((l) => (
              <li key={l.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium text-foreground">{l.sort_order}. {l.title}{!l.active && " (hidden)"}</span>
                  <button className={ghost} onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)}>{openLesson === l.id ? "Close" : "Edit"}</button>
                </div>
                {openLesson === l.id && <LessonEditor l={l} onSave={(v) => run(supabase.from("course_lessons").update(v).eq("id", l.id))}
                  onDelete={() => confirm("Delete this lesson?") && run(supabase.from("course_lessons").delete().eq("id", l.id))} />}
              </li>
            ))}
          </ul>
          <button className={ghost} onClick={() => run(supabase.from("course_lessons").insert({ module_id: m.id, title: "New lesson", sort_order: lessons.filter((l) => l.module_id === m.id).length + 1 }))}>+ Add lesson</button>
        </section>
      ))}

      <PersonaEditor />
    </main>
  );
}

function ModuleEditor({ m, onSave, onDelete }: { m: Module; onSave: (v: Partial<Module>) => void; onDelete: () => void }) {
  const [v, setV] = useState(m);
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_80px]">
      <input className={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Module title" />
      <input className={input} value={v.cover_url ?? ""} onChange={(e) => setV({ ...v, cover_url: e.target.value || null })} placeholder="Cover image URL (optional)" />
      <input className={input} type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} title="Order" />
      <textarea className={`${input} md:col-span-3`} rows={2} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value || null })} placeholder="Description" />
      <div className="flex items-center gap-3 md:col-span-3">
        <label className="flex items-center gap-1 text-sm text-muted-foreground"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Visible</label>
        <button className={btn} onClick={() => onSave({ title: v.title, cover_url: v.cover_url, sort_order: v.sort_order, description: v.description, active: v.active })}>Save module</button>
        <button className="ml-auto text-xs text-destructive" onClick={onDelete}>Delete module</button>
      </div>
    </div>
  );
}

function LessonEditor({ l, onSave, onDelete }: { l: Lesson; onSave: (v: Partial<Lesson>) => void; onDelete: () => void }) {
  const [v, setV] = useState(l);
  const [items, setItems] = useState<LessonItem[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("lesson_items").select("*").eq("lesson_id", l.id).order("sort_order");
    setItems((data ?? []) as unknown as LessonItem[]);
  }, [l.id]);
  useEffect(() => { void load(); }, [load]);

  const addItem = async (kind: LessonItem["kind"]) => {
    const { error } = await supabase.from("lesson_items").insert({ lesson_id: l.id, kind, title: KIND_LABEL[kind], sort_order: items.length + 1 });
    if (error) toast.error("Could not add"); else void load();
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_90px_80px]">
        <input className={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Lesson title" />
        <input className={input} value={v.cover_url ?? ""} onChange={(e) => setV({ ...v, cover_url: e.target.value || null })} placeholder="Cover image URL" />
        <input className={input} type="number" value={v.duration_minutes ?? ""} onChange={(e) => setV({ ...v, duration_minutes: e.target.value ? Number(e.target.value) : null })} placeholder="Min" />
        <input className={input} type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} title="Order" />
        <textarea className={`${input} md:col-span-4`} rows={2} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value || null })} placeholder="Description" />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-sm text-muted-foreground"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Visible</label>
        <button className={btn} onClick={() => onSave({ title: v.title, cover_url: v.cover_url, duration_minutes: v.duration_minutes, sort_order: v.sort_order, description: v.description, active: v.active })}>Save lesson</button>
        <button className="ml-auto text-xs text-destructive" onClick={onDelete}>Delete lesson</button>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials</p>
      {items.map((it) => <ItemEditor key={it.id} it={it} onChange={load} />)}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as LessonItem["kind"][]).map((k) => <button key={k} className={ghost + " border border-border"} onClick={() => addItem(k)}>+ {KIND_LABEL[k]}</button>)}
      </div>
    </div>
  );
}

function ItemEditor({ it, onChange }: { it: LessonItem; onChange: () => void }) {
  const [v, setV] = useState(it);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const { error } = await supabase.from("lesson_items").update({ title: v.title, url: v.url, sort_order: v.sort_order, storage_path: v.storage_path, slides: v.slides as never }).eq("id", it.id);
    if (error) toast.error("Could not save"); else { toast.success("Saved"); onChange(); }
  };
  const upload = async (file: File) => {
    setBusy(true);
    const path = `${it.lesson_id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) toast.error("Upload failed"); else { setV({ ...v, storage_path: path }); toast.success("Uploaded — remember to save"); }
  };
  const setSlide = (i: number, s: Partial<Slide>) => setV({ ...v, slides: v.slides.map((x, j) => (j === i ? { ...x, ...s } : x)) });

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{KIND_LABEL[it.kind]}</span>
        <input className={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Tab title" />
        <input className={`${input} w-20`} type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} />
      </div>
      {it.kind !== "slide_deck" && it.kind !== "pdf" && (
        <input className={input} value={v.url ?? ""} onChange={(e) => setV({ ...v, url: e.target.value || null })}
          placeholder={it.kind === "video" ? "Video link (YouTube, Vimeo, Bunny, .mp4…)" : it.kind === "external_app" ? "App address (e.g. Vocal Awareness Coach)" : it.kind === "flashcards" ? "Flashcards file link (JSON list of front/back)" : "Google Slides / Canva link"} />
      )}
      {it.kind === "pdf" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="file" accept="application/pdf" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {v.storage_path && <span className="truncate">✓ {v.storage_path.split("/").pop()}</span>}
        </div>
      )}
      {it.kind === "slide_deck" && (
        <div className="space-y-2">
          {v.slides.map((s, i) => (
            <div key={i} className="grid gap-1 rounded border border-border bg-background p-2">
              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Slide {i + 1}</span>
                <button className="ml-auto text-xs text-destructive" onClick={() => setV({ ...v, slides: v.slides.filter((_, j) => j !== i) })}>Remove</button></div>
              <input className={input} value={s.title} onChange={(e) => setSlide(i, { title: e.target.value })} placeholder="Slide title" />
              <textarea className={input} rows={3} value={s.body} onChange={(e) => setSlide(i, { body: e.target.value })} placeholder="Slide text" />
              <input className={input} value={s.imageUrl ?? ""} onChange={(e) => setSlide(i, { imageUrl: e.target.value || undefined })} placeholder="Image URL (optional)" />
            </div>
          ))}
          <button className={ghost + " border border-border"} onClick={() => setV({ ...v, slides: [...v.slides, { title: "", body: "" }] })}>+ Add slide</button>
        </div>
      )}
      <div className="flex gap-2">
        <button className={btn} onClick={save}>Save material</button>
        <button className="ml-auto text-xs text-destructive" onClick={async () => { if (confirm("Remove this material?")) { await supabase.from("lesson_items").delete().eq("id", it.id); onChange(); } }}>Remove</button>
      </div>
    </div>
  );
}

function PersonaEditor() {
  const [ps, setPs] = useState<{ key: string; title: string; subtitle: string | null; instructions: string }[]>([]);
  useEffect(() => { void supabase.from("assistant_personas").select("key, title, subtitle, instructions").order("sort_order").then(({ data }) => setPs(data ?? [])); }, []);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground">Voice Assistant specialists</h2>
      <p className="text-sm text-muted-foreground">Base instructions for each of the three chats. Safety rules (no diagnoses, no guaranteed results) are always added automatically.</p>
      {ps.map((p, i) => (
        <div key={p.key} className="space-y-2">
          <input className={input} value={p.title} onChange={(e) => setPs(ps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <input className={input} value={p.subtitle ?? ""} onChange={(e) => setPs(ps.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)))} placeholder="Subtitle" />
          <textarea className={input} rows={5} value={p.instructions} onChange={(e) => setPs(ps.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} />
          <button className={btn} onClick={async () => { const { error } = await supabase.from("assistant_personas").update({ title: p.title, subtitle: p.subtitle, instructions: p.instructions, updated_at: new Date().toISOString() }).eq("key", p.key); if (error) toast.error("Could not save"); else toast.success("Saved"); }}>Save {p.title}</button>
        </div>
      ))}
    </section>
  );
}

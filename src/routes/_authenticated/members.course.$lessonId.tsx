import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KIND_LABEL, isDirectVideo, loadCourse, signedFileUrl, toEmbed, type Lesson, type LessonItem, type Slide } from "@/lib/course";

export const Route = createFileRoute("/_authenticated/members/course/$lessonId")({
  head: () => ({ meta: [{ title: "Lesson — The Power of Conscious Voice" }, { name: "robots", content: "noindex" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [order, setOrder] = useState<Lesson[]>([]);
  const [items, setItems] = useState<LessonItem[]>([]);
  const [tab, setTab] = useState(0);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setTab(0);
    void (async () => {
      const [{ modules, lessons, progress }, it, u] = await Promise.all([
        loadCourse(),
        supabase.from("lesson_items").select("*").eq("lesson_id", lessonId).order("sort_order"),
        supabase.auth.getUser(),
      ]);
      const mOrder = new Map(modules.map((m) => [m.id, m.sort_order]));
      const ordered = [...lessons].sort((a, b) => (mOrder.get(a.module_id)! - mOrder.get(b.module_id)!) || a.sort_order - b.sort_order);
      setOrder(ordered);
      setLesson(lessons.find((l) => l.id === lessonId) ?? null);
      setItems((it.data ?? []) as unknown as LessonItem[]);
      setDone(progress.some((p) => p.lesson_id === lessonId && p.completed));
      const uid = u.data.user?.id ?? null;
      setUserId(uid);
      if (uid) await supabase.from("lesson_progress").upsert({ user_id: uid, lesson_id: lessonId, last_opened_at: new Date().toISOString(), completed: progress.some((p) => p.lesson_id === lessonId && p.completed) }, { onConflict: "user_id,lesson_id" });
    })();
  }, [lessonId]);

  if (!lesson) return <p className="p-10 text-sm text-muted-foreground">Loading lesson…</p>;
  const idx = order.findIndex((l) => l.id === lessonId);
  const prev = order[idx - 1], next = order[idx + 1];
  const item = items[tab];

  const toggleDone = async () => {
    if (!userId) return;
    const v = !done; setDone(v);
    await supabase.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId, completed: v, last_opened_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
  };

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <Link to="/members/course" className="text-sm text-muted-foreground hover:text-foreground">← All modules</Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">{lesson.title}</h1>
      {lesson.description && <p className="mt-1 text-muted-foreground">{lesson.description}</p>}

      {items.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {items.map((it, i) => (
            <button key={it.id} onClick={() => setTab(i)} className={`rounded-md px-3 py-1.5 text-sm ${i === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {it.title || KIND_LABEL[it.kind]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {item ? <ItemView key={item.id} item={item} /> : <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Materials for this lesson are being prepared.</div>}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {prev ? <Link to="/members/course/$lessonId" params={{ lessonId: prev.id }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> {prev.title}</Link> : <span />}
        <button onClick={toggleDone} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${done ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}>
          <CheckCircle2 className="h-4 w-4" /> {done ? "Completed" : "Mark as completed"}
        </button>
        {next ? <Link to="/members/course/$lessonId" params={{ lessonId: next.id }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">{next.title} <ChevronRight className="h-4 w-4" /></Link> : <span />}
      </div>
    </main>
  );
}

function ItemView({ item }: { item: LessonItem }) {
  const [pdf, setPdf] = useState<string | null>(null);
  useEffect(() => { if (item.kind === "pdf" && item.storage_path) void signedFileUrl(item.storage_path).then(setPdf); }, [item]);
  const frame = "aspect-video w-full rounded-xl border border-border bg-card";

  if (item.kind === "video" && item.url)
    return isDirectVideo(item.url) ? <video src={item.url} controls className={frame} /> : <iframe src={toEmbed(item.url)} className={frame} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.title} />;
  if (item.kind === "pdf") {
    const src = pdf ?? item.url;
    return src ? <iframe src={src} className="h-[75vh] w-full rounded-xl border border-border bg-card" title={item.title} /> : <p className="text-sm text-muted-foreground">Loading slides…</p>;
  }
  if (item.kind === "slides_link" && item.url)
    return <div><iframe src={toEmbed(item.url)} className={frame} allowFullScreen title={item.title} /><a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary">Open in a new tab <ExternalLink className="h-3.5 w-3.5" /></a></div>;
  if (item.kind === "slide_deck") return <SlideDeck slides={item.slides ?? []} />;
  if (item.kind === "flashcards" && item.url) return <Flashcards url={item.url} />;
  if (item.kind === "external_app" && item.url)
    return (
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/15 to-card p-8 text-center md:p-12">
        <h2 className="text-xl font-semibold text-foreground">{item.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">This lesson continues in an interactive companion app. It opens in a new tab.</p>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground">Open {item.title} <ExternalLink className="h-4 w-4" /></a>
      </div>
    );
  return <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center"><div><p className="font-medium text-foreground">{item.kind === "video" ? "Video coming soon" : "Coming soon"}</p><p className="mt-1 text-sm text-muted-foreground">This material will be published as the live classes unfold.</p></div></div>;
}

function SlideDeck({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, slides.length - 1)); if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0)); if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [slides.length]);
  if (!slides.length) return <p className="text-sm text-muted-foreground">This presentation has no slides yet.</p>;
  const s = slides[i];
  return (
    <div className={full ? "fixed inset-0 z-50 flex flex-col bg-background p-6" : ""}>
      <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-8 text-center ${full ? "flex-1" : "aspect-video"}`}>
        {s.imageUrl && <img src={s.imageUrl} alt="" className="mb-4 max-h-[50%] rounded-lg object-contain" />}
        <h2 className="text-2xl font-semibold text-foreground md:text-4xl">{s.title}</h2>
        {s.body && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-muted-foreground md:text-lg">{s.body}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setI(Math.max(i - 1, 0))} disabled={i === 0} className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Previous slide"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-sm text-muted-foreground">{i + 1} / {slides.length}</span>
        <div className="flex gap-1">
          <button onClick={() => setFull(!full)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Full screen"><Maximize2 className="h-5 w-5" /></button>
          <button onClick={() => setI(Math.min(i + 1, slides.length - 1))} disabled={i === slides.length - 1} className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Next slide"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}

function Flashcards({ url }: { url: string }) {
  const [cards, setCards] = useState<{ front: string; back: string }[] | null>(null);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  useEffect(() => { void fetch(url).then((r) => r.json()).then(setCards).catch(() => setCards([])); }, [url]);
  if (!cards) return <p className="text-sm text-muted-foreground">Loading flashcards…</p>;
  if (!cards.length) return <p className="text-sm text-muted-foreground">No flashcards yet.</p>;
  const go = (d: number) => { setFlip(false); setI((v) => (v + d + cards.length) % cards.length); };
  const c = cards[i];
  return (
    <div>
      <button onClick={() => setFlip(!flip)} aria-label="Flip card"
        className={`flex aspect-video w-full flex-col items-center justify-center rounded-xl border p-8 text-center transition-colors ${flip ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
        <span className="text-xs uppercase tracking-[0.25em] text-primary">{flip ? "Answer" : "Question"}</span>
        <span className="mt-4 max-w-2xl text-lg text-foreground md:text-2xl">{flip ? c.back : c.front}</span>
        {!flip && <span className="mt-6 text-xs text-muted-foreground">Tap to reveal the answer</span>}
      </button>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => go(-1)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Previous card"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-sm text-muted-foreground">{i + 1} / {cards.length} · {known.size} mastered</span>
        <div className="flex items-center gap-1">
          <button onClick={() => { setKnown(new Set(known).add(i)); go(1); }} className="rounded-md bg-primary/15 px-3 py-1.5 text-xs text-primary">I know this</button>
          <button onClick={() => go(1)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Next card"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}

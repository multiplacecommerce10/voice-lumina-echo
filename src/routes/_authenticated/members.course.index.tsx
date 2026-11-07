import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, CheckCircle2 } from "lucide-react";
import { loadCourse, type Lesson, type Module } from "@/lib/course";

export const Route = createFileRoute("/_authenticated/members/course/")({
  head: () => ({ meta: [{ title: "Course — The Power of Conscious Voice" }, { name: "robots", content: "noindex" }] }),
  component: CoursePage,
});

type State = { modules: Module[]; lessons: Lesson[]; done: Set<string>; last?: Lesson } | null;

function CoursePage() {
  const [s, setS] = useState<State>(null);
  useEffect(() => {
    void loadCourse().then(({ modules, lessons, progress }) => {
      const sorted = [...progress].sort((a, b) => b.last_opened_at.localeCompare(a.last_opened_at));
      const last = lessons.find((l) => l.id === sorted[0]?.lesson_id) ?? lessons[0];
      setS({ modules, lessons, done: new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id)), last });
    });
  }, []);

  if (!s) return <p className="p-10 text-sm text-muted-foreground">Loading the course…</p>;
  if (s.modules.length === 0)
    return <main className="mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-semibold text-foreground">Course not available yet</h1><p className="mt-2 text-sm text-muted-foreground">Modules open once your enrollment is active.</p></main>;

  return (
    <main className="pb-16">
      {s.last && (
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/25 via-card to-background">
          {s.last.cover_url && <img src={s.last.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
          <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Continue watching</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold text-foreground md:text-5xl">{s.last.title}</h1>
            {s.last.description && <p className="mt-3 max-w-xl text-muted-foreground">{s.last.description}</p>}
            <Link to="/members/course/$lessonId" params={{ lessonId: s.last.id }} className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground">
              <Play className="h-4 w-4" /> Play
            </Link>
          </div>
        </section>
      )}
      <div className="mx-auto max-w-6xl space-y-10 px-6 pt-10">
        {s.modules.map((m) => {
          const ls = s.lessons.filter((l) => l.module_id === m.id);
          const pct = ls.length ? Math.round((ls.filter((l) => s.done.has(l.id)).length / ls.length) * 100) : 0;
          return (
            <section key={m.id}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{m.title}</h2>
                  {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{pct}% complete</span>
              </div>
              <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
                {ls.map((l, i) => (
                  <Link key={l.id} to="/members/course/$lessonId" params={{ lessonId: l.id }}
                    className="group w-64 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-transform hover:scale-[1.03]">
                    <div className="relative aspect-video bg-gradient-to-br from-primary/30 to-muted">
                      {l.cover_url ? <img src={l.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        : <span className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-foreground/30">{i + 1}</span>}
                      <Play className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-primary p-2 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      {s.done.has(l.id) && <CheckCircle2 className="absolute left-2 top-2 h-5 w-5 text-primary" />}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground">{i + 1}. {l.title}</p>
                      {l.duration_minutes && <p className="text-xs text-muted-foreground">{l.duration_minutes} min</p>}
                    </div>
                  </Link>
                ))}
                {ls.length === 0 && <p className="text-sm text-muted-foreground">Lessons coming soon.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

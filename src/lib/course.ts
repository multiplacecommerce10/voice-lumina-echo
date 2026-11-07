import { supabase } from "@/integrations/supabase/client";

export type Slide = { title: string; body: string; imageUrl?: string };
export type LessonItem = {
  id: string; lesson_id: string; kind: "video" | "pdf" | "slides_link" | "slide_deck" | "external_app" | "flashcards";
  title: string; url: string | null; storage_path: string | null; slides: Slide[]; sort_order: number;
};
export type Lesson = { id: string; module_id: string; title: string; description: string | null; cover_url: string | null; duration_minutes: number | null; sort_order: number; active: boolean };
export type Module = { id: string; title: string; description: string | null; cover_url: string | null; sort_order: number; active: boolean };

export const KIND_LABEL: Record<LessonItem["kind"], string> = {
  video: "Video", pdf: "Slides (PDF)", slides_link: "Slides (link)", slide_deck: "Slide presentation", external_app: "Interactive app", flashcards: "Flashcards",
};

/** Turn YouTube/Vimeo watch links into embeddable URLs; other links pass through. */
export function toEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const gs = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);
  if (gs) return `https://docs.google.com/presentation/d/${gs[1]}/embed`;
  return url;
}
export const isDirectVideo = (url: string) => /\.(mp4|webm|m3u8|mov)(\?|$)/i.test(url);

export async function signedFileUrl(path: string) {
  const { data } = await supabase.storage.from("course-files").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function loadCourse() {
  const [m, l, p] = await Promise.all([
    supabase.from("course_modules").select("*").order("sort_order"),
    supabase.from("course_lessons").select("*").order("sort_order"),
    supabase.from("lesson_progress").select("lesson_id, completed, last_opened_at"),
  ]);
  return {
    error: m.error ?? l.error,
    modules: (m.data ?? []) as Module[],
    lessons: (l.data ?? []) as Lesson[],
    progress: p.data ?? [],
  };
}

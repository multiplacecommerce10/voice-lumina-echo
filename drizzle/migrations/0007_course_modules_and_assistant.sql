CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read modules" ON public.course_modules FOR SELECT TO authenticated USING ((active AND public.has_active_membership()) OR public.is_admin());
CREATE POLICY "Admins manage modules" ON public.course_modules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read lessons" ON public.course_lessons FOR SELECT TO authenticated USING ((active AND public.has_active_membership()) OR public.is_admin());
CREATE POLICY "Admins manage lessons" ON public.course_lessons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.lesson_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'video',
  title text NOT NULL,
  url text,
  storage_path text,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_items_kind_check CHECK (kind IN ('video','pdf','slides_link','slide_deck','external_app'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_items TO authenticated;
GRANT ALL ON public.lesson_items TO service_role;
ALTER TABLE public.lesson_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read lesson items" ON public.lesson_items FOR SELECT TO authenticated USING (public.has_active_membership() OR public.is_admin());
CREATE POLICY "Admins manage lesson items" ON public.lesson_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own progress read" ON public.lesson_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own progress insert" ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (public.has_active_membership() OR public.is_admin()));
CREATE POLICY "Own progress update" ON public.lesson_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own progress delete" ON public.lesson_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.assistant_personas (
  key text PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  instructions text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_personas TO authenticated;
GRANT ALL ON public.assistant_personas TO service_role;
ALTER TABLE public.assistant_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read personas" ON public.assistant_personas FOR SELECT TO authenticated USING (public.has_active_membership() OR public.is_admin());
CREATE POLICY "Admins manage personas" ON public.assistant_personas FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_key text NOT NULL REFERENCES public.assistant_personas(key) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_messages_role_check CHECK (role IN ('user','assistant'))
);
CREATE INDEX assistant_messages_user_persona_idx ON public.assistant_messages (user_id, persona_key, created_at);
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages read" ON public.assistant_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own messages insert" ON public.assistant_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (public.has_active_membership() OR public.is_admin()));
CREATE POLICY "Own messages delete" ON public.assistant_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members read course files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'course-files' AND (public.has_active_membership() OR public.is_admin()));
CREATE POLICY "Admins upload course files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-files' AND public.is_admin());
CREATE POLICY "Admins update course files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'course-files' AND public.is_admin());
CREATE POLICY "Admins delete course files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'course-files' AND public.is_admin());

INSERT INTO public.assistant_personas (key, title, subtitle, instructions, sort_order) VALUES
('proprioception', 'Vocal Proprioception', 'Sensing your voice from the inside', 'You are a specialist guide in vocal proprioception within Cuca Medina''s method "The Power of Conscious Voice". Help the student notice and describe internal sensations of breathing, support, resonance, laryngeal and articulatory movement, and body alignment while singing and speaking. Offer gentle, concrete awareness exercises and reflective questions.', 1),
('crossover', 'Style Physiology & Crossover Singing', 'How the voice adapts across styles', 'You are a specialist guide in the physiology of the singing voice applied to style and crossover singing (classical, popular, musical theatre, world and experimental styles) within Cuca Medina''s method "The Power of Conscious Voice". Explain registers, resonance strategies, vowel shaping, onset, vibrato and stylistic choices in clear, accurate language, and connect them to musical interpretation and artistic and communicative voice.', 2),
('mindset', 'Vocal Self-Knowledge & Mindset', 'Identity, confidence and expression', 'You are a supportive guide in vocal self-knowledge and mindset within Cuca Medina''s method "The Power of Conscious Voice". Help the student reflect on vocal identity, artistic expression, performance confidence, practice habits and creative goals, with warmth and practical reflective prompts.', 3);

WITH m AS (
  INSERT INTO public.course_modules (title, description, sort_order)
  VALUES ('Module 1 — Foundations of Conscious Voice', 'The bodily and acoustic foundations of a conscious, expressive voice.', 1)
  RETURNING id
), l AS (
  INSERT INTO public.course_lessons (module_id, title, sort_order)
  SELECT m.id, v.title, v.ord FROM m, (VALUES ('Breathing and Support', 1), ('Body Awareness', 2), ('Phonation', 3), ('Foundations', 4)) AS v(title, ord)
  RETURNING id, title
)
INSERT INTO public.lesson_items (lesson_id, kind, title, url, sort_order)
SELECT l.id, 'external_app', 'Vocal Awareness Coach', 'https://id-preview--d46817a5-947a-4502-a250-105041b3fc57.lovable.app', 1 FROM l WHERE l.title = 'Foundations';
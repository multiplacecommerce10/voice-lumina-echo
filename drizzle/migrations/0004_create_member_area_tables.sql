-- Helper: does the signed-in user have an active/grace membership?
CREATE OR REPLACE FUNCTION public.has_active_membership()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_subscriptions
    WHERE email = lower(auth.jwt() ->> 'email')
      AND access_status IN ('active', 'grace')
  )
$$;

-- Weekly live cohort classes + replays
CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  live_url text,
  replay_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can read classes"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (public.has_active_membership() OR public.is_admin());
CREATE POLICY "Admins manage classes"
  ON public.class_sessions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_class_sessions_updated_at BEFORE UPDATE ON public.class_sessions
  EXECUTE FUNCTION set_leads_updated_at();

-- Method Foundations recorded library
CREATE TABLE public.foundations_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  media_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.foundations_items TO authenticated;
GRANT ALL ON public.foundations_items TO service_role;
ALTER TABLE public.foundations_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can read foundations"
  ON public.foundations_items FOR SELECT TO authenticated
  USING (public.has_active_membership() OR public.is_admin());
CREATE POLICY "Admins manage foundations"
  ON public.foundations_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_foundations_items_updated_at BEFORE UPDATE ON public.foundations_items
  EXECUTE FUNCTION set_leads_updated_at();

-- Bookable individual-session time slots (created by admin)
CREATE TABLE public.session_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.session_slots TO authenticated;
GRANT ALL ON public.session_slots TO service_role;
ALTER TABLE public.session_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can read slots"
  ON public.session_slots FOR SELECT TO authenticated
  USING (public.has_active_membership() OR public.is_admin());
CREATE POLICY "Admins manage slots"
  ON public.session_slots FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Student bookings of individual sessions (max 2 per 30-day cycle enforced in app logic)
CREATE TABLE public.session_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.session_slots(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'booked',
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_bookings TO authenticated;
GRANT ALL ON public.session_bookings TO service_role;
ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own bookings"
  ON public.session_bookings FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email') OR public.is_admin());
CREATE POLICY "Members book for themselves"
  ON public.session_bookings FOR INSERT TO authenticated
  WITH CHECK (email = lower(auth.jwt() ->> 'email') AND public.has_active_membership());
CREATE POLICY "Members cancel own bookings"
  ON public.session_bookings FOR DELETE TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));
CREATE POLICY "Admins manage bookings"
  ON public.session_bookings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_session_bookings_updated_at BEFORE UPDATE ON public.session_bookings
  EXECUTE FUNCTION set_leads_updated_at();

-- Conscious Voice Transformation Portfolio submissions
CREATE TABLE public.portfolio_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  initial_sample_url text NOT NULL,
  final_sample_url text NOT NULL,
  creation_url text NOT NULL,
  reflection text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.portfolio_submissions TO authenticated;
GRANT ALL ON public.portfolio_submissions TO service_role;
ALTER TABLE public.portfolio_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own portfolio"
  ON public.portfolio_submissions FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email') OR public.is_admin());
CREATE POLICY "Members submit own portfolio"
  ON public.portfolio_submissions FOR INSERT TO authenticated
  WITH CHECK (email = lower(auth.jwt() ->> 'email') AND public.has_active_membership());
CREATE POLICY "Admins review portfolios"
  ON public.portfolio_submissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_portfolio_submissions_updated_at BEFORE UPDATE ON public.portfolio_submissions
  EXECUTE FUNCTION set_leads_updated_at();
CREATE TABLE public.scholarship_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  seats integer NOT NULL DEFAULT 1,
  discount_percent integer NOT NULL DEFAULT 100,
  deadline date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarship_programs TO authenticated;
GRANT ALL ON public.scholarship_programs TO service_role;
ALTER TABLE public.scholarship_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scholarship programs" ON public.scholarship_programs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_scholarship_programs_updated_at BEFORE UPDATE ON public.scholarship_programs FOR EACH ROW EXECUTE FUNCTION public.set_leads_updated_at();

CREATE TABLE public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  email text NOT NULL,
  full_name text,
  method text NOT NULL DEFAULT 'wise',
  plan text,
  amount_usd numeric,
  reference text,
  term_start date,
  term_end date,
  notes text,
  confirmed_by text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_payments TO authenticated;
GRANT ALL ON public.manual_payments TO service_role;
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage manual payments" ON public.manual_payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, DELETE ON public.admin_emails TO authenticated;
CREATE POLICY "Admins can list team" ON public.admin_emails FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can add team" ON public.admin_emails FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND email = lower(email));
CREATE POLICY "Admins can remove others" ON public.admin_emails FOR DELETE TO authenticated USING (public.is_admin() AND email <> lower(auth.jwt() ->> 'email'));
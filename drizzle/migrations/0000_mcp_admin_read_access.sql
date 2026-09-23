-- Admin allowlist keyed on the verified email claim, so the same person is
-- recognized whether they sign in through the app or through an MCP client.
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can see their own allowlist row" ON public.admin_emails;
CREATE POLICY "Admins can see their own allowlist row"
  ON public.admin_emails FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));

INSERT INTO public.admin_emails (email) VALUES
  ('cucamedinamusic@gmail.com'),
  ('contact@tecendosom.com'),
  ('cucamedina@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE email = lower(auth.jwt() ->> 'email')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Read-only admin access for the agent tools. Writes stay service-role only.
GRANT SELECT ON public.leads TO authenticated;
GRANT SELECT ON public.member_subscriptions TO authenticated;

DROP POLICY IF EXISTS "Admins can read leads" ON public.leads;
CREATE POLICY "Admins can read leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read member subscriptions" ON public.member_subscriptions;
CREATE POLICY "Admins can read member subscriptions"
  ON public.member_subscriptions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE TABLE public.payment_diagnostic_grants (
  invite_id uuid PRIMARY KEY REFERENCES public.payment_diagnostic_invites(id),
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_at timestamptz,
  access_until timestamptz,
  existing_access boolean NOT NULL DEFAULT false,
  member_subscription_id text
);
GRANT ALL ON public.payment_diagnostic_grants TO service_role;
ALTER TABLE public.payment_diagnostic_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only grants" ON public.payment_diagnostic_grants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.grant_diagnostic_courtesy(p_invite uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g payment_diagnostic_grants; v_sub text := 'diag:' || p_invite::text;
BEGIN
  SELECT * INTO g FROM payment_diagnostic_grants WHERE invite_id = p_invite FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_profile'; END IF;
  IF g.granted_at IS NOT NULL THEN RETURN 'already'; END IF;
  IF NOT EXISTS (SELECT 1 FROM payment_diagnostic_attempts WHERE invite_id = p_invite AND status = 'paid') THEN RETURN 'not_paid'; END IF;
  IF EXISTS (SELECT 1 FROM member_subscriptions WHERE lower(email) = lower(g.email)) THEN
    UPDATE payment_diagnostic_grants SET granted_at = now(), existing_access = true WHERE invite_id = p_invite;
    RETURN 'existing';
  END IF;
  INSERT INTO member_subscriptions (environment, provider, courtesy_access, stripe_subscription_id, email, full_name, tier, access_status,
    current_period_start, current_period_end, cancel_at_period_end, student_enrolled_at, metadata)
  VALUES ('live', 'courtesy', true, v_sub, lower(g.email), g.full_name, 'complete', 'active',
    now(), now() + interval '7 days', true, now(), jsonb_build_object('source','private_diagnostic','invite_id',p_invite));
  INSERT INTO notification_outbox (dedupe_key, environment, provider, kind, subscription_id, recipient) VALUES
    ('live:diag-grant:' || p_invite || ':confirmation', 'live', 'courtesy', 'welcome_confirmation', v_sub, lower(g.email)),
    ('live:diag-grant:' || p_invite || ':account', 'live', 'courtesy', 'account_access', v_sub, lower(g.email))
  ON CONFLICT (dedupe_key) DO NOTHING;
  UPDATE payment_diagnostic_grants SET granted_at = now(), access_until = now() + interval '7 days', member_subscription_id = v_sub WHERE invite_id = p_invite;
  RETURN 'granted';
END $$;
REVOKE ALL ON FUNCTION public.grant_diagnostic_courtesy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_diagnostic_courtesy(uuid) TO service_role;
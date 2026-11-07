ALTER TABLE public.payment_diagnostic_grants ADD COLUMN IF NOT EXISTS consent_version text, ADD COLUMN IF NOT EXISTS consent_at timestamptz;

-- Paid invitations whose courtesy grant has not been recorded yet (worker retry list).
CREATE OR REPLACE FUNCTION public.pending_diagnostic_grants()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.invite_id FROM payment_diagnostic_grants g
  WHERE g.granted_at IS NULL AND g.consent_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM payment_diagnostic_attempts a WHERE a.invite_id = g.invite_id AND a.status = 'paid' AND a.paid_at IS NOT NULL)
  LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.pending_diagnostic_grants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_diagnostic_grants() TO service_role;

CREATE OR REPLACE FUNCTION public.grant_diagnostic_courtesy(p_invite uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g payment_diagnostic_grants; v_sub text := 'diag:' || p_invite::text; v_start timestamptz; v_end timestamptz; v_existing boolean;
BEGIN
  SELECT * INTO g FROM payment_diagnostic_grants WHERE invite_id = p_invite FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_profile'; END IF;
  IF g.granted_at IS NOT NULL THEN RETURN 'already'; END IF;
  IF g.consent_at IS NULL THEN RETURN 'no_consent'; END IF;
  SELECT min(paid_at) INTO v_start FROM payment_diagnostic_attempts WHERE invite_id = p_invite AND status = 'paid' AND paid_at IS NOT NULL;
  IF v_start IS NULL THEN RETURN 'not_paid'; END IF;
  v_end := v_start + interval '7 days';
  v_existing := EXISTS (SELECT 1 FROM member_subscriptions WHERE lower(email) = lower(g.email)
      AND (environment = 'live' OR courtesy_access) AND access_status = 'active'
      AND lower(coalesce(tier,'')) = 'complete' AND current_period_end >= v_end);
  IF NOT v_existing THEN
    INSERT INTO member_subscriptions (environment, provider, courtesy_access, stripe_subscription_id, email, full_name, tier, access_status,
      current_period_start, current_period_end, cancel_at_period_end, student_enrolled_at, paid_active_months, metadata)
    VALUES ('live', 'courtesy', true, v_sub, lower(g.email), g.full_name, 'complete', 'active',
      v_start, v_end, true, v_start, 0, jsonb_build_object('source','private_diagnostic','invite_id',p_invite,'courtesy_days',7));
  END IF;
  INSERT INTO notification_outbox (dedupe_key, environment, provider, kind, subscription_id, recipient, payload) VALUES
    ('live:diag-grant:' || p_invite || ':confirmation', 'live', 'courtesy', 'welcome_confirmation', v_sub, lower(g.email), jsonb_build_object('invite_id',p_invite,'existing',v_existing)),
    ('live:diag-grant:' || p_invite || ':account', 'live', 'courtesy', 'account_access', v_sub, lower(g.email), jsonb_build_object('invite_id',p_invite,'existing',v_existing))
  ON CONFLICT (dedupe_key) DO NOTHING;
  UPDATE payment_diagnostic_grants SET granted_at = now(), existing_access = v_existing,
    access_until = CASE WHEN v_existing THEN NULL ELSE v_end END,
    member_subscription_id = CASE WHEN v_existing THEN NULL ELSE v_sub END WHERE invite_id = p_invite;
  RETURN CASE WHEN v_existing THEN 'existing' ELSE 'granted' END;
END $$;
REVOKE ALL ON FUNCTION public.grant_diagnostic_courtesy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_diagnostic_courtesy(uuid) TO service_role;
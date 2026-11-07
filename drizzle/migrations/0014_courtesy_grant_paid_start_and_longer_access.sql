CREATE OR REPLACE FUNCTION public.grant_diagnostic_courtesy(p_invite uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g payment_diagnostic_grants; v_sub text := 'diag:' || p_invite::text; v_start timestamptz; v_end timestamptz;
BEGIN
  SELECT * INTO g FROM payment_diagnostic_grants WHERE invite_id = p_invite FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_profile'; END IF;
  IF g.granted_at IS NOT NULL THEN RETURN 'already'; END IF;
  -- Start from the first provider-confirmed payment, never from client time.
  SELECT min(paid_at) INTO v_start FROM payment_diagnostic_attempts WHERE invite_id = p_invite AND status = 'paid' AND paid_at IS NOT NULL;
  IF v_start IS NULL THEN RETURN 'not_paid'; END IF;
  v_end := v_start + interval '7 days';
  -- Equal or longer real access is preserved untouched (no reduction, no extension).
  IF EXISTS (SELECT 1 FROM member_subscriptions WHERE lower(email) = lower(g.email)
      AND (environment = 'live' OR courtesy_access) AND access_status = 'active' AND current_period_end >= v_end) THEN
    UPDATE payment_diagnostic_grants SET granted_at = now(), existing_access = true WHERE invite_id = p_invite;
    RETURN 'existing';
  END IF;
  INSERT INTO member_subscriptions (environment, provider, courtesy_access, stripe_subscription_id, email, full_name, tier, access_status,
    current_period_start, current_period_end, cancel_at_period_end, student_enrolled_at, paid_active_months, metadata)
  VALUES ('live', 'courtesy', true, v_sub, lower(g.email), g.full_name, 'complete', 'active',
    v_start, v_end, true, v_start, 0, jsonb_build_object('source','private_diagnostic','invite_id',p_invite,'courtesy_days',7));
  INSERT INTO notification_outbox (dedupe_key, environment, provider, kind, subscription_id, recipient) VALUES
    ('live:diag-grant:' || p_invite || ':confirmation', 'live', 'courtesy', 'welcome_confirmation', v_sub, lower(g.email)),
    ('live:diag-grant:' || p_invite || ':account', 'live', 'courtesy', 'account_access', v_sub, lower(g.email))
  ON CONFLICT (dedupe_key) DO NOTHING;
  UPDATE payment_diagnostic_grants SET granted_at = now(), access_until = v_end, member_subscription_id = v_sub WHERE invite_id = p_invite;
  RETURN 'granted';
END $$;
REVOKE ALL ON FUNCTION public.grant_diagnostic_courtesy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_diagnostic_courtesy(uuid) TO service_role;
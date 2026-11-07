CREATE TABLE public.payment_diagnostic_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_diagnostic_invites TO service_role;
ALTER TABLE public.payment_diagnostic_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnostic_invite_service ON public.payment_diagnostic_invites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TABLE public.payment_diagnostic_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invite_id uuid NOT NULL REFERENCES public.payment_diagnostic_invites(id),
 provider text NOT NULL CHECK (provider IN ('stripe','paypal')),
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','open','pending','capturing','paid','cancelled','expired','failed','refunded')),
 consent_at timestamptz NOT NULL DEFAULT now(),
 consent_version text NOT NULL DEFAULT 'usd1-no-course-v1',
 profile_validated_at timestamptz NOT NULL DEFAULT now(),
 provider_id text UNIQUE,
 payee_id text,
 approval_url text,
 return_state_hash text,
 capture_id text,
 capture_lock_until timestamptz,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (invite_id,provider)
);
GRANT ALL ON public.payment_diagnostic_attempts TO service_role;
ALTER TABLE public.payment_diagnostic_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnostic_attempt_service ON public.payment_diagnostic_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TABLE public.payment_diagnostic_events (
 event_id text PRIMARY KEY,
 attempt_id uuid NOT NULL REFERENCES public.payment_diagnostic_attempts(id),
 event_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_diagnostic_events TO service_role;
ALTER TABLE public.payment_diagnostic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnostic_event_service ON public.payment_diagnostic_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.reserve_payment_diagnostic(p_hash text,p_provider text)
RETURNS SETOF public.payment_diagnostic_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invite uuid;
BEGIN
 SELECT id INTO v_invite FROM payment_diagnostic_invites WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF v_invite IS NULL THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
 INSERT INTO payment_diagnostic_attempts(invite_id,provider) VALUES(v_invite,p_provider) ON CONFLICT(invite_id,provider) DO NOTHING;
 RETURN QUERY SELECT * FROM payment_diagnostic_attempts WHERE invite_id=v_invite AND provider=p_provider;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_payment_diagnostic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_diagnostic(text,text) TO service_role;
CREATE FUNCTION public.claim_diagnostic_capture(p_id uuid,p_invite uuid)
RETURNS SETOF public.payment_diagnostic_attempts LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE payment_diagnostic_attempts SET status='capturing',capture_lock_until=now()+interval '2 minutes',updated_at=now()
 WHERE id=p_id AND invite_id=p_invite AND provider='paypal' AND provider_id IS NOT NULL AND
 (status IN ('open','pending') OR (status='capturing' AND capture_lock_until<now()))
 RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_diagnostic_capture(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diagnostic_capture(uuid,uuid) TO service_role;
CREATE FUNCTION public.apply_diagnostic_stripe_event(p_event text,p_attempt uuid,p_object text,p_type text,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM payment_diagnostic_attempts WHERE id=p_attempt AND provider='stripe' AND provider_id=p_object FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO payment_diagnostic_events(event_id,attempt_id,event_type) VALUES(p_event,p_attempt,p_type) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN RETURN true; END IF;
 UPDATE payment_diagnostic_attempts SET status=CASE WHEN status IN ('paid','refunded') AND p_status NOT IN ('refunded') THEN status ELSE p_status END,
 paid_at=CASE WHEN p_status='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END,updated_at=now() WHERE id=p_attempt;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apply_diagnostic_stripe_event(text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_diagnostic_stripe_event(text,uuid,text,text,text) TO service_role;
COMMENT ON TABLE public.payment_diagnostic_attempts IS 'Private USD 1 tests only. No profile answers, accounts, course leads or membership. Retain minimal payment evidence for reconciliation; revoke invitations independently.';
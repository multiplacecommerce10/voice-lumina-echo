CREATE TABLE public.stripe_checkout_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL, environment text NOT NULL, price_key text NOT NULL, consent_hash text NOT NULL, session_id text, created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz);
GRANT ALL ON public.stripe_checkout_attempts TO service_role;
ALTER TABLE public.stripe_checkout_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY stripe_checkout_service ON public.stripe_checkout_attempts TO service_role USING(true) WITH CHECK(true);
CREATE UNIQUE INDEX stripe_checkout_open ON public.stripe_checkout_attempts(lead_id,environment) WHERE closed_at IS NULL;
CREATE FUNCTION public.reserve_stripe_checkout(p_lead uuid,p_env text,p_price text,p_consent text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.stripe_checkout_attempts;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_lead::text||p_env,0));
 SELECT * INTO r FROM public.stripe_checkout_attempts WHERE lead_id=p_lead AND environment=p_env AND closed_at IS NULL FOR UPDATE;
 IF FOUND THEN
  IF r.price_key<>p_price OR r.consent_hash<>p_consent THEN RAISE EXCEPTION 'Existing checkout must expire first'; END IF;
  IF r.session_id IS NULL AND r.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'Checkout creation requires reconciliation'; END IF;
  RETURN to_jsonb(r);
 END IF;
 INSERT INTO public.stripe_checkout_attempts(lead_id,environment,price_key,consent_hash) VALUES(p_lead,p_env,p_price,p_consent) RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.reserve_stripe_checkout(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_checkout(uuid,text,text,text) TO service_role;
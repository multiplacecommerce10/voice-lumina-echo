ALTER TABLE public.payment_diagnostic_invites ADD COLUMN currency text NOT NULL DEFAULT 'usd', ADD COLUMN amount_minor integer NOT NULL DEFAULT 100, ADD COLUMN stripe_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_diagnostic_invites ADD CONSTRAINT diagnostic_invite_offer CHECK (amount_minor=100 AND ((currency='usd' AND stripe_only=false) OR (currency='brl' AND stripe_only=true)));
ALTER TABLE public.payment_diagnostic_attempts ADD COLUMN currency text NOT NULL DEFAULT 'usd', ADD COLUMN amount_minor integer NOT NULL DEFAULT 100;
ALTER TABLE public.payment_diagnostic_attempts ADD CONSTRAINT diagnostic_attempt_offer CHECK (amount_minor=100 AND (currency='usd' OR (currency='brl' AND provider='stripe')));
CREATE FUNCTION public.enforce_diagnostic_offer_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i payment_diagnostic_invites;
BEGIN
 IF TG_TABLE_NAME='payment_diagnostic_invites' THEN
  IF (NEW.currency,NEW.amount_minor,NEW.stripe_only) IS DISTINCT FROM (OLD.currency,OLD.amount_minor,OLD.stripe_only) THEN RAISE EXCEPTION 'Invitation offer is immutable'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND (NEW.invite_id,NEW.provider,NEW.currency,NEW.amount_minor) IS DISTINCT FROM (OLD.invite_id,OLD.provider,OLD.currency,OLD.amount_minor) THEN RAISE EXCEPTION 'Attempt offer is immutable'; END IF;
  SELECT * INTO i FROM payment_diagnostic_invites WHERE id=NEW.invite_id;
  IF NOT FOUND OR NEW.currency<>i.currency OR NEW.amount_minor<>i.amount_minor OR (i.stripe_only AND NEW.provider<>'stripe') THEN RAISE EXCEPTION 'Attempt offer mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER diagnostic_invite_offer_immutable BEFORE UPDATE ON public.payment_diagnostic_invites FOR EACH ROW EXECUTE FUNCTION public.enforce_diagnostic_offer_binding();
CREATE TRIGGER diagnostic_attempt_offer_bound BEFORE INSERT OR UPDATE ON public.payment_diagnostic_attempts FOR EACH ROW EXECUTE FUNCTION public.enforce_diagnostic_offer_binding();
CREATE OR REPLACE FUNCTION public.reserve_payment_diagnostic(p_hash text,p_provider text)
RETURNS SETOF public.payment_diagnostic_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i payment_diagnostic_invites;
BEGIN
 SELECT * INTO i FROM payment_diagnostic_invites WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
 IF p_provider NOT IN ('stripe','paypal') OR (i.stripe_only AND p_provider<>'stripe') THEN RAISE EXCEPTION 'Provider not permitted for this invitation'; END IF;
 INSERT INTO payment_diagnostic_attempts(invite_id,provider,currency,amount_minor) VALUES(i.id,p_provider,i.currency,i.amount_minor) ON CONFLICT(invite_id,provider) DO NOTHING;
 RETURN QUERY SELECT * FROM payment_diagnostic_attempts WHERE invite_id=i.id AND provider=p_provider;
END $$;
REVOKE ALL ON FUNCTION public.reserve_payment_diagnostic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_diagnostic(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_diagnostic_offer_binding() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_diagnostic_offer_binding() TO service_role;
COMMENT ON COLUMN public.payment_diagnostic_invites.currency IS 'Immutable private offer: existing USD or explicitly issued Stripe-only BRL, always 100 minor units. No FX.';
COMMENT ON TABLE public.payment_diagnostic_attempts IS 'Service-only private payment evidence with immutable invitation-bound amount/currency; financial records retained.';
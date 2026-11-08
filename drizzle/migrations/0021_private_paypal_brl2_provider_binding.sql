ALTER TABLE public.payment_diagnostic_invites ADD COLUMN paypal_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_diagnostic_attempts ADD COLUMN paypal_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_diagnostic_invites DROP CONSTRAINT diagnostic_invite_offer;
ALTER TABLE public.payment_diagnostic_invites ADD CONSTRAINT diagnostic_invite_offer CHECK ((currency='usd' AND amount_minor=100 AND NOT stripe_only AND NOT paypal_only) OR (currency='brl' AND amount_minor IN (100,200) AND stripe_only AND NOT paypal_only) OR (currency='brl' AND amount_minor=200 AND paypal_only AND NOT stripe_only));
ALTER TABLE public.payment_diagnostic_attempts DROP CONSTRAINT diagnostic_attempt_offer;
ALTER TABLE public.payment_diagnostic_attempts ADD CONSTRAINT diagnostic_attempt_offer CHECK ((currency='usd' AND amount_minor=100 AND NOT paypal_only) OR (currency='brl' AND amount_minor IN (100,200) AND provider='stripe' AND NOT paypal_only) OR (currency='brl' AND amount_minor=200 AND provider='paypal' AND paypal_only));
CREATE OR REPLACE FUNCTION public.enforce_diagnostic_offer_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i payment_diagnostic_invites;
BEGIN
 IF TG_TABLE_NAME='payment_diagnostic_invites' THEN
  IF (NEW.currency,NEW.amount_minor,NEW.stripe_only,NEW.paypal_only) IS DISTINCT FROM (OLD.currency,OLD.amount_minor,OLD.stripe_only,OLD.paypal_only) THEN RAISE EXCEPTION 'Invitation offer is immutable'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND (NEW.invite_id,NEW.provider,NEW.currency,NEW.amount_minor,NEW.paypal_only) IS DISTINCT FROM (OLD.invite_id,OLD.provider,OLD.currency,OLD.amount_minor,OLD.paypal_only) THEN RAISE EXCEPTION 'Attempt offer is immutable'; END IF;
  SELECT * INTO i FROM payment_diagnostic_invites WHERE id=NEW.invite_id;
  IF NOT FOUND OR NEW.currency<>i.currency OR NEW.amount_minor<>i.amount_minor OR NEW.paypal_only<>i.paypal_only OR (i.stripe_only AND NEW.provider<>'stripe') OR (i.paypal_only AND NEW.provider<>'paypal') THEN RAISE EXCEPTION 'Attempt offer mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.reserve_payment_diagnostic(p_hash text,p_provider text)
RETURNS SETOF public.payment_diagnostic_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i payment_diagnostic_invites;
BEGIN
 SELECT * INTO i FROM payment_diagnostic_invites WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
 IF p_provider NOT IN ('stripe','paypal') OR (i.stripe_only AND p_provider<>'stripe') OR (i.paypal_only AND p_provider<>'paypal') THEN RAISE EXCEPTION 'Provider not permitted for this invitation'; END IF;
 INSERT INTO payment_diagnostic_attempts(invite_id,provider,currency,amount_minor,paypal_only) VALUES(i.id,p_provider,i.currency,i.amount_minor,i.paypal_only) ON CONFLICT(invite_id,provider) DO NOTHING;
 RETURN QUERY SELECT * FROM payment_diagnostic_attempts WHERE invite_id=i.id AND provider=p_provider;
END $$;
REVOKE ALL ON FUNCTION public.reserve_payment_diagnostic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_diagnostic(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_diagnostic_offer_binding() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_diagnostic_offer_binding() TO service_role;
COMMENT ON COLUMN public.payment_diagnostic_invites.paypal_only IS 'Immutable explicit PayPal-only BRL200 invitation; default false preserves every old Stripe-only and USD invitation.';
COMMENT ON COLUMN public.payment_diagnostic_attempts.paypal_only IS 'Immutable provider configuration copied from invitation; never inferred from client metadata.';
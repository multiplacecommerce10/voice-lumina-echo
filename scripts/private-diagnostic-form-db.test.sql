BEGIN;
DO $$
DECLARE i uuid := gen_random_uuid(); h text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''); a jsonb; g public.payment_diagnostic_grants; r text;
BEGIN
 a := '{"fullName":"Synthetic Tester","birthDate":"1980-01-01","email":"fixture@example.invalid","phone":"+1 5550100","country":"United States","city":"Fixture City","address":"Synthetic address","profession":"Educator","musicLevel":"Beginner","academicExperience":"None yet","musicalPreferences":"Jazz","motivation":"Fixture only"}'::jsonb;
 INSERT INTO public.payment_diagnostic_invites(id,token_hash,expires_at) VALUES(i,h,now()+interval '1 hour');
 r:=public.save_private_diagnostic_form(h,a,'old'); IF r <> 'invalid_consent' THEN RAISE EXCEPTION 'consent assertion'; END IF;
 r:=public.save_private_diagnostic_form(h,a-'motivation','private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'invalid_profile' THEN RAISE EXCEPTION 'profile assertion'; END IF;
 r:=public.save_private_diagnostic_form(h,a,'private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'saved' THEN RAISE EXCEPTION 'save assertion'; END IF;
 SELECT * INTO g FROM public.payment_diagnostic_grants WHERE invite_id=i;
 IF g.form_answers <> a OR g.consent_at IS NULL OR g.form_saved_at IS NULL OR g.granted_at IS NOT NULL THEN RAISE EXCEPTION 'roundtrip assertion'; END IF;
 PERFORM public.save_private_diagnostic_form(h,a,'private-guest-complete7d-saved-form-v4-20261107');
 IF (SELECT count(*) FROM public.payment_diagnostic_grants WHERE invite_id=i)<>1 OR (SELECT form_saved_at FROM public.payment_diagnostic_grants WHERE invite_id=i)<>g.form_saved_at THEN RAISE EXCEPTION 'duplicate assertion'; END IF;
 r:=public.save_private_diagnostic_form(h,jsonb_set(a,'{email}','"other@example.invalid"'),'private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'email_mismatch' THEN RAISE EXCEPTION 'email assertion'; END IF;
 r:=public.save_private_diagnostic_form(h,jsonb_set(a,'{motivation}','"Changed"'),'private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'profile_locked' THEN RAISE EXCEPTION 'immutability assertion'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_diagnostic_attempts WHERE invite_id=i) OR EXISTS(SELECT 1 FROM public.notification_outbox WHERE subscription_id='diag:'||i) OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE stripe_subscription_id='diag:'||i) THEN RAISE EXCEPTION 'side effect assertion'; END IF;
 r:=public.grant_diagnostic_courtesy(i); IF r <> 'not_paid' THEN RAISE EXCEPTION 'unpaid grant assertion'; END IF;
 UPDATE public.payment_diagnostic_invites SET expires_at=now()-interval '1 second' WHERE id=i;
 r:=public.save_private_diagnostic_form(h,a,'private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'invalid_invitation' THEN RAISE EXCEPTION 'expiry assertion'; END IF;
 UPDATE public.payment_diagnostic_invites SET expires_at=now()+interval '1 hour', revoked_at=now() WHERE id=i;
 r:=public.save_private_diagnostic_form(h,a,'private-guest-complete7d-saved-form-v4-20261107'); IF r <> 'invalid_invitation' THEN RAISE EXCEPTION 'revocation assertion'; END IF;
 IF has_table_privilege('anon','public.payment_diagnostic_grants','SELECT') OR has_table_privilege('authenticated','public.payment_diagnostic_grants','SELECT') OR has_function_privilege('anon','public.save_private_diagnostic_form(text,jsonb,text)','EXECUTE') OR has_function_privilege('authenticated','public.save_private_diagnostic_form(text,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'privacy assertion'; END IF;
 RAISE NOTICE 'Private form DB assertions passed: roundtrip, idempotency, consent, locking, unpaid isolation, expiry, revocation, role permissions';
END $$;
ROLLBACK;
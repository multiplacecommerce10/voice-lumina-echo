ALTER TABLE public.payment_diagnostic_grants ADD COLUMN IF NOT EXISTS form_answers jsonb, ADD COLUMN IF NOT EXISTS form_saved_at timestamptz;
REVOKE ALL ON public.payment_diagnostic_grants FROM anon, authenticated;
GRANT ALL ON public.payment_diagnostic_grants TO service_role;
ALTER TABLE public.payment_diagnostic_grants ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.save_private_diagnostic_form(p_hash text, p_answers jsonb, p_version text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_invite uuid; g payment_diagnostic_grants; v_email text;
BEGIN
 SELECT id INTO v_invite FROM payment_diagnostic_invites WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at > now() FOR UPDATE;
 IF NOT FOUND THEN RETURN 'invalid_invitation'; END IF;
 IF p_version <> 'private-guest-complete7d-saved-form-v4-20261107' OR p_version IS NULL THEN RETURN 'invalid_consent'; END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 12 OR NOT (p_answers ?& ARRAY['fullName','birthDate','email','phone','country','city','address','profession','musicLevel','academicExperience','musicalPreferences','motivation']) OR EXISTS (SELECT 1 FROM jsonb_each(p_answers) WHERE jsonb_typeof(value) <> 'string' OR length(trim(value #>> '{}'))=0) THEN RETURN 'invalid_profile'; END IF;
 v_email := lower(trim(p_answers->>'email'));
 SELECT * INTO g FROM payment_diagnostic_grants WHERE invite_id=v_invite FOR UPDATE;
 IF FOUND THEN
  IF lower(g.email) <> v_email THEN RETURN 'email_mismatch'; END IF;
  IF g.form_answers IS NOT NULL THEN
   IF g.form_answers <> p_answers THEN RETURN 'profile_locked'; END IF;
   RETURN 'saved';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_diagnostic_attempts WHERE invite_id=v_invite) OR g.granted_at IS NOT NULL THEN RETURN 'profile_locked'; END IF;
  UPDATE payment_diagnostic_grants SET full_name=p_answers->>'fullName', form_answers=p_answers, form_saved_at=now(), consent_version=p_version, consent_at=now() WHERE invite_id=v_invite;
 ELSE
  INSERT INTO payment_diagnostic_grants(invite_id,email,full_name,form_answers,form_saved_at,consent_version,consent_at) VALUES(v_invite,v_email,p_answers->>'fullName',p_answers,now(),p_version,now());
 END IF;
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.save_private_diagnostic_form(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_private_diagnostic_form(text,jsonb,text) TO service_role;
COMMENT ON COLUMN public.payment_diagnostic_grants.form_answers IS 'Private validated tester answers; service-role only, never returned by invitation or payment APIs.';
ALTER TABLE public.leads ADD COLUMN enrollment_request_id uuid;
CREATE UNIQUE INDEX leads_enrollment_request_unique ON public.leads(enrollment_request_id) WHERE enrollment_request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.record_enrollment_intent(p_request uuid,p_record jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.leads; result uuid; v_email text:=lower(trim(p_record->>'email'));
BEGIN
 IF p_request IS NULL OR v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(length(p_record->>'full_name'),0)<2 OR coalesce(length(p_record->>'phone'),0)<4 THEN RAISE EXCEPTION 'Invalid enrollment'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['birth_date','address','city','country','music_level','profession','academic_experience','musical_preferences','motivation']) k WHERE coalesce(length(trim(p_record->'answers'->>k)),0)=0) THEN RAISE EXCEPTION 'Incomplete enrollment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO existing FROM public.leads WHERE enrollment_request_id=p_request;
 IF FOUND THEN
  IF existing.email IS DISTINCT FROM v_email OR existing.full_name IS DISTINCT FROM p_record->>'full_name' OR existing.phone IS DISTINCT FROM p_record->>'phone' OR existing.plan_intended IS DISTINCT FROM nullif(p_record->>'plan_intended','') OR (existing.answers-'submitted_at') IS DISTINCT FROM (p_record->'answers'-'submitted_at') THEN RAISE EXCEPTION 'Enrollment retry mismatch'; END IF;
  RETURN existing.id;
 END IF;
 INSERT INTO public.leads(full_name,email,phone,plan_intended,status,source,enrollment_request_id,answers,utm_source,utm_medium,utm_campaign,utm_term,utm_content,utm_id,gclid,fbclid,landing_url,referrer)
 VALUES(p_record->>'full_name',v_email,p_record->>'phone',nullif(p_record->>'plan_intended',''),'captured','enrollment_form',p_request,p_record->'answers',nullif(p_record->>'utm_source',''),nullif(p_record->>'utm_medium',''),nullif(p_record->>'utm_campaign',''),nullif(p_record->>'utm_term',''),nullif(p_record->>'utm_content',''),nullif(p_record->>'utm_id',''),nullif(p_record->>'gclid',''),nullif(p_record->>'fbclid',''),nullif(p_record->>'landing_url',''),nullif(p_record->>'referrer','')) RETURNING id INTO result;
 INSERT INTO public.notification_outbox(dedupe_key,environment,provider,kind,subscription_id,recipient,payload) VALUES('enrollment:'||result::text||':sheet','live','enrollment_projection','enrollment_sheet','enrollment:'||result::text,NULL,jsonb_build_object('leadId',result)) ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_enrollment_intent(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_enrollment_intent(uuid,jsonb) TO service_role;
COMMENT ON COLUMN public.leads.enrollment_request_id IS 'Immutable enrollment retry key; atomic intent plus optional Sheets outbox, never admission.';
ALTER TABLE public.leads ADD COLUMN scholarship_request_id uuid;
CREATE UNIQUE INDEX leads_scholarship_request_unique ON public.leads(scholarship_request_id) WHERE scholarship_request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.record_scholarship_application(p_request uuid,p_data jsonb,p_privacy_version text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_email text; v_name text; existing public.leads;
BEGIN
 IF p_request IS NULL OR p_data->>'privacyConsent'<>'true' OR p_privacy_version IS NULL OR p_privacy_version='' THEN RAISE EXCEPTION 'Application consent required'; END IF;
 v_email:=lower(trim(p_data->>'email')); v_name:=trim(p_data->>'fullName');
 IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email)>160 OR length(v_name)<2 OR length(v_name)>120 OR length(trim(p_data->>'city'))<1 OR length(trim(p_data->>'country'))<1 OR length(trim(p_data->>'voiceJourney'))<10 OR length(trim(p_data->>'goals'))<10 OR length(trim(p_data->>'whyScholarship'))<10 THEN RAISE EXCEPTION 'Invalid application'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO existing FROM public.leads WHERE scholarship_request_id=p_request;
 IF FOUND THEN
  IF existing.email<>v_email OR existing.full_name<>v_name OR existing.answers->>'city' IS DISTINCT FROM p_data->>'city' OR existing.answers->>'country' IS DISTINCT FROM p_data->>'country' OR existing.answers->>'voice_journey' IS DISTINCT FROM p_data->>'voiceJourney' OR existing.answers->>'goals' IS DISTINCT FROM p_data->>'goals' OR existing.answers->>'why_scholarship' IS DISTINCT FROM p_data->>'whyScholarship' THEN RAISE EXCEPTION 'Application retry mismatch'; END IF;
  RETURN existing.id;
 END IF;
 INSERT INTO public.leads(full_name,email,phone,plan_intended,status,source,scholarship_request_id,answers,utm_source,utm_medium,utm_campaign,landing_url,referrer)
 VALUES(v_name,v_email,nullif(p_data->>'phone',''),'Global Solidarity Scholarship','captured','scholarship_application',p_request,jsonb_build_object('city',p_data->>'city','country',p_data->>'country','voice_journey',p_data->>'voiceJourney','goals',p_data->>'goals','why_scholarship',p_data->>'whyScholarship','free_seat_candidate',false,'submitted_at',now(),'privacy_version',p_privacy_version,'privacy_consent_at',now()),nullif(p_data->>'utmSource',''),nullif(p_data->>'utmMedium',''),nullif(p_data->>'utmCampaign',''),nullif(p_data->>'landingUrl',''),nullif(p_data->>'referrer','')) RETURNING id INTO v_id;
 INSERT INTO public.notification_outbox(dedupe_key,environment,provider,kind,subscription_id,recipient,payload) VALUES('scholarship:'||v_id::text||':received','live','scholarship','scholarship_received','scholarship:'||v_id::text,v_email,jsonb_build_object('fullName',v_name)) ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.record_scholarship_application(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_scholarship_application(uuid,jsonb,text) TO service_role;
COMMENT ON COLUMN public.leads.scholarship_request_id IS 'Stable client retry key; one application and durable receipt per request, never admission or membership.';
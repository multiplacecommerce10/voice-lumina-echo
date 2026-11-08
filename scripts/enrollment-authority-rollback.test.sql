BEGIN;
DO $$
DECLARE req uuid:=gen_random_uuid(); p jsonb; a uuid; b uuid; pos bigint;
BEGIN
p:=jsonb_build_object('full_name','Fixture','email','FIXTURE@EXAMPLE.INVALID','phone','+55 123456','answers',jsonb_build_object('birth_date','2000-02-29','address','Fixture','city','Local','country','Brazil','music_level','Beginner','profession','Singer','academic_experience','None','musical_preferences','Voice','motivation','Practice','timezone','UTC','submitted_at',now()));
a:=public.record_enrollment_intent(req,p);
b:=public.record_enrollment_intent(req,p||jsonb_build_object('answers',(p->'answers')||jsonb_build_object('submitted_at',now()+interval '1 hour')));
IF a<>b OR (SELECT count(*) FROM public.leads WHERE enrollment_request_id=req)<>1 OR (SELECT count(*) FROM public.notification_outbox WHERE dedupe_key='enrollment:'||a::text||':sheet')<>1 THEN RAISE EXCEPTION 'Retry duplicated intent or projection'; END IF;
SELECT enrollment_sheet_row INTO pos FROM public.leads WHERE id=a;
IF pos<2 OR pos IS NULL OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE lead_id=a) THEN RAISE EXCEPTION 'Position or no-access rule failed'; END IF;
BEGIN
PERFORM public.record_enrollment_intent(req,p||'{"email":"other@example.invalid"}'::jsonb);
RAISE EXCEPTION 'changed recipient allowed';
EXCEPTION WHEN OTHERS THEN IF SQLERRM='changed recipient allowed' THEN RAISE; END IF;
END;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE sid text:='sub_fixture_'||replace(gen_random_uuid()::text,'-',''); r jsonb; stale jsonb; notices bigint; a jsonb; b jsonb;
BEGIN
r:=public.cas_stripe_member(sid,'sandbox',null,jsonb_build_object('duration_months',3,'tier','complete','access_status','active','paid_invoice_count',1,'paid_active_months',3,'student_enrolled_at',now(),'last_invoice_id','in_fixture_a','processed_invoice_ids',jsonb_build_array('in_fixture_a'),'__event','evt_fixture_a'));
IF (r->>'row_version')::int<>1 THEN RAISE EXCEPTION 'Missing version'; END IF;
stale:=public.cas_stripe_member(sid,'sandbox',null,'{"paid_active_months":999}'::jsonb);
IF stale IS NOT NULL THEN RAISE EXCEPTION 'Stale initial write accepted'; END IF;
stale:=public.cas_stripe_member(sid,'sandbox',0,'{"paid_active_months":999}'::jsonb);
IF stale IS NOT NULL THEN RAISE EXCEPTION 'Stale version accepted'; END IF;
r:=public.cas_stripe_member(sid,'sandbox',1,'{"duration_months":3,"access_status":"active","paid_invoice_count":2,"paid_active_months":6,"last_invoice_id":"in_fixture_b","processed_invoice_ids":["in_fixture_a","in_fixture_b"],"__event":"evt_fixture_b"}'::jsonb);
IF (r->>'paid_active_months')::int<>6 THEN RAISE EXCEPTION 'Lost paid months'; END IF;
stale:=public.cas_stripe_member(sid,'sandbox',1,'{"access_status":"pending","__event":"evt_fixture_b"}'::jsonb);
IF stale->>'access_status'<>'active' THEN RAISE EXCEPTION 'Duplicate changed active row'; END IF;
SELECT count(*) INTO notices FROM public.notification_outbox WHERE subscription_id=sid;
IF notices<>3 THEN RAISE EXCEPTION 'Welcome/account/renewal queue mismatch: %',notices; END IF;
a:=public.reserve_stripe_checkout(gen_random_uuid(),'sandbox','complete_sub_3m_v1','fixture_consent');
b:=public.reserve_stripe_checkout((a->>'lead_id')::uuid,'sandbox','complete_sub_3m_v1','fixture_consent');
IF a->>'id'<>b->>'id' THEN RAISE EXCEPTION 'Attempt duplicated'; END IF;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE req uuid:=gen_random_uuid(); p jsonb; l uuid; l2 uuid; i uuid; a public.payment_diagnostic_attempts; a2 public.payment_diagnostic_attempts; blocked boolean; h text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
BEGIN
 p:=jsonb_build_object('privacyConsent',true,'fullName','Local Fixture','email',' FIXTURE@EXAMPLE.INVALID ','phone','fixture','city','Local','country','Brazil','voiceJourney','Practicing voice','goals','Develop expression','whyScholarship','Access to education');
 l:=public.record_scholarship_application(req,p,'2026-08-17');
 l2:=public.record_scholarship_application(req,p,'2026-08-17');
 IF l<>l2 OR (SELECT count(*) FROM public.leads WHERE scholarship_request_id=req)<>1 OR (SELECT count(*) FROM public.notification_outbox WHERE subscription_id='scholarship:'||l::text)<>1 THEN RAISE EXCEPTION 'Retry duplicated application or receipt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=l AND email='fixture@example.invalid' AND admission_status='not_reviewed' AND status='captured') THEN RAISE EXCEPTION 'Application granted decision or normalization failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_subscriptions WHERE lead_id=l) THEN RAISE EXCEPTION 'Pending application granted membership'; END IF;
 blocked:=false; BEGIN PERFORM public.record_scholarship_application(req,p||'{"email":"other@example.invalid"}'::jsonb,'2026-08-17'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Retry changed recipient'; END IF;
 blocked:=false; BEGIN PERFORM public.record_scholarship_application(gen_random_uuid(),p||'{"privacyConsent":false}'::jsonb,'2026-08-17'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Missing consent allowed'; END IF;
 INSERT INTO public.payment_diagnostic_invites(token_hash,expires_at,currency,amount_minor,stripe_only,paypal_only) VALUES(h,now()+interval '48 hours','brl',200,false,true) RETURNING id INTO i;
 SELECT * INTO a FROM public.reserve_payment_diagnostic(h,'paypal'); SELECT * INTO a2 FROM public.reserve_payment_diagnostic(h,'paypal');
 IF a.id<>a2.id OR a.amount_minor<>200 OR a.currency<>'brl' OR NOT a.paypal_only THEN RAISE EXCEPTION 'PayPal BRL binding failed'; END IF;
 blocked:=false; BEGIN PERFORM public.reserve_payment_diagnostic(h,'stripe'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'PayPal invitation enabled Stripe'; END IF;
 blocked:=false; BEGIN UPDATE public.payment_diagnostic_invites SET paypal_only=false,stripe_only=true WHERE id=i; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invitation provider mutable'; END IF;
 IF has_function_privilege('anon','public.record_scholarship_application(uuid,jsonb,text)','EXECUTE') OR has_function_privilege('authenticated','public.reserve_payment_diagnostic(text,text)','EXECUTE') THEN RAISE EXCEPTION 'Private RPC exposed'; END IF;
END $$;
ROLLBACK;

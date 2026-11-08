-- Synthetic fixture only. Run through the privileged database test tool; always roll back.
BEGIN;
DO $$
DECLARE i uuid; a public.payment_diagnostic_attempts; b public.payment_diagnostic_attempts; blocked boolean;
 h text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
BEGIN
 INSERT INTO public.payment_diagnostic_invites(token_hash,expires_at,currency,stripe_only) VALUES(h,now()+interval '48 hours','brl',true) RETURNING id INTO i;
 SELECT * INTO a FROM public.reserve_payment_diagnostic(h,'stripe');
 SELECT * INTO b FROM public.reserve_payment_diagnostic(h,'stripe');
 IF a.id<>b.id OR a.currency<>'brl' OR a.amount_minor<>100 THEN RAISE EXCEPTION 'BRL binding/idempotency failed'; END IF;
 blocked:=false;
 BEGIN PERFORM public.reserve_payment_diagnostic(h,'paypal'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'BRL PayPal permitted'; END IF;
 blocked:=false;
 BEGIN UPDATE public.payment_diagnostic_invites SET currency='usd',stripe_only=false WHERE id=i; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invite mutable'; END IF;
 blocked:=false;
 BEGIN UPDATE public.payment_diagnostic_attempts SET currency='usd' WHERE id=a.id; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Attempt mutable'; END IF;
 IF has_table_privilege('anon','public.payment_diagnostic_invites','SELECT') OR has_table_privilege('authenticated','public.payment_diagnostic_attempts','SELECT') OR has_function_privilege('anon','public.reserve_payment_diagnostic(text,text)','EXECUTE') THEN RAISE EXCEPTION 'Private access exposed'; END IF;
END $$;
ROLLBACK;
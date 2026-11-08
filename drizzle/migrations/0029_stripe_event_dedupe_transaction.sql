ALTER FUNCTION public.cas_stripe_member(text,text,integer,jsonb) RENAME TO cas_stripe_member_base;
CREATE FUNCTION public.cas_stripe_member(p_subscription text,p_env text,p_version integer,p_patch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.member_subscriptions; result jsonb; ev text:=p_patch->>'__event'; kind text; mail text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_env||':'||p_subscription,0));
 SELECT * INTO r FROM public.member_subscriptions WHERE stripe_subscription_id=p_subscription AND environment=p_env FOR UPDATE;
 IF ev IS NOT NULL AND ev=ANY(r.processed_event_ids) THEN RETURN to_jsonb(r); END IF;
 result:=public.cas_stripe_member_base(p_subscription,p_env,p_version,p_patch-'__event');
 IF result IS NULL THEN RETURN NULL; END IF;
 IF ev IS NOT NULL THEN
  UPDATE public.member_subscriptions SET processed_event_ids=array_append(processed_event_ids,ev),last_stripe_event_id=ev WHERE id=(result->>'id')::uuid;
  result:=result||jsonb_build_object('processed_event_ids',to_jsonb(coalesce(r.processed_event_ids,ARRAY[]::text[])||ARRAY[ev]));
  kind:=CASE WHEN p_patch->>'access_status'='pending' AND p_patch->>'first_payment_failed_at' IS NOT NULL THEN 'payment_failed_initial' WHEN p_patch->>'access_status'='past_due_grace' AND r.access_status IS DISTINCT FROM 'past_due_grace' THEN 'grace_notice' WHEN p_patch->>'access_status'='suspended' AND r.access_status IS DISTINCT FROM 'suspended' THEN 'access_suspended_notice' WHEN (p_patch->>'cancel_at_period_end')::boolean AND NOT coalesce(r.cancel_at_period_end,false) THEN 'cancellation_scheduled_notice' ELSE NULL END;
  IF kind IS NOT NULL THEN
   SELECT email INTO mail FROM public.leads WHERE id=(result->>'lead_id')::uuid;
   INSERT INTO public.notification_outbox(dedupe_key,environment,provider,kind,subscription_id,recipient,payload) VALUES(p_env||':stripe:'||ev||':'||kind,p_env,'stripe',kind,p_subscription,coalesce(mail,result->>'email'),jsonb_build_object('state',result)) ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cas_stripe_member(text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cas_stripe_member(text,text,integer,jsonb) TO service_role;
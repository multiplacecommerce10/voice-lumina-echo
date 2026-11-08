CREATE OR REPLACE FUNCTION public.cas_stripe_member(p_subscription text,p_env text,p_version integer,p_patch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.member_subscriptions; n public.member_subscriptions; inv text; k text; mail text; lead_name text;
BEGIN
 IF p_env NOT IN ('live','sandbox') OR p_subscription NOT LIKE 'sub_%' THEN RAISE EXCEPTION 'Invalid Stripe binding'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_env||':'||p_subscription,0));
 SELECT * INTO r FROM public.member_subscriptions WHERE stripe_subscription_id=p_subscription AND environment=p_env FOR UPDATE;
 IF NOT FOUND THEN
  IF p_version IS NOT NULL THEN RETURN NULL; END IF;
  INSERT INTO public.member_subscriptions(stripe_subscription_id,environment,provider) VALUES(p_subscription,p_env,'stripe') RETURNING * INTO r;
 ELSE
  IF p_version IS NULL OR r.row_version<>p_version THEN RETURN NULL; END IF;
 END IF;
 IF r.provider<>'stripe' THEN RAISE EXCEPTION 'Provider mismatch'; END IF;
 n:=jsonb_populate_record(r,p_patch);
 UPDATE public.member_subscriptions SET lead_id=n.lead_id,email=n.email,full_name=n.full_name,stripe_customer_id=n.stripe_customer_id,stripe_price_id=n.stripe_price_id,price_lookup_key=n.price_lookup_key,tier=n.tier,duration_months=n.duration_months,status=n.status,current_period_start=n.current_period_start,current_period_end=n.current_period_end,cancel_at_period_end=n.cancel_at_period_end,canceled_at=n.canceled_at,first_payment_failed_at=n.first_payment_failed_at,grace_expires_at=n.grace_expires_at,last_invoice_id=n.last_invoice_id,last_invoice_paid_at=n.last_invoice_paid_at,access_status=n.access_status,student_enrolled_at=n.student_enrolled_at,paid_active_months=n.paid_active_months,paid_invoice_count=n.paid_invoice_count,processed_invoice_ids=n.processed_invoice_ids,metadata=n.metadata,row_version=r.row_version+1,updated_at=now() WHERE id=r.id RETURNING * INTO n;
 inv:=p_patch->>'last_invoice_id';
 IF inv IS NOT NULL AND NOT inv=ANY(r.processed_invoice_ids) AND n.access_status='active' THEN
  SELECT email,full_name INTO mail,lead_name FROM public.leads WHERE id=n.lead_id;
  mail:=coalesce(mail,n.email); lead_name:=coalesce(lead_name,n.full_name);
  FOREACH k IN ARRAY CASE WHEN r.paid_invoice_count=0 THEN ARRAY['welcome_confirmation','account_access'] ELSE ARRAY['renewal_receipt'] END LOOP
   INSERT INTO public.notification_outbox(dedupe_key,environment,provider,kind,subscription_id,recipient,payload) VALUES(p_env||':stripe:'||inv||':'||k,p_env,'stripe',k,p_subscription,mail,jsonb_build_object('state',to_jsonb(n),'fullName',lead_name,'invoiceId',inv)) ON CONFLICT(dedupe_key) DO NOTHING;
  END LOOP;
 END IF;
 RETURN to_jsonb(n);
END $$;
REVOKE ALL ON FUNCTION public.cas_stripe_member(text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cas_stripe_member(text,text,integer,jsonb) TO service_role;
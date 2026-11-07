CREATE FUNCTION public.claim_diagnostic_creation(p_id uuid,p_invite uuid)
RETURNS SETOF public.payment_diagnostic_attempts LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE payment_diagnostic_attempts SET capture_lock_until=now()+interval '2 minutes',updated_at=now()
 WHERE id=p_id AND invite_id=p_invite AND status='reserved' AND provider_id IS NULL
 AND created_at>now()-interval '1 hour'
 AND (capture_lock_until IS NULL OR capture_lock_until<now()) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_diagnostic_creation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diagnostic_creation(uuid,uuid) TO service_role;
CREATE FUNCTION public.cancel_diagnostic_attempt(p_id uuid,p_invite uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE payment_diagnostic_attempts SET status='cancelled',updated_at=now()
 WHERE id=p_id AND invite_id=p_invite AND status IN ('open','pending','cancelled');
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_diagnostic_attempt(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_diagnostic_attempt(uuid,uuid) TO service_role;
CREATE TABLE public.webhook_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL DEFAULT 'outbound',
  flow text,
  event text,
  target_url text,
  lead_id uuid,
  correlation_id text,
  request_payload jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  attempts integer,
  ok boolean NOT NULL DEFAULT false,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_audit_log_created_at ON public.webhook_audit_log (created_at DESC);

GRANT ALL ON public.webhook_audit_log TO service_role;

ALTER TABLE public.webhook_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook audit log"
ON public.webhook_audit_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
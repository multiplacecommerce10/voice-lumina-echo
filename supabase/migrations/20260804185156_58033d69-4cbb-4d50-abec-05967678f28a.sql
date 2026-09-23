ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS checkout_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandon_reason text,
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_status_checkout_started
  ON public.leads (status, checkout_started_at);
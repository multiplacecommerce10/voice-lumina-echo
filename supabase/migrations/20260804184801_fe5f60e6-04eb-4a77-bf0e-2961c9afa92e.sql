ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS answers jsonb,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS utm_id text;

CREATE INDEX IF NOT EXISTS leads_email_idx ON public.leads (lower(email));
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads (created_at DESC);
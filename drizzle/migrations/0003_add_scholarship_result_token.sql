ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS scholarship_result_token text;

COMMENT ON COLUMN public.leads.scholarship_result_token IS 'High-entropy token for the personal scholarship result page link; generated on demand by an admin and shared with the applicant. Never grants access by itself.';

CREATE UNIQUE INDEX IF NOT EXISTS leads_scholarship_result_token_key
  ON public.leads (scholarship_result_token)
  WHERE scholarship_result_token IS NOT NULL;
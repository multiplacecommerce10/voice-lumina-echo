ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS resume_code text;
UPDATE public.leads SET resume_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)) WHERE resume_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_resume_code_key ON public.leads (resume_code);
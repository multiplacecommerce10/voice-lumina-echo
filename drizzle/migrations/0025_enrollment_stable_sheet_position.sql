CREATE SEQUENCE public.enrollment_projection_rows START 2;
GRANT USAGE,SELECT ON SEQUENCE public.enrollment_projection_rows TO service_role;
ALTER TABLE public.leads ADD COLUMN enrollment_sheet_row bigint;
CREATE OR REPLACE FUNCTION public.assign_enrollment_sheet_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.enrollment_request_id IS NOT NULL THEN NEW.enrollment_sheet_row:=nextval('public.enrollment_projection_rows'); END IF; RETURN NEW; END $$;
CREATE TRIGGER assign_enrollment_sheet_row BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.assign_enrollment_sheet_row();
REVOKE ALL ON FUNCTION public.assign_enrollment_sheet_row() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_enrollment_sheet_row() TO service_role;
COMMENT ON COLUMN public.leads.enrollment_sheet_row IS 'Stable row on isolated Enrollment intents sheet; deterministic PUT makes ambiguous retries safe.';
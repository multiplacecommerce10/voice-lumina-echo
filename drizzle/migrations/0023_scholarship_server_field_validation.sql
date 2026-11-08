CREATE OR REPLACE FUNCTION public.validate_scholarship_record() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.source='scholarship_application' AND NEW.scholarship_request_id IS NOT NULL THEN
  IF NEW.full_name IS NULL OR length(trim(NEW.full_name)) NOT BETWEEN 2 AND 120 OR NEW.email IS NULL OR length(NEW.email)>160 OR length(coalesce(NEW.phone,''))>40 OR coalesce(length(trim(NEW.answers->>'city')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(NEW.answers->>'country')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(NEW.answers->>'voice_journey')),0) NOT BETWEEN 10 AND 2000 OR coalesce(length(trim(NEW.answers->>'goals')),0) NOT BETWEEN 10 AND 2000 OR coalesce(length(trim(NEW.answers->>'why_scholarship')),0) NOT BETWEEN 10 AND 2000 OR NEW.answers->>'privacy_consent_at' IS NULL OR coalesce(NEW.answers->>'privacy_version','')='' THEN RAISE EXCEPTION 'Invalid scholarship record'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_scholarship_record BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.validate_scholarship_record();
REVOKE ALL ON FUNCTION public.validate_scholarship_record() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_scholarship_record() TO service_role;
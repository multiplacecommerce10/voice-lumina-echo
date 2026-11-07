CREATE OR REPLACE FUNCTION public.taken_slot_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT slot_id FROM public.session_bookings WHERE status = 'booked'
$$;
GRANT EXECUTE ON FUNCTION public.taken_slot_ids() TO authenticated;
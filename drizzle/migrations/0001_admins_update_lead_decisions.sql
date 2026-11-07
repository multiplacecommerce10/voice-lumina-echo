CREATE POLICY "Admins can update lead decisions"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
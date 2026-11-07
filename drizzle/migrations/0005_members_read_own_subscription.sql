CREATE POLICY "Members read own subscription"
  ON public.member_subscriptions FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));
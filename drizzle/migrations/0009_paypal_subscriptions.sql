ALTER TABLE public.member_subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_event_ids text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.paypal_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  plan_id text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('live','complete')),
  duration_months integer NOT NULL CHECK (duration_months IN (1,3,6)),
  amount_usd numeric(10,2) NOT NULL,
  email text,
  full_name text,
  consent jsonb NOT NULL,
  paypal_subscription_id text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX paypal_intents_sub_uidx ON public.paypal_checkout_intents (paypal_subscription_id, environment) WHERE paypal_subscription_id IS NOT NULL;
GRANT ALL ON public.paypal_checkout_intents TO service_role;
ALTER TABLE public.paypal_checkout_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages paypal intents" ON public.paypal_checkout_intents FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.paypal_webhook_events (
  event_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  event_type text NOT NULL,
  resource_id text,
  subscription_id text,
  transaction_id text,
  outcome text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (event_id, environment)
);
CREATE UNIQUE INDEX paypal_events_txn_uidx ON public.paypal_webhook_events (transaction_id, environment, event_type) WHERE transaction_id IS NOT NULL;
GRANT ALL ON public.paypal_webhook_events TO service_role;
ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages paypal events" ON public.paypal_webhook_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.has_active_membership()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_subscriptions
    WHERE email = lower(auth.jwt() ->> 'email')
      AND (
        access_status IN ('active','grace')
        OR (access_status = 'past_due_grace' AND grace_expires_at IS NOT NULL AND grace_expires_at > now())
      )
  )
$$;
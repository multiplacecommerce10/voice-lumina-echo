CREATE TABLE public.member_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  email text,
  full_name text,
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_customer_id text,
  stripe_subscription_id text NOT NULL,
  stripe_price_id text,
  price_lookup_key text,
  tier text,
  duration_months integer,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  first_payment_failed_at timestamptz,
  grace_expires_at timestamptz,
  last_invoice_id text,
  last_invoice_paid_at timestamptz,
  access_status text NOT NULL DEFAULT 'pending',
  student_enrolled_at timestamptz,
  paid_active_months integer NOT NULL DEFAULT 0,
  paid_invoice_count integer NOT NULL DEFAULT 0,
  last_stripe_event_id text,
  processed_invoice_ids text[] NOT NULL DEFAULT '{}',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX member_subscriptions_sub_env_uidx
  ON public.member_subscriptions (stripe_subscription_id, environment);
CREATE INDEX member_subscriptions_lead_idx ON public.member_subscriptions (lead_id);
CREATE INDEX member_subscriptions_customer_idx ON public.member_subscriptions (stripe_customer_id);

GRANT ALL ON public.member_subscriptions TO service_role;

ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages member subscriptions"
  ON public.member_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_member_subscriptions_updated_at
  BEFORE UPDATE ON public.member_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_leads_updated_at();
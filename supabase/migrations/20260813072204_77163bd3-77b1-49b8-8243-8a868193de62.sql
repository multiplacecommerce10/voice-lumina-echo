CREATE TABLE public.subscription_billing (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  email text,
  full_name text,
  environment text not null default 'sandbox',
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  stripe_session_id text,
  plan_name text,
  tier text,
  price_lookup_key text,
  interval text,
  duration_months integer,
  amount_per_cycle numeric,
  amount_per_cycle_formatted text,
  total_commitment numeric,
  currency text,
  status text,
  started_at timestamptz,
  next_charge_at timestamptz,
  cancel_at_period_end boolean not null default false,
  card_last4 text,
  billing_schedule jsonb,
  membership_url text,
  last_reminder_sent_at timestamptz,
  last_reminder_offset_days integer,
  last_reminder_charge_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT ALL ON public.subscription_billing TO service_role;

ALTER TABLE public.subscription_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages subscription billing"
ON public.subscription_billing FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_subscription_billing_next_charge ON public.subscription_billing(next_charge_at);

CREATE TRIGGER trg_subscription_billing_updated_at
BEFORE UPDATE ON public.subscription_billing
FOR EACH ROW EXECUTE FUNCTION public.set_leads_updated_at();
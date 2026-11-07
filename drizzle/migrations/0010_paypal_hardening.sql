ALTER TABLE public.member_subscriptions
  ADD COLUMN IF NOT EXISTS courtesy_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_notifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS period_anchor_at timestamptz;

-- Explicit, owner-authorized courtesy/test access rows created in the sandbox.
UPDATE public.member_subscriptions SET courtesy_access = true
WHERE environment = 'sandbox'
  AND (stripe_subscription_id LIKE 'courtesy\_%' OR stripe_subscription_id LIKE 'manual\_test\_%');

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS admission_status text NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN IF NOT EXISTS admission_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS admission_decided_by text;

ALTER TABLE public.paypal_checkout_intents
  ADD COLUMN IF NOT EXISTS admission_status text NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN IF NOT EXISTS bound_at timestamptz;

CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  provider text NOT NULL,
  kind text NOT NULL,
  subscription_id text,
  recipient text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_due_idx ON public.notification_outbox (status, next_attempt_at);
GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages notification outbox" ON public.notification_outbox FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Access is decided by dates, not by whether the scheduler already ran.
-- Only live rows count, plus explicitly flagged courtesy rows.
CREATE OR REPLACE FUNCTION public.has_active_membership()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_subscriptions
    WHERE email = lower(auth.jwt() ->> 'email')
      AND (environment = 'live' OR courtesy_access)
      AND (
        (access_status = 'active' AND current_period_end IS NOT NULL AND current_period_end > now())
        OR (access_status IN ('past_due_grace','grace') AND grace_expires_at IS NOT NULL AND grace_expires_at > now())
      )
  )
$$;
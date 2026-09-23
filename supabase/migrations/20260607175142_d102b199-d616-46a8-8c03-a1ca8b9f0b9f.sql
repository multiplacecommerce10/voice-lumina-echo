
CREATE TABLE public.stripe_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  environment TEXT NOT NULL,
  object_id TEXT,
  checkout_session_id TEXT,
  payment_intent_id TEXT,
  customer_email TEXT,
  amount_total INTEGER,
  currency TEXT,
  status TEXT,
  client_reference_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  gclid TEXT,
  fbclid TEXT,
  landing_url TEXT,
  referrer TEXT,
  attribution_summary TEXT,
  metadata JSONB,
  raw_event JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_webhook_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhook_events_session ON public.stripe_webhook_events(checkout_session_id);
CREATE INDEX idx_stripe_webhook_events_pi ON public.stripe_webhook_events(payment_intent_id);
CREATE INDEX idx_stripe_webhook_events_received_at ON public.stripe_webhook_events(received_at DESC);
CREATE INDEX idx_stripe_webhook_events_utm_campaign ON public.stripe_webhook_events(utm_campaign);

GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe webhook events"
  ON public.stripe_webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

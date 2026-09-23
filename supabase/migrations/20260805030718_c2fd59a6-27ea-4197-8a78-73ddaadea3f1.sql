CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('recover-abandoned-checkouts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recover-abandoned-checkouts');

SELECT cron.schedule(
  'recover-abandoned-checkouts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--dbe22066-d05e-4f22-8001-7d583efc712e.lovable.app/api/public/leads/recover-abandoned',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
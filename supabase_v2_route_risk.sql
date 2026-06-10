-- ============================================================
-- TCI Customs Clearance Map - V2 P1 route risk suggestions
-- Adds rule-based suggested risk fields and schedules sync-route-risk.
-- Run after supabase_schema.sql and supabase_v1_5_public_data.sql.
-- ============================================================

alter table route_intelligence
  add column if not exists suggested_risk_level text
    check (suggested_risk_level in ('green', 'yellow', 'red')),
  add column if not exists suggested_risk_reason text;

create index if not exists customs_records_country_created_at_idx
  on customs_records (country, created_at);

create index if not exists route_intelligence_destination_country_idx
  on route_intelligence (destination_country);

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('tci-sync-route-risk')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

-- Run 10 minutes after sync-weather's 00:00 / 12:00 UTC schedule.
-- If SYNC_TOKEN is enabled on Edge Functions, add 'x-sync-token' to headers.
select cron.schedule(
  'tci-sync-route-risk',
  '10 */12 * * *',
  $$
  select net.http_post(
    url := 'https://toszpweohhuuffzbxfix.supabase.co/functions/v1/sync-route-risk',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

notify pgrst, 'reload schema';

-- ============================================================
-- TCI Customs Clearance Map — V1.5 公開資料串接
-- 內容：
--   1. ports 表加 unlocode 唯一索引（供 UN/LOCODE upsert）
--   2. 新表 country_trade_indicators（World Bank LPI 指標）
--   3. 新表 route_weather_alerts（Open-Meteo 航線天氣警示）
--   4. 新表 sync_logs（同步紀錄）
--   5. RLS：登入者可查詢（寫入只透過 Edge Function service role）
--   6. pg_cron 排程：定時呼叫三個 Edge Functions
-- 在 Supabase Dashboard → SQL Editor 執行本檔即可。
-- ============================================================

create extension if not exists "uuid-ossp";

-- 1. ports.unlocode 唯一索引
--    注意：不可用部分索引（where 條件），否則 Supabase upsert 的
--    on conflict 對應不到索引。PostgreSQL 唯一索引本來就允許多筆 NULL，
--    手動建立、不填 unlocode 的港口不受影響。
drop index if exists ports_unlocode_unique;
create unique index if not exists ports_unlocode_unique
  on ports (unlocode);

-- 2. World Bank LPI 指標（1=低 ~ 5=高）
create table if not exists country_trade_indicators (
  id uuid primary key default uuid_generate_v4(),
  country text not null unique,          -- 正規化國名，與前端 normalizeCountry 一致
  iso3 text,
  customs_score numeric,                 -- LP.LPI.CUST.XQ 海關效率
  customs_year integer,
  lpi_score numeric,                     -- LP.LPI.OVRL.XQ 整體物流績效
  lpi_year integer,
  infrastructure_score numeric,          -- LP.LPI.INFR.XQ 基礎建設
  timeliness_score numeric,              -- LP.LPI.TIME.XQ 時效性
  source text default 'World Bank LPI',
  last_updated timestamptz default now()
);

-- 3. 航線天氣警示（每條航線的起點/終點/中途點）
create table if not exists route_weather_alerts (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid references route_intelligence(id) on delete cascade,
  point_name text not null check (point_name in ('origin', 'destination', 'midpoint')),
  latitude double precision,
  longitude double precision,
  wind_gusts_max_kmh numeric,            -- 未來 5 天最大陣風 km/h
  wave_height_max_m numeric,             -- 未來 5 天最大浪高 m（海運點）
  alert_level text not null default 'green' check (alert_level in ('green', 'yellow', 'red')),
  alert_summary text,
  forecast_start date,
  forecast_end date,
  fetched_at timestamptz default now(),
  unique (route_id, point_name)
);

-- 4. 同步紀錄
create table if not exists sync_logs (
  id uuid primary key default uuid_generate_v4(),
  job_name text not null,
  status text not null check (status in ('success', 'error')),
  detail text,
  items integer,
  created_at timestamptz default now()
);

-- 5. RLS
alter table country_trade_indicators enable row level security;
alter table route_weather_alerts enable row level security;
alter table sync_logs enable row level security;

drop policy if exists "登入者可查詢貿易指標" on country_trade_indicators;
create policy "登入者可查詢貿易指標" on country_trade_indicators
  for select using (auth.role() = 'authenticated');

drop policy if exists "登入者可查詢天氣警示" on route_weather_alerts;
create policy "登入者可查詢天氣警示" on route_weather_alerts
  for select using (auth.role() = 'authenticated');

drop policy if exists "登入者可查詢同步紀錄" on sync_logs;
create policy "登入者可查詢同步紀錄" on sync_logs
  for select using (auth.role() = 'authenticated');

-- 6. pg_cron 排程（pg_net 呼叫 Edge Functions）
--    注意：請先在 Dashboard 部署三個 Edge Functions 再執行本段，
--    否則排程會打到 404（不影響資料庫，部署後即恢復正常）。
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('tci-sync-ports', 'tci-sync-weather', 'tci-sync-trade-indicators')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

-- 重要：專案使用新版 publishable 金鑰（非 JWT），Edge Function 的
-- 「Verify JWT」必須關閉（Dashboard → Edge Functions → 各 Function → Details），
-- 否則會收到 401 Invalid JWT。關閉後 cron 不需帶 Authorization。
-- 防濫用（選用）：在 Edge Functions Secrets 設定 SYNC_TOKEN，
-- 並在下方 headers 加上 'x-sync-token', '你的token'。

-- 港口資料：每月 1 日 02:15 UTC（台北 10:15）
select cron.schedule(
  'tci-sync-ports',
  '15 2 1 * *',
  $$
  select net.http_post(
    url := 'https://toszpweohhuuffzbxfix.supabase.co/functions/v1/sync-ports',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

-- 航線天氣：每 12 小時（00:00 / 12:00 UTC）
select cron.schedule(
  'tci-sync-weather',
  '0 */12 * * *',
  $$
  select net.http_post(
    url := 'https://toszpweohhuuffzbxfix.supabase.co/functions/v1/sync-weather',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- World Bank 指標：每週一 02:30 UTC（資料一年才更新一次，每週確認即可）
select cron.schedule(
  'tci-sync-trade-indicators',
  '30 2 * * 1',
  $$
  select net.http_post(
    url := 'https://toszpweohhuuffzbxfix.supabase.co/functions/v1/sync-trade-indicators',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

notify pgrst, 'reload schema';

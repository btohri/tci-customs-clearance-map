# V1.5 公開資料串接 — 部署指南

> 目標：港口資料（UN/LOCODE）、航線天氣（Open-Meteo）、各國物流/海關指標（World Bank LPI）
> 全部由 Supabase 定時自動同步，減少人工維護。
> 全程在 Supabase Dashboard 操作，不需安裝 CLI、不需管理員權限。

---

## 部署順序

### 步驟 1：部署三個 Edge Functions

Supabase Dashboard → **Edge Functions** → **Deploy a new function** → 選「**Via Editor**」（瀏覽器內編輯器，免 CLI）：

| Function 名稱 | 程式碼來源 | 用途 |
|--------------|-----------|------|
| `sync-ports` | `supabase/functions/sync-ports/index.ts` | UN/LOCODE 港口匯入 |
| `sync-weather` | `supabase/functions/sync-weather/index.ts` | 航線天氣警示 |
| `sync-trade-indicators` | `supabase/functions/sync-trade-indicators/index.ts` | World Bank LPI 指標 |

> 名稱必須完全一致（cron 排程是用名稱組 URL）。
> 不需額外設定 secrets：`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 是 Supabase 自動注入的。

### 步驟 2：執行 SQL

Dashboard → **SQL Editor** → 貼上 `supabase_v1_5_public_data.sql` 全部內容 → Run。

內容：新表（`country_trade_indicators`、`route_weather_alerts`、`sync_logs`）、
`ports.unlocode` 唯一索引、RLS、pg_cron 排程（URL 與 anon key 已填好，不用改）。

### 步驟 3：手動觸發第一次同步（驗證用）

每個 Function 頁面右上有「**Test**」可直接觸發；或在 SQL Editor 跑：

```sql
select net.http_post(
  url := 'https://toszpweohhuuffzbxfix.supabase.co/functions/v1/sync-trade-indicators',
  headers := jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer sb_publishable_Y7QsQ--UlQw6j1SNBmdZAw_8x2e7hdk'),
  body := '{}'::jsonb, timeout_milliseconds := 120000);
```

（把 URL 的 function 名稱換成另外兩個再各跑一次。）

### 步驟 4：驗收

```sql
select * from sync_logs order by created_at desc limit 10;   -- 三個 job 都應為 success
select count(*) from ports where source = 'UN/LOCODE';        -- 應有數百~數千筆
select country, customs_score, customs_year from country_trade_indicators order by country;
select * from route_weather_alerts limit 10;                   -- 需先有航線資料
```

前端不用重新設定，GitHub Pages 推上去即可：

```
git add -A
git commit -m "V1.5: 串接 UN/LOCODE、Open-Meteo、World Bank LPI 公開資料"
git push
```

---

## 排程一覽（已寫在 SQL 內）

| Job | 頻率 | 說明 |
|-----|------|------|
| `tci-sync-ports` | 每月 1 日 | UN/LOCODE 一年只更新兩版，每月足夠 |
| `tci-sync-weather` | 每 12 小時 | 未來 5 天預報，半天更新一次 |
| `tci-sync-trade-indicators` | 每週一 | World Bank LPI 約一年更新一次 |

調整頻率：改 SQL 裡的 cron 表達式重跑該段即可（會先自動 unschedule 舊排程）。

## sync-ports 進階參數

預設只匯入系統支援國家的「海港」。需要空港或特定國家時，用 Test 帶 body：

```json
{ "includeAirports": true }
{ "countries": ["TW", "VN", "US"] }
```

## 已知限制

- **台灣不在 World Bank 資料中**，LPI 區塊會自動隱藏（顯示為無資料），屬正常現象。
- Open-Meteo Marine（浪高）對部分內陸座標查不到值，程式會自動降級為只看陣風。
- 天氣警示門檻：紅 = 陣風 ≥ 88 km/h 或浪高 ≥ 6 m；黃 = 陣風 ≥ 62 km/h 或浪高 ≥ 4 m。
  要調整改 `sync-weather/index.ts` 開頭的常數。
- 手動建立、未填 unlocode 的港口完全不受自動同步影響。

## 監控

所有同步成功/失敗都寫入 `sync_logs` 表（前端已有 `TCIApi.getSyncLogs()` 可供後台未來顯示）。
若連續失敗，到 Edge Functions → Logs 看錯誤訊息。

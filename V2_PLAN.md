# TCI Customs Clearance Map — V2 規劃

> 建立：2026-06-12｜狀態：P1 已動工
> V1.x 現況見 `PROJECT_SPEC.md`，公開資料同步見 `DEPLOY_V1_5.md`

---

## P1：航線風險「自動建議燈號」（規則式）

**目標**：減少船務手動判斷燈號的負擔。系統依既有自動化訊號計算「建議燈號」，
船務仍保留最終決定權（自動訊號當參考、人為判斷做決定）。

### 資料訊號（三個都已在系統內）

| 訊號 | 來源 | 更新頻率 |
|------|------|---------|
| 航線天氣警示 | route_weather_alerts（Open-Meteo） | 每 12 小時 |
| 自家通關統計 | customs_records（延遲率/扣關率） | 即時 |
| 海關效率 | country_trade_indicators（World Bank LPI） | 每週 |

### 建議規則（草案，可調）

```
Red：    航線天氣紅警 或 目的國近90天（延遲+扣關）率 ≥ 30%
Yellow： 航線天氣黃警 或 異常率 ≥ 15% 或 目的國 LPI 海關效率 < 2.5
Green：  其餘
```

### 實作項目

1. `route_intelligence` 加欄位：`suggested_risk_level`、`suggested_risk_reason`（text，例：「浪高 6.2m＋近期延遲率 35%」）
2. 新 Edge Function `sync-route-risk`：讀三個訊號 → 算建議燈號 → 寫回；pg_cron 每 12 小時（排在 sync-weather 之後）
3. 前台航線卡片顯示「系統建議：🔴（原因）」，與船務手動燈號並列；後台航線管理顯示建議值供參考
4. sync_logs 照舊記錄

**工作量估計**：一個 Edge Function + 一個 SQL migration + 前後台各一小段顯示。

**動工紀錄（2026-06-12）**：
- SQL：`supabase_v2_route_risk.sql`
- Edge Function：`supabase/functions/sync-route-risk/index.ts`
- 前台：航線卡片與 popup 顯示系統建議
- 後台：航線清單顯示系統建議與原因

---

## P2：AI 風險判斷（Azure OpenAI）

- 經 Power Automate 串 Azure OpenAI（Btohri 已有成功案例：出貨風險分析 Teams 報告）
- 輸入：規則式訊號 + 航線備註 + 近期通關紀錄摘要 → 輸出：燈號建議 + 一段中文理由
- 與 P1 並存：P1 是保底（規則透明可解釋），AI 負責補足規則覆蓋不到的情境
- 可選：每日將「燈號變動的航線」推送 Teams 通知（Power Automate 排程）

---

## P3：自然語言搜尋

- 「印尼 Gummy 好進嗎？」→ 解析國家/劑型 → 查詢 + LPI + 航線風險彙整回答
- 優先做純前端規則解析（國家別名表已可複用），AI 版併入 P2 的 Azure OpenAI 管線

---

## P4：架構演進（原 V1 規劃保留）

- GitHub Pages → Cloudflare Pages；api.js → Cloudflare Worker API 層（api.js 已集中所有呼叫，轉移只改一檔）
- Supabase 保留不動
- 成分管理、法規限制、國家准入規則資料表

---

## 已評估：做不到全自動的部分（資料源限制）

即時航運風險（船舶 AIS 延誤、港口壅塞指數、運河排隊、準班率）**無免費公開 API**：
MarineTraffic / Windward / Linerlytica / 船公司準班率皆為付費服務。
結論：燈號維持「自動建議 + 人工確認」模式；船務從貨代/船公司得到的第一手消息仍是不可取代的輸入。
若未來有預算，優先評估付費港口壅塞 API 接入 P1 規則。

---

## 優先順序建議

P1（規則式建議燈號）→ P2（AI 判斷 + Teams 通知）→ P3（自然語言搜尋）→ P4（架構演進）

P1 不依賴任何新外部服務，隨時可動工；P2 依賴 Power Automate + Azure OpenAI 額度；
P4 等使用量成長或 Supabase 免費額度吃緊時再啟動。

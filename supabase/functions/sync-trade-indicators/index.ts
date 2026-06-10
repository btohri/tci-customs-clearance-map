// sync-trade-indicators
// 從 World Bank API 抓取 LPI（物流績效指數）四項指標，寫入 country_trade_indicators。
// 資料來源：https://api.worldbank.org（免費、無需金鑰）
// 注意：World Bank 無台灣資料，台灣會維持無資料狀態。

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ISO3 → 正規化國名（需與前端 js/api.js countryAliases 的 value 一致）
const COUNTRY_MAP: Record<string, string> = {
  USA: 'USA', CHN: 'China', TWN: 'Taiwan', JPN: 'Japan', KOR: 'Korea',
  VNM: 'Vietnam', THA: 'Thailand', MYS: 'Malaysia', SGP: 'Singapore',
  IDN: 'Indonesia', PHL: 'Philippines', IND: 'India', AUS: 'Australia',
  NZL: 'New Zealand', CAN: 'Canada', MEX: 'Mexico', BRA: 'Brazil',
  GBR: 'UK', DEU: 'Germany', FRA: 'France', ITA: 'Italy', ESP: 'Spain',
  NLD: 'Netherlands', RUS: 'Russia', ARE: 'United Arab Emirates',
  SAU: 'Saudi Arabia', TUR: 'Turkey', HKG: 'Hong Kong',
  POL: 'Poland', AUT: 'Austria', BEL: 'Belgium', CHE: 'Switzerland',
  SWE: 'Sweden', NOR: 'Norway', DNK: 'Denmark', FIN: 'Finland',
  PRT: 'Portugal', GRC: 'Greece', IRL: 'Ireland', HUN: 'Hungary',
  ISR: 'Israel', EGY: 'Egypt', ZAF: 'South Africa', CHL: 'Chile',
  ARG: 'Argentina'
};

const INDICATORS: Record<string, { id: string; yearField?: string }> = {
  customs_score: { id: 'LP.LPI.CUST.XQ', yearField: 'customs_year' },
  lpi_score: { id: 'LP.LPI.OVRL.XQ', yearField: 'lpi_year' },
  infrastructure_score: { id: 'LP.LPI.INFR.XQ' },
  timeliness_score: { id: 'LP.LPI.TIME.XQ' }
};

async function fetchIndicator(indicatorId: string) {
  const countries = Object.keys(COUNTRY_MAP).join(';');
  const url = `https://api.worldbank.org/v2/country/${countries}/indicator/${indicatorId}?date=2012:2030&format=json&per_page=2000`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`World Bank API ${indicatorId} 回應 ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];

  // 每個國家取「最新且非空值」的年份
  const latest: Record<string, { value: number; year: number }> = {};
  for (const row of rows) {
    const iso3 = row?.countryiso3code;
    const value = row?.value;
    const year = Number(row?.date);
    if (!iso3 || value === null || value === undefined || !Number.isFinite(year)) continue;
    if (!latest[iso3] || year > latest[iso3].year) {
      latest[iso3] = { value: Number(value), year };
    }
  }
  return latest;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 選用防濫用：有設定 SYNC_TOKEN secret 時，要求請求帶相同的 x-sync-token
  const requiredToken = Deno.env.get('SYNC_TOKEN');
  if (requiredToken && req.headers.get('x-sync-token') !== requiredToken) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid sync token.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const results: Record<string, Record<string, { value: number; year: number }>> = {};
    for (const [field, config] of Object.entries(INDICATORS)) {
      results[field] = await fetchIndicator(config.id);
    }

    const records = Object.entries(COUNTRY_MAP).map(([iso3, country]) => {
      const record: Record<string, unknown> = {
        country,
        iso3,
        source: 'World Bank LPI',
        last_updated: new Date().toISOString()
      };
      for (const [field, config] of Object.entries(INDICATORS)) {
        const hit = results[field][iso3];
        record[field] = hit?.value ?? null;
        if (config.yearField) record[config.yearField] = hit?.year ?? null;
      }
      return record;
    });

    const withData = records.filter((record) => record.customs_score !== null || record.lpi_score !== null);

    const { error } = await supabase
      .from('country_trade_indicators')
      .upsert(withData, { onConflict: 'country' });
    if (error) throw error;

    await supabase.from('sync_logs').insert({
      job_name: 'sync-trade-indicators',
      status: 'success',
      detail: `更新 ${withData.length} 國指標（World Bank 無資料國家：${records.length - withData.length}）`,
      items: withData.length
    });

    return new Response(JSON.stringify({ ok: true, updated: withData.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('sync_logs').insert({
      job_name: 'sync-trade-indicators',
      status: 'error',
      detail: message,
      items: 0
    }).then(() => undefined, () => undefined);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

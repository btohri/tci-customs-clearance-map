// sync-ports
// 從 UN/LOCODE 開放資料（datahub/datasets 鏡像）匯入港口資料至 ports 表。
// 預設只匯入「系統支援國家」的海港（Function 含 '1'），可用 body 參數調整：
//   { "includeAirports": true }          → 連空港（Function 含 '4'）一起匯入
//   { "countries": ["TW", "VN"] }        → 只匯入指定國家（ISO alpha-2）
// upsert 依 unlocode 唯一索引，重複執行不會產生重複資料；
// 手動建立、無 unlocode 的港口不受影響。

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const CSV_URLS = [
  'https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv',
  'https://raw.githubusercontent.com/datasets/un-locode/master/data/code-list.csv'
];

// ISO alpha-2 → 正規化國名（需與前端 js/api.js countryAliases 的 value 一致）
const COUNTRY_MAP: Record<string, string> = {
  US: 'USA', CN: 'China', TW: 'Taiwan', JP: 'Japan', KR: 'Korea',
  VN: 'Vietnam', TH: 'Thailand', MY: 'Malaysia', SG: 'Singapore',
  ID: 'Indonesia', PH: 'Philippines', IN: 'India', AU: 'Australia',
  NZ: 'New Zealand', CA: 'Canada', MX: 'Mexico', BR: 'Brazil',
  GB: 'UK', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  NL: 'Netherlands', RU: 'Russia', AE: 'United Arab Emirates',
  SA: 'Saudi Arabia', TR: 'Turkey', HK: 'Hong Kong'
};

// 簡易 CSV 單行解析（處理引號內逗號）
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (char === '"') { inQuotes = false; }
      else { current += char; }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// UN/LOCODE 座標格式 "2231N 11414E" → 十進位經緯度
function parseCoordinates(value: string): { lat: number; lng: number } | null {
  const match = String(value || '').trim().match(/^(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])$/);
  if (!match) return null;
  let lat = Number(match[1]) + Number(match[2]) / 60;
  let lng = Number(match[4]) + Number(match[5]) / 60;
  if (match[3] === 'S') lat = -lat;
  if (match[6] === 'W') lng = -lng;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

async function fetchCsv(): Promise<string> {
  let lastError = '';
  for (const url of CSV_URLS) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.text();
      lastError = `${url} 回應 ${response.status}`;
    } catch (error) {
      lastError = `${url}：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  throw new Error(`UN/LOCODE 資料來源無法取得（${lastError}）`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    let includeAirports = false;
    let countryFilter: string[] | null = null;
    try {
      const body = await req.json();
      includeAirports = Boolean(body?.includeAirports);
      if (Array.isArray(body?.countries) && body.countries.length) {
        countryFilter = body.countries.map((code: string) => String(code).trim().toUpperCase());
      }
    } catch (_error) {
      // 無 body 時使用預設值
    }

    const csv = await fetchCsv();
    const lines = csv.split('\n');
    const header = parseCsvLine(lines[0]).map((name) => name.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const idx = {
      country: col('country'),
      location: col('location'),
      name: col('namewodiacritics') >= 0 ? col('namewodiacritics') : col('name'),
      func: col('function'),
      coordinates: col('coordinates')
    };
    if (idx.country < 0 || idx.location < 0 || idx.func < 0) {
      throw new Error(`UN/LOCODE CSV 欄位格式不符：${header.join(',')}`);
    }

    const now = new Date().toISOString();
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const fields = parseCsvLine(line);
      const alpha2 = String(fields[idx.country] || '').trim().toUpperCase();
      const country = COUNTRY_MAP[alpha2];
      if (!country) continue;
      if (countryFilter && !countryFilter.includes(alpha2)) continue;

      const func = String(fields[idx.func] || '');
      const isSeaport = func.includes('1');
      const isAirport = func.includes('4');
      if (!isSeaport && !(includeAirports && isAirport)) continue;

      const location = String(fields[idx.location] || '').trim().toUpperCase();
      const name = String(fields[idx.name] || '').trim();
      if (!location || !name) continue;

      const unlocode = `${alpha2}${location}`;
      if (seen.has(unlocode)) continue;
      seen.add(unlocode);

      const coords = parseCoordinates(fields[idx.coordinates] || '');
      rows.push({
        port_name: name,
        country,
        unlocode,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        source: 'UN/LOCODE',
        last_updated: now
      });
    }

    // 分批 upsert，避免單次 payload 過大
    const BATCH = 500;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from('ports')
        .upsert(batch, { onConflict: 'unlocode' });
      if (error) throw new Error(`第 ${i / BATCH + 1} 批 upsert 失敗：${error.message}`);
      upserted += batch.length;
    }

    await supabase.from('sync_logs').insert({
      job_name: 'sync-ports',
      status: 'success',
      detail: `匯入/更新 ${upserted} 筆港口（海港${includeAirports ? ' + 空港' : ''}，${countryFilter ? countryFilter.join('/') : '全部支援國家'}）`,
      items: upserted
    });

    return new Response(JSON.stringify({ ok: true, updated: upserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('sync_logs').insert({
      job_name: 'sync-ports', status: 'error', detail: message, items: 0
    }).then(() => undefined, () => undefined);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

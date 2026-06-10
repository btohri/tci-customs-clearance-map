// sync-weather
// 針對 route_intelligence 每條航線的起點/終點/中途點，
// 從 Open-Meteo 抓未來 5 天最大陣風（所有航線）與最大浪高（海運航線），
// 計算警示燈號後寫入 route_weather_alerts。
// 資料來源：https://open-meteo.com（免費、無需金鑰）
// 警示門檻：紅 = 陣風 >= 88 km/h（颱風級）或浪高 >= 6 m
//          黃 = 陣風 >= 62 km/h（強風級）或浪高 >= 4 m

const FORECAST_DAYS = 5;
const RED_GUST = 88;
const YELLOW_GUST = 62;
const RED_WAVE = 6;
const YELLOW_WAVE = 4;

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface RoutePoint {
  routeId: string;
  pointName: 'origin' | 'destination' | 'midpoint';
  lat: number;
  lng: number;
  isOcean: boolean;
}

function midpointFromPath(routePath: unknown): [number, number] | null {
  if (!Array.isArray(routePath) || routePath.length < 3) return null;
  const middle = routePath[Math.floor(routePath.length / 2)];
  const point = Array.isArray(middle) ? middle : [middle?.lat, middle?.lng];
  if (point.length === 2 && point.every((item: unknown) => Number.isFinite(Number(item)))) {
    return [Number(point[0]), Number(point[1])];
  }
  return null;
}

function buildPoints(routes: Record<string, unknown>[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const route of routes) {
    const isOcean = route.transport_mode === 'ocean' || route.transport_mode === 'multimodal';
    const candidates: Array<[RoutePoint['pointName'], number, number]> = [];
    if (Number.isFinite(Number(route.origin_lat)) && Number.isFinite(Number(route.origin_lng))) {
      candidates.push(['origin', Number(route.origin_lat), Number(route.origin_lng)]);
    }
    if (Number.isFinite(Number(route.destination_lat)) && Number.isFinite(Number(route.destination_lng))) {
      candidates.push(['destination', Number(route.destination_lat), Number(route.destination_lng)]);
    }
    const mid = midpointFromPath(route.route_path);
    if (mid) candidates.push(['midpoint', mid[0], mid[1]]);
    for (const [pointName, lat, lng] of candidates) {
      points.push({ routeId: String(route.id), pointName, lat, lng, isOcean });
    }
  }
  return points;
}

async function fetchDailyMax(
  baseUrl: string,
  points: RoutePoint[],
  dailyField: string
): Promise<Array<number | null>> {
  if (!points.length) return [];
  const latitude = points.map((point) => point.lat.toFixed(4)).join(',');
  const longitude = points.map((point) => point.lng.toFixed(4)).join(',');
  const url = `${baseUrl}?latitude=${latitude}&longitude=${longitude}&daily=${dailyField}&forecast_days=${FORECAST_DAYS}&timezone=UTC`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo 回應 ${response.status}：${baseUrl}`);
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [payload];
  return points.map((_, index) => {
    const values: unknown[] = list[index]?.daily?.[dailyField] || [];
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? Math.max(...numbers) : null;
  });
}

function alertLevel(gust: number | null, wave: number | null): 'green' | 'yellow' | 'red' {
  if ((gust !== null && gust >= RED_GUST) || (wave !== null && wave >= RED_WAVE)) return 'red';
  if ((gust !== null && gust >= YELLOW_GUST) || (wave !== null && wave >= YELLOW_WAVE)) return 'yellow';
  return 'green';
}

function alertSummary(gust: number | null, wave: number | null): string {
  const parts: string[] = [];
  if (gust !== null) parts.push(`最大陣風 ${Math.round(gust)} km/h`);
  if (wave !== null) parts.push(`最大浪高 ${wave.toFixed(1)} m`);
  return parts.join('、') || '無預報資料';
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
    const { data: routes, error: routesError } = await supabase
      .from('route_intelligence')
      .select('id, transport_mode, origin_lat, origin_lng, destination_lat, destination_lng, route_path');
    if (routesError) throw routesError;

    const points = buildPoints(routes || []);
    if (!points.length) {
      await supabase.from('sync_logs').insert({
        job_name: 'sync-weather', status: 'success', detail: '無航線可同步', items: 0
      });
      return new Response(JSON.stringify({ ok: true, updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 陣風：所有點一次批次查詢
    const gusts = await fetchDailyMax('https://api.open-meteo.com/v1/forecast', points, 'wind_gusts_10m_max');

    // 浪高：僅海運點；Marine API 對陸地點可能失敗，整批失敗時降級為僅風速
    const oceanPoints = points.filter((point) => point.isOcean);
    let waves: Array<number | null> = [];
    try {
      waves = await fetchDailyMax('https://marine-api.open-meteo.com/v1/marine', oceanPoints, 'wave_height_max');
    } catch (_error) {
      waves = oceanPoints.map(() => null);
    }
    const waveByKey = new Map<string, number | null>();
    oceanPoints.forEach((point, index) => {
      waveByKey.set(`${point.routeId}:${point.pointName}`, waves[index] ?? null);
    });

    const today = new Date();
    const end = new Date(today.getTime() + (FORECAST_DAYS - 1) * 86400000);
    const rows = points.map((point, index) => {
      const gust = gusts[index] ?? null;
      const wave = waveByKey.get(`${point.routeId}:${point.pointName}`) ?? null;
      return {
        route_id: point.routeId,
        point_name: point.pointName,
        latitude: point.lat,
        longitude: point.lng,
        wind_gusts_max_kmh: gust,
        wave_height_max_m: wave,
        alert_level: alertLevel(gust, wave),
        alert_summary: alertSummary(gust, wave),
        forecast_start: today.toISOString().slice(0, 10),
        forecast_end: end.toISOString().slice(0, 10),
        fetched_at: new Date().toISOString()
      };
    });

    const { error: upsertError } = await supabase
      .from('route_weather_alerts')
      .upsert(rows, { onConflict: 'route_id,point_name' });
    if (upsertError) throw upsertError;

    const alerts = rows.filter((row) => row.alert_level !== 'green').length;
    await supabase.from('sync_logs').insert({
      job_name: 'sync-weather',
      status: 'success',
      detail: `更新 ${rows.length} 個航線觀測點，其中 ${alerts} 點有風險警示`,
      items: rows.length
    });

    return new Response(JSON.stringify({ ok: true, updated: rows.length, alerts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('sync_logs').insert({
      job_name: 'sync-weather', status: 'error', detail: message, items: 0
    }).then(() => undefined, () => undefined);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

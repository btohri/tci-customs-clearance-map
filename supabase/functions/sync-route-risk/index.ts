// sync-route-risk
// Combines route weather alerts, recent customs history, and World Bank LPI
// into a rule-based suggested risk level on route_intelligence.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOOKBACK_DAYS = 90;
const RED_ANOMALY_RATE = 0.3;
const YELLOW_ANOMALY_RATE = 0.15;
const YELLOW_CUSTOMS_SCORE = 2.5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type RiskLevel = 'green' | 'yellow' | 'red';

interface RouteRow {
  id: string;
  route_name: string | null;
  destination_country: string | null;
}

interface WeatherAlertRow {
  route_id: string;
  alert_level: RiskLevel;
  alert_summary: string | null;
  point_name: string | null;
}

interface CustomsRecordRow {
  country: string | null;
  clearance_result: string | null;
  issue_held: boolean | null;
  issue_delayed: boolean | null;
}

interface CountryTradeIndicatorRow {
  country: string | null;
  customs_score: number | null;
}

interface CountryStats {
  total: number;
  anomalies: number;
}

const riskRank: Record<RiskLevel, number> = { green: 1, yellow: 2, red: 3 };

function normalizeCountry(value: string | null | undefined): string {
  return String(value || '').trim();
}

function isAnomaly(record: CustomsRecordRow): boolean {
  return (
    record.clearance_result === 'delayed' ||
    record.clearance_result === 'held' ||
    record.clearance_result === 'rejected' ||
    record.issue_held === true ||
    record.issue_delayed === true
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function reasonText(parts: string[]): string {
  return parts.length ? parts.join('；') : '目前自動訊號未達警示門檻';
}

function chooseWorstWeather(alerts: WeatherAlertRow[]): WeatherAlertRow | null {
  if (!alerts.length) return null;
  return alerts.reduce((worst, alert) => (
    riskRank[alert.alert_level] > riskRank[worst.alert_level] ? alert : worst
  ));
}

function calculateSuggestion(
  weather: WeatherAlertRow | null,
  stats: CountryStats | undefined,
  indicator: CountryTradeIndicatorRow | undefined
): { level: RiskLevel; reason: string } {
  const reasons: string[] = [];
  const anomalyRate = stats?.total ? stats.anomalies / stats.total : 0;
  const customsScore = indicator?.customs_score;

  if (weather && weather.alert_level !== 'green') {
    const label = weather.alert_level === 'red' ? '紅警' : '黃警';
    reasons.push(`航線天氣${label}${weather.alert_summary ? `：${weather.alert_summary}` : ''}`);
  }

  if (stats?.total) {
    reasons.push(`目的國近 ${LOOKBACK_DAYS} 天異常率 ${formatPercent(anomalyRate)}（${stats.anomalies}/${stats.total}）`);
  }

  if (customsScore !== null && customsScore !== undefined && Number.isFinite(Number(customsScore))) {
    reasons.push(`LPI 海關效率 ${Number(customsScore).toFixed(2)}`);
  }

  if (weather?.alert_level === 'red' || anomalyRate >= RED_ANOMALY_RATE) {
    return { level: 'red', reason: reasonText(reasons) };
  }

  if (
    weather?.alert_level === 'yellow' ||
    anomalyRate >= YELLOW_ANOMALY_RATE ||
    (customsScore !== null && customsScore !== undefined && Number(customsScore) < YELLOW_CUSTOMS_SCORE)
  ) {
    return { level: 'yellow', reason: reasonText(reasons) };
  }

  return { level: 'green', reason: reasonText(reasons) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

    const [
      routesResult,
      alertsResult,
      recordsResult,
      indicatorsResult
    ] = await Promise.all([
      supabase
        .from('route_intelligence')
        .select('id, route_name, destination_country'),
      supabase
        .from('route_weather_alerts')
        .select('route_id, alert_level, alert_summary, point_name'),
      supabase
        .from('customs_records')
        .select('country, clearance_result, issue_held, issue_delayed')
        .gte('created_at', cutoff),
      supabase
        .from('country_trade_indicators')
        .select('country, customs_score')
    ]);

    if (routesResult.error) throw routesResult.error;
    if (alertsResult.error) throw alertsResult.error;
    if (recordsResult.error) throw recordsResult.error;
    if (indicatorsResult.error) throw indicatorsResult.error;

    const routes = (routesResult.data || []) as RouteRow[];
    const alerts = (alertsResult.data || []) as WeatherAlertRow[];
    const records = (recordsResult.data || []) as CustomsRecordRow[];
    const indicators = (indicatorsResult.data || []) as CountryTradeIndicatorRow[];

    const alertsByRoute = new Map<string, WeatherAlertRow[]>();
    for (const alert of alerts) {
      if (!alert.route_id) continue;
      const list = alertsByRoute.get(alert.route_id) || [];
      list.push(alert);
      alertsByRoute.set(alert.route_id, list);
    }

    const statsByCountry = new Map<string, CountryStats>();
    for (const record of records) {
      const country = normalizeCountry(record.country);
      if (!country) continue;
      const stats = statsByCountry.get(country) || { total: 0, anomalies: 0 };
      stats.total += 1;
      if (isAnomaly(record)) stats.anomalies += 1;
      statsByCountry.set(country, stats);
    }

    const indicatorsByCountry = new Map<string, CountryTradeIndicatorRow>();
    for (const indicator of indicators) {
      const country = normalizeCountry(indicator.country);
      if (country) indicatorsByCountry.set(country, indicator);
    }

    const updates = routes.map((route) => {
      const country = normalizeCountry(route.destination_country);
      const suggestion = calculateSuggestion(
        chooseWorstWeather(alertsByRoute.get(route.id) || []),
        statsByCountry.get(country),
        indicatorsByCountry.get(country)
      );
      return {
        id: route.id,
        suggested_risk_level: suggestion.level,
        suggested_risk_reason: suggestion.reason,
        last_updated: new Date().toISOString()
      };
    });

    if (updates.length) {
      const { error: updateError } = await supabase
        .from('route_intelligence')
        .upsert(updates, { onConflict: 'id' });
      if (updateError) throw updateError;
    }

    const elevated = updates.filter((row) => row.suggested_risk_level !== 'green').length;
    await supabase.from('sync_logs').insert({
      job_name: 'sync-route-risk',
      status: 'success',
      detail: `更新 ${updates.length} 條航線建議燈號，其中 ${elevated} 條需注意`,
      items: updates.length
    });

    return new Response(JSON.stringify({ ok: true, updated: updates.length, elevated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('sync_logs').insert({
      job_name: 'sync-route-risk',
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

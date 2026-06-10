(function () {
  'use strict';

  // 請替換為 Supabase 專案資訊；anon key 可公開，但資料安全需依賴 RLS。
  const SUPABASE_URL = 'https://toszpweohhuuffzbxfix.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Y7QsQ--UlQw6j1SNBmdZAw_8x2e7hdk';

  const hasConfig = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
  const supabase = hasConfig && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const countryAliases = [
    { value: 'USA', zh: '美國', aliases: ['US', 'USA', 'U.S.', 'U.S.A.', 'United States', 'United States of America', 'America', '美國', '美国'] },
    { value: 'China', zh: '中國', aliases: ['CN', 'CHN', 'China', 'Mainland China', 'PRC', '中國', '中国', '大陸', '大陆'] },
    { value: 'Taiwan', zh: '台灣', aliases: ['TW', 'TWN', 'Taiwan', '台灣', '台湾'] },
    { value: 'Japan', zh: '日本', aliases: ['JP', 'JPN', 'Japan', '日本'] },
    { value: 'Korea', zh: '韓國', aliases: ['KR', 'KOR', 'Korea', 'South Korea', 'Republic of Korea', '韓國', '韩国', '南韓', '南韩'] },
    { value: 'Vietnam', zh: '越南', aliases: ['VN', 'VNM', 'Vietnam', 'Viet Nam', '越南'] },
    { value: 'Thailand', zh: '泰國', aliases: ['TH', 'THA', 'Thailand', '泰國', '泰国'] },
    { value: 'Malaysia', zh: '馬來西亞', aliases: ['MY', 'MYS', 'Malaysia', '馬來西亞', '马来西亚'] },
    { value: 'Singapore', zh: '新加坡', aliases: ['SG', 'SGP', 'Singapore', '新加坡'] },
    { value: 'Indonesia', zh: '印尼', aliases: ['ID', 'IDN', 'Indonesia', '印尼', '印度尼西亞', '印度尼西亚'] },
    { value: 'Philippines', zh: '菲律賓', aliases: ['PH', 'PHL', 'Philippines', '菲律賓', '菲律宾'] },
    { value: 'India', zh: '印度', aliases: ['IN', 'IND', 'India', '印度'] },
    { value: 'Australia', zh: '澳洲', aliases: ['AU', 'AUS', 'Australia', '澳洲', '澳大利亞', '澳大利亚'] },
    { value: 'New Zealand', zh: '紐西蘭', aliases: ['NZ', 'NZL', 'New Zealand', '紐西蘭', '新西兰'] },
    { value: 'Canada', zh: '加拿大', aliases: ['CA', 'CAN', 'Canada', '加拿大'] },
    { value: 'Mexico', zh: '墨西哥', aliases: ['MX', 'MEX', 'Mexico', '墨西哥'] },
    { value: 'Brazil', zh: '巴西', aliases: ['BR', 'BRA', 'Brazil', '巴西'] },
    { value: 'UK', zh: '英國', aliases: ['GB', 'GBR', 'UK', 'U.K.', 'United Kingdom', 'Great Britain', 'Britain', 'England', '英國', '英国'] },
    { value: 'Germany', zh: '德國', aliases: ['DE', 'DEU', 'Germany', '德國', '德国'] },
    { value: 'France', zh: '法國', aliases: ['FR', 'FRA', 'France', '法國', '法国'] },
    { value: 'Italy', zh: '義大利', aliases: ['IT', 'ITA', 'Italy', '義大利', '意大利'] },
    { value: 'Spain', zh: '西班牙', aliases: ['ES', 'ESP', 'Spain', '西班牙'] },
    { value: 'Netherlands', zh: '荷蘭', aliases: ['NL', 'NLD', 'Netherlands', 'Holland', '荷蘭', '荷兰'] },
    { value: 'Russia', zh: '俄羅斯', aliases: ['RU', 'RUS', 'Russia', 'Russian Federation', '俄羅斯', '俄罗斯'] },
    { value: 'United Arab Emirates', zh: '阿聯酋', aliases: ['AE', 'ARE', 'UAE', 'United Arab Emirates', '阿聯酋', '阿联酋'] },
    { value: 'Saudi Arabia', zh: '沙烏地阿拉伯', aliases: ['SA', 'SAU', 'Saudi Arabia', '沙烏地阿拉伯', '沙特阿拉伯'] },
    { value: 'Turkey', zh: '土耳其', aliases: ['TR', 'TUR', 'Turkey', 'Turkiye', 'Türkiye', '土耳其'] }
  ];
  const countryAliasMap = countryAliases.reduce((map, country) => {
    [country.value, country.zh, ...country.aliases].forEach((alias) => {
      map.set(normalizeKey(alias), country);
    });
    return map;
  }, new Map());
  const dosageForms = [
    { value: 'FoodPowderPack', zh: '食品粉包', en: '', aliases: ['食品粉包', '粉包', 'Powder Pack', 'Powder', '粉劑', '粉剂', '粉末'] },
    { value: 'FoodTablet', zh: '食品錠劑', en: '', aliases: ['食品錠劑', '食品锭剂', '錠劑', '锭剂', '片劑', '片剂', 'Tablet', 'Capsule', 'Softgel', 'Gummy', '膠囊', '胶囊', '軟膠囊', '软胶囊', '軟糖', '软糖'] },
    { value: 'Mask', zh: '面膜', en: '', aliases: ['面膜', 'Facial Mask', 'Sheet Mask'] },
    { value: 'Liquid', zh: '液態', en: '', aliases: ['液態', '液态', '液體', '液体', 'Liquid'] }
  ];
  const dosageAliasMap = dosageForms.reduce((map, form) => {
    [form.value, form.en, form.zh, ...form.aliases].filter(Boolean).forEach((alias) => {
      map.set(normalizeKey(alias), form);
    });
    return map;
  }, new Map());
  const dosageValueSet = new Set(dosageForms.map((form) => form.value));
  const riskRank = { green: 1, yellow: 2, red: 3 };
  const portCoordinates = [
    { country: 'Taiwan', aliases: ['Keelung', '基隆'], lat: 25.1504, lng: 121.7392 },
    { country: 'Taiwan', aliases: ['Kaohsiung', '高雄'], lat: 22.6163, lng: 120.2655 },
    { country: 'China', aliases: ['Shanghai', '上海'], lat: 31.2304, lng: 121.4737 },
    { country: 'China', aliases: ['Shenzhen', '深圳', 'Yantian', '鹽田', '盐田'], lat: 22.5431, lng: 114.0579 },
    { country: 'China', aliases: ['Ningbo', '寧波', '宁波'], lat: 29.8683, lng: 121.5440 },
    { country: 'China', aliases: ['Guangzhou', '廣州', '广州'], lat: 23.1291, lng: 113.2644 },
    { country: 'Hong Kong', aliases: ['Hong Kong', '香港'], lat: 22.3193, lng: 114.1694 },
    { country: 'Japan', aliases: ['Tokyo', '東京'], lat: 35.6762, lng: 139.6503 },
    { country: 'Japan', aliases: ['Yokohama', '橫濱', '横滨'], lat: 35.4437, lng: 139.6380 },
    { country: 'Japan', aliases: ['Osaka', '大阪'], lat: 34.6937, lng: 135.5023 },
    { country: 'Korea', aliases: ['Busan', '釜山'], lat: 35.1796, lng: 129.0756 },
    { country: 'Korea', aliases: ['Incheon', '仁川'], lat: 37.4563, lng: 126.7052 },
    { country: 'Singapore', aliases: ['Singapore', '新加坡'], lat: 1.2644, lng: 103.8223 },
    { country: 'Malaysia', aliases: ['Port Klang', 'Klang', '巴生港'], lat: 3.0019, lng: 101.3928 },
    { country: 'Thailand', aliases: ['Laem Chabang', '林查班'], lat: 13.0827, lng: 100.8837 },
    { country: 'Vietnam', aliases: ['Ho Chi Minh', 'Cat Lai', '胡志明', '吉萊'], lat: 10.7769, lng: 106.7009 },
    { country: 'Vietnam', aliases: ['Hai Phong', '海防'], lat: 20.8449, lng: 106.6881 },
    { country: 'Indonesia', aliases: ['Jakarta', 'Tanjung Priok', '雅加達'], lat: -6.1045, lng: 106.8804 },
    { country: 'Philippines', aliases: ['Manila', '馬尼拉'], lat: 14.5995, lng: 120.9842 },
    { country: 'USA', aliases: ['Los Angeles', 'LA', 'Long Beach', '洛杉磯', '長灘', '长滩'], lat: 33.7405, lng: -118.2775 },
    { country: 'USA', aliases: ['New York', 'NYC', 'Newark', '紐約', '纽约'], lat: 40.6895, lng: -74.1745 },
    { country: 'USA', aliases: ['Seattle', 'Tacoma', '西雅圖'], lat: 47.6062, lng: -122.3321 },
    { country: 'USA', aliases: ['Houston', '休士頓'], lat: 29.7604, lng: -95.3698 },
    { country: 'Canada', aliases: ['Vancouver', '溫哥華'], lat: 49.2827, lng: -123.1207 },
    { country: 'Canada', aliases: ['Toronto', '多倫多'], lat: 43.6532, lng: -79.3832 },
    { country: 'UK', aliases: ['London', 'Felixstowe', '倫敦'], lat: 51.5072, lng: -0.1276 },
    { country: 'Netherlands', aliases: ['Rotterdam', '鹿特丹'], lat: 51.9244, lng: 4.4777 },
    { country: 'Germany', aliases: ['Hamburg', '漢堡', '汉堡'], lat: 53.5511, lng: 9.9937 },
    { country: 'France', aliases: ['Le Havre', 'Paris', '勒阿弗爾', '巴黎'], lat: 49.4944, lng: 0.1079 },
    { country: 'Spain', aliases: ['Barcelona', 'Valencia', '巴塞隆納', '瓦倫西亞'], lat: 41.3851, lng: 2.1734 },
    { country: 'Italy', aliases: ['Genoa', 'Milan', '熱那亞', '米蘭'], lat: 44.4056, lng: 8.9463 },
    { country: 'United Arab Emirates', aliases: ['Dubai', 'Jebel Ali', '杜拜'], lat: 25.2048, lng: 55.2708 },
    { country: 'Australia', aliases: ['Sydney', 'Melbourne', '雪梨', '墨爾本'], lat: -33.8688, lng: 151.2093 },
    { country: 'India', aliases: ['Mumbai', 'Nhava Sheva', '孟買'], lat: 19.0760, lng: 72.8777 },
    { country: 'Brazil', aliases: ['Santos', 'São Paulo', 'Sao Paulo', '聖保羅'], lat: -23.9608, lng: -46.3336 },
    { country: 'Mexico', aliases: ['Manzanillo', 'Mexico City', '墨西哥城'], lat: 19.4326, lng: -99.1332 }
  ];
  const countryCoordinates = countryAliases.reduce((map, country) => {
    const match = portCoordinates.find((port) => normalizeCountry(port.country) === country.value);
    if (match) map.set(country.value, { lat: match.lat, lng: match.lng });
    return map;
  }, new Map());

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .replace(/[.\s_-]+/g, '')
      .toLowerCase();
  }

  function findAlias(map, value) {
    const text = String(value || '').trim();
    const direct = map.get(normalizeKey(text));
    if (direct) return direct;
    return text
      .split(/[\s/()（）,，]+/)
      .map((item) => map.get(normalizeKey(item)))
      .find(Boolean);
  }

  function normalizeCountry(value) {
    const country = findAlias(countryAliasMap, value);
    return country?.value || String(value || '').trim();
  }

  function displayCountry(value) {
    const country = findAlias(countryAliasMap, value);
    return country ? `${country.zh} ${country.value}` : String(value || '').trim();
  }

  function countryMatches(recordCountry, queryCountry) {
    return normalizeCountry(recordCountry) === normalizeCountry(queryCountry);
  }

  function normalizeDosageForm(value) {
    const form = findAlias(dosageAliasMap, value);
    return form?.value || String(value || '').trim();
  }

  function displayDosageForm(value) {
    const form = findAlias(dosageAliasMap, value);
    return form ? [form.zh, form.en].filter(Boolean).join(' ') : String(value || '').trim();
  }

  function dosageMatches(recordForm, queryForm) {
    return normalizeDosageForm(recordForm) === normalizeDosageForm(queryForm);
  }

  function findRouteCoordinate(country, port) {
    const normalizedCountry = normalizeCountry(country);
    const portKey = normalizeKey(port);
    const match = portCoordinates.find((item) => (
      normalizeCountry(item.country) === normalizedCountry &&
      item.aliases.some((alias) => portKey.includes(normalizeKey(alias)) || normalizeKey(alias).includes(portKey))
    ));
    if (match) return { lat: match.lat, lng: match.lng };
    return countryCoordinates.get(normalizedCountry) || null;
  }

  function optionalNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getClient() {
    if (!supabase) {
      throw new Error('尚未設定 Supabase URL / ANON KEY，請先更新 js/api.js。');
    }
    return supabase;
  }

  function normalizeRecord(data) {
    return {
      country: normalizeCountry(data.country),
      port: data.port,
      dosage_form: normalizeDosageForm(data.dosage_form || data.dosageForm),
      forwarder: data.forwarder || null,
      broker: data.broker || null,
      clearance_result: data.clearance_result || data.clearanceResult,
      clearance_days: Number(data.clearance_days || data.clearanceDays),
      required_documents: data.required_documents || data.requiredDocuments,
      risk_level: data.risk_level || data.riskLevel,
      issue_supplement: Boolean(data.issue_supplement || data.issueSupplement),
      issue_held: Boolean(data.issue_held || data.issueHeld),
      issue_delayed: Boolean(data.issue_delayed || data.issueDelayed),
      issue_note: data.issue_note || data.issueNote || null,
      last_updated: new Date().toISOString()
    };
  }

  function normalizePort(data) {
    return {
      port_name: data.port_name?.trim(),
      country: normalizeCountry(data.country),
      unlocode: data.unlocode?.trim().toUpperCase() || null,
      latitude: optionalNumber(data.latitude),
      longitude: optionalNumber(data.longitude),
      source: data.source?.trim() || null,
      last_updated: new Date().toISOString()
    };
  }

  function normalizeCarrier(data) {
    return {
      carrier_name: data.carrier_name?.trim(),
      carrier_type: data.carrier_type || 'ocean',
      website: data.website?.trim() || null,
      remarks: data.remarks?.trim() || null,
      last_updated: new Date().toISOString()
    };
  }

  function normalizeQuote(data) {
    return {
      route_id: data.route_id || null,
      origin_port: data.origin_port?.trim(),
      destination_port: data.destination_port?.trim(),
      transport_mode: data.transport_mode || 'ocean',
      carrier_id: data.carrier_id || null,
      container_type: data.container_type?.trim() || null,
      chargeable_weight_kg: optionalNumber(data.chargeable_weight_kg),
      amount: Number(data.amount),
      currency: data.currency?.trim().toUpperCase() || 'USD',
      quote_date: data.quote_date || new Date().toISOString().slice(0, 10),
      valid_until: data.valid_until || null,
      source_name: data.source_name?.trim() || null,
      remarks: data.remarks?.trim() || null,
      last_updated: new Date().toISOString()
    };
  }

  function parseRoutePath(value) {
    if (Array.isArray(value)) {
      return value
        .map((point) => Array.isArray(point) ? point : [point.lat, point.lng])
        .filter((point) => point.length === 2 && point.every((item) => Number.isFinite(Number(item))))
        .map((point) => [Number(point[0]), Number(point[1])]);
    }
    if (!value) return [];
    return String(value)
      .split(';')
      .map((part) => part.trim().split(',').map((item) => Number(item.trim())))
      .filter((point) => point.length === 2 && point.every(Number.isFinite));
  }

  function findRouteCoordinateFromPorts(ports, country, port) {
    const normalizedCountry = normalizeCountry(country);
    const portKey = normalizeKey(port);
    const candidates = (ports || []).filter((item) => (
      countryMatches(item.country, normalizedCountry) &&
      (
        normalizeKey(item.port_name) === portKey ||
        normalizeKey(item.unlocode) === portKey ||
        normalizeKey(item.port_name).includes(portKey) ||
        portKey.includes(normalizeKey(item.port_name))
      )
    ));
    // 只接受「真的有座標」的港口；parseFloat(null/'') 會是 NaN，
    // 避免 Number(null)=0 把 (0,0) 當成有效座標的 bug
    for (const match of candidates) {
      const lat = parseFloat(match.latitude);
      const lng = parseFloat(match.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  function normalizeRoute(data, ports = []) {
    const originCountry = normalizeCountry(data.origin_country);
    const destinationCountry = normalizeCountry(data.destination_country);
    const originFallback = findRouteCoordinateFromPorts(ports, originCountry, data.origin_port) || findRouteCoordinate(originCountry, data.origin_port);
    const destinationFallback = findRouteCoordinateFromPorts(ports, destinationCountry, data.destination_port) || findRouteCoordinate(destinationCountry, data.destination_port);
    const originLat = optionalNumber(data.origin_lat) ?? originFallback?.lat ?? null;
    const originLng = optionalNumber(data.origin_lng) ?? originFallback?.lng ?? null;
    const destinationLat = optionalNumber(data.destination_lat) ?? destinationFallback?.lat ?? null;
    const destinationLng = optionalNumber(data.destination_lng) ?? destinationFallback?.lng ?? null;
    const routePath = parseRoutePath(data.route_path);
    const fallbackPath = originLat !== null && originLng !== null && destinationLat !== null && destinationLng !== null
      ? [[originLat, originLng], [destinationLat, destinationLng]]
      : [];
    return {
      route_name: data.route_name?.trim() || `${data.origin_port} → ${data.destination_port}`,
      origin_country: originCountry,
      origin_port: data.origin_port?.trim(),
      origin_lat: originLat,
      origin_lng: originLng,
      destination_country: destinationCountry,
      destination_port: data.destination_port?.trim(),
      destination_lat: destinationLat,
      destination_lng: destinationLng,
      transport_mode: data.transport_mode || 'ocean',
      risk_level: data.risk_level,
      estimated_days: Number(data.estimated_days || 0),
      distance_km: data.distance_km ? Number(data.distance_km) : null,
      chokepoints: data.chokepoints?.trim() || null,
      route_path: routePath.length ? routePath : fallbackPath,
      notes: data.notes?.trim() || null,
      last_updated: new Date().toISOString()
    };
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getCurrentUser() {
    const { data, error } = await getClient().auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const { data, error } = await getClient().auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  async function getUserRole(userId) {
    const { data, error } = await getClient()
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.role || 'user';
  }

  async function getCountries() {
    const { data, error } = await getClient()
      .from('customs_records')
      .select('country')
      .order('country');
    if (error) throw error;
    return [...new Set((data || []).map((row) => normalizeCountry(row.country)).filter(Boolean))].sort();
  }

  async function getPorts(country) {
    const normalized = normalizeCountry(country);
    const { data, error } = await getClient()
      .from('customs_records')
      .select('port')
      .eq('country', normalized)
      .order('port');
    if (error) throw error;
    return [...new Set((data || []).map((row) => row.port).filter(Boolean))];
  }

  async function getAvailableDosageForms({ country, port }) {
    if (!country || !port) return [];
    const { data, error } = await getClient()
      .from('customs_records')
      .select('country, dosage_form')
      .eq('port', port)
      .order('dosage_form');
    if (error) throw error;
    const forms = (data || [])
      .filter((record) => countryMatches(record.country, country))
      .map((record) => normalizeDosageForm(record.dosage_form))
      .filter((form) => dosageValueSet.has(form));
    return [...new Set(forms)].sort((a, b) => displayDosageForm(a).localeCompare(displayDosageForm(b), 'zh-Hant'));
  }

  async function searchCustoms({ country, port, dosageForm }) {
    const { data, error } = await getClient()
      .from('customs_records')
      .select('*')
      .eq('port', port)
      .order('last_updated', { ascending: false });
    if (error) throw error;
    return (data || []).filter((record) => (
      countryMatches(record.country, country) &&
      dosageMatches(record.dosage_form, dosageForm)
    ));
  }

  async function getBrokers(country, port) {
    const { data, error } = await getClient()
      .from('broker_directory')
      .select('*')
      .or(`port.eq.${port},port.is.null`)
      .order('broker_name');
    if (error) throw error;
    return (data || []).filter((broker) => countryMatches(broker.country, country));
  }

  async function addRecord(data) {
    const user = await getCurrentUser();
    const payload = { ...normalizeRecord(data), created_by: user.id };
    const { data: inserted, error } = await getClient()
      .from('customs_records')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async function updateRecord(id, data) {
    const { data: updated, error } = await getClient()
      .from('customs_records')
      .update(normalizeRecord(data))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  async function deleteRecord(id) {
    const { error } = await getClient().from('customs_records').delete().eq('id', id);
    if (error) throw error;
  }

  async function getAllRecords() {
    const { data, error } = await getClient()
      .from('customs_records')
      .select('*')
      .order('last_updated', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getAllPorts() {
    const { data, error } = await getClient()
      .from('ports')
      .select('*')
      .order('country')
      .order('port_name');
    if (error) throw error;
    return data || [];
  }

  // 港口已由 UN/LOCODE 自動同步（上萬筆），查詢一律帶條件與筆數上限
  async function searchPorts({ country = '', keyword = '', limit = 300 } = {}) {
    let query = getClient().from('ports').select('*');
    if (country) query = query.eq('country', normalizeCountry(country));
    if (keyword) query = query.ilike('port_name', `%${keyword.trim()}%`);
    const { data, error } = await query
      .order('country')
      .order('port_name')
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // 港口分頁查詢（港口管理頁用），回傳 { rows, count }
  async function searchPortsPaged({ country = '', keyword = '', page = 1, pageSize = 50 } = {}) {
    let query = getClient().from('ports').select('*', { count: 'exact' });
    if (country) query = query.eq('country', normalizeCountry(country));
    if (keyword) query = query.ilike('port_name', `%${keyword.trim()}%`);
    const from = (Math.max(1, page) - 1) * pageSize;
    const { data, error, count } = await query
      .order('country')
      .order('port_name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return { rows: data || [], count: count ?? 0 };
  }

  // 只抓航線起訖兩國的港口，供座標自動帶入比對用
  async function getPortsForRouteCountries(data) {
    const countries = [...new Set(
      [data.origin_country, data.destination_country].map(normalizeCountry).filter(Boolean)
    )];
    const results = [];
    for (const country of countries) {
      try {
        results.push(...await searchPorts({ country, limit: 1000 }));
      } catch (error) {
        // 忽略單一國家查詢失敗，照常使用內建座標 fallback
      }
    }
    return results;
  }

  async function addPort(data) {
    const { data: inserted, error } = await getClient()
      .from('ports')
      .insert(normalizePort(data))
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async function updatePort(id, data) {
    const { data: updated, error } = await getClient()
      .from('ports')
      .update(normalizePort(data))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  async function deletePort(id) {
    const { error } = await getClient().from('ports').delete().eq('id', id);
    if (error) throw error;
  }

  async function getAllCarriers() {
    const { data, error } = await getClient()
      .from('carriers')
      .select('*')
      .order('carrier_name');
    if (error) throw error;
    return data || [];
  }

  async function addCarrier(data) {
    const { data: inserted, error } = await getClient()
      .from('carriers')
      .insert(normalizeCarrier(data))
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async function updateCarrier(id, data) {
    const { data: updated, error } = await getClient()
      .from('carriers')
      .update(normalizeCarrier(data))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  async function deleteCarrier(id) {
    const { error } = await getClient().from('carriers').delete().eq('id', id);
    if (error) throw error;
  }

  async function getAllRoutes() {
    const { data, error } = await getClient()
      .from('route_intelligence')
      .select('*')
      .order('route_name');
    if (error) throw error;
    return data || [];
  }

  async function getRoutesForCountry(country) {
    const routes = await getAllRoutes();
    return routes.filter((route) => (
      countryMatches(route.origin_country, country) ||
      countryMatches(route.destination_country, country)
    ));
  }

  async function addRoute(data) {
    let ports = [];
    try {
      ports = await getPortsForRouteCountries(data);
    } catch (error) {
      ports = [];
    }
    const payload = normalizeRoute(data, ports);
    const { data: inserted, error } = await getClient()
      .from('route_intelligence')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async function updateRoute(id, data) {
    let ports = [];
    try {
      ports = await getPortsForRouteCountries(data);
    } catch (error) {
      ports = [];
    }
    const { data: updated, error } = await getClient()
      .from('route_intelligence')
      .update(normalizeRoute(data, ports))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  async function deleteRoute(id) {
    const { error } = await getClient().from('route_intelligence').delete().eq('id', id);
    if (error) throw error;
  }

  async function getAllQuotes() {
    const { data, error } = await getClient()
      .from('freight_quotes')
      .select('*')
      .order('quote_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getQuotesForRoute(route) {
    const quotes = await getAllQuotes();
    return quotes.filter((quote) => (
      quote.route_id === route.id ||
      (
        String(quote.origin_port || '').toLowerCase() === String(route.origin_port || '').toLowerCase() &&
        String(quote.destination_port || '').toLowerCase() === String(route.destination_port || '').toLowerCase()
      )
    ));
  }

  async function addQuote(data) {
    const { data: inserted, error } = await getClient()
      .from('freight_quotes')
      .insert(normalizeQuote(data))
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async function updateQuote(id, data) {
    const { data: updated, error } = await getClient()
      .from('freight_quotes')
      .update(normalizeQuote(data))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  async function deleteQuote(id) {
    const { error } = await getClient().from('freight_quotes').delete().eq('id', id);
    if (error) throw error;
  }

  function normalizeBroker(data) {
    return {
      country: normalizeCountry(data.country),
      port: data.port?.trim() || null,
      service_type: data.service_type || data.serviceType || 'broker',
      broker_name: data.broker_name?.trim(),
      contact_info: data.contact_info?.trim() || null,
      remarks: data.remarks?.trim() || null
    };
  }

  function brokerPayloadWithoutServiceType(payload) {
    const { service_type, ...legacyPayload } = payload;
    return legacyPayload;
  }

  function canRetryBrokerWithoutServiceType(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('service_type') || message.includes('schema cache');
  }

  async function getAllBrokers() {
    const { data, error } = await getClient()
      .from('broker_directory')
      .select('*')
      .order('country')
      .order('broker_name');
    if (error) throw error;
    return data || [];
  }

  async function addBroker(data) {
    const payload = normalizeBroker(data);
    const { data: inserted, error } = await getClient()
      .from('broker_directory')
      .insert(payload)
      .select()
      .single();
    if (error && canRetryBrokerWithoutServiceType(error)) {
      const { data: legacyInserted, error: legacyError } = await getClient()
        .from('broker_directory')
        .insert(brokerPayloadWithoutServiceType(payload))
        .select()
        .single();
      if (legacyError) throw legacyError;
      return legacyInserted;
    }
    if (error) throw error;
    return inserted;
  }

  async function updateBroker(id, data) {
    const payload = normalizeBroker(data);
    const { data: updated, error } = await getClient()
      .from('broker_directory')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error && canRetryBrokerWithoutServiceType(error)) {
      const { data: legacyUpdated, error: legacyError } = await getClient()
        .from('broker_directory')
        .update(brokerPayloadWithoutServiceType(payload))
        .eq('id', id)
        .select()
        .single();
      if (legacyError) throw legacyError;
      return legacyUpdated;
    }
    if (error) throw error;
    return updated;
  }

  async function deleteBroker(id) {
    const { error } = await getClient().from('broker_directory').delete().eq('id', id);
    if (error) throw error;
  }

  async function getCountryRiskSummary() {
    const { data, error } = await getClient().from('customs_records').select('country, risk_level');
    if (error) throw error;
    return (data || []).reduce((summary, row) => {
      const country = normalizeCountry(row.country);
      const current = summary[country];
      if (!current || riskRank[row.risk_level] > riskRank[current]) {
        summary[country] = row.risk_level;
      }
      return summary;
    }, {});
  }

  // World Bank LPI 指標（由 sync-trade-indicators Edge Function 定時同步）
  async function getTradeIndicator(country) {
    const { data, error } = await getClient()
      .from('country_trade_indicators')
      .select('*')
      .eq('country', normalizeCountry(country))
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // 航線天氣警示（由 sync-weather Edge Function 定時同步）
  async function getRouteWeatherAlerts() {
    const { data, error } = await getClient()
      .from('route_weather_alerts')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  // 最近同步紀錄（後台監控用）
  async function getSyncLogs(limit = 20) {
    const { data, error } = await getClient()
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function listUserRoleAssignments() {
    const { data, error } = await getClient().rpc('list_user_role_assignments');
    if (error) throw error;
    return data || [];
  }

  async function assignUserRoleByEmail(email, role) {
    const { data, error } = await getClient().rpc('assign_user_role_by_email', {
      target_email: email,
      target_role: role
    });
    if (error) throw error;
    return data?.[0] || null;
  }

  async function deleteUserByEmail(email) {
    const { data, error } = await getClient().rpc('delete_user_by_email', {
      target_email: String(email || '').trim().toLowerCase()
    });
    if (error) throw error;
    return data?.[0] || null;
  }

  async function isCurrentUserAdmin() {
    const { data, error } = await getClient().rpc('is_current_user_admin');
    if (error) throw error;
    return Boolean(data);
  }

  function canUseSignUpFallback(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.name === 'FunctionsFetchError' ||
      message.includes('edge function') ||
      message.includes('failed to send') ||
      message.includes('未能向 edge 函式發送請求')
    );
  }

  async function createUserWithSignUpFallback(email, password, role, originalError) {
    if (!(await isCurrentUserAdmin())) {
      throw originalError;
    }

    const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `tci-create-user-${Date.now()}`
      }
    });

    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email,
      password
    });
    if (signUpError) throw signUpError;

    await assignUserRoleByEmail(email, role);

    return {
      user_id: signUpData.user?.id || null,
      email,
      role,
      fallback: true
    };
  }

  async function createUserAccount(email, password, role) {
    const payload = {
      email: String(email || '').trim().toLowerCase(),
      password,
      role
    };

    const { data, error } = await getClient().functions.invoke('create-user', {
      body: payload
    });
    if (error) {
      if (canUseSignUpFallback(error)) {
        return createUserWithSignUpFallback(payload.email, payload.password, payload.role, error);
      }
      throw error;
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function resetUserPasswordByEmail(email, password) {
    const payload = {
      action: 'reset-password',
      email: String(email || '').trim().toLowerCase(),
      password
    };

    const { data, error } = await getClient().functions.invoke('create-user', {
      body: payload
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  window.TCIApi = {
    dosageForms,
    countryAliases,
    normalizeCountry,
    displayCountry,
    countryMatches,
    normalizeDosageForm,
    displayDosageForm,
    dosageMatches,
    getClient,
    getSession,
    getCurrentUser,
    signIn,
    signUp,
    signOut,
    updatePassword,
    getUserRole,
    getCountries,
    getPorts,
    getAvailableDosageForms,
    searchCustoms,
    getBrokers,
    addRecord,
    updateRecord,
    deleteRecord,
    getAllRecords,
    getAllPorts,
    searchPorts,
    searchPortsPaged,
    addPort,
    updatePort,
    deletePort,
    getAllCarriers,
    addCarrier,
    updateCarrier,
    deleteCarrier,
    getAllRoutes,
    getRoutesForCountry,
    addRoute,
    updateRoute,
    deleteRoute,
    getAllQuotes,
    getQuotesForRoute,
    addQuote,
    updateQuote,
    deleteQuote,
    getCountryRiskSummary,
    getTradeIndicator,
    getRouteWeatherAlerts,
    getSyncLogs,
    listUserRoleAssignments,
    isCurrentUserAdmin,
    assignUserRoleByEmail,
    deleteUserByEmail,
    createUserAccount,
    resetUserPasswordByEmail,
    findRouteCoordinate,
    countryCoordinates,
    getAllBrokers,
    addBroker,
    updateBroker,
    deleteBroker
  };
})();

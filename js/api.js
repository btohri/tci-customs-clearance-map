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
    { value: 'Capsule', zh: '膠囊', en: 'Capsule', aliases: ['膠囊', '胶囊'] },
    { value: 'Tablet', zh: '錠劑', en: 'Tablet', aliases: ['錠劑', '锭剂', '片劑', '片剂'] },
    { value: 'Powder', zh: '粉劑', en: 'Powder', aliases: ['粉劑', '粉剂', '粉末'] },
    { value: 'Gummy', zh: '軟糖', en: 'Gummy', aliases: ['軟糖', '软糖'] },
    { value: 'Liquid', zh: '液體', en: 'Liquid', aliases: ['液體', '液体'] },
    { value: 'Softgel', zh: '軟膠囊', en: 'Softgel', aliases: ['軟膠囊', '软胶囊', '軟膠', '软胶'] },
    { value: 'Mask', zh: '面膜', en: 'Mask', aliases: ['面膜', 'Facial Mask', 'Sheet Mask'] },
    { value: 'Others', zh: '其他', en: 'Others', aliases: ['其他', 'Other'] }
  ];
  const dosageAliasMap = dosageForms.reduce((map, form) => {
    [form.value, form.en, form.zh, ...form.aliases].forEach((alias) => {
      map.set(normalizeKey(alias), form);
    });
    return map;
  }, new Map());
  const riskRank = { green: 1, yellow: 2, red: 3 };

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
    return form ? `${form.zh} ${form.en}` : String(value || '').trim();
  }

  function dosageMatches(recordForm, queryForm) {
    return normalizeDosageForm(recordForm) === normalizeDosageForm(queryForm);
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
    const { data, error } = await getClient()
      .from('customs_records')
      .select('country, port')
      .order('port');
    if (error) throw error;
    return [...new Set((data || [])
      .filter((row) => countryMatches(row.country, country))
      .map((row) => row.port)
      .filter(Boolean))];
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
    signOut,
    updatePassword,
    getUserRole,
    getCountries,
    getPorts,
    searchCustoms,
    getBrokers,
    addRecord,
    updateRecord,
    deleteRecord,
    getAllRecords,
    getCountryRiskSummary,
    listUserRoleAssignments,
    isCurrentUserAdmin,
    assignUserRoleByEmail,
    createUserAccount
  };
})();

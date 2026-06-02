(function () {
  'use strict';

  // 請替換為 Supabase 專案資訊；anon key 可公開，但資料安全需依賴 RLS。
  const SUPABASE_URL = 'https://toszpweohhuuffzbxfix.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Y7QsQ--UlQw6j1SNBmdZAw_8x2e7hdk';

  const hasConfig = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
  const supabase = hasConfig && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const dosageForms = ['Capsule', 'Tablet', 'Powder', 'Gummy', 'Liquid', 'Softgel', 'Others'];
  const riskRank = { green: 1, yellow: 2, red: 3 };

  function getClient() {
    if (!supabase) {
      throw new Error('尚未設定 Supabase URL / ANON KEY，請先更新 js/api.js。');
    }
    return supabase;
  }

  function normalizeRecord(data) {
    return {
      country: data.country,
      port: data.port,
      dosage_form: data.dosage_form || data.dosageForm,
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
    return [...new Set((data || []).map((row) => row.country).filter(Boolean))];
  }

  async function getPorts(country) {
    const { data, error } = await getClient()
      .from('customs_records')
      .select('port')
      .eq('country', country)
      .order('port');
    if (error) throw error;
    return [...new Set((data || []).map((row) => row.port).filter(Boolean))];
  }

  async function searchCustoms({ country, port, dosageForm }) {
    const { data, error } = await getClient()
      .from('customs_records')
      .select('*')
      .eq('country', country)
      .eq('port', port)
      .eq('dosage_form', dosageForm)
      .order('last_updated', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getBrokers(country, port) {
    const { data, error } = await getClient()
      .from('broker_directory')
      .select('*')
      .eq('country', country)
      .or(`port.eq.${port},port.is.null`)
      .order('broker_name');
    if (error) throw error;
    return data || [];
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
      const current = summary[row.country];
      if (!current || riskRank[row.risk_level] > riskRank[current]) {
        summary[row.country] = row.risk_level;
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

  async function createUserAccount(email, password, role) {
    const { data, error } = await getClient().functions.invoke('create-user', {
      body: { email, password, role }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  window.TCIApi = {
    dosageForms,
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
    assignUserRoleByEmail,
    createUserAccount
  };
})();

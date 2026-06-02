(function () {
  'use strict';

  let records = [];
  let roleAssignments = [];

  const labels = {
    success: '成功',
    delayed: '延遲',
    held: '扣關',
    rejected: '退運',
    green: 'Green',
    yellow: 'Yellow',
    red: 'Red'
  };

  function field(id) {
    return document.getElementById(id);
  }

  function message(text, type = '') {
    const element = field('adminMessage');
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function roleMessage(text, type = '') {
    const element = field('roleMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function createUserMessage(text, type = '') {
    const element = field('createUserMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function getFormData() {
    return {
      country: window.TCIApi.normalizeCountry(field('countryInput').value),
      port: field('portInput').value.trim(),
      dosage_form: window.TCIApi.normalizeDosageForm(field('dosageFormInput').value),
      clearance_result: field('clearanceResultInput').value,
      clearance_days: Number(field('clearanceDaysInput').value),
      required_documents: field('requiredDocumentsInput').value.trim(),
      risk_level: field('riskLevelInput').value,
      broker: field('brokerInput').value.trim(),
      issue_supplement: field('issueSupplementInput').checked,
      issue_held: field('issueHeldInput').checked,
      issue_delayed: field('issueDelayedInput').checked,
      issue_note: field('issueNoteInput').value.trim()
    };
  }

  function setFormData(record) {
    field('recordId').value = record.id || '';
    field('countryInput').value = window.TCIApi.displayCountry(record.country || '');
    field('portInput').value = record.port || '';
    field('dosageFormInput').value = window.TCIApi.normalizeDosageForm(record.dosage_form || '');
    field('clearanceResultInput').value = record.clearance_result || '';
    field('clearanceDaysInput').value = record.clearance_days || '';
    field('requiredDocumentsInput').value = record.required_documents || '';
    field('riskLevelInput').value = record.risk_level || '';
    field('brokerInput').value = record.broker || '';
    field('issueSupplementInput').checked = Boolean(record.issue_supplement);
    field('issueHeldInput').checked = Boolean(record.issue_held);
    field('issueDelayedInput').checked = Boolean(record.issue_delayed);
    field('issueNoteInput').value = record.issue_note || '';
    field('submitButton').textContent = record.id ? '儲存修改' : '新增紀錄';
    field('cancelEditButton').hidden = !record.id;
  }

  function resetForm() {
    field('recordForm').reset();
    setFormData({});
  }

  function validate(data) {
    const required = ['country', 'port', 'dosage_form', 'clearance_result', 'required_documents', 'risk_level'];
    if (required.some((key) => !data[key]) || Number.isNaN(data.clearance_days)) {
      throw new Error('請填寫所有必填欄位。');
    }
  }

  function renderDatalists() {
    const countries = [...new Set(records.map((record) => window.TCIApi.normalizeCountry(record.country)).filter(Boolean))].sort();
    const ports = [...new Set(records.map((record) => record.port).filter(Boolean))].sort();
    const countryOptions = countries.flatMap((country) => [
      window.TCIApi.displayCountry(country),
      window.TCIApi.normalizeCountry(country)
    ]);
    field('countryList').innerHTML = [...new Set(countryOptions)]
      .map((country) => `<option value="${window.TCISearch.escapeHtml(country)}"></option>`)
      .join('');
    field('portList').innerHTML = ports.map((port) => `<option value="${window.TCISearch.escapeHtml(port)}"></option>`).join('');
    field('adminCountryFilter').innerHTML = '<option value="">全部國家</option>' + countries
      .map((country) => `<option value="${window.TCISearch.escapeHtml(country)}">${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</option>`)
      .join('');
  }

  function renderTable() {
    const filter = field('adminCountryFilter').value;
    const rows = records.filter((record) => !filter || window.TCIApi.countryMatches(record.country, filter));
    field('recordsTableBody').innerHTML = rows.map((record) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(record.country))}</td>
        <td>${window.TCISearch.escapeHtml(record.port)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayDosageForm(record.dosage_form))}</td>
        <td>${window.TCISearch.escapeHtml(labels[record.clearance_result] || record.clearance_result)}</td>
        <td>${window.TCISearch.escapeHtml(record.clearance_days)}</td>
        <td>${window.TCISearch.escapeHtml(labels[record.risk_level] || record.risk_level)}</td>
        <td>${window.TCISearch.escapeHtml(record.required_documents)}</td>
        <td>
          <div class="action-row">
            <button class="button ghost edit-button" type="button" data-id="${record.id}">編輯</button>
            <button class="button danger delete-button" type="button" data-id="${record.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const record = records.find((item) => item.id === button.dataset.id);
        if (record) setFormData(record);
        scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    document.querySelectorAll('.delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆通關紀錄？')) return;
        try {
          await window.TCIApi.deleteRecord(button.dataset.id);
          message('刪除成功。', 'success');
          await loadRecords();
        } catch (error) {
          message(error.message, 'error');
        }
      });
    });
  }

  async function loadRecords() {
    records = await window.TCIApi.getAllRecords();
    renderDatalists();
    renderTable();
  }

  function renderRolesTable() {
    field('rolesTableBody').innerHTML = roleAssignments.map((item) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(item.email)}</td>
        <td>${window.TCISearch.escapeHtml(item.role)}</td>
        <td>${window.TCISearch.escapeHtml(item.user_id)}</td>
        <td>${window.TCISearch.escapeHtml((item.created_at || '').slice(0, 10))}</td>
      </tr>
    `).join('');
  }

  function renderRoleSelect() {
    const select = field('roleEmailInput');
    if (!select) return;
    const selectedEmail = select.value;
    select.innerHTML = '<option value="">請選擇使用者</option>' + roleAssignments.map((item) => `
      <option value="${window.TCISearch.escapeHtml(item.email)}" data-role="${window.TCISearch.escapeHtml(item.role)}">
        ${window.TCISearch.escapeHtml(item.email)}｜${window.TCISearch.escapeHtml(item.role)}
      </option>
    `).join('');
    if (roleAssignments.some((item) => item.email === selectedEmail)) {
      select.value = selectedEmail;
    }
  }

  function syncSelectedUserRole() {
    const email = field('roleEmailInput')?.value;
    const selected = roleAssignments.find((item) => item.email === email);
    if (selected) {
      field('roleSelect').value = selected.role;
    }
  }

  async function loadRoleAssignments() {
    roleAssignments = await window.TCIApi.listUserRoleAssignments();
    renderRoleSelect();
    syncSelectedUserRole();
    renderRolesTable();
  }

  function bindRoleForm() {
    field('createUserForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = field('newUserEmailInput').value.trim();
      const password = field('newUserPasswordInput').value;
      const role = field('newUserRoleSelect').value;
      try {
        createUserMessage('建立中...');
        const created = await window.TCIApi.createUserAccount(email, password, role);
        createUserMessage(created?.fallback
          ? '帳號已建立，角色已完成指派。若帳號尚未驗證，請使用者依信件完成驗證。'
          : '帳號已建立，角色已完成指派。', 'success');
        field('createUserForm').reset();
        await loadRoleAssignments();
      } catch (error) {
        createUserMessage(error.message, 'error');
      }
    });

    field('roleForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = field('roleEmailInput').value;
      const role = field('roleSelect').value;
      if (!email) {
        roleMessage('請先選擇使用者。', 'error');
        return;
      }
      try {
        roleMessage('儲存中...');
        await window.TCIApi.assignUserRoleByEmail(email, role);
        roleMessage('角色已更新。', 'success');
        await loadRoleAssignments();
      } catch (error) {
        roleMessage(error.message, 'error');
      }
    });

    field('roleEmailInput')?.addEventListener('change', syncSelectedUserRole);

    field('deleteUserButton')?.addEventListener('click', async () => {
      const email = field('roleEmailInput').value;
      if (!email) {
        roleMessage('請先選擇使用者。', 'error');
        return;
      }
      if (!confirm(`確定要刪除 ${email}？此動作會移除登入帳號與角色設定。`)) return;
      try {
        field('deleteUserButton').disabled = true;
        roleMessage('刪除中...');
        await window.TCIApi.deleteUserByEmail(email);
        roleMessage('帳號已刪除。', 'success');
        field('roleForm').reset();
        await loadRoleAssignments();
      } catch (error) {
        roleMessage(error.message, 'error');
      } finally {
        field('deleteUserButton').disabled = false;
      }
    });
  }

  function bindForm() {
    field('recordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getFormData();
        validate(data);
        const id = field('recordId').value;
        field('submitButton').disabled = true;
        if (id) {
          await window.TCIApi.updateRecord(id, data);
          message('修改成功。', 'success');
        } else {
          await window.TCIApi.addRecord(data);
          message('新增成功。', 'success');
        }
        resetForm();
        await loadRecords();
      } catch (error) {
        message(error.message, 'error');
      } finally {
        field('submitButton').disabled = false;
      }
    });

    field('cancelEditButton').addEventListener('click', resetForm);
    field('adminCountryFilter').addEventListener('change', renderTable);
  }

  async function initAdmin() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    window.TCISearch.fillDosageForms(field('dosageFormInput'));
    bindForm();
    await loadRecords();
    if (auth.role === 'admin') {
      field('roleManagementSection').hidden = false;
      bindRoleForm();
      try {
        await loadRoleAssignments();
      } catch (error) {
        roleMessage(`角色管理尚未啟用：${error.message}`, 'error');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'admin') {
      initAdmin().catch((error) => message(error.message, 'error'));
    }
  });
})();

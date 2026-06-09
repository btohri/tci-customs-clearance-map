(function () {
  'use strict';

  let records = [];

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

  function historyMessage(text, type = '') {
    const element = field('historyMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function renderFilter() {
    const countries = [...new Set(records.map((record) => window.TCIApi.normalizeCountry(record.country)).filter(Boolean))].sort();
    const selected = field('adminCountryFilter').value;
    field('adminCountryFilter').innerHTML = '<option value="">全部國家</option>' + countries
      .map((country) => `<option value="${window.TCISearch.escapeHtml(country)}">${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</option>`)
      .join('');
    if (countries.includes(selected)) field('adminCountryFilter').value = selected;
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
        <td>${window.TCISearch.escapeHtml((record.last_updated || record.created_at || '').slice(0, 10))}</td>
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
        sessionStorage.setItem('tciEditRecordId', button.dataset.id);
        location.href = 'index.html';
      });
    });

    document.querySelectorAll('.delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆通關紀錄？')) return;
        try {
          await window.TCIApi.deleteRecord(button.dataset.id);
          historyMessage('刪除成功。', 'success');
          await loadRecords();
        } catch (error) {
          historyMessage(error.message, 'error');
        }
      });
    });
  }

  async function loadRecords() {
    records = await window.TCIApi.getAllRecords();
    renderFilter();
    renderTable();
  }

  async function initHistory() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    field('adminCountryFilter').addEventListener('change', renderTable);
    await loadRecords();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'history') {
      initHistory().catch((error) => historyMessage(error.message, 'error'));
    }
  });
})();

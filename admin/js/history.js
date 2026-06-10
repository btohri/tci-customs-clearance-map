(function () {
  'use strict';

  const PAGE_SIZE = 20;
  let records = [];
  let currentPage = 1;

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

  function renderFilters() {
    const countries = [...new Set(records.map((record) => window.TCIApi.normalizeCountry(record.country)).filter(Boolean))].sort();
    const selectedCountry = field('adminCountryFilter').value;
    field('adminCountryFilter').innerHTML = '<option value="">全部國家</option>' + countries
      .map((country) => `<option value="${window.TCISearch.escapeHtml(country)}">${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</option>`)
      .join('');
    if (countries.includes(selectedCountry)) field('adminCountryFilter').value = selectedCountry;

    const selectedDosage = field('adminDosageFilter').value;
    window.TCISearch.fillDosageForms(field('adminDosageFilter'));
    // restore "全部劑型" as first option after fillDosageForms
    field('adminDosageFilter').insertAdjacentHTML('afterbegin', '<option value="">全部劑型</option>');
    field('adminDosageFilter').value = selectedDosage;
  }

  const resultTone = { success: 'green', delayed: 'yellow', held: 'red', rejected: 'red' };

  function badge(text, tone) {
    return `<span class="cell-badge badge-${tone || 'neutral'}">${window.TCISearch.escapeHtml(text)}</span>`;
  }

  function getFiltered() {
    const countryFilter = field('adminCountryFilter').value;
    const dosageFilter = field('adminDosageFilter')?.value || '';
    return records.filter((record) => (
      (!countryFilter || window.TCIApi.countryMatches(record.country, countryFilter)) &&
      (!dosageFilter || window.TCIApi.dosageMatches(record.dosage_form, dosageFilter))
    ));
  }

  function renderPagination(total, totalPages) {
    const el = field('historyPagination');
    if (!el) return;
    if (totalPages <= 1) {
      el.innerHTML = `<p class="hint" style="text-align:center;padding:0.75rem 0">共 ${total} 筆</p>`;
      return;
    }
    el.innerHTML = `
      <div class="pagination">
        <button class="button ghost" id="prevPageBtn" ${currentPage <= 1 ? 'disabled' : ''}>← 上一頁</button>
        <span class="page-info">第 ${currentPage} / ${totalPages} 頁（共 ${total} 筆）</span>
        <button class="button ghost" id="nextPageBtn" ${currentPage >= totalPages ? 'disabled' : ''}>下一頁 →</button>
      </div>
    `;
    field('prevPageBtn')?.addEventListener('click', () => { currentPage--; renderTable(); });
    field('nextPageBtn')?.addEventListener('click', () => { currentPage++; renderTable(); });
  }

  function renderTable() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRecords = filtered.slice(start, start + PAGE_SIZE);

    field('recordsTableBody').innerHTML = pageRecords.map((record) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(record.country))}</td>
        <td>${window.TCISearch.escapeHtml(record.port)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayDosageForm(record.dosage_form))}</td>
        <td>${badge(labels[record.clearance_result] || record.clearance_result, resultTone[record.clearance_result])}</td>
        <td>${window.TCISearch.escapeHtml(record.clearance_days)}</td>
        <td>${badge(labels[record.risk_level] || record.risk_level, record.risk_level)}</td>
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

    renderPagination(filtered.length, totalPages);
  }

  async function loadRecords() {
    records = await window.TCIApi.getAllRecords();
    currentPage = 1;
    renderFilters();
    renderTable();
  }

  async function initHistory() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    field('adminCountryFilter').addEventListener('change', () => { currentPage = 1; renderTable(); });
    field('adminDosageFilter')?.addEventListener('change', () => { currentPage = 1; renderTable(); });
    await loadRecords();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'history') {
      initHistory().catch((error) => historyMessage(error.message, 'error'));
    }
  });
})();

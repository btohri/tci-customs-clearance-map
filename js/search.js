(function () {
  'use strict';

  const resultLabels = {
    success: '成功',
    delayed: '延遲',
    held: '扣關',
    rejected: '退運'
  };

  function splitDocuments(value) {
    return (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getHighestRisk(records) {
    if (!records.length) return null;
    if (records.some((record) => record.risk_level === 'red')) return 'red';
    if (records.some((record) => record.risk_level === 'yellow')) return 'yellow';
    return 'green';
  }

  function riskText(risk) {
    return {
      green: 'Green',
      yellow: 'Yellow',
      red: 'Red'
    }[risk] || '尚無資料';
  }

  function riskIcon(risk) {
    return {
      green: '🟢',
      yellow: '🟡',
      red: '🔴'
    }[risk] || '—';
  }

  function calculateStats(records) {
    const total = records.length;
    const avgDays = total
      ? Math.round(records.reduce((sum, record) => sum + Number(record.clearance_days || 0), 0) / total)
      : 0;
    const successCount = records.filter((record) => record.clearance_result === 'success').length;
    const successRate = total ? Math.round((successCount / total) * 100) : 0;
    return { total, avgDays, successRate };
  }

  async function renderSearchResult(target, records, context = {}) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;

    if (!records.length) {
      element.innerHTML = '<div class="empty-state"><strong>尚無資料</strong><span>可由 Shipping Team 至後台新增通關紀錄。</span></div>';
      return;
    }

    const risk = getHighestRisk(records);
    const stats = calculateStats(records);
    const documents = [...new Set(records.flatMap((record) => splitDocuments(record.required_documents)))];
    const issueTags = [
      records.some((record) => record.issue_supplement) ? '<span class="tag supplement">曾補件</span>' : '',
      records.some((record) => record.issue_held) ? '<span class="tag held">曾扣關</span>' : '',
      records.some((record) => record.issue_delayed) ? '<span class="tag delayed">曾延遲</span>' : ''
    ].join('');
    let brokers = [];
    try {
      brokers = await window.TCIApi.getBrokers(context.country || records[0].country, context.port || records[0].port);
    } catch (error) {
      brokers = [];
    }
    const brokerText = brokers.length
      ? brokers.map((broker) => broker.broker_name).join('、')
      : [...new Set(records.map((record) => record.broker).filter(Boolean))].join('、') || '尚無建議 Broker';
    const notes = [...new Set(records.map((record) => record.issue_note).filter(Boolean))];
    const forwarders = [...new Set(records.map((record) => record.forwarder).filter(Boolean))];

    element.innerHTML = `
      <div class="risk-line">
        <div>
          <p class="eyebrow">${escapeHtml(window.TCIApi.displayCountry(context.country || records[0].country))} / ${escapeHtml(context.port || records[0].port)} / ${escapeHtml(window.TCIApi.displayDosageForm(context.dosageForm || records[0].dosage_form))}</p>
          <h2>${riskIcon(risk)} ${riskText(risk)}</h2>
        </div>
        <span class="risk-badge risk-${risk}">${riskText(risk)}</span>
      </div>
      <div class="stat-grid">
        <div class="stat"><span>歷史出貨</span><strong>${stats.total}</strong></div>
        <div class="stat"><span>平均通關</span><strong>${stats.avgDays} 天</strong></div>
        <div class="stat"><span>成功率</span><strong>${stats.successRate}%</strong></div>
      </div>
      <h3>所需文件</h3>
      <div class="tag-list">${documents.map((doc) => `<span class="tag">${escapeHtml(doc)}</span>`).join('') || '<span class="tag">尚無文件資料</span>'}</div>
      <h3>建議 Broker</h3>
      <p>${escapeHtml(brokerText)}</p>
      ${forwarders.length ? `<h3>貨代 Forwarder</h3><p>${escapeHtml(forwarders.join('、'))}</p>` : ''}
      <h3>異常紀錄</h3>
      <div class="tag-list">${issueTags || '<span class="tag">無重大異常</span>'}</div>
      <h3>備註</h3>
      ${notes.length ? notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('') : '<p>尚無備註</p>'}
      <h3>歷史紀錄</h3>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>結果</th>
              <th>天數</th>
              <th>風險</th>
              <th>文件</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr>
                <td>${escapeHtml((record.last_updated || record.created_at || '').slice(0, 10))}</td>
                <td>${escapeHtml(resultLabels[record.clearance_result] || record.clearance_result)}</td>
                <td>${escapeHtml(record.clearance_days)} 天</td>
                <td>${escapeHtml(riskText(record.risk_level))}</td>
                <td>${escapeHtml(record.required_documents)}</td>
                <td>${escapeHtml(record.issue_note || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function fillDosageForms(select) {
    if (!select) return;
    select.innerHTML = '<option value="">請選擇劑型</option>' + window.TCIApi.dosageForms
      .map((form) => `<option value="${escapeHtml(form.value)}">${escapeHtml(window.TCIApi.displayDosageForm(form.value))}</option>`)
      .join('');
  }

  async function fillCountries() {
    const select = document.getElementById('countrySelect');
    if (!select) return;
    const countries = await window.TCIApi.getCountries();
    select.innerHTML = '<option value="">請選擇國家</option>' + countries
      .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(window.TCIApi.displayCountry(country))}</option>`)
      .join('');
  }

  async function fillPorts(country) {
    const select = document.getElementById('portSelect');
    if (!select) return;
    if (!country) {
      select.disabled = true;
      select.innerHTML = '<option value="">請先選擇國家</option>';
      return;
    }
    const ports = await window.TCIApi.getPorts(country);
    select.disabled = false;
    select.innerHTML = '<option value="">請選擇口岸</option>' + ports
      .map((port) => `<option value="${escapeHtml(port)}">${escapeHtml(port)}</option>`)
      .join('');
  }

  function bindTabs() {
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        buttons.forEach((item) => {
          item.classList.toggle('active', item === button);
          item.setAttribute('aria-selected', String(item === button));
        });
        document.getElementById('mapView').hidden = view !== 'map';
        document.getElementById('listView').hidden = view !== 'list';
        document.getElementById('mapView').classList.toggle('active', view === 'map');
        document.getElementById('listView').classList.toggle('active', view === 'list');
        if (view === 'map' && window.TCIMap?.invalidateSize) {
          setTimeout(window.TCIMap.invalidateSize, 80);
        }
      });
    });
  }

  async function initSearchPage() {
    await window.TCIAuth.requireAuth();
    bindTabs();
    fillDosageForms(document.getElementById('dosageFormSelect'));
    await fillCountries();

    document.getElementById('countrySelect')?.addEventListener('change', (event) => {
      fillPorts(event.target.value);
    });

    document.getElementById('searchForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const country = document.getElementById('countrySelect').value;
      const port = document.getElementById('portSelect').value;
      const dosageForm = document.getElementById('dosageFormSelect').value;
      const panel = document.getElementById('resultPanel');
      panel.innerHTML = '<div class="empty-state"><strong>查詢中...</strong></div>';
      try {
        const records = await window.TCIApi.searchCustoms({ country, port, dosageForm });
        await renderSearchResult(panel, records, { country, port, dosageForm });
      } catch (error) {
        panel.innerHTML = `<div class="empty-state"><strong>查詢失敗</strong><span>${escapeHtml(error.message)}</span></div>`;
      }
    });
  }

  window.TCISearch = {
    splitDocuments,
    escapeHtml,
    getHighestRisk,
    riskText,
    riskIcon,
    renderSearchResult,
    fillDosageForms
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'search') {
      initSearchPage();
    }
  });
})();

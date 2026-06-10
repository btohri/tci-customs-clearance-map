(function () {
  'use strict';

  const PAGE_SIZE = 20;
  let records = [];
  let routes = [];
  let ports = [];
  let currentPage = 1;

  const labels = {
    success: '成功',
    delayed: '延遲',
    held: '扣關',
    rejected: '退運',
    green: 'Green',
    yellow: 'Yellow',
    red: 'Red',
    ocean: '海運',
    air: '空運',
    multimodal: '複合運輸'
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

  function routeMessage(text, type = '') {
    const element = field('routeMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function optionalNumber(id) {
    return field(id).value === '' ? null : Number(field(id).value);
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

  function renderDatalists() {
    const countries = [
      ...records.map((record) => window.TCIApi.normalizeCountry(record.country)),
      ...ports.map((port) => window.TCIApi.normalizeCountry(port.country))
    ].filter(Boolean).sort();
    const countryOptions = [...new Set(countries.flatMap((country) => [
      window.TCIApi.displayCountry(country),
      window.TCIApi.normalizeCountry(country)
    ]))];
    field('countryList').innerHTML = countryOptions
      .map((country) => `<option value="${window.TCISearch.escapeHtml(country)}"></option>`)
      .join('');

    field('logisticsPortList').innerHTML = ports.map((port) => `
      <option value="${window.TCISearch.escapeHtml(port.port_name)}">
        ${window.TCISearch.escapeHtml(`${window.TCIApi.displayCountry(port.country)} ${port.unlocode || ''}`)}
      </option>
    `).join('');
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

    renderPagination(filtered.length, totalPages);
  }

  async function loadRecords() {
    records = await window.TCIApi.getAllRecords();
    currentPage = 1;
    renderFilters();
    renderDatalists();
    renderTable();
  }

  async function loadPorts() {
    try {
      ports = await window.TCIApi.getAllPorts();
      renderDatalists();
    } catch (error) {
      ports = [];
      renderDatalists();
      routeMessage(`港口資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function getRouteFormData() {
    return {
      route_name: field('routeNameInput').value.trim(),
      origin_country: window.TCIApi.normalizeCountry(field('originCountryInput').value),
      origin_port: field('originPortInput').value.trim(),
      origin_lat: optionalNumber('originLatInput'),
      origin_lng: optionalNumber('originLngInput'),
      destination_country: window.TCIApi.normalizeCountry(field('destinationCountryInput').value),
      destination_port: field('destinationPortInput').value.trim(),
      destination_lat: optionalNumber('destinationLatInput'),
      destination_lng: optionalNumber('destinationLngInput'),
      transport_mode: field('transportModeInput').value,
      risk_level: field('routeRiskInput').value,
      estimated_days: Number(field('routeDaysInput').value),
      distance_km: field('routeDistanceInput').value ? Number(field('routeDistanceInput').value) : null,
      chokepoints: field('chokepointsInput').value.trim(),
      route_path: field('routePathInput').value.trim(),
      notes: field('routeNotesInput').value.trim()
    };
  }

  function routePathToText(routePath) {
    if (!Array.isArray(routePath)) return '';
    return routePath
      .map((point) => Array.isArray(point) ? point : [point.lat, point.lng])
      .filter((point) => point.length === 2)
      .map((point) => `${point[0]},${point[1]}`)
      .join('; ');
  }

  function setRouteFormData(route) {
    field('routeId').value = route.id || '';
    field('routeNameInput').value = route.route_name || '';
    field('originCountryInput').value = route.origin_country ? window.TCIApi.displayCountry(route.origin_country) : '';
    field('originPortInput').value = route.origin_port || '';
    field('originLatInput').value = route.origin_lat ?? '';
    field('originLngInput').value = route.origin_lng ?? '';
    field('destinationCountryInput').value = route.destination_country ? window.TCIApi.displayCountry(route.destination_country) : '';
    field('destinationPortInput').value = route.destination_port || '';
    field('destinationLatInput').value = route.destination_lat ?? '';
    field('destinationLngInput').value = route.destination_lng ?? '';
    field('transportModeInput').value = route.transport_mode || 'ocean';
    field('routeRiskInput').value = route.risk_level || 'green';
    field('routeDaysInput').value = route.estimated_days ?? '';
    field('routeDistanceInput').value = route.distance_km ?? '';
    field('chokepointsInput').value = route.chokepoints || '';
    field('routePathInput').value = routePathToText(route.route_path);
    field('routeNotesInput').value = route.notes || '';
    field('routeSubmitButton').textContent = route.id ? '儲存航線' : '新增航線';
    field('routeCancelEditButton').hidden = !route.id;
  }

  function resetRouteForm() {
    field('routeForm').reset();
    setRouteFormData({});
  }

  function validateRoute(data) {
    const required = [
      'origin_country',
      'origin_port',
      'destination_country',
      'destination_port',
      'transport_mode',
      'risk_level'
    ];
    if (required.some((key) => !data[key]) || !Number.isFinite(data.estimated_days)) {
      throw new Error('請填寫航線必填欄位。');
    }
  }

  function renderRoutesTable() {
    const body = field('routesTableBody');
    if (!body) return;
    body.innerHTML = routes.map((route) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(route.route_name)}</td>
        <td>${window.TCISearch.escapeHtml(labels[route.transport_mode] || route.transport_mode)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(route.origin_country))}<br>${window.TCISearch.escapeHtml(route.origin_port)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(route.destination_country))}<br>${window.TCISearch.escapeHtml(route.destination_port)}</td>
        <td>${window.TCISearch.escapeHtml(route.estimated_days || '--')}</td>
        <td>${window.TCISearch.escapeHtml(labels[route.risk_level] || route.risk_level)}</td>
        <td>
          <div class="action-row">
            <button class="button ghost route-edit-button" type="button" data-id="${route.id}">編輯</button>
            <button class="button danger route-delete-button" type="button" data-id="${route.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.route-edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const route = routes.find((item) => item.id === button.dataset.id);
        if (route) setRouteFormData(route);
        field('routeManagementPanel').open = true;
      });
    });

    document.querySelectorAll('.route-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆航線情報？')) return;
        try {
          await window.TCIApi.deleteRoute(button.dataset.id);
          routeMessage('航線已刪除。', 'success');
          await loadRoutes();
        } catch (error) {
          routeMessage(error.message, 'error');
        }
      });
    });
  }

  async function loadRoutes() {
    try {
      routes = await window.TCIApi.getAllRoutes();
      renderRoutesTable();
    } catch (error) {
      routes = [];
      renderRoutesTable();
      routeMessage(`航線資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function bindRouteForm() {
    field('routeForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getRouteFormData();
        validateRoute(data);
        const id = field('routeId').value;
        field('routeSubmitButton').disabled = true;
        if (id) {
          await window.TCIApi.updateRoute(id, data);
          routeMessage('航線已更新。', 'success');
        } else {
          await window.TCIApi.addRoute(data);
          routeMessage('航線已新增。', 'success');
        }
        resetRouteForm();
        await loadRoutes();
      } catch (error) {
        routeMessage(error.message, 'error');
      } finally {
        field('routeSubmitButton').disabled = false;
      }
    });

    field('routeCancelEditButton')?.addEventListener('click', resetRouteForm);
  }

  function bindCollapsiblePanels() {
    const panels = document.querySelectorAll('.collapsible-card');
    panels.forEach((panel) => {
      panel.addEventListener('toggle', () => {
        if (!panel.open) return;
        panels.forEach((other) => {
          if (other !== panel) other.open = false;
        });
      });
    });
  }

  async function initHistory() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    bindCollapsiblePanels();
    bindRouteForm();
    field('adminCountryFilter').addEventListener('change', () => { currentPage = 1; renderTable(); });
    field('adminDosageFilter')?.addEventListener('change', () => { currentPage = 1; renderTable(); });
    await loadRecords();
    await loadPorts();
    await loadRoutes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'history') {
      initHistory().catch((error) => historyMessage(error.message, 'error'));
    }
  });
})();

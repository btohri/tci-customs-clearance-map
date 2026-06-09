(function () {
  'use strict';

  let records = [];
  let routes = [];

  const labels = {
    success: '成功',
    delayed: '延遲',
    held: '扣關',
    rejected: '退運',
    green: 'Green',
    yellow: 'Yellow',
    red: 'Red'
  };

  const transportLabels = {
    ocean: '海運',
    air: '空運',
    multimodal: '複合運輸'
  };

  function field(id) {
    return document.getElementById(id);
  }

  function message(text, type = '') {
    const element = field('adminMessage');
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function routeMessage(text, type = '') {
    const element = field('routeMessage');
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

  function getRouteFormData() {
    const optionalNumber = (id) => field(id).value === '' ? null : Number(field(id).value);
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

  function validate(data) {
    const required = ['country', 'port', 'dosage_form', 'clearance_result', 'required_documents', 'risk_level'];
    if (required.some((key) => !data[key]) || Number.isNaN(data.clearance_days)) {
      throw new Error('請填寫所有必填欄位。');
    }
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

  function renderRoutesTable() {
    const body = field('routesTableBody');
    if (!body) return;
    body.innerHTML = routes.map((route) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(route.route_name)}</td>
        <td>${window.TCISearch.escapeHtml(transportLabels[route.transport_mode] || route.transport_mode)}</td>
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

  async function initAdmin() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    window.TCISearch.fillDosageForms(field('dosageFormInput'));
    bindForm();
    bindRouteForm();
    await loadRecords();
    await loadRoutes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'admin') {
      initAdmin().catch((error) => message(error.message, 'error'));
    }
  });
})();

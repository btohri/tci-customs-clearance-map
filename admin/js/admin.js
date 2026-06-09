(function () {
  'use strict';

  let records = [];
  let routes = [];
  let ports = [];
  let carriers = [];
  let quotes = [];

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
    multimodal: '複合運輸',
    forwarder: '貨代'
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

  function scopedMessage(id, text, type = '') {
    const element = field(id);
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function optionalNumber(id) {
    return field(id).value === '' ? null : Number(field(id).value);
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

  function getPortFormData() {
    return {
      port_name: field('portNameInput').value.trim(),
      country: window.TCIApi.normalizeCountry(field('portCountryInput').value),
      unlocode: field('unlocodeInput').value.trim(),
      latitude: optionalNumber('portLatitudeInput'),
      longitude: optionalNumber('portLongitudeInput'),
      source: field('portSourceInput').value.trim()
    };
  }

  function getCarrierFormData() {
    return {
      carrier_name: field('carrierNameInput').value.trim(),
      carrier_type: field('carrierTypeInput').value,
      website: field('carrierWebsiteInput').value.trim(),
      remarks: field('carrierRemarksInput').value.trim()
    };
  }

  function getQuoteFormData() {
    return {
      route_id: field('quoteRouteInput').value || null,
      carrier_id: field('quoteCarrierInput').value || null,
      origin_port: field('quoteOriginPortInput').value.trim(),
      destination_port: field('quoteDestinationPortInput').value.trim(),
      transport_mode: field('quoteTransportModeInput').value,
      container_type: field('containerTypeInput').value.trim(),
      chargeable_weight_kg: optionalNumber('chargeableWeightInput'),
      amount: Number(field('quoteAmountInput').value),
      currency: field('quoteCurrencyInput').value.trim(),
      quote_date: field('quoteDateInput').value,
      valid_until: field('quoteValidUntilInput').value || null,
      source_name: field('quoteSourceInput').value.trim(),
      remarks: field('quoteRemarksInput').value.trim()
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

  function setPortFormData(port) {
    field('portId').value = port.id || '';
    field('portNameInput').value = port.port_name || '';
    field('portCountryInput').value = port.country ? window.TCIApi.displayCountry(port.country) : '';
    field('unlocodeInput').value = port.unlocode || '';
    field('portLatitudeInput').value = port.latitude ?? '';
    field('portLongitudeInput').value = port.longitude ?? '';
    field('portSourceInput').value = port.source || '';
    field('portSubmitButton').textContent = port.id ? '儲存港口' : '新增港口';
    field('portCancelEditButton').hidden = !port.id;
  }

  function resetPortForm() {
    field('portForm').reset();
    setPortFormData({});
  }

  function setCarrierFormData(carrier) {
    field('carrierId').value = carrier.id || '';
    field('carrierNameInput').value = carrier.carrier_name || '';
    field('carrierTypeInput').value = carrier.carrier_type || 'ocean';
    field('carrierWebsiteInput').value = carrier.website || '';
    field('carrierRemarksInput').value = carrier.remarks || '';
    field('carrierSubmitButton').textContent = carrier.id ? '儲存承運商' : '新增承運商';
    field('carrierCancelEditButton').hidden = !carrier.id;
  }

  function resetCarrierForm() {
    field('carrierForm').reset();
    setCarrierFormData({});
  }

  function setQuoteFormData(quote) {
    field('quoteId').value = quote.id || '';
    field('quoteRouteInput').value = quote.route_id || '';
    field('quoteCarrierInput').value = quote.carrier_id || '';
    field('quoteOriginPortInput').value = quote.origin_port || '';
    field('quoteDestinationPortInput').value = quote.destination_port || '';
    field('quoteTransportModeInput').value = quote.transport_mode || 'ocean';
    field('containerTypeInput').value = quote.container_type || '';
    field('chargeableWeightInput').value = quote.chargeable_weight_kg ?? '';
    field('quoteAmountInput').value = quote.amount ?? '';
    field('quoteCurrencyInput').value = quote.currency || 'USD';
    field('quoteDateInput').value = quote.quote_date || new Date().toISOString().slice(0, 10);
    field('quoteValidUntilInput').value = quote.valid_until || '';
    field('quoteSourceInput').value = quote.source_name || '';
    field('quoteRemarksInput').value = quote.remarks || '';
    field('quoteSubmitButton').textContent = quote.id ? '儲存報價' : '新增報價';
    field('quoteCancelEditButton').hidden = !quote.id;
  }

  function resetQuoteForm() {
    field('quoteForm').reset();
    setQuoteFormData({});
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

  function validatePort(data) {
    if (!data.port_name || !data.country) {
      throw new Error('請填寫港口名稱與國家。');
    }
  }

  function validateCarrier(data) {
    if (!data.carrier_name || !data.carrier_type) {
      throw new Error('請填寫承運商與類型。');
    }
  }

  function validateQuote(data) {
    if (!data.origin_port || !data.destination_port || !Number.isFinite(data.amount) || !data.currency || !data.quote_date) {
      throw new Error('請填寫報價必填欄位。');
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
  }

  function renderTable() {
    if (!field('recordsTableBody')) return;
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
    applyPendingRecordEdit();
  }

  function applyPendingRecordEdit() {
    const pendingId = sessionStorage.getItem('tciEditRecordId');
    if (!pendingId) return;
    const record = records.find((item) => item.id === pendingId);
    sessionStorage.removeItem('tciEditRecordId');
    if (record) {
      setFormData(record);
      scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function renderLogisticsDatalists() {
    const portOptions = ports.map((port) => `
      <option value="${window.TCISearch.escapeHtml(port.port_name)}">
        ${window.TCISearch.escapeHtml(`${window.TCIApi.displayCountry(port.country)} ${port.unlocode || ''}`)}
      </option>
    `).join('');
    field('logisticsPortList').innerHTML = portOptions;
  }

  function renderRouteSelect() {
    const selected = field('quoteRouteInput')?.value || '';
    field('quoteRouteInput').innerHTML = '<option value="">不指定</option>' + routes.map((route) => `
      <option value="${route.id}">${window.TCISearch.escapeHtml(route.route_name)}</option>
    `).join('');
    field('quoteRouteInput').value = routes.some((route) => route.id === selected) ? selected : '';
  }

  function renderCarrierSelect() {
    const selected = field('quoteCarrierInput')?.value || '';
    field('quoteCarrierInput').innerHTML = '<option value="">未指定</option>' + carriers.map((carrier) => `
      <option value="${carrier.id}">${window.TCISearch.escapeHtml(carrier.carrier_name)}</option>
    `).join('');
    field('quoteCarrierInput').value = carriers.some((carrier) => carrier.id === selected) ? selected : '';
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
      renderRouteSelect();
    } catch (error) {
      routes = [];
      renderRoutesTable();
      routeMessage(`航線資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function renderPortsTable() {
    field('portsTableBody').innerHTML = ports.map((port) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(port.port_name)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(port.country))}</td>
        <td>${window.TCISearch.escapeHtml(port.unlocode || '')}</td>
        <td>
          <div class="action-row">
            <button class="button ghost port-edit-button" type="button" data-id="${port.id}">編輯</button>
            <button class="button danger port-delete-button" type="button" data-id="${port.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.port-edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const port = ports.find((item) => item.id === button.dataset.id);
        if (port) setPortFormData(port);
      });
    });

    document.querySelectorAll('.port-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆港口資料？')) return;
        try {
          await window.TCIApi.deletePort(button.dataset.id);
          scopedMessage('portMessage', '港口已刪除。', 'success');
          await loadPorts();
        } catch (error) {
          scopedMessage('portMessage', error.message, 'error');
        }
      });
    });
  }

  async function loadPorts() {
    try {
      ports = await window.TCIApi.getAllPorts();
      renderPortsTable();
      renderLogisticsDatalists();
    } catch (error) {
      ports = [];
      renderPortsTable();
      scopedMessage('portMessage', `港口資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function renderCarriersTable() {
    field('carriersTableBody').innerHTML = carriers.map((carrier) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(carrier.carrier_name)}</td>
        <td>${window.TCISearch.escapeHtml(transportLabels[carrier.carrier_type] || carrier.carrier_type)}</td>
        <td>
          <div class="action-row">
            <button class="button ghost carrier-edit-button" type="button" data-id="${carrier.id}">編輯</button>
            <button class="button danger carrier-delete-button" type="button" data-id="${carrier.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.carrier-edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const carrier = carriers.find((item) => item.id === button.dataset.id);
        if (carrier) setCarrierFormData(carrier);
      });
    });

    document.querySelectorAll('.carrier-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆承運商資料？')) return;
        try {
          await window.TCIApi.deleteCarrier(button.dataset.id);
          scopedMessage('carrierMessage', '承運商已刪除。', 'success');
          await loadCarriers();
        } catch (error) {
          scopedMessage('carrierMessage', error.message, 'error');
        }
      });
    });
  }

  async function loadCarriers() {
    try {
      carriers = await window.TCIApi.getAllCarriers();
      renderCarriersTable();
      renderCarrierSelect();
    } catch (error) {
      carriers = [];
      renderCarriersTable();
      scopedMessage('carrierMessage', `承運商資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function quoteRouteText(quote) {
    const route = routes.find((item) => item.id === quote.route_id);
    if (route) return route.route_name;
    return `${quote.origin_port} → ${quote.destination_port}`;
  }

  function quoteCarrierText(quote) {
    return carriers.find((item) => item.id === quote.carrier_id)?.carrier_name || '未指定';
  }

  function renderQuotesTable() {
    field('quotesTableBody').innerHTML = quotes.map((quote) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(quote.quote_date || '')}</td>
        <td>${window.TCISearch.escapeHtml(quoteRouteText(quote))}</td>
        <td>${window.TCISearch.escapeHtml(transportLabels[quote.transport_mode] || quote.transport_mode)}</td>
        <td>${window.TCISearch.escapeHtml(quoteCarrierText(quote))}</td>
        <td>${window.TCISearch.escapeHtml(quote.container_type || quote.chargeable_weight_kg || '--')}</td>
        <td>${window.TCISearch.escapeHtml(`${quote.currency || ''} ${quote.amount || ''}`)}</td>
        <td>${window.TCISearch.escapeHtml(quote.source_name || '')}</td>
        <td>
          <div class="action-row">
            <button class="button ghost quote-edit-button" type="button" data-id="${quote.id}">編輯</button>
            <button class="button danger quote-delete-button" type="button" data-id="${quote.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.quote-edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const quote = quotes.find((item) => item.id === button.dataset.id);
        if (quote) setQuoteFormData(quote);
      });
    });

    document.querySelectorAll('.quote-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆歷史報價？')) return;
        try {
          await window.TCIApi.deleteQuote(button.dataset.id);
          scopedMessage('quoteMessage', '歷史報價已刪除。', 'success');
          await loadQuotes();
        } catch (error) {
          scopedMessage('quoteMessage', error.message, 'error');
        }
      });
    });
  }

  async function loadQuotes() {
    try {
      quotes = await window.TCIApi.getAllQuotes();
      renderQuotesTable();
    } catch (error) {
      quotes = [];
      renderQuotesTable();
      scopedMessage('quoteMessage', `歷史報價資料表尚未啟用：${error.message}`, 'error');
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

  function bindPortForm() {
    field('portForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getPortFormData();
        validatePort(data);
        const id = field('portId').value;
        field('portSubmitButton').disabled = true;
        if (id) {
          await window.TCIApi.updatePort(id, data);
          scopedMessage('portMessage', '港口已更新。', 'success');
        } else {
          await window.TCIApi.addPort(data);
          scopedMessage('portMessage', '港口已新增。', 'success');
        }
        resetPortForm();
        await loadPorts();
      } catch (error) {
        scopedMessage('portMessage', error.message, 'error');
      } finally {
        field('portSubmitButton').disabled = false;
      }
    });
    field('portCancelEditButton').addEventListener('click', resetPortForm);
  }

  function bindCarrierForm() {
    field('carrierForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getCarrierFormData();
        validateCarrier(data);
        const id = field('carrierId').value;
        field('carrierSubmitButton').disabled = true;
        if (id) {
          await window.TCIApi.updateCarrier(id, data);
          scopedMessage('carrierMessage', '承運商已更新。', 'success');
        } else {
          await window.TCIApi.addCarrier(data);
          scopedMessage('carrierMessage', '承運商已新增。', 'success');
        }
        resetCarrierForm();
        await loadCarriers();
      } catch (error) {
        scopedMessage('carrierMessage', error.message, 'error');
      } finally {
        field('carrierSubmitButton').disabled = false;
      }
    });
    field('carrierCancelEditButton').addEventListener('click', resetCarrierForm);
  }

  function bindQuoteForm() {
    field('quoteRouteInput').addEventListener('change', () => {
      const route = routes.find((item) => item.id === field('quoteRouteInput').value);
      if (!route) return;
      field('quoteOriginPortInput').value = route.origin_port || '';
      field('quoteDestinationPortInput').value = route.destination_port || '';
      field('quoteTransportModeInput').value = route.transport_mode || 'ocean';
    });

    field('quoteForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getQuoteFormData();
        validateQuote(data);
        const id = field('quoteId').value;
        field('quoteSubmitButton').disabled = true;
        if (id) {
          await window.TCIApi.updateQuote(id, data);
          scopedMessage('quoteMessage', '歷史報價已更新。', 'success');
        } else {
          await window.TCIApi.addQuote(data);
          scopedMessage('quoteMessage', '歷史報價已新增。', 'success');
        }
        resetQuoteForm();
        await loadQuotes();
      } catch (error) {
        scopedMessage('quoteMessage', error.message, 'error');
      } finally {
        field('quoteSubmitButton').disabled = false;
      }
    });
    field('quoteCancelEditButton').addEventListener('click', resetQuoteForm);
  }

  async function initAdmin() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    window.TCISearch.fillDosageForms(field('dosageFormInput'));
    bindForm();
    bindRouteForm();
    bindPortForm();
    bindCarrierForm();
    bindQuoteForm();
    setQuoteFormData({});
    await loadRecords();
    await loadPorts();
    await loadCarriers();
    await loadRoutes();
    await loadQuotes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'admin') {
      initAdmin().catch((error) => message(error.message, 'error'));
    }
  });
})();

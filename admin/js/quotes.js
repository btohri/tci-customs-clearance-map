(function () {
  'use strict';

  const MANUAL_PORT = '__manual__';
  let quotes = [];
  let routes = [];
  let brokerDirectory = [];

  const transportLabels = {
    ocean: '海運',
    air: '空運',
    multimodal: '複合運輸'
  };

  const serviceTypeLabels = {
    broker: '報關行 / Broker',
    forwarder: '貨代',
    ocean: '船公司',
    air: '航空公司',
    other: '其他'
  };

  function field(id) {
    return document.getElementById(id);
  }

  function quoteMessage(text, type = '') {
    const element = field('quoteMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function optionalNumber(id) {
    return field(id).value === '' ? null : Number(field(id).value);
  }

  // ===== 國家 → 港口 連動選單 =====
  function fillQuoteCountrySelects() {
    const options = '<option value="">請選擇國家</option>' + window.TCIApi.countryAliases.map((country) => `
      <option value="${window.TCISearch.escapeHtml(country.value)}">${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country.value))}</option>
    `).join('');
    ['quoteOriginCountrySelect', 'quoteDestinationCountrySelect'].forEach((id) => {
      field(id).innerHTML = options;
    });
  }

  function setQuotePortManualVisible(side, visible) {
    field(`quote${side}PortManualLabel`).hidden = !visible;
  }

  async function loadQuotePortOptions(side, country, selectedPort = '') {
    const select = field(`quote${side}PortSelect`);
    if (!country) {
      select.disabled = true;
      select.innerHTML = '<option value="">請先選國家</option>';
      setQuotePortManualVisible(side, false);
      return;
    }
    select.disabled = true;
    select.innerHTML = '<option value="">載入港口中...</option>';
    let list = [];
    try {
      list = await window.TCIApi.searchPorts({ country, limit: 1000 });
    } catch (error) {
      list = [];
    }
    select.innerHTML = ['<option value="">請選擇港口</option>']
      .concat(list.map((port) => `<option value="${window.TCISearch.escapeHtml(port.port_name)}">${window.TCISearch.escapeHtml(`${port.port_name}${port.unlocode ? `（${port.unlocode}）` : ''}`)}</option>`))
      .concat([`<option value="${MANUAL_PORT}">其他（手動輸入）</option>`])
      .join('');
    select.disabled = false;
    if (selectedPort) {
      const match = list.find((port) => String(port.port_name).toLowerCase() === String(selectedPort).toLowerCase());
      if (match) {
        select.value = match.port_name;
        setQuotePortManualVisible(side, false);
      } else {
        select.value = MANUAL_PORT;
        field(`quote${side}PortManual`).value = selectedPort;
        setQuotePortManualVisible(side, true);
      }
    } else {
      setQuotePortManualVisible(side, false);
    }
  }

  function quotePortValue(side) {
    const select = field(`quote${side}PortSelect`);
    if (select.value && select.value !== MANUAL_PORT) return select.value;
    return field(`quote${side}PortManual`).value.trim();
  }

  async function setQuotePort(side, country, portName) {
    const normalized = country ? window.TCIApi.normalizeCountry(country) : '';
    field(`quote${side}CountrySelect`).value = normalized;
    if (!normalized) {
      if (portName) {
        // 沒有國家資訊（例如編輯舊資料）→ 直接手動輸入模式
        const select = field(`quote${side}PortSelect`);
        select.disabled = false;
        select.innerHTML = `<option value="${MANUAL_PORT}">其他（手動輸入）</option>`;
        select.value = MANUAL_PORT;
        field(`quote${side}PortManual`).value = portName;
        setQuotePortManualVisible(side, true);
      } else {
        await loadQuotePortOptions(side, '');
      }
      return;
    }
    await loadQuotePortOptions(side, normalized, portName || '');
  }

  function bindQuotePortSelectors() {
    [['Origin', 'quoteOriginCountrySelect'], ['Destination', 'quoteDestinationCountrySelect']].forEach(([side, id]) => {
      field(id).addEventListener('change', () => {
        field(`quote${side}PortManual`).value = '';
        loadQuotePortOptions(side, field(id).value);
      });
      field(`quote${side}PortSelect`).addEventListener('change', () => {
        setQuotePortManualVisible(side, field(`quote${side}PortSelect`).value === MANUAL_PORT);
      });
    });
  }

  // ===== 表單資料 =====
  function getQuoteFormData() {
    return {
      route_id: field('quoteRouteInput').value || null,
      carrier_id: null,
      origin_port: quotePortValue('Origin'),
      destination_port: quotePortValue('Destination'),
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

  function setQuoteFormData(quote) {
    field('quoteId').value = quote.id || '';
    field('quoteRouteInput').value = quote.route_id || '';
    setQuotePort('Origin', quote.origin_country || '', quote.origin_port || '');
    setQuotePort('Destination', quote.destination_country || '', quote.destination_port || '');
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

  function validateQuote(data) {
    if (!data.origin_port || !data.destination_port || !Number.isFinite(data.amount) || !data.currency || !data.quote_date) {
      throw new Error('請填寫報價必填欄位。');
    }
  }

  // ===== 關聯資料 =====
  function renderRouteSelect() {
    const selected = field('quoteRouteInput').value || '';
    field('quoteRouteInput').innerHTML = '<option value="">不指定</option>' + routes.map((route) => `
      <option value="${route.id}">${window.TCISearch.escapeHtml(route.route_name)}</option>
    `).join('');
    field('quoteRouteInput').value = routes.some((route) => route.id === selected) ? selected : '';
  }

  async function loadRoutes() {
    try {
      routes = await window.TCIApi.getAllRoutes();
    } catch (error) {
      routes = [];
    }
    renderRouteSelect();
  }

  function renderServiceProviderList() {
    field('serviceProviderList').innerHTML = brokerDirectory.map((broker) => `
      <option value="${window.TCISearch.escapeHtml(broker.broker_name)}">
        ${window.TCISearch.escapeHtml(serviceTypeLabels[broker.service_type] || serviceTypeLabels.broker)}
      </option>
    `).join('');
  }

  async function loadBrokerDirectory() {
    try {
      brokerDirectory = await window.TCIApi.getAllBrokers();
    } catch (error) {
      brokerDirectory = [];
    }
    renderServiceProviderList();
  }

  // ===== 報價清單 =====
  function quoteRouteText(quote) {
    const route = routes.find((item) => item.id === quote.route_id);
    if (route) return route.route_name;
    return `${quote.origin_port} → ${quote.destination_port}`;
  }

  function renderQuotesTable() {
    field('quotesTableBody').innerHTML = quotes.map((quote) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(quote.quote_date || '')}</td>
        <td>${window.TCISearch.escapeHtml(quoteRouteText(quote))}</td>
        <td>${window.TCISearch.escapeHtml(transportLabels[quote.transport_mode] || quote.transport_mode)}</td>
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
        if (quote) {
          setQuoteFormData(quote);
          scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.quote-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆歷史報價？')) return;
        try {
          await window.TCIApi.deleteQuote(button.dataset.id);
          quoteMessage('歷史報價已刪除。', 'success');
          await loadQuotes();
        } catch (error) {
          quoteMessage(error.message, 'error');
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
      quoteMessage(`歷史報價資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function bindQuoteForm() {
    field('quoteRouteInput').addEventListener('change', () => {
      const route = routes.find((item) => item.id === field('quoteRouteInput').value);
      if (!route) return;
      setQuotePort('Origin', route.origin_country || '', route.origin_port || '');
      setQuotePort('Destination', route.destination_country || '', route.destination_port || '');
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
          quoteMessage('歷史報價已更新。', 'success');
        } else {
          await window.TCIApi.addQuote(data);
          quoteMessage('歷史報價已新增。', 'success');
        }
        resetQuoteForm();
        await loadQuotes();
      } catch (error) {
        quoteMessage(error.message, 'error');
      } finally {
        field('quoteSubmitButton').disabled = false;
      }
    });
    field('quoteCancelEditButton').addEventListener('click', resetQuoteForm);
  }

  async function initQuotes() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    fillQuoteCountrySelects();
    bindQuotePortSelectors();
    bindQuoteForm();
    setQuoteFormData({});
    await loadRoutes();
    await loadBrokerDirectory();
    await loadQuotes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'quotes') {
      initQuotes().catch((error) => quoteMessage(error.message, 'error'));
    }
  });
})();

(function () {
  'use strict';

  let routes = [];
  let suggestTimer = null;

  const labels = {
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

  function routeMessage(text, type = '') {
    const element = field('routeMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function optionalNumber(id) {
    return field(id).value === '' ? null : Number(field(id).value);
  }

  function renderCountryDatalist() {
    const options = window.TCIApi.countryAliases.flatMap((country) => [
      window.TCIApi.displayCountry(country.value),
      country.value
    ]);
    field('countryList').innerHTML = [...new Set(options)]
      .map((value) => `<option value="${window.TCISearch.escapeHtml(value)}"></option>`)
      .join('');
  }

  // 依表單中已輸入的起運/目的國家，載入對應港口建議
  async function refreshPortSuggestions() {
    const countries = [...new Set([
      field('originCountryInput').value.trim(),
      field('destinationCountryInput').value.trim()
    ].filter(Boolean).map((value) => window.TCIApi.normalizeCountry(value)))];
    if (!countries.length) return;
    const ports = [];
    for (const country of countries) {
      try {
        ports.push(...await window.TCIApi.searchPorts({ country, limit: 300 }));
      } catch (error) {
        // 忽略單一國家失敗
      }
    }
    field('logisticsPortList').innerHTML = ports.map((port) => `
      <option value="${window.TCISearch.escapeHtml(port.port_name)}">
        ${window.TCISearch.escapeHtml(`${window.TCIApi.displayCountry(port.country)} ${port.unlocode || ''}`)}
      </option>
    `).join('');
  }

  function bindPortSuggestions() {
    ['originCountryInput', 'destinationCountryInput'].forEach((id) => {
      field(id).addEventListener('input', () => {
        clearTimeout(suggestTimer);
        suggestTimer = setTimeout(refreshPortSuggestions, 350);
      });
    });
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
    field('routesTableBody').innerHTML = routes.map((route) => `
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
        if (route) {
          setRouteFormData(route);
          refreshPortSuggestions();
          scrollTo({ top: 0, behavior: 'smooth' });
        }
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
    field('routeForm').addEventListener('submit', async (event) => {
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

    field('routeCancelEditButton').addEventListener('click', resetRouteForm);
  }

  async function initRoutes() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    renderCountryDatalist();
    bindRouteForm();
    bindPortSuggestions();
    await loadRoutes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'routes') {
      initRoutes().catch((error) => routeMessage(error.message, 'error'));
    }
  });
})();

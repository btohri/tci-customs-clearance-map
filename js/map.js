(function () {
  'use strict';

  const geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
  let map;
  let countryLayer;
  let routeLayerGroup;
  let brokerLayerGroup;
  let riskSummary = {};
  let routes = [];
  let quotes = [];
  let brokers = [];
  let routesEnabled = true;
  let routesAvailable = true;
  let brokersEnabled = false;

  function normalizeCountryName(name) {
    return window.TCIApi?.normalizeCountry(name) || name;
  }

  function riskColors(risk) {
    return {
      green: { fillColor: '#1D9E75', color: '#5AF0BD' },
      yellow: { fillColor: '#F2B84B', color: '#F7D377' },
      red: { fillColor: '#E94F5C', color: '#FF7B86' }
    }[risk] || { fillColor: '#17283A', color: '#526A82' };
  }

  function styleFeature(feature) {
    const country = normalizeCountryName(feature.properties.ADMIN || feature.properties.name);
    const colors = riskColors(riskSummary[country]);
    return {
      ...colors,
      weight: 1,
      fillOpacity: riskSummary[country] ? 0.74 : 0.46
    };
  }

  function getFeatureName(feature) {
    return feature.properties.ADMIN || feature.properties.name || 'Unknown';
  }

  function setSidebarLoading(text) {
    document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>${window.TCISearch.escapeHtml(text)}</strong></div>`;
  }

  function routeRiskClass(risk) {
    return `route-${risk || 'none'}`;
  }

  function routeColor(risk) {
    return {
      green: '#5AF0BD',
      yellow: '#F2B84B',
      red: '#E94F5C'
    }[risk] || '#8FA4B8';
  }

  function normalizeRoutePath(route) {
    const path = Array.isArray(route.route_path) ? route.route_path : [];
    const validPath = path
      .map((point) => Array.isArray(point) ? point : [point.lat, point.lng])
      .filter((point) => point.length === 2 && point.every((item) => Number.isFinite(Number(item))))
      .map((point) => [Number(point[0]), Number(point[1])]);
    if (validPath.length >= 2) return validPath;
    return [
      [Number(route.origin_lat), Number(route.origin_lng)],
      [Number(route.destination_lat), Number(route.destination_lng)]
    ].filter((point) => point.every((item) => Number.isFinite(item)));
  }

  function routeMatchesCountry(route, country) {
    return (
      window.TCIApi.countryMatches(route.origin_country, country) ||
      window.TCIApi.countryMatches(route.destination_country, country)
    );
  }

  function transportText(mode) {
    return {
      ocean: '海運',
      air: '空運',
      multimodal: '複合運輸'
    }[mode] || mode || '未分類';
  }

  function renderRouteCards(routeList) {
    if (!routeList.length) {
      return '<p class="hint">此國家尚無航線情報。</p>';
    }
    return routeList.map((route) => `
      <article class="route-card ${routeRiskClass(route.risk_level)}">
        <div class="route-card-head">
          <strong>${window.TCISearch.escapeHtml(route.route_name)}</strong>
          <span class="risk-badge risk-${route.risk_level}">${window.TCISearch.riskText(route.risk_level)}</span>
        </div>
        <p>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(route.origin_country))} / ${window.TCISearch.escapeHtml(route.origin_port)} → ${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(route.destination_country))} / ${window.TCISearch.escapeHtml(route.destination_port)}</p>
        <div class="route-meta">
          <span>${window.TCISearch.escapeHtml(transportText(route.transport_mode))}</span>
          <span>${window.TCISearch.escapeHtml(route.estimated_days || '--')} 天</span>
          <span>${window.TCISearch.escapeHtml(route.distance_km || '--')} km</span>
        </div>
        ${renderQuoteSummary(route)}
        ${route.chokepoints ? `<p class="hint">關鍵通道：${window.TCISearch.escapeHtml(route.chokepoints)}</p>` : ''}
        ${route.notes ? `<p>${window.TCISearch.escapeHtml(route.notes)}</p>` : ''}
      </article>
    `).join('');
  }

  function getRouteQuotes(route) {
    return quotes.filter((quote) => (
      quote.route_id === route.id ||
      (
        String(quote.origin_port || '').toLowerCase() === String(route.origin_port || '').toLowerCase() &&
        String(quote.destination_port || '').toLowerCase() === String(route.destination_port || '').toLowerCase()
      )
    ));
  }

  function renderQuoteSummary(route) {
    const routeQuotes = getRouteQuotes(route).slice(0, 3);
    if (!routeQuotes.length) return '';
    return `
      <div class="quote-summary">
        <strong>歷史報價參考</strong>
        ${routeQuotes.map((quote) => `
          <span>${window.TCISearch.escapeHtml(quote.quote_date || '')}｜${window.TCISearch.escapeHtml(quote.currency || '')} ${window.TCISearch.escapeHtml(quote.amount || '')}｜${window.TCISearch.escapeHtml(quote.container_type || quote.chargeable_weight_kg || '')}</span>
        `).join('')}
      </div>
    `;
  }

  function renderRoutePopup(route) {
    return `
      <strong>${window.TCISearch.escapeHtml(route.route_name)}</strong><br>
      ${window.TCISearch.escapeHtml(transportText(route.transport_mode))}｜${window.TCISearch.escapeHtml(window.TCISearch.riskText(route.risk_level))}<br>
      ${window.TCISearch.escapeHtml(route.estimated_days || '--')} 天｜${window.TCISearch.escapeHtml(route.distance_km || '--')} km
    `;
  }

  function drawRoutes() {
    if (!routeLayerGroup) return;
    routeLayerGroup.clearLayers();
    if (!routesEnabled) return;
    routes.forEach((route) => {
      const path = normalizeRoutePath(route);
      if (path.length < 2) return;
      const line = window.L.polyline(path, {
        color: routeColor(route.risk_level),
        opacity: 0.88,
        weight: route.risk_level === 'red' ? 4 : 3,
        dashArray: route.transport_mode === 'air' ? '6 8' : ''
      });
      line.bindPopup(renderRoutePopup(route));
      line.on('click', () => showRouteDetail(route));
      line.addTo(routeLayerGroup);
    });
  }

  function showRouteDetail(route) {
    document.getElementById('map-sidebar').innerHTML = `
      <div class="sidebar-title">
        <h2>${window.TCISearch.escapeHtml(route.route_name)}</h2>
        <span class="risk-badge risk-${route.risk_level}">${window.TCISearch.riskText(route.risk_level)}</span>
      </div>
      ${renderRouteCards([route])}
      <button id="routeBackButton" class="button ghost" type="button">返回目的國</button>
    `;
    document.getElementById('routeBackButton')?.addEventListener('click', () => {
      onCountryClick(route.destination_country);
    });
  }

  async function onCountryClick(countryName) {
    const country = normalizeCountryName(countryName);
    setSidebarLoading('載入口岸中...');
    try {
      const ports = await window.TCIApi.getPorts(country);
      const risk = riskSummary[country];
      const countryRoutes = routes.filter((route) => routeMatchesCountry(route, country));
      document.getElementById('map-sidebar').innerHTML = `
        <div class="sidebar-title">
          <h2>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</h2>
          <span class="risk-badge risk-${risk || 'none'}">${window.TCISearch.riskIcon(risk)} ${window.TCISearch.riskText(risk)}</span>
        </div>
        <h3>選擇口岸</h3>
        <div class="port-grid">
          ${ports.map((port) => `<button class="button ghost port-button" type="button" data-country="${window.TCISearch.escapeHtml(country)}" data-port="${window.TCISearch.escapeHtml(port)}">${window.TCISearch.escapeHtml(port)}</button>`).join('') || '<p class="hint">此國家尚無口岸資料。</p>'}
        </div>
        <h3>航線風險情報</h3>
        <div class="route-list">
          ${renderRouteCards(countryRoutes)}
        </div>
      `;
      document.querySelectorAll('.port-button').forEach((button) => {
        button.addEventListener('click', () => onPortSelect(button.dataset.country, button.dataset.port));
      });
    } catch (error) {
      document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>載入失敗</strong><span>${window.TCISearch.escapeHtml(error.message)}</span></div>`;
    }
  }

  function onPortSelect(country, port) {
    document.getElementById('map-sidebar').innerHTML = `
      <div class="sidebar-title">
        <h2>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))} > ${window.TCISearch.escapeHtml(port)}</h2>
      </div>
      <form id="mapSearchForm" class="admin-form">
        <label>
          選擇劑型
          <select id="mapDosageForm" required></select>
        </label>
        <button class="button primary" type="submit">查詢</button>
      </form>
    `;
    window.TCISearch.fillDosageForms(document.getElementById('mapDosageForm'));
    document.getElementById('mapSearchForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await onSearch(country, port, document.getElementById('mapDosageForm').value);
    });
  }

  async function onSearch(country, port, dosageForm) {
    setSidebarLoading('查詢中...');
    try {
      const records = await window.TCIApi.searchCustoms({ country, port, dosageForm });
      const sidebar = document.getElementById('map-sidebar');
      await window.TCISearch.renderSearchResult(sidebar, records, { country, port, dosageForm });
      sidebar.insertAdjacentHTML('beforeend', '<button id="mapBackButton" class="button ghost" type="button">返回口岸</button>');
      document.getElementById('mapBackButton').addEventListener('click', () => onCountryClick(country));
    } catch (error) {
      document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>查詢失敗</strong><span>${window.TCISearch.escapeHtml(error.message)}</span></div>`;
    }
  }

  async function refreshMapColors() {
    riskSummary = await window.TCIApi.getCountryRiskSummary();
    updateMissionStats();
    if (countryLayer) {
      countryLayer.setStyle(styleFeature);
    }
  }

  function updateMissionStats() {
    const countryCount = document.getElementById('countryCount');
    const riskCountryCount = document.getElementById('riskCountryCount');
    const routeCount = document.getElementById('routeCount');
    const lastSyncTime = document.getElementById('lastSyncTime');
    const riskCountries = Object.keys(riskSummary || {}).filter((country) => riskSummary[country]);
    if (countryCount) countryCount.textContent = String(riskCountries.length);
    if (riskCountryCount) {
      riskCountryCount.textContent = String(riskCountries.filter((country) => riskSummary[country] === 'red' || riskSummary[country] === 'yellow').length);
    }
    if (lastSyncTime) {
      lastSyncTime.textContent = new Date().toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    if (routeCount) routeCount.textContent = routesAvailable ? String(routes.length) : '未啟用';
  }

  async function loadRoutes() {
    try {
      routesAvailable = true;
      routes = await window.TCIApi.getAllRoutes();
    } catch (error) {
      routesAvailable = false;
      routes = [];
    }
    updateMissionStats();
    drawRoutes();
  }

  async function loadQuotes() {
    try {
      quotes = await window.TCIApi.getAllQuotes();
    } catch (error) {
      quotes = [];
    }
  }

  async function loadBrokers() {
    try {
      brokers = await window.TCIApi.getAllBrokers();
    } catch {
      brokers = [];
    }
  }

  function drawBrokers() {
    if (!brokerLayerGroup) return;
    brokerLayerGroup.clearLayers();
    if (!brokersEnabled || !brokers.length) return;

    const grouped = {};
    brokers.forEach((broker) => {
      const country = window.TCIApi.normalizeCountry(broker.country);
      if (!grouped[country]) grouped[country] = [];
      grouped[country].push(broker);
    });

    Object.entries(grouped).forEach(([country, list]) => {
      let coords = null;
      for (const broker of list) {
        if (broker.port) {
          coords = window.TCIApi.findRouteCoordinate(country, broker.port);
          if (coords) break;
        }
      }
      if (!coords) coords = window.TCIApi.countryCoordinates.get(country);
      if (!coords) return;

      const marker = window.L.circleMarker([coords.lat, coords.lng], {
        radius: 7,
        color: '#f2b84b',
        fillColor: '#f2b84b',
        fillOpacity: 0.85,
        weight: 2
      });
      marker.bindTooltip(`Broker: ${list.length} 家 (${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))})`);
      marker.on('click', () => showBrokerDetail(country, list));
      marker.addTo(brokerLayerGroup);
    });
  }

  function showBrokerDetail(country, list) {
    document.getElementById('map-sidebar').innerHTML = `
      <div class="sidebar-title">
        <h2>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</h2>
        <span class="risk-badge risk-none">Broker 名錄</span>
      </div>
      <div class="route-list">
        ${list.map((broker) => `
          <div class="route-card">
            <strong>${window.TCISearch.escapeHtml(broker.broker_name)}</strong>
            ${broker.port ? `<p class="hint">口岸：${window.TCISearch.escapeHtml(broker.port)}</p>` : ''}
            ${broker.contact_info ? `<p>${window.TCISearch.escapeHtml(broker.contact_info)}</p>` : ''}
            ${broker.remarks ? `<p class="hint">${window.TCISearch.escapeHtml(broker.remarks)}</p>` : ''}
          </div>
        `).join('')}
      </div>
      <button id="brokerBackButton" class="button ghost" type="button" style="margin-top:1rem">← 返回</button>
    `;
    document.getElementById('brokerBackButton')?.addEventListener('click', () => {
      document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>請點擊地圖上的國家開始查詢</strong><span>地圖顏色依目前通關紀錄最高風險顯示。</span></div>`;
    });
  }

  function bindBrokerLayerToggle() {
    const button = document.getElementById('brokerLayerToggle');
    if (!button) return;
    button.addEventListener('click', () => {
      brokersEnabled = !brokersEnabled;
      button.classList.toggle('active', brokersEnabled);
      button.setAttribute('aria-pressed', String(brokersEnabled));
      drawBrokers();
    });
  }

  function bindRouteLayerToggle() {
    const button = document.getElementById('routeLayerToggle');
    if (!button) return;
    button.addEventListener('click', () => {
      routesEnabled = !routesEnabled;
      button.classList.toggle('active', routesEnabled);
      button.setAttribute('aria-pressed', String(routesEnabled));
      drawRoutes();
    });
  }

  async function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || !window.L) return;

    map = window.L.map(mapElement, {
      minZoom: 2,
      maxZoom: 6,
      worldCopyJump: true
    }).setView([22, 18], 2);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 6,
      className: 'tci-dark-tiles',
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    routeLayerGroup = window.L.layerGroup().addTo(map);
    brokerLayerGroup = window.L.layerGroup().addTo(map);
    bindRouteLayerToggle();
    bindBrokerLayerToggle();

    setSidebarLoading('載入地圖資料中...');
    await refreshMapColors();
    await loadQuotes();
    await loadBrokers();
    await loadRoutes();
    const response = await fetch(geoJsonUrl);
    const geojson = await response.json();

    countryLayer = window.L.geoJSON(geojson, {
      style: styleFeature,
      onEachFeature(feature, layer) {
        const displayName = getFeatureName(feature);
        const queryName = normalizeCountryName(displayName);
        layer.bindTooltip(displayName);
        layer.on({
          mouseover() {
            layer.setStyle({ weight: 2, fillOpacity: 1 });
          },
          mouseout() {
            countryLayer.resetStyle(layer);
          },
          click() {
            onCountryClick(queryName);
          }
        });
      }
    }).addTo(map);

    document.getElementById('map-sidebar').innerHTML = `
      <div class="empty-state">
        <strong>請點擊地圖上的國家開始查詢</strong>
        <span>地圖顏色依目前通關紀錄最高風險顯示。</span>
      </div>
    `;
    setTimeout(() => map.invalidateSize(), 120);
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  window.TCIMap = {
    initMap,
    styleFeature,
    onCountryClick,
    onPortSelect,
    onSearch,
    refreshMapColors,
    invalidateSize
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'search') {
      window.TCIAuth.requireAuth().then((auth) => {
        if (auth) initMap().catch((error) => {
          document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>地圖載入失敗</strong><span>${window.TCISearch.escapeHtml(error.message)}</span></div>`;
        });
      });
    }
  });
})();

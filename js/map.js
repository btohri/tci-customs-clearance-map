(function () {
  'use strict';

  const geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
  let map;
  let countryLayer;
  let riskSummary = {};

  function normalizeCountryName(name) {
    return window.TCIApi?.normalizeCountry(name) || name;
  }

  function riskColors(risk) {
    return {
      green: { fillColor: '#E1F5EE', color: '#1D9E75' },
      yellow: { fillColor: '#FAEEDA', color: '#EF9F27' },
      red: { fillColor: '#FCEBEB', color: '#E24B4A' }
    }[risk] || { fillColor: '#F1EFE8', color: '#B4B2A9' };
  }

  function styleFeature(feature) {
    const country = normalizeCountryName(feature.properties.ADMIN || feature.properties.name);
    const colors = riskColors(riskSummary[country]);
    return {
      ...colors,
      weight: 1,
      fillOpacity: 0.85
    };
  }

  function getFeatureName(feature) {
    return feature.properties.ADMIN || feature.properties.name || 'Unknown';
  }

  function setSidebarLoading(text) {
    document.getElementById('map-sidebar').innerHTML = `<div class="empty-state"><strong>${window.TCISearch.escapeHtml(text)}</strong></div>`;
  }

  async function onCountryClick(countryName) {
    const country = normalizeCountryName(countryName);
    setSidebarLoading('載入口岸中...');
    try {
      const ports = await window.TCIApi.getPorts(country);
      const risk = riskSummary[country];
      document.getElementById('map-sidebar').innerHTML = `
        <div class="sidebar-title">
          <h2>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(country))}</h2>
          <span class="risk-badge risk-${risk || 'none'}">${window.TCISearch.riskIcon(risk)} ${window.TCISearch.riskText(risk)}</span>
        </div>
        <h3>選擇口岸</h3>
        <div class="port-grid">
          ${ports.map((port) => `<button class="button ghost port-button" type="button" data-country="${window.TCISearch.escapeHtml(country)}" data-port="${window.TCISearch.escapeHtml(port)}">${window.TCISearch.escapeHtml(port)}</button>`).join('') || '<p class="hint">此國家尚無口岸資料。</p>'}
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
    if (countryLayer) {
      countryLayer.setStyle(styleFeature);
    }
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
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    setSidebarLoading('載入地圖資料中...');
    await refreshMapColors();
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

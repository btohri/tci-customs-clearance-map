(function () {
  'use strict';

  const PAGE_SIZE = 50;
  let ports = [];
  let page = 1;
  let totalCount = 0;
  let filterTimer = null;

  function field(id) {
    return document.getElementById(id);
  }

  function portMessage(text, type = '') {
    const element = field('portMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function optionalNumber(id) {
    return field(id).value === '' ? null : Number(field(id).value);
  }

  function totalPages() {
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
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

  function validatePort(data) {
    if (!data.port_name || !data.country) {
      throw new Error('請填寫港口名稱與國家。');
    }
  }

  function formatCoords(port) {
    if (port.latitude === null || port.latitude === undefined || port.longitude === null || port.longitude === undefined) {
      return '—';
    }
    return `${port.latitude}, ${port.longitude}`;
  }

  function renderPortsTable() {
    field('portsTableBody').innerHTML = ports.map((port) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(port.port_name)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(port.country))}</td>
        <td>${window.TCISearch.escapeHtml(port.unlocode || '')}</td>
        <td>${window.TCISearch.escapeHtml(formatCoords(port))}</td>
        <td>${window.TCISearch.escapeHtml(port.source || '')}</td>
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
        if (port) {
          setPortFormData(port);
          scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.port-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆港口資料？')) return;
        try {
          await window.TCIApi.deletePort(button.dataset.id);
          portMessage('港口已刪除。', 'success');
          await loadPorts();
        } catch (error) {
          portMessage(error.message, 'error');
        }
      });
    });
  }

  function renderPagination() {
    const info = field('portPageInfo');
    if (info) info.textContent = `第 ${page} / ${totalPages()} 頁（共 ${totalCount} 筆）`;
    field('portPrevButton').disabled = page <= 1;
    field('portNextButton').disabled = page >= totalPages();
  }

  async function loadPorts() {
    const hint = field('portFilterHint');
    try {
      const country = field('portFilterCountry').value.trim();
      const keyword = field('portFilterKeyword').value.trim();
      const result = await window.TCIApi.searchPortsPaged({
        country,
        keyword,
        page,
        pageSize: PAGE_SIZE
      });
      ports = result.rows;
      totalCount = result.count;
      // 若刪除/篩選後頁碼超出範圍，自動回到最後一頁
      if (page > totalPages()) {
        page = totalPages();
        return loadPorts();
      }
      renderPortsTable();
      renderPagination();
      if (hint) hint.textContent = country || keyword ? `篩選結果：${totalCount} 筆` : `全部港口：${totalCount} 筆`;
    } catch (error) {
      ports = [];
      totalCount = 0;
      renderPortsTable();
      renderPagination();
      if (hint) hint.textContent = '';
      portMessage(`港口載入失敗：${error.message}`, 'error');
    }
  }

  function bindFilters() {
    ['portFilterCountry', 'portFilterKeyword'].forEach((id) => {
      field(id).addEventListener('input', () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
          page = 1;
          loadPorts();
        }, 350);
      });
    });
  }

  function bindPagination() {
    field('portPrevButton').addEventListener('click', () => {
      if (page > 1) {
        page -= 1;
        loadPorts();
      }
    });
    field('portNextButton').addEventListener('click', () => {
      if (page < totalPages()) {
        page += 1;
        loadPorts();
      }
    });
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
          portMessage('港口已更新。', 'success');
        } else {
          await window.TCIApi.addPort(data);
          portMessage('港口已新增。', 'success');
        }
        resetPortForm();
        await loadPorts();
      } catch (error) {
        portMessage(error.message, 'error');
      } finally {
        field('portSubmitButton').disabled = false;
      }
    });
    field('portCancelEditButton').addEventListener('click', resetPortForm);
  }

  async function initPorts() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    renderCountryDatalist();
    bindPortForm();
    bindFilters();
    bindPagination();
    await loadPorts();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'ports') {
      initPorts().catch((error) => portMessage(error.message, 'error'));
    }
  });
})();

(function () {
  'use strict';

  let brokerDirectory = [];
  let ports = [];
  let brokerPortTimer = null;

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

  function brokerMessage(text, type = '') {
    const element = field('brokerMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
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

  function renderPortDatalist() {
    field('logisticsPortList').innerHTML = ports.map((port) => `
      <option value="${window.TCISearch.escapeHtml(port.port_name)}">
        ${window.TCISearch.escapeHtml(`${window.TCIApi.displayCountry(port.country)} ${port.unlocode || ''}`)}
      </option>
    `).join('');
  }

  // 依輸入的國家動態載入口岸建議
  function bindPortSuggestions() {
    field('brokerCountryInput').addEventListener('input', () => {
      clearTimeout(brokerPortTimer);
      brokerPortTimer = setTimeout(async () => {
        const country = field('brokerCountryInput').value.trim();
        if (!country) return;
        try {
          ports = await window.TCIApi.searchPorts({ country, limit: 300 });
          renderPortDatalist();
        } catch (error) {
          // 忽略建議載入失敗
        }
      }, 350);
    });
  }

  function getBrokerFormData() {
    return {
      broker_name: field('brokerNameInput').value.trim(),
      service_type: field('brokerTypeInput')?.value || 'broker',
      country: window.TCIApi.normalizeCountry(field('brokerCountryInput').value),
      port: field('brokerPortInput').value.trim() || null,
      contact_info: field('brokerContactInput').value.trim() || null,
      remarks: field('brokerRemarksInput').value.trim() || null
    };
  }

  function setBrokerFormData(broker) {
    field('brokerId').value = broker.id || '';
    field('brokerNameInput').value = broker.broker_name || '';
    field('brokerTypeInput').value = broker.service_type || 'broker';
    field('brokerCountryInput').value = broker.country ? window.TCIApi.displayCountry(broker.country) : '';
    field('brokerPortInput').value = broker.port || '';
    field('brokerContactInput').value = broker.contact_info || '';
    field('brokerRemarksInput').value = broker.remarks || '';
    field('brokerSubmitButton').textContent = broker.id ? '儲存服務商' : '新增服務商';
    field('brokerCancelEditButton').hidden = !broker.id;
  }

  function resetBrokerForm() {
    field('brokerForm').reset();
    setBrokerFormData({});
  }

  function validateBroker(data) {
    if (!data.broker_name || !data.service_type || !data.country) {
      throw new Error('請填寫服務商名稱、類型與國家。');
    }
  }

  function renderBrokersTable() {
    field('brokersTableBody').innerHTML = brokerDirectory.map((broker) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(broker.broker_name)}</td>
        <td>${window.TCISearch.escapeHtml(serviceTypeLabels[broker.service_type] || serviceTypeLabels.broker)}</td>
        <td>${window.TCISearch.escapeHtml(window.TCIApi.displayCountry(broker.country))}</td>
        <td>${window.TCISearch.escapeHtml(broker.port || '')}</td>
        <td>${window.TCISearch.escapeHtml(broker.contact_info || '')}</td>
        <td>${window.TCISearch.escapeHtml(broker.remarks || '')}</td>
        <td>
          <div class="action-row">
            <button class="button ghost broker-edit-button" type="button" data-id="${broker.id}">編輯</button>
            <button class="button danger broker-delete-button" type="button" data-id="${broker.id}">刪除</button>
          </div>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.broker-edit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const broker = brokerDirectory.find((item) => item.id === button.dataset.id);
        if (broker) {
          setBrokerFormData(broker);
          scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.broker-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('確定要刪除此筆服務商資料？')) return;
        try {
          await window.TCIApi.deleteBroker(button.dataset.id);
          brokerMessage('服務商已刪除。', 'success');
          await loadBrokerDirectory();
        } catch (error) {
          brokerMessage(error.message, 'error');
        }
      });
    });
  }

  async function loadBrokerDirectory() {
    try {
      brokerDirectory = await window.TCIApi.getAllBrokers();
      renderBrokersTable();
    } catch (error) {
      brokerDirectory = [];
      renderBrokersTable();
      brokerMessage(`服務商資料表尚未啟用：${error.message}`, 'error');
    }
  }

  function bindBrokerForm() {
    field('brokerForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = getBrokerFormData();
        validateBroker(data);
        const id = field('brokerId').value;
        field('brokerSubmitButton').disabled = true;
        if (id) {
          await window.TCIApi.updateBroker(id, data);
          brokerMessage('服務商已更新。', 'success');
        } else {
          await window.TCIApi.addBroker(data);
          brokerMessage('服務商已新增。', 'success');
        }
        resetBrokerForm();
        await loadBrokerDirectory();
      } catch (error) {
        brokerMessage(error.message, 'error');
      } finally {
        field('brokerSubmitButton').disabled = false;
      }
    });
    field('brokerCancelEditButton').addEventListener('click', resetBrokerForm);
  }

  async function initBrokers() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    renderCountryDatalist();
    bindBrokerForm();
    bindPortSuggestions();
    await loadBrokerDirectory();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'brokers') {
      initBrokers().catch((error) => brokerMessage(error.message, 'error'));
    }
  });
})();

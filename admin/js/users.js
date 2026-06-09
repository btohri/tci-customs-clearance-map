(function () {
  'use strict';

  let roleAssignments = [];

  function field(id) {
    return document.getElementById(id);
  }

  function roleMessage(text, type = '') {
    const element = field('roleMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function createUserMessage(text, type = '') {
    const element = field('createUserMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function resetPasswordMessage(text, type = '') {
    const element = field('resetPasswordMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function renderRolesTable() {
    field('rolesTableBody').innerHTML = roleAssignments.map((item) => `
      <tr>
        <td>${window.TCISearch.escapeHtml(item.email)}</td>
        <td>${window.TCISearch.escapeHtml(item.role)}</td>
        <td>${window.TCISearch.escapeHtml(item.user_id)}</td>
        <td>${window.TCISearch.escapeHtml((item.created_at || '').slice(0, 10))}</td>
      </tr>
    `).join('');
  }

  function renderRoleSelect() {
    const select = field('roleEmailInput');
    const resetSelect = field('resetPasswordEmailInput');
    const selectedEmail = select.value;
    const selectedResetEmail = resetSelect.value;
    select.innerHTML = '<option value="">請選擇使用者</option>' + roleAssignments.map((item) => `
      <option value="${window.TCISearch.escapeHtml(item.email)}" data-role="${window.TCISearch.escapeHtml(item.role)}">
        ${window.TCISearch.escapeHtml(item.email)}｜${window.TCISearch.escapeHtml(item.role)}
      </option>
    `).join('');
    resetSelect.innerHTML = '<option value="">請選擇使用者</option>' + roleAssignments.map((item) => `
      <option value="${window.TCISearch.escapeHtml(item.email)}">${window.TCISearch.escapeHtml(item.email)}｜${window.TCISearch.escapeHtml(item.role)}</option>
    `).join('');
    if (roleAssignments.some((item) => item.email === selectedEmail)) {
      select.value = selectedEmail;
    }
    if (roleAssignments.some((item) => item.email === selectedResetEmail)) {
      resetSelect.value = selectedResetEmail;
    }
  }

  function syncSelectedUserRole() {
    const email = field('roleEmailInput').value;
    const selected = roleAssignments.find((item) => item.email === email);
    if (selected) {
      field('roleSelect').value = selected.role;
    }
  }

  async function loadRoleAssignments() {
    roleAssignments = await window.TCIApi.listUserRoleAssignments();
    renderRoleSelect();
    syncSelectedUserRole();
    renderRolesTable();
  }

  function bindRoleForm() {
    field('createUserForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = field('newUserEmailInput').value.trim();
      const password = field('newUserPasswordInput').value;
      const role = field('newUserRoleSelect').value;
      try {
        createUserMessage('建立中...');
        const created = await window.TCIApi.createUserAccount(email, password, role);
        createUserMessage(created?.fallback
          ? '帳號已建立，角色已完成指派。若帳號尚未驗證，請使用者依信件完成驗證。'
          : '帳號已建立，角色已完成指派。', 'success');
        field('createUserForm').reset();
        await loadRoleAssignments();
      } catch (error) {
        createUserMessage(error.message, 'error');
      }
    });

    field('roleForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = field('roleEmailInput').value;
      const role = field('roleSelect').value;
      if (!email) {
        roleMessage('請先選擇使用者。', 'error');
        return;
      }
      try {
        roleMessage('儲存中...');
        await window.TCIApi.assignUserRoleByEmail(email, role);
        roleMessage('角色已更新。', 'success');
        await loadRoleAssignments();
      } catch (error) {
        roleMessage(error.message, 'error');
      }
    });

    field('roleEmailInput').addEventListener('change', syncSelectedUserRole);

    field('deleteUserButton').addEventListener('click', async () => {
      const email = field('roleEmailInput').value;
      if (!email) {
        roleMessage('請先選擇使用者。', 'error');
        return;
      }
      if (!confirm(`確定要刪除 ${email}？此動作會移除登入帳號與角色設定。`)) return;
      try {
        field('deleteUserButton').disabled = true;
        roleMessage('刪除中...');
        await window.TCIApi.deleteUserByEmail(email);
        roleMessage('帳號已刪除。', 'success');
        field('roleForm').reset();
        await loadRoleAssignments();
      } catch (error) {
        roleMessage(error.message, 'error');
      } finally {
        field('deleteUserButton').disabled = false;
      }
    });

    field('resetPasswordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = field('resetPasswordEmailInput').value;
      const password = field('managedNewPasswordInput').value;
      if (!email) {
        resetPasswordMessage('請先選擇使用者。', 'error');
        return;
      }
      if (password.length < 6) {
        resetPasswordMessage('新密碼至少需要 6 碼。', 'error');
        return;
      }
      if (!confirm(`確定要重設 ${email} 的密碼？`)) return;
      try {
        field('resetPasswordButton').disabled = true;
        resetPasswordMessage('重設中...');
        await window.TCIApi.resetUserPasswordByEmail(email, password);
        resetPasswordMessage('密碼已重設。', 'success');
        field('resetPasswordForm').reset();
      } catch (error) {
        resetPasswordMessage(error.message, 'error');
      } finally {
        field('resetPasswordButton').disabled = false;
      }
    });
  }

  async function initUsers() {
    const auth = await window.TCIAuth.requireShipping();
    if (!auth) return;
    if (auth.role !== 'admin') {
      location.href = 'index.html';
      return;
    }
    bindRoleForm();
    try {
      await loadRoleAssignments();
    } catch (error) {
      roleMessage(`角色管理尚未啟用：${error.message}`, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'users') {
      initUsers().catch((error) => roleMessage(error.message, 'error'));
    }
  });
})();

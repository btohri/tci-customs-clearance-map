(function () {
  'use strict';

  const shippingRoles = ['shipping', 'admin'];

  function isLoginPage() {
    return document.body.dataset.page === 'login';
  }

  function loginUrl() {
    return location.pathname.includes('/admin/') ? '../login.html' : 'login.html';
  }

  function indexUrl() {
    return location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
  }

  async function signIn(email, password) {
    return window.TCIApi.signIn(email, password);
  }

  async function signOut() {
    await window.TCIApi.signOut();
    location.href = loginUrl();
  }

  async function updatePassword(newPassword) {
    return window.TCIApi.updatePassword(newPassword);
  }

  async function getCurrentUser() {
    return window.TCIApi.getCurrentUser();
  }

  async function getUserRole(userId) {
    return window.TCIApi.getUserRole(userId);
  }

  async function requireAuth() {
    const session = await window.TCIApi.getSession();
    if (!session) {
      location.href = loginUrl();
      return null;
    }
    const role = await getUserRole(session.user.id);
    window.TCIAuth.currentUser = session.user;
    window.TCIAuth.currentRole = role;
    renderUser(session.user, role);
    return { user: session.user, role };
  }

  async function requireShipping() {
    const auth = await requireAuth();
    if (!auth) return null;
    if (!shippingRoles.includes(auth.role)) {
      location.href = indexUrl();
      return null;
    }
    return auth;
  }

  function renderUser(user, role) {
    const userMeta = document.getElementById('userMeta');
    const adminNavLink = document.getElementById('adminNavLink');
    if (userMeta) userMeta.textContent = `${user.email}｜${role}`;
    if (adminNavLink) adminNavLink.hidden = !shippingRoles.includes(role);
  }

  async function initLoginPage() {
    const message = document.getElementById('loginMessage');
    try {
      const session = await window.TCIApi.getSession();
      if (session) {
        location.href = 'index.html';
        return;
      }
    } catch (error) {
      message.textContent = error.message;
      message.className = 'message error';
    }

    document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '登入中...';
      message.className = 'message';
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      try {
        await signIn(email, password);
        message.textContent = '登入成功，正在前往查詢頁。';
        message.className = 'message success';
        location.href = 'index.html';
      } catch (error) {
        message.textContent = error.message;
        message.className = 'message error';
      }
    });
  }

  function bindSignOut() {
    document.getElementById('signOutButton')?.addEventListener('click', signOut);
  }

  function setPasswordMessage(text, type = '') {
    const message = document.getElementById('passwordMessage');
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`.trim();
  }

  function closePasswordDialog() {
    const dialog = document.getElementById('passwordDialog');
    const form = document.getElementById('passwordForm');
    if (!dialog) return;
    dialog.hidden = true;
    form?.reset();
    setPasswordMessage('');
  }

  function bindPasswordDialog() {
    const dialog = document.getElementById('passwordDialog');
    const form = document.getElementById('passwordForm');
    const openButton = document.getElementById('changePasswordButton');
    if (!dialog || !form || !openButton) return;

    openButton.addEventListener('click', () => {
      dialog.hidden = false;
      document.getElementById('newPassword')?.focus();
    });

    document.getElementById('cancelPasswordButton')?.addEventListener('click', closePasswordDialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closePasswordDialog();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      if (newPassword.length < 6) {
        setPasswordMessage('新密碼至少需要 6 碼。', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordMessage('兩次輸入的密碼不一致。', 'error');
        return;
      }
      try {
        setPasswordMessage('更新中...');
        await updatePassword(newPassword);
        setPasswordMessage('密碼已更新。', 'success');
        setTimeout(closePasswordDialog, 900);
      } catch (error) {
        setPasswordMessage(error.message, 'error');
      }
    });
  }

  window.TCIAuth = {
    currentUser: null,
    currentRole: 'user',
    signIn,
    signOut,
    updatePassword,
    getCurrentUser,
    getUserRole,
    requireAuth,
    requireShipping
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (isLoginPage()) {
      initLoginPage();
    } else {
      bindSignOut();
      bindPasswordDialog();
    }
  });
})();

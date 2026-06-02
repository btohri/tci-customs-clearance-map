(function () {
  'use strict';

  const shippingRoles = ['shipping', 'admin'];

  function isLoginPage() {
    return document.body.dataset.page === 'login';
  }

  function isRegisterPage() {
    return document.body.dataset.page === 'register';
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

  async function signUp(email, password) {
    return window.TCIApi.signUp(email, password);
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

  function authErrorMessage(error) {
    const message = String(error?.message || '');
    const errorText = (() => {
      try {
        return JSON.stringify(error || {});
      } catch {
        return '';
      }
    })();
    const lowerMessage = message.toLowerCase();
    const lowerErrorText = errorText.toLowerCase();
    if (lowerMessage.includes('email rate limit exceeded')) {
      return '驗證信寄送次數過多，請稍後再試；若急需開通，請請 Admin 從後台建立帳號。';
    }
    if (lowerMessage.includes('user already registered') || lowerMessage.includes('already registered')) {
      return '此 Email 已註冊，請直接回到登入頁登入。';
    }
    if (lowerMessage.includes('signup is disabled')) {
      return '目前系統未開放自助註冊，請請 Admin 協助建立帳號。';
    }
    if (lowerMessage.includes('invalid email')) {
      return 'Email 格式不正確，請確認後再送出。';
    }
    if (lowerMessage.includes('password')) {
      return '密碼不符合系統規則，請至少輸入 6 碼。';
    }
    if (
      !message ||
      message === '{}' ||
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('retryable') ||
      lowerErrorText.includes('authretryablefetcherror') ||
      errorText === '{}'
    ) {
      return '註冊服務暫時無法送出驗證信，請確認 Supabase SMTP / Email 驗證設定，或請 Admin 從後台建立帳號。';
    }
    return message || '操作失敗，請稍後再試。';
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

  async function initRegisterPage() {
    const message = document.getElementById('registerMessage');
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

    document.getElementById('registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = document.getElementById('registerSubmitButton');
      message.textContent = '建立帳號中...';
      message.className = 'message';
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('registerConfirmPassword').value;

      if (password.length < 6) {
        message.textContent = '密碼至少需要 6 碼。';
        message.className = 'message error';
        return;
      }
      if (password !== confirmPassword) {
        message.textContent = '兩次輸入的密碼不一致。';
        message.className = 'message error';
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        const data = await signUp(email, password);
        if (data.session) {
          message.textContent = '註冊成功，正在前往查詢頁。';
          message.className = 'message success';
          location.href = 'index.html';
          return;
        }
        message.textContent = '註冊成功，請依信件完成驗證後再登入。';
        message.className = 'message success';
        document.getElementById('registerForm').reset();
      } catch (error) {
        message.textContent = authErrorMessage(error);
        message.className = 'message error';
      } finally {
        if (submitButton) submitButton.disabled = false;
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
    signUp,
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
    } else if (isRegisterPage()) {
      initRegisterPage();
    } else {
      bindSignOut();
      bindPasswordDialog();
    }
  });
})();

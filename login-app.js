(() => {
  // ---------- Captcha ----------
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genCaptcha(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  let captchaCode = '';
  function renderCaptcha() {
    captchaCode = genCaptcha();
    const el = document.getElementById('captchaImg');
    if (!el) return;
    el.innerHTML = '';
    [...captchaCode].forEach((c, i) => {
      const span = document.createElement('span');
      span.textContent = c;
      const rot = (Math.random() * 24 - 12).toFixed(1);
      const dy  = (Math.random() * 6 - 3).toFixed(1);
      span.style.transform = `rotate(${rot}deg) translateY(${dy}px)`;
      span.style.color = i % 2 ? 'var(--brand-700)' : 'var(--brand-500)';
      el.appendChild(span);
    });
  }

  if (document.getElementById('captchaImg')) {
    renderCaptcha();
  }

  const refreshBtn = document.getElementById('refreshCaptcha');
  if (refreshBtn) refreshBtn.addEventListener('click', renderCaptcha);

  // Show/hide password
  const pwd = document.getElementById('password');
  const eye = document.getElementById('eye');
  const togglePwd = document.getElementById('togglePwd');
  if (togglePwd && pwd && eye) {
    togglePwd.addEventListener('click', () => {
      const isPwd = pwd.type === 'password';
      pwd.type = isPwd ? 'text' : 'password';
      eye.innerHTML = isPwd
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    });
  }

  // Submit
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('alert');
      const alertMsg = document.getElementById('alertMsg');
      const u = document.getElementById('username').value.trim();
      const p = pwd ? pwd.value : '';
      const c = document.getElementById('captcha').value.trim();

      if (!u || !p) {
        if (alertMsg && alertBox) {
          alertMsg.textContent = 'Please enter username and password.';
          alertBox.classList.add('show');
        }
        return;
      }
      if (c.toUpperCase() !== captchaCode) {
        if (alertMsg && alertBox) {
          alertMsg.textContent = 'Captcha incorrect. Please try again.';
          alertBox.classList.add('show');
        }
        renderCaptcha();
        const captchaInput = document.getElementById('captcha');
        if (captchaInput) captchaInput.value = '';
        return;
      }
      if (alertBox) alertBox.classList.remove('show');
      // Mock success — go to order page
      window.location.href = 'order.html';
    });
  }

  const forgotBtn = document.getElementById('forgot');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('A password reset link would be sent to the email associated with your username.');
    });
  }

  // ---------- Demo Mode ----------
  const isDemoMode = localStorage.getItem('pos_demo_mode') === 'true';

  if (isDemoMode) {
    // Show demo notice banner
    const demoNotice = document.getElementById('demoNotice');
    if (demoNotice) demoNotice.classList.add('show');

    // Show Skip Login button and divider
    const skipBtn = document.getElementById('btnSkipLogin');
    const skipDivider = document.getElementById('skipDivider');
    if (skipBtn) skipBtn.style.display = 'flex';
    if (skipDivider) skipDivider.style.display = 'flex';

    // Pre-fill credentials for demo
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    if (usernameEl) usernameEl.value = 'demo';
    if (passwordEl) passwordEl.value = 'demo1234';

    // Auto-fill captcha with correct value (bypass captcha in demo)
    const captchaEl = document.getElementById('captcha');
    if (captchaEl) captchaEl.value = captchaCode;

    // Skip Login — instant bypass
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        window.location.href = 'order.html';
      });
    }
  }
})();

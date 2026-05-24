(() => {
  // DOM Helpers
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  // Load User Data
  function loadCurrentUser() {
    const user = JSON.parse(localStorage.getItem('pos_current_user')) || {
      name: 'Agus Prasetyo',
      role: 'Super Admin',
      email: 'agus.p@bluepoint.id',
      store: 'Store #04',
      phone: '+62 812-1111-2222'
    };
    return user;
  }

  // Populate Store Dropdown
  function populateStoreOptions() {
    const storeSelect = $('#profileStore');
    if (!storeSelect) return;
    storeSelect.innerHTML = '';

    let stores = [];
    try {
      stores = JSON.parse(localStorage.getItem('pos_stores')) || [];
    } catch(e) {}

    if (stores.length === 0) {
      // Default fallback stores
      stores = [
        { name: 'Store #01' },
        { name: 'Store #02' },
        { name: 'Store #03' },
        { name: 'Store #04' }
      ];
    }

    stores.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      storeSelect.appendChild(opt);
    });
  }

  // Bind Form Values
  function bindProfileForm() {
    const user = loadCurrentUser();
    $('#profileName').value = user.name || '';
    $('#profileEmail').value = user.email || '';
    $('#profileRole').value = user.role || 'Super Admin';
    $('#profileStore').value = user.store || 'Store #04';
    $('#profilePhone').value = user.phone || '';

    // Load Preferences
    let prefs = { autoPrint: false, sound: true };
    try {
      prefs = JSON.parse(localStorage.getItem('pos_preferences')) || prefs;
    } catch(e) {}

    $('#prefAutoPrint').checked = prefs.autoPrint;
    $('#prefSound').checked = prefs.sound;
  }

  // Save changes to localStorage
  function saveProfileData() {
    const name = $('#profileName').value.trim();
    const email = $('#profileEmail').value.trim();
    const role = $('#profileRole').value;
    const store = $('#profileStore').value;
    const phone = $('#profilePhone').value.trim();

    const currentUser = { name, email, role, store, phone };
    localStorage.setItem('pos_current_user', JSON.stringify(currentUser));
    updateSidebarUser();
  }

  // Update bottom left profile block
  function updateSidebarUser() {
    const sideUser = document.querySelector('.side-user');
    if (!sideUser) return;

    const user = loadCurrentUser();
    const avatarEl = sideUser.querySelector('.avatar');
    const nameEl = sideUser.querySelector('.name');
    const roleEl = sideUser.querySelector('.role');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = `${user.role} · ${user.store || 'Store #04'}`;

    if (avatarEl) {
      const nameParts = user.name.split(/\s+/).filter(Boolean).slice(0, 2);
      const initials = nameParts.map(s => s[0].toUpperCase()).join('');
      avatarEl.textContent = initials || 'SA';
    }
  }

  function savePreferences() {
    const autoPrint = $('#prefAutoPrint').checked;
    const sound = $('#prefSound').checked;

    localStorage.setItem('pos_preferences', JSON.stringify({ autoPrint, sound }));
    showToast('Preferences updated.');
  }

  // Show toast notification
  function showToast(msg) {
    const toast = $('#toast');
    const toastMsg = $('#toastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Sidebar navigation click handler
  function setupNavigation() {
    $$('#nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.hasAttribute('onclick') || item.getAttribute('onclick')) return;
        const label = Array.from(item.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(Boolean).join(' ').trim();
        if (label === 'Order') {
          window.location.href = 'order.html';
          return;
        }
        if (label === 'Summary Report') {
          window.location.href = 'report-summary.html';
          return;
        }
        if (label === 'Detail Report') {
          window.location.href = 'report-detail.html';
          return;
        }
        if (label === 'Products & Inventory') {
          window.location.href = 'inventory.html';
          return;
        }
        if (label === 'Customer') {
          window.location.href = 'customer.html';
          return;
        }
        if (label === 'Promo & Discount') {
          window.location.href = 'promo.html';
          return;
        }
        if (label === 'Store List') {
          window.location.href = 'store.html';
          return;
        }
        if (label === 'Staff List') {
          window.location.href = 'staff.html';
          return;
        }
      });
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    populateStoreOptions();
    bindProfileForm();
    updateSidebarUser();
    setupNavigation();

    // Bind form auto-save events
    const profileInputs = ['#profileName', '#profileEmail', '#profileRole', '#profileStore', '#profilePhone'];
    profileInputs.forEach(selector => {
      const el = $(selector);
      if (el) {
        el.addEventListener('input', saveProfileData);
        el.addEventListener('change', saveProfileData);
      }
    });

    // Preferences auto-save
    $('#prefAutoPrint').addEventListener('change', savePreferences);
    $('#prefSound').addEventListener('change', savePreferences);

    // Factory Reset
    $('#btnFactoryReset').addEventListener('click', () => {
      if (confirm('Are you sure you want to perform a factory reset? This will wipe all local storage databases and re-seed defaults.')) {
        localStorage.clear();
        showToast('System reset complete. Re-seeding...');
        setTimeout(() => {
          window.location.href = 'order.html';
        }, 1200);
      }
    });

    // Logout
    $('#btnLogout').addEventListener('click', () => {
      if (confirm('Are you sure you want to log out from this session?')) {
        window.location.href = 'login.html';
      }
    });

    // ---------- Demo Mode ----------
    const isDemoMode = localStorage.getItem('pos_demo_mode') === 'true';
    const demoBannerBlock = document.getElementById('demoBannerBlock');
    if (isDemoMode && demoBannerBlock) {
      demoBannerBlock.style.display = 'block';
    }

    const btnResetDemo = document.getElementById('btnResetDemo');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', () => {
        if (confirm('Reset all demo data to original state? The page will reload.')) {
          // Clear everything
          localStorage.clear();
          // Restore demo mode flag so the banner reappears after reload
          localStorage.setItem('pos_demo_mode', 'true');
          showToast('Demo data reset! Re-seeding...');
          setTimeout(() => {
            window.location.href = 'order.html';
          }, 900);
        }
      });
    }
  });
})();


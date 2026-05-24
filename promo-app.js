(() => {
  // Helper functions
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  // Local state
  let promos = {};
  let orders = [];
  let products = [];

  const todayStr = '2026-05-22'; // Hardcoded reference date for "today" to match app state

  // ============ Price Parsing & Formatting ============
  const parsePrice = val => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/Rp/gi, '').replace(/\s+/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const formatPriceField = val => {
    const num = parsePrice(val);
    if (num % 1 === 0) {
      return 'Rp\u00A0' + num.toLocaleString('en-US');
    } else {
      return 'Rp\u00A0' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  const fmt = n => formatPriceField(n);

  // ============ Load Data ============
  function loadData() {
    // Load promos
    if (localStorage.getItem('pos_promos')) {
      try {
        promos = JSON.parse(localStorage.getItem('pos_promos'));
      } catch (e) {
        console.error('Error parsing pos_promos', e);
        promos = {};
      }
    } else {
      // Fallback fallback if order-data.js didn't seed yet
      promos = {
        'SAVE10':   { kind: 'percent', value: 0.10, description: '10% off on all items' },
        'WELCOME5': { kind: 'amount',  value: 5.00,  description: 'Rp 5.00 flat discount' },
        'STAFF15':  { kind: 'percent', value: 0.15, description: 'Staff discount 15%' }
      };
      localStorage.setItem('pos_promos', JSON.stringify(promos));
    }

    // Load orders
    try {
      orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    } catch (e) {
      console.error('Error parsing pos_orders', e);
      orders = [];
    }

    // Load products
    try {
      products = JSON.parse(localStorage.getItem('pos_products') || '[]');
    } catch (e) {
      console.error('Error parsing pos_products', e);
      products = [];
    }
    if (products.length === 0 && window.POS_DATA && window.POS_DATA.PRODUCTS) {
      products = window.POS_DATA.PRODUCTS;
    }
  }

  // ============ Toast Notification ============
  function showToast(msg, isError = false) {
    const toast = $('#toast');
    const msgEl = $('#toastMsg');
    msgEl.textContent = msg;

    const iconSvg = toast.querySelector('.icon');
    if (isError) {
      iconSvg.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger-500)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      toast.style.background = '#FEE2E2';
      toast.style.color = '#991B1B';
    } else {
      iconSvg.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      toast.style.background = '#111827';
      toast.style.color = '#fff';
    }

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ============ Calculate & Render Today Metrics ============
  function renderMetrics() {
    const todayOrders = orders.filter(o => {
      if (!o.date) return false;
      return o.date.slice(0, 10) === todayStr;
    });

    let totalDiscountApplied = 0;
    let amountDiscountApplied = 0;

    todayOrders.forEach(o => {
      if (o.promoCode && o.promoDiscount > 0) {
        totalDiscountApplied++;
        amountDiscountApplied += o.promoDiscount;
      }
    });

    $('#metricAppliedCount').textContent = totalDiscountApplied;
    $('#metricSavingsAmount').innerHTML = fmt(amountDiscountApplied);
  }


  // ============ Render Promotions Table ============
  function renderTable() {
    const query = $('#promoSearchInput').value.trim().toLowerCase();
    const tbody = $('#promoTableBody');
    tbody.innerHTML = '';

    const promoKeys = Object.keys(promos);
    let filteredKeys = promoKeys.filter(key => {
      const promo = promos[key];
      if (!query) return true;
      const name = (promo.name || '').toLowerCase();
      const desc = (promo.description || '').toLowerCase();
      return key.toLowerCase().includes(query) || name.includes(query) || desc.includes(query);
    });

    // Update count summary
    $('#promoCountSummary').textContent = `${filteredKeys.length} promotion${filteredKeys.length !== 1 ? 's' : ''} found`;

    if (filteredKeys.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--gray-400); padding: 40px 20px;">
            No promotions found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    filteredKeys.forEach(code => {
      const promo = promos[code];
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return;
        window.location.href = `add-promo.html?code=${encodeURIComponent(code)}`;
      });

      // Value display format
      let valueDisplay = '';
      if (promo.kind === 'percent') {
        valueDisplay = `${Math.round(promo.value * 100)}%`;
      } else {
        valueDisplay = fmt(promo.value);
      }

      // Type display format
      const typeDisplay = promo.kind === 'percent' ? 'Percentage Off (%)' : 'Fixed Amount (Rp)';
      const typeBadgeClass = promo.kind === 'percent' ? 'badge-brand' : 'badge-success';

      // Scope display format
      const scopeVal = promo.scope || 'transaction';
      let scopeDisplay = '';
      if (scopeVal === 'product') {
        const prodIds = promo.products || [];
        const prodNames = prodIds.map(pid => {
          const p = products.find(prod => prod.id === pid);
          return p ? `${p.emoji || '📦'} ${p.name}` : pid;
        }).join(', ');
        scopeDisplay = `
          <span class="badge badge-brand" style="margin-bottom: 2px;">Product-specific</span>
          <div style="font-size: 11px; color: var(--gray-500); line-height: 1.3;" title="${prodNames}">
            ${prodNames || 'No products selected'}
          </div>
        `;
      } else {
        scopeDisplay = `<span class="badge badge-success">Transaction (Whole Bill)</span>`;
      }

      // Store display format
      const storeList = promo.stores || ['Store #01', 'Store #02', 'Store #03', 'Store #04'];
      let storeDisplay = '';
      if (storeList.length > 1) {
        storeDisplay = `<span style="font-weight: 500;">${storeList.length} Stores</span>`;
      } else if (storeList.length === 1) {
        storeDisplay = `<span style="font-weight: 500;">${storeList[0]}</span>`;
      } else {
        storeDisplay = `<span style="color: var(--gray-400);">None</span>`;
      }

      // Status display format
      const isActive = promo.active !== false;
      const statusDisplay = isActive
        ? `<span class="badge badge-success">Active</span>`
        : `<span class="badge" style="background: var(--gray-100); color: var(--gray-600);">Inactive</span>`;

      row.innerHTML = `
        <td>
          <div style="font-weight: 600; font-size: 14px; color: var(--gray-900);">${promo.name || code}</div>
        </td>
        <td>
          <span class="promo-code-badge">${code}</span>
        </td>
        <td>
          <span class="badge ${typeBadgeClass}">${typeDisplay}</span>
        </td>
        <td class="col-value">${valueDisplay}</td>
        <td>${scopeDisplay}</td>
        <td>${storeDisplay}</td>
        <td>${statusDisplay}</td>
        <td class="col-actions">
          <button class="delete-btn" data-code="${code}">Delete</button>
        </td>
      `;

      tbody.appendChild(row);
    });

    // Attach delete listeners
    $$('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent triggering row click
        const codeToDelete = e.target.dataset.code;
        if (confirm(`Are you sure you want to delete promo code "${codeToDelete}"?`)) {
          delete promos[codeToDelete];
          localStorage.setItem('pos_promos', JSON.stringify(promos));
          loadData();
          renderTable();
          renderMetrics();
          showToast(`Promo code "${codeToDelete}" deleted`);
        }
      });
    });
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    // Toolbar Search
    $('#promoSearchInput').addEventListener('input', () => {
      renderTable();
    });
  }

  // ============ Sidebar Navigation clicks ============
  function setupNavigation() {
    $$('#nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.hasAttribute('onclick') || item.getAttribute('onclick')) return;
        if (item.classList.contains('active')) return;
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
        showToast(`${label} screen — coming next`);
      });
    });
  }

  // ============ Init ============
  function init() {
    loadData();
    renderMetrics();
    renderTable();
    setupEvents();
    setupNavigation();

    // Check for toast message on redirect
    const redirectedToastMsg = sessionStorage.getItem('promo_toast_msg');
    if (redirectedToastMsg) {
      showToast(redirectedToastMsg);
      sessionStorage.removeItem('promo_toast_msg');
    }
  }

  // Run on page load
  window.addEventListener('DOMContentLoaded', init);

})();

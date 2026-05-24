(() => {
  // Helper functions
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  // Local state
  let promos = {};
  let products = [];
  let editCode = null;
  let isEditMode = false;

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

  // ============ Load Data ============
  function loadData() {
    // Load promos
    try {
      promos = JSON.parse(localStorage.getItem('pos_promos') || '{}');
    } catch (e) {
      console.error('Error parsing pos_promos', e);
      promos = {};
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

  // ============ Category Name Helper ============
  function getCategoryName(catId) {
    const cats = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
    const found = cats.find(c => c.id === catId);
    return found ? found.name : 'Uncategorized';
  }

  // ============ Populate Product Checklist ============
  function populateProductChecklist(selectedProductIds = []) {
    const listContainer = $('#promoProductList');
    listContainer.innerHTML = '';
    if (products.length === 0) {
      listContainer.innerHTML = '<div style="color: var(--gray-400); font-size: 12px; padding: 10px; text-align: center;">No products available</div>';
      return;
    }
    products.forEach(p => {
      const item = document.createElement('label');
      item.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: background 100ms;';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--gray-50)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      
      const skuVal = p.sku || `SKU-${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${p.id.toUpperCase()}`;
      const catName = getCategoryName(p.cat);
      
      item.dataset.name = p.name.toLowerCase();
      item.dataset.sku = skuVal.toLowerCase();
      item.dataset.category = catName.toLowerCase();
      
      const isChecked = selectedProductIds.includes(p.id);
      
      item.innerHTML = `
        <input type="checkbox" name="promoProducts" value="${p.id}" ${isChecked ? 'checked' : ''} />
        <span style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-weight: 500;">${p.emoji || '📦'} ${p.name}</span>
          <span style="font-size: 11px; color: var(--gray-400);">${skuVal} &middot; ${catName}</span>
        </span>
      `;
      listContainer.appendChild(item);
    });
  }

  // ============ Filter Product Checklist ============
  function filterProductChecklist() {
    const query = $('#promoProductSearchInput').value.trim().toLowerCase();
    const listContainer = $('#promoProductList');
    const items = listContainer.querySelectorAll('label');
    
    let visibleCount = 0;
    items.forEach(item => {
      const name = item.dataset.name || '';
      const sku = item.dataset.sku || '';
      const category = item.dataset.category || '';
      
      if (!query || name.includes(query) || sku.includes(query) || category.includes(query)) {
        item.style.display = 'flex';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    let noResultsEl = $('#promoProductNoResults');
    if (visibleCount === 0) {
      if (!noResultsEl) {
        noResultsEl = document.createElement('div');
        noResultsEl.id = 'promoProductNoResults';
        noResultsEl.style.cssText = 'color: var(--gray-400); font-size: 12px; padding: 10px; text-align: center;';
        noResultsEl.textContent = 'No matching products';
        listContainer.appendChild(noResultsEl);
      }
    } else {
      if (noResultsEl) {
        noResultsEl.remove();
      }
    }
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    // Cancel buttons
    $('#cancelPromoBtn').addEventListener('click', () => {
      window.location.href = 'promo.html';
    });

    // Escape key redirects back to list
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.location.href = 'promo.html';
      }
    });

    // Product checklist search input
    $('#promoProductSearchInput').addEventListener('input', filterProductChecklist);

    // Scope change toggle
    $$('input[name="promoScope"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const productSection = $('#productSelectSection');
        if (e.target.value === 'product') {
          productSection.style.display = 'block';
        } else {
          productSection.style.display = 'none';
        }
      });
    });

    // Select Type change hints
    $('#promoTypeSelect').addEventListener('change', (e) => {
      const valInput = $('#promoValueInput');
      const hint = $('#promoValueHint');
      valInput.value = '';
      if (e.target.value === 'percent') {
        hint.textContent = 'For percentage off, enter standard number (e.g. 10 = 10% off).';
        valInput.placeholder = 'e.g. 10';
      } else {
        hint.textContent = 'For fixed discount, enter price value (e.g. 5000 = Rp 5,000).';
        valInput.placeholder = 'e.g. Rp 5,000';
      }
    });

    // Input blur formatter
    $('#promoValueInput').addEventListener('blur', (e) => {
      const type = $('#promoTypeSelect').value;
      if (type === 'amount' && e.target.value.trim()) {
        e.target.value = formatPriceField(e.target.value);
      }
    });

    // Form Submission
    $('#promoForm').addEventListener('submit', (e) => {
      e.preventDefault();

      const name = $('#promoNameInput').value.trim();
      const code = $('#promoCodeInput').value.trim().toUpperCase();
      const type = $('#promoTypeSelect').value;
      const rawVal = $('#promoValueInput').value.trim();
      const scope = $('input[name="promoScope"]:checked').value;
      const desc = $('#promoDescInput').value.trim();
      const active = $('#promoStatusToggle').checked;

      // Selected products
      const selectedProducts = Array.from($$('input[name="promoProducts"]:checked')).map(cb => cb.value);

      // Selected stores
      const selectedStores = Array.from($$('input[name="promoStores"]:checked')).map(cb => cb.value);

      if (!name) {
        showToast('Discount name is required', true);
        return;
      }
      if (!code) {
        showToast('Promo code is required', true);
        return;
      }

      // Check uniqueness only if not in edit mode
      if (!isEditMode && promos[code]) {
        showToast(`Promo code "${code}" already exists`, true);
        return;
      }

      const numValue = parsePrice(rawVal);

      // Validation check
      if (isNaN(numValue) || numValue <= 0) {
        showToast('Discount value must be a positive number', true);
        return;
      }

      if (type === 'percent' && numValue > 100) {
        showToast('Percentage discount cannot exceed 100%', true);
        return;
      }

      // If scope is product, check that at least one product is selected
      if (scope === 'product' && selectedProducts.length === 0) {
        showToast('Please select at least one product for this discount', true);
        return;
      }

      // Check that at least one store is selected
      if (selectedStores.length === 0) {
        showToast('Please select at least one store location', true);
        return;
      }

      // Store fractional value for percentages, direct numeric for fixed amounts
      const storedValue = type === 'percent' ? numValue / 100 : numValue;
      const displayValue = type === 'percent' ? `${numValue}%` : formatPriceField(numValue);

      promos[code] = {
        name,
        code,
        kind: type,
        value: storedValue,
        scope,
        products: scope === 'product' ? selectedProducts : [],
        stores: selectedStores,
        description: desc || `${displayValue} off promotional code`,
        active
      };

      // Persist & Redirect
      localStorage.setItem('pos_promos', JSON.stringify(promos));
      sessionStorage.setItem('promo_toast_msg', isEditMode ? `Promo code "${code}" updated successfully` : `Promo code "${code}" created successfully`);
      window.location.href = 'promo.html';
    });
  }

  // ============ Sidebar Navigation clicks ============
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
        showToast(`${label} screen — coming next`);
      });
    });
  }

  // ============ Handle Edit Mode ============
  function handleEditMode() {
    const promo = promos[editCode];
    if (!promo) {
      showToast(`Promo code "${editCode}" not found`, true);
      isEditMode = false;
      editCode = null;
      return;
    }

    // Update Title & Button texts
    $('header.main-head h1').innerHTML = `Edit Promotion <span class="role-badge">Super Admin Mode</span>`;
    $('footer.form-actions-bar button[type="submit"]').textContent = 'Save Changes';

    // Pre-populate details
    $('#promoNameInput').value = promo.name || '';
    $('#promoCodeInput').value = promo.code || editCode;
    $('#promoCodeInput').disabled = true; // Code cannot be edited
    $('#promoTypeSelect').value = promo.kind || 'percent';
    
    // Trigger type change to configure value input format & placeholders
    $('#promoTypeSelect').dispatchEvent(new Event('change'));

    if (promo.kind === 'percent') {
      $('#promoValueInput').value = Math.round(promo.value * 100);
    } else {
      $('#promoValueInput').value = formatPriceField(promo.value);
    }

    $('#promoDescInput').value = promo.description || '';
    $('#promoStatusToggle').checked = promo.active !== false;

    // Pre-populate scope
    const scope = promo.scope || 'transaction';
    const radio = $(`input[name="promoScope"][value="${scope}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }

    // Pre-populate stores
    const stores = promo.stores || ['Store #01', 'Store #02', 'Store #03', 'Store #04'];
    $$('input[name="promoStores"]').forEach(cb => {
      cb.checked = stores.includes(cb.value);
    });

    // Pre-populate products
    if (scope === 'product') {
      populateProductChecklist(promo.products || []);
    }
  }

  // ============ Init ============
  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    editCode = urlParams.get('code');
    isEditMode = !!editCode;

    loadData();
    populateProductChecklist();
    setupEvents();
    setupNavigation();

    if (isEditMode) {
      handleEditMode();
    }
  }

  // Run on page load
  window.addEventListener('DOMContentLoaded', init);

})();

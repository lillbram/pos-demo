(() => {
  // Helper selectors
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  // Helper: Get initials for avatar
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  // Default initial data for stores and staff to seed if not in localStorage
  const DEFAULT_STORES = [
    { id: 's01', name: 'Store #01', address: '123 Main St', phone: '+1 415-555-0101' },
    { id: 's02', name: 'Store #02', address: '456 Elm St', phone: '+1 415-555-0102' },
    { id: 's03', name: 'Store #03', address: '789 Pine St', phone: '+1 415-555-0103' },
    { id: 's04', name: 'Store #04', address: '123 Market St', phone: '+1 415-555-0123' },
  ];

  const DEFAULT_STAFF = [
    { id: 'st01', name: 'Super Admin', role: 'Admin', email: 'admin@bluepoint.com', phone: '+1 415-555-0199', stores: ['Store #01', 'Store #02', 'Store #03', 'Store #04'], active: true },
    { id: 'st02', name: 'Sarah Connor', role: 'Manager', email: 'sarah.c@bluepoint.com', phone: '+1 415-555-0155', stores: ['Store #04'], active: true },
    { id: 'st03', name: 'John Doe', role: 'Cashier', email: 'john.d@bluepoint.com', phone: '+1 415-555-0144', stores: ['Store #01', 'Store #02'], active: true },
    { id: 'st04', name: 'Jane Smith', role: 'Cashier', email: 'jane.s@bluepoint.com', phone: '+1 415-555-0133', stores: ['Store #02', 'Store #03'], active: true },
  ];

  // Local State
  let stores = [];
  try {
    stores = JSON.parse(localStorage.getItem('pos_stores'));
  } catch (e) {}
  if (!stores || !stores.length) {
    stores = DEFAULT_STORES;
    localStorage.setItem('pos_stores', JSON.stringify(stores));
  }

  let staff = [];
  try {
    staff = JSON.parse(localStorage.getItem('pos_staff'));
  } catch (e) {}
  if (!staff || !staff.length) {
    staff = DEFAULT_STAFF;
    localStorage.setItem('pos_staff', JSON.stringify(staff));
  }

  let products = [];
  try {
    products = JSON.parse(localStorage.getItem('pos_products')) || [];
  } catch (e) {}

  let promos = {};
  try {
    promos = JSON.parse(localStorage.getItem('pos_promos')) || {};
  } catch (e) {}

  function saveStores() {
    localStorage.setItem('pos_stores', JSON.stringify(stores));
  }

  function saveStaff() {
    localStorage.setItem('pos_staff', JSON.stringify(staff));
  }

  // --- Connection Calculations ---
  function getStaffForStore(storeName) {
    return staff.filter(s => s.stores && s.stores.includes(storeName));
  }

  function getStockStatsForStore(storeName) {
    try {
      products = JSON.parse(localStorage.getItem('pos_products')) || [];
    } catch (e) {}
    let stockedCount = 0;
    let totalVolume = 0;
    products.forEach(p => {
      if (p.stocks && p.stocks[storeName] !== undefined) {
        const qty = p.stocks[storeName];
        if (qty > 0) {
          stockedCount++;
          totalVolume += qty;
        }
      }
    });
    return { stockedCount, totalVolume };
  }

  function getActivePromosForStore(storeName) {
    try {
      promos = JSON.parse(localStorage.getItem('pos_promos')) || {};
    } catch (e) {}
    const activePromos = [];
    for (const code in promos) {
      const promo = promos[code];
      if (promo && promo.active !== false && promo.stores && promo.stores.includes(storeName)) {
        activePromos.push({ code, ...promo });
      }
    }
    return activePromos;
  }

  // --- Render Functions ---
  function renderDashboardStats() {
    if ($('#metricStoreCount')) {
      $('#metricStoreCount').textContent = stores.length;
    }
    if ($('#metricPromosCount')) {
      let activeCount = 0;
      for (const k in promos) {
        if (promos[k] && promos[k].active !== false) {
          activeCount++;
        }
      }
      $('#metricPromosCount').textContent = activeCount;
    }
    if ($('#metricStockUnits')) {
      let total = 0;
      products.forEach(p => {
        if (p.stocks) {
          for (const sName in p.stocks) {
            total += p.stocks[sName] || 0;
          }
        }
      });
      $('#metricStockUnits').textContent = total;
    }

    if ($('#metricTotalStaff')) {
      $('#metricTotalStaff').textContent = staff.length;
    }
    if ($('#metricActiveStaff')) {
      $('#metricActiveStaff').textContent = staff.filter(s => s.active).length;
    }
    if ($('#metricInactiveStaff')) {
      $('#metricInactiveStaff').textContent = staff.filter(s => !s.active).length;
    }
  }

  function renderStoreList() {
    const tbody = $('#storeTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = $('#storeSearchInput') ? $('#storeSearchInput').value.trim().toLowerCase() : '';
    const filteredStores = stores.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.address.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query)
    );

    if (filteredStores.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--gray-500); padding: 40px;">No stores found</td></tr>`;
      return;
    }

    filteredStores.forEach(s => {
      const staffList = getStaffForStore(s.name);
      const stockStats = getStockStatsForStore(s.name);
      const activePromos = getActivePromosForStore(s.name);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--gray-900);">${s.name}</td>
        <td>${s.address}</td>
        <td>${s.phone}</td>
        <td style="text-align: center;">${staffList.length} staff</td>
        <td style="text-align: center;">${stockStats.stockedCount} items (${stockStats.totalVolume} units)</td>
        <td style="text-align: center;">${activePromos.length} active</td>
        <td style="text-align: right;" class="actions-cell">
          <button class="btn-edit" title="Edit Store" style="background: none; border: none; cursor: pointer; color: var(--brand-600); padding: 4px; border-radius: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-delete" title="Delete Store" style="background: none; border: none; cursor: pointer; color: var(--danger-600); padding: 4px; border-radius: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit') || e.target.closest('.btn-delete')) return;
        openStoreDetailModal(s);
      });

      tr.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openStoreModal(s);
      });

      tr.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete ${s.name}?`)) {
          deleteStore(s.id);
        }
      });

      tbody.appendChild(tr);
    });
  }

  function deleteStore(storeId) {
    const idx = stores.findIndex(s => s.id === storeId);
    if (idx !== -1) {
      const storeName = stores[idx].name;
      stores.splice(idx, 1);
      saveStores();

      // Cascade delete to other entities
      staff.forEach(member => {
        if (member.stores) {
          member.stores = member.stores.filter(stName => stName !== storeName);
        }
      });
      saveStaff();

      for (const code in promos) {
        if (promos[code] && promos[code].stores) {
          promos[code].stores = promos[code].stores.filter(stName => stName !== storeName);
        }
      }
      localStorage.setItem('pos_promos', JSON.stringify(promos));

      products.forEach(p => {
        if (p.stocks) {
          delete p.stocks[storeName];
        }
      });
      localStorage.setItem('pos_products', JSON.stringify(products));

      showToast(`Store "${storeName}" deleted.`);
      renderStoreList();
      renderDashboardStats();
    }
  }

  let activeDetailStore = null;
  let activeSubtab = 'staff';

  function openStoreDetailModal(store) {
    activeDetailStore = store;
    $('#detailStoreName').textContent = store.name;
    $('#detailStoreMeta').textContent = `${store.address} • ${store.phone}`;

    switchSubtab('staff');

    const scrim = $('#storeDetailScrim');
    if (scrim) scrim.classList.add('show');
  }

  function switchSubtab(tab) {
    activeSubtab = tab;
    $$('.store-modal-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-subtab') === tab);
    });

    $('#subtabStaffContent').style.display = tab === 'staff' ? 'block' : 'none';
    $('#subtabInventoryContent').style.display = tab === 'inventory' ? 'block' : 'none';
    $('#subtabPromosContent').style.display = tab === 'promos' ? 'block' : 'none';

    if (tab === 'staff') renderDetailStaff();
    if (tab === 'inventory') renderDetailInventory();
    if (tab === 'promos') renderDetailPromos();
  }

  function renderDetailStaff() {
    const container = $('#detailStaffList');
    if (!container || !activeDetailStore) return;
    container.innerHTML = '';

    const list = getStaffForStore(activeDetailStore.name);
    if (list.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--gray-500); padding: 20px;">No staff assigned to this store</div>`;
      return;
    }

    list.forEach(member => {
      const row = document.createElement('div');
      row.className = 'detail-staff-row';
      row.innerHTML = `
        <div class="detail-staff-info">
          <div class="detail-staff-avatar">${initials(member.name)}</div>
          <div>
            <div class="detail-staff-name">${member.name}</div>
            <div class="detail-staff-role">${member.role}</div>
          </div>
        </div>
        <div style="font-size: 12px; color: var(--gray-600);">${member.email} • ${member.phone}</div>
      `;
      container.appendChild(row);
    });
  }

  function renderDetailInventory() {
    const tbody = $('#detailInventoryTableBody');
    if (!tbody || !activeDetailStore) return;
    tbody.innerHTML = '';

    const query = $('#detailInvSearchInput') ? $('#detailInvSearchInput').value.trim().toLowerCase() : '';
    const filteredProducts = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );

    if (filteredProducts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--gray-500); padding: 20px;">No products found</td></tr>`;
      return;
    }

    filteredProducts.forEach(p => {
      const stock = (p.stocks && p.stocks[activeDetailStore.name] !== undefined) ? p.stocks[activeDetailStore.name] : 0;
      const tr = document.createElement('tr');
      const formattedPrice = typeof p.basePrice === 'number' ?
        (p.basePrice >= 1000 ? 'Rp ' + p.basePrice.toLocaleString('en-US') : '$' + p.basePrice.toFixed(2)) :
        p.basePrice;

      tr.innerHTML = `
        <td style="font-weight: 500;">${p.name}</td>
        <td style="font-family: monospace;">${p.sku || '-'}</td>
        <td>${formattedPrice}</td>
        <td style="text-align: right; font-weight: 600; color: ${stock === 0 ? 'var(--danger-600)' : 'var(--gray-900)'};">${stock}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderDetailPromos() {
    const container = $('#detailPromosList');
    if (!container || !activeDetailStore) return;
    container.innerHTML = '';

    const list = getActivePromosForStore(activeDetailStore.name);
    if (list.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--gray-500); padding: 20px;">No active promos in this store</div>`;
      return;
    }

    list.forEach(promo => {
      const valueText = promo.kind === 'percent' ? `${promo.value * 100}% Off` : `$${promo.value}`;
      const row = document.createElement('div');
      row.className = 'detail-promo-row';
      row.innerHTML = `
        <div>
          <div class="detail-promo-title">${promo.name || promo.description || 'Discount'}</div>
          <div class="detail-promo-desc">${valueText} • scope: ${promo.scope || 'Transaction'}</div>
        </div>
        <div class="detail-promo-code">${promo.code}</div>
      `;
      container.appendChild(row);
    });
  }

  function openStoreModal(store = null) {
    const errorEl = $('#storeModalError');
    if (errorEl) errorEl.style.display = 'none';

    if (store) {
      $('#storeModalTitle').textContent = 'Edit Store';
      $('#storeModalId').value = store.id;
      $('#storeModalName').value = store.name;
      $('#storeModalAddress').value = store.address;
      $('#storeModalPhone').value = store.phone;
    } else {
      $('#storeModalTitle').textContent = 'Add Store';
      $('#storeModalId').value = '';
      $('#storeModalName').value = '';
      $('#storeModalAddress').value = '';
      $('#storeModalPhone').value = '';
    }

    $('#storeModalScrim').classList.add('show');
  }

  function closeStoreModal() {
    $('#storeModalScrim').classList.remove('show');
  }

  function submitStoreModal() {
    const id = $('#storeModalId').value.trim();
    const name = $('#storeModalName').value.trim();
    const address = $('#storeModalAddress').value.trim();
    const phone = $('#storeModalPhone').value.trim();

    const errorEl = $('#storeModalError');
    if (errorEl) errorEl.style.display = 'none';

    if (!name) {
      if (errorEl) {
        errorEl.textContent = 'Store name is required.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (!address) {
      if (errorEl) {
        errorEl.textContent = 'Address is required.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (!phone) {
      if (errorEl) {
        errorEl.textContent = 'Phone number is required.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const duplicate = stores.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== id);
    if (duplicate) {
      if (errorEl) {
        errorEl.textContent = `A store named "${name}" is already registered.`;
        errorEl.style.display = 'block';
      }
      return;
    }

    if (id) {
      const idx = stores.findIndex(s => s.id === id);
      if (idx !== -1) {
        const oldName = stores[idx].name;
        stores[idx].name = name;
        stores[idx].address = address;
        stores[idx].phone = phone;
        saveStores();

        if (oldName !== name) {
          products.forEach(p => {
            if (p.stocks && p.stocks[oldName] !== undefined) {
              p.stocks[name] = p.stocks[oldName];
              delete p.stocks[oldName];
            }
          });
          localStorage.setItem('pos_products', JSON.stringify(products));

          staff.forEach(member => {
            if (member.stores) {
              member.stores = member.stores.map(st => st === oldName ? name : st);
            }
          });
          saveStaff();

          for (const code in promos) {
            if (promos[code] && promos[code].stores) {
              promos[code].stores = promos[code].stores.map(st => st === oldName ? name : st);
            }
          }
          localStorage.setItem('pos_promos', JSON.stringify(promos));
        }
        showToast(`Store "${name}" info saved.`);
      }
    } else {
      const newStore = { id: 's' + String(Date.now()), name, address, phone };
      stores.push(newStore);
      saveStores();

      products.forEach(p => {
        if (!p.stocks) p.stocks = {};
        p.stocks[name] = 0;
      });
      localStorage.setItem('pos_products', JSON.stringify(products));
      showToast(`Store "${name}" added successfully.`);
    }

    closeStoreModal();
    renderStoreList();
    renderDashboardStats();
  }

  // --- Staff Section ---
  function renderStaffList() {
    const tbody = $('#staffTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = $('#staffSearchInput') ? $('#staffSearchInput').value.trim().toLowerCase() : '';
    const filteredStaff = staff.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.role.toLowerCase().includes(query) ||
      (s.phone && s.phone.toLowerCase().includes(query))
    );

    if (filteredStaff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--gray-500); padding: 40px;">No staff members found</td></tr>`;
      return;
    }

    filteredStaff.forEach(s => {
      const tr = document.createElement('tr');
      const storeChips = (s.stores && s.stores.length > 0) ?
        s.stores.map(st => `<span class="store-chip-badge">${st}</span>`).join(' ') :
        '-';

      const statusBadge = s.active ?
        `<span style="background: var(--success-100); color: var(--success-800); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;">Active</span>` :
        `<span style="background: var(--gray-100); color: var(--gray-600); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;">Inactive</span>`;

      tr.innerHTML = `
        <td>
          <div class="col-staff">
            <div class="avatar">${initials(s.name)}</div>
            <div>
              <div class="name">${s.name}</div>
            </div>
          </div>
        </td>
        <td>${s.role}</td>
        <td>${s.email}</td>
        <td>${s.phone || '-'}</td>
        <td><div class="store-chip-list">${storeChips}</div></td>
        <td>${statusBadge}</td>
        <td style="text-align: right;" class="actions-cell">
          <button class="btn-edit" title="Edit Staff" style="background: none; border: none; cursor: pointer; color: var(--brand-600); padding: 4px; border-radius: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-delete" title="Delete Staff" style="background: none; border: none; cursor: pointer; color: var(--danger-600); padding: 4px; border-radius: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </td>
      `;

      tr.querySelector('.btn-edit').addEventListener('click', () => {
        openStaffModal(s);
      });

      tr.querySelector('.btn-delete').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete staff member "${s.name}"?`)) {
          deleteStaffMember(s.id);
        }
      });

      tbody.appendChild(tr);
    });
  }

  function openStaffModal(member = null) {
    const errorEl = $('#staffModalError');
    if (errorEl) errorEl.style.display = 'none';

    const storeContainer = $('#staffModalStoresContainer');
    if (storeContainer) {
      storeContainer.innerHTML = '';
      stores.forEach(st => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '6px';
        div.innerHTML = `
          <input type="checkbox" name="staffModalStores" value="${st.name}" id="cb_${st.id}" style="width: 15px; height: 15px;" />
          <label for="cb_${st.id}" style="font-size: 13px; cursor: pointer;">${st.name}</label>
        `;
        storeContainer.appendChild(div);
      });
    }

    if (member) {
      $('#staffModalTitle').textContent = 'Edit Staff';
      $('#staffModalId').value = member.id;
      $('#staffModalName').value = member.name;
      $('#staffModalRole').value = member.role;
      $('#staffModalEmail').value = member.email;
      $('#staffModalPhone').value = member.phone;

      const statusToggle = $('#staffModalStatusToggle');
      if (statusToggle) statusToggle.checked = member.active;

      const assigned = member.stores || [];
      Array.from(document.querySelectorAll('input[name="staffModalStores"]')).forEach(cb => {
        cb.checked = assigned.includes(cb.value);
      });
    } else {
      $('#staffModalTitle').textContent = 'Add Staff';
      $('#staffModalId').value = '';
      $('#staffModalName').value = '';
      $('#staffModalRole').value = 'Cashier';
      $('#staffModalEmail').value = '';
      $('#staffModalPhone').value = '';

      const statusToggle = $('#staffModalStatusToggle');
      if (statusToggle) statusToggle.checked = true;

      Array.from(document.querySelectorAll('input[name="staffModalStores"]')).forEach(cb => {
        cb.checked = false;
      });
    }

    $('#staffModalScrim').classList.add('show');
  }

  function closeStaffModal() {
    $('#staffModalScrim').classList.remove('show');
  }

  function submitStaffModal() {
    const id = $('#staffModalId').value.trim();
    const name = $('#staffModalName').value.trim();
    const role = $('#staffModalRole').value;
    const email = $('#staffModalEmail').value.trim();
    const phone = $('#staffModalPhone').value.trim();
    const selectedStores = Array.from($$('input[name="staffModalStores"]:checked')).map(cb => cb.value);

    const errorEl = $('#staffModalError');
    if (errorEl) errorEl.style.display = 'none';

    if (!name) {
      if (errorEl) {
        errorEl.textContent = 'Staff name is required.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (!email || !email.includes('@')) {
      if (errorEl) {
        errorEl.textContent = 'Valid email is required.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (!phone) {
      if (errorEl) {
        errorEl.textContent = 'Phone number is required.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (selectedStores.length === 0) {
      if (errorEl) {
        errorEl.textContent = 'Please select at least one assigned store outlet.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const emailDuplicate = staff.find(m => m.email.toLowerCase() === email.toLowerCase() && m.id !== id);
    if (emailDuplicate) {
      if (errorEl) {
        errorEl.textContent = `A staff member with the email "${email}" is already registered.`;
        errorEl.style.display = 'block';
      }
      return;
    }

    const statusToggle = $('#staffModalStatusToggle');
    const active = statusToggle ? statusToggle.checked : true;

    if (id) {
      const idx = staff.findIndex(m => m.id === id);
      if (idx !== -1) {
        staff[idx].name = name;
        staff[idx].role = role;
        staff[idx].email = email;
        staff[idx].phone = phone;
        staff[idx].stores = selectedStores;
        staff[idx].active = active;
        showToast(`Staff member "${name}" details saved.`);
      }
    } else {
      const newId = 'st' + String(Date.now());
      staff.push({ id: newId, name, role, email, phone, stores: selectedStores, active });
      showToast(`Staff member "${name}" registered successfully.`);
    }

    saveStaff();
    closeStaffModal();
    renderStaffList();
    renderDashboardStats();
  }

  function deleteStaffMember(staffId) {
    const idx = staff.findIndex(m => m.id === staffId);
    if (idx !== -1) {
      const name = staff[idx].name;
      staff.splice(idx, 1);
      saveStaff();
      showToast(`Staff member "${name}" removed successfully.`);
      renderStaffList();
      renderDashboardStats();
    }
  }

  // --- Sidebar & Profile settings click navigation ---
  function updateSideUser() {
    const sideUser = document.querySelector('.side-user');
    if (!sideUser) return;

    sideUser.style.cursor = 'pointer';
    sideUser.addEventListener('click', () => {
      window.location.href = 'setting.html';
    });

    const user = JSON.parse(localStorage.getItem('pos_current_user')) || {
      name: 'Agus Prasetyo',
      role: 'Super Admin',
      email: 'agus.p@bluepoint.id',
      store: 'Store #04',
      phone: '+62 812-1111-2222'
    };

    const avatarEl = sideUser.querySelector('.avatar');
    const nameEl = sideUser.querySelector('.name');
    const roleEl = sideUser.querySelector('.role');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = `${user.role} · ${user.store || 'Store #04'}`;

    if (avatarEl) {
      const nameParts = user.name.split(/\s+/).filter(Boolean).slice(0, 2);
      avatarEl.textContent = nameParts.map(s => s[0].toUpperCase()).join('') || 'SA';
    }
  }

  function setupSidebarNavigation() {
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

  function setupTabs() {
    $$('.store-modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-subtab');
        switchSubtab(tab);
      });
    });
  }

  function bindListeners() {
    const storeSearch = $('#storeSearchInput');
    if (storeSearch) storeSearch.addEventListener('input', renderStoreList);

    const openAddStoreBtn = $('#openAddStoreBtn');
    if (openAddStoreBtn) openAddStoreBtn.addEventListener('click', () => openStoreModal());

    if ($('#closeStoreModalBtn')) $('#closeStoreModalBtn').addEventListener('click', closeStoreModal);
    if ($('#cancelStoreModalBtn')) $('#cancelStoreModalBtn').addEventListener('click', closeStoreModal);
    if ($('#submitStoreModalBtn')) $('#submitStoreModalBtn').addEventListener('click', submitStoreModal);

    if ($('#closeStoreDetailBtn')) $('#closeStoreDetailBtn').addEventListener('click', () => $('#storeDetailScrim').classList.remove('show'));
    if ($('#closeStoreDetailBtnFoot')) $('#closeStoreDetailBtnFoot').addEventListener('click', () => $('#storeDetailScrim').classList.remove('show'));

    const detailInvSearch = $('#detailInvSearchInput');
    if (detailInvSearch) detailInvSearch.addEventListener('input', renderDetailInventory);

    const editStoreBtnFromDetail = $('#editStoreBtnFromDetail');
    if (editStoreBtnFromDetail) {
      editStoreBtnFromDetail.addEventListener('click', () => {
        $('#storeDetailScrim').classList.remove('show');
        openStoreModal(activeDetailStore);
      });
    }

    const staffSearch = $('#staffSearchInput');
    if (staffSearch) staffSearch.addEventListener('input', renderStaffList);

    const openAddStaffBtn = $('#openAddStaffBtn');
    if (openAddStaffBtn) openAddStaffBtn.addEventListener('click', () => openStaffModal());

    if ($('#closeStaffModalBtn')) $('#closeStaffModalBtn').addEventListener('click', () => $('#staffModalScrim').classList.remove('show'));
    if ($('#cancelStaffModalBtn')) $('#cancelStaffModalBtn').addEventListener('click', () => $('#staffModalScrim').classList.remove('show'));
    if ($('#submitStaffModalBtn')) $('#submitStaffModalBtn').addEventListener('click', submitStaffModal);
  }

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

  // Expose methods for older triggers or staff management UI
  window.openStaffModal = openStaffModal;

  function init() {
    let currentActiveTab = 'store';
    if ($('#staffTableBody')) {
      currentActiveTab = 'staff';
    }

    renderDashboardStats();

    if ($('#storeTableBody') && currentActiveTab === 'store') renderStoreList();
    if ($('#staffTableBody') && currentActiveTab === 'staff') renderStaffList();

    setupTabs();
    setupSidebarNavigation();
    bindListeners();
    updateSideUser();
  }

  window.addEventListener('DOMContentLoaded', init);

  // Expose SettingsApp for verification test suite
  window.SettingsApp = {
    getStores: () => stores,
    getStaff: () => staff,
    getProducts: () => {
      try {
        products = JSON.parse(localStorage.getItem('pos_products')) || [];
      } catch (e) {}
      return products;
    },
    getPromos: () => {
      try {
        promos = JSON.parse(localStorage.getItem('pos_promos')) || {};
      } catch (e) {}
      return promos;
    },
    addStore: (name, address, phone) => {
      const newStore = { id: 's' + String(Date.now()), name, address, phone };
      stores.push(newStore);
      saveStores();

      try {
        products = JSON.parse(localStorage.getItem('pos_products')) || [];
      } catch (e) {}

      products.forEach(p => {
        if (!p.stocks) p.stocks = {};
        p.stocks[name] = 0;
      });
      localStorage.setItem('pos_products', JSON.stringify(products));

      renderStoreList();
      renderDashboardStats();
      return newStore;
    },
    addStaff: (name, role, email, phone, assignedStores, active = true) => {
      const newStaff = { id: 'st' + String(Date.now()), name, role, email, phone, stores: assignedStores, active };
      staff.push(newStaff);
      saveStaff();

      renderStaffList();
      renderDashboardStats();
      return newStaff;
    },
    deleteStaff: (id) => {
      deleteStaffMember(id);
    },
    getStaffForStore,
    getStockStatsForStore,
    getActivePromosForStore
  };
})();

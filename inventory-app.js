(() => {
  const { CATEGORIES, PRODUCTS, LOW_STOCK_THRESHOLD, stockState } = window.POS_DATA;

  // ----- state -----
  let searchQuery = '';
  let selectedCat = 'all';
  let selectedSort = 'date-desc'; // Default to newest first

  // DOM Helper selectors
  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

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

  // ============ Navigation ============
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

  // ============ Category Select Population ============
  function populateCategories() {
    const filterSelect = $('#invCatSelect');
    filterSelect.innerHTML = '';

    CATEGORIES.forEach(c => {
      const optFilter = document.createElement('option');
      optFilter.value = c.id;
      optFilter.textContent = c.name;
      filterSelect.appendChild(optFilter);
    });
  }

  // ============ Render Product Table ============
  function renderTable() {
    const tbody = $('#invTableBody');
    tbody.innerHTML = '';

    // Filter products list
    let list = PRODUCTS.slice(); // Use a shallow copy to avoid mutating the original array when sorting
    if (selectedCat !== 'all') {
      list = list.filter(p => p.cat === selectedCat);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q)
      );
    }

    // Sort products list
    list.sort((a, b) => {
      if (selectedSort === 'date-desc') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (selectedSort === 'date-asc') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (selectedSort === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (selectedSort === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (selectedSort === 'price-asc') {
        return a.basePrice - b.basePrice;
      }
      if (selectedSort === 'price-desc') {
        return b.basePrice - a.basePrice;
      }
      return 0;
    });

    $('#invCountText').textContent = `${list.length} product${list.length === 1 ? '' : 's'} found`;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="padding: 48px; text-align: center; color: var(--gray-500);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 600; color: var(--gray-700);">No products found</div>
            <div style="font-size: 13px;">Modify your search keyword, sorting, or category filter.</div>
          </td>
        </tr>`;
      return;
    }

    // Populate rows
    list.forEach(p => {
      const ss = stockState(p);
      
      // Calculate total stock across all locations
      const stock1 = p.stocks?.['Store #01'] ?? 0;
      const stock2 = p.stocks?.['Store #02'] ?? 0;
      const stock3 = p.stocks?.['Store #03'] ?? 0;
      const stock4 = p.stock ?? 0; // POS store (Store #04) stock
      const totalStock = stock1 + stock2 + stock3 + stock4;

      // Status Badge
      let statusBadge = '';
      if (ss === 'out') {
        statusBadge = `<span class="status-badge out-of-stock">Out of stock</span>`;
      } else if (ss === 'low') {
        statusBadge = `<span class="status-badge low-stock">Low stock (${stock4})</span>`;
      } else {
        statusBadge = `<span class="status-badge in-stock">In stock</span>`;
      }

      const visualHtml = p.image 
        ? `<img src="${p.image}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;" />` 
        : (p.emoji 
          ? p.emoji 
          : `<svg class="default-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.65;"><path d="M20.5 7.27L12 12 3.5 7.27"/><path d="M12 22V12"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`);

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        window.location.href = `add-product.html?id=${p.id}`;
      });
      tr.innerHTML = `
        <td>
          <div class="prod-cell">
            <div class="prod-thumb" style="background: ${p.tint || '#F1F5F9'};">${visualHtml}</div>
            <div>
              <div class="prod-name">${p.name}</div>
              <div class="prod-cat">${getCatName(p.cat)}</div>
            </div>
          </div>
        </td>
        <td class="sku-cell">${p.sku}</td>
        <td class="price-cell">${fmt(p.basePrice)}</td>
        <td class="points-cell">${p.loyaltyPoints} pts</td>
        <td class="stock-total">${totalStock}</td>
        <td>${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function getCatName(catId) {
    const found = CATEGORIES.find(c => c.id === catId);
    return found ? found.name : (catId || 'Uncategorized');
  }

  // ============ Toast Alert Helper ============
  let toastTimer;
  function showToast(msg) {
    const toast = $('#invToast');
    const toastMsg = $('#invToastMsg');
    
    toastMsg.textContent = msg;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ============ Initialize ============
  function init() {
    setupNavigation();
    populateCategories();
    renderTable();

    // Event listeners
    $('#invSearchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTable();
    });

    $('#invCatSelect').addEventListener('change', (e) => {
      selectedCat = e.target.value;
      renderTable();
    });

    $('#invSortSelect').addEventListener('change', (e) => {
      selectedSort = e.target.value;
      renderTable();
    });
  }

  // Load app on window loaded
  window.addEventListener('DOMContentLoaded', init);
})();

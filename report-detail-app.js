(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // ============ Check Authorization & Profile Setup ============
    const currentUser = JSON.parse(localStorage.getItem('pos_current_user') || '{"role": "Super Admin"}');
    if (currentUser) {
      const nameEl = document.querySelector('.side-user .name');
      const roleEl = document.querySelector('.side-user .role');
      const avatarEl = document.querySelector('.side-user .avatar');
      if (nameEl) nameEl.textContent = currentUser.name || 'Super Admin';
      if (roleEl) roleEl.textContent = `${currentUser.role || 'Super Admin'} · ${currentUser.store || 'Store #04'}`;
      if (avatarEl) {
        const initials = (currentUser.name || 'Super Admin').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials;
      }
    }

    // ============ Sidebar Navigation clicks ============
    document.querySelectorAll('#nav .nav-item, .sidebar .nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.hasAttribute('onclick') || item.getAttribute('onclick')) return;
        const text = item.textContent.trim();
        if (text.includes('Order')) {
          window.location.href = 'order.html';
        } else if (text.includes('Products & Inventory')) {
          window.location.href = 'inventory.html';
        } else if (text.includes('Customer')) {
          window.location.href = 'customer.html';
        } else if (text.includes('Summary Report')) {
          window.location.href = 'report-summary.html';
        } else if (text.includes('Detail Report')) {
          window.location.href = 'report-detail.html';
        } else if (text.includes('Promo & Discount')) {
          window.location.href = 'promo.html';
        } else if (text.includes('Store List')) {
          window.location.href = 'store.html';
        } else if (text.includes('Staff List')) {
          window.location.href = 'staff.html';
        }
      });
    });

    const sideUser = document.querySelector('.side-user');
    if (sideUser) {
      sideUser.style.cursor = 'pointer';
      sideUser.addEventListener('click', () => {
        window.location.href = 'setting.html';
      });
    }

    // ============ Data Fetching & State ============
    const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const products = JSON.parse(localStorage.getItem('pos_products') || '[]');
    const stores = JSON.parse(localStorage.getItem('pos_stores') || '[]');
    const promos = JSON.parse(localStorage.getItem('pos_promos') || '{}');
    const categories = JSON.parse(localStorage.getItem('pos_categories') || '[]');

    // Populate Store Filter Dropdown dynamically
    const storeSelect = document.getElementById('filterStore');
    if (storeSelect) {
      storeSelect.innerHTML = '<option value="all">All Stores</option>';
      stores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        storeSelect.appendChild(opt);
      });
    }

    // Populate Category Filter Dropdown dynamically
    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="all">All Categories</option>';
      categories.forEach(c => {
        if (c.id !== 'all') {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          categorySelect.appendChild(opt);
        }
      });
    }

    // Create lookup tables for speed and correctness
    const productCategoryMap = {};
    const productSKUMap = {};
    const productEmojiMap = {};
    products.forEach(p => {
      productCategoryMap[p.id] = p.cat;
      productSKUMap[p.id] = p.sku || '';
      productEmojiMap[p.id] = p.emoji || '📦';
    });

    // ============ Date Pre-population from URL Parameter ============
    const urlParams = new URLSearchParams(window.location.search);
    const periodParam = urlParams.get('period');

    let defaultFrom = '2026-05-15';
    let defaultTo = '2026-05-22';

    if (periodParam === 'today') {
      defaultFrom = '2026-05-22';
      defaultTo = '2026-05-22';
    } else if (periodParam === 'week') {
      defaultFrom = '2026-05-16';
      defaultTo = '2026-05-22';
    } else if (periodParam === 'month') {
      defaultFrom = '2026-05-01';
      defaultTo = '2026-05-22';
    }

    document.getElementById('filterDateFrom').value = defaultFrom;
    document.getElementById('filterDateTo').value = defaultTo;

    // ============ Tab, Sort, and Pagination State ============
    let currentTab = 'sales';
    let currentPage = 1;
    const itemsPerPage = 10;
    let currentSortCol = '';
    let currentSortDir = 'desc';
    let filteredData = [];

    // ============ Helpers ============
    function formatCurrency(val) {
      const formatted = val % 1 === 0
        ? val.toLocaleString('en-US')
        : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return 'Rp\u00A0' + formatted;
    }

    function capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function normalizeStoreName(name) {
      if (!name) return '';
      return name.replace(/\s*\(POS\)\s*$/i, '').trim();
    }

    function isStoreMatch(orderStore, filterStore) {
      if (filterStore === 'all') return true;
      return normalizeStoreName(orderStore) === normalizeStoreName(filterStore);
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.querySelector('.toast-msg').textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // ============ Table Renderers ============
    function renderTableHeader() {
      const header = document.getElementById('detailTableHeader');
      let html = '';

      const getSortIndicator = (col) => {
        if (currentSortCol === col) {
          return currentSortDir === 'asc' ? '<span class="sort-icon"> ▲</span>' : '<span class="sort-icon"> ▼</span>';
        }
        return '<span class="sort-icon"> ↕</span>';
      };

      if (currentTab === 'sales') {
        html = `
        <tr>
          <th class="sortable" data-col="product">Product${getSortIndicator('product')}</th>
          <th class="sortable" data-col="qty">Units Sold${getSortIndicator('qty')}</th>
          <th class="sortable" data-col="grossSales">Gross Sales (Rp)${getSortIndicator('grossSales')}</th>
          <th class="sortable" data-col="discounts">Discounts (Rp)${getSortIndicator('discounts')}</th>
          <th class="sortable" data-col="nettRevenue">Nett Revenue (Rp)${getSortIndicator('nettRevenue')}</th>
          <th class="sortable" data-col="cogs">COGS (Rp)${getSortIndicator('cogs')}</th>
          <th class="sortable" data-col="profit">Gross Profit (Rp)${getSortIndicator('profit')}</th>
          <th class="sortable" data-col="margin">Margin %${getSortIndicator('margin')}</th>
          <th class="sortable" data-col="category">Category${getSortIndicator('category')}</th>
          <th class="sortable" data-col="store">Store${getSortIndicator('store')}</th>
        </tr>
      `;
      } else if (currentTab === 'promos') {
        html = `
        <tr>
          <th class="sortable" data-col="promo">Promo Code${getSortIndicator('promo')}</th>
          <th class="sortable" data-col="type">Type${getSortIndicator('type')}</th>
          <th class="sortable" data-col="value">Value${getSortIndicator('value')}</th>
          <th class="sortable" data-col="applied">Applied Count${getSortIndicator('applied')}</th>
          <th class="sortable" data-col="discount">Total Discount${getSortIndicator('discount')}</th>
          <th class="sortable" data-col="roi">ROI %${getSortIndicator('roi')}</th>
          <th class="sortable" data-col="status">Status${getSortIndicator('status')}</th>
        </tr>
      `;
      } else if (currentTab === 'inventory') {
        html = `
        <tr>
          <th class="sortable" data-col="product">Product${getSortIndicator('product')}</th>
          <th class="sortable" data-col="s01">Store #01 Stock${getSortIndicator('s01')}</th>
          <th class="sortable" data-col="s02">Store #02 Stock${getSortIndicator('s02')}</th>
          <th class="sortable" data-col="s03">Store #03 Stock${getSortIndicator('s03')}</th>
          <th class="sortable" data-col="s04">Store #04 Stock${getSortIndicator('s04')}</th>
          <th class="sortable" data-col="total_stock">Total Stock${getSortIndicator('total_stock')}</th>
          <th class="sortable" data-col="status">Availability Status${getSortIndicator('status')}</th>
          <th class="sortable" data-col="turnover">Daily Turnover Rate${getSortIndicator('turnover')}</th>
        </tr>
      `;
      } else if (currentTab === 'stores') {
        html = `
        <tr>
          <th class="sortable" data-col="store">Store Name${getSortIndicator('store')}</th>
          <th class="sortable" data-col="revenue">Total Revenue${getSortIndicator('revenue')}</th>
          <th class="sortable" data-col="transactions">Transaction Count${getSortIndicator('transactions')}</th>
          <th class="sortable" data-col="avg_basket">Average Basket Value${getSortIndicator('avg_basket')}</th>
          <th class="sortable" data-col="low_stock">Low Stock Warnings${getSortIndicator('low_stock')}</th>
          <th class="sortable" data-col="top_seller">Top Seller Product${getSortIndicator('top_seller')}</th>
        </tr>
      `;
      }

      header.innerHTML = html;
    }

    function renderRowHtml(row) {
      if (currentTab === 'sales') {
        return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 16px;">${row.emoji}</div>
              <div>
                <div style="font-weight: 600; color: var(--gray-900);">${row.productName}</div>
                <div style="font-size: 11px; color: var(--gray-400); font-family: monospace;">${row.sku}</div>
              </div>
            </div>
          </td>
          <td style="font-weight: 500;">${row.qty}</td>
          <td style="font-weight: 500;">${formatCurrency(row.grossSales)}</td>
          <td style="color: var(--danger-600); font-weight: 500;">${row.discounts > 0 ? '-' + formatCurrency(row.discounts) : formatCurrency(0)}</td>
          <td style="font-weight: 600; color: var(--gray-900);">${formatCurrency(row.nettRevenue)}</td>
          <td style="color: var(--warning-500); font-weight: 500;">${row.cogs > 0 ? '-' + formatCurrency(row.cogs) : formatCurrency(0)}</td>
          <td style="font-weight: 600; color: var(--success-700);">${formatCurrency(row.profit)}</td>
          <td style="font-weight: 600; color: var(--gray-700);">${row.margin.toFixed(1)}%</td>
          <td><span class="col-badge badge-percent">${capitalize(row.category)}</span></td>
          <td><span class="badge" style="background: var(--gray-100); color: var(--gray-700); font-weight: 500; font-size: 11px; padding: 3px 8px; border-radius: 999px;">${row.store}</span></td>
        </tr>
      `;
      } else if (currentTab === 'promos') {
        const statusBadge = row.status === 'Active'
          ? `<span class="col-badge badge-active">Active</span>`
          : `<span class="col-badge badge-inactive">Inactive</span>`;
        return `
        <tr>
          <td style="font-family: monospace; font-weight: 600; color: var(--gray-900);">${row.promo}</td>
          <td><span class="col-badge badge-percent">${row.type}</span></td>
          <td style="font-weight: 500;">${row.value}</td>
          <td>${row.applied}</td>
          <td style="font-weight: 600; color: var(--gray-900);">${formatCurrency(row.discount)}</td>
          <td style="font-weight: 600; color: ${row.roi >= 100 ? 'var(--success-700)' : 'var(--gray-900)'};">${row.roi.toFixed(1)}%</td>
          <td>${statusBadge}</td>
        </tr>
      `;
      } else if (currentTab === 'inventory') {
        let statusClass = 'badge-success';
        if (row.status === 'Out of Stock') statusClass = 'badge-danger';
        else if (row.status === 'Low Stock') statusClass = 'badge-warning';

        const statusStyle = row.status === 'Low Stock'
          ? 'background: var(--warning-50); color: var(--warning-700); font-weight: 600;'
          : '';

        const statusHtml = row.status === 'Low Stock'
          ? `<span class="col-badge" style="${statusStyle}">⚠️ Low Stock</span>`
          : `<span class="col-badge ${statusClass}">${row.status}</span>`;

        return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 16px;">${row.emoji}</div>
              <div>
                <div style="font-weight: 600; color: var(--gray-900);">${row.product}</div>
                <div style="font-size: 11px; color: var(--gray-400); font-family: monospace;">${row.sku}</div>
              </div>
            </div>
          </td>
          <td>${row.s01}</td>
          <td>${row.s02}</td>
          <td>${row.s03}</td>
          <td>${row.s04}</td>
          <td style="font-weight: 600;">${row.total_stock}</td>
          <td>${statusHtml}</td>
          <td style="font-weight: 500; color: var(--gray-600);">${row.turnover.toFixed(2)}/day</td>
        </tr>
      `;
      } else if (currentTab === 'stores') {
        return `
        <tr>
          <td style="font-weight: 600; color: var(--gray-900);">${row.store}</td>
          <td style="font-weight: 600; color: var(--brand-700);">${formatCurrency(row.revenue)}</td>
          <td>${row.transactions}</td>
          <td>${formatCurrency(row.avg_basket)}</td>
          <td>
            ${row.low_stock > 0
            ? `<span class="col-badge" style="background: var(--danger-50); color: var(--danger-700);">⚠️ ${row.low_stock} Low</span>`
            : `<span class="col-badge badge-active">✓ Healthy</span>`
          }
          </td>
          <td style="font-weight: 500; color: var(--gray-700);">${row.top_seller}</td>
        </tr>
      `;
      }
    }

    // ============ Dummy/Mock Data for Visualization ============
    const DUMMY_SALES = [
      { productId: 'ds01', productName: 'Caramel Macchiato', sku: 'MAC-101', emoji: '☕️', qty: 45, revenue: 225000, category: 'coffee', store: 'Store #01', date: '2026-05-20' },
      { productId: 'ds02', productName: 'Matcha Latte', sku: 'MAT-102', emoji: '🍵', qty: 38, revenue: 171000, category: 'tea', store: 'Store #02', date: '2026-05-21' },
      { productId: 'ds03', productName: 'Almond Croissant', sku: 'CRO-103', emoji: '🥐', qty: 30, revenue: 105000, category: 'bakery', store: 'Store #03', date: '2026-05-18' },
      { productId: 'ds04', productName: 'Cinnamon Roll', sku: 'ROL-104', emoji: '🧁', qty: 25, revenue: 87500, category: 'bakery', store: 'Store #04', date: '2026-05-22' },
      { productId: 'ds05', productName: 'Flat White', sku: 'FLA-105', emoji: '☕️', qty: 52, revenue: 234000, category: 'coffee', store: 'Store #01', date: '2026-05-19' },
      { productId: 'ds06', productName: 'Peach Oolong Tea', sku: 'TEA-106', emoji: '🥤', qty: 28, revenue: 112000, category: 'tea', store: 'Store #02', date: '2026-05-17' },
      { productId: 'ds07', productName: 'Chocolate Brownie', sku: 'BRO-107', emoji: '🍫', qty: 40, revenue: 140000, category: 'bakery', store: 'Store #03', date: '2026-05-16' },
      { productId: 'ds08', productName: 'Cold Brew Coffee', sku: 'COL-108', emoji: '☕️', qty: 60, revenue: 270000, category: 'coffee', store: 'Store #04', date: '2026-05-22' },
      { productId: 'ds09', productName: 'Earl Grey Tea', sku: 'EGT-109', emoji: '🍵', qty: 20, revenue: 80000, category: 'tea', store: 'Store #01', date: '2026-05-20' },
      { productId: 'ds10', productName: 'Blueberry Scone', sku: 'SCO-110', emoji: '🥯', qty: 35, revenue: 122500, category: 'bakery', store: 'Store #02', date: '2026-05-19' }
    ];

    const DUMMY_PROMOS = [
      {
        promo: 'SUMMER20',
        type: 'Percentage',
        value: '20%',
        rawValue: 0.20,
        status: 'Active',
        redemptions: [
          { date: '2026-05-16', store: 'Store #01', discount: 15000, revenue: 75000 },
          { date: '2026-05-18', store: 'Store #02', discount: 20000, revenue: 100000 },
          { date: '2026-05-20', store: 'Store #03', discount: 25000, revenue: 125000 },
          { date: '2026-05-22', store: 'Store #04', discount: 30000, revenue: 150000 }
        ]
      },
      {
        promo: 'FREESHIP',
        type: 'Fixed',
        value: 'Rp 5,000',
        rawValue: 5000,
        status: 'Active',
        redemptions: [
          { date: '2026-05-17', store: 'Store #01', discount: 5000, revenue: 45000 },
          { date: '2026-05-19', store: 'Store #02', discount: 10000, revenue: 90000 },
          { date: '2026-05-21', store: 'Store #03', discount: 15000, revenue: 135000 }
        ]
      },
      {
        promo: 'BOGO2026',
        type: 'Percentage',
        value: '50%',
        rawValue: 0.50,
        status: 'Active',
        redemptions: [
          { date: '2026-05-20', store: 'Store #04', discount: 12500, revenue: 25000 },
          { date: '2026-05-22', store: 'Store #02', discount: 25000, revenue: 50000 }
        ]
      },
      {
        promo: 'WEEKEND5',
        type: 'Fixed',
        value: 'Rp 5,000',
        rawValue: 5000,
        status: 'Active',
        redemptions: [
          { date: '2026-05-16', store: 'Store #01', discount: 10000, revenue: 80000 },
          { date: '2026-05-17', store: 'Store #02', discount: 15000, revenue: 120000 },
          { date: '2026-05-22', store: 'Store #03', discount: 5000, revenue: 40000 }
        ]
      },
      {
        promo: 'WINTER10',
        type: 'Percentage',
        value: '10%',
        rawValue: 0.10,
        status: 'Inactive',
        redemptions: []
      },
      {
        promo: 'COFFEE25',
        type: 'Percentage',
        value: '25%',
        rawValue: 0.25,
        status: 'Active',
        redemptions: [
          { date: '2026-05-18', store: 'Store #01', discount: 7500, revenue: 30000 },
          { date: '2026-05-19', store: 'Store #04', discount: 12500, revenue: 50000 }
        ]
      },
      {
        promo: 'CAKEFREE',
        type: 'Fixed',
        value: 'Rp 3,500',
        rawValue: 3500,
        status: 'Active',
        redemptions: [
          { date: '2026-05-15', store: 'Store #03', discount: 7000, revenue: 35000 },
          { date: '2026-05-21', store: 'Store #01', discount: 3500, revenue: 17500 }
        ]
      },
      {
        promo: 'SPECIAL50',
        type: 'Fixed',
        value: 'Rp 50,000',
        rawValue: 50000,
        status: 'Active',
        redemptions: [
          { date: '2026-05-19', store: 'Store #02', discount: 50000, revenue: 250000 },
          { date: '2026-05-22', store: 'Store #04', discount: 100000, revenue: 500000 }
        ]
      },
      {
        promo: 'VIPCLUB',
        type: 'Percentage',
        value: '30%',
        rawValue: 0.30,
        status: 'Active',
        redemptions: [
          { date: '2026-05-21', store: 'Store #04', discount: 60000, revenue: 200000 },
          { date: '2026-05-22', store: 'Store #01', discount: 30000, revenue: 100000 }
        ]
      },
      {
        promo: 'LUCKY8',
        type: 'Fixed',
        value: 'Rp 8,000',
        rawValue: 8000,
        status: 'Active',
        redemptions: [
          { date: '2026-05-15', store: 'Store #01', discount: 8000, revenue: 64000 },
          { date: '2026-05-22', store: 'Store #04', discount: 16000, revenue: 128000 }
        ]
      }
    ];

    const DUMMY_INVENTORY_PRODUCTS = [
      { id: 'di01', name: 'Premium Coffee Beans', sku: 'BEA-901', emoji: '🫘', cat: 'coffee', stocks: { 'Store #01': 15, 'Store #02': 25, 'Store #03': 3, 'Store #04': 18 }, sales: [{ date: '2026-05-20', store: 'Store #01', qty: 2 }] },
      { id: 'di02', name: 'Hazelnut Syrup', sku: 'SYR-902', emoji: '🍼', cat: 'coffee', stocks: { 'Store #01': 2, 'Store #02': 8, 'Store #03': 0, 'Store #04': 5 }, sales: [{ date: '2026-05-21', store: 'Store #02', qty: 1 }] },
      { id: 'di03', name: 'Organic Soy Milk', sku: 'MLK-903', emoji: '🥛', cat: 'coffee', stocks: { 'Store #01': 10, 'Store #02': 12, 'Store #03': 8, 'Store #04': 15 }, sales: [] },
      { id: 'di04', name: 'Red Velvet Cake', sku: 'CAK-904', emoji: '🍰', cat: 'bakery', stocks: { 'Store #01': 4, 'Store #02': 0, 'Store #03': 2, 'Store #04': 6 }, sales: [{ date: '2026-05-22', store: 'Store #04', qty: 3 }] },
      { id: 'di05', name: 'Earl Grey Tea Box', sku: 'TEA-905', emoji: '📦', cat: 'tea', stocks: { 'Store #01': 30, 'Store #02': 20, 'Store #03': 25, 'Store #04': 40 }, sales: [] },
      { id: 'di06', name: 'Lemon Meringue Tart', sku: 'TAR-906', emoji: '🥧', cat: 'bakery', stocks: { 'Store #01': 0, 'Store #02': 5, 'Store #03': 1, 'Store #04': 0 }, sales: [{ date: '2026-05-18', store: 'Store #03', qty: 4 }] },
      { id: 'di07', name: 'English Muffin', sku: 'MUF-907', emoji: '🥯', cat: 'bakery', stocks: { 'Store #01': 8, 'Store #02': 14, 'Store #03': 6, 'Store #04': 10 }, sales: [] },
      { id: 'di08', name: 'Chai Tea Concentrate', sku: 'CHA-908', emoji: '🍂', cat: 'tea', stocks: { 'Store #01': 12, 'Store #02': 18, 'Store #03': 5, 'Store #04': 11 }, sales: [] },
      { id: 'di09', name: 'Gluten-Free Bread', sku: 'BRD-909', emoji: '🍞', cat: 'bakery', stocks: { 'Store #01': 5, 'Store #02': 2, 'Store #03': 1, 'Store #04': 4 }, sales: [{ date: '2026-05-19', store: 'Store #01', qty: 1 }] },
      { id: 'di10', name: 'Chicken Pesto Wrap', sku: 'WRA-910', emoji: '🌯', cat: 'bakery', stocks: { 'Store #01': 0, 'Store #02': 3, 'Store #03': 0, 'Store #04': 2 }, sales: [{ date: '2026-05-22', store: 'Store #02', qty: 5 }] }
    ];

    const DUMMY_STORES_DATA = {
      'Store #01': { lowStock: 2, transactions: [{ date: '2026-05-16', category: 'coffee', revenue: 45000, items: 3 }, { date: '2026-05-20', category: 'bakery', revenue: 32500, items: 5 }] },
      'Store #02': { lowStock: 4, transactions: [{ date: '2026-05-18', category: 'tea', revenue: 62000, items: 4 }, { date: '2026-05-22', category: 'coffee', revenue: 78500, items: 6 }] },
      'Store #03': { lowStock: 1, transactions: [{ date: '2026-05-15', category: 'bakery', revenue: 95000, items: 5 }, { date: '2026-05-21', category: 'tea', revenue: 18000, items: 2 }] },
      'Store #04': { lowStock: 3, transactions: [{ date: '2026-05-17', category: 'coffee', revenue: 54000, items: 4 }, { date: '2026-05-19', category: 'bakery', revenue: 42000, items: 3 }] },
      'Store #05': { lowStock: 5, transactions: [{ date: '2026-05-16', category: 'coffee', revenue: 120000, items: 8 }, { date: '2026-05-20', category: 'bakery', revenue: 150000, items: 10 }] },
      'Store #06': { lowStock: 0, transactions: [{ date: '2026-05-17', category: 'coffee', revenue: 85000, items: 6 }, { date: '2026-05-21', category: 'bakery', revenue: 55000, items: 4 }] },
      'Store #07': { lowStock: 2, transactions: [{ date: '2026-05-18', category: 'tea', revenue: 40000, items: 3 }, { date: '2026-05-22', category: 'tea', revenue: 22000, items: 2 }] },
      'Store #08': { lowStock: 6, transactions: [{ date: '2026-05-15', category: 'coffee', revenue: 35000, items: 3 }, { date: '2026-05-19', category: 'bakery', revenue: 48000, items: 4 }] },
      'Store #09': { lowStock: 1, transactions: [{ date: '2026-05-20', category: 'coffee', revenue: 92000, items: 7 }, { date: '2026-05-22', category: 'tea', revenue: 65000, items: 5 }] },
      'Store #10': { lowStock: 3, transactions: [{ date: '2026-05-16', category: 'bakery', revenue: 110000, items: 7 }, { date: '2026-05-21', category: 'tea', revenue: 30000, items: 3 }] }
    };

    function calculateData() {
      filteredData = []; // Reset shared state to avoid leaking data across tabs
      const filterDateFrom = document.getElementById('filterDateFrom').value;
      const filterDateTo = document.getElementById('filterDateTo').value;
      const filterStore = document.getElementById('filterStore').value;
      const filterCategory = document.getElementById('filterCategory').value;
      const filterSearch = document.getElementById('filterSearch').value.trim();

      // Filter orders strictly by date range defensively
      const dateFilteredOrders = orders.filter(o => {
        if (!o || typeof o.date !== 'string') return false;
        const dStr = o.date.substring(0, 10);
        return dStr >= filterDateFrom && dStr <= filterDateTo;
      });

      if (currentTab === 'sales') {
        const salesMap = {};
        dateFilteredOrders.forEach(o => {
          if (!o) return;
          if (!isStoreMatch(o.store, filterStore)) return;

          const items = o.items || [];
          items.forEach(item => {
            if (!item || !item.id) return;
            const itemCat = productCategoryMap[item.id] || 'other';
            if (filterCategory !== 'all' && itemCat !== filterCategory) return;

            const itemName = item.name || '';
            const searchLower = filterSearch.toLowerCase();
            const matchSearch = itemName.toLowerCase().includes(searchLower) ||
              (productSKUMap[item.id] || '').toLowerCase().includes(searchLower);
            if (filterSearch && !matchSearch) return;

            const normalizedStore = normalizeStoreName(o.store || 'Store #01');
            const key = `${item.id}_${normalizedStore}`;

            if (!salesMap[key]) {
              salesMap[key] = {
                productId: item.id,
                productName: itemName,
                sku: productSKUMap[item.id] || '',
                emoji: productEmojiMap[item.id] || '📦',
                qty: 0,
                grossSales: 0,
                discounts: 0,
                nettRevenue: 0,
                cogs: 0,
                category: itemCat,
                store: normalizedStore
              };
            }
            const totalOrderDiscounts = Number(o.promoDiscount || 0) + Number(o.itemDiscount || 0);
            const itemDiscountShare = o.subtotal > 0 ? (totalOrderDiscounts * (Number(item.total || 0) / o.subtotal)) : 0;
            const itemGrossSales = Number(item.total || 0);
            const itemNettRevenue = itemGrossSales - itemDiscountShare;

            // COGS Lookup
            const prod = products.find(p => p.id === item.id);
            let itemCogs = 0;
            if (prod) {
              if (prod.cogs !== undefined && prod.cogs !== null && prod.cogs !== '') {
                itemCogs = Number(prod.cogs) * Number(item.qty || 0);
              } else {
                itemCogs = Number(prod.basePrice || item.price || 0) * 0.3 * Number(item.qty || 0);
              }
            } else {
              itemCogs = Number(item.price || 0) * 0.3 * Number(item.qty || 0);
            }

            salesMap[key].qty += Number(item.qty || 0);
            salesMap[key].grossSales += itemGrossSales;
            salesMap[key].discounts += itemDiscountShare;
            salesMap[key].nettRevenue += itemNettRevenue;
            salesMap[key].cogs += itemCogs;
          });
        });

        filteredData = Object.values(salesMap).map(g => {
          g.profit = g.nettRevenue - g.cogs;
          g.margin = g.nettRevenue > 0 ? ((g.profit / g.nettRevenue) * 100) : 0;
          g.avgPrice = g.qty > 0 ? (g.nettRevenue / g.qty) : 0;
          return g;
        });

        // Filter and append dummy sales breakdown
        const filteredDummySales = DUMMY_SALES.filter(item => {
          if (!item) return false;
          if (item.date < filterDateFrom || item.date > filterDateTo) return false;
          if (!isStoreMatch(item.store, filterStore)) return false;
          if (filterCategory !== 'all' && item.category !== filterCategory) return false;
          if (filterSearch) {
            const sLower = filterSearch.toLowerCase();
            const pName = item.productName || '';
            const sku = item.sku || '';
            if (!pName.toLowerCase().includes(sLower) && !sku.toLowerCase().includes(sLower)) return false;
          }
          return true;
        }).map(item => {
          const qty = Number(item.qty || 0);
          const revenue = Number(item.revenue || 0);
          const dummyCogs = revenue * 0.3;
          const dummyNett = revenue;
          const dummyProfit = dummyNett - dummyCogs;
          return {
            productId: item.productId,
            productName: item.productName || '',
            sku: item.sku || '',
            emoji: item.emoji || '📦',
            qty: qty,
            grossSales: revenue,
            discounts: 0,
            nettRevenue: dummyNett,
            cogs: dummyCogs,
            profit: dummyProfit,
            margin: dummyNett > 0 ? ((dummyProfit / dummyNett) * 100) : 0,
            category: item.category || 'other',
            store: item.store || '',
            avgPrice: qty > 0 ? (dummyNett / qty) : 0
          };
        });

        filteredData = filteredData.concat(filteredDummySales);
      } else if (currentTab === 'promos') {
        const promoList = [];
        Object.keys(promos).forEach(code => {
          const promo = promos[code];
          if (!promo) return;
          const isActive = promo.active !== false;

          const searchLower = filterSearch.toLowerCase();
          const desc = promo.description || '';
          if (filterSearch && !code.toLowerCase().includes(searchLower) && !desc.toLowerCase().includes(searchLower)) {
            return;
          }

          let appliedCount = 0;
          let totalDiscount = 0;
          let promoRevenue = 0;

          dateFilteredOrders.forEach(o => {
            if (!o) return;
            if (!isStoreMatch(o.store, filterStore)) return;
            if (o.promoCode && o.promoCode.toUpperCase() === code.toUpperCase()) {
              appliedCount++;
              totalDiscount += Number(o.promoDiscount || 0);
              promoRevenue += Number(o.total || 0);
            }
          });

          const roi = totalDiscount > 0 ? ((promoRevenue - totalDiscount) / totalDiscount * 100) : 0;

          promoList.push({
            promo: code,
            type: promo.kind === 'percent' ? 'Percentage' : 'Fixed',
            value: promo.kind === 'percent' ? `${(promo.value * 100).toFixed(0)}%` : formatCurrency(promo.value),
            rawValue: promo.value || 0,
            applied: appliedCount,
            discount: totalDiscount,
            roi: roi,
            status: isActive ? 'Active' : 'Inactive'
          });
        });

        // Filter and append dummy promos
        DUMMY_PROMOS.forEach(item => {
          if (!item) return;
          const searchLower = filterSearch.toLowerCase();
          if (filterSearch && !item.promo.toLowerCase().includes(searchLower)) {
            return;
          }

          // Skip duplicates
          if (promoList.some(p => p.promo.toUpperCase() === item.promo.toUpperCase())) {
            return;
          }

          const redemptions = item.redemptions || [];
          const filteredRedemptions = redemptions.filter(r => {
            if (!r) return false;
            if (r.date < filterDateFrom || r.date > filterDateTo) return false;
            if (!isStoreMatch(r.store, filterStore)) return false;
            return true;
          });

          let appliedCount = 0;
          let totalDiscount = 0;
          let promoRevenue = 0;
          filteredRedemptions.forEach(r => {
            appliedCount++;
            totalDiscount += Number(r.discount || 0);
            promoRevenue += Number(r.revenue || 0);
          });

          const roi = totalDiscount > 0 ? ((promoRevenue - totalDiscount) / totalDiscount * 100) : 0;

          promoList.push({
            promo: item.promo,
            type: item.type,
            value: item.value,
            rawValue: item.rawValue,
            applied: appliedCount,
            discount: totalDiscount,
            roi: roi,
            status: item.status
          });
        });

        filteredData = promoList;
      } else if (currentTab === 'inventory') {
        const inventoryList = [];
        const dFrom = new Date(filterDateFrom);
        const dTo = new Date(filterDateTo);
        const diffDays = Math.max(1, Math.ceil(Math.abs(dTo - dFrom) / (1000 * 60 * 60 * 24)) + 1);

        const soldMap = {};
        dateFilteredOrders.forEach(o => {
          if (!o) return;
          if (!isStoreMatch(o.store, filterStore)) return;
          const items = o.items || [];
          items.forEach(item => {
            if (!item || !item.id) return;
            if (!soldMap[item.id]) soldMap[item.id] = 0;
            soldMap[item.id] += Number(item.qty || 0);
          });
        });

        products.forEach(p => {
          if (!p) return;
          if (filterCategory !== 'all' && p.cat !== filterCategory) return;

          const searchLower = filterSearch.toLowerCase();
          const pName = p.name || '';
          const sku = p.sku || '';
          if (filterSearch && !pName.toLowerCase().includes(searchLower) && !sku.toLowerCase().includes(searchLower)) {
            return;
          }

          const storeStocks = p.stocks || {};
          const s01Stock = Number(storeStocks['Store #01'] || storeStocks['Store #01 (POS)'] || 0);
          const s02Stock = Number(storeStocks['Store #02'] || storeStocks['Store #02 (POS)'] || 0);
          const s03Stock = Number(storeStocks['Store #03'] || storeStocks['Store #03 (POS)'] || 0);
          const s04Stock = Number(storeStocks['Store #04'] || storeStocks['Store #04 (POS)'] || 0);

          let totalStock = p.stock !== undefined ? p.stock : (s01Stock + s02Stock + s03Stock + s04Stock);
          if (filterStore !== 'all') {
            if (filterStore === 'Store #01') totalStock = s01Stock;
            else if (filterStore === 'Store #02') totalStock = s02Stock;
            else if (filterStore === 'Store #03') totalStock = s03Stock;
            else if (filterStore === 'Store #04') totalStock = s04Stock;
          }

          let status = 'In Stock';
          if (totalStock === 0) status = 'Out of Stock';
          else if (totalStock <= 5) status = 'Low Stock';

          const unitsSold = soldMap[p.id] || 0;
          const turnover = unitsSold / diffDays;

          inventoryList.push({
            productId: p.id,
            product: pName,
            sku: sku,
            emoji: p.emoji || '📦',
            s01: s01Stock,
            s02: s02Stock,
            s03: s03Stock,
            s04: s04Stock,
            total_stock: totalStock,
            status: status,
            turnover: turnover
          });
        });

        // Filter and append dummy inventory products
        DUMMY_INVENTORY_PRODUCTS.forEach(p => {
          if (!p) return;
          if (filterCategory !== 'all' && p.cat !== filterCategory) return;

          const searchLower = filterSearch.toLowerCase();
          const pName = p.name || '';
          const sku = p.sku || '';
          if (filterSearch && !pName.toLowerCase().includes(searchLower) && !sku.toLowerCase().includes(searchLower)) {
            return;
          }

          // Skip duplicates
          if (inventoryList.some(item => (item.product || '').toLowerCase() === pName.toLowerCase() || (item.sku || '').toLowerCase() === sku.toLowerCase())) {
            return;
          }

          const storeStocks = p.stocks || {};
          const s01Stock = Number(storeStocks['Store #01'] || 0);
          const s02Stock = Number(storeStocks['Store #02'] || 0);
          const s03Stock = Number(storeStocks['Store #03'] || 0);
          const s04Stock = Number(storeStocks['Store #04'] || 0);

          let totalStock = (s01Stock + s02Stock + s03Stock + s04Stock);
          if (filterStore !== 'all') {
            if (filterStore === 'Store #01') totalStock = s01Stock;
            else if (filterStore === 'Store #02') totalStock = s02Stock;
            else if (filterStore === 'Store #03') totalStock = s03Stock;
            else if (filterStore === 'Store #04') totalStock = s04Stock;
          }

          let status = 'In Stock';
          if (totalStock === 0) status = 'Out of Stock';
          else if (totalStock <= 5) status = 'Low Stock';

          const sales = p.sales || [];
          const filteredSales = sales.filter(s => {
            if (!s) return false;
            if (s.date < filterDateFrom || s.date > filterDateTo) return false;
            if (!isStoreMatch(s.store, filterStore)) return false;
            return true;
          });
          const unitsSold = filteredSales.reduce((sum, s) => sum + Number(s.qty || 0), 0);
          const turnover = unitsSold / diffDays;

          inventoryList.push({
            productId: p.id,
            product: pName,
            sku: sku,
            emoji: p.emoji || '📦',
            s01: s01Stock,
            s02: s02Stock,
            s03: s03Stock,
            s04: s04Stock,
            total_stock: totalStock,
            status: status,
            turnover: turnover
          });
        });

        filteredData = inventoryList;
      } else if (currentTab === 'stores') {
        const storeComparisonList = [];
        const storeNames = stores.length > 0 ? stores.map(s => s.name) : [
          'Store #01', 'Store #02', 'Store #03', 'Store #04',
          'Store #05', 'Store #06', 'Store #07', 'Store #08',
          'Store #09', 'Store #10'
        ];

        const storeLowStockCount = {};
        storeNames.forEach(st => {
          storeLowStockCount[st] = 0;
          products.forEach(p => {
            if (!p) return;
            const storeStocks = p.stocks || {};
            const stockAtStore = Number(storeStocks[st] || storeStocks[`${st} (POS)`] || 0);
            if (stockAtStore <= 5) {
              storeLowStockCount[st]++;
            }
          });
        });

        storeNames.forEach(st => {
          if (filterStore !== 'all' && !isStoreMatch(st, filterStore)) return;
          if (filterSearch && !st.toLowerCase().includes(filterSearch.toLowerCase())) return;

          let revenue = 0;
          let transactions = 0;
          const productQuantities = {};

          // Process real orders
          dateFilteredOrders.forEach(o => {
            if (!o) return;
            if (isStoreMatch(o.store, st)) {
              revenue += Number(o.total || 0);
              transactions++;
              const items = o.items || [];
              items.forEach(item => {
                if (!item || !item.id) return;
                const itemCat = productCategoryMap[item.id] || 'other';
                if (filterCategory !== 'all' && itemCat !== filterCategory) return;

                const itemName = item.name || '';
                if (!productQuantities[itemName]) productQuantities[itemName] = 0;
                productQuantities[itemName] += Number(item.qty || 0);
              });
            }
          });

          // Process dummy store transactions
          const dummyStore = DUMMY_STORES_DATA[st];
          if (dummyStore) {
            const transactionsList = dummyStore.transactions || [];
            const filteredDummies = transactionsList.filter(r => {
              if (!r) return false;
              if (r.date < filterDateFrom || r.date > filterDateTo) return false;
              if (filterCategory !== 'all' && r.category !== filterCategory) return false;
              return true;
            });
            filteredDummies.forEach(r => {
              revenue += Number(r.revenue || 0);
              transactions++;
            });
          }

          const avgBasket = transactions > 0 ? (revenue / transactions) : 0;

          let topSeller = '-';
          let maxQty = 0;
          Object.keys(productQuantities).forEach(name => {
            if (productQuantities[name] > maxQty) {
              maxQty = productQuantities[name];
              topSeller = name;
            }
          });

          if (topSeller !== '-' && maxQty > 0) {
            topSeller = `${topSeller} (${maxQty} sold)`;
          } else {
            // Fallback for stores with dummy transactions
            if (revenue > 0) {
              const dummyTopSellers = {
                'coffee': 'Caramel Macchiato',
                'tea': 'Matcha Green Tea',
                'bakery': 'Strawberry Pastry',
                'food': 'Smoked Salmon Bagel',
                'snacks': 'Roasted Almonds Pack',
                'all': 'Caramel Macchiato'
              };
              const catKey = filterCategory === 'all' ? 'all' : filterCategory;
              const mockName = dummyTopSellers[catKey] || 'Caramel Macchiato';
              const mockQty = Math.max(1, Math.round(revenue / 5));
              topSeller = `${mockName} (${mockQty} sold)`;
            }
          }

          const lowStockCount = (storeLowStockCount[st] !== undefined && (st === 'Store #01' || st === 'Store #02' || st === 'Store #03' || st === 'Store #04'))
            ? storeLowStockCount[st]
            : (dummyStore ? dummyStore.lowStock : 0);

          storeComparisonList.push({
            store: st,
            revenue: revenue,
            transactions: transactions,
            avg_basket: avgBasket,
            low_stock: lowStockCount,
            top_seller: topSeller
          });
        });
        filteredData = storeComparisonList;
      }
    }

    function sortData() {
      if (!currentSortCol) return;

      filteredData.sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];

        if (currentSortCol === 'product') {
          valA = currentTab === 'sales' ? a.productName : a.product;
          valB = currentTab === 'sales' ? b.productName : b.product;
        } else if (currentSortCol === 'value') {
          valA = a.rawValue;
          valB = b.rawValue;
        }

        if (typeof valA === 'string') {
          return currentSortDir === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return currentSortDir === 'asc'
            ? (valA - valB)
            : (valB - valA);
        }
      });
    }

    function renderTable() {
      try {
        calculateData();
        sortData();
      } catch (err) {
        console.error("Error calculating or sorting report data:", err);
        filteredData = [];
      }

      const totalItems = filteredData.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      if (currentPage > totalPages) currentPage = totalPages;

      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      const paginatedData = filteredData.slice(startIndex, endIndex);

      const body = document.getElementById('detailTableBody');
      let bodyHtml = '';

      if (paginatedData.length === 0) {
        bodyHtml = `<tr><td colspan="10" style="text-align: center; color: var(--gray-500); padding: 40px; font-weight: 500;">No results found matching filters</td></tr>`;
      } else {
        paginatedData.forEach(row => {
          bodyHtml += renderRowHtml(row);
        });
      }
      body.innerHTML = bodyHtml;

      // Update labels
      document.getElementById('detailResultCount').textContent = totalItems > 0
        ? `Showing ${startIndex + 1}-${endIndex} of ${totalItems} results`
        : `Showing 0-0 of 0 results`;
      document.getElementById('pageIndicator').textContent = `Page ${currentPage} of ${totalPages}`;

      // Update button disabled state
      document.getElementById('btnPrevPage').disabled = currentPage === 1;
      document.getElementById('btnNextPage').disabled = currentPage === totalPages;
    }

    // ============ Event Listeners ============

    // Sort Header Click delegation
    document.getElementById('detailTableHeader').addEventListener('click', (e) => {
      const th = e.target.closest('.sortable');
      if (!th) return;

      const col = th.getAttribute('data-col');
      if (currentSortCol === col) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortCol = col;
        currentSortDir = 'desc';
      }

      renderTableHeader();
      renderTable();
    });

    // Sub-tab button switching
    const tabButtons = document.querySelectorAll('.secondary-tabs .tab-button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = btn.getAttribute('data-tab');
        currentPage = 1;
        currentSortCol = '';
        currentSortDir = 'desc';

        renderTableHeader();
        renderTable();
      });
    });

    // Filter Controls
    document.getElementById('filterDateFrom').addEventListener('change', () => { currentPage = 1; renderTable(); });
    document.getElementById('filterDateTo').addEventListener('change', () => { currentPage = 1; renderTable(); });
    document.getElementById('filterStore').addEventListener('change', () => { currentPage = 1; renderTable(); });
    document.getElementById('filterCategory').addEventListener('change', () => { currentPage = 1; renderTable(); });
    document.getElementById('filterSearch').addEventListener('input', () => { currentPage = 1; renderTable(); });

    // Pagination
    document.getElementById('btnPrevPage').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
    document.getElementById('btnNextPage').addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });

    // Export Dropdown Toggle
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');

    if (exportDropdownBtn && exportDropdown) {
      exportDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        exportDropdown.classList.remove('show');
      });
    }

    // PDF Export
    const exportPdfOpt = document.getElementById('exportPdfOpt');
    if (exportPdfOpt) {
      exportPdfOpt.addEventListener('click', () => {
        showToast('Preparing PDF export...');
        setTimeout(() => {
          window.print();
        }, 500);
      });
    }

    // CSV Export
    const exportCsvOpt = document.getElementById('exportCsvOpt');
    if (exportCsvOpt) {
      exportCsvOpt.addEventListener('click', () => {
        showToast('Exporting to CSV...');
        try {
          let csvParts = ["\uFEFF"]; // Include BOM for proper Excel UTF-8 encoding

          const headers = [];
          const headerThs = document.querySelectorAll('#detailTableHeader th');
          headerThs.forEach(th => {
            const text = th.textContent.replace(/[↕▲▼\s]+/g, ' ').trim();
            headers.push('"' + text.replace(/"/g, '""') + '"');
          });
          csvParts.push(headers.join(",") + "\r\n");

          filteredData.forEach(row => {
            const line = [];
            if (currentTab === 'sales') {
              line.push(row.productName, row.qty, row.revenue, row.avgPrice, row.category, row.store);
            } else if (currentTab === 'promos') {
              line.push(row.promo, row.type, row.value, row.applied, row.discount, row.roi, row.status);
            } else if (currentTab === 'inventory') {
              line.push(row.product, row.s01, row.s02, row.s03, row.s04, row.total_stock, row.status, row.turnover);
            } else if (currentTab === 'stores') {
              line.push(row.store, row.revenue, row.transactions, row.avg_basket, row.low_stock, row.top_seller);
            }
            const escaped = line.map(val => {
              const str = String(val === undefined || val === null ? '' : val);
              return '"' + str.replace(/"/g, '""') + '"';
            });
            csvParts.push(escaped.join(",") + "\r\n");
          });

          const blob = new Blob(csvParts, { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `detail_report_${currentTab}_${new Date().toISOString().substring(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          showToast('CSV downloaded successfully!');
        } catch (e) {
          console.error(e);
          showToast('CSV export failed.');
        }
      });
    }

    // ============ Initial Load ============
    renderTableHeader();
    renderTable();
  });
})();

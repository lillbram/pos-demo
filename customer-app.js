(() => {
  // Helper functions
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  // Initials for avatar
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  // Local state
  let customers = [];
  let orders = [];

  const todayStr = '2026-05-22'; // Hardcoded reference date for "today" to match app state

  // ============ Load Data ============
  function loadData() {
    // Load customers
    if (localStorage.getItem('pos_customers')) {
      try {
        customers = JSON.parse(localStorage.getItem('pos_customers'));
      } catch (e) {
        console.error('Error parsing pos_customers', e);
        customers = (window.POS_DATA && window.POS_DATA.CUSTOMERS) || [];
      }
    } else {
      customers = (window.POS_DATA && window.POS_DATA.CUSTOMERS) || [];
      localStorage.setItem('pos_customers', JSON.stringify(customers));
    }

    // Load orders
    try {
      orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    } catch (e) {
      console.error('Error parsing pos_orders', e);
      orders = [];
    }
  }

  // ============ Calculate & Render Today Metrics ============
  function renderMetrics() {
    const todayOrders = orders.filter(o => {
      if (!o.date) return false;
      return o.date.slice(0, 10) === todayStr;
    });

    // Walk-ins (Non-member)
    const walkInsCount = todayOrders.filter(o => !o.customerId).length;

    // Unique loyalty members who placed orders today
    const memberIds = [...new Set(todayOrders.filter(o => o.customerId).map(o => o.customerId))];

    let newMemberCount = 0;
    let existingMemberCount = 0;

    memberIds.forEach(id => {
      const cust = customers.find(c => c.id === id);
      if (cust) {
        if (cust.since === todayStr) {
          newMemberCount++;
        } else {
          existingMemberCount++;
        }
      }
    });

    const totalTodayCount = walkInsCount + newMemberCount + existingMemberCount;

    // Update UI elements
    $('#metricAll').textContent = totalTodayCount;
    $('#metricNew').textContent = newMemberCount;
    $('#metricExist').textContent = existingMemberCount;
    $('#metricNon').textContent = walkInsCount;
  }

  // ============ Render Customer Table ============
  function renderTable() {
    const query = $('#custSearchInput').value.trim().toLowerCase();
    const sortBy = $('#custSortSelect').value;

    // Filter
    let filtered = customers.filter(c => {
      if (!query) return true;
      const normalizedPhone = c.phone.replace(/[\s\-+]/g, '');
      const normalizedQuery = query.replace(/[\s\-+]/g, '');
      return c.name.toLowerCase().includes(query) || normalizedPhone.includes(normalizedQuery);
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'since-desc':
          return b.since.localeCompare(a.since);
        case 'since-asc':
          return a.since.localeCompare(b.since);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'points-desc':
          return b.points - a.points;
        case 'points-asc':
          return a.points - b.points;
        case 'orders-desc':
          return b.orders - a.orders;
        case 'orders-asc':
          return a.orders - b.orders;
        default:
          return 0;
      }
    });

    const tbody = $('#custTableBody');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--gray-500); padding: 32px 0;">
            No customers found matching the search criteria.
          </td>
        </tr>`;
      $('#custCountText').textContent = 'Showing 0 customers';
      return;
    }

    filtered.forEach(c => {
      const isVIP = c.points >= 2000;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="col-id">${c.id}</td>
        <td>
          <div class="col-customer">
            <div class="avatar">${initials(c.name)}</div>
            <div>
              <div class="name">
                ${c.name}
                ${isVIP ? '<span class="badge badge-brand" style="height: 18px; font-size: 10px;">VIP</span>' : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="col-phone">${c.phone}</td>
        <td class="col-points ${isVIP ? 'vip' : ''}">${c.points.toLocaleString()} pts</td>
        <td class="col-date">${c.since}</td>
        <td class="col-orders">${c.orders} orders</td>
      `;
      row.addEventListener('click', () => {
        openCustomerDetails(c);
      });
      tbody.appendChild(row);
    });

    $('#custCountText').textContent = `Showing ${filtered.length} customer${filtered.length === 1 ? '' : 's'}`;
  }

  // ============ Modal Controls ============
  function openModal() {
    $('#regScrim').classList.add('show');
    $('#regModalError').style.display = 'none';
    $('#regModalName').value = '';
    $('#regModalPhone').value = '';
    setTimeout(() => $('#regModalName').focus(), 100);
  }

  function closeModal() {
    $('#regScrim').classList.remove('show');
  }

  function submitRegistration() {
    const name = $('#regModalName').value.trim();
    const phone = $('#regModalPhone').value.trim();
    const err = $('#regModalError');
    err.style.display = 'none';

    if (!name) {
      err.textContent = 'Please enter a name.';
      err.style.display = 'block';
      $('#regModalName').focus();
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 7) {
      err.textContent = 'Please enter a valid phone number (at least 7 digits).';
      err.style.display = 'block';
      $('#regModalPhone').focus();
      return;
    }

    const norm = phone.replace(/\D/g, '');
    const duplicate = customers.find(c => c.phone.replace(/\D/g, '') === norm);
    if (duplicate) {
      err.textContent = `This phone number is already registered to ${duplicate.name}.`;
      err.style.display = 'block';
      return;
    }

    // Determine new ID format like c01, c10 etc.
    let maxIdNum = 0;
    customers.forEach(c => {
      const match = c.id.match(/^c(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNum) maxIdNum = num;
      }
    });
    const nextId = 'c' + (maxIdNum + 1).toString().padStart(2, '0');

    const newCustomer = {
      id: nextId,
      name,
      phone,
      points: 50, // Signup bonus points
      since: todayStr,
      orders: 0
    };

    customers.unshift(newCustomer);
    if (window.saveCustomers) {
      window.saveCustomers(customers);
    } else {
      localStorage.setItem('pos_customers', JSON.stringify(customers));
    }

    // Show toast
    showToast(`Successfully registered ${name}!`);
    closeModal();
    renderMetrics();
    renderTable();
  }

  // ============ Toast Notification ============
  function showToast(message) {
    const toast = $('#toast');
    $('#toastMsg').textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ============ Navigation clicks ============
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
    setupNavigation();

    // Event listeners
    $('#openRegModalBtn').addEventListener('click', openModal);
    $('#closeRegModalBtn').addEventListener('click', closeModal);
    $('#cancelRegModalBtn').addEventListener('click', closeModal);
    $('#submitRegModalBtn').addEventListener('click', submitRegistration);
    $('#custSearchInput').addEventListener('input', renderTable);
    $('#custSortSelect').addEventListener('change', renderTable);

    // Details Modal listeners
    $('#closeDetailModalBtn').addEventListener('click', closeDetailModal);
    $('#custDetailScrim').addEventListener('click', (e) => {
      if (e.target.id === 'custDetailScrim') closeDetailModal();
    });
    $('#detTransList').addEventListener('click', (e) => {
      const card = e.target.closest('.trans-card');
      if (!card) return;
      const details = card.querySelector('.trans-details');
      if (details) {
        details.classList.toggle('show');
      }
    });

    // Escape key modal close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeDetailModal(); }
    });
  }

  // ============ Customer Details Logic & Timelines ============
  const COMMON_PRODUCTS = [
    { name: 'Caffè Latte', price: 4.50 },
    { name: 'Cappuccino', price: 4.20 },
    { name: 'Americano', price: 3.50 },
    { name: 'Espresso', price: 2.80 },
    { name: 'Mocha', price: 5.20 },
    { name: 'Iced Matcha Latte', price: 5.40 },
    { name: 'Earl Grey', price: 3.20 },
    { name: 'Berry Smoothie', price: 6.20 },
    { name: 'Butter Croissant', price: 3.40 },
    { name: 'Blueberry Muffin', price: 3.80 },
    { name: 'Chocolate Cookie', price: 2.50 },
    { name: 'Turkey Club Sandwich', price: 8.90 }
  ];

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

  function createDeterministicRandom(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (h * 31 + seedStr.charCodeAt(i)) | 0;
    }
    return function() {
      h = (h * 1664525 + 1013904223) | 0;
      return (h >>> 0) / 0xffffffff;
    };
  }

  function renderTransactionCard(order) {
    const itemsHtml = order.items.map(item => {
      const variantText = item.variantText ? ` (${item.variantText})` : '';
      return `
        <div class="trans-item-row">
          <span>${item.qty} × ${item.name}${variantText}</span>
          <span>${fmt(item.total)}</span>
        </div>
      `;
    }).join('');
    
    const formattedDate = new Date(order.date).toLocaleString([], {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="trans-card" data-order-id="${order.id}">
        <div class="trans-header">
          <div>
            <strong style="color: var(--gray-900); font-size: 13.5px;">${order.id}</strong>
            <div style="font-size: 11px; color: var(--gray-400); margin-top: 2px;">${formattedDate} · ${order.store || 'Store #04'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: var(--gray-900); font-size: 14px;">${fmt(order.total)}</div>
            <div style="font-size: 11px; color: var(--gray-500); text-transform: uppercase; font-weight: 600; margin-top: 2px;">${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'CASH'}</div>
          </div>
        </div>
        <div class="trans-details" id="details-${order.id}">
          <div style="margin-bottom: 8px; font-weight: 600; color: var(--gray-700); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Items</div>
          ${itemsHtml}
          <div class="trans-item-row total-row" style="margin-top: 10px;">
            <span>Subtotal</span>
            <span>${fmt(order.subtotal)}</span>
          </div>
          ${order.itemDiscount > 0 ? `
          <div class="trans-item-row" style="color: var(--danger-600);">
            <span>Item Discount</span>
            <span>-${fmt(order.itemDiscount)}</span>
          </div>` : ''}
          ${order.promoDiscount > 0 ? `
          <div class="trans-item-row" style="color: var(--danger-600);">
            <span>Promo Discount (${order.promoCode || 'PROMO'})</span>
            <span>-${fmt(order.promoDiscount)}</span>
          </div>` : ''}
          ${order.pointsRedeemed > 0 ? `
          <div class="trans-item-row" style="color: var(--danger-600); font-weight: 500;">
            <span>Points Redeemed</span>
            <span>-${fmt(order.pointsRedeemed)}</span>
          </div>` : ''}
          <div class="trans-item-row">
            <span>Tax (8%)</span>
            <span>${fmt(order.tax)}</span>
          </div>
          <div class="trans-item-row total-row">
            <span>Total Paid</span>
            <span>${fmt(order.total)}</span>
          </div>
          <div style="margin-top: 10px; padding: 8px; background: var(--gray-50); border-radius: 6px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 500;">
            <span style="color: var(--success-700); font-weight: 600;">Earned: +${order.pointsEarned || 0} pts</span>
            ${order.pointsRedeemed > 0 ? `<span style="color: var(--danger-700); font-weight: 600;">Redeemed: -${order.pointsRedeemed} pts</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderTimelineItem(event) {
    const isPlus = event.delta > 0;
    const markerClass = isPlus ? 'topup' : 'redeem';
    const deltaText = isPlus ? `+${event.delta}` : `-${Math.abs(event.delta)}`;
    const deltaClass = isPlus ? 'plus' : 'minus';
    
    const formattedDate = new Date(event.date).toLocaleString([], {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    
    const markerIcon = isPlus 
      ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--success-600)" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`
      : `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--danger-600)" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;

    return `
      <div class="timeline-item" style="padding-bottom: 4px;">
        <div class="timeline-marker ${markerClass}">
          ${markerIcon}
        </div>
        <div class="timeline-time">${formattedDate}</div>
        <div class="timeline-title-row">
          <span class="timeline-title">${event.description}</span>
          <span class="timeline-delta ${deltaClass}">${deltaText} pts</span>
        </div>
        <div style="font-size: 11px; color: var(--gray-400); margin-top: 2px;">Balance: ${event.runningBalance.toLocaleString()} pts</div>
      </div>
    `;
  }

  function openCustomerDetails(c) {
    // 1. Set basic details
    $('#detAvatar').textContent = initials(c.name);
    $('#detName').firstChild.textContent = c.name + ' '; // keep space for VIP badge
    $('#detPhone').textContent = c.phone;
    
    // Joined date formatting
    const joinDate = new Date(c.since);
    const joinedStr = joinDate.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit' });
    $('#detJoined').textContent = `Member since ${joinedStr}`;
    
    // VIP badge show/hide
    const isVIP = c.points >= 2000;
    $('#detVipBadge').style.display = isVIP ? '' : 'none';
    
    // Points balance
    $('#detPoints').textContent = `${c.points.toLocaleString()} pts`;
    
    // 2. Fetch actual orders
    const actualOrders = orders.filter(o => o.customerId === c.id);
    
    // 3. Generate simulated orders deterministically
    const generatedOrders = [];
    const simulatedCount = c.orders - actualOrders.length;
    
    if (simulatedCount > 0) {
      // Seed based on customer ID
      const rand = createDeterministicRandom(c.id);
      
      const startDate = new Date(c.since + 'T09:00:00Z').getTime();
      const endDate = new Date('2026-05-21T18:00:00Z').getTime();
      const interval = (endDate - startDate) / (simulatedCount + 1);
      
      const orderTimes = [];
      for (let i = 1; i <= simulatedCount; i++) {
        const jitter = (rand() - 0.5) * interval * 0.8;
        const time = startDate + i * interval + jitter;
        orderTimes.push(Math.max(startDate, Math.min(endDate, time)));
      }
      // Sort times ascending
      orderTimes.sort((a, b) => a - b);
      
      orderTimes.forEach((time, index) => {
        const orderIdNum = 1000 + Math.floor(rand() * 8000) + index;
        const orderId = `SIM-0${orderIdNum}`;
        const store = ['Store #01', 'Store #02', 'Store #03'][Math.floor(rand() * 3)];
        const paymentMethod = ['cash', 'card', 'qr'][Math.floor(rand() * 3)];
        
        // Items selection
        const itemCount = 1 + Math.floor(rand() * 3);
        const orderItems = [];
        for (let j = 0; j < itemCount; j++) {
          const prod = COMMON_PRODUCTS[Math.floor(rand() * COMMON_PRODUCTS.length)];
          const qty = 1 + Math.floor(rand() * 2);
          orderItems.push({
            id: 'p' + j,
            name: prod.name,
            qty: qty,
            price: prod.price,
            total: prod.price * qty,
            variantText: rand() > 0.6 ? ['Medium', 'Large', 'Whole', 'Oat'][Math.floor(rand() * 4)] : ''
          });
        }
        
        const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
        const promoDiscount = rand() > 0.8 ? Math.round(subtotal * 0.1 * 10) / 10 : 0;
        const tax = Math.round((subtotal - promoDiscount) * 0.08 * 100) / 100;
        const total = subtotal - promoDiscount + tax;
        
        generatedOrders.push({
          id: orderId,
          date: new Date(time).toISOString(),
          customerId: c.id,
          customerName: c.name,
          store: store,
          items: orderItems,
          paymentMethod: paymentMethod,
          subtotal: subtotal,
          itemDiscount: 0,
          promoDiscount: promoDiscount,
          promoCode: promoDiscount > 0 ? 'MOCK10' : '',
          tax: tax,
          total: total,
          pointsEarned: Math.floor(total),
          pointsRedeemed: 0
        });
      });
    }
    
    // Combine and sort all orders by date ascending
    const allOrders = [...generatedOrders, ...actualOrders].sort((a, b) => a.date.localeCompare(b.date));
    
    // 4. Points engine simulation
    let currentPoints = 50;
    const randPoints = createDeterministicRandom(c.id + '_points');
    
    allOrders.forEach(order => {
      const isSimulated = order.id.startsWith('SIM-');
      if (isSimulated) {
        if (currentPoints > 100 && randPoints() < 0.25) {
          const maxRedeem = Math.min(Math.floor(currentPoints - 50), Math.floor(order.total), 200);
          order.pointsRedeemed = Math.floor(maxRedeem / 10) * 10;
        } else {
          order.pointsRedeemed = 0;
        }
        order.total = order.subtotal - order.promoDiscount - order.pointsRedeemed + order.tax;
        order.pointsEarned = Math.floor(order.total);
        currentPoints = currentPoints - order.pointsRedeemed + order.pointsEarned;
      } else {
        currentPoints = currentPoints - (order.pointsRedeemed || 0) + (order.pointsEarned || 0);
      }
    });
    
    const diff = c.points - currentPoints;
    
    let signupBonus = 50 + diff;
    if (signupBonus < 0) {
      signupBonus = 50;
      const simOrders = allOrders.filter(o => o.id.startsWith('SIM-'));
      if (simOrders.length > 0) {
        simOrders[0].pointsEarned += diff;
      }
    }
    
    // 5. Generate timeline events
    const timelineEvents = [
      {
        date: c.since + 'T09:00:00.000Z',
        description: 'Signup Bonus',
        delta: signupBonus,
        runningBalance: signupBonus
      }
    ];
    
    let balance = signupBonus;
    allOrders.forEach(order => {
      if (order.pointsRedeemed > 0) {
        balance -= order.pointsRedeemed;
        timelineEvents.push({
          date: order.date,
          description: `Redeemed points for order #${order.id}`,
          delta: -order.pointsRedeemed,
          runningBalance: balance
        });
      }
      if (order.pointsEarned > 0) {
        balance += order.pointsEarned;
        timelineEvents.push({
          date: order.date,
          description: `Points earned from order #${order.id}`,
          delta: order.pointsEarned,
          runningBalance: balance
        });
      }
    });
    
    timelineEvents.forEach((evt, idx) => { evt.seq = idx; });
    timelineEvents.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.seq - a.seq;
    });
    
    // 6. Render Transaction History column
    const transListEl = $('#detTransList');
    transListEl.innerHTML = '';
    
    const displayOrders = [...allOrders].sort((a, b) => b.date.localeCompare(a.date));
    $('#detTransCount').textContent = `${displayOrders.length} order${displayOrders.length === 1 ? '' : 's'}`;
    
    if (displayOrders.length === 0) {
      transListEl.innerHTML = `
        <div style="text-align: center; color: var(--gray-400); padding: 40px 0; font-size: 13px;">
          No transactions recorded.
        </div>`;
    } else {
      displayOrders.forEach(order => {
        const temp = document.createElement('div');
        temp.innerHTML = renderTransactionCard(order);
        transListEl.appendChild(temp.firstElementChild);
      });
    }
    
    // 7. Render Points Timeline column
    const timelineEl = $('#detPointsTimeline');
    timelineEl.innerHTML = '';
    
    if (timelineEvents.length === 0) {
      timelineEl.innerHTML = `
        <div style="text-align: center; color: var(--gray-400); padding: 40px 0; font-size: 13px;">
          No points events recorded.
        </div>`;
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'timeline';
      timelineEvents.forEach(evt => {
        wrap.innerHTML += renderTimelineItem(evt);
      });
      timelineEl.appendChild(wrap);
    }
    
    // 8. Open details modal
    $('#custDetailScrim').classList.add('show');
  }

  function closeDetailModal() {
    $('#custDetailScrim').classList.remove('show');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

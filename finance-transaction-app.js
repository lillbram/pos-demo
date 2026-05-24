(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};
  
  // Sort State
  let currentSortCol = 'date';
  let currentSortAsc = false;

  // ============ Price Formatting ============
  function formatCurrency(val) {
    const formatted = val % 1 === 0 
      ? val.toLocaleString('en-US') 
      : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return 'Rp\u00A0' + formatted;
  }

  // ============ Load Data ============
  function loadData() {
    try {
      orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      products = JSON.parse(localStorage.getItem('pos_products') || '[]');
      financeConfig = JSON.parse(localStorage.getItem('pos_finance_config')) || {
        dailySalaries: 3000000,
        dailyRent: 2000000,
        dailyUtilities: 500000,
        taxRate: 10,
        taxApplyTo: 'revenue',
        targetGrossMargin: 65,
        targetOperatingMargin: 30,
        targetNetMargin: 15,
        alertsEnabled: true
      };
    } catch (e) {
      console.error('Error loading data for Transaction Details', e);
    }
  }

  // ============ COGS Calculation Helper ============
  function getItemCogs(itemId, unitPrice) {
    const prod = products.find(p => p.id === itemId);
    if (prod && prod.cogs !== undefined && prod.cogs !== null && prod.cogs !== '') {
      return Number(prod.cogs);
    }
    // Fallback: 30% of price
    return Number(unitPrice * 0.3);
  }

  function getOrderCogs(order) {
    let totalCogs = 0;
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const cogs = getItemCogs(item.id, item.price);
        totalCogs += cogs * Number(item.qty || 0);
      });
    }
    return totalCogs;
  }

  // ============ Date Range Helper ============
  function getDaysInRange(fromDateStr, toDateStr) {
    if (!fromDateStr || !toDateStr) return 1;
    const start = new Date(fromDateStr);
    const end = new Date(toDateStr);
    const timeDiff = end.getTime() - start.getTime();
    if (isNaN(timeDiff)) return 1;
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    return Math.max(1, dayDiff);
  }

  // ============ Filter & Calculate Transactions ============
  function getFilteredTransactions() {
    const fromDateStr = $('#filterFromDate').value;
    const toDateStr = $('#filterToDate').value;
    const storeVal = $('#filterStore').value;
    const paymentVal = $('#filterPayment').value;
    const promoVal = $('#filterPromo').value;
    const minProfitVal = $('#filterMinProfit').value;
    const maxProfitVal = $('#filterMaxProfit').value;
    const searchVal = $('#filterSearch').value.trim().toLowerCase();

    return orders.filter(o => {
      // 1. Date filter
      if (!o.date) return false;
      const orderDateStr = o.date.slice(0, 10);
      if (fromDateStr && orderDateStr < fromDateStr) return false;
      if (toDateStr && orderDateStr > toDateStr) return false;

      // 2. Store filter
      if (storeVal !== 'all') {
        const oStoreClean = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
        if (oStoreClean !== storeVal) return false;
      }

      // 3. Payment Method filter
      if (paymentVal !== 'all') {
        const isSplit = o.pointsRedeemed > 0 && o.total > 0;
        const isPointsOnly = o.pointsRedeemed > 0 && o.total === 0;
        
        if (paymentVal === 'split' && !isSplit) return false;
        if (paymentVal === 'points' && !isPointsOnly) return false;
        if (paymentVal === 'cash' && (o.paymentMethod !== 'cash' || isSplit || isPointsOnly)) return false;
        if (paymentVal === 'card' && (o.paymentMethod !== 'card' || isSplit || isPointsOnly)) return false;
        if (paymentVal === 'qr' && (o.paymentMethod !== 'qr' || isSplit || isPointsOnly)) return false;
      }

      // 4. Promo filter
      if (promoVal !== 'all') {
        const hasPromo = o.promoCode && o.promoCode.trim() !== '';
        if (promoVal === 'yes' && !hasPromo) return false;
        if (promoVal === 'no' && hasPromo) return false;
      }

      // Calculate financials for this order
      const revenue = Number(o.total || 0);
      const cogs = getOrderCogs(o);
      const profit = revenue - cogs;

      // 5. Profit Range
      if (minProfitVal !== '' && profit < Number(minProfitVal)) return false;
      if (maxProfitVal !== '' && profit > Number(maxProfitVal)) return false;

      // 6. Search
      if (searchVal) {
        const transId = (o.id || '').toLowerCase();
        const custName = (o.customerName || '').toLowerCase();
        if (!transId.includes(searchVal) && !custName.includes(searchVal)) return false;
      }

      return true;
    });
  }

  // ============ Render Page ============
  function renderPage() {
    loadData();
    let filtered = getFilteredTransactions();

    // 1. Calculate and update metrics
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalTransactions = filtered.length;

    filtered.forEach(o => {
      totalRevenue += Number(o.total || 0);
      totalCogs += getOrderCogs(o);
    });

    const grossProfit = totalRevenue - totalCogs;
    const cogsRatio = totalRevenue > 0 ? (totalCogs / totalRevenue * 100) : 0;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;

    // Operating expenses calculation scaled to the selected date range
    const fromDateStr = $('#filterFromDate').value;
    const toDateStr = $('#filterToDate').value;
    const days = getDaysInRange(fromDateStr, toDateStr);
    
    const dailyOpEx = Number(financeConfig.dailySalaries) + Number(financeConfig.dailyRent) + Number(financeConfig.dailyUtilities);
    const totalOpEx = dailyOpEx * days;

    // Tax calculation
    let totalTax = 0;
    if (financeConfig.taxRate > 0) {
      if (financeConfig.taxApplyTo === 'revenue') {
        totalTax = totalRevenue * (financeConfig.taxRate / 100);
      } else {
        // Gross sales before promos
        let totalGrossSales = 0;
        filtered.forEach(o => {
          totalGrossSales += Number(o.subtotal || 0);
        });
        totalTax = totalGrossSales * (financeConfig.taxRate / 100);
      }
    }

    const netProfit = grossProfit - totalOpEx - totalTax;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

    // Set metric card texts
    $('#metricTotalRevenue').textContent = formatCurrency(totalRevenue);
    $('#metricTotalTransactions').textContent = `${totalTransactions} transaction${totalTransactions !== 1 ? 's' : ''}`;
    $('#metricTotalCogs').textContent = formatCurrency(totalCogs);
    $('#metricCogsRatio').textContent = `${cogsRatio.toFixed(1)}% ratio`;
    $('#metricGrossProfit').textContent = formatCurrency(grossProfit);
    $('#metricGrossMargin').textContent = `${grossMargin.toFixed(1)}% margin`;
    $('#metricNetProfit').textContent = formatCurrency(netProfit);
    $('#metricNetMargin').textContent = `${netMargin.toFixed(1)}% margin`;

    // Red alert if below target net margin
    const netCard = $('.m-net');
    if (netCard) {
      if (financeConfig.alertsEnabled && netMargin < Number(financeConfig.targetNetMargin)) {
        netCard.style.border = '1px solid var(--danger-500)';
        $('#metricNetMargin').style.color = 'var(--danger-700)';
      } else {
        netCard.style.border = '';
        $('#metricNetMargin').style.color = '';
      }
    }

    // 2. Sorting
    filtered.sort((a, b) => {
      let valA, valB;
      const profitA = Number(a.total || 0) - getOrderCogs(a);
      const profitB = Number(b.total || 0) - getOrderCogs(b);

      if (currentSortCol === 'id') {
        valA = a.id || '';
        valB = b.id || '';
      } else if (currentSortCol === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (currentSortCol === 'items') {
        valA = a.itemCount || 0;
        valB = b.itemCount || 0;
      } else if (currentSortCol === 'customer') {
        valA = a.customerName || '';
        valB = b.customerName || '';
      } else if (currentSortCol === 'payment') {
        valA = a.paymentMethod || '';
        valB = b.paymentMethod || '';
      } else if (currentSortCol === 'subtotal') {
        valA = a.subtotal || 0;
        valB = b.subtotal || 0;
      } else if (currentSortCol === 'promo') {
        valA = a.promoCode || '';
        valB = b.promoCode || '';
      } else if (currentSortCol === 'tax') {
        valA = a.tax || 0;
        valB = b.tax || 0;
      } else if (currentSortCol === 'revenue') {
        valA = a.total || 0;
        valB = b.total || 0;
      } else if (currentSortCol === 'cogs') {
        valA = getOrderCogs(a);
        valB = getOrderCogs(b);
      } else if (currentSortCol === 'profit') {
        valA = profitA;
        valB = profitB;
      } else if (currentSortCol === 'margin') {
        valA = a.total > 0 ? (profitA / a.total) : 0;
        valB = b.total > 0 ? (profitB / b.total) : 0;
      }

      if (typeof valA === 'string') {
        return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return currentSortAsc ? valA - valB : valB - valA;
      }
    });

    // 3. Render Table rows
    const tbody = $('#transactionsTableBody');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; color: var(--gray-400); padding: 40px 20px;">
            No transactions found for the selected filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(o => {
      const orderCogs = getOrderCogs(o);
      const grossProfit = Number(o.total || 0) - orderCogs;
      const grossMargin = o.total > 0 ? (grossProfit / Number(o.total) * 100) : 0;

      const dateObj = new Date(o.date);
      const timeStr = isNaN(dateObj.getTime()) ? o.date : dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (' + dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ')';

      // Payment badge styling
      let payLabel = o.paymentMethod.toUpperCase();
      let payClass = 'badge-brand';
      if (o.pointsRedeemed > 0) {
        if (o.total > 0) {
          payLabel = 'SPLIT';
          payClass = 'badge-success';
        } else {
          payLabel = 'POINTS';
          payClass = 'badge-success';
        }
      } else if (o.paymentMethod === 'cash') {
        payClass = 'badge';
      }

      const mainRow = document.createElement('tr');
      mainRow.className = 'main-row';
      mainRow.dataset.id = o.id;
      mainRow.innerHTML = `
        <td><strong style="color: var(--brand-700);">${o.id}</strong></td>
        <td>${timeStr}</td>
        <td>${o.itemCount || (o.items ? o.items.length : 0)} items</td>
        <td>${o.customerName || 'Walk-in'}</td>
        <td><span class="p-badge ${payClass}">${payLabel}</span></td>
        <td class="text-right font-mono">${formatCurrency(o.subtotal || 0)}</td>
        <td>
          ${o.promoCode ? `<span class="p-badge badge-brand" title="${o.promoCode}">${o.promoCode} (-${formatCurrency(o.promoDiscount)})</span>` : '<span style="color: var(--gray-400);">-</span>'}
        </td>
        <td class="text-right font-mono">${formatCurrency(o.tax || 0)}</td>
        <td class="text-right font-mono" style="font-weight: 600;">${formatCurrency(o.total || 0)}</td>
        <td class="text-right font-mono">${formatCurrency(orderCogs)}</td>
        <td class="text-right font-mono" style="font-weight: 600; color: ${grossProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(grossProfit)}</td>
        <td class="text-right font-mono" style="font-weight: 500;">${grossMargin.toFixed(1)}%</td>
      `;

      const detailRow = document.createElement('tr');
      detailRow.className = 'detail-row';
      detailRow.id = `details-${o.id}`;

      let itemsRowsMarkup = '';
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          const itemCogs = getItemCogs(item.id, item.price);
          const lineCogs = itemCogs * Number(item.qty);
          const lineProfit = Number(item.total) - lineCogs;
          const lineMargin = item.total > 0 ? (lineProfit / Number(item.total) * 100) : 0;

          itemsRowsMarkup += `
            <tr>
              <td>${item.name} ${item.variantText ? `<div style="font-size: 10px; color: var(--gray-500);">${item.variantText}</div>` : ''}</td>
              <td class="text-right">${item.qty}</td>
              <td class="text-right font-mono">${formatCurrency(item.price)}</td>
              <td class="text-right font-mono" style="font-weight: 500;">${formatCurrency(item.total)}</td>
              <td class="text-right font-mono">${formatCurrency(itemCogs)}</td>
              <td class="text-right font-mono">${formatCurrency(lineCogs)}</td>
              <td class="text-right font-mono" style="font-weight: 500; color: ${lineProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(lineProfit)}</td>
              <td class="text-right font-mono">${lineMargin.toFixed(1)}%</td>
            </tr>
          `;
        });
      }

      detailRow.innerHTML = `
        <td colspan="12" style="padding: 0;">
          <div class="details-box">
            <div class="details-title">
              <span>Itemization & Cost Breakdown</span>
              <span style="font-size: 11px; color: var(--gray-500); font-weight: 500;">Store: ${o.store || 'Store #04'} | Points Redeemed: ${o.pointsRedeemed || 0}</span>
            </div>
            <table class="details-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Unit Price</th>
                  <th class="text-right">Line Total</th>
                  <th class="text-right">Unit Cost</th>
                  <th class="text-right">Line Cost</th>
                  <th class="text-right">Line Profit</th>
                  <th class="text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsMarkup}
              </tbody>
            </table>
          </div>
        </td>
      `;

      tbody.appendChild(mainRow);
      tbody.appendChild(detailRow);

      // Wire Row click toggle details
      mainRow.addEventListener('click', () => {
        const isExp = mainRow.classList.toggle('expanded');
        if (isExp) {
          detailRow.classList.add('show');
        } else {
          detailRow.classList.remove('show');
        }
      });
    });
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    // Inputs filter update
    const filterInputs = [
      '#filterFromDate', '#filterToDate', '#filterStore',
      '#filterPayment', '#filterPromo', '#filterMinProfit',
      '#filterMaxProfit', '#filterSearch'
    ];
    filterInputs.forEach(sel => {
      $(sel).addEventListener('input', renderPage);
      $(sel).addEventListener('change', renderPage);
    });

    // Column sorting headers
    $$('.table-container th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (!col) return;

        if (currentSortCol === col) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortCol = col;
          currentSortAsc = true;
        }

        // Reset sort indicators
        $$('.table-container th .sort-icon').forEach(span => {
          span.textContent = '⇅';
        });
        const iconSpan = th.querySelector('.sort-icon');
        if (iconSpan) {
          iconSpan.textContent = currentSortAsc ? '▲' : '▼';
        }

        renderPage();
      });
    });

    // Toast Notification System
    function showToast(msg) {
      const toast = $('#toast');
      const toastMsg = $('#toastMsg');
      toastMsg.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2500);
    }

    // Export CSV
    $('#btnExportCsv').addEventListener('click', () => {
      const filtered = getFilteredTransactions();
      if (filtered.length === 0) {
        showToast('No transaction data to export.');
        return;
      }

      let csv = 'Transaction ID,Date,Items Count,Customer,Payment Method,Subtotal,Promo Code,Promo Value,Tax,Revenue,COGS,Gross Profit,Gross Margin %\n';
      
      filtered.forEach(o => {
        const orderCogs = getOrderCogs(o);
        const grossProfit = Number(o.total || 0) - orderCogs;
        const grossMargin = o.total > 0 ? (grossProfit / Number(o.total) * 100) : 0;
        
        csv += `"${o.id}","${o.date}",${o.itemCount || 0},"${o.customerName || 'Walk-in'}","${o.paymentMethod}",${o.subtotal},"${o.promoCode || ''}",${o.promoDiscount},${o.tax},${o.total},${orderCogs},${grossProfit},${grossMargin.toFixed(2)}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CSV downloaded successfully.');
    });

    // Export Print / PDF
    $('#btnExportPdf').addEventListener('click', () => {
      showToast('Opening print dialog...');
      setTimeout(() => {
        window.print();
      }, 500);
    });
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    // Set default dates: 1st of month to today
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format YYYY-MM-DD
    const fStr = firstDay.toISOString().slice(0, 10);
    const tStr = today.toISOString().slice(0, 10);
    
    $('#filterFromDate').value = fStr;
    $('#filterToDate').value = tStr;

    setupEvents();
    renderPage();
  });
})();

(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  
  let profitBarChartInstance = null;
  let productMixChartInstance = null;

  // Sorting
  let currentSortCol = 'profit';
  let currentSortAsc = false;

  // ============ Price Formatting ============
  function formatCurrency(val) {
    if (val < 0) {
      return 'Rp\u00A0(' + Math.abs(val).toLocaleString('en-US') + ')';
    }
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
    } catch (e) {
      console.error('Error loading data for Product Profit', e);
    }
  }

  // ============ COGS Calculation Helper ============
  function getItemCogs(itemId, unitPrice) {
    const prod = products.find(p => p.id === itemId);
    if (prod && prod.cogs !== undefined && prod.cogs !== null && prod.cogs !== '') {
      return Number(prod.cogs);
    }
    return Number(unitPrice * 0.3); // 30% fallback
  }

  // ============ Get Filter Dates ============
  function getFilterDates(periodType) {
    const todayRef = '2026-05-22';
    let start, end;
    
    if (periodType === 'today') {
      start = new Date(todayRef + 'T00:00:00.000Z');
      end = new Date(todayRef + 'T23:59:59.999Z');
    } else if (periodType === 'week') {
      start = new Date('2026-05-16T00:00:00.000Z');
      end = new Date('2026-05-22T23:59:59.999Z');
    } else {
      start = new Date('2026-05-01T00:00:00.000Z');
      end = new Date('2026-05-22T23:59:59.999Z');
    }
    return { start, end };
  }

  // ============ Calculate Product Profitability ============
  function calculateProductMetrics() {
    loadData();
    const period = $('.period-chip.active').getAttribute('data-period');
    const store = $('#filterStore').value;
    const { start, end } = getFilterDates(period);

    // Filter orders
    const filteredOrders = orders.filter(o => {
      if (!o.date) return false;
      const oTime = new Date(o.date).getTime();
      if (oTime < start.getTime() || oTime > end.getTime()) return false;
      
      if (store !== 'all') {
        const oStoreClean = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
        if (oStoreClean !== store) return false;
      }
      return true;
    });

    const productMap = {};
    
    // Seed product map with all active products to display them (even if 0 sold)
    products.forEach(p => {
      productMap[p.name] = {
        name: p.name,
        emoji: p.emoji || '📦',
        id: p.id,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        stores: { 'Store #01': 0, 'Store #02': 0, 'Store #03': 0, 'Store #04': 0 }
      };
    });

    // Populate from orders
    filteredOrders.forEach(o => {
      const sName = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          let pData = productMap[item.name];
          if (!pData) {
            // fallback if order has an item not currently in products database
            pData = {
              name: item.name,
              emoji: '📦',
              id: item.id,
              unitsSold: 0,
              revenue: 0,
              cogs: 0,
              profit: 0,
              stores: { 'Store #01': 0, 'Store #02': 0, 'Store #03': 0, 'Store #04': 0 }
            };
            productMap[item.name] = pData;
          }

          pData.unitsSold += Number(item.qty);
          pData.revenue += Number(item.total);
          
          const uCogs = getItemCogs(item.id, item.price);
          pData.cogs += uCogs * Number(item.qty);
          pData.profit = pData.revenue - pData.cogs;
          
          if (sName && pData.stores[sName] !== undefined) {
            pData.stores[sName] += Number(item.qty);
          }
        });
      }
    });

    return Object.values(productMap);
  }

  // ============ Render Table & Charts ============
  function render() {
    let list = calculateProductMetrics();

    // Remove products with 0 units sold if they clutter the view, but let's show all that have sold at least 1 unit, or show all if nothing sold
    const totalSold = list.reduce((sum, p) => sum + p.unitsSold, 0);
    if (totalSold > 0) {
      list = list.filter(p => p.unitsSold > 0);
    }

    // Sort list
    list.sort((a, b) => {
      let valA, valB;
      const marginA = a.revenue > 0 ? (a.profit / a.revenue) : 0;
      const marginB = b.revenue > 0 ? (b.profit / b.revenue) : 0;
      const avgA = a.unitsSold > 0 ? (a.profit / a.unitsSold) : 0;
      const avgB = b.unitsSold > 0 ? (b.profit / b.unitsSold) : 0;

      if (currentSortCol === 'name') {
        valA = a.name;
        valB = b.name;
      } else if (currentSortCol === 'units') {
        valA = a.unitsSold;
        valB = b.unitsSold;
      } else if (currentSortCol === 'revenue') {
        valA = a.revenue;
        valB = b.revenue;
      } else if (currentSortCol === 'cogs') {
        valA = a.cogs;
        valB = b.cogs;
      } else if (currentSortCol === 'profit') {
        valA = a.profit;
        valB = b.profit;
      } else if (currentSortCol === 'margin') {
        valA = marginA;
        valB = marginB;
      } else if (currentSortCol === 'avgProfit') {
        valA = avgA;
        valB = avgB;
      }

      if (typeof valA === 'string') {
        return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return currentSortAsc ? valA - valB : valB - valA;
      }
    });

    // Populate Table
    const tbody = $('#productProfitTableBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--gray-400); padding: 30px;">No product sales logged in this period.</td></tr>`;
      return;
    }

    list.forEach(p => {
      const margin = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
      const avgProfit = p.unitsSold > 0 ? (p.profit / p.unitsSold) : 0;

      tbody.innerHTML += `
        <tr>
          <td><strong style="color: var(--gray-900);">${p.emoji} ${p.name}</strong></td>
          <td class="text-right">${p.unitsSold}</td>
          <td class="text-right font-mono">${formatCurrency(p.revenue)}</td>
          <td class="text-right font-mono">${formatCurrency(p.cogs)}</td>
          <td class="text-right font-mono" style="font-weight:600; color: ${p.profit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(p.profit)}</td>
          <td class="text-right font-mono" style="font-weight:600;">${margin.toFixed(1)}%</td>
          <td class="text-right font-mono">${formatCurrency(avgProfit)}</td>
          <td class="text-right">${p.stores['Store #01'] || 0}</td>
          <td class="text-right">${p.stores['Store #02'] || 0}</td>
          <td class="text-right">${p.stores['Store #03'] || 0}</td>
          <td class="text-right">${p.stores['Store #04'] || 0}</td>
        </tr>
      `;
    });

    // Calculate Sidebar Insights
    let highestProfitItem = null;
    let highestMarginItem = null;
    let mostUnitsItem = null;
    let bestRevenueItem = null;
    let lowestProfitItem = null;

    list.forEach(p => {
      const margin = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
      
      if (!highestProfitItem || p.profit > highestProfitItem.profit) highestProfitItem = p;
      if (!highestMarginItem || margin > (highestMarginItem.profit / highestMarginItem.revenue * 100)) {
        if (p.revenue > 0) highestMarginItem = p;
      }
      if (!mostUnitsItem || p.unitsSold > mostUnitsItem.unitsSold) mostUnitsItem = p;
      if (!bestRevenueItem || p.revenue > bestRevenueItem.revenue) bestRevenueItem = p;
      if (!lowestProfitItem || p.profit < lowestProfitItem.profit) lowestProfitItem = p;
    });

    if (highestProfitItem) {
      $('#insHighestProfit').textContent = `${highestProfitItem.name} (${formatCurrency(highestProfitItem.profit)})`;
      const highMarginPct = highestMarginItem.revenue > 0 ? (highestMarginItem.profit / highestMarginItem.revenue * 100) : 0;
      $('#insHighestMargin').textContent = `${highestMarginItem.name} (${highMarginPct.toFixed(1)}%)`;
      $('#insMostUnits').textContent = `${mostUnitsItem.name} (${mostUnitsItem.unitsSold} units)`;
      $('#insBestRevenue').textContent = `${bestRevenueItem.name} (${formatCurrency(bestRevenueItem.revenue)})`;
      $('#insLowestProfit').textContent = `${lowestProfitItem.name} (${formatCurrency(lowestProfitItem.profit)})`;

      $('#insightRecommendation').innerHTML = `
        <strong>Strategic Action Plan:</strong><br/>
        • Invest marketing spend into <strong>${highestMarginItem.name}</strong> due to its leading gross profitability margin of <strong>${highMarginPct.toFixed(1)}%</strong>.<br/>
        • <strong>${highestProfitItem.name}</strong> continues to drive your baseline profit generating <strong>${formatCurrency(highestProfitItem.profit)}</strong>.<br/>
        • Review pricing, ingredients cost, or supply chains for <strong>${lowestProfitItem.name}</strong> to improve its performance.
      `;
    } else {
      $('#insHighestProfit').textContent = '-';
      $('#insHighestMargin').textContent = '-';
      $('#insMostUnits').textContent = '-';
      $('#insBestRevenue').textContent = '-';
      $('#insLowestProfit').textContent = '-';
      $('#insightRecommendation').textContent = 'No sales data logged yet for recommendation.';
    }

    // Render Charts
    renderCharts(list);
  }

  // ============ Render Chart.js Visuals ============
  function renderCharts(list) {
    // Only chart top 6 items to prevent overflow
    const chartList = [...list].sort((a, b) => b.profit - a.profit).slice(0, 6);

    const profitCanvas = $('#profitBarChart');
    if (profitCanvas) {
      const ctx = profitCanvas.getContext('2d');
      if (profitBarChartInstance) profitBarChartInstance.destroy();

      profitBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartList.map(p => p.name),
          datasets: [{
            label: 'Profit (Rp)',
            data: chartList.map(p => p.profit),
            backgroundColor: '#10B981',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: {
                callback: function(val) { return 'Rp ' + (val / 1000).toLocaleString() + 'k'; }
              }
            }
          }
        }
      });
    }

    const mixCanvas = $('#productMixChart');
    if (mixCanvas) {
      const ctx = mixCanvas.getContext('2d');
      if (productMixChartInstance) productMixChartInstance.destroy();

      const totalRevenue = chartList.reduce((sum, p) => sum + p.revenue, 0);

      productMixChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: chartList.map(p => p.name),
          datasets: [{
            data: chartList.map(p => p.revenue),
            backgroundColor: ['#3D55CC', '#10B981', '#F59E0B', '#EF4444', '#8B9DE3', '#ECFDF5'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 10, font: { size: 10 } }
            }
          }
        }
      });
    }
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    // Period selection
    $$('.period-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('active')) return;
        $$('.period-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        render();
      });
    });

    // Store select
    $('#filterStore').addEventListener('change', render);

    // Sorting Headers
    $$('#productProfitTable th').forEach(th => {
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
        $$('#productProfitTable th .sort-icon').forEach(span => {
          span.textContent = '⇅';
        });
        const iconSpan = th.querySelector('.sort-icon');
        if (iconSpan) {
          iconSpan.textContent = currentSortAsc ? '▲' : '▼';
        }

        render();
      });
    });

    // Toast
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
      const list = calculateProductMetrics();
      if (list.length === 0) {
        showToast('No sales data to export.');
        return;
      }

      let csv = 'Product Name,Units Sold,Revenue,COGS,Total Profit,Profit Margin %,Profit/Unit,Store 01 Units,Store 02 Units,Store 03 Units,Store 04 Units\n';
      list.forEach(p => {
        const margin = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
        const avg = p.unitsSold > 0 ? (p.profit / p.unitsSold) : 0;
        csv += `"${p.name}",${p.unitsSold},${p.revenue},${p.cogs},${p.profit},${margin.toFixed(2)},${avg},${p.stores['Store #01'] || 0},${p.stores['Store #02'] || 0},${p.stores['Store #03'] || 0},${p.stores['Store #04'] || 0}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `product_profitability_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CSV downloaded successfully.');
    });
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    render();
  });
})();

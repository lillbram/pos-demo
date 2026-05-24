(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};
  
  let storeChartInstance = null;
  let marginChartInstance = null;

  const STORE_MANAGERS = {
    'Store #01': 'Rini Kusuma',
    'Store #02': 'Budi Utomo',
    'Store #03': 'Siti Aminah',
    'Store #04': 'Sri Wahyuni'
  };

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
      console.error('Error loading data for Store Profitability', e);
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

  // ============ Calculate Store Metrics ============
  function calculateStoreProfitability() {
    loadData();
    const period = $('.period-chip.active').getAttribute('data-period');
    const { start, end } = getFilterDates(period);

    // Number of days in selected period
    const durationMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 3600 * 24)));

    // Total daily config OpEx split equally among the 4 stores
    const dailyOpEx = Number(financeConfig.dailySalaries) + Number(financeConfig.dailyRent) + Number(financeConfig.dailyUtilities);
    const storeDailyOpEx = (dailyOpEx / 4) * days;

    const storeNames = ['Store #01', 'Store #02', 'Store #03', 'Store #04'];
    const storeMap = {};

    storeNames.forEach(name => {
      storeMap[name] = {
        name,
        manager: STORE_MANAGERS[name] || 'Staff',
        transCount: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        opexShare: storeDailyOpEx,
        taxShare: 0,
        netProfit: 0
      };
    });

    const periodOrders = orders.filter(o => {
      if (!o.date) return false;
      const oTime = new Date(o.date).getTime();
      return oTime >= start.getTime() && oTime <= end.getTime();
    });

    periodOrders.forEach(o => {
      const sName = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
      const storeData = storeMap[sName];
      if (storeData) {
        storeData.transCount++;
        storeData.revenue += Number(o.total || 0); // final revenue paid
        storeData.cogs += getOrderCogs(o);
      }
    });

    // Compute gross profits, tax, and net profits
    storeNames.forEach(name => {
      const sData = storeMap[name];
      sData.grossProfit = sData.revenue - sData.cogs;
      
      // Store Tax Share
      if (financeConfig.taxRate > 0) {
        sData.taxShare = sData.revenue * (financeConfig.taxRate / 100);
      }
      
      sData.netProfit = sData.grossProfit - sData.opexShare - sData.taxShare;
    });

    return Object.values(storeMap);
  }

  // ============ Render Report ============
  function render() {
    const list = calculateStoreProfitability();

    // Average net profit
    const totalNetProfit = list.reduce((sum, s) => sum + s.netProfit, 0);
    const avgNetProfit = totalNetProfit / list.length;

    // Table render and dynamic indicators
    const tbody = $('#storeTableBody');
    tbody.innerHTML = '';

    let totalTrans = 0;
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalGrossProfit = 0;
    let totalOpex = 0;
    let totalTaxes = 0;

    list.forEach(s => {
      totalTrans += s.transCount;
      totalRevenue += s.revenue;
      totalCogs += s.cogs;
      totalGrossProfit += s.grossProfit;
      totalOpex += s.opexShare;
      totalTaxes += s.taxShare;

      const grossMargin = s.revenue > 0 ? (s.grossProfit / s.revenue * 100) : 0;
      
      // Status Logic: compared to average net profit
      let statusLabel = 'Steady';
      let statusClass = 'status-steady';
      
      if (s.netProfit > avgNetProfit * 1.10) {
        statusLabel = '✓ ⬆';
        statusClass = 'status-up';
      } else if (s.netProfit < avgNetProfit * 0.90) {
        statusLabel = '✓ ⬇';
        statusClass = 'status-down';
      } else {
        statusLabel = '✓ ➡';
        statusClass = 'status-steady';
      }

      tbody.innerHTML += `
        <tr>
          <td><strong style="color: var(--gray-900);">${s.name}</strong></td>
          <td class="text-right">${s.transCount}</td>
          <td class="text-right font-mono">${formatCurrency(s.revenue)}</td>
          <td class="text-right font-mono">${formatCurrency(s.cogs)}</td>
          <td class="text-right font-mono" style="font-weight:600;">${formatCurrency(s.grossProfit)}</td>
          <td class="text-right font-mono">${grossMargin.toFixed(1)}%</td>
          <td class="text-right font-mono" style="font-weight:600; color: ${s.netProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(s.netProfit)}</td>
          <td class="text-right"><span class="status-indicator ${statusClass}">${statusLabel}</span></td>
        </tr>
      `;
    });

    // Total row
    const totalGrossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue * 100) : 0;
    const finalNetProfit = totalGrossProfit - totalOpex - totalTaxes;

    tbody.innerHTML += `
      <tr>
        <td><strong>TOTAL</strong></td>
        <td class="text-right"><strong>${totalTrans}</strong></td>
        <td class="text-right font-mono"><strong>${formatCurrency(totalRevenue)}</strong></td>
        <td class="text-right font-mono"><strong>${formatCurrency(totalCogs)}</strong></td>
        <td class="text-right font-mono"><strong>${formatCurrency(totalGrossProfit)}</strong></td>
        <td class="text-right font-mono"><strong>${totalGrossMargin.toFixed(1)}%</strong></td>
        <td class="text-right font-mono" style="color: ${finalNetProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};"><strong>${formatCurrency(finalNetProfit)}</strong></td>
        <td></td>
      </tr>
    `;

    // Render Store Cards
    const cardsContainer = $('#storeCardsContainer');
    cardsContainer.innerHTML = '';

    list.forEach(s => {
      const grossMargin = s.revenue > 0 ? (s.grossProfit / s.revenue * 100) : 0;
      const avgTrans = s.transCount > 0 ? (s.revenue / s.transCount) : 0;
      const avgProfit = s.transCount > 0 ? (s.netProfit / s.transCount) : 0;

      cardsContainer.innerHTML += `
        <div class="store-card">
          <div class="store-card-header">
            <span>${s.name}</span>
            <span style="font-size: 11px; font-weight: 500; color: var(--gray-500);">${s.manager}</span>
          </div>
          <div class="store-card-body">
            <div>
              <span class="label">Transactions</span>
              <span class="val">${s.transCount}</span>
            </div>
            <div>
              <span class="label">Revenue</span>
              <span class="val font-mono">${formatCurrency(s.revenue)}</span>
            </div>
            <div>
              <span class="label">Net Profit</span>
              <span class="val font-mono" style="color: ${s.netProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(s.netProfit)} (${grossMargin.toFixed(0)}%)</span>
            </div>
            <div>
              <span class="label">Avg Trans</span>
              <span class="val font-mono">${formatCurrency(avgTrans)}</span>
            </div>
            <div>
              <span class="label">Avg Profit</span>
              <span class="val font-mono">${formatCurrency(avgProfit)}</span>
            </div>
          </div>
          <div class="store-card-footer">
            <button class="btn btn-secondary btn-sm" onclick="window.location.href='finance-transaction.html?store=${encodeURIComponent(s.name)}'">Drill Down</button>
          </div>
        </div>
      `;
    });

    // Render Insights & Recommendations
    let bestStore = null;
    let minStoreProfit = 9999999999;
    let maxStoreProfit = -9999999999;
    let lowestStore = null;

    list.forEach(s => {
      if (s.netProfit > maxStoreProfit) {
        maxStoreProfit = s.netProfit;
        bestStore = s;
      }
      if (s.netProfit < minStoreProfit) {
        minStoreProfit = s.netProfit;
        lowestStore = s;
      }
    });

    const variance = maxStoreProfit - minStoreProfit;

    if (bestStore) {
      $('#insBestStore').textContent = `${bestStore.name} (${formatCurrency(bestStore.netProfit)})`;
      $('#insAvgProfit').textContent = formatCurrency(avgNetProfit);
      $('#insProfitVariance').textContent = formatCurrency(variance);

      $('#storeRecommendation').innerHTML = `
        <strong>Variance Alert Summary:</strong><br/>
        • <strong>${bestStore.name}</strong> is currently leading profitability with a net margin of <strong>${(bestStore.netProfit / (bestStore.revenue || 1) * 100).toFixed(1)}%</strong>.<br/>
        • Performance gap between highest and lowest store is <strong>${formatCurrency(variance)}</strong>.<br/>
        • <strong>Recommendation:</strong> Investigate supply chain differences, traffic flow, or manager tactics at <strong>${lowestStore.name}</strong> to close this gap.
      `;
    }

    // Render Charts
    renderCharts(list);
  }

  // ============ Render Chart.js visual graphs ============
  function renderCharts(list) {
    // 1. Revenue & Profit double Bar Chart
    const storeCanvas = $('#storeRevenueProfitChart');
    if (storeCanvas) {
      const ctx = storeCanvas.getContext('2d');
      if (storeChartInstance) storeChartInstance.destroy();

      storeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: list.map(s => s.name),
          datasets: [
            {
              label: 'Revenue',
              data: list.map(s => s.revenue),
              backgroundColor: '#3D55CC',
              borderRadius: 4
            },
            {
              label: 'Net Profit',
              data: list.map(s => s.netProfit),
              backgroundColor: '#10B981',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
          scales: {
            y: {
              ticks: {
                callback: function(val) { return 'Rp ' + (val / 1000000).toFixed(1) + 'M'; }
              }
            }
          }
        }
      });
    }

    // 2. Profit Margin comparison Pie/Doughnut Chart
    const marginCanvas = $('#storeMarginChart');
    if (marginCanvas) {
      const ctx = marginCanvas.getContext('2d');
      if (marginChartInstance) marginChartInstance.destroy();

      const profitShares = list.map(s => Math.max(0, s.netProfit));

      marginChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: list.map(s => s.name),
          datasets: [{
            data: profitShares,
            backgroundColor: ['#3D55CC', '#10B981', '#F59E0B', '#EF4444'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12 } }
          }
        }
      });
    }
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    $$('.period-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('active')) return;
        $$('.period-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        render();
      });
    });
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    render();
  });
})();

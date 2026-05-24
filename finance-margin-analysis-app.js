(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};
  
  let trendChartInstance = null;

  // Sorting
  let currentSortCol = 'marginPct';
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
      console.error('Error loading data for Margin Analysis', e);
    }
  }

  // ============ COGS Helper ============
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

  // ============ Aggregate P&L Data ============
  function aggregatePL(start, end, storeFilter) {
    const periodOrders = orders.filter(o => {
      if (!o.date) return false;
      const oTime = new Date(o.date).getTime();
      if (oTime < start.getTime() || oTime > end.getTime()) return false;
      
      if (storeFilter !== 'all') {
        const oStoreClean = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
        if (oStoreClean !== storeFilter) return false;
      }
      return true;
    });

    let salesRevenue = 0;
    let promosDiscounts = 0;
    let cogs = 0;

    periodOrders.forEach(o => {
      salesRevenue += Number(o.subtotal || 0);
      promosDiscounts += Number(o.promoDiscount || 0) + Number(o.itemDiscount || 0);
      cogs += getOrderCogs(o);
    });

    const netRevenue = salesRevenue - promosDiscounts;
    const grossProfit = netRevenue - cogs;

    const durationMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 3600 * 24)));
    
    let salaries = Number(financeConfig.dailySalaries) * days;
    let rent = Number(financeConfig.dailyRent) * days;
    let utilities = Number(financeConfig.dailyUtilities) * days;

    if (storeFilter !== 'all') {
      salaries = salaries / 4;
      rent = rent / 4;
      utilities = utilities / 4;
    }

    const totalOpEx = salaries + rent + utilities;
    const ebitda = grossProfit - totalOpEx;

    let taxes = 0;
    if (financeConfig.taxRate > 0) {
      if (financeConfig.taxApplyTo === 'revenue') {
        taxes = netRevenue * (financeConfig.taxRate / 100);
      } else {
        taxes = salesRevenue * (financeConfig.taxRate / 100);
      }
    }

    const netProfit = ebitda - taxes;

    return {
      netRevenue,
      grossProfit,
      totalOpEx,
      ebitda,
      taxes,
      netProfit
    };
  }

  // ============ Render Report ============
  function render() {
    loadData();
    const period = $('.period-chip.active').getAttribute('data-period');
    const store = $('#filterStore').value;
    const { start, end } = getFilterDates(period);

    const data = aggregatePL(start, end, store);

    const grossMargin = data.netRevenue > 0 ? (data.grossProfit / data.netRevenue * 100) : 0;
    const operatingMargin = data.netRevenue > 0 ? (data.ebitda / data.netRevenue * 100) : 0;
    const netMargin = data.netRevenue > 0 ? (data.netProfit / data.netRevenue * 100) : 0;

    // Fill Targets text
    $('#grossTarget').textContent = `Target: ${financeConfig.targetGrossMargin}%`;
    $('#operatingTarget').textContent = `Target: ${financeConfig.targetOperatingMargin}%`;
    $('#netTarget').textContent = `Target: ${financeConfig.targetNetMargin}%`;

    // Fill Margin Metric Cards Values
    $('#grossMarginVal').textContent = `${grossMargin.toFixed(1)}%`;
    $('#operatingMarginVal').textContent = `${operatingMargin.toFixed(1)}%`;
    $('#netMarginVal').textContent = `${netMargin.toFixed(1)}%`;

    // Helpers to get health class & label
    function getHealthState(marginVal, targetVal) {
      const margin = Number(marginVal);
      const target = Number(targetVal);
      if (margin >= target) {
        return { label: 'HEALTHY', className: 'health-healthy' };
      } else if (margin >= target - 5) {
        return { label: 'WARNING', className: 'health-warning' };
      } else {
        return { label: 'CRITICAL', className: 'health-danger' };
      }
    }

    const grossHealth = getHealthState(grossMargin, financeConfig.targetGrossMargin);
    $('#grossHealth').textContent = grossHealth.label;
    $('#grossHealth').className = `health-indicator ${grossHealth.className}`;

    const opHealth = getHealthState(operatingMargin, financeConfig.targetOperatingMargin);
    $('#operatingHealth').textContent = opHealth.label;
    $('#operatingHealth').className = `health-indicator ${opHealth.className}`;

    const netHealth = getHealthState(netMargin, financeConfig.targetNetMargin);
    $('#netHealth').textContent = netHealth.label;
    $('#netHealth').className = `health-indicator ${netHealth.className}`;

    // Fill assessments texts
    $('#grossAssessment').textContent = grossHealth.label === 'HEALTHY' 
      ? `Gross margin is strong at ${grossMargin.toFixed(1)}%, beating your model's target.`
      : `Gross margin of ${grossMargin.toFixed(1)}% fails your target. Review ingredient unit costs.`;
      
    $('#operatingAssessment').textContent = opHealth.label === 'HEALTHY'
      ? `Operating margin is healthy at ${operatingMargin.toFixed(1)}%, overhead costs are covered.`
      : `Operating margin is low at ${operatingMargin.toFixed(1)}%. Store rent or salary overheads are dragging margins.`;

    $('#netAssessment').textContent = netHealth.label === 'HEALTHY'
      ? `Net margin is healthy at ${netMargin.toFixed(1)}%, generating solid bottom-line profits.`
      : `Net margin is critical at ${netMargin.toFixed(1)}%. Review taxation structures or pricing levels immediately.`;

    // Alert recommendations
    let recommendation = 'Your margins are strong. Maintain active promotional and COGS controls.';
    if (netHealth.label !== 'HEALTHY') {
      if (opHealth.label !== 'HEALTHY') {
        recommendation = 'Operating expenses represent a high burden. Consider adjusting staff schedules, renegotiating rent, or increasing transaction counts to dilute fixed costs.';
      } else {
        recommendation = 'Net profit margin is squeezed. Consider increasing average menu pricing by 5-10% to absorb compliance costs and tax expenses.';
      }
    } else if (grossHealth.label !== 'HEALTHY') {
      recommendation = 'Gross margins are below target. Review and edit product cost structures in Finance Config or source cheaper ingredients to restore target margins.';
    }
    $('#marginRecommendation').innerHTML = `<strong>Strategic Optimization Plan:</strong><br/>${recommendation}`;

    // 2. Product Margins Table
    const tbody = $('#productMarginBody');
    tbody.innerHTML = '';

    const list = products.map(p => {
      const price = Number(p.basePrice || 0);
      const cost = Number(p.cogs || 0);
      const margin = price - cost;
      const marginPct = price > 0 ? (margin / price * 100) : 0;
      return {
        name: p.name,
        emoji: p.emoji || '📦',
        price,
        cost,
        margin,
        marginPct
      };
    });

    // Sort product margins
    list.sort((a, b) => {
      let valA, valB;
      if (currentSortCol === 'name') {
        valA = a.name;
        valB = b.name;
      } else if (currentSortCol === 'price') {
        valA = a.price;
        valB = b.price;
      } else if (currentSortCol === 'cost') {
        valA = a.cost;
        valB = b.cost;
      } else if (currentSortCol === 'margin') {
        valA = a.margin;
        valB = b.margin;
      } else if (currentSortCol === 'marginPct') {
        valA = a.marginPct;
        valB = b.marginPct;
      }
      return currentSortAsc ? valA - valB : valB - valA;
    });

    list.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${p.emoji} ${p.name}</strong></td>
          <td class="text-right font-mono">${formatCurrency(p.price)}</td>
          <td class="text-right font-mono">${formatCurrency(p.cost)}</td>
          <td class="text-right font-mono" style="font-weight: 500;">${formatCurrency(p.margin)}</td>
          <td class="text-right font-mono" style="font-weight: 600; color: ${p.marginPct >= 50 ? 'var(--success-700)' : 'var(--danger-700)'};">${p.marginPct.toFixed(1)}%</td>
        </tr>
      `;
    });

    // 3. Render Trend Line Graph
    renderTrendsChart(period, store);
  }

  // ============ Render Day-by-Day Margin Trends ============
  function renderTrendsChart(period, store) {
    const canvas = $('#marginTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();

    // Compile last 7 days trend dates
    const labels = [];
    const grossData = [];
    const opData = [];
    const netData = [];

    const dateNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Let's plot day-by-day margin trend for the last 7 days ending May 22, 2026
    for (let i = 6; i >= 0; i--) {
      const dt = new Date('2026-05-22T12:00:00');
      dt.setDate(dt.getDate() - i);
      const dStr = dt.toISOString().slice(0, 10);
      
      const s = new Date(dStr + 'T00:00:00.000Z');
      const e = new Date(dStr + 'T23:59:59.999Z');
      
      const dayData = aggregatePL(s, e, store);
      
      const grossMargin = dayData.netRevenue > 0 ? (dayData.grossProfit / dayData.netRevenue * 100) : 0;
      const operatingMargin = dayData.netRevenue > 0 ? (dayData.ebitda / dayData.netRevenue * 100) : 0;
      const netMargin = dayData.netRevenue > 0 ? (dayData.netProfit / dayData.netRevenue * 100) : 0;

      labels.push(dateNames[dt.getDay()] + ' (' + dt.getDate() + ')');
      grossData.push(Number(grossMargin.toFixed(1)));
      opData.push(Number(operatingMargin.toFixed(1)));
      netData.push(Number(netMargin.toFixed(1)));
    }

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Gross Margin %',
            data: grossData,
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Operating Margin %',
            data: opData,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Net Margin %',
            data: netData,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10 } }
        },
        scales: {
          y: {
            ticks: {
              callback: function(val) { return val + '%'; }
            }
          }
        }
      }
    });
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

    $('#filterStore').addEventListener('change', render);

    // Sorting Headers
    $$('.table-card th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (!col) return;

        if (currentSortCol === col) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortCol = col;
          currentSortAsc = true;
        }

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

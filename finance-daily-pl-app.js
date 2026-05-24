(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};

  let dailyLinesChartInstance = null;
  let dailyMarginBarChartInstance = null;

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
      console.error('Error loading data for Daily PL', e);
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

  // ============ Render Report ============
  function render() {
    loadData();
    const periodDays = Number($('.period-chip.active').getAttribute('data-period'));
    const store = $('#filterStore').value;

    const todayRef = new Date('2026-05-22T12:00:00');
    const datesList = [];

    // Get list of dates YYYY-MM-DD
    for (let i = periodDays - 1; i >= 0; i--) {
      const dt = new Date(todayRef.getTime());
      dt.setDate(dt.getDate() - i);
      datesList.push(dt.toISOString().slice(0, 10));
    }

    const dailyOpEx = Number(financeConfig.dailySalaries) + Number(financeConfig.dailyRent) + Number(financeConfig.dailyUtilities);
    const storeDailyOpEx = (store === 'all') ? dailyOpEx : (dailyOpEx / 4);

    const dailyRecords = [];

    datesList.forEach(dStr => {
      const dayOrders = orders.filter(o => {
        if (!o.date) return false;
        if (o.date.slice(0, 10) !== dStr) return false;
        if (store !== 'all') {
          const oStoreClean = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
          if (oStoreClean !== store) return false;
        }
        return true;
      });

      let transCount = dayOrders.length;
      let revenue = 0;
      let cogs = 0;
      let subtotal = 0;

      // Hourly slots init
      const hourly = {
        'Morning (08-12)': { trans: 0, profit: 0 },
        'Afternoon (12-16)': { trans: 0, profit: 0 },
        'Evening (16-20)': { trans: 0, profit: 0 },
        'Night (20-24)': { trans: 0, profit: 0 }
      };

      dayOrders.forEach(o => {
        revenue += Number(o.total || 0);
        subtotal += Number(o.subtotal || 0);
        
        const oCogs = getOrderCogs(o);
        cogs += oCogs;

        // Hourly slot mapping
        const hr = new Date(o.date).getHours();
        let slotName = 'Night (20-24)';
        if (hr >= 8 && hr < 12) slotName = 'Morning (08-12)';
        else if (hr >= 12 && hr < 16) slotName = 'Afternoon (12-16)';
        else if (hr >= 16 && hr < 20) slotName = 'Evening (16-20)';

        hourly[slotName].trans++;
        hourly[slotName].profit += (Number(o.total || 0) - oCogs);
      });

      const grossProfit = revenue - cogs;
      
      // Daily Tax
      let tax = 0;
      if (financeConfig.taxRate > 0) {
        if (financeConfig.taxApplyTo === 'revenue') {
          tax = revenue * (financeConfig.taxRate / 100);
        } else {
          tax = subtotal * (financeConfig.taxRate / 100);
        }
      }

      const netProfit = grossProfit - storeDailyOpEx - tax;
      const margin = revenue > 0 ? (netProfit / revenue * 100) : 0;

      dailyRecords.push({
        dateStr: dStr,
        transCount,
        revenue,
        cogs,
        grossProfit,
        opex: storeDailyOpEx,
        tax,
        netProfit,
        margin,
        hourly
      });
    });

    // Populate Table
    const tbody = $('#dailyTableBody');
    tbody.innerHTML = '';

    let totalTrans = 0;
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalGross = 0;
    let totalOpex = 0;
    let totalNet = 0;
    let totalTax = 0;

    // We can reverse it to show the newest date first in the table list
    const tableList = [...dailyRecords].reverse();

    tableList.forEach(r => {
      totalTrans += r.transCount;
      totalRevenue += r.revenue;
      totalCogs += r.cogs;
      totalGross += r.grossProfit;
      totalOpex += r.opex;
      totalNet += r.netProfit;
      totalTax += r.tax;

      const dateObj = new Date(r.dateStr);
      const formattedDate = isNaN(dateObj.getTime()) ? r.dateStr : dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });

      const mainRow = document.createElement('tr');
      mainRow.className = 'main-row';
      mainRow.innerHTML = `
        <td><strong>${formattedDate}</strong></td>
        <td class="text-right">${r.transCount}</td>
        <td class="text-right font-mono">${formatCurrency(r.revenue)}</td>
        <td class="text-right font-mono">${formatCurrency(r.cogs)}</td>
        <td class="text-right font-mono">${formatCurrency(r.grossProfit)}</td>
        <td class="text-right font-mono">${formatCurrency(r.opex)}</td>
        <td class="text-right font-mono" style="font-weight:600; color: ${r.netProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)'};">${formatCurrency(r.netProfit)}</td>
        <td class="text-right font-mono" style="font-weight:600;">${r.margin.toFixed(1)}%</td>
      `;

      const detailRow = document.createElement('tr');
      detailRow.className = 'detail-row';

      let hourlyMarkup = '';
      Object.keys(r.hourly).forEach(slot => {
        const slotData = r.hourly[slot];
        hourlyMarkup += `
          <div class="hourly-item">
            <span class="stat-label">${slot}</span>
            <span class="stat-val font-mono">${slotData.trans} trans (${formatCurrency(slotData.profit)} profit)</span>
          </div>
        `;
      });

      detailRow.innerHTML = `
        <td colspan="8" style="padding: 0;">
          <div class="hourly-box">
            <div style="font-weight:700; font-size:11px; text-transform:uppercase; color:var(--gray-500); margin-bottom:8px;">Hourly Gross Profit Breakdown</div>
            <div class="hourly-grid">
              ${hourlyMarkup}
            </div>
          </div>
        </td>
      `;

      tbody.appendChild(mainRow);
      tbody.appendChild(detailRow);

      mainRow.addEventListener('click', () => {
        const isExp = mainRow.classList.toggle('expanded');
        if (isExp) detailRow.classList.add('show');
        else detailRow.classList.remove('show');
      });
    });

    // Populate Sidebar Summaries
    $('#sumTotalRevenue').textContent = formatCurrency(totalRevenue);
    $('#sumTotalCogs').textContent = formatCurrency(totalCogs);
    $('#sumTotalOpex').textContent = formatCurrency(totalOpex);
    $('#sumTotalProfit').textContent = formatCurrency(totalNet);
    
    const avgMargin = totalRevenue > 0 ? (totalNet / totalRevenue * 100) : 0;
    $('#sumAvgMargin').textContent = `${avgMargin.toFixed(1)}%`;

    // Calculate Best and Worst Days
    let bestDay = null;
    let worstDay = null;

    dailyRecords.forEach(r => {
      // ignore 0-transaction days for worst day if we have sales on other days
      if (r.transCount === 0 && dailyRecords.some(x => x.transCount > 0)) return;
      
      if (!bestDay || r.netProfit > bestDay.netProfit) bestDay = r;
      if (!worstDay || r.netProfit < worstDay.netProfit) worstDay = r;
    });

    if (bestDay && bestDay.transCount > 0) {
      const bDate = new Date(bestDay.dateStr);
      $('#insBestDay').textContent = `${bDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} (${formatCurrency(bestDay.netProfit)} profit)`;
      
      const wDate = new Date(worstDay.dateStr);
      $('#insWorstDay').textContent = `${wDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} (${formatCurrency(worstDay.netProfit)} profit)`;
    } else {
      $('#insBestDay').textContent = '-';
      $('#insWorstDay').textContent = '-';
    }

    // Render Charts
    renderCharts(dailyRecords);
  }

  // ============ Render Chart.js visual trends ============
  function renderCharts(records) {
    const labels = records.map(r => {
      const d = new Date(r.dateStr);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });

    // 1. Line Chart: Revenue, COGS, Net Profit
    const linesCanvas = $('#dailyLinesChart');
    if (linesCanvas) {
      const ctx = linesCanvas.getContext('2d');
      if (dailyLinesChartInstance) dailyLinesChartInstance.destroy();

      dailyLinesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Revenue',
              data: records.map(r => r.revenue),
              borderColor: '#3D55CC',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.2
            },
            {
              label: 'COGS',
              data: records.map(r => r.cogs),
              borderColor: '#EF4444',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.2
            },
            {
              label: 'Net Profit',
              data: records.map(r => r.netProfit),
              borderColor: '#10B981',
              backgroundColor: 'transparent',
              borderWidth: 2.5,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
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

    // 2. Bar Chart: Margin %
    const marginCanvas = $('#dailyMarginBarChart');
    if (marginCanvas) {
      const ctx = marginCanvas.getContext('2d');
      if (dailyMarginBarChartInstance) dailyMarginBarChartInstance.destroy();

      dailyMarginBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Net Margin %',
            data: records.map(r => Number(r.margin.toFixed(1))),
            backgroundColor: '#8B9DE3',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
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
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    render();
  });
})();

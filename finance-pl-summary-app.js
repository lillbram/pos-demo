(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};
  
  let compositionChartInstance = null;
  let waterfallChartInstance = null;

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
      console.error('Error loading data for PL Summary', e);
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

  // ============ Calculate Period Boundaries ============
  function getPeriodBoundaries(periodType) {
    let startCur, endCur, startPrev, endPrev;
    const todayRef = '2026-05-22';
    
    if (periodType === 'today') {
      startCur = new Date(todayRef + 'T00:00:00.000Z');
      endCur = new Date(todayRef + 'T23:59:59.999Z');
      startPrev = new Date('2026-05-21T00:00:00.000Z');
      endPrev = new Date('2026-05-21T23:59:59.999Z');
    } else if (periodType === 'week') {
      startCur = new Date('2026-05-16T00:00:00.000Z');
      endCur = new Date('2026-05-22T23:59:59.999Z');
      startPrev = new Date('2026-05-09T00:00:00.000Z');
      endPrev = new Date('2026-05-15T23:59:59.999Z');
    } else if (periodType === 'month') {
      startCur = new Date('2026-05-01T00:00:00.000Z');
      endCur = new Date('2026-05-22T23:59:59.999Z');
      // Duration is 22 days
      startPrev = new Date('2026-04-09T00:00:00.000Z');
      endPrev = new Date('2026-04-30T23:59:59.999Z');
    } else if (periodType === 'last-month') {
      startCur = new Date('2026-04-01T00:00:00.000Z');
      endCur = new Date('2026-04-30T23:59:59.999Z');
      startPrev = new Date('2026-03-02T00:00:00.000Z');
      endPrev = new Date('2026-03-31T23:59:59.999Z');
    } else {
      // Custom date range
      const fromStr = $('#customFromDate').value || todayRef;
      const toStr = $('#customToDate').value || todayRef;
      startCur = new Date(fromStr + 'T00:00:00.000Z');
      endCur = new Date(toStr + 'T23:59:59.999Z');
      
      const durationMs = endCur.getTime() - startCur.getTime();
      startPrev = new Date(startCur.getTime() - durationMs - 1000);
      endPrev = new Date(startCur.getTime() - 1000);
    }
    
    return { startCur, endCur, startPrev, endPrev };
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
    let transCount = periodOrders.length;
    
    // Track products for insights
    const productQuantities = {};
    const productProfits = {};
    const storeProfits = {};

    periodOrders.forEach(o => {
      salesRevenue += Number(o.subtotal || 0);
      promosDiscounts += Number(o.promoDiscount || 0) + Number(o.itemDiscount || 0);
      
      const oCogs = getOrderCogs(o);
      cogs += oCogs;

      const orderTotal = Number(o.total || 0);
      const oProfit = orderTotal - oCogs;

      // Store-level profit accumulation
      const sName = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
      if (sName) {
        storeProfits[sName] = (storeProfits[sName] || 0) + oProfit;
      }

      // Product-level accumulation
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          productQuantities[item.name] = (productQuantities[item.name] || 0) + Number(item.qty);
          const iCogs = getItemCogs(item.id, item.price) * Number(item.qty);
          const iProfit = Number(item.total) - iCogs;
          productProfits[item.name] = (productProfits[item.name] || 0) + iProfit;
        });
      }
    });

    const netRevenue = salesRevenue - promosDiscounts;
    const grossProfit = netRevenue - cogs;

    // Scaling OpEx
    const durationMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 3600 * 24)));
    
    const salaries = Number(financeConfig.dailySalaries) * days;
    const rent = Number(financeConfig.dailyRent) * days;
    const utilities = Number(financeConfig.dailyUtilities) * days;
    const totalOpEx = salaries + rent + utilities;

    const ebitda = grossProfit - totalOpEx;

    // Taxes
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
      salesRevenue,
      promosDiscounts,
      netRevenue,
      cogs,
      grossProfit,
      salaries,
      rent,
      utilities,
      totalOpEx,
      ebitda,
      taxes,
      netProfit,
      transCount,
      days,
      productQuantities,
      productProfits,
      storeProfits
    };
  }

  // ============ Update Charts ============
  function updateCharts(data) {
    // 1. Composition Pie Chart
    const compCanvas = $('#compositionChart');
    if (compCanvas) {
      const compCtx = compCanvas.getContext('2d');
      if (compositionChartInstance) compositionChartInstance.destroy();
      
      const cogsVal = Math.max(0, data.cogs);
      const opexVal = Math.max(0, data.totalOpEx);
      const taxVal = Math.max(0, data.taxes);
      const netVal = Math.max(0, data.netProfit);
      
      compositionChartInstance = new Chart(compCtx, {
        type: 'doughnut',
        data: {
          labels: ['COGS', 'OpEx', 'Taxes', 'Net Profit'],
          datasets: [{
            data: [cogsVal, opexVal, taxVal, netVal],
            backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } }
            },
            title: { display: true, text: 'Revenue Allocation', font: { size: 12, weight: 'bold' } }
          }
        }
      });
    }

    // 2. Waterfall Bridge Chart
    const waterfallCanvas = $('#waterfallChart');
    if (waterfallCanvas) {
      const waterfallCtx = waterfallCanvas.getContext('2d');
      if (waterfallChartInstance) waterfallChartInstance.destroy();
      
      waterfallChartInstance = new Chart(waterfallCtx, {
        type: 'bar',
        data: {
          labels: ['Net Rev', 'COGS', 'Gross', 'OpEx', 'EBITDA', 'Tax', 'Net Prof'],
          datasets: [{
            label: 'Amount (Rp)',
            data: [
              data.netRevenue,
              -data.cogs,
              data.grossProfit,
              -data.totalOpEx,
              data.ebitda,
              -data.taxes,
              data.netProfit
            ],
            backgroundColor: [
              '#3D55CC', // Net Rev
              '#EF4444', // COGS (neg)
              '#10B981', // Gross
              '#F59E0B', // OpEx (neg)
              '#8B9DE3', // EBITDA
              '#EF4444', // Tax (neg)
              '#10B981'  // Net Prof
            ],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Profit Bridge', font: { size: 12, weight: 'bold' } }
          },
          scales: {
            y: {
              ticks: {
                callback: function(value) {
                  return 'Rp ' + (value / 1000).toLocaleString() + 'k';
                }
              }
            }
          }
        }
      });
    }
  }

  // ============ Render Report ============
  function renderReport() {
    loadData();
    
    const activeChip = $('.period-chip.active');
    const period = activeChip.getAttribute('data-period');
    const store = $('#filterStore').value;

    const { startCur, endCur, startPrev, endPrev } = getPeriodBoundaries(period);
    
    // Perform aggregations
    const curData = aggregatePL(startCur, endCur, store);
    const prevData = aggregatePL(startPrev, endPrev, store);

    // Update subtitles
    const storeText = store === 'all' ? 'All Stores' : store;
    const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
    const periodText = `${startCur.toLocaleDateString('id-ID', dateOpts)} - ${endCur.toLocaleDateString('id-ID', dateOpts)}`;
    $('#plSubtitle').textContent = `Period: ${periodText} | Store: ${storeText}`;

    // Fill Current P&L Values
    $('#plSalesRevenue').textContent = formatCurrency(curData.salesRevenue);
    $('#plPromosDiscounts').textContent = formatCurrency(-curData.promosDiscounts);
    $('#plNetRevenue').textContent = formatCurrency(curData.netRevenue);
    $('#plCogs').textContent = formatCurrency(-curData.cogs);
    
    $('#plGrossProfit').textContent = formatCurrency(curData.grossProfit);
    const grossMarginPct = curData.netRevenue > 0 ? (curData.grossProfit / curData.netRevenue * 100) : 0;
    $('#plGrossMarginPct').textContent = `${grossMarginPct.toFixed(1)}% (Target: ${financeConfig.targetGrossMargin}%)`;
    if (grossMarginPct < Number(financeConfig.targetGrossMargin)) {
      $('#plGrossMarginPct').classList.add('negative');
    } else {
      $('#plGrossMarginPct').classList.remove('negative');
    }

    $('#plOpSalaries').textContent = formatCurrency(curData.salaries);
    $('#plOpRent').textContent = formatCurrency(curData.rent);
    $('#plOpUtilities').textContent = formatCurrency(curData.utilities);
    $('#plTotalOpEx').textContent = formatCurrency(curData.totalOpEx);

    $('#plEbitda').textContent = formatCurrency(curData.ebitda);
    const ebitdaMarginPct = curData.netRevenue > 0 ? (curData.ebitda / curData.netRevenue * 100) : 0;
    $('#plEbitdaMarginPct').textContent = `${ebitdaMarginPct.toFixed(1)}% (Target: ${financeConfig.targetOperatingMargin}%)`;
    if (ebitdaMarginPct < Number(financeConfig.targetOperatingMargin)) {
      $('#plEbitdaMarginPct').classList.add('negative');
    } else {
      $('#plEbitdaMarginPct').classList.remove('negative');
    }

    $('#plTaxes').textContent = formatCurrency(-curData.taxes);
    
    $('#plNetProfit').textContent = formatCurrency(curData.netProfit);
    const netMarginPct = curData.netRevenue > 0 ? (curData.netProfit / curData.netRevenue * 100) : 0;
    $('#plNetMarginPct').textContent = `${netMarginPct.toFixed(1)}% (Target: ${financeConfig.targetNetMargin}%)`;
    if (netMarginPct < Number(financeConfig.targetNetMargin)) {
      $('#plNetMarginPct').style.color = 'var(--danger-700)';
    } else {
      $('#plNetMarginPct').style.color = '';
    }

    // Fill Comparison Cards
    $('#compRevVal').textContent = formatCurrency(curData.netRevenue);
    $('#compNetVal').textContent = formatCurrency(curData.netProfit);
    $('#prevRevVal').textContent = formatCurrency(prevData.netRevenue);
    $('#prevNetVal').textContent = formatCurrency(prevData.netProfit);

    // Compute change percentages
    let revChange = 0;
    if (prevData.netRevenue > 0) {
      revChange = ((curData.netRevenue - prevData.netRevenue) / prevData.netRevenue) * 100;
    }
    let netChange = 0;
    if (prevData.netProfit > 0) {
      netChange = ((curData.netProfit - prevData.netProfit) / prevData.netProfit) * 100;
    } else if (prevData.netProfit === 0 && curData.netProfit > 0) {
      netChange = 100;
    }

    // Render change badges
    const revBadge = $('#compRevBadge');
    if (revChange > 0) {
      revBadge.className = 'comp-badge comp-up';
      revBadge.textContent = `↑ ${revChange.toFixed(1)}%`;
    } else if (revChange < 0) {
      revBadge.className = 'comp-badge comp-down';
      revBadge.textContent = `↓ ${Math.abs(revChange).toFixed(1)}%`;
    } else {
      revBadge.className = 'comp-badge comp-equal';
      revBadge.textContent = `→ 0%`;
    }

    const netBadge = $('#compNetBadge');
    if (netChange > 0) {
      netBadge.className = 'comp-badge comp-up';
      netBadge.textContent = `↑ ${netChange.toFixed(1)}%`;
    } else if (netChange < 0) {
      netBadge.className = 'comp-badge comp-down';
      netBadge.textContent = `↓ ${Math.abs(netChange).toFixed(1)}%`;
    } else {
      netBadge.className = 'comp-badge comp-equal';
      netBadge.textContent = `→ 0%`;
    }

    // Key Performance Insights
    $('#statTransCount').textContent = curData.transCount;
    const avgTrans = curData.transCount > 0 ? (curData.netRevenue / curData.transCount) : 0;
    $('#statAvgTransVal').textContent = formatCurrency(avgTrans);
    const avgProfit = curData.transCount > 0 ? (curData.netProfit / curData.transCount) : 0;
    $('#statAvgProfit').textContent = formatCurrency(avgProfit);

    // Best Selling Product
    let bestProd = '-';
    let maxQty = 0;
    Object.keys(curData.productQuantities).forEach(name => {
      if (curData.productQuantities[name] > maxQty) {
        maxQty = curData.productQuantities[name];
        bestProd = `${name} (${maxQty} units)`;
      }
    });
    $('#statBestProduct').textContent = bestProd;

    // Most Profitable Product
    let bestProfProd = '-';
    let maxProf = -999999999;
    Object.keys(curData.productProfits).forEach(name => {
      if (curData.productProfits[name] > maxProf) {
        maxProf = curData.productProfits[name];
        bestProfProd = `${name} (${formatCurrency(maxProf)})`;
      }
    });
    $('#statProfitableProduct').textContent = bestProfProd;

    // Best Performing Store
    let bestStore = '-';
    let maxStoreProfit = -999999999;
    Object.keys(curData.storeProfits).forEach(storeName => {
      if (curData.storeProfits[storeName] > maxStoreProfit) {
        maxStoreProfit = curData.storeProfits[storeName];
        bestStore = `${storeName} (${formatCurrency(maxStoreProfit)})`;
      }
    });
    $('#statBestStore').textContent = bestStore;

    // Update charts visualisations
    updateCharts(curData);
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
    // Period Toggles
    $$('.period-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('active')) return;
        $$('.period-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const period = chip.getAttribute('data-period');
        if (period === 'custom') {
          $('#datePickerGroup').classList.add('show');
        } else {
          $('#datePickerGroup').classList.remove('show');
        }
        renderReport();
      });
    });

    // Custom Date inputs
    const dateInputs = ['#customFromDate', '#customToDate'];
    dateInputs.forEach(sel => {
      $(sel).addEventListener('change', renderReport);
    });

    // Store select
    $('#filterStore').addEventListener('change', renderReport);

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

    // Print Button
    $('#btnPrintPdf').addEventListener('click', () => {
      showToast('Preparing statement for print...');
      setTimeout(() => {
        window.print();
      }, 500);
    });
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    // Populate default date picker values: 1st of month to today (May 22, 2026)
    $('#customFromDate').value = '2026-05-01';
    $('#customToDate').value = '2026-05-22';

    setupEvents();
    renderReport();
  });
})();

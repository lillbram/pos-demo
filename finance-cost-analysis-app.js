(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let orders = [];
  let products = [];
  let financeConfig = {};
  
  let costChartInstance = null;

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
      console.error('Error loading data for Cost Analysis', e);
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

  // ============ Render Cost Breakdown ============
  function render() {
    loadData();
    const period = $('.period-chip.active').getAttribute('data-period');
    const store = $('#filterStore').value;
    const { start, end } = getFilterDates(period);

    // Scaling OpEx
    const durationMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 3600 * 24)));

    // Scale OpEx
    let salaries = Number(financeConfig.dailySalaries) * days;
    let rent = Number(financeConfig.dailyRent) * days;
    let utilities = Number(financeConfig.dailyUtilities) * days;

    // Filter orders
    const periodOrders = orders.filter(o => {
      if (!o.date) return false;
      const oTime = new Date(o.date).getTime();
      if (oTime < start.getTime() || oTime > end.getTime()) return false;
      
      if (store !== 'all') {
        const oStoreClean = (o.store || '').replace(/\s*\(POS\)/g, '').trim();
        if (oStoreClean !== store) return false;
      }
      return true;
    });

    // If store filter is selected, scale down opex based on store share (1/4 of total)
    if (store !== 'all') {
      salaries = salaries / 4;
      rent = rent / 4;
      utilities = utilities / 4;
    }

    const totalOpEx = salaries + rent + utilities;

    let grossSales = 0;
    let totalCogs = 0;
    let totalDiscounts = 0;
    
    // Track product cogs detail
    const productCogs = {};
    const productUnits = {};

    periodOrders.forEach(o => {
      grossSales += Number(o.subtotal || 0); // gross revenue before promos
      totalDiscounts += Number(o.promoDiscount || 0) + Number(o.itemDiscount || 0);
      totalCogs += getOrderCogs(o);

      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          const uCogs = getItemCogs(item.id, item.price);
          productCogs[item.name] = (productCogs[item.name] || 0) + uCogs * Number(item.qty);
          productUnits[item.name] = (productUnits[item.name] || 0) + Number(item.qty);
        });
      }
    });

    const netRevenue = grossSales - totalDiscounts;
    
    // Taxes
    let taxes = 0;
    if (financeConfig.taxRate > 0) {
      if (financeConfig.taxApplyTo === 'revenue') {
        taxes = netRevenue * (financeConfig.taxRate / 100);
      } else {
        taxes = grossSales * (financeConfig.taxRate / 100);
      }
    }

    const grossProfit = netRevenue - totalCogs;
    const netProfit = grossProfit - totalOpEx - taxes;

    // Total gross denominator for percentages (Gross Sales = netRevenue + totalDiscounts)
    const grossDenom = Math.max(1, grossSales);

    // 1. Categories Table Populate
    const catBody = $('#costCategoriesBody');
    catBody.innerHTML = '';

    // Food, Beverage, Packaging allocation splits (estimated logic)
    const foodCogs = totalCogs * 0.45;
    const bevCogs = totalCogs * 0.45;
    const packCogs = totalCogs * 0.10;

    catBody.innerHTML += `
      <tr style="font-weight: 600; background: var(--gray-50);">
        <td>COST OF GOODS SOLD</td>
        <td class="text-right font-mono">${formatCurrency(totalCogs)}</td>
        <td class="text-right">${(totalCogs / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>├─ Food Cost (Est. 45%)</td>
        <td class="text-right font-mono">${formatCurrency(foodCogs)}</td>
        <td class="text-right">${(foodCogs / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>├─ Beverage Cost (Est. 45%)</td>
        <td class="text-right font-mono">${formatCurrency(bevCogs)}</td>
        <td class="text-right">${(bevCogs / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>└─ Packaging (Est. 10%)</td>
        <td class="text-right font-mono">${formatCurrency(packCogs)}</td>
        <td class="text-right">${(packCogs / grossDenom * 100).toFixed(1)}%</td>
      </tr>

      <tr style="font-weight: 600; background: var(--gray-50);">
        <td>OPERATING COSTS</td>
        <td class="text-right font-mono">${formatCurrency(totalOpEx)}</td>
        <td class="text-right">${(totalOpEx / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>├─ Staff Salaries</td>
        <td class="text-right font-mono">${formatCurrency(salaries)}</td>
        <td class="text-right">${(salaries / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>├─ Store Rent</td>
        <td class="text-right font-mono">${formatCurrency(rent)}</td>
        <td class="text-right">${(rent / grossDenom * 100).toFixed(1)}%</td>
      </tr>
      <tr class="nested-row">
        <td>└─ Utilities & Maintenance</td>
        <td class="text-right font-mono">${formatCurrency(utilities)}</td>
        <td class="text-right">${(utilities / grossDenom * 100).toFixed(1)}%</td>
      </tr>

      <tr style="font-weight: 600;">
        <td>PROMOS GIVEN (DISCOUNTS)</td>
        <td class="text-right font-mono">${formatCurrency(totalDiscounts)}</td>
        <td class="text-right">${(totalDiscounts / grossDenom * 100).toFixed(1)}%</td>
      </tr>

      <tr style="font-weight: 600;">
        <td>TAXES</td>
        <td class="text-right font-mono">${formatCurrency(taxes)}</td>
        <td class="text-right">${(taxes / grossDenom * 100).toFixed(1)}%</td>
      </tr>

      <tr style="font-weight: 700; color: var(--brand-700); background: var(--brand-50);">
        <td>NET PROFIT (REMAINING)</td>
        <td class="text-right font-mono">${formatCurrency(netProfit)}</td>
        <td class="text-right">${(netProfit / grossDenom * 100).toFixed(1)}%</td>
      </tr>
    `;

    // 2. COGS Product Table Populate
    const pBody = $('#cogsProductBody');
    pBody.innerHTML = '';

    const pKeys = Object.keys(productCogs);
    pKeys.sort((a, b) => productCogs[b] - productCogs[a]);

    if (pKeys.length === 0) {
      pBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--gray-400); padding: 20px;">No product cost allocations logged.</td></tr>`;
    } else {
      pKeys.forEach(name => {
        const uCost = getItemCogs(products.find(pr => pr.name === name)?.id, 0);
        const costShare = totalCogs > 0 ? (productCogs[name] / totalCogs * 100) : 0;
        
        pBody.innerHTML += `
          <tr>
            <td><strong>${name}</strong></td>
            <td class="text-right">${productUnits[name]}</td>
            <td class="text-right font-mono">${formatCurrency(uCost || (productCogs[name] / productUnits[name]))}</td>
            <td class="text-right font-mono">${formatCurrency(productCogs[name])}</td>
            <td class="text-right font-mono">${costShare.toFixed(1)}%</td>
          </tr>
        `;
      });
    }

    // Calculate Insights Card
    let largestCostName = 'COGS';
    let maxCostVal = totalCogs;
    
    if (totalOpEx > maxCostVal) {
      largestCostName = 'Operating Expenses';
      maxCostVal = totalOpEx;
    }
    if (totalDiscounts > maxCostVal) {
      largestCostName = 'Discounts';
      maxCostVal = totalDiscounts;
    }
    if (taxes > maxCostVal) {
      largestCostName = 'Taxes';
      maxCostVal = taxes;
    }

    $('#insLargestCost').textContent = `${largestCostName} (${formatCurrency(maxCostVal)})`;
    $('#insSalariesBurden').textContent = `${(salaries / grossDenom * 100).toFixed(1)}%`;
    $('#insPromoBurden').textContent = `${(totalDiscounts / grossDenom * 100).toFixed(1)}%`;
    
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue * 100) : 0;
    $('#insGrossMargin').textContent = `${grossMarginPct.toFixed(1)}%`;

    // Recommendation logic
    const opexRatio = totalOpEx / grossDenom * 100;
    const promoRatio = totalDiscounts / grossDenom * 100;
    
    let recommendation = 'Your cost structure is healthy. Continue monitoring fixed expenses.';
    if (opexRatio > 35) {
      recommendation = `Operating Expenses represent <strong>${opexRatio.toFixed(1)}%</strong> of gross sales. Focus on scaling up transaction counts or store efficiency to lower the fixed burden.`;
    } else if (promoRatio > 12) {
      recommendation = `Promotional discount burden is high at <strong>${promoRatio.toFixed(1)}%</strong> of gross sales. Consider tapering promo discounts or replacing with loyalty point bonuses.`;
    } else if (grossMarginPct < 60) {
      recommendation = `Gross Margin is low at <strong>${grossMarginPct.toFixed(1)}%</strong>. Review configuration prices or product COGS values to increase margin health.`;
    }
    $('#costRecommendation').innerHTML = recommendation;

    // 3. Render Chart.js
    renderChart(totalCogs, salaries, rent, utilities, totalDiscounts, taxes, Math.max(0, netProfit));
  }

  // ============ Render Chart.js visual allocations ============
  function renderChart(cogs, salaries, rent, utilities, promos, taxes, profit) {
    const canvas = $('#costRevenueAllocationChart');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (costChartInstance) costChartInstance.destroy();

      costChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['COGS', 'Salaries', 'Rent', 'Utilities', 'Promos', 'Taxes', 'Net Profit'],
          datasets: [{
            data: [cogs, salaries, rent, utilities, promos, taxes, profit],
            backgroundColor: [
              '#EF4444', // COGS (red)
              '#F59E0B', // Salaries (orange)
              '#FDE68A', // Rent (light yellow)
              '#E0E7FF', // Utilities (indigo)
              '#3B82F6', // Promos (blue)
              '#8B9DE3', // Taxes (purple)
              '#10B981'  // Profit (green)
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, font: { size: 10 } }
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

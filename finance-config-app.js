(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  let products = [];
  let financeConfig = {};

  const DEFAULT_PRODUCT_COGS = {
    'p01': 5400,
    'p02': 4000,
    'p03': 6600,
    'p04': 4500,
    'p05': 4000,
    'p06': 4500,
    'p07': 9000,
    'p08': 6000,
    'p09': 7000,
    'p10': 45000,
    'p11': 8000,
    'p12': 7000,
    'p13': 2000,
    'p14': 8500,
    'p15': 5000
  };

  const DEFAULT_FINANCE_CONFIG = {
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

  // ============ Price Formatting ============
  function formatCurrency(val) {
    const formatted = val % 1 === 0 
      ? val.toLocaleString('en-US') 
      : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return 'Rp\u00A0' + formatted;
  }

  // ============ Load Configuration ============
  function loadConfig() {
    try {
      products = JSON.parse(localStorage.getItem('pos_products') || '[]');
      financeConfig = JSON.parse(localStorage.getItem('pos_finance_config')) || DEFAULT_FINANCE_CONFIG;
    } catch (e) {
      console.error('Error loading configuration', e);
    }
  }

  // ============ Render Form & List ============
  function render() {
    loadConfig();

    // Fill OpEx
    $('#inputSalaries').value = financeConfig.dailySalaries || 0;
    $('#inputRent').value = financeConfig.dailyRent || 0;
    $('#inputUtilities').value = financeConfig.dailyUtilities || 0;
    updateOpExTotal();

    // Fill Taxes
    $('#inputTaxRate').value = financeConfig.taxRate || 0;
    $('#selectTaxApply').value = financeConfig.taxApplyTo || 'revenue';

    // Fill Targets
    $('#targetGross').value = financeConfig.targetGrossMargin || 0;
    $('#targetOperating').value = financeConfig.targetOperatingMargin || 0;
    $('#targetNet').value = financeConfig.targetNetMargin || 0;
    $('#checkboxAlerts').checked = financeConfig.alertsEnabled !== false;

    // Render Product Costs Table list
    const tbody = $('#productCostsBody');
    tbody.innerHTML = '';

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--gray-400);">No products found.</td></tr>`;
      return;
    }

    products.forEach(p => {
      const cogs = p.cogs !== undefined && p.cogs !== null ? p.cogs : Math.round(p.basePrice * 0.3);
      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${p.emoji || '📦'} ${p.name}</strong>
            <div style="font-size: 10px; color: var(--gray-400);">${p.sku || ''}</div>
          </td>
          <td class="text-right font-mono">${formatCurrency(p.basePrice)}</td>
          <td class="text-right">
            <input type="number" class="cost-edit-input font-mono" data-id="${p.id}" value="${cogs}" />
          </td>
        </tr>
      `;
    });

    // Wire input changes for daily overhead totals
    const opInputs = ['#inputSalaries', '#inputRent', '#inputUtilities'];
    opInputs.forEach(sel => {
      $(sel).removeEventListener('input', updateOpExTotal);
      $(sel).addEventListener('input', updateOpExTotal);
    });

    // Wire bulk adjustment inputs preview
    $('#bulkPctInput').removeEventListener('input', updateBulkPreview);
    $('#bulkPctInput').addEventListener('input', updateBulkPreview);
  }

  function updateOpExTotal() {
    const salaries = Number($('#inputSalaries').value || 0);
    const rent = Number($('#inputRent').value || 0);
    const utilities = Number($('#inputUtilities').value || 0);
    const total = salaries + rent + utilities;
    $('#opexTotalVal').textContent = formatCurrency(total);
  }

  function updateBulkPreview() {
    const pct = parseFloat($('#bulkPctInput').value);
    const previewBox = $('#bulkReviewBox');
    
    if (isNaN(pct) || pct <= 0) {
      previewBox.textContent = 'Type a percentage to calculate estimated impact.';
      return;
    }

    let totalCogs = 0;
    let totalPrices = 0;
    let count = products.length;

    if (count === 0) return;

    products.forEach(p => {
      const currentCogs = p.cogs !== undefined && p.cogs !== null ? p.cogs : Math.round(p.basePrice * 0.3);
      totalCogs += currentCogs;
      totalPrices += p.basePrice;
    });

    const avgCost = totalCogs / count;
    const newAvgCost = avgCost * (1 + pct / 100);
    const avgPrice = totalPrices / count;
    const currentMargin = (avgPrice - avgCost) / avgPrice * 100;
    const newMargin = (avgPrice - newAvgCost) / avgPrice * 100;
    const impact = currentMargin - newMargin;

    previewBox.innerHTML = `
      <strong>Adjustment Impact Preview:</strong><br/>
      • Current avg cost: <strong>${formatCurrency(avgCost)}</strong><br/>
      • New avg cost: <strong>${formatCurrency(newAvgCost)}</strong> (+${pct}%)<br/>
      • Profit Margins Impact: <strong>Reduces margin ratios by ~${impact.toFixed(1)}%</strong>.
    `;
  }

  // ============ Setup Event Listeners ============
  function setupEvents() {
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

    // Save Configurations
    $('#btnSave').addEventListener('click', () => {
      // 1. Gather finance configs
      financeConfig.dailySalaries = Number($('#inputSalaries').value || 0);
      financeConfig.dailyRent = Number($('#inputRent').value || 0);
      financeConfig.dailyUtilities = Number($('#inputUtilities').value || 0);
      financeConfig.taxRate = Number($('#inputTaxRate').value || 0);
      financeConfig.taxApplyTo = $('#selectTaxApply').value;
      financeConfig.targetGrossMargin = Number($('#targetGross').value || 0);
      financeConfig.targetOperatingMargin = Number($('#targetOperating').value || 0);
      financeConfig.targetNetMargin = Number($('#targetNet').value || 0);
      financeConfig.alertsEnabled = $('#checkboxAlerts').checked;

      localStorage.setItem('pos_finance_config', JSON.stringify(financeConfig));

      // 2. Gather individual product cogs
      $$('.cost-edit-input').forEach(input => {
        const pId = input.dataset.id;
        const cogsVal = Number(input.value || 0);
        const pIndex = products.findIndex(pr => pr.id === pId);
        if (pIndex !== -1) {
          products[pIndex].cogs = cogsVal;
        }
      });

      localStorage.setItem('pos_products', JSON.stringify(products));
      showToast('All configurations and costs saved successfully.');
      render();
    });

    // Reset Defaults
    $('#btnReset').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all configurations and product costs to default seed values?')) {
        // Reset config
        localStorage.setItem('pos_finance_config', JSON.stringify(DEFAULT_FINANCE_CONFIG));
        
        // Reset product costs
        products.forEach(p => {
          if (DEFAULT_PRODUCT_COGS[p.id] !== undefined) {
            p.cogs = DEFAULT_PRODUCT_COGS[p.id];
          } else {
            p.cogs = Math.round(p.basePrice * 0.3); // fallback
          }
        });
        
        localStorage.setItem('pos_products', JSON.stringify(products));
        showToast('Reset complete. Form values updated.');
        render();
      }
    });

    // Apply Bulk cost adjustments
    $('#btnApplyBulk').addEventListener('click', () => {
      const pct = parseFloat($('#bulkPctInput').value);
      if (isNaN(pct) || pct <= 0) {
        showToast('Please type a valid adjustment percentage.');
        return;
      }

      if (confirm(`Apply a ${pct}% cost increase to all products in the list?`)) {
        $$('.cost-edit-input').forEach(input => {
          const currentVal = parseFloat(input.value || 0);
          const newVal = Math.round(currentVal * (1 + pct / 100));
          input.value = newVal;
        });

        $('#bulkPctInput').value = '';
        $('#bulkReviewBox').textContent = 'Type a percentage to calculate estimated impact.';
        showToast(`Applied ${pct}% increase to all cost inputs. Click Save to commit changes.`);
      }
    });
  }

  // ============ Initial setup ============
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    render();
  });
})();

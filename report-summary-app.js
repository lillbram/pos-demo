(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // ============ Check Authorization (Super Admin Only) ============
    const currentUser = JSON.parse(localStorage.getItem('pos_current_user'));
    if (!currentUser || currentUser.role !== 'Super Admin') {
      // Redirect unauthorized user back to main POS screen or show error
      // Note: We follow standard role protection like other pages if necessary
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
          const activePeriod = document.querySelector('.period-btn.active').getAttribute('data-period');
          window.location.href = 'report-detail.html?period=' + activePeriod;
        } else if (text.includes('Promo & Discount')) {
          window.location.href = 'promo.html';
        } else if (text.includes('Store List')) {
          window.location.href = 'store.html';
        } else if (text.includes('Staff List')) {
          window.location.href = 'staff.html';
        }
      });
    });

    // User profile click redirects to settings
    const sideUser = document.querySelector('.side-user');
    if (sideUser) {
      sideUser.style.cursor = 'pointer';
      sideUser.addEventListener('click', () => {
        window.location.href = 'setting.html';
      });

      const user = JSON.parse(localStorage.getItem('pos_current_user')) || {
        name: 'Agus Prasetyo',
        role: 'Super Admin',
        email: 'agus.p@bluepoint.id',
        store: 'Store #04',
        phone: '+62 812-1111-2222'
      };

      const avatarEl = sideUser.querySelector('.avatar');
      const nameEl = sideUser.querySelector('.name');
      const roleEl = sideUser.querySelector('.role');

      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = `${user.role} · ${user.store || 'Store #04'}`;

      if (avatarEl) {
        const nameParts = user.name.split(/\s+/).filter(Boolean).slice(0, 2);
        const initials = nameParts.map(s => s[0].toUpperCase()).join('');
        avatarEl.textContent = initials || 'SA';
      }
    }

    // ============ Toast Notification System ============
    let toastTimeout;
    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.querySelector('.toast-msg').textContent = message;
      toast.classList.add('show');
      
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 2500);
    }

    // Export PDF handler
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
      showToast('Exporting summary report as PDF...');
      setTimeout(() => {
        window.print();
      }, 500);
    });

    // ============ Helper Functions ============
    function formatCurrency(val) {
      const formatted = val % 1 === 0 
        ? val.toLocaleString('en-US') 
        : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return 'Rp\u00A0' + formatted;
    }

    // ============ Chart.js Graphs Setup ============
    
    // Chart 1: Sales Trend (Line Chart)
    const salesTrendCtx = document.getElementById('salesTrendChart').getContext('2d');
    const salesTrendChart = new Chart(salesTrendCtx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Revenue',
          data: [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#3D55CC',
          backgroundColor: 'rgba(61, 85, 204, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointBackgroundColor: '#3D55CC',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Revenue: Rp ' + context.parsed.y.toFixed(2) + 'M';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            ticks: {
              callback: function(value) {
                return 'Rp ' + value + 'M';
              }
            }
          }
        }
      }
    });

    // Chart 2: Top 5 Products (Horizontal Bar Chart)
    const topProductsCtx = document.getElementById('topProductsChart').getContext('2d');
    const topProductsChart = new Chart(topProductsCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: '#3D55CC',
          borderRadius: 6,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Units Sold: ' + context.parsed.x;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { precision: 0 }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });

    // Chart 3: Store Performance (Vertical Bar Chart)
    const storePerformanceCtx = document.getElementById('storePerformanceChart').getContext('2d');
    const storePerformanceChart = new Chart(storePerformanceCtx, {
      type: 'bar',
      data: {
        labels: ['Store #01', 'Store #02', 'Store #03', 'Store #04'],
        datasets: [{
          data: [0, 0, 0, 0],
          backgroundColor: [
            '#3D55CC',
            '#10B981',
            '#F59E0B',
            '#EF4444'
          ],
          borderRadius: 6,
          barThickness: 24
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Revenue: Rp ' + context.parsed.y.toLocaleString('id-ID');
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            ticks: {
              callback: function(value) {
                return 'Rp ' + (value / 1000000).toFixed(2) + 'M';
              }
            }
          }
        }
      }
    });

    // ============ Dynamic Dashboard Updating ============
    window.productsData = []; // Store top products for sort listeners

    function updateDashboard(period) {
      const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      const products = JSON.parse(localStorage.getItem('pos_products') || '[]');

      // Period filter relative to anchor date 2026-05-22
      const anchorDate = '2026-05-22';
      let filteredOrders = [];

      if (period === 'today') {
        filteredOrders = orders.filter(o => o.date.startsWith(anchorDate));
      } else if (period === 'week') {
        filteredOrders = orders.filter(o => {
          const d = o.date.substring(0, 10);
          return d >= '2026-05-16' && d <= anchorDate;
        });
      } else {
        filteredOrders = orders.filter(o => {
          const d = o.date.substring(0, 10);
          return d >= '2026-05-01' && d <= anchorDate;
        });
      }

      // 1. Calculate Metrics
      let revenue = 0;
      let transactions = 0;
      let promos = 0;
      let discounts = 0;
      let cogs = 0;

      filteredOrders.forEach(o => {
        revenue += Number(o.total || 0);
        transactions++;
        if (o.promoCode && o.promoCode.trim() !== '') {
          promos++;
        }
        discounts += Number(o.promoDiscount || 0) + Number(o.itemDiscount || 0);

        // Sum COGS for each item in the order
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach(item => {
            const prod = products.find(p => p.id === item.id);
            // Fallback default: 30% of basePrice (or item.price if product basePrice is missing)
            let itemCogs = 0;
            if (prod) {
              if (prod.cogs !== undefined && prod.cogs !== null && prod.cogs !== '') {
                itemCogs = Number(prod.cogs);
              } else {
                itemCogs = Number((prod.basePrice || item.price || 0) * 0.3);
              }
            } else {
              itemCogs = Number((item.price || 0) * 0.3);
            }
            cogs += itemCogs * Number(item.qty || 0);
          });
        }
      });

      const avgBasket = transactions > 0 ? (revenue / transactions) : 0;

      // Render numeric cards
      document.getElementById('metRevenue').textContent = formatCurrency(revenue);
      document.getElementById('metTransactions').textContent = transactions;
      document.getElementById('metAvgValue').textContent = formatCurrency(avgBasket);
      document.getElementById('metPromos').textContent = promos;
      document.getElementById('metDiscounts').textContent = formatCurrency(discounts);

      const promoPct = transactions > 0 ? ((promos / transactions) * 100).toFixed(1) : '0.0';
      document.getElementById('subPromos').textContent = `${promoPct}% conversion rate`;

      // Gross to Profit Breakdown Calculations
      const gross = revenue + discounts;
      const nett = revenue;
      const grossProfit = nett - cogs;

      const discountPct = gross > 0 ? ((discounts / gross) * 100) : 0;
      const cogsPct = gross > 0 ? ((cogs / gross) * 100) : 0;
      const profitPct = gross > 0 ? ((grossProfit / gross) * 100) : 100;

      document.getElementById('breakdownGross').textContent = formatCurrency(gross);
      document.getElementById('breakdownDiscounts').textContent = discounts > 0 ? '-' + formatCurrency(discounts) : formatCurrency(0);
      document.getElementById('breakdownNett').textContent = formatCurrency(nett);
      document.getElementById('breakdownCogs').textContent = cogs > 0 ? '-' + formatCurrency(cogs) : formatCurrency(0);
      document.getElementById('breakdownProfit').textContent = formatCurrency(grossProfit);

      document.getElementById('profitMarginPct').textContent = `${profitPct.toFixed(1)}%`;
      document.getElementById('barProfit').style.width = `${profitPct}%`;
      document.getElementById('barCogs').style.width = `${cogsPct}%`;
      document.getElementById('barDiscount').style.width = `${discountPct}%`;

      // 2. Inventory badges status
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      products.forEach(p => {
        if (p.stock === 0) outOfStock++;
        else if (p.stock <= 5) lowStock++;
        else inStock++;
      });
      document.getElementById('invInStock').textContent = `✓ In Stock: ${inStock}`;
      document.getElementById('invLowStock').textContent = `⚠️ Low Stock: ${lowStock}`;
      document.getElementById('invOutOfStock').textContent = `🔴 Out of Stock: ${outOfStock}`;

      // 3. Update Sales Trend Chart
      let trendLabels = [];
      let trendData = [];

      if (period === 'today') {
        trendLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        const hourlyBuckets = [0, 0, 0, 0, 0, 0, 0, 0];
        filteredOrders.forEach(o => {
          const hr = new Date(o.date).getHours();
          let idx = 0;
          if (hr <= 8) idx = 0;
          else if (hr <= 10) idx = 1;
          else if (hr <= 12) idx = 2;
          else if (hr <= 14) idx = 3;
          else if (hr <= 16) idx = 4;
          else if (hr <= 18) idx = 5;
          else if (hr <= 20) idx = 6;
          else idx = 7;
          hourlyBuckets[idx] += Number(o.total || 0);
        });
        trendData = hourlyBuckets.map(v => Number((v / 1000000).toFixed(3)));
      } else if (period === 'week') {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekDates = [];
        const dailyTotals = {};

        for (let i = 6; i >= 0; i--) {
          const dt = new Date('2026-05-22');
          dt.setDate(dt.getDate() - i);
          const dStr = dt.toISOString().substring(0, 10);
          weekDates.push({ dateStr: dStr, label: dayNames[dt.getDay()] });
          dailyTotals[dStr] = 0;
        }

        filteredOrders.forEach(o => {
          const d = o.date.substring(0, 10);
          if (dailyTotals[d] !== undefined) {
            dailyTotals[d] += Number(o.total || 0);
          }
        });

        trendLabels = weekDates.map(w => w.label);
        trendData = weekDates.map(w => Number((dailyTotals[w.dateStr] / 1000000).toFixed(3)));
      } else {
        trendLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        const weeklyTotals = [0, 0, 0, 0];
        filteredOrders.forEach(o => {
          const day = parseInt(o.date.substring(8, 10), 10);
          if (day <= 7) weeklyTotals[0] += Number(o.total || 0);
          else if (day <= 14) weeklyTotals[1] += Number(o.total || 0);
          else if (day <= 21) weeklyTotals[2] += Number(o.total || 0);
          else weeklyTotals[3] += Number(o.total || 0);
        });
        trendData = weeklyTotals.map(v => Number((v / 1000000).toFixed(3)));
      }

      salesTrendChart.data.labels = trendLabels;
      salesTrendChart.data.datasets[0].data = trendData;
      salesTrendChart.update();

      // 4. Update Top Products Chart
      const prodQties = {};
      filteredOrders.forEach(o => {
        (o.items || []).forEach(item => {
          prodQties[item.name] = (prodQties[item.name] || 0) + Number(item.qty || 0);
        });
      });

      let productsList = Object.keys(prodQties).map(name => ({
        name,
        value: prodQties[name]
      }));

      productsList.sort((a, b) => b.value - a.value);
      window.productsData = productsList.slice(0, 5);

      updateSortedProducts();

      // 5. Update Store Performance Chart
      const storeRevs = {
        'Store #01': 0,
        'Store #02': 0,
        'Store #03': 0,
        'Store #04': 0
      };

      filteredOrders.forEach(o => {
        const sName = o.store ? o.store.replace(/\s*\(POS\)/g, '').trim() : '';
        if (storeRevs[sName] !== undefined) {
          storeRevs[sName] += Number(o.total || 0);
        }
      });

      storePerformanceChart.data.datasets[0].data = [
        storeRevs['Store #01'],
        storeRevs['Store #02'],
        storeRevs['Store #03'],
        storeRevs['Store #04']
      ];
      storePerformanceChart.update();
    }

    function updateSortedProducts() {
      const sortOrder = document.getElementById('sortProducts').value;
      const dataCopy = [...window.productsData];
      if (sortOrder === 'asc') {
        dataCopy.sort((a, b) => a.value - b.value);
      } else {
        dataCopy.sort((a, b) => b.value - a.value);
      }

      topProductsChart.data.labels = dataCopy.map(p => p.name);
      topProductsChart.data.datasets[0].data = dataCopy.map(p => p.value);
      topProductsChart.update();
    }

    // Sort listener
    document.getElementById('sortProducts').addEventListener('change', () => {
      updateSortedProducts();
      const sortOrder = document.getElementById('sortProducts').value;
      showToast(`Products sorted ${sortOrder === 'asc' ? 'Low to High' : 'High to Low'}`);
    });

    // ============ Period Toggle Functionality ============
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        periodButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const period = btn.getAttribute('data-period');
        const periodText = btn.textContent;
        showToast(`Reporting period updated to: ${periodText}`);
        
        // Update last updated timestamp
        const now = new Date();
        document.getElementById('lastUpdatedText').textContent = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;
        
        updateDashboard(period);
      });
    });

    // Initial Dashboard Load
    updateDashboard('today');
  });
})();

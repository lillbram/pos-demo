// ============================================================
// Order page — app logic
// state, rendering, cart math, variant modal
// ============================================================
(() => {
  const { CATEGORIES, PRODUCTS, CUSTOMERS, LOW_STOCK_THRESHOLD, stockState } = window.POS_DATA;
  const customers = CUSTOMERS.slice(); // mutable working copy

  // ----- state -----
  const state = {
    activeCat: 'all',
    search: '',
    sort: 'popular',
    cart: [],          // {lineId, productId, name, emoji, tint, variants:[{group,label,delta}], qty, unitPrice}
    payment: 'cash',
    orderType: 'dinein',
    promo: null,       // {code, kind: 'percent'|'amount', value}
    customer: null,    // {id, name, phone, points, ...}
  };

  // initials helper
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0].toUpperCase()).join('');

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

  const stripPriceField = val => {
    const num = parsePrice(val);
    if (num === 0) return '';
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const fmt = n => formatPriceField(n);
  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  // ============ Categories ============
  function renderCats() {
    const el = $('#cats');
    el.innerHTML = '';
    CATEGORIES.forEach(c => {
      const count = c.id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === c.id).length;
      const btn = document.createElement('button');
      btn.className = 'cat' + (state.activeCat === c.id ? ' active' : '');
      btn.innerHTML = `<span>${c.name}</span><span class="count">${count}</span>`;
      btn.addEventListener('click', () => { state.activeCat = c.id; renderCats(); renderGrid(); });
      el.appendChild(btn);
    });
  }

  // ============ Product grid ============
  function filteredProducts() {
    let list = PRODUCTS.slice();
    if (state.activeCat !== 'all') list = list.filter(p => p.cat === state.activeCat);
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    const sort = state.sort;
    list.sort((a, b) => {
      if (sort === 'popular') return b.popularity - a.popularity;
      if (sort === 'az') return a.name.localeCompare(b.name);
      if (sort === 'price-low') return a.basePrice - b.basePrice;
      if (sort === 'price-high') return b.basePrice - a.basePrice;
      return 0;
    });
    return list;
  }

  function renderGrid() {
    const list = filteredProducts();
    $('#resultCount').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
    const grid = $('#grid');
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; padding:48px; text-align:center; color:var(--gray-500);">
          <div style="font-size:38px; margin-bottom:8px;">🔍</div>
          <div style="font-weight:600; color:var(--gray-700); margin-bottom:4px;">No products found</div>
          <div style="font-size:13px;">Try a different keyword or category.</div>
        </div>`;
      return;
    }

    list.forEach(p => {
      const hasVariants = p.variants && p.variants.length;
      const ss = stockState(p);
      const minPriceBase = p.basePrice + getMinDelta(p);
      const minPriceDisc = applyProductDiscount(minPriceBase, p);
      const hasDisc = !!p.discount;

      const visualHtml = p.image 
        ? `<img src="${p.image}" alt="${p.name}" />` 
        : (p.emoji 
          ? `<span class="emoji">${p.emoji}</span>` 
          : `<svg class="default-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.65;"><path d="M20.5 7.27L12 12 3.5 7.27"/><path d="M12 22V12"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`);

      const card = document.createElement('button');
      card.className = 'product' + (ss === 'out' ? ' out-of-stock' : '');
      card.innerHTML = `
        <div class="product-img" style="background: ${p.tint || '#F1F5F9'};">
          ${visualHtml}
          ${hasDisc ? `<span class="stock-tag disc">${p.discount.label}</span>` : ''}
          ${hasVariants ? `<span class="variant-tag">Variants</span>` : ''}
          ${ss === 'out' ? `<span class="stock-tag out" style="top:auto; bottom:10px;">Sold out</span>` : ''}
        </div>
        <div class="name">${p.name}</div>
        <div class="stock-line ${ss === 'low' ? 'low' : ''}">
          ${ss === 'out'
            ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Out of stock`
            : ss === 'low'
              ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Only ${p.stock} left`
              : `<span class="dot"></span> ${p.stock} in stock`}
        </div>
        <div class="foot">
          <span class="price ${hasDisc ? 'has-disc' : ''}">
            ${hasVariants ? `<span class="from">from</span>` : ''}
            <span class="now">${fmt(minPriceDisc)}</span>
            ${hasDisc ? `<span class="was">${fmt(minPriceBase)}</span>` : ''}
          </span>
          <span class="add">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </span>
        </div>
      `;
      card.addEventListener('click', () => openProduct(p));
      grid.appendChild(card);
    });
  }

  // Apply a product discount to a unit price
  function applyProductDiscount(price, p) {
    if (!p.discount) return price;
    if (p.discount.kind === 'percent') return Math.max(0, price * (1 - p.discount.value));
    if (p.discount.kind === 'amount')  return Math.max(0, price - p.discount.value);
    return price;
  }

  function getMinDelta(p) {
    if (!p.variants || !p.variants.length) return 0;
    // sum the cheapest required option from each required group
    let d = 0;
    p.variants.forEach(g => {
      if (g.required) {
        const min = Math.min(...g.options.map(o => o.delta));
        d += min;
      }
    });
    return d;
  }

  // ============ Open product (with or without variants) ============
  function openProduct(p) {
    if (stockState(p) === 'out') return;
    if (!p.variants || !p.variants.length) {
      addToCart(p, [], 1);
      flash(`Added ${p.name}`);
      return;
    }
    openVariantModal(p);
  }

  // ============ Variant modal ============
  const vm = {
    product: null,
    qty: 1,
    selected: {}, // groupName -> array of selected labels (single for required, multi for optional)
  };

  function openVariantModal(p) {
    vm.product = p;
    vm.qty = 1;
    vm.selected = {};
    p.variants.forEach(g => {
      if (g.required || p.combinations) {
        const def = g.options.find(o => o.default) || g.options[0];
        vm.selected[g.name] = [def.label];
      } else {
        vm.selected[g.name] = [];
      }
    });
    $('#vmName').textContent = p.name;
    $('#vmSub').textContent = `${p.variants.length} option${p.variants.length===1?'':'s'} · base ${fmt(p.basePrice)}`;
    $('#vmThumb').style.background = p.tint || '#F1F5F9';
    const visualHtml = p.image 
      ? `<img src="${p.image}" alt="${p.name}" />` 
      : (p.emoji 
        ? p.emoji 
        : `<svg class="default-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.65;"><path d="M20.5 7.27L12 12 3.5 7.27"/><path d="M12 22V12"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`);
    $('#vmThumb').innerHTML = visualHtml;
    $('#vmQty').textContent = '1';
    renderVariantBody();
    refreshVmPrice();
    $('#scrim').classList.add('show');
  }
  function closeVariantModal() { $('#scrim').classList.remove('show'); }

  function renderVariantBody() {
    const body = $('#vmBody');
    body.innerHTML = '';
    vm.product.variants.forEach(g => {
      const wrap = document.createElement('div');
      wrap.className = 'variant-group';
      wrap.innerHTML = `
        <div class="vg-head">
          <span class="vg-name">${g.name}</span>
          <span class="vg-req">${(g.required || vm.product.combinations) ? 'Required · pick one' : 'Optional · pick any'}</span>
        </div>
        <div class="vg-options"></div>`;
      const opts = wrap.querySelector('.vg-options');
      g.options.forEach(o => {
        const isActive = vm.selected[g.name].includes(o.label);
        const b = document.createElement('button');
        b.className = 'vg-option' + (isActive ? ' active' : '');
        const deltaText = o.delta === 0 ? '' : (o.delta > 0 ? `+${fmt(o.delta)}` : `${fmt(o.delta)}`);
        b.innerHTML = `<span>${o.label}</span>${deltaText ? `<span class="delta">${deltaText}</span>` : ''}`;
        b.addEventListener('click', () => {
          if (g.required || vm.product.combinations) vm.selected[g.name] = [o.label];
          else {
            const i = vm.selected[g.name].indexOf(o.label);
            if (i >= 0) vm.selected[g.name].splice(i, 1);
            else vm.selected[g.name].push(o.label);
          }
          renderVariantBody();
          refreshVmPrice();
        });
        opts.appendChild(b);
      });
      body.appendChild(wrap);
    });
  }

  function getMatchedCombination(p, selected) {
    if (!p || !p.combinations) return null;
    return p.combinations.find(c => {
      return p.variants.every(g => {
        const sel = selected[g.name];
        return sel && sel.length === 1 && sel[0] === c.attributes[g.name];
      });
    });
  }

  function getCombinationByVariantList(p, variantList) {
    if (!p || !p.combinations) return null;
    return p.combinations.find(c => {
      return p.variants.every(g => {
        const matchingOpt = variantList.find(v => v.group === g.name);
        return matchingOpt && matchingOpt.label === c.attributes[g.name];
      });
    });
  }

  function vmUnitPriceRaw() {
    if (vm.product.combinations) {
      const matched = getMatchedCombination(vm.product, vm.selected);
      if (matched) {
        return matched.price;
      }
    }
    let unit = vm.product.basePrice;
    vm.product.variants.forEach(g => {
      vm.selected[g.name].forEach(label => {
        const o = g.options.find(o => o.label === label);
        if (o) unit += o.delta;
      });
    });
    return unit;
  }
  function vmUnitPrice() { return applyProductDiscount(vmUnitPriceRaw(), vm.product); }
  
  function refreshVmPrice() {
    const p = vm.product;
    const matched = getMatchedCombination(p, vm.selected);
    const addBtn = $('#vmAdd');
    
    if (p.combinations && matched) {
      const stock = matched.stock;
      const sku = matched.sku || 'No SKU';
      let stockText = '';
      let isOut = false;
      
      if (stock <= 0) {
        stockText = `<span style="color:var(--danger-600); font-weight:600;">Out of stock</span>`;
        isOut = true;
      } else if (stock <= LOW_STOCK_THRESHOLD) {
        stockText = `<span style="color:var(--warning-600); font-weight:600;">Low stock: only ${stock} left</span>`;
      } else {
        stockText = `<span style="color:var(--success-600); font-weight:600;">${stock} in stock</span>`;
      }
      
      $('#vmSub').innerHTML = `SKU: <strong style="color:var(--gray-800);">${sku}</strong> · ${stockText}`;
      
      if (isOut) {
        addBtn.disabled = true;
        addBtn.innerHTML = `Sold out · <span class="price">${fmt(vmUnitPrice() * vm.qty)}</span>`;
      } else {
        addBtn.disabled = false;
        addBtn.innerHTML = `Add to order · <span class="price" id="vmPrice">${fmt(vmUnitPrice() * vm.qty)}</span>`;
      }
    } else {
      $('#vmSub').textContent = `${p.variants.length} option${p.variants.length===1?'':'s'} · base ${fmt(p.basePrice)}`;
      addBtn.disabled = false;
      addBtn.innerHTML = `Add to order · <span class="price" id="vmPrice">${fmt(vmUnitPrice() * vm.qty)}</span>`;
    }

    const priceEl = $('#vmPrice');
    if (priceEl) {
      priceEl.textContent = fmt(vmUnitPrice() * vm.qty);
    }
  }

  $('#vmClose').addEventListener('click', closeVariantModal);
  $('#scrim').addEventListener('click', (e) => { if (e.target.id === 'scrim') closeVariantModal(); });
  $('#vmMinus').addEventListener('click', () => { if (vm.qty > 1) { vm.qty--; $('#vmQty').textContent = vm.qty; refreshVmPrice(); }});
  $('#vmPlus').addEventListener('click',  () => { vm.qty++; $('#vmQty').textContent = vm.qty; refreshVmPrice(); });
  $('#vmAdd').addEventListener('click', () => {
    const variantList = [];
    vm.product.variants.forEach(g => {
      vm.selected[g.name].forEach(label => {
        const o = g.options.find(o => o.label === label);
        variantList.push({ group: g.name, label, delta: o.delta });
      });
    });
    addToCart(vm.product, variantList, vm.qty);
    closeVariantModal();
    flash(`Added ${vm.qty}× ${vm.product.name}`);
  });

  // ============ Cart ============
  function addToCart(p, variantList, qty) {
    // find an existing identical line (same product + same variants in same order)
    const sig = p.id + '::' + variantList.map(v => v.group+'='+v.label).sort().join('|');
    const existing = state.cart.find(l => l.sig === sig);
    const matchedCombo = getCombinationByVariantList(p, variantList);

    if (existing) {
      existing.qty += qty;
    } else {
      let rawUnit = p.basePrice + variantList.reduce((s,v) => s + v.delta, 0);
      let sku = p.sku;
      if (matchedCombo) {
        rawUnit = matchedCombo.price;
        sku = matchedCombo.sku;
      }
      const unit = applyProductDiscount(rawUnit, p);
      state.cart.push({
        lineId: 'L' + Math.random().toString(36).slice(2, 8),
        sig,
        productId: p.id,
        name: p.name,
        emoji: p.emoji,
        image: p.image,
        tint: p.tint || '#F1F5F9',
        variants: variantList,
        originalUnit: rawUnit,
        unitPrice: unit,
        discountLabel: p.discount ? p.discount.label : null,
        qty,
        sku: sku,
        combinationKey: matchedCombo ? matchedCombo.name : null
      });
    }
    renderCart();
  }

  function changeQty(lineId, delta) {
    const line = state.cart.find(l => l.lineId === lineId);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter(l => l.lineId !== lineId);
    renderCart();
  }

  function removeLine(lineId) {
    state.cart = state.cart.filter(l => l.lineId !== lineId);
    renderCart();
  }

  function renderCart() {
    const list = $('#cartItems');
    list.innerHTML = '';
    if (!state.cart.length) {
      list.innerHTML = `
        <div class="cart-empty">
          <div class="emoji">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <h3>Your cart is empty</h3>
          <p>Add products from the menu to start an order.</p>
        </div>`;
    } else {
      state.cart.forEach(line => {
        const variantText = line.variants.length
          ? line.variants.map(v => v.label).join(' · ')
          : '';
        const hasDisc = line.discountLabel;
        const row = document.createElement('div');
        const visualHtml = line.image 
          ? `<img src="${line.image}" alt="${line.name}" />` 
          : (line.emoji 
            ? line.emoji 
            : `<svg class="default-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.65;"><path d="M20.5 7.27L12 12 3.5 7.27"/><path d="M12 22V12"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`);

        row.className = 'cart-row';
        row.innerHTML = `
          <div class="thumb" style="background: ${line.tint || '#F1F5F9'};">${visualHtml}</div>
          <div class="body">
            <div class="top">
              <div>
                <div class="name">${line.name}</div>
                ${variantText ? `<div class="var-line">${variantText}</div>` : ''}
                ${hasDisc ? `<div class="var-line" style="color:var(--brand-600);font-weight:600;margin-top:3px;">· ${line.discountLabel}</div>` : ''}
              </div>
              <button class="remove" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
            <div class="bottom">
              <div class="qty">
                <button class="dec"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <span class="n">${line.qty}</span>
                <button class="inc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
              </div>
              <span class="line-price">
                <span>${fmt(line.unitPrice * line.qty)}</span>
                ${hasDisc ? `<span class="was">${fmt(line.originalUnit * line.qty)}</span>` : ''}
              </span>
            </div>
          </div>
        `;
        row.querySelector('.dec').addEventListener('click', () => changeQty(line.lineId, -1));
        row.querySelector('.inc').addEventListener('click', () => changeQty(line.lineId, +1));
        row.querySelector('.remove').addEventListener('click', () => removeLine(line.lineId));
        list.appendChild(row);
      });
    }
    renderTotals();
    // nav badge
    const total = state.cart.reduce((s, l) => s + l.qty, 0);
    $('#navCount').textContent = total;
    $('#navCount').style.display = total ? '' : 'none';
    $('#checkoutBtn').disabled = total === 0;
  }

  function getTotals() {
    const grossSubtotal = state.cart.reduce((s, l) => s + l.originalUnit * l.qty, 0);
    const itemDiscount  = state.cart.reduce((s, l) => s + (l.originalUnit - l.unitPrice) * l.qty, 0);
    const afterItem     = grossSubtotal - itemDiscount; // = sum(unit*qty)
    let promoDiscount = 0;
    if (state.promo) {
      const scope = state.promo.scope || 'transaction';
      if (scope === 'product') {
        const promoProducts = state.promo.products || [];
        const eligibleItems = state.cart.filter(l => promoProducts.includes(l.productId));
        const eligibleSubtotal = eligibleItems.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        if (state.promo.kind === 'percent') {
          promoDiscount = eligibleSubtotal * state.promo.value;
        } else {
          promoDiscount = Math.min(state.promo.value, eligibleSubtotal);
        }
      } else {
        if (state.promo.kind === 'percent') promoDiscount = afterItem * state.promo.value;
        if (state.promo.kind === 'amount')  promoDiscount = Math.min(state.promo.value, afterItem);
      }
    }
    const taxable = Math.max(0, afterItem - promoDiscount);
    const tax = taxable * 0.08;
    const grand = taxable + tax;
    return { grossSubtotal, itemDiscount, afterItem, promoDiscount, tax, grand };
  }

  function renderTotals() {
    const t = getTotals();
    $('#sumSubtotal').textContent = fmt(t.grossSubtotal);
    $('#sumTax').textContent = fmt(t.tax);
    $('#sumGrand').textContent = fmt(t.grand);

    // Item discount row (auto-created)
    let itemRow = document.getElementById('itemDiscountRow');
    if (t.itemDiscount > 0) {
      if (!itemRow) {
        itemRow = document.createElement('div');
        itemRow.id = 'itemDiscountRow';
        itemRow.className = 'row discount';
        itemRow.innerHTML = `<span>Item discounts</span><span class="num" id="sumItemDiscount">-Rp\u00A00.00</span>`;
        // insert before promo discount row or tax
        const taxRow = $('#sumTax').closest('.row');
        taxRow.parentNode.insertBefore(itemRow, $('#discountRow'));
      }
      itemRow.style.display = '';
      $('#sumItemDiscount').textContent = '-' + fmt(t.itemDiscount);
    } else if (itemRow) {
      itemRow.style.display = 'none';
    }

    const dr = $('#discountRow');
    if (t.promoDiscount > 0) {
      dr.style.display = '';
      $('#sumDiscount').textContent = '-' + fmt(t.promoDiscount);
      const label = state.promo.kind === 'percent'
        ? `Promo (${(state.promo.value*100).toFixed(0)}%)`
        : `Promo`;
      $('#discountLabel').textContent = label;
    } else {
      dr.style.display = 'none';
    }
  }

  // ============ Promo ============
  const getPromos = () => {
    let promos = {};
    if (localStorage.getItem('pos_promos')) {
      try {
        promos = JSON.parse(localStorage.getItem('pos_promos'));
      } catch (e) {
        console.error('Error parsing pos_promos', e);
      }
    }
    return promos;
  };

  $('#applyPromo').addEventListener('click', () => {
    const code = $('#promoInput').value.trim().toUpperCase();
    if (!code) return;
    const promos = getPromos();
    const promo = promos[code];
    if (!promo) { flash('Promo code not recognized', true); return; }
    if (promo.active === false) { flash('Promo code is inactive', true); return; }

    // Validate store eligibility
    const activeStore = sessionStorage.getItem('pos_active_store') || 'Store #04';
    const allowedStores = promo.stores || ['Store #01', 'Store #02', 'Store #03', 'Store #04'];
    const isAllowed = allowedStores.some(st => st.includes(activeStore) || activeStore.includes(st));
    if (!isAllowed) {
      flash('Promo code not active for this store', true);
      return;
    }

    state.promo = { code, ...promo };
    $('#promoCode').textContent = code;
    $('#appliedPromo').classList.add('show');
    $('#promoForm').style.display = 'none';
    $('#promoInput').value = '';
    renderTotals();
    flash(`Promo ${code} applied`);
  });
  $('#removePromo').addEventListener('click', () => {
    state.promo = null;
    $('#appliedPromo').classList.remove('show');
    $('#promoForm').style.display = '';
    renderTotals();
  });

  // ============ Clear & checkout ============
  $('#clearBtn').addEventListener('click', () => {
    if (!state.cart.length) return;
    if (confirm('Clear all items from this order?')) {
      state.cart = [];
      state.promo = null;
      $('#appliedPromo').classList.remove('show');
      $('#promoForm').style.display = '';
      renderCart();
    }
  });

  $('#checkoutBtn').addEventListener('click', () => {
    if (!state.cart.length) return;
    openCheckout();
  });

  $('#holdBtn').addEventListener('click', () => {
    if (!state.cart.length) return;
    flash('Order placed on hold');
    state.cart = [];
    state.promo = null;
    $('#appliedPromo').classList.remove('show');
    $('#promoForm').style.display = '';
    renderCart();
  });

  // ============ Payment & order-type ============
  $$('.pay-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('.pay-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.payment = b.dataset.pay;
    });
  });
  $$('.order-type button').forEach(b => {
    b.addEventListener('click', () => {
      $$('.order-type button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.orderType = b.dataset.type;
    });
  });

  // ============ Search & sort ============
  $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderGrid(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

  // Keyboard ⌘K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#searchInput').focus();
    }
    if (e.key === 'Escape') { closeVariantModal(); closeCustomerModal(); closeCheckout(); }
  });

  // Sidebar nav clicks (mock: only Order is active, others show toast)
  $$('#nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (item.hasAttribute('onclick') || item.getAttribute('onclick')) return;
      if (item.classList.contains('active')) return;
      const label = Array.from(item.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(Boolean).join(' ').trim();
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
      flash(`${label} screen — coming next`);
    });
  });

  // ============ Customer ============
  function renderCustomerBar() {
    const bar = $('#customerBar');
    if (state.customer) {
      const c = state.customer;
      bar.innerHTML = `
        <div class="avatar" style="width:34px; height:34px; font-size:12px;">${initials(c.name)}</div>
        <div class="who" style="flex:1; min-width:0;">
          <div class="name">${c.name}</div>
          <div class="meta">${c.phone} · <span style="color:var(--brand-600); font-weight:600;">${c.points.toLocaleString()} pts</span></div>
        </div>
        <button class="cm-detach" title="Remove customer" style="width:26px; height:26px; border-radius:6px; color:var(--gray-400); display:inline-flex; align-items:center; justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
      bar.style.borderStyle = 'solid';
      bar.style.background = 'var(--brand-50)';
      bar.style.borderColor = 'var(--brand-200)';

      // detach button stops propagation
      bar.querySelector('.cm-detach').addEventListener('click', (e) => {
        e.stopPropagation();
        state.customer = null;
        renderCustomerBar();
        flash('Customer removed from order');
      });
    } else {
      bar.innerHTML = `
        <div class="avatar" style="width:30px; height:30px; font-size:11px; background: var(--gray-100); color: var(--gray-500);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
        </div>
        <div class="who">
          <div class="name">Walk-in customer</div>
          <div class="meta">Tap to add customer</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      bar.style.borderStyle = 'dashed';
      bar.style.background = 'var(--gray-50)';
      bar.style.borderColor = 'var(--border-strong)';
    }
  }

  function openCustomerModal() {
    $('#customerScrim').classList.add('show');
    switchCmPane('search');
    $('#cmSearchInput').value = '';
    renderCmList('');
    setTimeout(() => $('#cmSearchInput').focus(), 100);
  }
  function closeCustomerModal() { $('#customerScrim').classList.remove('show'); }

  function switchCmPane(name) {
    $$('.cm-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === name));
    $('#cmPaneSearch').style.display   = name === 'search'   ? 'flex' : 'none';
    $('#cmPaneRegister').style.display = name === 'register' ? 'flex' : 'none';
    if (name === 'register') {
      $('#cmTitle').textContent = 'Register new customer';
      $('#cmSub').textContent = 'Just a name and phone number to get started';
      setTimeout(() => $('#regName').focus(), 100);
    } else {
      $('#cmTitle').textContent = 'Add customer';
      $('#cmSub').textContent = 'Search by phone number or name';
    }
  }

  function renderCmList(query) {
    const q = query.trim().toLowerCase();
    const matches = customers.filter(c => {
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || c.phone.replace(/[\s\-+]/g, '').includes(q.replace(/[\s\-+]/g, ''));
    });

    const list = $('#cmList');
    const empty = $('#cmEmpty');
    list.innerHTML = '';

    if (!matches.length) {
      empty.style.display = 'flex';
      list.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    list.style.display = '';

    matches.forEach(c => {
      const row = document.createElement('div');
      row.className = 'cm-row';
      row.innerHTML = `
        <div class="avatar">${initials(c.name)}</div>
        <div class="who">
          <div class="nm">${c.name}${c.points >= 2000 ? ' <span class="badge badge-brand" style="height:18px; font-size:10px;">VIP</span>' : ''}</div>
          <div class="phone">${c.phone} · ${c.orders} orders</div>
        </div>
        <div class="pts">
          <span class="n">${c.points.toLocaleString()}</span>
          <span class="lbl">Points</span>
        </div>`;
      row.addEventListener('click', () => selectCustomer(c));
      list.appendChild(row);
    });
  }

  function selectCustomer(c) {
    state.customer = c;
    renderCustomerBar();
    closeCustomerModal();
    flash(`${c.name} attached · ${c.points.toLocaleString()} pts`);
  }

  function registerCustomer() {
    const name = $('#regName').value.trim();
    const phone = $('#regPhone').value.trim();
    const err = $('#regError');
    err.style.display = 'none';

    if (!name) { err.textContent = 'Please enter the customer\'s name.'; err.style.display = ''; $('#regName').focus(); return; }
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      err.textContent = 'Please enter a valid phone number.'; err.style.display = ''; $('#regPhone').focus(); return;
    }
    // dedupe by phone (normalized)
    const norm = phone.replace(/\D/g, '');
    const existing = customers.find(c => c.phone.replace(/\D/g, '') === norm);
    if (existing) {
      err.textContent = `This phone is already registered to ${existing.name}.`;
      err.style.display = '';
      return;
    }
    const c = {
      id: 'c' + (customers.length + 1).toString().padStart(2, '0'),
      name, phone,
      points: 50, // signup bonus
      since: new Date().toISOString().slice(0, 10),
      orders: 0,
    };
    customers.unshift(c);
    window.saveCustomers(customers);
    $('#regName').value = '';
    $('#regPhone').value = '';
    selectCustomer(c);
  }

  // wire up
  $('#customerBar').addEventListener('click', (e) => {
    if (e.target.closest('.cm-detach')) return;
    openCustomerModal();
  });
  $('#cmClose').addEventListener('click', closeCustomerModal);
  $('#customerScrim').addEventListener('click', (e) => { if (e.target.id === 'customerScrim') closeCustomerModal(); });
  $$('.cm-tab').forEach(t => t.addEventListener('click', () => switchCmPane(t.dataset.pane)));
  $('#cmGotoRegister').addEventListener('click', () => switchCmPane('register'));
  $('#cmCancelRegister').addEventListener('click', () => switchCmPane('search'));
  $('#cmDoRegister').addEventListener('click', registerCustomer);
  $('#cmSearchInput').addEventListener('input', (e) => renderCmList(e.target.value));
  // enter-to-register
  ['regName', 'regPhone'].forEach(id => {
    $('#' + id).addEventListener('keydown', (e) => { if (e.key === 'Enter') registerCustomer(); });
  });

  // ============ Checkout flow ============
  let orderCounter = 1042;
  const checkoutSession = {
    method: 'cash',
    total: 0,
    tendered: 0,
    change: 0,
    pointsRedeemed: 0,
    orderId: null,
    cardTimer: null,
  };

  function openCheckout() {
    const t = getTotals();
    checkoutSession.method = state.payment;
    checkoutSession.total = t.grand;
    checkoutSession.tendered = 0;
    checkoutSession.change = 0;
    checkoutSession.pointsRedeemed = 0;
    checkoutSession.orderId = 'A-' + (++orderCounter);

    if ($('#ckFullyPaidMsg')) $('#ckFullyPaidMsg').style.display = 'none';

    // Show/hide redeem pane based on customer selection
    const redeemPane = $('#ckPaneRedeem');
    if (redeemPane) {
      if (state.customer) {
        redeemPane.style.display = '';
        $('#ckRedeemStatus').textContent = `${state.customer.points.toLocaleString()} pts available`;
        $('#ckRedeemInput').value = '';
        $('#ckRedeemMsg').style.display = 'none';
        $('#ckRedeemMsg').textContent = '';
      } else {
        redeemPane.style.display = 'none';
      }
    }

    // Pay pill label & icon
    const labels = { cash: 'Cash', card: 'Card', qr: 'QR Pay' };
    $('#ckPayLabel').textContent = labels[checkoutSession.method] || 'Cash';

    // Show appropriate pane
    $('#ckPaneCash').style.display = checkoutSession.method === 'cash' ? '' : 'none';
    $('#ckPaneCard').style.display = checkoutSession.method === 'card' ? '' : 'none';
    $('#ckPaneQR').style.display   = checkoutSession.method === 'qr'   ? '' : 'none';

    $('#ckCashAmount').textContent = fmt(checkoutSession.total);
    $('#ckCardAmount').textContent = fmt(checkoutSession.total);
    $('#ckQRAmount').textContent   = fmt(checkoutSession.total);

    // reset cash UI
    $('#ckCashInput').value = '';
    updateChange();
    renderCashChips();

    // Card initialization
    if (checkoutSession.method === 'card') {
      const status = $('#ckCardStatus');
      if (status) {
        status.innerHTML = `
          <div class="title">EDC Terminal Ready</div>
          <div class="sub">Decide points to use first, then click the trigger button to process payment.</div>`;
      }
      const edcScreen = $('#edcScreenText');
      if (edcScreen) {
        edcScreen.textContent = 'READY';
        edcScreen.classList.remove('blink');
      }
      const triggerBtn = $('#ckTriggerEDC');
      if (triggerBtn) {
        triggerBtn.style.display = '';
        triggerBtn.disabled = false;
      }
    }

    // QR
    if (checkoutSession.method === 'qr') drawQR();

    // Button labels
    if (checkoutSession.method === 'card') {
      $('#ckConfirm').style.display = 'none';
    } else if (checkoutSession.method === 'qr') {
      $('#ckConfirm').style.display = '';
      $('#ckConfirm').disabled = false; // Ensure enabled
      $('#ckConfirm').textContent = "I've received payment";
    } else {
      $('#ckConfirm').style.display = '';
      $('#ckConfirm').textContent = 'Confirm payment';
    }

    $('#checkoutScrim').classList.add('show');
    if (checkoutSession.method === 'cash') setTimeout(() => $('#ckCashInput').focus(), 100);
  }
  function closeCheckout() {
    $('#checkoutScrim').classList.remove('show');
    if (checkoutSession.cardTimer) { clearTimeout(checkoutSession.cardTimer); checkoutSession.cardTimer = null; }
  }

  // ----- Cash -----
  function renderCashChips() {
    const wrap = $('#ckCashChips');
    wrap.innerHTML = '';
    const total = checkoutSession.total;
    const exact = +total.toFixed(2);
    const ceilTo = (n, step) => Math.ceil(n / step) * step;

    let steps;
    if (exact >= 100) {
      steps = [5000, 10000, 20000, 50000, 100000];
    } else {
      steps = [5, 10, 20, 50, 100];
    }

    const suggestions = [
      { label: 'Exact', value: exact, cls: 'exact' }
    ];
    steps.forEach(step => {
      suggestions.push({
        label: formatPriceField(ceilTo(exact, step)),
        value: ceilTo(exact, step)
      });
    });

    const seen = new Set();
    suggestions.forEach(s => {
      const key = s.value.toFixed(2);
      if (seen.has(key)) return;
      seen.add(key);
      const b = document.createElement('button');
      b.className = 'cash-chip' + (s.cls ? ' ' + s.cls : '');
      b.textContent = s.label;
      b.addEventListener('click', () => {
        $('#ckCashInput').value = formatPriceField(s.value);
        updateChange();
      });
      wrap.appendChild(b);
    });
  }
  function updateChange() {
    if (checkoutSession.method !== 'cash') {
      $('#ckConfirm').disabled = false;
      return;
    }
    const tendered = parsePrice($('#ckCashInput').value) || 0;
    const change = tendered - checkoutSession.total;
    checkoutSession.tendered = tendered;
    checkoutSession.change = change;

    const card = $('#ckChangeCard');
    if (tendered < checkoutSession.total) {
      card.classList.add('short');
      $('#ckChangeLabel').textContent = 'Still owed';
      $('#ckChangeVal').textContent = fmt(checkoutSession.total - tendered);
      $('#ckConfirm').disabled = true;
    } else {
      card.classList.remove('short');
      $('#ckChangeLabel').textContent = 'Change due';
      $('#ckChangeVal').textContent = fmt(Math.max(0, change));
      $('#ckConfirm').disabled = false;
    }
  }
  $('#ckCashInput').addEventListener('input', updateChange);
  $('#ckCashInput').addEventListener('focus', (e) => {
    e.target.value = stripPriceField(e.target.value);
  });
  $('#ckCashInput').addEventListener('blur', (e) => {
    if (e.target.value) {
      e.target.value = formatPriceField(e.target.value);
    }
  });

  // ----- Card simulation -----
  function startCardSimulation() {
    const status = $('#ckCardStatus');
    status.innerHTML = `
      <div class="title">Waiting for terminal…</div>
      <div class="sub">Please insert, swipe, or tap card on the EDC machine.</div>
      <div class="dots"><span></span><span></span><span></span></div>`;
    // sequence: 1.2s waiting → 1.8s processing → success → receipt
    checkoutSession.cardTimer = setTimeout(() => {
      status.innerHTML = `
        <div class="title">Processing payment…</div>
        <div class="sub">Authorizing with the issuing bank.</div>
        <div class="dots"><span></span><span></span><span></span></div>`;
      checkoutSession.cardTimer = setTimeout(() => {
        status.innerHTML = `
          <div class="title" style="color: var(--success-700); display:inline-flex; align-items:center; gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Approved
          </div>
          <div class="sub">Card ending •• 4421 · Auth #842910</div>`;
        checkoutSession.cardTimer = setTimeout(() => completePayment(), 700);
      }, 1800);
    }, 1200);
  }

  // ----- QR generator (mock visual) -----
  function drawQR() {
    const svg = $('#ckQR');
    const N = 33;
    svg.innerHTML = '';
    const seed = ((checkoutSession.total * 100) | 0) + Date.now() % 9999;
    const rand = (i) => { const x = Math.sin(seed * 9301 + i * 49297) * 233280; return x - Math.floor(x); };
    let html = `<rect width="33" height="33" fill="white"/>`;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // skip the 3 finder pattern areas
        const inFinder = (x < 8 && y < 8) || (x > N-9 && y < 8) || (x < 8 && y > N-9);
        if (inFinder) continue;
        // skip the bottom-right small alignment area
        const inAlign = (x >= N-9 && x <= N-5 && y >= N-9 && y <= N-5);
        if (inAlign) continue;
        if (rand(y * N + x) > 0.52) {
          html += `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`;
        }
      }
    }
    // finder patterns
    function finder(ox, oy) {
      return `
        <rect x="${ox}" y="${oy}" width="7" height="7" fill="#111"/>
        <rect x="${ox+1}" y="${oy+1}" width="5" height="5" fill="#fff"/>
        <rect x="${ox+2}" y="${oy+2}" width="3" height="3" fill="#111"/>
      `;
    }
    html += finder(0, 0) + finder(N-7, 0) + finder(0, N-7);
    // small alignment marker bottom-right
    html += `<rect x="${N-7}" y="${N-7}" width="5" height="5" fill="#111"/>
             <rect x="${N-6}" y="${N-6}" width="3" height="3" fill="#fff"/>
             <rect x="${N-5}" y="${N-5}" width="1" height="1" fill="#3D55CC"/>`;
    svg.innerHTML = html;
  }

  // ----- Confirm payment -----
  $('#ckConfirm').addEventListener('click', completePayment);
  $('#ckCancel').addEventListener('click', closeCheckout);
  $('#ckClose').addEventListener('click', closeCheckout);
  $('#checkoutScrim').addEventListener('click', (e) => { if (e.target.id === 'checkoutScrim') closeCheckout(); });

  const triggerBtn = $('#ckTriggerEDC');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      triggerBtn.disabled = true;
      triggerBtn.style.display = 'none';
      const edcScreen = $('#edcScreenText');
      if (edcScreen) {
        edcScreen.textContent = 'PROCESSING…';
        edcScreen.classList.add('blink');
      }
      startCardSimulation();
    });
  }

  function deductStock() {
    const activeStore = sessionStorage.getItem('pos_active_store') || 'Store #04';
    state.cart.forEach(line => {
      const prod = PRODUCTS.find(x => x.id === line.productId);
      if (prod) {
        if (prod.combinations && line.combinationKey) {
          const combo = prod.combinations.find(c => c.name === line.combinationKey);
          if (combo) {
            combo.stock = Math.max(0, combo.stock - line.qty);
            if (!combo.stocks) combo.stocks = {};
            combo.stocks[activeStore] = combo.stock;
          }
          // Recalculate parent product's aggregate stock
          prod.stock = prod.combinations.reduce((sum, c) => sum + (c.stock || 0), 0);
          // Recalculate parent's multistore stocks map
          if (!prod.stocks) prod.stocks = {};
          const storeNames = ['Store #01', 'Store #02', 'Store #03', 'Store #04', 'Store #05', 'Store #06', 'Store #07', 'Store #08', 'Store #09', 'Store #10'];
          storeNames.forEach(store => {
            prod.stocks[store] = prod.combinations.reduce((sum, c) => sum + ((c.stocks && c.stocks[store]) || 0), 0);
          });
        } else {
          // Standard product
          prod.stock = Math.max(0, prod.stock - line.qty);
          if (!prod.stocks) prod.stocks = {};
          prod.stocks[activeStore] = prod.stock;
        }
      }
    });
    window.saveProducts(PRODUCTS);
    renderGrid();
  }

  function completePayment() {
    if (checkoutSession.method === 'cash' && checkoutSession.tendered < checkoutSession.total) return;
    deductStock();
    closeCheckout();
    openReceipt();
  }

  // ============ Receipt ============
  function openReceipt() {
    renderReceiptPaper();
    const methodNames = { cash: 'cash', card: 'credit card', qr: 'QR payment' };
    $('#rcOrderId').textContent = '#' + checkoutSession.orderId;
    $('#rcTime').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#rcAmount').textContent = fmt(checkoutSession.total);
    $('#rcMethod').textContent = methodNames[checkoutSession.method];

    // Reset Choices UI
    $('#rcChoices').style.display = 'block';
    $('#rcStatusPanel').style.display = 'none';
    $('#waInputContainer').style.display = 'none';
    $('#waPhoneInput').value = '';
    $('#waSubmitBtn').disabled = true;
    $('#choicePrintWA').classList.remove('active-choice');
    $('#rcDone').style.boxShadow = '';
    
    // Dynamic choice info
    const c = state.customer;
    if (c) {
      $('#rcChoiceWAMeta').textContent = `Send to ${c.name} (${c.phone})`;
      $('#rcChoiceWAMeta').style.background = 'var(--brand-100)';
      $('#rcChoiceWAMeta').style.color = 'var(--brand-800)';
    } else {
      $('#rcChoiceWAMeta').textContent = 'Walk-in customer';
      $('#rcChoiceWAMeta').style.background = 'var(--gray-100)';
      $('#rcChoiceWAMeta').style.color = 'var(--gray-600)';
    }

    $('#receiptScrim').classList.add('show');
  }

  function renderReceiptPaper() {
    const t = getTotals();
    const lines = state.cart.map(l => {
      const total = l.unitPrice * l.qty;
      const origTotal = l.originalUnit * l.qty;
      const variantText = l.variants.length ? l.variants.map(v => v.label).join(' · ') : '';
      return `
        <div class="rc-line">
          <span class="nm">${l.name}</span>
          <span class="ln-total">${fmt(total)}</span>
          <span class="qty">${l.qty} × ${fmt(l.unitPrice)}${variantText ? '  ·  ' + variantText : ''}</span>
          ${l.discountLabel ? `<span class="ln-disc"><span>${l.discountLabel}</span><span>-${fmt(origTotal - total)}</span></span>` : ''}
        </div>`;
    }).join('');

    const earned = state.customer ? Math.floor(checkoutSession.total) : 0;
    const date = new Date();
    const dateStr = date.toLocaleString([], {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    const orderTypeNames = { dinein: 'Dine-in', takeaway: 'Take-away', delivery: 'Delivery' };

    const methodLabels = { cash: 'CASH', card: 'CARD', qr: 'QR PAY' };
    const paymentLines = checkoutSession.method === 'cash'
      ? `
        <div class="row"><span>Tendered</span><span>${fmt(checkoutSession.tendered)}</span></div>
        <div class="row"><span>Change</span><span>${fmt(Math.max(0, checkoutSession.change))}</span></div>`
      : checkoutSession.method === 'card'
        ? `<div class="row"><span>Card</span><span>•••• 4421</span></div>
           <div class="row"><span>Auth</span><span>#842910</span></div>`
        : `<div class="row"><span>Transaction</span><span>QR-${Math.floor(Math.random()*900000+100000)}</span></div>`;

    const activeStoreName = sessionStorage.getItem('pos_active_store') || 'Store #04';
    const allStores = JSON.parse(localStorage.getItem('pos_stores') || '[]');
    const activeStoreDetails = allStores.find(st => st.name === activeStoreName) || { name: activeStoreName, address: '123 Market St', phone: '+1 (415) 555-0123' };
    const currentUser = JSON.parse(localStorage.getItem('pos_current_user')) || { name: 'Super Admin' };

    const code = checkoutSession.orderId.replace(/\D/g, '') + '00' + Math.floor(Math.random()*9000+1000);

    $('#receiptPaper').innerHTML = `
      <h4>BLUEPOINT</h4>
      <div class="rc-meta">${activeStoreDetails.address} · ${activeStoreDetails.name}<br/>${activeStoreDetails.phone}</div>

      <div class="rc-info">
        <span class="k">Order</span><span class="v">#${checkoutSession.orderId}</span>
        <span class="k">Date</span><span class="v">${dateStr}</span>
        <span class="k">Cashier</span><span class="v">${currentUser.name}</span>
        <span class="k">Type</span><span class="v">${orderTypeNames[state.orderType] || 'Dine-in'}</span>
        ${state.customer ? `<span class="k">Customer</span><span class="v">${state.customer.name}</span>` : ''}
      </div>

      <hr class="sep"/>
      ${lines}
      <hr class="sep"/>

      <div class="rc-totals">
        <div class="row"><span>Subtotal</span><span>${fmt(t.grossSubtotal)}</span></div>
        ${t.itemDiscount > 0 ? `<div class="row disc"><span>Item discounts</span><span>-${fmt(t.itemDiscount)}</span></div>` : ''}
        ${t.promoDiscount > 0 ? `<div class="row disc"><span>Promo ${state.promo.code}</span><span>-${fmt(t.promoDiscount)}</span></div>` : ''}
        ${checkoutSession.pointsRedeemed > 0 ? `<div class="row disc"><span>Points Redeemed</span><span>-${fmt(checkoutSession.pointsRedeemed)}</span></div>` : ''}
        <div class="row"><span>Tax (8%)</span><span>${fmt(t.tax)}</span></div>
        <div class="row grand"><span>TOTAL</span><span>${fmt(checkoutSession.total)}</span></div>
      </div>

      <hr class="sep"/>
      <div class="rc-totals">
        <div class="row"><span>Payment</span><span>${methodLabels[checkoutSession.method]}</span></div>
        ${paymentLines}
      </div>

      ${state.customer ? `
        <div class="loyalty">
          ${state.customer.name} earned <span class="pts">+${earned} pts</span><br/>
          ${checkoutSession.pointsRedeemed > 0 ? `<span style="color:var(--danger-600);">Redeemed: -${checkoutSession.pointsRedeemed} pts</span><br/>` : ''}
          <span style="color:var(--gray-500);">Total balance: ${(state.customer.points - checkoutSession.pointsRedeemed + earned).toLocaleString()} pts</span>
        </div>` : ''}

      <div class="barcode">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none">
          ${Array.from({length: 50}, (_, i) => {
            const w = (i % 4 === 0) ? 1.8 : (i % 3 === 0 ? 1.0 : 0.6);
            return `<rect x="${i*2}" y="0" width="${w}" height="20" fill="#111"/>`;
          }).join('')}
        </svg>
        <div class="barcode-num">${code}</div>
      </div>

      <div class="thanks">
        <div class="big">Thank you for shopping with us!</div>
        <div>Have a great day · bluepoint.io</div>
      </div>
    `;
  }

  function closeReceipt() {
    $('#receiptScrim').classList.remove('show');
    
    // Save order transactions
    const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const nextOrderId = checkoutSession.orderId || ('ORD-' + Date.now().toString().slice(-5));
    const t = getTotals();
    
    const redeemed = checkoutSession.pointsRedeemed || 0;
    const earned = state.customer ? Math.floor(checkoutSession.total) : 0;

    if (state.customer) {
      // award points and increment order count in customers list
      const cIndex = customers.findIndex(c => c.id === state.customer.id);
      if (cIndex !== -1) {
        customers[cIndex].points = customers[cIndex].points - redeemed + earned;
        customers[cIndex].orders += 1;
        window.saveCustomers(customers);
      }
    }
    
    const orderItems = state.cart.map(l => ({
      id: l.productId,
      name: l.name,
      variantKey: l.variants.map(v => `${v.group}:${v.label}`).join(','),
      qty: l.qty,
      price: l.unitPrice,
      total: l.unitPrice * l.qty,
      variantText: l.variants.map(v => v.label).join(' · ')
    }));

    orders.push({
      id: nextOrderId,
      date: new Date().toISOString(),
      customerId: state.customer ? state.customer.id : null,
      customerName: state.customer ? state.customer.name : 'Walk-in',
      store: (sessionStorage.getItem('pos_active_store') || 'Store #04') + ' (POS)',
      items: orderItems,
      paymentMethod: checkoutSession.method,
      subtotal: t.grossSubtotal,
      itemDiscount: t.itemDiscount,
      promoDiscount: t.promoDiscount,
      promoCode: state.promo ? state.promo.code : '',
      tax: t.tax,
      total: checkoutSession.total,
      pointsEarned: earned,
      pointsRedeemed: redeemed,
      itemCount: state.cart.reduce((sum, item) => sum + item.qty, 0)
    });
    localStorage.setItem('pos_orders', JSON.stringify(orders));

    state.cart = [];
    state.promo = null;
    state.customer = null;
    $('#appliedPromo').classList.remove('show');
    $('#promoForm').style.display = '';
    renderCart();
    renderCustomerBar();
  }

  $('#rcDone').addEventListener('click', closeReceipt);
  $('#receiptScrim').addEventListener('click', (e) => { if (e.target.id === 'receiptScrim') closeReceipt(); });

  // ============ Choice action handlers ============
  function runReceiptFlow(deliverWhatsApp = false, waPhone = '') {
    // Hide choices
    $('#rcChoices').style.display = 'none';
    $('#waInputContainer').style.display = 'none';
    
    // Show status panel
    $('#rcStatusPanel').style.display = 'block';
    
    // Set up status elements
    const printStatus = $('#statusPrint');
    const waStatus = $('#statusWA');
    const successMsg = $('#statusSuccessMsg');
    
    printStatus.style.display = '';
    printStatus.className = 'status-item';
    printStatus.innerHTML = '<span class="spinner-small"></span><span>Printing physical receipt...</span>';
    
    if (deliverWhatsApp) {
      waStatus.style.display = '';
      waStatus.className = 'status-item';
      waStatus.innerHTML = '<span class="spinner-small"></span><span>Sending WhatsApp copy...</span>';
    } else {
      waStatus.style.display = 'none';
    }
    successMsg.style.display = 'none';
    
    // Phase 1: Printing (1.2 seconds)
    setTimeout(() => {
      printStatus.innerHTML = '<span style="color: var(--success-500); font-weight: 600;">✓ Printed</span>';
      flash('Receipt sent to printer');
      
      if (deliverWhatsApp) {
        // Phase 2: Sending WhatsApp (1.2 seconds)
        setTimeout(() => {
          waStatus.innerHTML = `<span style="color: var(--success-500); font-weight: 600;">✓ Sent via WhatsApp</span>`;
          flash(`WhatsApp receipt sent to ${waPhone}`);
          
          // Show final success
          setTimeout(() => {
            printStatus.style.display = 'none';
            waStatus.style.display = 'none';
            
            $('#successTitle').textContent = 'Receipt Delivered!';
            $('#successDesc').textContent = `Printed & sent via WhatsApp to ${waPhone}`;
            successMsg.style.display = '';
            
            // Highlight done button
            $('#rcDone').style.boxShadow = '0 8px 16px -6px rgba(16, 185, 129, 0.45)';
          }, 600);
        }, 1200);
      } else {
        // Show final success immediately
        setTimeout(() => {
          printStatus.style.display = 'none';
          
          $('#successTitle').textContent = 'Receipt Printed!';
          $('#successDesc').textContent = 'Physical copy sent to printer successfully.';
          successMsg.style.display = '';
          
          // Highlight done button
          $('#rcDone').style.boxShadow = '0 8px 16px -6px rgba(16, 185, 129, 0.45)';
        }, 600);
      }
    }, 1200);
  }

  $('#choiceJustPrint').addEventListener('click', () => {
    runReceiptFlow(false);
  });

  $('#choicePrintWA').addEventListener('click', () => {
    const c = state.customer;
    if (c) {
      runReceiptFlow(true, c.phone);
    } else {
      // Toggle / show input container for walk-in
      const container = $('#waInputContainer');
      const card = $('#choicePrintWA');
      if (container.style.display === 'none') {
        container.style.display = 'flex';
        card.classList.add('active-choice');
        setTimeout(() => $('#waPhoneInput').focus(), 50);
      } else {
        container.style.display = 'none';
        card.classList.remove('active-choice');
      }
    }
  });

  $('#waPhoneInput').addEventListener('input', (e) => {
    const val = e.target.value.trim().replace(/\D/g, '');
    $('#waSubmitBtn').disabled = val.length < 7;
  });

  $('#waPhoneInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('#waSubmitBtn').disabled) {
      runReceiptFlow(true, $('#waPhoneInput').value.trim());
    }
  });

  $('#waSubmitBtn').addEventListener('click', () => {
    if ($('#waSubmitBtn').disabled) return;
    runReceiptFlow(true, $('#waPhoneInput').value.trim());
  });

  // ============ Toast ============
  let toastTimer;
  function flash(msg, isError = false) {
    const t = $('#toast');
    $('#toastMsg').textContent = msg;
    const icon = t.querySelector('.toast-icon');
    icon.style.background = isError ? 'var(--danger-500)' : 'var(--success-500)';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ============ Points Redemption Event Listeners ============
  if ($('#ckRedeemInput')) {
    $('#ckRedeemInput').addEventListener('input', () => {
      applyPointsRedemption();
    });
  }
  if ($('#ckRedeemMaxBtn')) {
    $('#ckRedeemMaxBtn').addEventListener('click', () => {
      if (!state.customer) return;
      const t = getTotals();
      const maxRedeemable = Math.min(state.customer.points, Math.floor(t.grand));
      $('#ckRedeemInput').value = maxRedeemable;
      applyPointsRedemption();
    });
  }
  
  function applyPointsRedemption() {
    if (!state.customer) return;
    const t = getTotals();
    const inputVal = $('#ckRedeemInput').value.trim();
    const msgEl = $('#ckRedeemMsg');
    
    if (inputVal === '') {
      checkoutSession.pointsRedeemed = 0;
      checkoutSession.total = t.grand;
      msgEl.style.display = 'none';
    } else {
      let pts = parseInt(inputVal, 10);
      if (isNaN(pts) || pts < 0) pts = 0;
      
      const maxAllowed = Math.min(state.customer.points, Math.floor(t.grand));
      
      if (pts > maxAllowed) {
        pts = maxAllowed;
        $('#ckRedeemInput').value = pts;
        msgEl.textContent = pts === state.customer.points 
          ? `Capped to customer's total points (${pts.toLocaleString()} pts)`
          : `Capped to order total (${pts.toLocaleString()} pts)`;
        msgEl.style.color = 'var(--warning-600)';
        msgEl.style.display = '';
      } else {
        msgEl.textContent = `Applied points redemption: -${fmt(pts)} (Remaining: ${(state.customer.points - pts).toLocaleString()} pts)`;
        msgEl.style.color = 'var(--success-600)';
        msgEl.style.display = '';
      }
      
      checkoutSession.pointsRedeemed = pts;
      checkoutSession.total = t.grand - pts;
    }

    // Update displayed total across payment panes
    $('#ckCashAmount').textContent = fmt(checkoutSession.total);
    $('#ckCardAmount').textContent = fmt(checkoutSession.total);
    $('#ckQRAmount').textContent = fmt(checkoutSession.total);
    
    // Toggle layout for full point redemption
    if (checkoutSession.total <= 0) {
      $('#ckPaneCash').style.display = 'none';
      $('#ckPaneCard').style.display = 'none';
      $('#ckPaneQR').style.display = 'none';
      
      let fullyPaidMsg = $('#ckFullyPaidMsg');
      if (!fullyPaidMsg) {
        fullyPaidMsg = document.createElement('div');
        fullyPaidMsg.id = 'ckFullyPaidMsg';
        fullyPaidMsg.style.cssText = 'padding: 24px; text-align: center; border-radius: 12px; background: var(--success-50); color: var(--success-700); font-weight: 600; margin-top: 10px; border: 1px solid var(--success-200);';
        $('#ckBody').appendChild(fullyPaidMsg);
      }
      fullyPaidMsg.style.display = '';
      fullyPaidMsg.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
        <div>Fully Paid with Points</div>
        <div style="font-size: 13px; font-weight: 500; margin-top: 4px; color: var(--success-600);">
          Redeemed: ${checkoutSession.pointsRedeemed.toLocaleString()} points. No remaining amount due.
        </div>
      `;
      $('#ckConfirm').style.display = '';
      $('#ckConfirm').disabled = false;
      $('#ckConfirm').textContent = 'Confirm payment';
    } else {
      if ($('#ckFullyPaidMsg')) $('#ckFullyPaidMsg').style.display = 'none';
      
      // Restore appropriate pane
      $('#ckPaneCash').style.display = checkoutSession.method === 'cash' ? '' : 'none';
      $('#ckPaneCard').style.display = checkoutSession.method === 'card' ? '' : 'none';
      $('#ckPaneQR').style.display   = checkoutSession.method === 'qr'   ? '' : 'none';
      
      // Recalculate change and cash chips
      updateChange();
      renderCashChips();
      
      // Button labels
      if (checkoutSession.method === 'card') {
        $('#ckConfirm').style.display = 'none';
      } else if (checkoutSession.method === 'qr') {
        $('#ckConfirm').style.display = '';
        $('#ckConfirm').disabled = false;
        $('#ckConfirm').textContent = "I've received payment";
      } else {
        $('#ckConfirm').style.display = '';
        $('#ckConfirm').textContent = 'Confirm payment';
      }
      
      // QR code redraw if QR pay
      if (checkoutSession.method === 'qr') {
        drawQR();
      }
    }
  }

  // ============ Store Selection & Stock Sync ============
  function initStoreSelection() {
    // 1. Get logged-in user
    const currentUser = JSON.parse(localStorage.getItem('pos_current_user')) || {
      name: 'Agus Prasetyo',
      role: 'Super Admin',
      email: 'agus.p@bluepoint.id'
    };

    // 2. Load staff list to match user
    const staffList = JSON.parse(localStorage.getItem('pos_staff') || '[]');
    const matchedStaff = staffList.find(s => s.email === currentUser.email || s.name === currentUser.name);
    
    // 3. Fallback stores
    const allStores = JSON.parse(localStorage.getItem('pos_stores') || '[]');
    let userStores = matchedStaff ? (matchedStaff.stores || []) : [];
    if (userStores.length === 0 && currentUser.role === 'Super Admin') {
      userStores = allStores.map(s => s.name);
    }
    if (userStores.length === 0) {
      userStores = ['Store #04'];
    }

    // 4. Determine currently selected store
    let activeStore = sessionStorage.getItem('pos_active_store') || currentUser.store;
    if (activeStore && !userStores.includes(activeStore)) {
      activeStore = null;
    }

    // 5. Enforce selection
    if (userStores.length > 1) {
      if (!activeStore) {
        showStoreSelectModal(userStores, false);
      } else {
        setActiveStore(activeStore);
      }
      
      const badge = $('#topStoreBadge');
      if (badge) {
        badge.style.cursor = 'pointer';
        badge.style.display = 'flex';
        badge.onclick = () => {
          if (state.cart.length > 0) {
            if (!confirm('Changing the store will clear your current cart. Proceed?')) {
              return;
            }
          }
          showStoreSelectModal(userStores, true);
        };
      }
    } else {
      const singleStore = userStores[0];
      setActiveStore(singleStore);
      
      const badge = $('#topStoreBadge');
      if (badge) {
        badge.style.cursor = 'default';
        badge.style.display = 'flex';
        badge.onclick = null;
      }
    }
  }

  function showStoreSelectModal(allowedStores, dismissible) {
    const scrim = $('#storeSelectScrim');
    const closeBtn = $('#storeSelectClose');
    const container = $('#storeListContainer');
    
    if (!scrim || !container) return;

    if (closeBtn) {
      closeBtn.style.display = dismissible ? 'block' : 'none';
      closeBtn.onclick = () => {
        scrim.classList.remove('show');
      };
    }

    scrim.onclick = (e) => {
      if (e.target.id === 'storeSelectScrim' && dismissible) {
        scrim.classList.remove('show');
      }
    };

    const allStores = JSON.parse(localStorage.getItem('pos_stores') || '[]');
    const currentActive = sessionStorage.getItem('pos_active_store');
    
    container.innerHTML = '';
    allowedStores.forEach(storeName => {
      const details = allStores.find(s => s.name === storeName) || { name: storeName, address: 'Bluepoint Outlet', phone: '' };
      
      const btn = document.createElement('button');
      btn.className = 'store-item-btn' + (currentActive === storeName ? ' selected' : '');
      btn.innerHTML = `
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 600; color: var(--gray-900); margin-bottom: 2px;">${details.name}</div>
          <div style="font-size: 11px; color: var(--gray-500); line-height: 1.3;">${details.address}</div>
        </div>
        <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0; transition: opacity 150ms ease;">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      `;
      
      btn.onclick = () => {
        if (currentActive && currentActive !== storeName && state.cart.length > 0) {
          state.cart = [];
          renderCart();
        }
        setActiveStore(storeName);
        scrim.classList.remove('show');
      };
      
      container.appendChild(btn);
    });

    scrim.classList.add('show');
  }

  function setActiveStore(storeName) {
    sessionStorage.setItem('pos_active_store', storeName);
    
    const currentUser = JSON.parse(localStorage.getItem('pos_current_user')) || {
      name: 'Agus Prasetyo',
      role: 'Super Admin',
      email: 'agus.p@bluepoint.id'
    };
    currentUser.store = storeName;
    localStorage.setItem('pos_current_user', JSON.stringify(currentUser));
    
    const nameEl = $('#topStoreName');
    if (nameEl) nameEl.textContent = storeName;
    
    const subEl = $('#topHeaderSub');
    if (subEl) {
      const now = new Date();
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      const dateStr = now.toLocaleDateString('en-US', options);
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      subEl.textContent = `Counter · ${storeName} · ${dateStr} · ${timeStr}`;
    }

    updateSidebarProfile();
    applyActiveStoreStock();
    renderGrid();
  }

  function applyActiveStoreStock() {
    const activeStore = sessionStorage.getItem('pos_active_store') || 'Store #04';
    PRODUCTS.forEach(p => {
      if (p.stocks) {
        p.stock = p.stocks[activeStore] ?? 0;
      }
      if (p.combinations) {
        p.combinations.forEach(combo => {
          if (combo.stocks) {
            combo.stock = combo.stocks[activeStore] ?? 0;
          }
        });
      }
    });
  }

  function updateSidebarProfile() {
    const user = JSON.parse(localStorage.getItem('pos_current_user')) || {};
    const roleEl = document.querySelector('.side-user .role');
    if (roleEl) {
      roleEl.textContent = `${user.role || 'Super Admin'} · ${sessionStorage.getItem('pos_active_store') || user.store || 'Store #04'}`;
    }
  }

  // ============ Init ============
  initStoreSelection();
  renderCats();
  renderCart();
  renderCustomerBar();
})();

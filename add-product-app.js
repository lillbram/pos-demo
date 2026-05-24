(() => {
  const { CATEGORIES, PRODUCTS, LOW_STOCK_THRESHOLD, stockState } = window.POS_DATA;

  // ----- state -----
  let uploadedImageBase64 = null;
  let variantGroups = []; // Array of { id, name, required, options: [{ label, delta }] }
  let nextGroupId = 1;
  let initialCombinationsCache = null;

  // DOM Helper selectors
  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);
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

  // ============ Navigation ============
  function setupNavigation() {
    $$('#nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.hasAttribute('onclick') || item.getAttribute('onclick')) return;
        const label = Array.from(item.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(Boolean).join(' ').trim();
        if (label === 'Order') {
          window.location.href = 'order.html';
          return;
        }
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
        showToast(`${label} screen — coming next`);
      });
    });
  }

  // ============ Populate Categories dropdown ============
  function populateCategories() {
    const select = $('#prodCategory');
    const currentValue = select.value;
    select.innerHTML = '<option value="" selected>Select category (Optional)</option>';

    CATEGORIES.forEach(c => {
      if (c.id !== 'all') {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      }
    });

    if (currentValue && CATEGORIES.some(c => c.id === currentValue)) {
      select.value = currentValue;
    }
  }

  // ============ Inline Category Creator ============
  function setupCategoryCreator() {
    const btnAdd = $('#btnAddCategory');
    const btnCancel = $('#btnCancelCategory');
    const btnSave = $('#btnSaveCategory');
    const form = $('#newCategoryInlineForm');
    const input = $('#newCatNameInput');
    const errorMsg = $('#newCatErrorMsg');

    btnAdd.addEventListener('click', () => {
      form.style.display = 'flex';
      input.focus();
    });

    btnCancel.addEventListener('click', () => {
      form.style.display = 'none';
      input.value = '';
      errorMsg.style.display = 'none';
    });

    btnSave.addEventListener('click', () => {
      const name = input.value.trim();
      errorMsg.style.display = 'none';

      if (!name) {
        errorMsg.textContent = '❌ Category name is required.';
        errorMsg.style.display = 'block';
        return;
      }

      // Generate a simple ID
      const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      
      if (!newId) {
        errorMsg.textContent = '❌ Invalid category name.';
        errorMsg.style.display = 'block';
        return;
      }

      // Check if duplicate ID or Name
      const duplicate = CATEGORIES.some(c => c.id === newId || c.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        errorMsg.textContent = `❌ Category "${name}" already exists.`;
        errorMsg.style.display = 'block';
        return;
      }

      // Add category
      CATEGORIES.push({ id: newId, name: name });
      window.saveCategories(CATEGORIES);

      // Repopulate and select new category
      populateCategories();
      $('#prodCategory').value = newId;

      // Close inline form
      form.style.display = 'none';
      input.value = '';
      showToast(`Category "${name}" created!`);
    });
  }

  // ============ Image Uploader logic ============
  function setupImageUploader() {
    const zone = $('#imageUploadZone');
    const fileInput = $('#prodImageInput');
    const removeBtn = $('#btnRemoveImage');

    zone.addEventListener('click', (e) => {
      if (e.target.closest('#btnRemoveImage')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearUploadedImage();
    });
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.');
      return;
    }
    
    if (file.size > 512000) {
      showToast('Image is too large. Please use an image smaller than 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImageBase64 = e.target.result;
      $('#uploadPreviewImg').src = uploadedImageBase64;
      $('#uploadPlaceholder').style.display = 'none';
      $('#uploadPreviewWrapper').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function clearUploadedImage() {
    uploadedImageBase64 = null;
    $('#prodImageInput').value = '';
    $('#uploadPreviewImg').src = '';
    $('#uploadPlaceholder').style.display = 'flex';
    $('#uploadPreviewWrapper').style.display = 'none';
  }

  // ============ Variant Builder Logic ============
  function renderVariantGroups() {
    const container = $('#variantsBuilder');
    container.innerHTML = '';

    // Show/hide the "Add Variant Option Group" button based on group limit (max 2)
    const addGroupBtn = $('#btnAddVariantGroup');
    if (addGroupBtn) {
      if (variantGroups.length >= 2) {
        addGroupBtn.style.display = 'none';
      } else {
        addGroupBtn.style.display = 'inline-flex';
      }
    }

    if (variantGroups.length === 0) {
      container.innerHTML = `
        <div style="font-size:12px; color:var(--gray-500); padding: 12px; text-align:center; border: 1px dashed var(--border-strong); border-radius: var(--r-md); background:var(--gray-50);">
          No variants defined yet. Items will only have a single base price.
        </div>`;
      generateCombinations();
      return;
    }

    variantGroups.forEach(group => {
      const card = document.createElement('div');
      card.className = 'variant-group-card';
      card.dataset.id = group.id;

      card.innerHTML = `
        <div class="group-header">
          <div class="field" style="flex: 1; margin: 0;">
            <input class="input" type="text" placeholder="Group Name (e.g. Size, Milk)" value="${group.name}" data-action="group-name" required style="height: 38px;" />
          </div>
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--gray-700); cursor:pointer;">
            <input type="checkbox" ${group.required ? 'checked' : ''} data-action="group-req" />
            Required
          </label>
          <button type="button" class="btn-remove-group" data-action="remove-group">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Remove
          </button>
        </div>
        <div class="options-container">
          <label class="field-label" style="font-size:11px; margin-bottom:2px;">Options & Price Adjustments</label>
          <div class="options-list" data-container="options-list">
            <!-- options list rows populated here -->
          </div>
          <button type="button" class="btn-add-opt" data-action="add-option">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Option
          </button>
        </div>
      `;

      // Populate options
      const listContainer = card.querySelector('[data-container="options-list"]');
      group.options.forEach((opt, optIndex) => {
        const row = document.createElement('div');
        row.className = 'option-row';
        row.innerHTML = `
          <input class="input" type="text" placeholder="e.g. Medium, Whole Milk" value="${opt.label}" data-action="opt-label" required />
          <button type="button" class="btn-remove-opt" data-action="remove-option" title="Delete Option">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        `;

        // Option event handlers
        row.querySelector('[data-action="opt-label"]').addEventListener('input', (e) => {
          opt.label = e.target.value;
          generateCombinations();
        });
        row.querySelector('[data-action="remove-option"]').addEventListener('click', () => {
          group.options.splice(optIndex, 1);
          renderVariantGroups();
        });

        listContainer.appendChild(row);
      });

      // Group Card handlers
      card.querySelector('[data-action="group-name"]').addEventListener('input', (e) => {
        group.name = e.target.value;
        generateCombinations();
      });
      card.querySelector('[data-action="group-req"]').addEventListener('change', (e) => {
        group.required = e.target.checked;
        generateCombinations();
      });
      card.querySelector('[data-action="remove-group"]').addEventListener('click', () => {
        variantGroups = variantGroups.filter(g => g.id !== group.id);
        renderVariantGroups();
      });
      card.querySelector('[data-action="add-option"]').addEventListener('click', () => {
        group.options.push({ label: '', delta: 0 });
        renderVariantGroups();
      });

      container.appendChild(card);
    });

    generateCombinations();
  }

  // ============ Generate Combinations Table ============
  function generateCombinations() {
    const activeGroups = variantGroups.filter(g => g.name.trim() !== '' && g.options.some(o => o.label.trim() !== ''));
    const prodPriceInput = $('#prodPrice');

    if (activeGroups.length === 0) {
      $('#variantCombinationsCard').style.display = 'none';
      $('#baseStockCard').style.display = 'block';
      if (prodPriceInput) {
        prodPriceInput.disabled = false;
        prodPriceInput.setAttribute('required', '');
      }
      return;
    }

    // Toggle stock panel cards
    $('#variantCombinationsCard').style.display = 'block';
    $('#baseStockCard').style.display = 'none';
    if (prodPriceInput) {
      prodPriceInput.disabled = true;
      prodPriceInput.removeAttribute('required');
    }

    // Cartesian product of option combinations
    let combos = [[]];
    activeGroups.forEach(group => {
      const nextCombos = [];
      const validOptions = group.options.filter(o => o.label.trim() !== '');
      combos.forEach(combo => {
        validOptions.forEach(opt => {
          nextCombos.push([...combo, { groupName: group.name.trim(), optionLabel: opt.label.trim(), delta: opt.delta }]);
        });
      });
      combos = nextCombos;
    });

    // Cache current entries to preserve user overrides
    const inputCache = {};
    $$('#combinationsTableBody tr').forEach(tr => {
      const key = tr.dataset.comboKey;
      if (key) {
        inputCache[key] = {
          sku: tr.querySelector('[data-field="sku"]').value,
          price: tr.querySelector('[data-field="price"]').value,
          s1: tr.querySelector('[data-field="s1"]').value,
          s2: tr.querySelector('[data-field="s2"]').value,
          s3: tr.querySelector('[data-field="s3"]').value,
          s4: tr.querySelector('[data-field="s4"]').value,
        };
      }
    });

    if (initialCombinationsCache) {
      Object.assign(inputCache, initialCombinationsCache);
      initialCombinationsCache = null; // Clear it so subsequent edits are preserved normally
    }

    const tbody = $('#combinationsTableBody');
    tbody.innerHTML = '';

    const baseSKU = $('#prodSKU').value.trim() || 'SKU';
    const basePrice = parsePrice($('#prodPrice').value) || 0;

    combos.forEach(combo => {
      const labels = combo.map(c => c.optionLabel);
      const comboName = labels.join(' / ');
      const comboKey = combo.map(c => `${c.groupName}:${c.optionLabel}`).join('|');

      // Defaults
      let sku = baseSKU;
      combo.forEach(c => {
        const slug = c.optionLabel.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (slug) sku += '-' + slug;
      });

      let price = (basePrice + combo.reduce((sum, c) => sum + c.delta, 0)).toFixed(2);
      let s1 = '0', s2 = '0', s3 = '0', s4 = '0';

      // Restore if cached
      if (inputCache[comboKey]) {
        sku = inputCache[comboKey].sku;
        price = inputCache[comboKey].price;
        s1 = inputCache[comboKey].s1;
        s2 = inputCache[comboKey].s2;
        s3 = inputCache[comboKey].s3;
        s4 = inputCache[comboKey].s4;
      }

      const tr = document.createElement('tr');
      tr.dataset.comboKey = comboKey;
      
      const attributes = {};
      combo.forEach(c => {
        attributes[c.groupName] = c.optionLabel;
      });
      tr.dataset.attributes = JSON.stringify(attributes);

      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--gray-800);">${comboName}</td>
        <td>
          <input class="input" type="text" data-field="sku" value="${sku}" required style="height: 34px; font-size: 12px;" />
        </td>
        <td>
          <input class="input" type="text" data-field="price" value="${formatPriceField(price)}" required style="height: 34px; font-size: 12px;" />
        </td>
        <td>
          <input class="input" type="number" min="0" data-field="s1" value="${s1}" style="height: 34px; font-size: 12px; text-align: right;" />
        </td>
        <td>
          <input class="input" type="number" min="0" data-field="s2" value="${s2}" style="height: 34px; font-size: 12px; text-align: right;" />
        </td>
        <td>
          <input class="input" type="number" min="0" data-field="s3" value="${s3}" style="height: 34px; font-size: 12px; text-align: right;" />
        </td>
        <td>
          <input class="input" type="number" min="0" data-field="s4" value="${s4}" style="height: 34px; font-size: 12px; text-align: right; border-color: var(--brand-300); font-weight: 600;" />
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ============ Form Submission & Save ============
  function setupFormHandler() {
    $('#prodSKU').addEventListener('input', () => {
      $('#prodSKU').removeAttribute('aria-invalid');
      $('#skuErrorMsg').style.display = 'none';
      generateCombinations();
    });

    $('#prodPrice').addEventListener('input', () => {
      generateCombinations();
    });

    // Dynamically update the base price input to the minimum combo price on table edit
    const combosTableBody = $('#combinationsTableBody');
    if (combosTableBody) {
      combosTableBody.addEventListener('input', (e) => {
        if (e.target.dataset.field === 'price') {
          const prices = Array.from(document.querySelectorAll('#combinationsTableBody tr [data-field="price"]'))
            .map(input => parsePrice(input.value))
            .filter(p => !isNaN(p));
          if (prices.length > 0) {
            const minPrice = Math.min(...prices);
            $('#prodPrice').value = formatPriceField(minPrice);
          }
        }
      });

      combosTableBody.addEventListener('focusin', (e) => {
        if (e.target.dataset.field === 'price') {
          e.target.value = stripPriceField(e.target.value);
        }
      });
      combosTableBody.addEventListener('focusout', (e) => {
        if (e.target.dataset.field === 'price') {
          e.target.value = formatPriceField(e.target.value);
        }
      });
    }

    const prodPriceInput = $('#prodPrice');
    if (prodPriceInput) {
      prodPriceInput.addEventListener('focus', (e) => {
        e.target.value = stripPriceField(e.target.value);
      });
      prodPriceInput.addEventListener('blur', (e) => {
        e.target.value = formatPriceField(e.target.value);
      });
    }

    const prodCogsInput = $('#prodCogs');
    if (prodCogsInput) {
      prodCogsInput.addEventListener('focus', (e) => {
        e.target.value = stripPriceField(e.target.value);
      });
      prodCogsInput.addEventListener('blur', (e) => {
        e.target.value = formatPriceField(e.target.value);
      });
    }

    $('#createProductForm').addEventListener('submit', (e) => {
      e.preventDefault();

      const nameVal = $('#prodName').value.trim();
      const skuVal = $('#prodSKU').value.trim();
      const catVal = $('#prodCategory').value;
      const priceVal = parsePrice($('#prodPrice').value);
      const cogsVal = parsePrice($('#prodCogs').value);
      const loyaltyVal = parseInt($('#prodLoyalty').value);
      const descVal = $('#prodDescription').value.trim();

      // Clear previous validation
      $('#skuErrorMsg').style.display = 'none';
      $('#prodPrice').removeAttribute('aria-invalid');
      $('#prodCogs').removeAttribute('aria-invalid');
      $('#prodLoyalty').removeAttribute('aria-invalid');

      if (priceVal < 0) {
        $('#prodPrice').setAttribute('aria-invalid', 'true');
        $('#prodPrice').focus();
        return;
      }
      if (cogsVal < 0) {
        $('#prodCogs').setAttribute('aria-invalid', 'true');
        $('#prodCogs').focus();
        return;
      }

      // 1. Validate unique SKU (only if SKU is provided)
      if (skuVal) {
        const editId = new URLSearchParams(window.location.search).get('id');
        const skuExists = PRODUCTS.some(p => p.sku && p.sku.trim().toUpperCase() === skuVal.toUpperCase() && p.id !== editId);
        if (skuExists) {
          $('#skuErrorMsg').innerHTML = `<span aria-hidden="true">❌</span> SKU "${skuVal}" is already registered.`;
          $('#skuErrorMsg').style.display = 'block';
          $('#prodSKU').setAttribute('aria-invalid', 'true');
          $('#prodSKU').classList.add('user-invalid-fallback');
          $('#prodSKU').focus();
          return;
        }
      }

      // 2. Resolve unique ID
      const maxNum = PRODUCTS.reduce((max, p) => {
        const num = parseInt(p.id.replace(/\D/g, ''));
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = 'p' + (maxNum + 1);

      // Auto-generate product SKU if empty
      const finalSKU = skuVal || `SKU-${nameVal.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${newId.toUpperCase()}`;

      // 3. Collect variant groups
      const finalVariants = variantGroups.map(group => {
        return {
          name: group.name.trim(),
          required: group.required,
          options: group.options
            .filter(o => o.label.trim() !== '')
            .map(o => ({ label: o.label.trim(), delta: o.delta }))
        };
      }).filter(group => group.name !== '' && group.options.length > 0);

      // 4. Assemble stock values based on whether combinations are present
      let stockVal = 0;
      let stocksMap = {};
      let combinations = [];

      if (finalVariants.length > 0) {
        let totalS1 = 0, totalS2 = 0, totalS3 = 0, totalS4 = 0;

        $$('#combinationsTableBody tr').forEach(tr => {
          const comboKey = tr.dataset.comboKey;
          const attributes = JSON.parse(tr.dataset.attributes);
          let sku = tr.querySelector('[data-field="sku"]').value.trim();
          const price = parsePrice(tr.querySelector('[data-field="price"]').value) || 0;
          const s1 = parseInt(tr.querySelector('[data-field="s1"]').value) || 0;
          const s2 = parseInt(tr.querySelector('[data-field="s2"]').value) || 0;
          const s3 = parseInt(tr.querySelector('[data-field="s3"]').value) || 0;
          const s4 = parseInt(tr.querySelector('[data-field="s4"]').value) || 0;

          // Propagate generated product SKU to combination rows if no product SKU was provided
          if (!skuVal) {
            if (sku.startsWith('SKU-')) {
              sku = finalSKU + sku.slice(3);
            } else if (sku === 'SKU') {
              sku = finalSKU;
            }
          }

          totalS1 += s1;
          totalS2 += s2;
          totalS3 += s3;
          totalS4 += s4;

          combinations.push({
            name: tr.querySelector('td').textContent.trim(),
            sku,
            price,
            stock: s4,
            stocks: {
              'Store #01': s1,
              'Store #02': s2,
              'Store #03': s3,
              'Store #04': s4
            },
            attributes
          });
        });

        stockVal = totalS4;
        stocksMap = {
          'Store #01': totalS1,
          'Store #02': totalS2,
          'Store #03': totalS3,
          'Store #04': totalS4
        };
      } else {
        const stock1 = parseInt($('#stockS1').value) || 0;
        const stock2 = parseInt($('#stockS2').value) || 0;
        const stock3 = parseInt($('#stockS3').value) || 0;
        const stock4 = parseInt($('#stockS4').value) || 0;

        stockVal = stock4;
        stocksMap = {
          'Store #01': stock1,
          'Store #02': stock2,
          'Store #03': stock3,
          'Store #04': stock4
        };
      }

      // 5. Construct product
      let finalBasePrice = priceVal;
      if (combinations.length > 0) {
        const prices = combinations.map(c => c.price);
        finalBasePrice = Math.min(...prices);
      }
      if (isNaN(finalBasePrice)) {
        finalBasePrice = 0;
      }

      // Auto-generate loyalty points if left blank
      const finalLoyaltyVal = isNaN(loyaltyVal) ? Math.round(finalBasePrice * 2) : loyaltyVal;

      const editId = new URLSearchParams(window.location.search).get('id');

      if (editId) {
        const prodIndex = PRODUCTS.findIndex(p => p.id === editId);
        if (prodIndex !== -1) {
          const existing = PRODUCTS[prodIndex];
          const updatedProduct = {
            ...existing,
            name: nameVal,
            image: uploadedImageBase64,
            cat: catVal,
            basePrice: finalBasePrice,
            cogs: cogsVal,
            stock: stockVal,
            stocks: stocksMap,
            sku: finalSKU,
            loyaltyPoints: finalLoyaltyVal,
            description: descVal || `${nameVal} - Delicious choice from our menu.`,
            variants: finalVariants,
            combinations: combinations.length > 0 ? combinations : undefined
          };
          PRODUCTS[prodIndex] = updatedProduct;
          window.saveProducts(PRODUCTS);
          showToast(`Product "${nameVal}" updated successfully!`);
        } else {
          showToast("Error: Product not found.");
          return;
        }
      } else {
        const newProduct = {
          id: newId,
          name: nameVal,
          emoji: null,
          image: uploadedImageBase64,
          cat: catVal,
          basePrice: finalBasePrice,
          cogs: cogsVal,
          popularity: 1,
          stock: stockVal,
          stocks: stocksMap,
          sku: finalSKU,
          loyaltyPoints: finalLoyaltyVal,
          description: descVal || `${nameVal} - Delicious choice from our menu.`,
          variants: finalVariants,
          combinations: combinations.length > 0 ? combinations : undefined,
          createdAt: Date.now()
        };

        // 6. Save product
        PRODUCTS.push(newProduct);
        window.saveProducts(PRODUCTS);
        showToast(`Product "${nameVal}" created successfully!`);
      }

      // Redirect back to inventory after a short delay
      setTimeout(() => {
        window.location.href = 'inventory.html';
      }, 1000);
    });
  }

  // ============ Toast Alert Helper ============
  let toastTimer;
  function showToast(msg) {
    const toast = $('#invToast');
    const toastMsg = $('#invToastMsg');
    
    toastMsg.textContent = msg;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ============ Initialize ============
  function init() {
    setupNavigation();
    populateCategories();
    setupCategoryCreator();
    setupImageUploader();

    // Check for edit mode
    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
      const editingProduct = PRODUCTS.find(p => p.id === editId);
      if (editingProduct) {
        // Update page text
        document.title = `Edit Product · Bluepoint POS`;
        const headerTitle = $('.main-head h1');
        if (headerTitle) {
          const badge = headerTitle.querySelector('.role-badge');
          headerTitle.innerHTML = `Edit Product `;
          if (badge) headerTitle.appendChild(badge);
        }
        const headerSub = $('.main-head .sub');
        if (headerSub) {
          headerSub.textContent = `Modify product details, variants, and stock counts.`;
        }
        const btnSave = $('#btnCreateProductSave');
        if (btnSave) {
          btnSave.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
            Save Changes
          `;
        }

        // Prefill form values
        $('#prodName').value = editingProduct.name || '';
        $('#prodSKU').value = editingProduct.sku || '';
        $('#prodCategory').value = editingProduct.cat || '';
        $('#prodPrice').value = editingProduct.basePrice !== undefined ? formatPriceField(editingProduct.basePrice) : '';
        $('#prodCogs').value = editingProduct.cogs !== undefined && editingProduct.cogs !== null ? formatPriceField(editingProduct.cogs) : '';
        $('#prodLoyalty').value = editingProduct.loyaltyPoints !== undefined ? editingProduct.loyaltyPoints : '';
        $('#prodDescription').value = editingProduct.description || '';

        // Prefill image
        if (editingProduct.image) {
          uploadedImageBase64 = editingProduct.image;
          $('#uploadPreviewImg').src = uploadedImageBase64;
          $('#uploadPlaceholder').style.display = 'none';
          $('#uploadPreviewWrapper').style.display = 'block';
        }

        // Prefill base stocks (if no variants)
        $('#stockS1').value = editingProduct.stocks?.['Store #01'] ?? 0;
        $('#stockS2').value = editingProduct.stocks?.['Store #02'] ?? 0;
        $('#stockS3').value = editingProduct.stocks?.['Store #03'] ?? 0;
        $('#stockS4').value = editingProduct.stocks?.['Store #04'] ?? editingProduct.stock ?? 0;

        // Reconstruct variant groups and combinations cache
        if (editingProduct.variants && editingProduct.variants.length > 0) {
          variantGroups = editingProduct.variants.map(vg => {
            return {
              id: nextGroupId++,
              name: vg.name,
              required: vg.required,
              options: (vg.options || []).map(opt => ({ label: opt.label, delta: opt.delta || 0 }))
            };
          });

          if (editingProduct.combinations && editingProduct.combinations.length > 0) {
            initialCombinationsCache = {};
            editingProduct.combinations.forEach(c => {
              const keyParts = editingProduct.variants.map(v => {
                const optVal = c.attributes[v.name];
                return `${v.name}:${optVal}`;
              });
              const key = keyParts.join('|');
              initialCombinationsCache[key] = {
                sku: c.sku || '',
                price: c.price !== undefined ? formatPriceField(c.price) : '',
                s1: c.stocks?.['Store #01'] ?? 0,
                s2: c.stocks?.['Store #02'] ?? 0,
                s3: c.stocks?.['Store #03'] ?? 0,
                s4: c.stocks?.['Store #04'] ?? c.stock ?? 0
              };
            });
          }
        }
      }
    }

    renderVariantGroups();

    $('#btnAddVariantGroup').addEventListener('click', () => {
      variantGroups.push({
        id: nextGroupId++,
        name: '',
        required: true,
        options: [{ label: '', delta: 0 }]
      });
      renderVariantGroups();
    });

    setupFormHandler();
  }

  // Load app on window loaded
  window.addEventListener('DOMContentLoaded', init);
})();

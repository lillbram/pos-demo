// ============================================================
// Hold Order Library — window.HoldOrderLib
// Shared across order.html and held-orders-dashboard.html
// Storage key: pos_held_orders (array of hold objects)
// ============================================================

(function () {
  const STORAGE_KEY = 'pos_held_orders';
  const ABANDON_HOURS = 24;

  // ── Utilities ────────────────────────────────────────────

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function generateCode(existingCodes) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 confusion
    let code;
    let tries = 0;
    do {
      code = '';
      const seed = Date.now() + Math.random() * 1e9;
      for (let i = 0; i < 6; i++) {
        const idx = Math.floor((seed * (i + 1) * 9301 + 49297) % chars.length);
        code += chars[Math.abs(idx) % chars.length];
      }
      tries++;
    } while (existingCodes.has(code) && tries < 100);
    return code;
  }

  // ── Cleanup ──────────────────────────────────────────────

  function runAbandonedCleanup() {
    const now = Date.now();
    const cutoff = ABANDON_HOURS * 60 * 60 * 1000;
    const list = loadAll();
    let changed = false;
    list.forEach(h => {
      if (h.status === 'active' && now - new Date(h.heldAt).getTime() > cutoff) {
        h.status = 'abandoned';
        changed = true;
      }
    });
    if (changed) saveAll(list);
    return list;
  }

  // ── CRUD ─────────────────────────────────────────────────

  function saveHold(holdData) {
    runAbandonedCleanup();
    const list = loadAll();
    const existingCodes = new Set(list.map(h => h.holdCode));
    const code = generateCode(existingCodes);
    const record = {
      holdCode: code,
      ...holdData,
      heldAt: new Date().toISOString(),
      status: 'active',
    };
    list.unshift(record);
    saveAll(list);
    return record;
  }

  function getAllHolds() {
    return runAbandonedCleanup();
  }

  function getActiveHolds() {
    return getAllHolds().filter(h => h.status === 'active');
  }

  function findByCode(code) {
    return getAllHolds().find(h => h.holdCode === code.toUpperCase().trim());
  }

  function findByCustomer(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return getActiveHolds().filter(h => {
      if (!h.customer) return false;
      const normPhone = (h.customer.phone || '').replace(/\D/g, '');
      const normQ = q.replace(/\D/g, '');
      return (
        h.customer.name.toLowerCase().includes(q) ||
        (normQ.length >= 4 && normPhone.includes(normQ))
      );
    });
  }

  function updateStatus(code, status) {
    const list = loadAll();
    const idx = list.findIndex(h => h.holdCode === code.toUpperCase().trim());
    if (idx === -1) return false;
    list[idx].status = status;
    list[idx].updatedAt = new Date().toISOString();
    saveAll(list);
    return true;
  }

  function completeHold(code) { return updateStatus(code, 'completed'); }
  function abandonHold(code)  { return updateStatus(code, 'abandoned'); }

  function deleteHold(code) {
    const list = loadAll().filter(h => h.holdCode !== code.toUpperCase().trim());
    saveAll(list);
  }

  // ── Helpers ───────────────────────────────────────────────

  function holdDuration(heldAt) {
    const ms = Date.now() - new Date(heldAt).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return h + 'h ' + rem + 'm';
  }

  const REASON_LABELS = {
    customer_adding: 'Customer adding items',
    break:           'Staff break',
    backorder:       'Back-order',
    queue:           'Queue management',
    other:           'Other',
  };

  function reasonLabel(key) {
    return REASON_LABELS[key] || key;
  }

  // ── Public API ────────────────────────────────────────────

  window.HoldOrderLib = {
    saveHold,
    getAllHolds,
    getActiveHolds,
    findByCode,
    findByCustomer,
    completeHold,
    abandonHold,
    deleteHold,
    holdDuration,
    reasonLabel,
    REASON_LABELS,
    runAbandonedCleanup,
  };
})();

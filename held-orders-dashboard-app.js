// ============================================================
// Held Orders Dashboard — App Logic
// ============================================================
(() => {
  const lib = window.HoldOrderLib;
  if (!lib) { console.error('HoldOrderLib not loaded'); return; }

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  const fmtAmt = n => 'Rp\u00a0' + Math.round(n || 0).toLocaleString('en-US');
  const fmtDate = iso => {
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // ── Toast ────────────────────────────────────────────────
  let _toastTimer;
  function flash(msg, isErr = false) {
    const t = $('#toast');
    const m = $('#toastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.style.background = isErr ? 'var(--danger-700)' : 'var(--gray-900)';
    t.style.display = 'flex';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
  }

  // ── Sidebar user ─────────────────────────────────────────
  function initSidebarUser() {
    const user = JSON.parse(localStorage.getItem('pos_current_user')) || { name: 'Admin', role: 'Super Admin' };
    const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
    const el = $('#sideAvatar'); if (el) el.textContent = initials;
    const nameEl = $('#sideName'); if (nameEl) nameEl.textContent = user.name;
    const roleEl = $('#sideRole'); if (roleEl) roleEl.textContent = user.role || 'Admin';
  }

  // ── Metrics ──────────────────────────────────────────────
  function renderMetrics(all) {
    const active    = all.filter(h => h.status === 'active');
    const completed = all.filter(h => h.status === 'completed');
    const abandoned = all.filter(h => h.status === 'abandoned');

    // Average hold duration (active, in minutes)
    let avgMin = 0;
    if (active.length) {
      const totalMs = active.reduce((s, h) => s + (Date.now() - new Date(h.heldAt).getTime()), 0);
      avgMin = Math.round(totalMs / active.length / 60000);
    }
    const avgStr = avgMin < 60 ? avgMin + ' min' : Math.floor(avgMin / 60) + 'h ' + (avgMin % 60) + 'm';

    // Abandonment rate
    const total = all.length;
    const abandonRate = total ? Math.round((abandoned.length / total) * 100) : 0;

    const row = $('#metricsRow');
    if (!row) return;
    row.innerHTML = `
      <div class="metric-box accent">
        <div class="lbl">Active holds</div>
        <div class="val">${active.length}</div>
        <div class="sub">Currently waiting</div>
      </div>
      <div class="metric-box">
        <div class="lbl">Avg hold duration</div>
        <div class="val">${active.length ? avgStr : '—'}</div>
        <div class="sub">Across active orders</div>
      </div>
      <div class="metric-box">
        <div class="lbl">Completed today</div>
        <div class="val">${countToday(completed)}</div>
        <div class="sub">Retrieved &amp; checked out</div>
      </div>
      <div class="metric-box">
        <div class="lbl">Abandon rate</div>
        <div class="val">${abandonRate}%</div>
        <div class="sub">${abandoned.length} of ${total} total</div>
      </div>
    `;
  }

  function countToday(list) {
    const todayStr = new Date().toISOString().slice(0, 10);
    return list.filter(h => (h.updatedAt || h.heldAt || '').slice(0, 10) === todayStr).length;
  }

  // ── Store filter options ──────────────────────────────────
  function populateStoreFilter(all) {
    const stores = [...new Set(all.map(h => h.store).filter(Boolean))].sort();
    const sel = $('#filterStore');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All stores</option>';
    stores.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      if (s === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Table ────────────────────────────────────────────────
  function renderTable(all) {
    const statusFilter = ($('#filterStatus') || {}).value || 'active';
    const reasonFilter = ($('#filterReason') || {}).value || '';
    const storeFilter  = ($('#filterStore')  || {}).value || '';

    let list = all;
    if (statusFilter !== 'all')  list = list.filter(h => h.status === statusFilter);
    if (reasonFilter)            list = list.filter(h => h.reason === reasonFilter);
    if (storeFilter)             list = list.filter(h => h.store  === storeFilter);

    // Sort: active first, then by newest
    list.sort((a, b) => {
      const order = { active: 0, completed: 1, abandoned: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(b.heldAt) - new Date(a.heldAt);
    });

    const countEl = $('#filterCount');
    if (countEl) countEl.textContent = `${list.length} order${list.length !== 1 ? 's' : ''}`;

    const tbody = $('#holdsBody');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `
        <tr><td colspan="10">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <h3>No held orders</h3>
            <p>No orders match the selected filters.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    list.forEach(h => {
      const itemCount = h.cart ? h.cart.reduce((s, l) => s + l.qty, 0) : 0;
      const customerName = h.customer ? h.customer.name : 'Walk-in';
      const duration = lib.holdDuration(h.heldAt);
      const grand = h.totals ? h.totals.grand : 0;

      const statusBadge = {
        active:    `<span class="status-badge active"><span style="width:6px;height:6px;border-radius:50%;background:var(--brand-500);display:inline-block;"></span>Active</span>`,
        completed: `<span class="status-badge completed">✓ Completed</span>`,
        abandoned: `<span class="status-badge abandoned">✕ Abandoned</span>`,
      }[h.status] || `<span class="status-badge">${h.status}</span>`;

      const actions = h.status === 'active' ? `
        <div class="action-group">
          <button class="action-btn load" data-action="load" data-code="${h.holdCode}" title="Open in Order screen">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            Load
          </button>
          <button class="action-btn done" data-action="complete" data-code="${h.holdCode}" title="Mark as completed">
            ✓ Complete
          </button>
          <button class="action-btn abandon" data-action="abandon" data-code="${h.holdCode}" title="Mark as abandoned">
            ✕
          </button>
        </div>` : `<span style="font-size:11px;color:var(--gray-400);">${fmtDate(h.updatedAt || h.heldAt)}</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="hold-code-cell">${h.holdCode}</span></td>
        <td>
          <div style="font-weight:600;color:var(--gray-900);">${customerName}</div>
          ${h.customer && h.customer.phone ? `<div style="font-size:11px;color:var(--gray-500);">${h.customer.phone}</div>` : ''}
        </td>
        <td>${itemCount}</td>
        <td style="font-weight:600;font-variant-numeric:tabular-nums;">${fmtAmt(grand)}</td>
        <td><span class="reason-pill">${lib.reasonLabel(h.reason)}</span></td>
        <td style="font-variant-numeric:tabular-nums;">${duration}</td>
        <td>${h.staffName || '—'}</td>
        <td>${h.store || '—'}</td>
        <td>${statusBadge}</td>
        <td>${actions}</td>
      `;

      // Wire action buttons
      tr.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const code   = btn.dataset.code;
          const action = btn.dataset.action;
          if (action === 'load') {
            // Navigate to order.html and pass code via sessionStorage
            sessionStorage.setItem('pos_retrieve_code', code);
            window.location.href = 'order.html';
          } else if (action === 'complete') {
            if (confirm(`Mark hold ${code} as completed?`)) {
              lib.completeHold(code);
              flash(`Hold ${code} marked as completed`);
              renderAll();
            }
          } else if (action === 'abandon') {
            if (confirm(`Mark hold ${code} as abandoned?`)) {
              lib.abandonHold(code);
              flash(`Hold ${code} marked as abandoned`);
              renderAll();
            }
          }
        });
      });

      tbody.appendChild(tr);
    });
  }

  // ── Full render ───────────────────────────────────────────
  function renderAll() {
    const all = lib.getAllHolds();
    renderMetrics(all);
    populateStoreFilter(all);
    renderTable(all);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const subEl = $('#dashSub');
    if (subEl) subEl.textContent = `Last updated ${timeStr} · Admin view`;
  }

  // ── Event listeners ───────────────────────────────────────
  ['filterStatus', 'filterReason', 'filterStore'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('change', () => renderTable(lib.getAllHolds()));
  });

  const refreshBtn = $('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('svg');
      if (icon) icon.style.animation = 'spin 0.7s linear infinite';
      setTimeout(() => {
        renderAll();
        if (icon) icon.style.animation = '';
        flash('Dashboard refreshed');
      }, 400);
    });
  }

  const abandonAllBtn = $('#abandonAllBtn');
  if (abandonAllBtn) {
    abandonAllBtn.addEventListener('click', () => {
      lib.runAbandonedCleanup();
      flash('24h cleanup completed');
      renderAll();
    });
  }

  // ── Auto-refresh every 30s ────────────────────────────────
  setInterval(renderAll, 30000);

  // ── Check if coming from dashboard "Load" action ─────────
  // (handled in order-app.js via sessionStorage)

  // ── Init ─────────────────────────────────────────────────
  initSidebarUser();
  renderAll();
})();

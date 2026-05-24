// ============================================================
// demo-auto-reset.js — Auto seeds fresh demo data on load
// Called by demo-index.html before redirecting to the app
// ============================================================

(function demoAutoReset() {
  // Mark as demo mode so other pages can detect it
  localStorage.setItem('pos_demo_mode', 'true');

  // Wipe all existing data and re-trigger the seed sequence
  // by clearing the seed version flag — order-data.js will re-seed on next load
  const keysToKeep = []; // nothing kept — full fresh seed
  localStorage.clear();

  // Restore demo mode flag after clear
  localStorage.setItem('pos_demo_mode', 'true');

  // Set a fresh demo user
  localStorage.setItem('pos_current_user', JSON.stringify({
    name: 'Demo User',
    role: 'Super Admin',
    email: 'demo@bluepoint.id',
    store: 'Store #01',
    phone: '+62 812-0000-0001'
  }));

  // Done — caller (demo-index.html) will redirect
})();

/* Top bar on the inner pages (PasaMatch, Profile, Messages): the three-line menu, its logged-in / logged-out items,
   Log out, and the profile photo on pages without the chats dock. Load last. The home page runs its own copy in index.html. */
(function () {
  // Log-in lives on the home page; ?next= sends the visitor back to the page they came from
  function loginUrl(next) {
    return 'index.html?login=1&next=' + encodeURIComponent(next || (location.pathname.split('/').pop() || 'index.html') + location.search);
  }
  window.UCLoginUrl = loginUrl;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="index.html?login=1"]');
    if (a) a.href = loginUrl();
  }, true);

  var btn = document.getElementById('menu-btn'), menu = document.getElementById('mnav');
  if (!btn || !menu) return;
  function setMenu(open) { menu.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  btn.addEventListener('click', function () {
    setMenu(menu.hidden);
    if (!menu.hidden) menu.querySelector('a:not([hidden]), button:not([hidden])').focus();
  });
  menu.addEventListener('click', function (e) { if (e.target.closest('a, button')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); btn.focus(); } });
  document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#mnav, #menu-btn')) setMenu(false); });

  var cfg = window.UC_CONFIG;
  if (!cfg || !window.supabase) return;
  var db = window.supabase.createClient(cfg.url, cfg.key);
  var navMe = window.UCChats ? null : document.getElementById('nav-me');  // messenger.js fills it where the dock is loaded

  function initials(n) { return (n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function show(u) {
    menu.querySelectorAll('[data-auth]').forEach(function (el) { el.hidden = !u; });
    menu.querySelectorAll('[data-guest]').forEach(function (el) { el.hidden = !!u; });
    if (!navMe) return;
    navMe.hidden = false;
    navMe.href = u ? 'profile.html' : 'index.html?login=1';
    if (!u) { navMe.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; navMe.setAttribute('aria-label', 'Log in'); return; }
    db.from('profiles').select('full_name, avatar_url').eq('id', u.id).maybeSingle().then(function (r) {
      var p = r.data || {};
      if (p.avatar_url) { var img = document.createElement('img'); img.src = p.avatar_url; img.alt = ''; navMe.replaceChildren(img); }
      else navMe.textContent = initials(p.full_name);
      navMe.setAttribute('aria-label', 'Your profile' + (p.full_name ? ': ' + p.full_name : ''));
    });
  }
  db.auth.onAuthStateChange(function (ev, s) { show(s && s.user); });
  // Two-step login not finished yet: back to the home page to enter the code
  db.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
    if (r.data && r.data.nextLevel === 'aal2' && r.data.currentLevel !== 'aal2') location.replace(loginUrl());
  });

  var out = document.getElementById('logout-btn');
  if (out) out.addEventListener('click', function () { db.auth.signOut().then(function () { location.href = 'index.html'; }); });
})();

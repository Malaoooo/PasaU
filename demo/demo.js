/* PasaU judge demo. Loaded only when the tab came in through judges.html (sessionStorage "pasau-demo").
   Points every page at a pretend database that lives in this tab, so nothing reads or writes the real Supabase. */
(function () {
  var D = window.PASAU_DEMO_DATA;
  if (!D || !window.UC_CONFIG) return;
  var BASE = location.origin + location.pathname.replace(/[^/]*$/, '') + 'demo/sb';
  window.UC_CONFIG = { url: BASE, key: 'demo-key' };
  var KEY = 'sb-' + new URL(BASE).hostname.split('.')[0] + '-auth-token';
  var ME = D.ids.ME, MARIA = D.ids.MARIA;
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  var page = (location.pathname.split('/').pop() || 'index.html');

  // ---------- state that survives page changes in this tab ----------
  var tables = D.tables, rpcs = D.rpcs;
  try { var saved = JSON.parse(ss.get('pasau-demo-db') || 'null'); if (saved) tables = saved; } catch (e) {}
  tables.public_profiles = tables.profiles;
  function persist() { var copy = {}; for (var k in tables) if (k !== 'public_profiles') copy[k] = tables[k]; ss.set('pasau-demo-db', JSON.stringify(copy)); }
  var me0 = tables.profiles.filter(function (p) { return p.id === ME; })[0];
  if (me0) me0.is_admin = page === 'admin.html';

  // Who the judge is right now: "visitor" (logged out), "student" (Andrea) or "parent" (Maria)
  var persona = ss.get('pasau-demo-as') || 'student';
  function setPersona(p) { persona = p; ss.set('pasau-demo-as', p); }
  function b64u(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function nowS() { return Math.floor(Date.now() / 1000); }
  function userObj() {
    var p = tables.profiles.filter(function (x) { return x.id === (persona === 'parent' ? MARIA : ME); })[0];
    return { id: p.id, aud: 'authenticated', role: 'authenticated', email: p.email, email_confirmed_at: p.created_at, created_at: p.created_at,
      user_metadata: { full_name: p.full_name, school: p.school, course: p.course, year_level: p.year_level, role: persona === 'parent' ? 'guardian' : undefined },
      app_metadata: { provider: 'email' }, factors: ss.get('pasau-demo-2fa') ? [{ id: 'f1', friendly_name: 'PasaU', factor_type: 'totp', status: 'verified', created_at: p.created_at, updated_at: p.created_at }] : [] };
  }
  function session() {
    var u = userObj(), aal = ss.get('pasau-demo-2fa') ? 'aal2' : 'aal1';
    var tok = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ sub: u.id, role: 'authenticated', aal: aal, amr: [{ method: 'password', timestamp: nowS() }], exp: nowS() + 86400, session_id: 'demo' }) + '.demo';
    return { access_token: tok, refresh_token: 'demo', token_type: 'bearer', expires_in: 86400, expires_at: nowS() + 86400, user: u };
  }
  function syncSession() {
    try {
      if (persona === 'visitor') return localStorage.removeItem(KEY);
      var cur = JSON.parse(localStorage.getItem(KEY) || 'null');
      var want = persona === 'parent' ? MARIA : ME;
      if (!cur || !cur.user || cur.user.id !== want || cur.expires_at < nowS() + 600) localStorage.setItem(KEY, JSON.stringify(session()));
    } catch (e) {}
  }
  syncSession();

  // ---------- a tiny PostgREST ----------
  var RESERVED = { select: 1, order: 1, limit: 1, offset: 1, on_conflict: 1, columns: 1, or: 1, and: 1 };
  function match(row, key, expr) {
    var m = /^(not\.)?(eq|neq|in|is|gt|gte|lt|lte|ilike|like)\.(.*)$/.exec(expr);
    if (!m) return true;
    var v = row[key], op = m[2], raw = m[3], ok;
    if (op === 'eq') ok = String(v) === raw;
    else if (op === 'neq') ok = String(v) !== raw;
    else if (op === 'in') ok = raw.replace(/^\(|\)$/g, '').split(',').map(function (s) { return s.replace(/^"|"$/g, ''); }).indexOf(String(v)) > -1;
    else if (op === 'is') ok = raw === 'null' ? v == null : String(v) === raw;
    else if (op === 'gt') ok = v > raw; else if (op === 'gte') ok = v >= raw; else if (op === 'lt') ok = v < raw; else if (op === 'lte') ok = v <= raw;
    else if (op === 'ilike' || op === 'like') ok = String(v || '').toLowerCase().indexOf(raw.replace(/[%*]/g, '').toLowerCase()) > -1;
    return m[1] ? !ok : ok;
  }
  function filtered(table, url) {
    var rows = (tables[table] = tables[table] || []).slice();
    url.searchParams.forEach(function (val, k) { if (!RESERVED[k] && k.indexOf('.') < 0) rows = rows.filter(function (r) { return !(k in r) || match(r, k, val); }); });
    return rows;
  }
  function query(table, url) {
    var rows = filtered(table, url);
    var order = url.searchParams.get('order');
    if (order) { var o = order.split(',')[0].split('.'), col = o[0], dir = o[1]; rows.sort(function (a, b) { return (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1); }); }
    var off = +(url.searchParams.get('offset') || 0), lim = url.searchParams.get('limit');
    return rows.slice(off, lim ? off + +lim : undefined);
  }
  function nextId(rows) { return rows.reduce(function (m, r) { return typeof r.id === 'number' && r.id > m ? r.id : m; }, 1000) + 1; }
  function write(table, method, url, body) {
    var rows = tables[table] = tables[table] || [], out = [];
    if (method === 'POST') {
      (Array.isArray(body) ? body : [body]).forEach(function (b) {
        var r = Object.assign({ id: nextId(rows), created_at: new Date().toISOString() }, b);
        if (table === 'listings') { r = Object.assign({ status: 'active', views: 0, bumped_at: r.created_at, listing_photos: [] }, r); if (!r.school) r.school = me0 && me0.school; }
        if (table === 'listing_photos') tables.listings.forEach(function (l) { if (l.id === r.listing_id) l.listing_photos.push({ path: r.path, position: r.position }); });
        if (table === 'conversations') r.listings = tables.listings.filter(function (l) { return l.id === r.listing_id; })[0];
        var dupe = r.id != null && rows.filter(function (x) { return x.id === r.id; })[0];
        if (dupe) Object.assign(dupe, r); else rows.push(r);
        out.push(r);
      });
    } else if (method === 'PATCH') {
      out = filtered(table, url); out.forEach(function (r) { Object.assign(r, body); });
    } else if (method === 'DELETE') {
      out = filtered(table, url); tables[table] = rows.filter(function (r) { return out.indexOf(r) < 0; });
      if (table === 'profiles') tables.public_profiles = tables.profiles;
    }
    persist();
    return out;
  }
  function listing(id) { return tables.listings.filter(function (l) { return l.id === +id; })[0]; }
  function rpc(name, args) {
    args = args || {};
    var l = args.p_listing && listing(args.p_listing);
    if (name === 'claim_listing' && l) { l.status = 'reserved'; l.reserved_by = ME; persist(); return { state: 'reserved', position: 0 }; }
    if (name === 'release_reservation' && l) { l.status = 'active'; l.reserved_by = null; persist(); }
    if (name === 'set_listing_status' && l && args.p_status) { l.status = args.p_status; persist(); }
    if (name === 'is_admin') return page === 'admin.html';
    if (name === 'queue_count' && args.p_listing) return tables.queue_entries.filter(function (q) { return q.listing_id === +args.p_listing; }).length;
    return name in rpcs ? rpcs[name] : null;
  }

  // ---------- photos the judge adds (kept small, in this tab only) ----------
  var imgs = {};
  try { imgs = JSON.parse(ss.get('pasau-demo-img') || '{}'); } catch (e) {}
  function keepPhoto(path, blob) {
    return new Promise(function (res) {
      if (!blob || !/^image\//.test(blob.type || '')) return res();
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 640 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        imgs[path.split('/').pop()] = c.toDataURL('image/jpeg', 0.8);
        ss.set('pasau-demo-img', JSON.stringify(imgs)); res();
      };
      im.onerror = function () { res(); };
      im.src = u;
    });
  }
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.src.indexOf('/demo/sb/storage/') > -1) { var d = imgs[decodeURIComponent(t.src.split('/').pop())]; if (d) t.src = d; }
  }, true);

  // ---------- fetch: every database call is answered here ----------
  var realFetch = window.fetch.bind(window);
  function reply(body, status, headers) {
    return Promise.resolve(new Response(body === undefined || status === 204 ? null : JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, headers || {}) }));
  }
  function handle(href, init) {
    var url = new URL(href), method = (init.method || 'GET').toUpperCase();
    var hd = new Headers(init.headers || {}), p = url.pathname.slice(url.pathname.indexOf('/demo/sb') + 8);
    var body = init.body;
    function json() { try { return typeof body === 'string' ? JSON.parse(body || '{}') : {}; } catch (e) { return {}; } }
    if (p.indexOf('/storage/v1/object/') === 0) {
      var path = decodeURIComponent(p.replace(/^\/storage\/v1\/object\/(public\/)?[^/]+\//, ''));
      var blob = body instanceof Blob ? body : body instanceof FormData ? (function () { var f = null; body.forEach(function (v) { if (v instanceof Blob) f = v; }); return f; })() : null;
      return keepPhoto(path, blob).then(function () { return reply({ Key: path, Id: path }); });
    }
    if (p.indexOf('/auth/v1/') === 0) {
      var ep = p.slice(9);
      if (ep === 'user') return persona === 'visitor' ? reply({ msg: 'no session' }, 401) : reply(userObj());
      if (ep === 'logout') { setPersona('visitor'); return reply(undefined, 204); }
      if (ep === 'signup') { var b = json(); return reply({ id: 'demo-new', email: b.email, aud: 'authenticated', role: '', identities: [{ id: 'x' }], user_metadata: b.data || {}, created_at: new Date().toISOString(), confirmation_sent_at: new Date().toISOString() }); }
      if (ep === 'otp' || ep === 'recover' || ep === 'resend') return reply({});
      if (ep === 'verify' || ep.indexOf('token') === 0) {
        if (url.searchParams.get('grant_type') === 'refresh_token' && persona === 'visitor') return reply({ error: 'invalid_grant', error_description: 'Signed out' }, 400);
        if (persona === 'visitor') setPersona(page === 'family.html' ? 'parent' : 'student');
        return reply(session());
      }
      if (/^factors\/[^/]+\/challenge/.test(ep)) return reply({ id: 'c1', type: 'totp', expires_at: nowS() + 300 });
      if (/^factors\/[^/]+\/verify/.test(ep)) { ss.set('pasau-demo-2fa', '1'); return reply(session()); }
      if (/^factors\/[^/]+$/.test(ep) && method === 'DELETE') { try { sessionStorage.removeItem('pasau-demo-2fa'); } catch (e) {} return reply({ id: 'f1' }); }
      if (ep.indexOf('factors') === 0) return reply({ id: 'f2', type: 'totp', friendly_name: 'PasaU', totp: { qr_code: D.qr, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/PasaU:andrea.santos@slu.edu.ph?secret=JBSWY3DPEHPK3PXP&issuer=PasaU' } });
      return reply({});
    }
    if (p.indexOf('/rest/v1/rpc/') === 0) return reply(rpc(p.slice(13), json()));
    if (p.indexOf('/rest/v1/') === 0) {
      var table = p.slice(9), single = (hd.get('accept') || '').indexOf('vnd.pgrst.object') > -1;
      if (method === 'GET' || method === 'HEAD') {
        var all = query(table, new URL(url.href.replace(/[?&](limit|offset)=[^&]*/g, ''))), rows = query(table, url);
        var range = { 'content-range': rows.length ? '0-' + (rows.length - 1) + '/' + all.length : '*/' + all.length };
        if (method === 'HEAD') return reply(undefined, 200, range);
        if (single) return rows.length ? reply(rows[0], 200, range) : reply({ code: 'PGRST116', message: 'no rows' }, 406);
        return reply(rows, 200, range);
      }
      var out = write(table, method, url, json());
      if (single) return reply(out[0] || null, out.length ? 200 : 406);
      return reply(out, method === 'POST' ? 201 : 200);
    }
    if (p.indexOf('/functions/v1/') === 0) return reply({});
    return reply({}, 404);
  }
  window.fetch = function (input, init) {
    var href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (href.indexOf('/demo/sb/') > -1 && href.indexOf('/storage/v1/object/public/') < 0) return handle(href, init || {});
    if (/supabase\.co\//.test(href)) return reply({ message: 'Demo mode: the real database is switched off' }, 503);
    return realFetch(input, init);
  };

  // Live updates go nowhere in the demo
  var RealWS = window.WebSocket;
  window.WebSocket = function (u, pr) {
    if (String(u).indexOf('/demo/sb/') < 0 && !/supabase\.co/.test(String(u))) return new RealWS(u, pr);
    return { readyState: 0, url: String(u), send: function () {}, close: function () { this.readyState = 3; }, addEventListener: function () {}, removeEventListener: function () {} };
  };
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k, i) { window.WebSocket[k] = i; });

  window.PasaUDemo = {
    setPersona: function (p) { setPersona(p); syncSession(); },
    persona: function () { return persona; },
    page: page
  };
})();

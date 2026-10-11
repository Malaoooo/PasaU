/* PasaU admin dashboard. Every write goes through admin_* database functions that check is_admin. */
(function () {
  var db = window.supabase.createClient(window.UC_CONFIG.url, window.UC_CONFIG.key);
  var h = UI.h, toast = UI.toast, peso = UI.peso, day = UI.day, errText = UI.errText;
  var who = document.getElementById('admin-who'), tabsEl = document.getElementById('tabs'), panel = document.getElementById('panel');
  var current = 'overview';

  function rpc(name, args) { return db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function names(ids) {
    ids = ids.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    if (!ids.length) return Promise.resolve({});
    return db.from('profiles').select('id, full_name, school, verified, suspended').in('id', ids).then(function (r) {
      var m = {};
      (r.data || []).forEach(function (p) { m[p.id] = p; });
      return m;
    });
  }
  function nm(map, id) { return (map[id] && map[id].full_name) || 'Unknown'; }
  function table(head, rows) {
    return h('div', { class: 'a-scroll' }, [h('table', { class: 'a-table' }, [
      h('thead', {}, [h('tr', {}, head.map(function (t) { return h('th', { scope: 'col', text: t }); }))]),
      h('tbody', {}, rows.length ? rows : [h('tr', {}, [h('td', { colSpan: head.length, class: 'muted', text: 'Nothing here.' })])])
    ])]);
  }
  function td(x) { return h('td', {}, [x == null ? '' : x]); }

  db.auth.getSession().then(function (r) {
    var me = r.data.session && r.data.session.user;
    if (!me) { who.textContent = 'Log in with an admin account.'; panel.replaceChildren(h('a', { class: 'pill', href: 'index.html?login=1', text: 'Log in' })); return; }
    db.from('profiles').select('is_admin, full_name').eq('id', me.id).maybeSingle().then(function (p) {
      if (!p.data || !p.data.is_admin) {
        who.textContent = 'This account isn’t an admin.';
        panel.replaceChildren(UI.empty('No access.', 'Ask the PasaU owner to make your account an admin (see the bottom of db/phases2-4.sql).'));
        return;
      }
      who.textContent = 'Signed in as ' + p.data.full_name;
      tabsEl.hidden = false;
      var tabs = [['overview', 'Overview'], ['reports', 'Reports'], ['verify', 'Verification'], ['users', 'Users'], ['listings', 'Listings'], ['tx', 'Transactions']];
      tabsEl.replaceChildren.apply(tabsEl, tabs.map(function (t) {
        return h('button', { type: 'button', role: 'tab', id: 'tab-' + t[0], text: t[1], onclick: function () { show(t[0]); } });
      }));
      show('overview');
    });
  });

  function show(name) {
    current = name;
    [].forEach.call(tabsEl.children, function (b) { b.setAttribute('aria-selected', b.id === 'tab-' + name ? 'true' : 'false'); });
    panel.setAttribute('aria-labelledby', 'tab-' + name);
    panel.replaceChildren(h('p', { class: 'muted', text: 'Loading…' }));
    ({ overview: overview, reports: reports, verify: verify, users: users, listings: listings, tx: transactions })[name]();
  }
  function refresh() { show(current); }

  function overview() {
    rpc('admin_stats').then(function (s) {
      var tiles = [['Students', s.users], ['Verified', s.verified], ['Available listings', s.active_listings], ['Reserved', s.reserved_listings],
        ['Sold', s.sold_listings], ['Completed handovers', s.completed_transactions], ['Cancelled', s.cancelled_transactions],
        ['Open reports', s.open_reports], ['Verification requests', s.pending_verifications], ['Messages sent', s.messages]];
      panel.replaceChildren(h('div', { class: 'a-stats' }, tiles.map(function (t) {
        return h('div', { class: 'a-stat' }, [h('b', { text: Number(t[1] || 0).toLocaleString('en-PH') }), h('span', { text: t[0] })]);
      })));
    }).catch(function (e) { panel.replaceChildren(UI.empty('Couldn’t load stats.', errText(e))); });
  }

  function reports() {
    db.from('reports').select('*, listings(id, title, status)').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      names(rows.map(function (x) { return x.reporter_id; }).concat(rows.map(function (x) { return x.reported_user_id; }))).then(function (map) {
        panel.replaceChildren(table(['When', 'Reason', 'About', 'Reported by', 'Status', 'Actions'], rows.map(function (x) {
          var about = [];
          if (x.listings) about.push(h('a', { href: 'index.html?open=' + x.listings.id, text: x.listings.title + ' (' + x.listings.status + ')' }), h('br'));
          if (x.reported_user_id) about.push(h('a', { href: 'profile.html?u=' + x.reported_user_id, text: nm(map, x.reported_user_id) }));
          var acts = h('div', { class: 'p-row' }, [
            x.listings && x.listings.status !== 'removed' ? UI.action('Remove listing', function () {
              return rpc('admin_remove_listing', { p_listing: x.listings.id, p_reason: x.reason }).then(function () { toast('Listing removed and seller notified'); refresh(); });
            }, null, 'pill small') : null,
            x.reported_user_id && !(map[x.reported_user_id] || {}).suspended ? UI.action('Suspend user', function () {
              return rpc('admin_set_user', { p_user: x.reported_user_id, p_suspended: true }).then(function () { toast('User suspended'); refresh(); });
            }, null, 'pill ghost small') : null,
            x.status !== 'resolved' ? UI.action('Resolve', function () { return rpc('admin_set_report', { p_report: x.id, p_status: 'resolved' }).then(refresh); }, null, 'pill light small') : null,
            x.status === 'open' ? UI.action('Dismiss', function () { return rpc('admin_set_report', { p_report: x.id, p_status: 'dismissed' }).then(refresh); }, null, 'pill ghost small') : null
          ]);
          return h('tr', {}, [td(day(x.created_at)), h('td', {}, [h('b', { text: x.reason }), x.details ? h('p', { class: 'p-meta', text: x.details }) : null]),
            h('td', {}, about), td(nm(map, x.reporter_id)), td(x.status), h('td', {}, [acts])]);
        })));
      });
    });
  }

  function verify() {
    db.from('verification_requests').select('*').eq('status', 'pending').order('created_at').then(function (r) {
      var rows = r.data || [];
      names(rows.map(function (x) { return x.user_id; })).then(function (map) {
        panel.replaceChildren(table(['When', 'Student', 'School email', 'Note', 'Actions'], rows.map(function (x) {
          return h('tr', {}, [td(day(x.created_at)), h('td', {}, [h('a', { href: 'profile.html?u=' + x.user_id, text: nm(map, x.user_id) }), h('p', { class: 'p-meta', text: (map[x.user_id] || {}).school || '' })]),
            td(x.school_email || '—'), td(x.note || '—'), h('td', {}, [h('div', { class: 'p-row' }, [
              UI.action('Approve', function () { return rpc('admin_set_user', { p_user: x.user_id, p_verified: true }).then(function () { toast('Verified'); refresh(); }); }, null, 'pill small'),
              UI.action('Reject', function () { return rpc('admin_reject_verification', { p_request: x.id }).then(refresh); }, null, 'pill ghost small')
            ])])]);
        })));
      });
    });
  }

  function users() {
    var q = h('input', { id: 'a-q', type: 'search', placeholder: 'Search by name or school', 'aria-label': 'Search users' });
    var box = h('div', {});
    function load() {
      var t = q.value.trim();
      var query = db.from('profiles').select('id, full_name, school, course, year_level, verified, suspended, is_admin, created_at').order('created_at', { ascending: false }).limit(100);
      if (t) query = query.or('full_name.ilike.%' + t.replace(/[%,()]/g, '') + '%,school.ilike.%' + t.replace(/[%,()]/g, '') + '%');
      query.then(function (r) {
        box.replaceChildren(table(['Student', 'School', 'Joined', 'Verified', 'Status', 'Actions'], (r.data || []).map(function (p) {
          return h('tr', {}, [h('td', {}, [h('a', { href: 'profile.html?u=' + p.id, text: p.full_name || '—' }), p.is_admin ? h('span', { class: 'p-chip', text: 'Admin' }) : null]),
            td([p.school, p.course, p.year_level].filter(Boolean).join(' · ')), td(day(p.created_at)), td(p.verified ? '✓' : '—'), td(p.suspended ? 'Suspended' : 'Active'),
            h('td', {}, [h('div', { class: 'p-row' }, [
              UI.action(p.verified ? 'Unverify' : 'Verify', function () { return rpc('admin_set_user', { p_user: p.id, p_verified: !p.verified }).then(load); }, null, 'pill light small'),
              p.is_admin ? null : UI.action(p.suspended ? 'Unsuspend' : 'Suspend', function () { return rpc('admin_set_user', { p_user: p.id, p_suspended: !p.suspended }).then(load); }, null, 'pill ghost small')
            ])])]);
        })));
      });
    }
    var timer;
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 300); });
    panel.replaceChildren(h('div', { class: 'p-form' }, [UI.field('Search', q)]), box);
    load();
  }

  function listings() {
    db.from('listings').select('id, title, kind, price_php, status, seller_id, created_at, views').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      names(rows.map(function (x) { return x.seller_id; })).then(function (map) {
        panel.replaceChildren(table(['Listed', 'Item', 'Seller', 'Price', 'Status', 'Views', ''], rows.map(function (l) {
          return h('tr', {}, [td(day(l.created_at)), h('td', {}, [h('a', { href: 'index.html?open=' + l.id, text: l.title })]), td(nm(map, l.seller_id)),
            td(l.kind === 'sell' ? peso(l.price_php) : l.kind), td(l.status), td(l.views || 0),
            h('td', {}, [l.status !== 'removed' ? UI.action('Remove', function () {
              var why = 'Breaks the PasaU rules';
              return rpc('admin_remove_listing', { p_listing: l.id, p_reason: why }).then(function () { toast('Removed and seller notified'); refresh(); });
            }, null, 'pill ghost small') : null])]);
        })));
      });
    });
  }

  function transactions() {
    db.from('transactions').select('*, listing:listings!transactions_listing_id_fkey(id, title)').order('created_at', { ascending: false }).limit(100).then(function (r) {
      var rows = r.data || [];
      names(rows.map(function (t) { return t.buyer_id; }).concat(rows.map(function (t) { return t.seller_id; }))).then(function (map) {
        panel.replaceChildren(table(['Started', 'Item', 'Buyer', 'Seller', 'Type', 'Price', 'Status'], rows.map(function (t) {
          return h('tr', {}, [td(day(t.created_at)), h('td', {}, [t.listing ? h('a', { href: 'index.html?open=' + t.listing.id, text: t.listing.title }) : 'Deleted']),
            td(nm(map, t.buyer_id)), td(nm(map, t.seller_id)), td(t.kind), td(t.price_php != null ? peso(t.price_php) : '—'), td(t.status)]);
        })));
      });
    });
  }
})();

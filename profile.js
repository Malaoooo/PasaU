/* PasaU profile: your listings, Looking For, saved, history, vouches, settings — or another student's public profile. */
(function () {
  var db = window.supabase.createClient(window.UC_CONFIG.url, window.UC_CONFIG.key);
  var h = UI.h, opt = UI.opt, field = UI.field, toast = UI.toast, peso = UI.peso, day = UI.day, errText = UI.errText;
  var head = document.getElementById('profile-head'), tabsEl = document.getElementById('tabs'), panel = document.getElementById('panel');
  var params = new URLSearchParams(location.search);
  var SCHOOLS = window.UC_SCHOOLS || [];
  var YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate'];
  var STATUS = { active: 'Available', reserved: 'Reserved', sold: 'Sold', removed: 'Removed by PasaU' };
  var TX = { reserved: 'Reserved', meetup: 'Meetup set', completed: 'Completed', cancelled: 'Cancelled' };
  var NOTIF = [
    ['messages', 'New messages'],
    ['listings', 'Interest in your listings: chats, reservations, people joining the line'],
    ['queue', 'Your place in line'],
    ['saved', 'Changes to items you saved'],
    ['wanted', 'Looking For matches and replies'],
    ['meetups', 'Meetups and reminders']
  ];
  var me = null, mine = null, uid = null, self = false, current = null, headData = null;

  function rpc(name, args) { return db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function ok(r) { if (r.error) throw r.error; return r.data; }
  function photo(l) {
    var p = l && (l.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; })[0];
    return h('img', { class: 'thumb', src: p ? db.storage.from('listing-photos').getPublicUrl(p.path).data.publicUrl : 'logos/mark-small.svg', alt: '' });
  }
  function priceOf(l) { return l.kind === 'free' ? 'Free' : l.kind === 'swap' ? 'Swap' : peso(l.price_php); }
  function chip(text, cls) { return h('span', { class: 'p-chip' + (cls ? ' ' + cls : ''), text: text }); }
  // Names come from public_profiles, which applies each person's privacy settings
  function namesFor(ids) {
    ids = ids.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    if (!ids.length) return Promise.resolve({});
    return db.from('public_profiles').select('id, display_name, avatar_url, school, verified').in('id', ids).then(function (r) {
      var map = {};
      (r.data || []).forEach(function (p) { map[p.id] = p; });
      return map;
    });
  }
  function nameOf(map, id) { return (map[id] && map[id].display_name) || 'A student'; }

  // ---------- start ----------
  db.auth.getSession().then(function (r) {
    me = r.data.session && r.data.session.user;
    uid = params.get('u') || (me && me.id);
    if (!me) {
      head.replaceChildren(UI.empty('Log in to see profiles.', 'Your profile shows your listings, saved items, history and settings.',
        [h('a', { class: 'pill', href: 'index.html?login=1', text: 'Log in' })]));
      return;
    }
    self = uid === me.id;
    document.title = (self ? 'Your profile' : 'Profile') + ' · PasaU';
    (self
      ? db.from('profiles').select('*').eq('id', me.id).maybeSingle().then(function (x) {
          mine = ok(x);
          return db.from('public_profiles').select('vouch_count, created_at').eq('id', me.id).maybeSingle().then(function (y) {
            var pub = y.data || {};
            return Object.assign({ display_name: mine.full_name, vouch_count: pub.vouch_count || 0 }, mine);
          });
        })
      : db.from('public_profiles').select('*').eq('id', uid).maybeSingle().then(ok)
    ).then(function (p) {
      if (!p) { head.replaceChildren(UI.empty('This profile isn’t available.', 'The account may have been removed or suspended.')); return; }
      renderHead(p);
      buildTabs();
    }).catch(function (e) { head.replaceChildren(UI.empty('Couldn’t load this profile.', errText(e))); });
  });

  // ---------- header ----------
  function renderHead(p) {
    headData = p;
    var name = p.display_name || p.full_name || 'Student';
    var kids = [
      h('div', { class: 'p-avatar' }, [UI.avatar(p.avatar_url, name, 96)]),
      h('div', { class: 'p-who' }, [
        h('h1', {}, [name, p.verified ? h('span', { class: 'verified', title: 'Verified student', text: '✓ Verified' }) : null]),
        h('p', { class: 'p-sub', text: [p.school, p.course, p.year_level].filter(Boolean).join(' · ') || 'No school added yet' }),
        h('p', { class: 'p-stats', text: (p.vouch_count || 0) + (p.vouch_count === 1 ? ' vouch' : ' vouches') + ' · Member since ' + day(p.created_at) })
      ])
    ];
    var acts = h('div', { class: 'p-actions' });
    if (self) {
      var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
      file.addEventListener('change', function () { uploadAvatar(file.files[0]); file.value = ''; });
      acts.append(h('button', { class: 'pill light small', type: 'button', text: p.avatar_url ? 'Change photo' : 'Add a photo', onclick: function () { file.click(); } }), file);
    } else {
      vouchControls(acts, name);
      acts.append(h('button', { class: 'linkish', type: 'button', text: 'Report or block', onclick: function () { reportUser(acts, name); } }));
    }
    kids.push(acts);
    head.replaceChildren.apply(head, kids);
  }

  function uploadAvatar(f) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Photos must be 2 MB or smaller.'); return; }
    var path = me.id + '/avatar-' + Date.now() + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase();
    toast('Uploading photo…');
    db.storage.from('avatars').upload(path, f, { contentType: f.type }).then(function (u) {
      if (u.error) throw u.error;
      var url = db.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      return db.from('profiles').update({ avatar_url: url }).eq('id', me.id).then(function (r) {
        ok(r);
        mine.avatar_url = url;
        toast('Photo updated');
        renderHead(Object.assign({}, headData, { avatar_url: url }));
      });
    }).catch(function (e) { toast('Couldn’t upload the photo: ' + errText(e)); });
  }

  // Vouch: only after a completed handover together
  function vouchControls(box, name) {
    Promise.all([
      db.from('transactions').select('id').eq('status', 'completed')
        .or('and(buyer_id.eq.' + me.id + ',seller_id.eq.' + uid + '),and(seller_id.eq.' + me.id + ',buyer_id.eq.' + uid + ')').limit(1),
      db.from('vouches').select('voucher_id').eq('voucher_id', me.id).eq('vouchee_id', uid).maybeSingle()
    ]).then(function (res) {
      var dealt = (res[0].data || []).length > 0, vouched = !!res[1].data;
      if (vouched) {
        box.prepend(h('span', { class: 'p-chip ok', text: '✓ You vouched' }), h('button', { class: 'linkish', type: 'button', text: 'Take it back', onclick: function () {
          db.from('vouches').delete().eq('voucher_id', me.id).eq('vouchee_id', uid).then(function (r) { if (r.error) return toast(errText(r.error)); toast('Vouch removed'); location.reload(); });
        } }));
      } else if (dealt) {
        var noteIn = h('input', { id: 'v-note', type: 'text', maxLength: 200, placeholder: 'Optional: on time, item as described…' });
        var form = h('div', { class: 'p-inline', hidden: true }, [field('Add a short note', noteIn), UI.action('Vouch for ' + name.split(' ')[0], function () {
          return db.from('vouches').insert({ vouchee_id: uid, note: noteIn.value.trim() || null }).then(function (r) { ok(r); toast('Thanks! Your vouch is on their profile.'); location.reload(); });
        })]);
        box.prepend(h('button', { class: 'pill small', type: 'button', text: 'Vouch for this student', onclick: function () { form.hidden = !form.hidden; } }), form);
      } else {
        box.prepend(h('span', { class: 'p-hint', text: 'You can vouch after a completed handover together.' }));
      }
    });
  }

  function reportUser(box, name) {
    if (box.querySelector('.p-report')) return;
    var reason = h('select', { id: 'ru-reason' }, [opt('', 'Choose a reason…')].concat(['Scam or misleading', 'Harassment', 'Offensive content', 'Other'].map(function (r) { return opt(r, r); })));
    var details = h('textarea', { id: 'ru-details', maxLength: 600, placeholder: 'What happened? (optional)' });
    var n = UI.note();
    box.append(h('div', { class: 'p-inline p-report' }, [
      field('Reason', reason), field('Details', details),
      h('div', { class: 'p-row' }, [
        UI.action('Send report', function () {
          if (!reason.value) { UI.say(n, 'Choose a reason.', true); return; }
          return db.from('reports').insert({ reported_user_id: uid, reason: reason.value, details: details.value.trim() || null })
            .then(function (r) { ok(r); toast('Report sent. They aren’t told who reported them.'); box.querySelector('.p-report').remove(); });
        }, n),
        UI.action('Block ' + name.split(' ')[0], function () {
          return db.from('blocks').insert({ blocked_id: uid }).then(function (r) {
            if (r.error && r.error.code !== '23505') throw r.error;
            toast('Blocked. You won’t see their listings or messages.');
          });
        }, n, 'pill light small')
      ]), n
    ]));
  }

  // ---------- tabs ----------
  function buildTabs() {
    var tabs = self
      ? [['listings', 'Listings'], ['wanted', 'Looking For'], ['saved', 'Saved'], ['history', 'History'], ['vouches', 'Vouches'], ['family', 'Family'], ['settings', 'Settings']]
      : [['listings', 'Listings'], ['vouches', 'Vouches']];
    var want = (location.hash || '').slice(1);
    tabsEl.replaceChildren.apply(tabsEl, tabs.map(function (t) {
      return h('button', { type: 'button', role: 'tab', id: 'tab-' + t[0], 'aria-controls': 'panel', text: t[1], onclick: function () { show(t[0]); } });
    }));
    var linked = tabs.some(function (t) { return t[0] === want; });
    show(linked ? want : tabs[0][0]);
    // Opened on a specific tab (menu → Profile settings): scroll to it once its content has loaded
    if (linked && want !== tabs[0][0]) {
      history.scrollRestoration = 'manual';
      var go = function () { tabsEl.scrollIntoView({ block: 'start' }); };
      setTimeout(go, 0);  // tabs that draw straight away
      new MutationObserver(function (m, o) { o.disconnect(); go(); }).observe(panel, { childList: true });  // tabs that load first
    }
  }
  window.addEventListener('hashchange', function () {
    var b = document.getElementById('tab-' + location.hash.slice(1));
    if (b) { b.click(); tabsEl.scrollIntoView({ block: 'start' }); }
  });
  function show(name) {
    current = name;
    [].forEach.call(tabsEl.children, function (b) { b.setAttribute('aria-selected', b.id === 'tab-' + name ? 'true' : 'false'); });
    var sel = document.getElementById('tab-' + name);  // slide the tab row so the chosen tab is in view
    if (sel) tabsEl.scrollLeft += sel.getBoundingClientRect().left - tabsEl.getBoundingClientRect().left - (tabsEl.clientWidth - sel.offsetWidth) / 2;
    panel.setAttribute('aria-labelledby', 'tab-' + name);
    if (self) history.replaceState(null, '', '#' + name);
    panel.replaceChildren(h('p', { class: 'muted', text: 'Loading…' }));
    ({ listings: tabListings, wanted: tabWanted, saved: tabSaved, history: tabHistory, vouches: tabVouches, family: tabFamily, settings: tabSettings })[name]();
  }
  function refresh() { show(current); }

  // ---------- Listings (yours: manage; theirs: browse) ----------
  function tabListings() {
    var q = db.from('listings').select('*, listing_photos(path, position)').eq('seller_id', uid).order('bumped_at', { ascending: false });
    if (!self) q = q.in('status', ['active', 'reserved']);
    q.then(function (r) {
      var rows = r.data || [];
      if (r.error) return panel.replaceChildren(UI.empty('Couldn’t load listings.', errText(r.error)));
      if (!rows.length) {
        return panel.replaceChildren(self
          ? UI.empty('You haven’t listed anything yet.', window.PASAU_LOCKED ? 'New listings are paused now that the pre-pilot test is over.' : 'Sell, swap or give away something you’ve outgrown.', window.PASAU_LOCKED ? [] : [h('a', { class: 'pill', href: 'index.html?sell=1', text: 'List an item' })])
          : UI.empty('No listings right now.', 'Check back later.'));
      }
      panel.replaceChildren.apply(panel, [h('ul', { class: 'p-list' }, rows.map(function (l) { return self ? manageRow(l) : browseRow(l); }))]);
    });
  }
  function browseRow(l) {
    return h('li', { class: 'p-item' }, [photo(l), h('div', { class: 'p-main' }, [
      h('a', { class: 'p-title', href: 'index.html?open=' + l.id, text: l.title }),
      h('p', { class: 'p-meta', text: priceOf(l) + ' · ' + (l.condition || '') + (l.pickup_spot ? ' · ' + l.pickup_spot : '') })
    ]), chip(STATUS[l.status] || l.status, l.status)]);
  }
  function manageRow(l) {
    var n = UI.note();
    var stats = h('p', { class: 'p-meta', text: priceOf(l) + ' · ' + (l.views || 0) + (l.views === 1 ? ' view' : ' views') + ' · Listed ' + day(l.bumped_at || l.created_at) });
    var interestBtn = h('button', { class: 'linkish', type: 'button', text: 'Interested people', 'aria-expanded': 'false' });
    var interest = h('div', { class: 'p-interest', hidden: true });
    interestBtn.addEventListener('click', function () {
      interest.hidden = !interest.hidden;
      interestBtn.setAttribute('aria-expanded', interest.hidden ? 'false' : 'true');
      if (!interest.hidden && !interest.dataset.loaded) loadInterest(l, interest);
    });
    var acts = [];
    if (l.status !== 'removed') {
      var status = h('select', { id: 'st-' + l.id, 'aria-label': 'Status of ' + l.title },
        [opt('active', 'Available'), opt('reserved', 'Reserved'), opt('sold', 'Sold')]);
      status.value = l.status;
      status.addEventListener('change', function () {
        var v = status.value;
        if (v === 'sold' && !confirmTwice(status, l.status)) return;
        rpc('set_listing_status', { p_listing: l.id, p_status: v }).then(function () { toast('Marked as ' + STATUS[v]); refresh(); })
          .catch(function (e) { status.value = l.status; UI.say(n, errText(e), true); });
      });
      acts.push(h('label', { class: 'p-status' }, [h('span', { text: 'Status' }), status]));
      acts.push(h('a', { class: 'pill light small', href: 'index.html?edit=' + l.id, text: 'Edit' }));
      if (l.status !== 'sold') acts.push(UI.action('Renew', function () { return rpc('renew_listing', { p_listing: l.id }).then(function () { toast('Renewed. It’s back at the top of Newest.'); refresh(); }); }, n, 'pill light small'));
    }
    var armed = false;
    acts.push(UI.action('Delete', function (b) {
      if (!armed) { armed = true; b.textContent = 'Tap again to delete'; return; }
      return db.from('listings').delete().eq('id', l.id).then(function (r) { ok(r); toast('Listing deleted'); refresh(); });
    }, n, 'pill ghost small'));
    return h('li', { class: 'p-item manage' }, [
      photo(l),
      h('div', { class: 'p-main' }, [
        h('a', { class: 'p-title', href: 'index.html?open=' + l.id, text: l.title }), stats,
        h('div', { class: 'p-row' }, acts), interestBtn, interest, n
      ]),
      chip(STATUS[l.status] || l.status, l.status)
    ]);
  }
  // Marking as sold ends the queue, so ask once more
  function confirmTwice(sel, prev) {
    if (sel.dataset.armed) { delete sel.dataset.armed; return true; }
    sel.dataset.armed = '1';
    sel.value = prev;
    toast('Choose Sold again to confirm. Everyone in line will be told it’s gone.');
    return false;
  }
  function loadInterest(l, box) {
    box.dataset.loaded = '1';
    Promise.all([
      db.from('queue_entries').select('user_id, created_at').eq('listing_id', l.id).order('created_at'),
      db.from('conversations').select('id, buyer_id, created_at').eq('listing_id', l.id).order('created_at', { ascending: false })
    ]).then(function (res) {
      var queue = res[0].data || [], chats = res[1].data || [];
      return namesFor(queue.map(function (q) { return q.user_id; }).concat(chats.map(function (c) { return c.buyer_id; }), [l.reserved_by])).then(function (map) {
        var kids = [];
        if (l.reserved_by) kids.push(h('p', {}, [h('b', { text: 'Reserved by ' }), nameOf(map, l.reserved_by)]));
        kids.push(h('p', { class: 'p-meta', text: queue.length + (queue.length === 1 ? ' person' : ' people') + ' in line' }));
        if (queue.length) kids.push(h('ol', { class: 'p-queue' }, queue.map(function (q) { return h('li', { text: nameOf(map, q.user_id) + ' · joined ' + day(q.created_at) }); })));
        if (l.status === 'reserved' && l.reserved_by) {
          kids.push(UI.action(queue.length ? 'Move to next in line' : 'Release reservation', function () {
            return rpc('release_reservation', { p_listing: l.id }).then(function () { toast(queue.length ? 'Offered to the next person in line' : 'Reservation released'); refresh(); });
          }, null, 'pill light small'));
        }
        kids.push(h('p', { class: 'p-meta', text: chats.length + (chats.length === 1 ? ' chat' : ' chats') }));
        if (chats.length) kids.push(h('ul', { class: 'p-chats' }, chats.map(function (c) {
          return h('li', {}, [h('a', { href: 'messages.html?c=' + c.id, text: nameOf(map, c.buyer_id) }), ' · ' + day(c.created_at)]);
        })));
        box.replaceChildren.apply(box, kids);
      });
    }).catch(function (e) { box.replaceChildren(h('p', { class: 'note err', text: errText(e) })); });
  }

  // ---------- Looking For ----------
  function tabWanted() {
    Promise.all([
      db.from('wanted_posts').select('*').eq('user_id', me.id).order('created_at', { ascending: false }),
      db.from('wanted_replies').select('wanted_id, listing_id, created_at, listings(id, title, kind, price_php)')
    ]).then(function (res) {
      var posts = res[0].data || [], replies = res[1].data || [];
      if (!posts.length) return panel.replaceChildren(UI.empty('No Looking For posts.', 'Post what you need and get notified when someone lists it.', [h('a', { class: 'pill', href: 'unimatch.html', text: 'Open PasaMatch' })]));
      panel.replaceChildren(h('ul', { class: 'p-list' }, posts.map(function (w) {
        var mineReplies = replies.filter(function (r) { return r.wanted_id === w.id && r.listings; });
        return h('li', { class: 'p-item' }, [h('div', { class: 'p-main' }, [
          h('p', { class: 'p-title', text: w.title }),
          h('p', { class: 'p-meta', text: [w.max_price_php != null ? 'Up to ' + peso(w.max_price_php) : null, w.school, 'Posted ' + day(w.created_at)].filter(Boolean).join(' · ') }),
          mineReplies.length ? h('ul', { class: 'p-chats' }, mineReplies.map(function (r) {
            return h('li', {}, ['Match: ', h('a', { href: 'index.html?open=' + r.listings.id, text: r.listings.title + ' (' + priceOf(r.listings) + ')' })]);
          })) : h('p', { class: 'p-meta', text: 'No replies yet' })
        ]), h('div', { class: 'p-row' }, [
          h('a', { class: 'pill small', href: 'unimatch.html?post=' + w.id, text: 'See matches' }),
          UI.action('Remove', function () {
            return db.from('wanted_posts').delete().eq('id', w.id).then(function (r) { ok(r); toast('Looking For post removed'); refresh(); });
          }, null, 'pill ghost small')
        ])]);
      })));
    });
  }

  // ---------- Saved ----------
  function tabSaved() {
    db.from('saves').select('listing_id, created_at, listings(*, listing_photos(path, position))').eq('user_id', me.id).order('created_at', { ascending: false })
      .then(function (r) {
        var rows = (r.data || []).filter(function (s) { return s.listings; });
        if (!rows.length) return panel.replaceChildren(UI.empty('Nothing saved yet.', 'Tap the heart on a listing to keep it here. We’ll tell you if the price drops or it becomes available.', [h('a', { class: 'pill', href: 'index.html#shop', text: 'Browse listings' })]));
        panel.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (s) {
          var l = s.listings;
          return h('li', { class: 'p-item' }, [photo(l), h('div', { class: 'p-main' }, [
            h('a', { class: 'p-title', href: 'index.html?open=' + l.id, text: l.title }),
            h('p', { class: 'p-meta', text: priceOf(l) + ' · Saved ' + day(s.created_at) })
          ]), chip(STATUS[l.status] || l.status, l.status), UI.action('Remove', function () {
            return db.from('saves').delete().eq('user_id', me.id).eq('listing_id', l.id).then(function (x) { ok(x); toast('Removed from Saved'); refresh(); });
          }, null, 'pill ghost small')]);
        })));
      });
  }

  // ---------- History ----------
  function tabHistory() {
    db.from('transactions').select('*, listing:listings!transactions_listing_id_fkey(id, title, listing_photos(path, position))')
      .order('created_at', { ascending: false }).then(function (r) {
        var rows = r.data || [];
        if (r.error) return panel.replaceChildren(UI.empty('Couldn’t load your history.', errText(r.error)));
        if (!rows.length) return panel.replaceChildren(UI.empty('No transactions yet.', 'Reservations, swaps and completed handovers show up here.'));
        namesFor(rows.map(function (t) { return t.buyer_id === me.id ? t.seller_id : t.buyer_id; })).then(function (map) {
          var filter = 'all';
          var bar = h('div', { class: 'p-filter', role: 'group', 'aria-label': 'Filter history' });
          var list = h('ul', { class: 'p-list' });
          var F = [['all', 'All'], ['bought', 'Bought'], ['sold', 'Sold'], ['swapped', 'Swapped'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
          function role(t) { return t.kind === 'swap' ? 'Swapped' : t.buyer_id === me.id ? (t.kind === 'free' ? 'Got for free' : 'Bought') : (t.kind === 'free' ? 'Gave away' : 'Sold'); }
          function match(t) {
            return filter === 'all' || (filter === 'bought' && t.buyer_id === me.id && t.kind !== 'swap') ||
              (filter === 'sold' && t.seller_id === me.id && t.kind !== 'swap') || (filter === 'swapped' && t.kind === 'swap') ||
              filter === t.status;
          }
          function draw() {
            [].forEach.call(bar.children, function (b) { b.setAttribute('aria-pressed', b.dataset.f === filter ? 'true' : 'false'); });
            var shown = rows.filter(match);
            list.replaceChildren.apply(list, shown.length ? shown.map(function (t) {
              var other = t.buyer_id === me.id ? t.seller_id : t.buyer_id;
              return h('li', { class: 'p-item' }, [photo(t.listing), h('div', { class: 'p-main' }, [
                t.listing ? h('a', { class: 'p-title', href: 'index.html?open=' + t.listing.id, text: t.listing.title }) : h('p', { class: 'p-title', text: 'Listing removed' }),
                h('p', { class: 'p-meta' }, [role(t) + (t.buyer_id === me.id ? ' from ' : ' to '), h('a', { href: 'profile.html?u=' + other, text: nameOf(map, other) }),
                  ' · ' + (t.price_php != null ? peso(t.price_php) + ' · ' : '') + day(t.created_at)])
              ]), chip(TX[t.status], t.status)]);
            }) : [h('li', { class: 'p-meta', text: 'Nothing here yet.' })]);
          }
          F.forEach(function (f) { bar.append(h('button', { type: 'button', 'data-f': f[0], text: f[1], onclick: function () { filter = f[0]; draw(); } })); });
          [].forEach.call(bar.children, function (b, i) { b.dataset.f = F[i][0]; });
          draw();
          panel.replaceChildren(bar, list);
        });
      });
  }

  // ---------- Vouches ----------
  function tabVouches() {
    db.from('vouches').select('voucher_id, note, created_at').eq('vouchee_id', uid).order('created_at', { ascending: false }).then(function (r) {
      var rows = r.data || [];
      if (!rows.length) return panel.replaceChildren(UI.empty('No vouches yet.', self ? 'After a completed handover, the other student can vouch for you.' : 'Vouches come from students who completed a handover with them.'));
      namesFor(rows.map(function (v) { return v.voucher_id; })).then(function (map) {
        panel.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (v) {
          var p = map[v.voucher_id] || {};
          return h('li', { class: 'p-item' }, [UI.avatar(p.avatar_url, p.display_name, 44), h('div', { class: 'p-main' }, [
            h('a', { class: 'p-title', href: 'profile.html?u=' + v.voucher_id, text: nameOf(map, v.voucher_id) }),
            h('p', { class: 'p-meta', text: (v.note ? '“' + v.note + '” · ' : '') + day(v.created_at) })
          ])]);
        })));
      });
    });
  }

  // ---------- Family: parent / guardian accounts (db/guardians.sql) ----------
  function tabFamily() {
    panel.replaceChildren(h('p', { class: 'muted', text: 'Loading…' }));
    rpc('my_family').then(function (f) {
      var gs = f.guardians || [];
      panel.replaceChildren(
        section('Parents and guardians', h('div', { class: 'p-form' }, [
          h('p', { class: 'p-hint', text: 'A linked parent or guardian sees your meetups (place, time and item) and gets a check-in if a meetup isn’t marked done. They never see your chats or handover codes, and they can’t buy, sell or message anyone.' }),
          gs.length ? h('ul', { class: 'p-list' }, gs.map(guardianRow)) : h('p', { class: 'muted', text: 'No one is linked yet.' })
        ])),
        section('Invite a parent or guardian', inviteBox(f.invite, gs.length))
      );
    }).catch(function (e) { panel.replaceChildren(UI.empty('Couldn’t load your family settings.', errText(e))); });
  }
  function guardianRow(g) {
    var n = UI.note();
    function toggle(key, label) {
      var box = h('input', { type: 'checkbox', id: 'gl-' + key + '-' + g.id, checked: !!g[key] });
      box.addEventListener('change', function () {
        var patch = {}; patch[key] = box.checked;
        db.from('guardian_links').update(patch).eq('student_id', me.id).eq('guardian_id', g.id).then(function (r) {
          if (r.error) { box.checked = !box.checked; return UI.say(n, errText(r.error), true); }
          g[key] = box.checked;
          UI.say(n, 'Saved');
        });
      });
      return h('label', { class: 'check', htmlFor: box.id }, [box, h('span', { text: label })]);
    }
    return h('li', { class: 'p-item' }, [UI.avatar(null, g.name, 44), h('div', { class: 'p-main' }, [
      h('p', { class: 'p-title', text: g.name || 'Parent or guardian' }),
      h('p', { class: 'p-meta', text: (g.email || '') + ' · linked ' + day(g.since) }),
      h('div', { class: 'p-form' }, [
        toggle('share_meetups', 'Meetup alerts and check-ins'),
        toggle('share_deals', 'Completed buys and sells (item and price), last 90 days'),
        h('div', { class: 'p-row' }, [UI.action('Unlink', function (b) {
          if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to unlink'; return; }
          return db.from('guardian_links').delete().eq('student_id', me.id).eq('guardian_id', g.id).then(function (r) {
            ok(r); toast('Unlinked. They’ve been told.'); refresh();
          });
        }, n, 'pill light small')]), n
      ])
    ])]);
  }
  function inviteBox(inv, count) {
    var n = UI.note(), box = h('div', { class: 'p-form' });
    function draw(inv) {
      if (!inv) {
        box.replaceChildren(
          h('p', { class: 'p-hint', text: count >= 4 ? 'You can link up to 4 parents or guardians.' : 'You’ll get a link to send them. They sign up with any email (Gmail is fine), and the link works once, for 7 days.' }),
          count >= 4 ? null : h('div', { class: 'p-row' }, [UI.action('Get an invite link', function () {
            return rpc('create_guardian_invite').then(function (x) { draw(x); });
          }, n, 'pill')]), n);
        return;
      }
      var url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'family.html?invite=' + inv.code;
      var share = navigator.share
        ? h('button', { class: 'pill small', type: 'button', text: 'Share', onclick: function () { navigator.share({ title: 'PasaU', text: 'Link your parent account to my PasaU account', url: url }).catch(function () {}); } })
        : null;
      box.replaceChildren(
        h('p', { class: 'p-hint', text: 'Send this to your parent or guardian. It works once and expires ' + day(inv.expires_at) + '.' }),
        h('input', { id: 'g-invite-url', type: 'text', readOnly: true, value: url, 'aria-label': 'Invite link', onfocus: function () { this.select(); } }),
        h('p', { class: 'p-meta', text: 'Or they can type this code on the sign-up page: ' + inv.code }),
        h('div', { class: 'p-row' }, [
          h('button', { class: 'pill small', type: 'button', text: 'Copy link', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { UI.say(n, 'Link copied'); }, function () { UI.say(n, 'Select the link above and copy it.'); });
          } }),
          share,
          UI.action('Cancel invite', function () {
            return db.from('guardian_invites').delete().eq('code', inv.code).then(function (r) { ok(r); draw(null); });
          }, n, 'pill light small')
        ]), n);
    }
    draw(inv);
    return box;
  }

  // ---------- Settings ----------
  function tabSettings() {
    panel.replaceChildren(
      section('Edit profile', editProfile()),
      section('Password', changePassword()),
      section('Two-step login', twoStep()),
      section('Notifications', notifSettings()),
      section('Privacy', privacySettings()),
      section('Verified student', verification()),
      section('Blocked people', blockedList()),
      section('Log out', h('div', {}, [UI.action('Log out', function () { return db.auth.signOut().then(function () { location.href = 'index.html'; }); }, null, 'pill ghost')]))
    );
  }
  function section(title, body) { return h('div', { class: 'p-section' }, [h('h2', { text: title }), body]); }

  function editProfile() {
    var n = UI.note();
    var name = h('input', { id: 'e-name', type: 'text', maxLength: 80, value: mine.full_name || '', autocomplete: 'name' });
    var known = SCHOOLS.some(function (sc) { return sc.name === mine.school; });
    var school = h('select', { id: 'e-school' }, [opt('', 'Choose your school…')].concat(SCHOOLS.map(function (sc) { return opt(sc.name, sc.name); }), [opt('other', 'Other (not listed)')]));
    var schoolOther = h('input', { id: 'e-school-other', type: 'text', maxLength: 80, placeholder: 'Type your school’s name', 'aria-label': 'Your school’s name', hidden: true });
    if (known) school.value = mine.school; else if (mine.school) { school.value = 'other'; schoolOther.hidden = false; schoolOther.value = mine.school; }
    var course = h('select', { id: 'e-course' });
    var courseOther = h('input', { id: 'e-course-other', type: 'text', maxLength: 80, placeholder: 'Type your course', 'aria-label': 'Your course', hidden: true });
    var year = h('select', { id: 'e-year' }, [opt('', 'Choose…')].concat(YEARS.map(function (y) { return opt(y, y); })));
    year.value = mine.year_level || '';
    function fillCourses(keep) {
      var sc = window.UC_SCHOOL_BY_NAME(school.value);
      var list = sc ? sc.courses : window.UC_ALL_COURSES();
      course.replaceChildren.apply(course, [opt('', 'Choose your course…')].concat(list.map(function (c) { return opt(c, c); }), [opt('other', 'Other (type it)')]));
      if (keep) {
        if (list.indexOf(keep) !== -1) { course.value = keep; courseOther.hidden = true; }
        else { course.value = 'other'; courseOther.hidden = false; courseOther.value = keep; }
      } else courseOther.hidden = true;
    }
    fillCourses(mine.course);
    school.addEventListener('change', function () { schoolOther.hidden = school.value !== 'other'; fillCourses(); });
    course.addEventListener('change', function () { courseOther.hidden = course.value !== 'other'; });
    return h('div', { class: 'p-form' }, [
      field('Full name', name), field('School', school), schoolOther, field('Course', course), courseOther, field('Year level', year),
      UI.action('Save profile', function () {
        var s = school.value === 'other' ? schoolOther.value.trim() : school.value;
        var c = course.value === 'other' ? courseOther.value.trim() : course.value;
        if (!name.value.trim()) { UI.say(n, 'Enter your full name.', true); return; }
        if (!s) { UI.say(n, 'Choose your school.', true); return; }
        return db.from('profiles').update({ full_name: name.value.trim(), school: s, course: c || null, year_level: year.value || null }).eq('id', me.id)
          .then(function (r) { ok(r); Object.assign(mine, { full_name: name.value.trim(), school: s, course: c || null, year_level: year.value || null }); UI.say(n, 'Saved. New listings use your updated school and course.'); });
      }, n, 'pill'), n
    ]);
  }

  function changePassword() {
    var n = UI.note();
    var p1 = h('input', { id: 'pw-1', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' });
    var p2 = h('input', { id: 'pw-2', type: 'password', autocomplete: 'new-password' });
    return h('div', { class: 'p-form' }, [field('New password', p1), field('Type it again', p2), UI.action('Change password', function () {
      if (p1.value.length < 8) { UI.say(n, 'Your password needs at least 8 characters.', true); return; }
      if (p1.value !== p2.value) { UI.say(n, 'The two passwords don’t match.', true); return; }
      return db.auth.updateUser({ password: p1.value }).then(function (r) {
        if (r.error) throw r.error;
        p1.value = p2.value = '';
        UI.say(n, 'Password changed.');
      });
    }, n, 'pill'), n]);
  }

  // Authenticator-app codes (Supabase MFA, TOTP): after the password, a 6-digit code from the student's phone
  function twoStep() {
    var box = h('div', { class: 'p-form' }, [h('p', { class: 'muted', text: 'Loading…' })]);
    function draw() {
      return db.auth.mfa.listFactors().then(function (r) {
        if (r.error) { box.replaceChildren(h('p', { class: 'p-hint', text: errText(r.error) })); return; }
        var on = (r.data.totp || [])[0], n = UI.note();  // totp lists only finished setups
        if (on) {
          box.replaceChildren(h('p', {}, [h('span', { class: 'verified', text: '✓ On' }), ' After your password, you type the code from your authenticator app.']),
            UI.action('Turn off two-step login', function () {
              if (!confirm('Turn off two-step login? Your password alone will be enough to log in.')) return;
              return db.auth.mfa.unenroll({ factorId: on.id }).then(function (x) { if (x.error) throw x.error; toast('Two-step login is off'); return draw(); });
            }, n, 'pill ghost'), n);
          return;
        }
        box.replaceChildren(
          h('p', { class: 'p-hint', text: 'Add a second step to logging in: after your password, you type a 6-digit code from an app like Google Authenticator or Microsoft Authenticator. Someone who learns your password still can’t get in.' }),
          UI.action('Set up two-step login', setup, n, 'pill'), n);
      });
    }
    function setup() {
      // A setup left halfway blocks a new one, so clear those first
      return db.auth.mfa.listFactors().then(function (r) {
        var stale = ((r.data && r.data.all) || []).filter(function (f) { return f.status === 'unverified'; });
        return Promise.all(stale.map(function (f) { return db.auth.mfa.unenroll({ factorId: f.id }); }));
      }).then(function () {
        return db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PasaU ' + Date.now() });
      }).then(function (r) {
        if (r.error) throw r.error;
        var f = r.data, n = UI.note(), busy = false;
        var code = h('input', { id: 'tf-code', type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 6, placeholder: '123456' });
        function turnOn() {
          var c = code.value.replace(/\D/g, '');
          if (c.length !== 6) { UI.say(n, 'Enter the 6 digits from your app.', true); return; }
          if (busy) return;
          busy = true;
          return db.auth.mfa.challengeAndVerify({ factorId: f.id, code: c }).then(function (x) {
            busy = false;
            if (x.error) { UI.say(n, /invalid|expired/i.test(x.error.message) ? 'That code didn’t match. Type the newest code from the app.' : errText(x.error), true); return; }
            toast('Two-step login is on');
            return draw();
          }, function (e) { busy = false; throw e; });
        }
        // Six digits typed or pasted turns it on, no button press needed
        code.addEventListener('input', function () { if (code.value.replace(/\D/g, '').length === 6) Promise.resolve(turnOn()).catch(function (e) { UI.say(n, errText(e), true); }); });
        var phone = matchMedia('(pointer: coarse)').matches;
        box.replaceChildren.apply(box, [
          // On a phone one tap hands the account to the authenticator app; on a computer, scan the QR code with the phone
          phone ? h('a', { class: 'pill', href: f.totp.uri, text: '1. Add PasaU to my authenticator app' }) : h('p', { class: 'p-hint', text: '1. Scan this with your authenticator app (Google Authenticator, Microsoft Authenticator…).' }),
          phone ? null : h('img', { src: f.totp.qr_code, alt: 'QR code for your authenticator app', width: 180, height: 180, class: 'tf-qr' }),
          h('details', {}, [h('summary', { class: 'p-hint', text: phone ? 'Button didn’t work? Show a QR code and key' : 'Can’t scan? Show the setup key' }),
            phone ? h('img', { src: f.totp.qr_code, alt: 'QR code for your authenticator app', width: 180, height: 180, class: 'tf-qr' }) : null,
            field('Setup key', h('input', { id: 'tf-secret', type: 'text', readOnly: true, value: f.totp.secret }))]),
          field('2. Type the 6-digit code the app shows', code),
          UI.action('Turn on', turnOn, n, 'pill'),
          UI.action('Cancel', function () { return db.auth.mfa.unenroll({ factorId: f.id }).then(draw); }, null, 'pill ghost'), n].filter(Boolean));
        if (!phone) code.focus();
      });
    }
    draw();
    return box;
  }

  function notifSettings() {
    var prefs = Object.assign({}, mine.notify_prefs || {});
    var n = UI.note();
    return h('div', { class: 'p-form' }, NOTIF.map(function (k) {
      var box = h('input', { type: 'checkbox', id: 'nf-' + k[0], checked: prefs[k[0]] !== false });
      box.addEventListener('change', function () {
        prefs[k[0]] = box.checked;
        db.from('profiles').update({ notify_prefs: prefs }).eq('id', me.id).then(function (r) {
          if (r.error) { box.checked = !box.checked; return UI.say(n, errText(r.error), true); }
          mine.notify_prefs = prefs;
          UI.say(n, 'Saved');
        });
      });
      return h('label', { class: 'check', htmlFor: box.id }, [box, h('span', { text: k[1] })]);
    }).concat([n]));
  }

  function privacySettings() {
    var n = UI.note();
    function toggle(key, label) {
      var box = h('input', { type: 'checkbox', id: 'pv-' + key, checked: mine[key] !== false });
      box.addEventListener('change', function () {
        var patch = {}; patch[key] = box.checked;
        db.from('profiles').update(patch).eq('id', me.id).then(function (r) {
          if (r.error) { box.checked = !box.checked; return UI.say(n, errText(r.error), true); }
          mine[key] = box.checked;
          UI.say(n, 'Saved');
        });
      });
      return h('label', { class: 'check', htmlFor: box.id }, [box, h('span', { text: label })]);
    }
    return h('div', { class: 'p-form' }, [
      toggle('show_full_name', 'Show my full name (off: first name and last initial, e.g. "Juan D.")'),
      toggle('show_course_year', 'Show my course and year level to other students'),
      h('p', { class: 'p-hint', text: 'Only logged-in students can see profiles. Your email is never shown.' }), n
    ]);
  }

  function verification() {
    var box = h('div', { class: 'p-form' }, [h('p', { class: 'muted', text: 'Loading…' })]);
    if (mine.verified) { box.replaceChildren(h('p', {}, [h('span', { class: 'verified', text: '✓ Verified' }), ' Your profile shows the verified student badge.'])); return box; }
    db.from('verification_requests').select('status, created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(1).then(function (r) {
      var last = (r.data || [])[0];
      if (last && last.status === 'pending') { box.replaceChildren(h('p', { text: 'Request sent ' + day(last.created_at) + '. The PasaU team will review it.' })); return; }
      var n = UI.note();
      var email = h('input', { id: 'vr-email', type: 'email', placeholder: 'you@school.edu.ph', autocomplete: 'off' });
      var note = h('input', { id: 'vr-note', type: 'text', maxLength: 300, placeholder: 'Student number or anything that helps us confirm' });
      box.replaceChildren(
        h('p', { class: 'p-hint', text: (last && last.status === 'rejected' ? 'Your last request wasn’t approved. ' : '') + 'Verified students get a badge, so buyers and sellers know you’re really from your school.' }),
        field('School email (optional)', email), field('Note', note),
        UI.action('Request verification', function () {
          return db.from('verification_requests').insert({ school_email: email.value.trim() || null, note: note.value.trim() || null })
            .then(function (x) { ok(x); box.replaceChildren(h('p', { text: 'Request sent. The PasaU team will review it.' })); });
        }, n, 'pill'), n);
    });
    return box;
  }

  function blockedList() {
    var box = h('div', { class: 'p-form' }, [h('p', { class: 'muted', text: 'Loading…' })]);
    db.from('blocks').select('blocked_id, created_at').eq('blocker_id', me.id).then(function (r) {
      var rows = r.data || [];
      if (!rows.length) { box.replaceChildren(h('p', { class: 'p-hint', text: 'You haven’t blocked anyone.' })); return; }
      namesFor(rows.map(function (b) { return b.blocked_id; })).then(function (map) {
        box.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (b) {
          return h('li', { class: 'p-item' }, [h('div', { class: 'p-main' }, [h('p', { class: 'p-title', text: nameOf(map, b.blocked_id) }), h('p', { class: 'p-meta', text: 'Blocked ' + day(b.created_at) })]),
            UI.action('Unblock', function () {
              return db.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', b.blocked_id).then(function (x) { ok(x); toast('Unblocked'); refresh(); });
            }, null, 'pill light small')]);
        })));
      });
    });
    return box;
  }
})();

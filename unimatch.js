/* UniMatch: Looking For posts and matching on one page (unimatch.html).
   Matching itself runs in the database (db/matching.sql): wanted_matches() finds listings, wanted_pings records who was asked. */
(function () {
  var db = window.supabase.createClient(window.UC_CONFIG.url, window.UC_CONFIG.key);
  var h = UI.h, opt = UI.opt, toast = UI.toast, peso = UI.peso, errText = UI.errText, day = UI.day;
  var CATS = { books: 'Books', uniforms: 'Uniforms', supplies: 'School supplies', lab_art: 'Lab & art supplies', electronics: 'Electronics', dorm: 'Dorm & living', others: 'Others' };
  var SCHOOLS = window.UC_SCHOOLS || [];
  var params = new URLSearchParams(location.search);
  var me = null, profile = null;

  var form = document.getElementById('um-form'), need = document.getElementById('um-need'), cat = document.getElementById('um-cat');
  var max = document.getElementById('um-max'), school = document.getElementById('um-school'), postBtn = document.getElementById('um-post');
  var note = document.getElementById('um-note');
  var results = document.getElementById('um-results'), resultsH = document.getElementById('um-results-h'), resultsBody = document.getElementById('um-results-body');
  var mine = document.getElementById('um-mine'), mineBody = document.getElementById('um-mine-body');
  var asked = document.getElementById('um-asked'), askedBody = document.getElementById('um-asked-body');
  var boardBody = document.getElementById('um-board-body'), boardH = document.getElementById('um-board-h');

  function schoolOf(v) { return window.UC_SCHOOL_OF ? window.UC_SCHOOL_OF(v) : null; }
  function label(sc) { return sc ? (window.UC_SCHOOL_LABEL ? window.UC_SCHOOL_LABEL(sc) : sc.code) : ''; }
  function campusTag(v) { var sc = schoolOf(v); return h('span', { class: 'campus-tag' + (sc ? '' : ' unset'), text: sc ? label(sc) : 'Any campus' }); }
  function photoUrl(path) { return db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl; }
  function priceOf(l) { return l.kind === 'free' ? 'Free' : l.kind === 'swap' ? 'Swap' : peso(l.price_php); }
  function say(msg, bad) { UI.say(note, msg, bad); }
  // The campus this visitor cares about: their pick on the home page, else their profile school
  function focusSchool() {
    var picked = '';
    try { picked = localStorage.getItem('uc-campus') || ''; } catch (e) {}
    return schoolOf(picked) || (profile && schoolOf(profile.school)) || null;
  }
  function postMeta(w) {
    return [w.category ? CATS[w.category] : 'Any category', w.max_price_php === 0 ? 'Free only' : w.max_price_php != null ? 'Up to ' + peso(w.max_price_php) : null, 'Posted ' + day(w.created_at)].filter(Boolean).join(' · ');
  }

  // ---------- Form ----------
  cat.replaceChildren.apply(cat, [opt('', 'Any category')].concat(Object.keys(CATS).map(function (k) { return opt(k, CATS[k]); })));
  school.replaceChildren.apply(school, [opt('', 'Any campus')].concat(SCHOOLS.map(function (s) { return opt(s.name, s.name); })));
  if (params.get('need')) need.value = params.get('need').slice(0, 60);
  if (CATS[params.get('cat')]) cat.value = params.get('cat');
  if (/^\d{1,6}$/.test(params.get('max') || '')) max.value = params.get('max');
  if (params.get('school')) { school.value = params.get('school'); if (school.value) school.dataset.touched = '1'; }
  // Guests log in on the home page, then come back here with what they had typed
  function backHere(query) { return window.UCLoginUrl ? window.UCLoginUrl('unimatch.html' + query) : 'index.html?login=1'; }
  function draftQuery() {
    var q = new URLSearchParams();
    [['need', need.value.trim()], ['cat', cat.value], ['max', max.value], ['school', school.value]].forEach(function (p) { if (p[1]) q.set(p[0], p[1]); });
    return q.toString() ? '?' + q.toString() : '';
  }
  function setDefaultSchool() { var sc = focusSchool(); if (sc && !school.dataset.touched) school.value = sc.name; }
  school.addEventListener('change', function () { school.dataset.touched = '1'; });
  setDefaultSchool();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!me) { location.href = backHere(draftQuery()); return; }
    var title = need.value.trim();
    if (title.length < 3) { say('Say what you need in a few words, e.g. "anatomy textbook".', true); need.focus(); return; }
    var mx = max.value === '' ? null : parseInt(max.value, 10);
    if (mx != null && (!(mx >= 0) || mx > 1000000)) { say('Enter a max price in pesos, or leave it empty.', true); max.focus(); return; }
    postBtn.disabled = true;
    say('Posting and looking for matches…');
    db.from('wanted_posts').insert({ title: title, category: cat.value || null, max_price_php: mx, school: school.value || null })
      .select().single().then(function (r) {
        postBtn.disabled = false;
        if (r.error) return say(errText(r.error), true);
        say('');
        need.value = ''; max.value = '';
        showResults(r.data);
        loadMine();
        loadBoard();
      });
  });

  // ---------- Matches for one of your posts ----------
  function listingRow(l) {
    var ph = (l.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; })[0];
    return h('li', {}, [h('a', { class: 'p-item um-listing', href: 'index.html?open=' + l.id }, [
      ph ? h('img', { class: 'thumb', src: photoUrl(ph.path), alt: '', loading: 'lazy' }) : h('span', { class: 'thumb um-thumb', 'aria-hidden': 'true' }),
      h('span', { class: 'p-main' }, [
        h('span', { class: 'p-title', text: l.title }),
        h('span', { class: 'p-meta' }, [campusTag(l.school), [priceOf(l), l.pickup_spot].filter(Boolean).join(' · ')])
      ])
    ])]);
  }
  function matchesFor(w, box) {
    box.replaceChildren(h('p', { class: 'muted', text: 'Looking…' }));
    Promise.all([
      db.rpc('wanted_matches', { p_wanted: w.id }).select('id, title, kind, price_php, school, pickup_spot, seller_id, listing_photos(path, position)'),
      db.from('wanted_pings').select('user_id, reason').eq('wanted_id', w.id),
      db.from('wanted_replies').select('listing_id, listings(id, title, kind, price_php, school, pickup_spot, listing_photos(path, position))').eq('wanted_id', w.id)
    ]).then(function (res) {
      var listed = res[0].data || [], pings = res[1].data || [], replies = (res[2].data || []).filter(function (x) { return x.listings; });
      var kids = [];
      if (replies.length) {
        kids.push(h('h3', { text: 'Sent to you' }), h('ul', { class: 'p-list' }, replies.map(function (x) { return listingRow(x.listings); })));
      }
      kids.push(h('h3', { text: 'Listed now' }));
      if (res[0].error) kids.push(h('p', { class: 'muted', text: 'Matching isn’t set up yet (run db/matching.sql).' }));
      else if (!listed.length) kids.push(h('p', { class: 'muted', text: 'Nothing listed yet. We’ll notify you the moment a listing fits.' }));
      else kids.push(h('ul', { class: 'p-list' }, listed.map(listingRow)));
      var people = h('ul', { class: 'um-people' }, [h('li', { class: 'muted', text: pings.length ? 'Loading…' : 'No one to ask yet. We’ll keep watching new listings.' })]);
      kids.push(h('h3', { text: 'Students UniMatch asked' }), people);
      if (pings.length) kids.push(h('p', { class: 'p-hint', text: 'They got a notification. You’ll get one when someone replies.' }));
      box.replaceChildren.apply(box, kids);
      if (!pings.length) return;
      var why = {};
      pings.forEach(function (x) { why[x.user_id] = x.reason; });
      db.from('public_profiles').select('id, display_name, school, course, year_level, verified').in('id', pings.map(function (x) { return x.user_id; })).then(function (p) {
        var rows = p.data || [];
        people.replaceChildren.apply(people, rows.length ? rows.map(function (x) {
          var about = why[x.id] === 'listed' ? 'Has a listing that might fit' : [x.year_level, x.course].filter(Boolean).join(' · ') || 'Might have one';
          return h('li', {}, [UI.avatar(null, x.display_name, 32), h('span', {}, [h('a', { href: 'profile.html?u=' + x.id, text: x.display_name }),
            x.verified ? h('span', { class: 'verified', text: 'Verified' }) : null, h('small', { text: about })])]);
        }) : [h('li', { class: 'muted', text: 'Asked privately: students who got a similar item before.' })]);
      });
    }).catch(function (e) { box.replaceChildren(h('p', { class: 'note err', text: errText(e) })); });
  }
  function showResults(w) {
    results.hidden = false;
    resultsH.textContent = 'Matches for “' + w.title + '”';
    matchesFor(w, resultsBody);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Your posts ----------
  function loadMine() {
    if (!me) { mine.hidden = true; return; }
    db.from('wanted_posts').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).then(function (r) {
      var rows = r.data || [];
      mine.hidden = !rows.length && !r.error;
      if (r.error) return mineBody.replaceChildren(h('p', { class: 'note err', text: errText(r.error) }));
      mineBody.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (w) {
        var box = h('div', { class: 'um-inline', hidden: true });
        var toggle = h('button', { class: 'pill small', type: 'button', text: 'See matches', 'aria-expanded': 'false', onclick: function () {
          var open = box.hidden;
          box.hidden = !open;
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          toggle.textContent = open ? 'Hide matches' : 'See matches';
          if (open) matchesFor(w, box);
        } });
        var removeArmed = false;
        var remove = h('button', { class: 'pill ghost small', type: 'button', text: 'Remove', onclick: function () {
          if (!removeArmed) { removeArmed = true; remove.textContent = 'Tap again to remove'; setTimeout(function () { removeArmed = false; remove.textContent = 'Remove'; }, 4000); return; }
          remove.disabled = true;
          db.from('wanted_posts').delete().eq('id', w.id).then(function (d) {
            if (d.error) { remove.disabled = false; return toast(errText(d.error)); }
            toast('Looking For post removed');
            loadMine(); loadBoard();
          });
        } });
        var li = h('li', { class: 'p-item um-post', id: 'post-' + w.id }, [h('div', { class: 'p-main' }, [
          h('p', { class: 'p-title', text: w.title }),
          h('p', { class: 'p-meta' }, [campusTag(w.school), postMeta(w)]),
          h('div', { class: 'p-row' }, [toggle, remove]),
          box
        ])]);
        return li;
      })));
    });
  }

  // ---------- Posts UniMatch asked you about ----------
  var REASON = { listed: 'One of your listings might be it', owned: 'You got something like it on PasaU', course: 'A lower year in your course needs this' };
  function loadAsked() {
    if (!me) { asked.hidden = true; return; }
    db.from('wanted_pings').select('reason, created_at, wanted_posts(*)').eq('user_id', me.id).order('created_at', { ascending: false }).limit(20).then(function (r) {
      var rows = (r.data || []).filter(function (x) { return x.wanted_posts; });
      asked.hidden = !rows.length;
      askedBody.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (x) {
        var w = x.wanted_posts;
        return h('li', { class: 'p-item' }, [h('div', { class: 'p-main' }, [
          h('p', { class: 'p-title', text: w.title }),
          h('p', { class: 'p-meta' }, [campusTag(w.school), REASON[x.reason] || 'You might have one']),
          h('div', { class: 'p-row' }, [h('button', { class: 'pill small', type: 'button', text: 'I have this', onclick: function () { reply(w); } })])
        ])]);
      })));
    });
  }

  // ---------- Everyone's posts, your campus first ----------
  function loadBoard() {
    db.from('wanted_posts').select('*').order('created_at', { ascending: false }).limit(60).then(function (r) {
      if (r.error) return boardBody.replaceChildren(UI.empty('Couldn’t load Looking For posts.', errText(r.error), [h('button', { class: 'pill small', type: 'button', text: 'Try again', onclick: loadBoard })]));
      var rows = r.data || [], sc = focusSchool();
      boardH.textContent = sc ? 'Looking For right now · ' + label(sc) + ' first' : 'Looking For right now';
      if (sc) rows.sort(function (a, b) {
        var x = schoolOf(a.school), y = schoolOf(b.school);
        return ((y && y.code === sc.code) ? 1 : 0) - ((x && x.code === sc.code) ? 1 : 0);
      });
      if (!rows.length) return boardBody.replaceChildren(UI.empty('No Looking For posts yet.', 'Be the first: post what you need above and UniMatch will start looking.'));
      boardBody.replaceChildren(h('ul', { class: 'p-list' }, rows.map(function (w) {
        var own = me && w.user_id === me.id;
        return h('li', { class: 'p-item', id: own ? null : 'board-' + w.id }, [h('div', { class: 'p-main' }, [
          h('p', { class: 'p-title', text: w.title }),
          h('p', { class: 'p-meta' }, [campusTag(w.school), postMeta(w)]),
          h('div', { class: 'p-row' }, [own
            ? h('span', { class: 'p-chip', text: 'Your post' })
            : h('button', { class: 'pill small', type: 'button', text: 'I have this', onclick: function () { reply(w); } })])
        ])]);
      })));
    });
  }

  // ---------- "I have this": send one of your listings to the poster ----------
  var dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'um-reply-h' });
  document.body.append(dlg);
  var downOutside = false;
  dlg.addEventListener('pointerdown', function (e) { downOutside = e.target === dlg; });
  dlg.addEventListener('click', function (e) { if (downOutside && e.target === dlg) dlg.close(); downOutside = false; });
  var closeBtn = h('button', { class: 'round close', type: 'button', 'aria-label': 'Close', onclick: function () { dlg.close(); } });
  closeBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function reply(w) {
    if (!me) { location.href = backHere('?post=' + w.id); return; }
    var pick = h('select', { id: 'um-pick' }, [opt('', 'Loading your listings…')]);
    var n = UI.note();
    var send = h('button', { class: 'pill', type: 'button', text: 'Send as a match', onclick: function () {
      if (!pick.value) return UI.say(n, 'Choose one of your listings, or list it now.', true);
      send.disabled = true;
      db.from('wanted_replies').insert({ wanted_id: w.id, listing_id: Number(pick.value) }).then(function (r) {
        send.disabled = false;
        if (r.error && r.error.code !== '23505') return UI.say(n, errText(r.error), true);
        dlg.close();
        toast('Sent. They’ll get a notification with your listing.');
      });
    } });
    var listNow = h('a', { class: 'pill ghost', href: 'index.html?sell=1&title=' + encodeURIComponent(w.title) + (w.category ? '&cat=' + w.category : ''), text: 'Not listed yet? List it now' });
    dlg.replaceChildren(
      closeBtn,
      h('div', { class: 'sheet-in' }, [
        h('h2', { id: 'um-reply-h', text: 'I have this: ' + w.title }),
        h('p', { class: 'muted', text: 'Send one of your listings to the student who posted this. They’ll get a notification.' }),
        UI.field('Your listing', pick), send, listNow, n
      ]));
    dlg.showModal();
    db.from('listings').select('id, title').eq('seller_id', me.id).eq('status', 'active').then(function (r) {
      var rows = r.data || [];
      pick.replaceChildren.apply(pick, [opt('', rows.length ? 'Choose one of your listings…' : 'You have no active listings')].concat(rows.map(function (x) { return opt(x.id, x.title); })));
    });
  }

  // ---------- Start ----------
  db.auth.getSession().then(function (r) {
    me = r.data.session && r.data.session.user;
    if (!me) { postBtn.textContent = 'Log in to post'; loadBoard(); return Promise.resolve(); }
    return db.from('profiles').select('school, course, year_level').eq('id', me.id).maybeSingle().then(function (p) {
      profile = p.data;
      setDefaultSchool();
      loadMine(); loadAsked(); loadBoard();
    });
  }).then(function () {
    // ?post=<id> (from a notification or your profile): your post shows its matches; someone else's opens "I have this"
    var id = params.get('post');
    if (!id) { if (params.get('need')) need.focus(); return; }
    db.from('wanted_posts').select('*').eq('id', id).maybeSingle().then(function (r) {
      if (!r.data) return toast('That Looking For post was removed.');
      if (me && r.data.user_id === me.id) showResults(r.data);
      else reply(r.data);
    });
  });
})();

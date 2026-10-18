/* PasaU marketplace features F1–F10 (no boosting). Needs db/features.sql run in Supabase. */
(function () {
  var UC = window.UC;
  if (!UC) return;
  if (!UC.db) {
    var offline = function () { UC.toast('Can\u2019t reach PasaU right now. Check your connection and refresh the page.'); };
    document.querySelectorAll('[data-sell]').forEach(function (b) { b.addEventListener('click', offline); });
    var fsec = document.getElementById('spotlight');
    if (fsec) fsec.hidden = true;
    var wl = document.getElementById('wanted-list');
    if (wl) wl.firstElementChild.textContent = 'Looking For posts couldn\u2019t load. Check your connection and refresh the page.';
    return;
  }
  var db = UC.db, toast = UC.toast;
  var me = UC.user(), profile = null;

  var CATS = { books: 'Books', uniforms: 'Uniforms', supplies: 'School supplies', lab_art: 'Lab & art supplies', electronics: 'Electronics', dorm: 'Dorm & living', others: 'Others' };
  var CONDITIONS = ['New', 'Like new', 'Used', 'Worn'];
  var SPOTS = window.UC_DEFAULT_SPOTS || ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'];
  // A school's pickup spots, keeping a saved spot that isn't on the list any more
  function spotsFor(school, keep) {
    var list = (window.UC_SPOTS_FOR ? window.UC_SPOTS_FOR(school) : SPOTS).slice();
    if (keep && list.indexOf(keep) === -1) list.push(keep);
    return list;
  }
  function spotLabel(l) {
    var sc = window.UC_SCHOOL_OF ? window.UC_SCHOOL_OF(l.school) : null;
    return [sc && (window.UC_SCHOOL_LABEL ? window.UC_SCHOOL_LABEL(sc) : sc.code), l.pickup_spot].filter(Boolean).join(' \u00B7 ');
  }
  var YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate'];
  var MAX_PHOTO = 5 * 1024 * 1024;

  // ---------- tiny DOM helpers ----------
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.append(c); });
    return e;
  }
  function options(list, placeholder, labels) {
    var o = placeholder ? [h('option', { value: '', text: placeholder })] : [];
    return o.concat(list.map(function (v) { return h('option', { value: v, text: labels ? labels[v] : v }); }));
  }
  function opt(v, t) { return h('option', { value: v, text: t }); }
  function field(label, input) { return h('div', { class: 'field' }, [h('label', { htmlFor: input.id, text: label }), input]); }
  function peso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
  function when(t) { return new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function errText(e) {  // database messages written for students pass through; technical ones become one plain line
    var m = (e && (e.message || e.error_description)) || '';
    return m && m.length < 120 && !/fetch|network|jwt|permission|violates|relation|function|column|syntax|uuid|null value|schema|postgres|pgrst|duplicate key|constraint/i.test(m) ? m : 'Something went wrong. Try again.';
  }
  function need(fn) {
    return function () {
      if (!me) { toast('Log in first'); UC.openLogin(); return; }
      return fn.apply(this, arguments);
    };
  }
  function photoUrl(path) { return db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl; }

  // One reusable pop-up per feature
  var sheetN = 0;
  function sheet() {
    var tid = 'sheet-title-' + (++sheetN);
    var title = h('h2', { id: tid }), body = h('div', { class: 'sheet-in' });
    var dlg = h('dialog', { class: 'sheet', 'aria-labelledby': tid }, [
      h('button', { class: 'round close', type: 'button', 'aria-label': 'Close', onclick: function () { dlg.close(); } },
        [svgIcon('M6 6l12 12M18 6L6 18')]),
      body
    ]);
    dlg.addEventListener('click', function (e) { if (UC.outside ? UC.outside(dlg, e) : e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    return {
      dlg: dlg,
      open: function (t, kids) {
        title.textContent = t;
        body.replaceChildren.apply(body, [title].concat(kids));
        if (!dlg.open) dlg.showModal();
      },
      close: function () { dlg.close(); }
    };
  }
  function svgIcon(d) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'icon');
    s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  function noteEl() { return h('p', { class: 'note', 'aria-live': 'polite' }); }
  function say(n, msg, isErr) { n.textContent = msg; n.classList.toggle('err', !!isErr); }

  // ---------- account state ----------
  var bellBtn = document.getElementById('nav-bell'), bellCount = document.getElementById('bellcount');
  // Unread chats and the top bar's profile photo are handled by messenger.js (the chats dock)
  function initials(name) { var p = norm(name).split(' '); return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
  var noteChannel = null, unread = 0;
  function setUnread(n) { unread = n; bellCount.textContent = n; bellCount.hidden = n === 0; bellBtn.setAttribute('aria-label', 'Notifications, ' + n + ' unread'); }
  function onUser(u) {
    me = u;
    bellBtn.hidden = !u;
    if (noteChannel) { db.removeChannel(noteChannel); noteChannel = null; }
    profile = null;
    UC.blocked = {};
    renderWanted();
    if (!u) { if (UC.refilter) UC.refilter(); return; }
    // Parent / guardian accounts go to their own page (not while the log-in pop-up is open, e.g. setting a new password)
    db.from('profiles').select('role').eq('id', u.id).maybeSingle().then(function (r) {
      if (r.data && r.data.role === 'guardian' && !document.querySelector('dialog[open]')) location.replace('family.html');
    });
    db.from('profiles').select('full_name, school, year_level, course').eq('id', u.id).maybeSingle().then(function (r) {
      profile = r.data;
      if (profile && UC.campusDefault) UC.campusDefault(profile.school);
      refreshFilterOptions();
      renderForYou();
      renderWanted();
    });
    db.from('blocks').select('blocked_id').then(function (r) {
      (r.data || []).forEach(function (x) { UC.blocked[x.blocked_id] = 1; });
      if (UC.refilter) UC.refilter();
    });
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false).then(function (r) { setUnread(r.count || 0); });
    noteChannel = db.channel('notes-' + u.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + u.id }, function (p) {
        setUnread(unread + 1);
        toast(p.new.body);
      })
      .subscribe();
  }
  document.addEventListener('uc:user', function (e) { if ((e.detail && e.detail.id) !== (me && me.id) || !noteChannel) onUser(e.detail); });

  // ---------- Search & discovery: sort up front; course, year, type, condition, price behind "More filters" ----------
  // The campus is picked in the hero (index.html, UC.campus); it groups listings instead of hiding them.
  var SCHOOLS = window.UC_SCHOOLS || [];
  UC.blocked = UC.blocked || {};
  var fs = {};
  var fSort = h('select', { id: 'f-sort', 'aria-label': 'Sort listings' },
    [opt('new', 'Newest first'), opt('price-asc', 'Price: low to high'), opt('price-desc', 'Price: high to low')]);
  var fCourse = h('select', { id: 'f-course', 'aria-label': 'Course' });
  var fCode = h('input', { id: 'f-code', type: 'search', placeholder: 'Course code, e.g. CHEM 101', 'aria-label': 'Course code' });
  var fYear = h('select', { id: 'f-year', 'aria-label': 'Year level' }, options(YEARS, 'All year levels'));
  var fKind = h('select', { id: 'f-kind', 'aria-label': 'Listing type' },
    [opt('', 'Sale, swap & free'), opt('sell', 'For sale'), opt('swap', 'Swap'), opt('free', 'Free'), opt('wanted', 'Looking For posts (PasaMatch)')]);
  var fCond = h('select', { id: 'f-cond', 'aria-label': 'Condition' }, options(CONDITIONS, 'Any condition'));
  var fMin = h('input', { id: 'f-min', type: 'number', min: 0, step: 1, inputMode: 'numeric', placeholder: 'Min ₱', 'aria-label': 'Minimum price in pesos' });
  var fMax = h('input', { id: 'f-max', type: 'number', min: 0, step: 1, inputMode: 'numeric', placeholder: 'Max ₱', 'aria-label': 'Maximum price in pesos' });
  var fReset = h('button', { class: 'reset', type: 'button', text: 'Clear filters' });
  var fMore = h('button', { class: 'more', type: 'button', text: 'More filters', 'aria-expanded': 'false', 'aria-controls': 'f-more' });
  var morePanel = h('div', { id: 'f-more', class: 'filters-more', hidden: true }, [fCourse, fCode, fYear, fKind, fCond, fMin, fMax, fReset]);
  document.getElementById('filters-mount').append(h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter and sort listings' }, [fSort, fMore, morePanel]));
  function setMore(open) {
    morePanel.hidden = !open;
    fMore.setAttribute('aria-expanded', open ? 'true' : 'false');
    fMore.textContent = open ? 'Fewer filters' : 'More filters';
  }
  fMore.addEventListener('click', function () { setMore(morePanel.hidden); });
  UC.openFilters = function () { setMore(true); setTimeout(function () { fCourse.focus({ preventScroll: true }); }, 450); };
  function norm(v) { return (v || '').trim().replace(/\s+/g, ' '); }
  function same(a, b) { return norm(a).toLowerCase() === norm(b).toLowerCase(); }
  // Fixed Baguio list first, then any "Other" values people have typed
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) { v = norm(v); if (v && !/^your (university|school)$/i.test(v) && !seen[v.toLowerCase()]) { seen[v.toLowerCase()] = 1; out.push(v); } });
    return out;
  }
  function setOptions(sel, values, all) {
    var keep = sel.value;
    sel.replaceChildren.apply(sel, options(values, all));
    sel.value = values.indexOf(keep) !== -1 ? keep : '';
  }
  function campusSchool() { return UC.campusSchool ? UC.campusSchool() : null; }
  function schoolOf(v) { return window.UC_SCHOOL_OF ? window.UC_SCHOOL_OF(v) : null; }
  function campusLabel(sc) { return sc ? (window.UC_SCHOOL_LABEL ? window.UC_SCHOOL_LABEL(sc) : sc.code) : ''; }
  function inCampus(l, sc) { var c = schoolOf(l.school); return !!(sc && c && c.code === sc.code); }
  // Course choices follow the chosen campus
  function refreshFilterOptions() {
    var listed = Object.values(UC.listings), sc = campusSchool();
    var base = sc ? sc.courses : (window.UC_ALL_COURSES ? window.UC_ALL_COURSES() : []);
    var typed = listed.filter(function (l) { return !sc || inCampus(l, sc); }).map(function (l) { return l.program; });
    setOptions(fCourse, uniq(base.concat(typed)).sort(), sc ? 'All ' + campusLabel(sc) + ' courses' : 'All courses');
  }
  function num(v) { return v === '' ? null : Math.max(0, parseInt(v, 10) || 0); }
  function readQuiet() {
    fs = { course: fCourse.value, code: fCode.value.replace(/\s+/g, '').toUpperCase(), year: fYear.value,
           kind: fKind.value, cond: fCond.value, min: num(fMin.value), max: num(fMax.value) };
    UC.sortKey = fSort.value;
  }
  function readFilters() { readQuiet(); if (UC.refilter) UC.refilter(); }
  fKind.addEventListener('change', function () {
    if (fKind.value === 'wanted') { fKind.value = ''; location.href = 'unimatch.html'; return; }
    readFilters();
  });
  [fSort, fCourse, fYear, fCond].forEach(function (el) { el.addEventListener('change', readFilters); });
  [fCode, fMin, fMax].forEach(function (el) { el.addEventListener('input', readFilters); });
  UC.clearFilters = function () {
    [fCourse, fYear, fKind, fCond].forEach(function (el) { el.value = ''; });
    fCode.value = fMin.value = fMax.value = '';
    refreshFilterOptions();
    readQuiet();
  };
  fReset.addEventListener('click', function () { UC.clearFilters(); if (UC.refilter) UC.refilter(); });
  UC.showKind = function (k) {
    fKind.value = k;
    readFilters();
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  var KIND_LABEL = { sell: 'For sale', swap: 'Swap', free: 'Free' };
  // Chips above the grid show these and can remove them one by one
  UC.activeFilters = function () {
    var out = [];
    function chip(label, clear) { out.push({ label: label, clear: function () { clear(); readQuiet(); } }); }
    if (fs.course) chip(fs.course, function () { fCourse.value = ''; });
    if (fs.code) chip('Course ' + fCode.value.trim().toUpperCase(), function () { fCode.value = ''; });
    if (fs.year) chip(fs.year, function () { fYear.value = ''; });
    if (fs.kind) chip(KIND_LABEL[fs.kind], function () { fKind.value = ''; });
    if (fs.cond) chip(fs.cond, function () { fCond.value = ''; });
    if (fs.min != null || fs.max != null) {
      chip(fs.min != null && fs.max != null ? peso(fs.min) + '–' + peso(fs.max) : fs.min != null ? peso(fs.min) + ' and up' : 'Up to ' + peso(fs.max),
        function () { fMin.value = fMax.value = ''; });
    }
    return out;
  };
  UC.match = function (card) {
    var d = card.dataset;
    if (d.seller && UC.blocked[d.seller]) return false;
    if (!d.id) return true; // example cards
    var price = d.price === '' ? null : +d.price;
    return (!fs.course || same(d.program, fs.course)) &&
      (!fs.year || d.year === fs.year) && (!fs.code || d.course.replace(/\s+/g, '').indexOf(fs.code) !== -1) &&
      (!fs.kind || d.kind === fs.kind) && (!fs.cond || d.cond === fs.cond) &&
      (fs.min == null || (price != null && price >= fs.min)) && (fs.max == null || (price != null && price <= fs.max));
  };
  readQuiet();
  document.addEventListener('uc:listings', refreshFilterOptions);
  document.addEventListener('uc:campus', function () { refreshFilterOptions(); readQuiet(); renderSpotlight(); renderForYou(); renderWanted(); });

  // ---------- Free & swaps: the shop's own cards, free and swap in separate groups, your campus first ----------
  var FS_FIRST = 6;
  var fsSection = document.getElementById('spotlight');
  ['free-grid', 'swap-grid'].forEach(function (id) { var g = document.getElementById(id); if (g && UC.bindCards) UC.bindCards(g); });
  [].forEach.call(document.querySelectorAll('.fs-more'), function (b) {
    b.addEventListener('click', function () { if (UC.showKind) UC.showKind(b.dataset.kind); });
  });
  function renderSpotlight() {
    if (!fsSection || !UC.cardFor) return;
    var sc = campusSchool();
    var live = Object.values(UC.listings).filter(function (l) { return l.status === 'active' && !(UC.blocked && UC.blocked[l.seller_id]); })
      .sort(function (a, b) { return (inCampus(b, sc) ? 1 : 0) - (inCampus(a, sc) ? 1 : 0) || new Date(b.bumped_at || b.created_at) - new Date(a.bumped_at || a.created_at); });
    var total = 0;
    ['free', 'swap'].forEach(function (k) {
      var list = live.filter(function (l) { return l.kind === k; }), group = document.getElementById(k + '-group');
      if (!group) return;
      total += list.length;
      group.hidden = !list.length;
      document.getElementById(k + '-grid').replaceChildren.apply(document.getElementById(k + '-grid'), list.slice(0, FS_FIRST).map(UC.cardFor));
      group.querySelector('.fs-count').textContent = list.length === 1 ? '1 listing' : list.length + ' listings';
      group.querySelector('.fs-more').hidden = list.length <= FS_FIRST;
    });
    fsSection.hidden = !total;
    document.querySelectorAll('a[href="#spotlight"]').forEach(function (a) { a.hidden = !total; });
  }
  function spotCard(l) {
    {
      var media = h('div', { class: 'spot-media' });
      var photo = (l.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; })[0];
      var art = document.querySelector('#grid .card[data-id="' + l.id + '"] .media svg');
      if (photo) media.append(h('img', { src: photoUrl(photo.path), alt: '', loading: 'lazy' }));
      else if (art) media.append(art.cloneNode(true));
      var free = l.kind === 'free', swap = l.kind === 'swap';
      return h('article', { class: 'spot-card', role: 'listitem' }, [
        media,
        h('span', { class: 'spot-badge ' + l.kind, text: free ? 'Free' : swap ? 'Swap' : peso(l.price_php) }),
        h('b', { text: l.title }),
        h('small', { text: swap ? 'Wants: ' + (l.swap_for || 'make an offer') : [l.condition, l.pickup_spot].filter(Boolean).join(' · ') }),
        h('button', { class: 'pill small', type: 'button', text: free ? 'Claim' : swap ? 'Offer a swap' : 'See details', 'aria-label': (free ? 'Claim ' : swap ? 'Offer a swap for ' : 'See details: ') + l.title, onclick: function () { openDetail(l); } })
      ]);
    }
  }
  document.addEventListener('uc:listings', renderSpotlight);

  // For you: items from your school, your course first (logged in only, hidden when empty)
  var forYou = document.getElementById('foryou'), forYouRow = document.getElementById('foryou-row'), forYouTitle = document.getElementById('foryou-title');
  function renderForYou() {
    if (!forYou) return;
    var forSchool = campusSchool() || (profile && schoolOf(profile.school));
    if (!me || !profile || !forSchool) { forYou.hidden = true; return; }
    var items = Object.values(UC.listings).filter(function (l) {
      return l.seller_id !== me.id && l.status === 'active' && inCampus(l, forSchool) && !(UC.blocked && UC.blocked[l.seller_id]);
    }).sort(function (a, b) {
      return (same(b.program, profile.course) ? 1 : 0) - (same(a.program, profile.course) ? 1 : 0) || new Date(b.bumped_at || b.created_at) - new Date(a.bumped_at || a.created_at);
    }).slice(0, 10);
    forYou.hidden = !items.length;
    if (!items.length) return;
    forYouTitle.textContent = 'For you at ' + campusLabel(forSchool);
    forYouRow.replaceChildren.apply(forYouRow, items.map(spotCard));
  }
  document.addEventListener('uc:listings', renderForYou);
  renderSpotlight();
  refreshFilterOptions();

  // ---------- F1 / F2 / F3: sell, give away or swap ----------
  var sellSheet = sheet();
  UC.openSell = need(openSell);
  document.querySelectorAll('[data-sell]').forEach(function (b) { b.addEventListener('click', UC.openSell); });
  // Phone shortcuts under the hero search: pick the category in the shop and go there
  document.querySelectorAll('[data-jump]').forEach(function (b) {
    b.addEventListener('click', function () {
      var chip = document.querySelector('.chips [data-cat="' + b.getAttribute('data-jump') + '"]'), shop = document.getElementById('shop');
      if (chip) chip.click();
      if (shop) shop.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });
  // The floating Sell button tucks away while you scroll down through listings and comes back when you scroll up
  (function () {
    var fab = document.querySelector('.fab'), lastY = scrollY, busy = false;
    if (!fab) return;
    addEventListener('scroll', function () {
      if (busy) return;
      busy = true;
      requestAnimationFrame(function () {
        var y = scrollY;
        if (Math.abs(y - lastY) > 8) { fab.classList.toggle('tuck', y > lastY && y > 300); lastY = y; }
        busy = false;
      });
    }, { passive: true });
    fab.addEventListener('focus', function () { fab.classList.remove('tuck'); });
  })();
  function openSell(ex, preset) {
    ex = ex && ex.id ? ex : null;
    var kind = ex ? ex.kind : 'sell';
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Listing type' });
    var title = h('input', { id: 's-title', type: 'text', maxLength: 80, placeholder: 'e.g. PE shirt, size M' });
    var cat = h('select', { id: 's-cat' }, options(Object.keys(CATS), 'Choose…', CATS));
    var cond = h('select', { id: 's-cond' }, options(CONDITIONS, 'Choose…'));
    var price = h('input', { id: 's-price', type: 'number', min: 1, step: 1, inputMode: 'numeric', placeholder: '250' });
    var retail = h('input', { id: 's-retail', type: 'number', min: 1, step: 1, inputMode: 'numeric', placeholder: 'Optional' });
    var swapFor = h('input', { id: 's-swap', type: 'text', maxLength: 120, placeholder: 'e.g. Calculator or lab gown, size S' });
    var size = h('input', { id: 's-size', type: 'text', maxLength: 60, placeholder: 'Size, edition or model' });
    var spot = h('select', { id: 's-spot' }, options(spotsFor(profile && profile.school, ex && ex.pickup_spot)));
    var desc = h('textarea', { id: 's-desc', maxLength: 600, placeholder: 'Anything a buyer should know' });
    var mySchool = profile && window.UC_SCHOOL_BY_NAME ? window.UC_SCHOOL_BY_NAME(profile.school) : null;
    var courseList = mySchool ? mySchool.courses : (window.UC_ALL_COURSES ? window.UC_ALL_COURSES() : []);
    var program = h('select', { id: 's-program' }, [opt('', 'Not for a specific course')].concat(courseList.map(function (c) { return opt(c, c); }), [opt('other', 'Other (type it)')]));
    var programOther = h('input', { id: 's-program-other', type: 'text', maxLength: 60, placeholder: 'Type the course', 'aria-label': 'Course name', hidden: true });
    if (profile && profile.course) {
      if (courseList.indexOf(profile.course) !== -1) program.value = profile.course;
      else { program.value = 'other'; programOther.hidden = false; programOther.value = profile.course; }
    }
    program.addEventListener('change', function () { programOther.hidden = program.value !== 'other'; if (!programOther.hidden) programOther.focus(); });
    var course = h('input', { id: 's-course', type: 'text', maxLength: 20, placeholder: 'e.g. CHEM 101' });
    var year = h('select', { id: 's-year' }, options(YEARS, 'Any year'));
    if (profile && profile.year_level) year.value = profile.year_level;
    var photos = h('input', { id: 's-photos', type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true });
    var thumbs = h('div', { class: 'thumbs' });
    var priceRow = h('div', { class: 'grid2' }, [field('Price (₱)', price), field('Original price (₱)', retail)]);
    var swapRow = field('What do you want in exchange?', swapFor);
    var send = h('button', { class: 'pill', type: 'submit', text: 'Post listing' });
    var note = noteEl();
    ['sell', 'free', 'swap'].forEach(function (k) {
      seg.append(h('button', { type: 'button', text: { sell: 'Sell', free: 'Give away free', swap: 'Swap' }[k], 'aria-pressed': k === kind ? 'true' : 'false',
        onclick: function () {
          kind = k;
          [].forEach.call(seg.children, function (b, i) { b.setAttribute('aria-pressed', ['sell', 'free', 'swap'][i] === k ? 'true' : 'false'); });
          priceRow.hidden = k !== 'sell';
          swapRow.hidden = k !== 'swap';
        } }));
    });
    swapRow.hidden = kind !== 'swap';
    priceRow.hidden = kind !== 'sell';
    [].forEach.call(seg.children, function (b, i) { b.setAttribute('aria-pressed', ['sell', 'free', 'swap'][i] === kind ? 'true' : 'false'); });
    // Editing: fill in what's there; existing photos can be removed
    var keptPhotos = ex ? (ex.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; }) : [];
    var current = h('div', { class: 'thumbs' });
    function drawKept() {
      current.replaceChildren.apply(current, keptPhotos.map(function (ph) {
        return h('span', { class: 'kept' }, [h('img', { src: photoUrl(ph.path), alt: '' }), h('button', { type: 'button', class: 'x', 'aria-label': 'Remove this photo', text: '\u00D7', onclick: function () {
          db.from('listing_photos').delete().eq('listing_id', ex.id).eq('path', ph.path).then(function (r) {
            if (r.error) return say(note, errText(r.error), true);
            keptPhotos = keptPhotos.filter(function (k) { return k !== ph; });
            drawKept();
          });
        } })]);
      }));
    }
    if (ex) {
      title.value = ex.title || '';
      cat.value = ex.category || '';
      cond.value = ex.condition || '';
      if (ex.kind === 'sell') { price.value = ex.price_php || ''; retail.value = ex.retail_php || ''; }
      swapFor.value = ex.swap_for || '';
      size.value = ex.size || '';
      spot.value = ex.pickup_spot || SPOTS[0];
      desc.value = ex.description || '';
      course.value = ex.course_code || '';
      year.value = ex.year_level || '';
      if (ex.program) {
        if (courseList.indexOf(ex.program) !== -1) { program.value = ex.program; programOther.hidden = true; }
        else { program.value = 'other'; programOther.hidden = false; programOther.value = ex.program; }
      } else { program.value = ''; programOther.hidden = true; }
      send.textContent = 'Save changes';
      drawKept();
    } else if (preset) {
      title.value = preset.title || '';
      if (preset.category) cat.value = preset.category;
    }
    // Each pick adds to the photos already chosen (phones often pick one at a time); each can be removed
    var picked = [];
    function drawPicked() {
      thumbs.replaceChildren.apply(thumbs, picked.map(function (f, i) {
        return h('span', { class: 'kept' }, [h('img', { src: URL.createObjectURL(f), alt: '' }),
          h('button', { type: 'button', class: 'x', 'aria-label': 'Remove this photo', text: '×', onclick: function () { picked.splice(i, 1); drawPicked(); say(note, ''); } })]);
      }));
    }
    photos.addEventListener('change', function () {
      var room = 5 - keptPhotos.length - picked.length, chosen = [].slice.call(photos.files), tooBig = 0, full = 0;
      chosen.forEach(function (f) {
        if (f.size > MAX_PHOTO) { tooBig++; return; }
        if (picked.some(function (p) { return p.name === f.name && p.size === f.size && p.lastModified === f.lastModified; })) return;
        if (room > 0) { picked.push(f); room--; } else full++;
      });
      photos.value = '';  // so the same photo can be picked again after removing it
      drawPicked();
      if (tooBig) say(note, tooBig === 1 ? 'That photo is over 5 MB. Choose a smaller one.' : tooBig + ' photos are over 5 MB and were left out.', true);
      else if (full) say(note, 'Up to 5 photos in total.', true);
      else say(note, '');
    });
    var form = h('form', { noValidate: true, class: 'sheet-in', style: 'padding:0' }, [
      seg,
      ex ? current : null, field(ex ? 'Add photos (5 in total, 5 MB each)' : 'Photos (up to 5, 5 MB each)', photos), thumbs,
      field('Title', title),
      h('div', { class: 'grid2' }, [field('Category', cat), field('Condition', cond)]),
      priceRow, swapRow,
      h('div', { class: 'grid2' }, [field('Size / details', size), field(mySchool ? 'Pickup spot at ' + campusLabel(mySchool) : 'Pickup spot', spot)]),
      field('Description', desc),
      h('p', { class: 'muted', text: 'Course tags help classmates find it' }),
      field('Course', program), programOther,
      h('div', { class: 'grid2' }, [field('Course code', course), field('Year level', year)]),
      send, note
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var files = picked.slice();
      var p = parseInt(price.value, 10), r = parseInt(retail.value, 10);
      if (!files.length && !keptPhotos.length) return say(note, 'Add at least one photo.', true);
      if (files.length + keptPhotos.length > 5) return say(note, 'Up to 5 photos in total.', true);
      if (files.some(function (f) { return f.size > MAX_PHOTO; })) return say(note, 'Each photo must be 5 MB or smaller.', true);
      if (!title.value.trim()) return say(note, 'Add a title.', true);
      if (!cat.value) return say(note, 'Choose a category.', true);
      if (!cond.value) return say(note, 'Choose the condition.', true);
      if (kind === 'sell' && !(p > 0)) return say(note, 'Enter a price in pesos.', true);
      if (kind === 'swap' && !swapFor.value.trim()) return say(note, 'Say what you want in exchange.', true);
      send.disabled = true;
      say(note, ex ? 'Saving\u2026' : 'Posting\u2026');
      var row = {
        kind: kind, title: title.value.trim(), category: cat.value, condition: cond.value,
        price_php: kind === 'sell' ? p : 0, retail_php: kind === 'sell' && r > 0 ? r : null,
        swap_for: kind === 'swap' ? swapFor.value.trim() : null, size: size.value.trim() || null,
        pickup_spot: spot.value, description: desc.value.trim() || null,
        college: null, program: (program.value === 'other' ? programOther.value.trim() : program.value) || null,
        course_code: course.value.trim().toUpperCase() || null, year_level: year.value || null
      };
      if (!ex) row.seller_id = me.id;
      (ex ? db.from('listings').update(row).eq('id', ex.id).select('id').single() : db.from('listings').insert(row).select('id').single()).then(function (res) {
        if (res.error) throw res.error;
        var id = res.data.id, start = keptPhotos.length ? keptPhotos[keptPhotos.length - 1].position + 1 : 0;
        if (!files.length) return null;
        return Promise.all(files.map(function (f, i) {
          i += start;
          var path = me.id + '/' + id + '/' + i + '-' + Date.now() + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase();
          return db.storage.from('listing-photos').upload(path, f, { contentType: f.type }).then(function (u) {
            if (u.error) throw u.error;
            return { listing_id: id, path: path, position: i };
          });
        })).then(function (rows) { return db.from('listing_photos').insert(rows); });
      }).then(function (res) {
        if (res && res.error) throw res.error;
        sellSheet.close();
        toast(ex ? 'Changes saved' : kind === 'free' ? 'Posted. First to claim gets it.' : 'Listing posted');
        UC.reload();
      }).catch(function (err) {
        send.disabled = false;
        say(note, "Couldn't post: " + errText(err), true);
      });
    });
    sellSheet.open(ex ? 'Edit listing' : 'Post an item', [form]);
  }

  // ---------- Listing detail: reserve / claim / queue (F2, F9), swap offers (F3), meetups (F10) ----------
  var detail = sheet();
  document.addEventListener('uc:open', function (e) { if (e.detail) openDetail(e.detail); });
  function refreshDetail(id) {
    return UC.reload().then(function () {
      var l = UC.listings[id];
      if (l) openDetail(l); else detail.close();
    });
  }
  function rpc(name, args) {
    return db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var STEPS = ['Available', 'Interested', 'In line', 'Chat', 'Reserved', 'Meetup', 'Handover', 'Completed'];
  function drawSteps(l, box) {
    var mine = l.seller_id === me.id;
    box.hidden = true;
    Promise.all([
      db.from('transactions').select('status, buyer_id').eq('listing_id', l.id).order('created_at', { ascending: false }).limit(1),
      mine ? db.from('conversations').select('id').eq('listing_id', l.id).limit(1)
           : db.from('conversations').select('id').eq('listing_id', l.id).eq('buyer_id', me.id).limit(1),
      db.rpc(mine ? 'queue_count' : 'queue_position', { p_listing: l.id })
    ]).then(function (res) {
      var tx = (res[0].data || [])[0], st = tx && tx.status !== 'cancelled' ? tx.status : null;
      var chats = (res[1].data || []).length > 0, inLine = (res[2].data || 0) > 0, saved = !!(UC.saved && UC.saved[l.id]);
      var reached = [true, chats || inLine || saved || !!st, inLine || !!st, chats,
        !!st, st === 'meetup' || st === 'completed', st === 'completed', st === 'completed'];
      if (!mine && !reached[1]) return;
      var cur = reached.indexOf(false);
      box.replaceChildren.apply(box, STEPS.map(function (name, i) {
        return h('li', { class: reached[i] ? 'done' : i === cur ? 'now' : '', 'aria-current': i === cur ? 'step' : null, text: name });
      }));
      box.hidden = false;
    });
  }
  function openDetail(l) {
    // Count one view per listing per browser session (sellers' own views don't count)
    try {
      var seen = JSON.parse(sessionStorage.getItem('uc-viewed') || '[]');
      if (seen.indexOf(l.id) === -1) { seen.push(l.id); sessionStorage.setItem('uc-viewed', JSON.stringify(seen)); db.rpc('bump_view', { p_listing: l.id }).then(function () {}); }
    } catch (e) {}
    var card = document.querySelector('#grid .card[data-id="' + l.id + '"] .media');
    var photos = (l.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; });
    var gallery = h('div', { class: 'gallery' }, photos.length
      ? photos.map(function (p) { return h('div', {}, [h('img', { src: photoUrl(p.path), alt: l.title, loading: 'lazy' })]); })
      : [h('div', {}, card && card.firstElementChild ? [card.firstElementChild.cloneNode(true)] : [])]);
    var priceTxt = l.kind === 'free' ? 'Free' : l.kind === 'swap' ? 'Swap' : peso(l.price_php);
    function fact(label, v) { return v ? h('span', {}, [h('b', { text: label + ' ' }), String(v)]) : null; }
    var facts = h('div', { class: 'facts' }, [fact('Category', CATS[l.category]), fact('Condition', l.condition), fact('Size', l.size),
      fact('Pickup', spotLabel(l)), fact('Course', l.course_code), fact('Year', l.year_level), fact('College', l.college),
      fact('Program', l.program)].filter(Boolean));
    var seller = h('div', { class: 'seller-card' }, [h('p', { class: 'muted', text: me ? 'Loading seller\u2026' : 'Log in to see who\u2019s selling.' })]);
    if (me) db.from('public_profiles').select('display_name, avatar_url, school, course, year_level, verified, vouch_count').eq('id', l.seller_id).maybeSingle().then(function (r) {
      var pr = r.data;
      if (!pr) { seller.replaceChildren(); return; }
      var av = h('span', { class: 'avatar sm' }, [pr.avatar_url ? h('img', { src: pr.avatar_url, alt: '' }) : initials(pr.display_name)]);
      seller.replaceChildren(av, h('div', {}, [
        h('a', { href: 'profile.html?u=' + l.seller_id, text: l.seller_id === me.id ? 'You' : pr.display_name }),
        pr.verified ? h('span', { class: 'verified', text: '\u2713 Verified' }) : null,
        h('small', { text: [pr.school, pr.course, pr.year_level, (pr.vouch_count || 0) + (pr.vouch_count === 1 ? ' vouch' : ' vouches')].filter(Boolean).join(' \u00B7 ') })
      ]));
    });
    var steps = me ? h('ol', { class: 'steps-bar', 'aria-label': 'Where this deal is' }) : null;
    if (steps) drawSteps(l, steps);
    var actions = h('div', { class: 'box' }, [h('p', { class: 'muted', text: 'Loading…' })]);
    var statusBadge = h('span', { class: 'status-badge' + (l.status === 'reserved' ? '' : ' ok'), text: l.status === 'reserved' ? 'Reserved' : 'Available' });
    if (l.status === 'reserved') db.rpc('queue_count', { p_listing: l.id }).then(function (r) {
      if (!r.error && r.data > 0) statusBadge.textContent = 'Reserved \u00B7 ' + r.data + (r.data === 1 ? ' person' : ' people') + ' in line';
    });
    detail.open(l.title, [
      gallery,
      h('div', { class: 'price-row' }, [h('div', { class: 'bigprice', text: priceTxt }), statusBadge, me && l.seller_id !== me.id ? saveHeart(l) : null]),
      l.kind === 'swap' && l.swap_for ? h('p', { text: 'Wants in exchange: ' + l.swap_for }) : null,
      facts,
      seller,
      l.description ? h('p', { class: 'muted', text: l.description }) : null,
      steps,
      actions
    ].filter(Boolean));
    renderActions(l, actions);
  }

  function saveHeart(l) {
    var on = !!(UC.saved && UC.saved[l.id]);
    var b = h('button', { class: 'round heart sheet-heart', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'Save ' + l.title });
    b.appendChild(svgIcon('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'));
    b.addEventListener('click', function () { b.disabled = true; toggleSave(l, b).catch(function (e) { b.disabled = false; toast(errText(e)); }); });
    return b;
  }
  function renderActions(l, box) {
    var note = noteEl();
    function done(msg) { if (msg) toast(msg); refreshDetail(l.id); }
    function fail(e) { say(note, errText(e), true); }
    function btn(text, fn, ghost) {
      return h('button', { class: 'pill' + (ghost ? ' ghost' : ''), type: 'button', text: text, onclick: function () { var b = this; b.disabled = true; Promise.resolve().then(function () { return fn(b); }).catch(function (e) { b.disabled = false; fail(e); }); } });
    }
    if (!me) {
      box.replaceChildren(h('p', { text: 'Log in to reserve, swap or message the seller. Reserving holds it for you; anyone after you joins a queue. You pay the seller directly at the handover.' }), btn('Log in', function () { UC.openLogin(); }));
      return;
    }
    var mine = l.seller_id === me.id, mineReserved = l.reserved_by === me.id;
    var kids = [];
    if (mine) {
      kids.push(h('h3', { text: 'Your listing' }));
      kids.push(h('p', { class: 'muted', text: (l.views || 0) + (l.views === 1 ? ' view' : ' views') + ' \u00B7 listed ' + when(l.bumped_at || l.created_at) }));
      var stSel = h('select', { id: 'd-status', 'aria-label': 'Listing status' }, [opt('active', 'Available'), opt('reserved', 'Reserved'), opt('sold', 'Sold')]);
      stSel.value = l.status;
      stSel.addEventListener('change', function () {
        var v = stSel.value;
        if (v === 'sold' && !stSel.dataset.armed) { stSel.dataset.armed = '1'; stSel.value = l.status; say(note, 'Choose Sold again to confirm. Everyone in line will be told it\u2019s gone.'); return; }
        rpc('set_listing_status', { p_listing: l.id, p_status: v }).then(function () { done(v === 'sold' ? 'Marked as sold' : v === 'active' ? 'Marked as available' : 'Marked as reserved'); })
          .catch(function (e) { stSel.value = l.status; fail(e); });
      });
      kids.push(h('div', { class: 'owner-row' }, [field('Status', stSel),
        btn('Edit', function () { detail.close(); openSell(l); }, true),
        btn('Renew', function () { return rpc('renew_listing', { p_listing: l.id }).then(function () { done('Renewed: it\u2019s back at the top of Newest'); }); }, true)]));
      var line = h('div', { class: 'box' }, [h('h3', { text: 'People in line' }), h('p', { class: 'muted', text: 'Loading\u2026' })]);
      kids.push(line);
      db.from('queue_entries').select('user_id, created_at').eq('listing_id', l.id).order('created_at').then(function (r) {
        var q = r.data || [];
        var ids = q.map(function (x) { return x.user_id; }).concat(l.reserved_by ? [l.reserved_by] : []);
        (ids.length ? db.from('public_profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] })).then(function (pr) {
          var nm = {};
          (pr.data || []).forEach(function (x) { nm[x.id] = x.display_name; });
          var kids2 = [h('h3', { text: 'People in line' })];
          if (l.reserved_by) kids2.push(h('p', {}, [h('b', { text: 'Reserved by ' }), nm[l.reserved_by] || 'a buyer']));
          kids2.push(q.length ? h('ol', { class: 'p-queue' }, q.map(function (x) { return h('li', { text: nm[x.user_id] || 'A student' }); }))
                              : h('p', { class: 'muted', text: 'Nobody in line yet.' }));
          if (l.status === 'reserved' && l.reserved_by) {
            kids2.push(btn(q.length ? 'Move to next in line' : 'Release reservation', function () {
              return rpc('release_reservation', { p_listing: l.id }).then(function () { done(q.length ? 'Offered to the next person in line' : 'Reservation released'); });
            }, true));
          }
          line.replaceChildren.apply(line, kids2);
        });
      });
      var offersBox = h('div', { class: 'box' }, [h('h3', { text: 'Offers' }), h('p', { class: 'muted', text: 'Loading…' })]);
      kids.push(offersBox);
      loadOffers(l, offersBox, done, fail);
      var armed = false;
      kids.push(btn('Remove listing', function (b) {
        if (!armed) { armed = true; b.textContent = 'Tap again to remove'; b.disabled = false; return; }
        detail.close();
        var card = document.querySelector('#grid .card[data-id="' + l.id + '"]');
        if (card) card.hidden = true;
        undoToast('Listing removed.', 6000, function () {
          return db.from('listings').delete().eq('id', l.id).then(function (r) {
            if (r.error) { if (card) card.hidden = false; toast(errText(r.error)); return; }
            UC.reload();
          });
        }, function () { if (card) card.hidden = false; toast('Kept your listing.'); });
      }, true));
      kids.push(h('a', { class: 'linkish', href: 'profile.html#listings', text: 'Manage all your listings' }));
    } else {
      if (UC.blocked[l.seller_id]) {
        box.replaceChildren(h('p', { text: 'You blocked this seller, so their listings and messages are hidden from you.' }),
          btn('Unblock seller', function () {
            return db.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', l.seller_id).then(function (r) {
              if (r.error) throw r.error;
              delete UC.blocked[l.seller_id];
              if (UC.refilter) UC.refilter();
              done('Seller unblocked');
            });
          }, true), note);
        return;
      }
      if (mineReserved) {
        kids.push(h('h3', { text: l.kind === 'free' ? 'You claimed this' : 'Reserved for you' }));
        kids.push(btn('Back out', function () { return rpc('release_reservation', { p_listing: l.id }).then(function () { done('You backed out. The next person is notified.'); }); }, true));
      } else if (l.kind === 'swap' && l.status === 'active') {
        kids.push(swapForm(l, done, fail));
      } else {
        var slot = h('div', { class: 'box', style: 'padding:0;border:0;background:none' }, [h('p', { class: 'muted', text: 'Checking the queue…' })]);
        kids.push(slot);
        rpc('queue_position', { p_listing: l.id }).then(function (pos) {
          if (pos > 0) {
            slot.replaceChildren(h('p', { text: 'You’re #' + pos + ' in the queue. We’ll notify you if it’s your turn.' }),
              btn('Leave queue', function () { return db.from('queue_entries').delete().eq('listing_id', l.id).eq('user_id', me.id).then(function () { done('You left the queue'); }); }, true));
          } else {
            var label = l.status === 'reserved' ? 'Join the queue' : l.kind === 'free' ? 'Claim for free' : 'Reserve';
            slot.replaceChildren.apply(slot, [
              l.status === 'reserved' ? h('p', { class: 'muted', text: 'Someone reserved this. Join the queue and it’s offered to you automatically if they back out.' }) : null,
              btn(label, function () {
                return rpc('claim_listing', { p_listing: l.id }).then(function (r) {
                  done(r.state === 'reserved' ? (l.kind === 'free' ? 'Claimed! Arrange a meetup next.' : 'Reserved! Arrange a meetup next.') : 'You’re #' + r.position + ' in the queue');
                });
              })].filter(Boolean));
          }
        }).catch(fail);
      }
    }
    if (!mine) kids.push(btn('Message seller', function () { return openChat(l); }, true));
    if (l.status === 'reserved' && (mine || mineReserved)) {
      var meet = h('div', { class: 'box' }, [h('h3', { text: 'Campus meetup' }), h('p', { class: 'muted', text: 'Loading…' })]);
      kids.push(meet);
      loadMeetup(l, meet, mine, done, fail);
    }
    if (!mine) kids.push(h('button', { class: 'linkish', type: 'button', text: 'Report this listing or seller', onclick: function () { openReport(l); } }));
    kids.push(note);
    box.replaceChildren.apply(box, kids);
  }

  // Toast with an Undo button: the action runs only once the toast times out
  function undoToast(msg, ms, commit, undo) {
    var el = document.getElementById('toast'), t;
    if (!el) return commit();
    var u = h('button', { class: 'toast-undo', type: 'button', text: 'Undo', onclick: function () { clearTimeout(t); el.classList.remove('show', 'has-act'); undo(); } });
    el.replaceChildren(document.createTextNode(msg + ' '), u);
    el.classList.add('show', 'has-act');
    t = setTimeout(function () { el.classList.remove('show', 'has-act'); commit(); }, ms);
  }
  function toggleSave(l, b) {
    var on = !(UC.saved && UC.saved[l.id]);
    var q = on ? db.from('saves').insert({ user_id: me.id, listing_id: l.id })
               : db.from('saves').delete().eq('user_id', me.id).eq('listing_id', l.id);
    return q.then(function (r) {
      if (r.error && r.error.code !== '23505') throw r.error;
      UC.saved = UC.saved || {};
      if (on) UC.saved[l.id] = 1; else delete UC.saved[l.id];
      var hb = document.querySelector('#grid .card[data-id="' + l.id + '"] .heart');
      if (hb) hb.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (b.classList.contains('heart')) b.setAttribute('aria-pressed', on ? 'true' : 'false'); else b.textContent = on ? 'Saved ♥' : 'Save item';
      b.disabled = false;
      toast(on ? 'Saved. Find it under the Saved filter.' : 'Removed from Saved');
    });
  }

  // ---------- Safety: report a listing or seller, optionally block ----------
  var reportSheet = sheet();
  var REASONS = ['Prohibited or unsafe item', 'Scam or misleading', 'Spam or wrong category', 'Offensive content', 'Harassment', 'Other'];
  function openReport(l) {
    var what = h('select', { id: 'r-what' }, [opt('listing', 'This listing'), opt('user', 'The seller')]);
    var reason = h('select', { id: 'r-reason' }, [opt('', 'Choose a reason…')].concat(REASONS.map(function (r) { return opt(r, r); })));
    var details = h('textarea', { id: 'r-details', maxLength: 600, placeholder: 'What happened? (optional)' });
    var block = h('input', { id: 'r-block', type: 'checkbox' });
    var note = noteEl();
    var send = h('button', { class: 'pill', type: 'button', text: 'Send report', onclick: function () {
      if (!reason.value) return say(note, 'Choose a reason.', true);
      send.disabled = true;
      db.from('reports').insert({ listing_id: what.value === 'listing' ? l.id : null, reported_user_id: l.seller_id,
                                  reason: reason.value, details: details.value.trim() || null })
        .then(function (r) {
          if (r.error) throw r.error;
          return block.checked ? db.from('blocks').insert({ blocked_id: l.seller_id }) : null;
        })
        .then(function (r) {
          if (r && r.error && r.error.code !== '23505') throw r.error;
          reportSheet.close();
          if (block.checked) { UC.blocked[l.seller_id] = 1; if (UC.refilter) UC.refilter(); detail.close(); }
          toast(block.checked ? 'Report sent. You won’t see this seller’s listings or messages.' : 'Report sent. Thanks for keeping PasaU safe.');
        })
        .catch(function (e) { send.disabled = false; say(note, errText(e), true); });
    } });
    reportSheet.open('Report', [
      h('p', { class: 'muted', text: 'Reports go to the PasaU team. The seller isn’t told who reported them.' }),
      field('What are you reporting?', what), field('Reason', reason), field('Details', details),
      h('label', { class: 'check', htmlFor: 'r-block' }, [block, h('span', { text: 'Also block this seller (hide their listings and stop messages)' })]),
      send, note
    ]);
  }

  function swapForm(l, done, fail) {
    var pick = h('select', { id: 'swap-pick' }, [h('option', { value: '', text: 'Loading your listings…' })]);
    var wrap = h('div', { class: 'box' }, [h('h3', { text: 'Offer a swap' }), field('Offer one of your listings', pick)]);
    var send = h('button', { class: 'pill', type: 'button', text: 'Send swap offer', onclick: function () {
      if (!pick.value) return fail({ message: 'Choose one of your listings to offer.' });
      send.disabled = true;
      db.from('offers').insert({ listing_id: l.id, buyer_id: me.id, offered_listing_id: Number(pick.value) }).then(function (r) {
        send.disabled = false;
        if (r.error) return fail(r.error);
        done('Swap offer sent');
      });
    } });
    wrap.append(send);
    db.from('listings').select('id, title').eq('seller_id', me.id).eq('status', 'active').neq('id', l.id).then(function (r) {
      var rows = r.data || [];
      pick.replaceChildren.apply(pick, rows.length ? [h('option', { value: '', text: 'Choose…' })].concat(rows.map(function (x) { return h('option', { value: x.id, text: x.title }); }))
        : [h('option', { value: '', text: 'Post a listing first to offer it' })]);
    });
    return wrap;
  }

  function loadOffers(l, box, done, fail) {
    db.from('offers').select('id, buyer_id, amount_php, status, created_at, offered:listings!offers_offered_listing_id_fkey(id, title)')
      .eq('listing_id', l.id).order('created_at').then(function (r) {
        if (r.error) return box.replaceChildren(h('h3', { text: 'Offers' }), h('p', { class: 'muted', text: errText(r.error) }));
        var rows = r.data || [];
        if (!rows.length) return box.replaceChildren(h('h3', { text: 'Offers' }), h('p', { class: 'muted', text: 'No offers yet.' }));
        box.replaceChildren.apply(box, [h('h3', { text: 'Offers' })].concat(rows.map(function (o) {
          var what = o.offered ? 'Swap for: ' + o.offered.title : peso(o.amount_php);
          var row = h('div', { class: 'offer-row' }, [h('span', { text: what + ' · ' + o.status })]);
          if (o.status === 'pending' && l.status === 'active') {
            row.append(h('button', { class: 'pill', type: 'button', text: 'Accept', onclick: function () {
              this.disabled = true;
              rpc('accept_offer', { p_offer: o.id }).then(function () { done('Offer accepted. Arrange a meetup.'); }).catch(fail);
            } }));
          }
          return row;
        })));
      });
  }

  // datetime-local bounds as local "YYYY-MM-DDTHH:MM", days from now
  function localStamp(days) {
    var d = new Date(Date.now() + days * 864e5);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  // A meetup time must be a real date, in the future, within the next year
  function meetupTime(v) {
    if (!v) return { error: 'Pick a date and time.' };
    var t = new Date(v);
    if (isNaN(t.getTime())) return { error: 'That date isn’t valid. Check the year has 4 digits.' };
    if (t.getTime() < Date.now()) return { error: 'Pick a time in the future.' };
    if (t.getTime() > Date.now() + 366 * 864e5) return { error: 'Pick a time within the next year.' };
    return { iso: t.toISOString() };
  }
  UC.meetupTime = meetupTime;
  function loadMeetup(l, box, isSeller, done, fail) {
    db.from('meetups').select('*').eq('listing_id', l.id).in('status', ['proposed', 'accepted']).order('created_at', { ascending: false }).limit(1)
      .then(function (r) {
        var m = r.data && r.data[0];
        var head = h('h3', { text: 'Campus meetup' });
        var spot = h('select', { id: 'm-spot' }, options(spotsFor(l.school)));
        var at = h('input', { id: 'm-at', type: 'datetime-local', min: localStamp(0), max: localStamp(365) });
        var proposeBtn = h('button', { class: 'pill', type: 'button', text: m ? 'Suggest another time' : 'Propose meetup', onclick: function () {
          var when = meetupTime(at.value);
          if (when.error) return fail({ message: when.error });
          this.disabled = true;
          var b = this;
          rpc('propose_meetup', { p_listing: l.id, p_spot: spot.value, p_at: when.iso })
            .then(function () { done('Meetup proposed. It’s in your chat too.'); }).catch(function (e) { b.disabled = false; fail(e); });
        } });
        var form = h('div', { class: 'grid2' }, [field('Pickup spot', spot), field('Date and time', at)]);
        if (!m) return box.replaceChildren(head, form, proposeBtn);
        var info = h('p', { text: m.spot + ' · ' + when(m.meet_at) + ' · ' + (m.status === 'accepted' ? 'Confirmed by both' : 'Waiting for a reply') });
        var kids = [head, info];
        if (m.status === 'proposed' && m.proposed_by !== me.id) {
          kids.push(h('button', { class: 'pill', type: 'button', text: 'Accept meetup', onclick: function () {
            this.disabled = true;
            rpc('accept_meetup', { p_meetup: m.id }).then(function () { done('Meetup confirmed'); }).catch(fail);
          } }));
        }
        if (m.status === 'accepted' && !isSeller) {
          var codeEl = h('div', { class: 'code', text: '······' });
          kids.push(h('p', { class: 'muted', text: 'Check the item first, then read this code to the seller. No code, no sale.' }), codeEl);
          db.from('meetup_codes').select('code').eq('meetup_id', m.id).maybeSingle().then(function (c) { if (c.data) codeEl.textContent = c.data.code; });
        }
        if (m.status === 'accepted' && isSeller) {
          var code = h('input', { id: 'm-code', type: 'text', inputMode: 'numeric', maxLength: 6, placeholder: '6-digit code from the buyer' });
          kids.push(h('p', { class: 'muted', text: 'When you hand it over, type the code the buyer reads to you. No code, no sale.' }), field('Handover code', code), h('button', { class: 'pill', type: 'button', text: 'Confirm handover', onclick: function () {
            this.disabled = true;
            var b = this;
            rpc('confirm_handover', { p_meetup: m.id, p_code: code.value }).then(function () { done('Handover confirmed. Marked as sold.'); })
              .catch(function (e) { b.disabled = false; fail(e); });
          } }));
        }
        var other = h('details', {}, [h('summary', { text: 'Suggest another time or place' }), form, proposeBtn]);
        kids.push(other, h('button', { class: 'linkish', type: 'button', text: 'Cancel this meetup', onclick: function () {
          this.disabled = true;
          rpc('cancel_meetup', { p_meetup: m.id }).then(function () { done('Meetup cancelled'); }).catch(fail);
        } }));
        box.replaceChildren.apply(box, kids);
      });
  }

  // ---------- Looking For lives on PasaMatch (unimatch.html); the home page previews the newest posts ----------
  var wantedList = document.getElementById('wanted-list');
  function renderWanted() {
    if (!wantedList || !db) return;
    db.from('wanted_posts').select('id, title, category, school, max_price_php, user_id, created_at').order('created_at', { ascending: false }).limit(12).then(function (r) {
      var rows = r.data || [], focus = campusSchool() || (profile && schoolOf(profile.school));
      function here(w) { var sc = schoolOf(w.school); return focus && sc && sc.code === focus.code ? 1 : 0; }
      if (focus) rows.sort(function (a, b) { return here(b) - here(a); });
      rows = rows.slice(0, 3);
      if (r.error || !rows.length) {
        wantedList.replaceChildren(h('li', { class: 'wl-empty', text: r.error ? 'Looking For posts are not set up yet.' : 'No Looking For posts yet. Be the first on PasaMatch.' }));
        return;
      }
      wantedList.replaceChildren.apply(wantedList, rows.map(function (w) {
        var own = me && w.user_id === me.id, sc = schoolOf(w.school);
        var bits = [w.category && CATS[w.category], w.max_price_php === 0 ? 'Free only' : w.max_price_php != null && 'Up to ' + peso(w.max_price_php), sc ? campusLabel(sc) : 'Any campus'].filter(Boolean).join(' \u00B7 ');
        return h('li', {}, [
          here(w) ? h('span', { class: 'wl-tag', text: 'At ' + campusLabel(focus) }) : null,
          h('b', { text: w.title }), h('small', { text: bits }),
          h('a', { class: 'wl-link', href: 'unimatch.html?post=' + w.id, text: own ? 'See matches' : 'I have this' })
        ]);
      }));
    });
  }

  // ---------- Notifications ----------
  var noteSheet = sheet();
  bellBtn.addEventListener('click', need(function () {
    var list = h('ul', { class: 'notes' }, [h('li', { text: 'Loading…' })]);
    noteSheet.open('Notifications', [list]);
    db.from('notifications').select('*').order('created_at', { ascending: false }).limit(40).then(function (r) {
      var rows = r.data || [];
      if (!rows.length) { list.replaceChildren(h('li', { text: 'Nothing yet.' })); return; }
      list.replaceChildren.apply(list, rows.map(function (n) {
        return h('li', { class: n.read ? '' : 'unread', tabIndex: 0, role: 'button',
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } }, onclick: function () {
          if (/^New message/.test(n.body) && window.UCChats) { noteSheet.close(); window.UCChats.open(); return; }
          if (/^(New message|Meetup|Handover|Your meetup)/.test(n.body)) { location.href = 'messages.html'; return; }
          var l = n.listing_id && UC.listings[n.listing_id];
          if (l) { noteSheet.close(); openDetail(l); }
          else if (n.wanted_id) location.href = 'unimatch.html?post=' + n.wanted_id;
        } }, [h('span', { text: n.body }), h('small', { text: when(n.created_at) })]);
      }));
      db.from('notifications').update({ read: true }).eq('read', false).eq('user_id', me.id).then(function () { setUnread(0); });
    });
  }));

  // ---------- Chat: opens in the chats dock (messenger.js); messages.html is the full page ----------
  function openChat(l) {
    return db.from('conversations').select('id').eq('listing_id', l.id).eq('buyer_id', me.id).maybeSingle()
      .then(function (r) {
        if (r.data) return r.data;
        return db.from('conversations').insert({ listing_id: l.id, buyer_id: me.id, seller_id: l.seller_id })
          .select('id').single().then(function (c) { if (c.error) throw c.error; return c.data; });
      }).then(function (c) {
        if (window.UCChats) { detail.close(); window.UCChats.openConversation(c.id); }
        else location.href = 'messages.html?c=' + c.id;
      });
  }

  // Deep links from other pages: ?open=<id>, ?edit=<id>, ?wanted=<id>, ?sell=1, ?login=1
  var params = new URLSearchParams(location.search);
  function fetchListing(id) {
    if (UC.listings[id]) return Promise.resolve(UC.listings[id]);
    return db.from('listings').select('*, listing_photos(path, position)').eq('id', id).maybeSingle().then(function (r) { return r.data; });
  }
  db.auth.getSession().then(function (r) {
    var who = r.data.session && r.data.session.user;
    if (params.get('login') && !who) UC.openLogin();
    // ?sell=1 can carry a title and category, e.g. from PasaMatch's "List it now"
    if (params.get('sell')) { if (who) { me = who; openSell(null, params.get('title') ? { title: params.get('title'), category: params.get('cat') } : null); } else UC.openLogin(); }
    if (params.get('wanted')) { location.replace('unimatch.html?post=' + encodeURIComponent(params.get('wanted'))); return; }
    var id = params.get('edit') || params.get('open');
    if (!id) return;
    var go = function () {
      fetchListing(id).then(function (l) {
        if (!l) return toast('That listing isn\u2019t available any more.');
        if (params.get('edit') && who && l.seller_id === who.id) { me = who; openSell(l); } else openDetail(l);
      });
    };
    if (Object.keys(UC.listings).length) go();
    else document.addEventListener('uc:listings', function once() { document.removeEventListener('uc:listings', once); go(); });
  });

  onUser(me);
})();

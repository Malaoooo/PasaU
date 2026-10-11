/* Chats dock: a Messenger-style button in the bottom-right corner that opens your conversations in a side panel,
   where you can read and reply without leaving the page. messages.html stays the full-page version (meetups, photos).
   Also fills the top bar's profile photo (#nav-me). Load after the page's own scripts. */
(function () {
  var cfg = window.UC_CONFIG;
  if (!cfg || !window.supabase) return;
  var db = (window.UC && window.UC.db) || window.supabase.createClient(cfg.url, cfg.key);
  var me = null, convos = [], current = null, seen = {}, channel = null, total = 0, names = {};

  function h(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.append(c); });
    return e;
  }
  function svg(d, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', cls || 'icon');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  function initials(name) {
    var p = (name || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function face(url, name, size) {
    var b = h('span', { class: 'dock-face', style: 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px' });
    if (url) b.append(h('img', { src: url, alt: '', loading: 'lazy' })); else b.textContent = initials(name);
    return b;
  }
  function when(t) {
    var d = new Date(t), now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }
  function errText(e) {  // database messages written for students pass through; technical ones become one plain line
    var m = (e && (e.message || e.error_description)) || '';
    return m && m.length < 120 && !/fetch|network|jwt|permission|violates|relation|function|column|syntax|uuid|null value|schema|postgres|pgrst|duplicate key|constraint/i.test(m) ? m : 'Something went wrong. Try again.';
  }
  function otherId(c) { return c.buyer_id === me.id ? c.seller_id : c.buyer_id; }
  function other(c) { return names[otherId(c)] || {}; }
  function otherName(c) { return other(c).display_name || (c.buyer_id === me.id ? 'Seller' : 'Buyer'); }

  // ---------- The button and the panel ----------
  var btn = h('button', { class: 'dock-btn', type: 'button', 'aria-label': 'Chats', 'aria-expanded': 'false', 'aria-controls': 'dock-panel', hidden: true }, [
    svg('M4 5h16v11H9l-5 4z'), h('b', { class: 'dock-badge', hidden: true, text: '0' })
  ]);
  var badge = btn.querySelector('.dock-badge');
  var back = h('button', { class: 'dock-icon', type: 'button', 'aria-label': 'Back to chats', hidden: true, onclick: function () { showList(); } }, [svg('M15 18l-6-6 6-6')]);
  var title = h('h2', { class: 'dock-title', id: 'dock-title', text: 'Chats' });
  var sub = h('p', { class: 'dock-sub', hidden: true });
  var full = h('a', { class: 'dock-icon', href: 'messages.html', 'aria-label': 'Open Messages', title: 'Open Messages' }, [svg('M14 4h6v6M20 4l-8 8M18 14v5H5V6h5')]);
  var close = h('button', { class: 'dock-icon', type: 'button', 'aria-label': 'Close chats', onclick: function () { setOpen(false, true); } }, [svg('M6 6l12 12M18 6L6 18')]);
  var body = h('div', { class: 'dock-body' });
  var input = h('input', { id: 'dock-input', type: 'text', maxLength: 1000, placeholder: 'Write a message', autocomplete: 'off', 'aria-label': 'Message' });
  var sendBtn = h('button', { class: 'dock-send', type: 'submit', 'aria-label': 'Send' }, [svg('M4 12l16-8-6 16-2-7z')]);
  var note = h('p', { class: 'dock-note', role: 'status' });
  var compose = h('form', { class: 'dock-compose', hidden: true }, [input, sendBtn]);
  var panel = h('section', { class: 'dock-panel', id: 'dock-panel', role: 'dialog', 'aria-labelledby': 'dock-title', hidden: true }, [
    h('header', { class: 'dock-head' }, [back, h('div', { class: 'dock-titles' }, [title, sub]), full, close]),
    body, note, compose
  ]);
  document.body.append(btn, panel);


  function isOpen() { return !panel.hidden; }
  // Where the panel fills the screen (phones, short landscape screens) it is a real modal:
  // everything behind it is inert, so Tab and screen readers stay inside. Same query as the CSS.
  var fullScreen = window.matchMedia('(max-width: 640px), (max-height: 500px)'), inerted = [];
  function syncModal() {
    var modal = isOpen() && fullScreen.matches;
    if (modal) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
    inerted.forEach(function (el) { el.inert = false; });
    inerted = [];
    if (!modal) return;
    [].forEach.call(document.body.children, function (el) {
      if (el === panel || el.inert || el.tagName === 'SCRIPT' || el.matches('.toast, [role="status"], [role="alert"]')) return;
      el.inert = true;
      inerted.push(el);
    });
  }
  window.addEventListener('resize', function () { if (isOpen()) syncModal(); });  // rotating or resizing while open
  function setOpen(open, focusBtn) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('dock-open', open);
    syncModal();
    if (open) { if (!current) showList(); }
    else { current = null; if (focusBtn) btn.focus(); }
  }
  btn.addEventListener('click', function () { setOpen(!isOpen()); });
  // Esc steps back (chat, then list, then closed) wherever focus is, unless a pop-up dialog on the page is handling it
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen() || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (current) showList(); else setOpen(false, true);
  });

  function setTotal(n) {
    total = Math.max(0, n);
    badge.hidden = !total;
    badge.textContent = total > 9 ? '9+' : String(total);
    btn.setAttribute('aria-label', total ? 'Chats, ' + total + ' unread' : 'Chats');
  }

  // ---------- Conversation list ----------
  var SELECT = 'id, listing_id, buyer_id, seller_id, created_at, listings(id, title, kind, status, reserved_by, school, price_php)';
  function loadConvos() {
    return db.from('conversations').select(SELECT).order('created_at', { ascending: false }).then(function (r) {
      if (r.error) throw r.error;
      convos = r.data || [];
      if (!convos.length) return;
      var ids = convos.map(function (c) { return c.id; });
      var people = convos.map(otherId).filter(function (v, i, a) { return a.indexOf(v) === i; });
      return Promise.all([
        db.from('messages').select('conversation_id, body, photo_path, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300),
        db.from('public_profiles').select('id, display_name, avatar_url').in('id', people),
        db.rpc('unread_counts'),
        db.from('meetups').select(MEET).in('listing_id', convos.map(function (c) { return c.listing_id; })).order('created_at', { ascending: false }).limit(300)
      ]).then(function (res) {
        var last = {}, unread = {};
        (res[0].data || []).forEach(function (x) { if (!last[x.conversation_id]) last[x.conversation_id] = x; });
        (res[1].data || []).forEach(function (p) { names[p.id] = p; });
        (res[2].data || []).forEach(function (u) { unread[u.conversation_id] = u.unread; });
        convos.forEach(function (c) { c.last = last[c.id]; c.unread = unread[c.id] || 0; c.meet = latestMeet(res[3].data, c); });
        sortConvos();
      });
    });
  }
  function sortConvos() { convos.sort(function (a, b) { return new Date((b.last || b).created_at) - new Date((a.last || a).created_at); }); }
  function countAll() { return convos.reduce(function (a, c) { return a + (c.unread || 0); }, 0); }
  function showList() {
    // Coming back from a chat: focus that chat's row (the back button that had focus is about to hide)
    var from = current, hadFocus = panel.contains(document.activeElement);
    var onRow = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('dock-convo') && document.activeElement.dataset.id;
    current = null;
    back.hidden = true; sub.hidden = true; compose.hidden = true; strip.hidden = true;
    title.textContent = 'Chats';
    full.href = 'messages.html';
    note.textContent = '';
    if (!convos.length) {
      body.replaceChildren(h('div', { class: 'dock-empty' }, [
        h('p', { text: 'No chats yet.' }),
        h('p', { class: 'dock-muted', text: 'Open a listing and tap Message seller to start one.' })
      ]));
      if (hadFocus) close.focus();
      return;
    }
    body.replaceChildren(h('ul', { class: 'dock-list' }, convos.map(function (c) {
      var o = other(c), preview = c.last ? (c.last.body || 'Photo') : 'No messages yet', d = dealOf(c);
      return h('li', {}, [h('button', { class: 'dock-convo' + (c.unread ? ' unread' : '') + (d.act ? ' waiting' : ''), type: 'button', 'data-id': c.id,
        'aria-label': otherName(c) + ', ' + (c.listings ? c.listings.title : 'listing') + ', ' + d.label + (c.unread ? ', ' + c.unread + ' unread' : ''),
        onclick: function () { openConvo(c.id); } }, [
        face(o.avatar_url, otherName(c), 44),
        h('span', { class: 'dock-convo-txt' }, [
          h('span', { class: 'dock-convo-top' }, [h('b', { text: otherName(c) }), h('span', { class: 'dock-chip ' + (d.act ? 'act' : d.key), text: d.label, 'aria-hidden': 'true' })]),
          h('small', { text: (c.listings ? c.listings.title : 'Listing') + ' · ' + (c.buyer_id === me.id ? 'buying' : 'selling') }),
          h('span', { class: 'dock-last', text: preview })
        ]),
        h('span', { class: 'dock-convo-end' }, [
          c.last ? h('time', { text: when(c.last.created_at) }) : null,
          c.unread ? h('b', { class: 'dock-unread', text: c.unread > 9 ? '9+' : String(c.unread) }) : null
        ])
      ])]);
    })));
    var keep = onRow || (from && from.id);
    var row = (keep && body.querySelector('.dock-convo[data-id="' + keep + '"]')) || body.querySelector('.dock-convo');
    if (row && (hadFocus || document.activeElement === btn || document.activeElement === document.body)) row.focus({ preventScroll: true });
  }

  // ---------- The deal: where this chat's trade stands, and your next step (brief: .impeccable/briefs/chats-deal-strip.md) ----------
  var MEET = 'id, listing_id, buyer_id, seller_id, spot, meet_at, proposed_by, status, created_at';
  var LISTING = 'id, title, kind, status, reserved_by, school, price_php';
  function spotsFor(c) {
    if (window.UC_SPOTS_FOR) return window.UC_SPOTS_FOR((c.listings || {}).school);
    return window.UC_DEFAULT_SPOTS || ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'];
  }
  function meetTime(t) {
    var d = new Date(t), now = new Date();
    var time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    var days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    if (days === 0) return 'Today ' + time;
    if (days === 1) return 'Tomorrow ' + time;
    if (days === -1) return 'Yesterday ' + time;
    if (days > 1 && days < 7) return d.toLocaleDateString('en-PH', { weekday: 'short' }) + ' ' + time;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ', ' + time;
  }
  function dueNow(m) { var t = new Date(m.meet_at); return t.toDateString() === new Date().toDateString() || t < new Date(); }
  // One reading of the deal, shared by the strip and the chat list: key, short label, and whether it waits on you
  function dealOf(c) {
    var l = c.listings || {}, m = c.meet, buyer = c.buyer_id === me.id, theirs = l.reserved_by === c.buyer_id;
    if (m && m.status === 'done') return { key: 'done', label: 'Completed' };
    if (l.status === 'removed') return { key: 'gone', label: 'Removed' };
    if (l.status === 'sold') return theirs ? { key: 'done', label: 'Completed' } : { key: 'gone', label: 'Sold' };
    if (l.status !== 'reserved') return { key: 'open', label: 'Interested' };
    if (!theirs) return { key: 'gone', label: buyer ? 'Reserved by someone else' : 'Reserved for another buyer' };
    if (m && m.status === 'accepted') return dueNow(m) ? { key: 'accepted', label: buyer ? 'Code ready' : 'Confirm handover', act: true } : { key: 'accepted', label: 'Meetup ' + meetTime(m.meet_at).replace(/^(Today|Tomorrow|Yesterday)/, function (w) { return w.toLowerCase(); }) };
    if (m && m.status === 'proposed') return m.proposed_by === me.id ? { key: 'proposed', label: 'Meetup suggested' } : { key: 'proposed', label: 'Accept meetup', act: true };
    return { key: 'reserved', label: 'Reserved' };
  }
  function latestMeet(rows, c) {
    return (rows || []).filter(function (m) { return m.listing_id === c.listing_id && m.buyer_id === c.buyer_id; })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })[0] || null;
  }
  function refreshDeal(c) {
    if (!c) return Promise.resolve();
    return Promise.all([
      db.from('listings').select(LISTING).eq('id', c.listing_id).maybeSingle(),
      db.from('meetups').select(MEET).eq('listing_id', c.listing_id).eq('buyer_id', c.buyer_id).order('created_at', { ascending: false }).limit(1)
    ]).then(function (r) {
      if (r[0].data) c.listings = r[0].data;
      if (!r[1].error) c.meet = (r[1].data || [])[0] || null;
      if (current === c) drawDeal(c); else if (isOpen() && !current) showList();
    });
  }

  var dealBox = h('div', { class: 'dock-deal-box' });
  var dealSay = h('p', { class: 'dock-deal-say', role: 'status' });
  var strip = h('section', { class: 'dock-deal', 'aria-label': 'Meetup and handover', hidden: true }, [dealBox, dealSay]);
  function say(msg, bad) { dealSay.textContent = msg || ''; dealSay.classList.toggle('err', !!bad); }
  // Messages sit right under the inputs that caused them (code box, spot and time), else at the foot of the strip
  function placeSay() { var near = dealBox.querySelector('.dock-code-row, .dock-fields'); if (near) near.after(dealSay); else strip.append(dealSay); }
  // Messages written by the database for students pass through; anything technical becomes one plain line
  function plain(e) {
    var msg = (e && e.message) || '';
    return msg && msg.length < 120 && !/fetch|network|jwt|permission|violates|relation|function|column|syntax|uuid|null value|schema|postgres|pgrst|duplicate key|constraint/i.test(msg)
      ? msg : 'Couldn\u2019t do that. Check your connection and try again.';
  }
  function act(label, cls, fn) {
    var b = h('button', { class: 'dock-act' + (cls ? ' ' + cls : ''), type: 'button', text: label });
    b.addEventListener('click', function () { fn(b); });
    return b;
  }
  function run(b, name, args, done) {
    var c = current;
    b.disabled = true;
    say('');
    db.rpc(name, args).then(function (r) {
      if (r.error) throw r.error;
      say(done);
      return refreshDeal(c);
    }).catch(function (e) {
      b.disabled = false;
      var msg = plain(e);
      say(msg, true);
      if (/no longer|already|not found|first|closed/i.test(msg)) refreshDeal(c);  // the deal moved on: show where it is now
    });
  }
  function cancelBtn(m) {
    return act('Cancel meetup', 'quiet', function (b) {
      if (!b.dataset.armed) {
        b.dataset.armed = '1';
        b.textContent = 'Tap again to cancel';
        setTimeout(function () { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.textContent = 'Cancel meetup'; } }, 4000);
        return;
      }
      run(b, 'cancel_meetup', { p_meetup: m.id }, 'Meetup cancelled. You can suggest a new time.');
    });
  }
  function listingLink(c) { return h('a', { class: 'dock-act', href: 'index.html?open=' + c.listing_id, text: 'View listing' }); }
  function localStamp(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function suggestForm(c) {
    var spot = h('select', { id: 'dock-spot' }, spotsFor(c).map(function (s) { return h('option', { value: s, text: s }); }));
    var noon = new Date(); noon.setDate(noon.getDate() + 1); noon.setHours(12, 0, 0, 0);  // tomorrow at noon, the usual between-class slot
    var at = h('input', { id: 'dock-at', type: 'datetime-local', min: localStamp(new Date()), max: localStamp(new Date(Date.now() + 365 * 864e5)), value: localStamp(noon) });
    var send = act('Send suggestion', 'primary', function (b) {
      var t = at.value ? new Date(at.value) : null;
      var msg = !t ? 'Pick a date and time.' : isNaN(t.getTime()) ? 'That date isn\u2019t valid. Check the year has 4 digits.'
        : t.getTime() < Date.now() ? 'Pick a time in the future.' : t.getTime() > Date.now() + 366 * 864e5 ? 'Pick a time within the next year.' : '';
      if (msg) { say(msg, true); at.focus(); return; }
      run(b, 'propose_meetup', { p_listing: c.listing_id, p_spot: spot.value, p_at: t.toISOString() }, 'Suggestion sent. ' + otherName(c) + ' can accept it here.');
    });
    return h('div', { class: 'dock-deal-form' }, [
      h('div', { class: 'dock-fields' }, [
        h('label', { class: 'dock-field' }, [h('span', { text: 'Pickup spot' }), spot]),
        h('label', { class: 'dock-field' }, [h('span', { text: 'Date and time' }), at])
      ]),
      h('div', { class: 'dock-deal-acts' }, [send, act('Back', 'quiet', function () { say(''); drawDeal(c, true); })])
    ]);
  }
  function openForm(c) {
    dealBox.replaceChildren(suggestForm(c));
    placeSay();
    var s = document.getElementById('dock-spot');
    if (s) s.focus();
  }
  function codeReveal(m) {
    var out = h('p', { class: 'dock-code', hidden: true });
    var b = act('Show handover code', 'primary', function () {
      if (!out.hidden) { out.hidden = true; out.textContent = ''; b.textContent = 'Show handover code'; b.setAttribute('aria-expanded', 'false'); return; }
      b.disabled = true;
      db.from('meetup_codes').select('code').eq('meetup_id', m.id).maybeSingle().then(function (r) {
        b.disabled = false;
        if (r.error || !r.data) { say('Couldn\u2019t load the code. Check your connection and try again.', true); return; }
        out.textContent = String(r.data.code).replace(/^(\d{3})(\d{3})$/, '$1 $2');
        out.hidden = false;
        b.textContent = 'Hide code';
        b.setAttribute('aria-expanded', 'true');
      });
    });
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'dock-code');
    out.id = 'dock-code';
    return [b, out];
  }
  function codeEntry(m) {
    var code = h('input', { id: 'dock-code-in', type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 6, placeholder: '6-digit code', 'aria-label': 'Buyer\u2019s 6-digit code' });
    var b = act('Confirm handover', 'primary', function () {
      var v = code.value.replace(/\D/g, '');
      if (v.length !== 6) { say('Type the 6 digits the buyer reads to you.', true); code.focus(); return; }
      run(b, 'confirm_handover', { p_meetup: m.id, p_code: v }, 'Handover confirmed. The item is marked as sold.');
    });
    code.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); b.click(); } });
    code.addEventListener('input', function () { if (dealSay.classList.contains('err')) say(''); });
    return h('div', { class: 'dock-code-row' }, [code, b]);
  }
  function dot(s) { return /[.!?]$/.test(s) ? s : s + '.'; }  // names like "Carlo D." already end a sentence
  function line(state, where) {
    return h('p', { class: 'dock-deal-line' }, [h('b', { class: 'dock-deal-state', text: state }), where || null]);
  }
  // Before meeting someone new: where, what to check, and the way out. Collapses once read.
  function beforeMeet(m, buyer, name, kind) {
    var tips = buyer
      ? ['Meet at ' + m.spot + ' on campus, where other students are around.',
         'Look the item over before you read the code. Not as described? Don\u2019t share it.',
         kind === 'sell' ? 'Pay ' + name + ' at the handover, not before.' : null]
      : ['Meet at ' + m.spot + ' on campus, where other students are around.',
         'Bring the item. Hand it over once ' + name + ' reads you the code.',
         kind === 'sell' ? 'You get paid at the handover, in person.' : null];
    tips.push('Running late or can\u2019t come? Message ' + name + ' or cancel here.');
    return h('details', { class: 'dock-before', open: true }, [h('summary', { text: 'Before you meet' }),
      h('ul', {}, tips.filter(Boolean).map(function (t) { return h('li', { text: t }); }))]);
  }
  // The end of a deal is the brand moment: the item went to the next batch. Both sides get it, and a vouch.
  function passedOn(c, buyer, name, fresh) {
    return h('div', { class: 'dock-passed' + (fresh ? ' just' : '') }, [h('span', { class: 'dock-passed-mark', 'aria-hidden': 'true' }),
      h('div', {}, [h('b', { class: 'dock-deal-state', text: 'Passed on to the next batch.' }),
        h('p', { class: 'dock-deal-hint', text: buyer
          ? name + ' passed it on to you. A vouch tells the next buyer they can trust them.'
          : dot('You passed it on to ' + name) + ' A vouch tells other sellers they can trust them.' })])]);
  }
  function drawDeal(c, refocus) {
    if (current !== c) return;
    var refocusStrip = refocus || strip.contains(document.activeElement);
    var l = c.listings || {}, m = c.meet, d = dealOf(c), buyer = c.buyer_id === me.id, name = otherName(c), kids = [];
    var live = m && (m.status === 'proposed' || m.status === 'accepted');
    var past = live && new Date(m.meet_at) < new Date();
    var where = live ? h('span', { class: 'dock-deal-where' }, [h('b', { text: m.spot }), ' \u00b7 ' + (past ? 'was ' + meetTime(m.meet_at).replace(/^(Today|Yesterday|Tomorrow)/, function (w) { return w.toLowerCase(); }) : meetTime(m.meet_at))]) : null;
    var acts = h('div', { class: 'dock-deal-acts' });
    var fresh = c.dealKey && c.dealKey !== d.key;  // changed while open: celebrate only the live transition
    c.dealKey = d.key;
    if (d.key === 'gone') {
      kids.push(line(l.status === 'removed' ? 'This listing was removed.' : l.status === 'sold' ? 'Sold to someone else.' : d.label + '.'));
    } else if (d.key === 'open') {
      kids.push(line('Not reserved yet.'), h('p', { class: 'dock-deal-hint', text: buyer ? 'Reserve it from the listing, then set a meetup here.' : 'Once ' + name + ' reserves it, you can set a meetup here.' }));
      if (buyer) acts.append(listingLink(c));
    } else if (d.key === 'reserved') {
      kids.push(line(dot('Reserved for ' + (buyer ? 'you' : name))), h('p', { class: 'dock-deal-hint', text: 'Pick a pickup spot and time on campus.' }));
      acts.append(act('Suggest a time', 'primary', function () { openForm(c); }));
    } else if (d.key === 'proposed' && m.proposed_by !== me.id) {
      kids.push(line(name + ' suggested', where));
      acts.append(act('Accept', 'primary', function (b) { run(b, 'accept_meetup', { p_meetup: m.id }, 'Meetup confirmed.'); }),
        act('Suggest another', '', function () { openForm(c); }), cancelBtn(m));
    } else if (d.key === 'proposed') {
      kids.push(line('Waiting for ' + name + ' to accept', where));
      acts.append(act('Change time', '', function () { openForm(c); }), cancelBtn(m));
    } else if (d.key === 'accepted') {
      kids.push(line(past ? 'Meetup time has passed' : 'Meetup confirmed', where));
      if (buyer) {
        kids.push(h('p', { class: 'dock-deal-hint', text: past ? 'Met already? Show the code to finish, or cancel.' : dot('Check the item first, then read this code to ' + name) + ' No code, no sale.' }));
        if (!past) kids.push(beforeMeet(m, true, name, l.kind));
        codeReveal(m).forEach(function (el) { acts.append(el); });
        acts.append(cancelBtn(m));
      } else {
        if (!past) kids.push(beforeMeet(m, false, name, l.kind));
        kids.push(h('p', { class: 'dock-deal-hint', text: past ? 'Met already? Type the buyer\u2019s code to finish, or cancel.' : 'When you hand it over, type the code ' + name + ' reads to you. No code, no sale.' }), codeEntry(m));
        acts.append(cancelBtn(m));
      }
    } else if (d.key === 'done') {
      kids.push(passedOn(c, buyer, name, fresh));
      acts.append(h('a', { class: 'dock-act primary', href: 'profile.html?u=' + encodeURIComponent(otherId(c)), text: 'Vouch for ' + name.split(' ')[0] }), listingLink(c));
    }
    if (acts.children.length) kids.push(acts);
    dealBox.replaceChildren.apply(dealBox, kids);
    placeSay();
    if (refocusStrip) { var f = strip.querySelector('input, select, button:not([disabled]), a'); if (f) f.focus({ preventScroll: true }); }
  }

  // ---------- One conversation ----------
  var thread = null;
  function openConvo(id) {
    var c = convos.filter(function (x) { return String(x.id) === String(id); })[0];
    var ready = c ? Promise.resolve(c) : loadConvos().then(function () { return convos.filter(function (x) { return String(x.id) === String(id); })[0]; });
    return ready.then(function (cv) {
      if (!cv) { note.textContent = 'That chat isn’t available.'; return; }
      if (!isOpen()) setOpen(true);
      current = cv; seen = {};
      if (!strip.isConnected) panel.insertBefore(strip, body);
      back.hidden = false; sub.hidden = false; compose.hidden = false; strip.hidden = false;
      say('');
      drawDeal(cv);
      refreshDeal(cv);
      title.textContent = otherName(cv);
      sub.textContent = (cv.listings ? cv.listings.title : 'Listing') + ' · ' + (cv.buyer_id === me.id ? 'buying' : 'selling');
      full.href = 'messages.html?c=' + cv.id;
      note.textContent = '';
      thread = h('div', { class: 'dock-thread', role: 'log', 'aria-live': 'polite' }, [h('p', { class: 'dock-muted', text: 'Loading…' })]);
      body.replaceChildren(thread);
      markRead(cv);
      db.from('messages').select('*').eq('conversation_id', cv.id).order('created_at').limit(200).then(function (r) {
        thread.replaceChildren();
        if (r.error) return thread.append(h('p', { class: 'dock-muted', text: errText(r.error) }));
        (r.data || []).forEach(add);
        if (!(r.data || []).length) thread.append(h('p', { class: 'dock-muted dock-first', text: 'No messages yet. Say hi.' }));
      });
      input.focus({ preventScroll: true });
    });
  }
  function add(m) {
    if (!current || m.conversation_id !== current.id || seen[m.id]) return;
    seen[m.id] = 1;
    var first = thread.querySelector('.dock-first');
    if (first) first.remove();
    var mine = m.sender_id === me.id, bubble = h('div', { class: 'dock-msg' + (mine ? ' mine' : '') + (m.meetup_id ? ' meetup' : '') });
    if (m.body) bubble.append(h('span', { text: m.body }));
    if (m.photo_path) {
      var img = h('img', { alt: 'Photo', loading: 'lazy' });
      // a photo that loads later grows the chat: stay at the bottom if that is where the reader was
      img.addEventListener('load', function () { if (body.scrollHeight - body.scrollTop - body.clientHeight < img.offsetHeight + 80) body.scrollTop = body.scrollHeight; });
      bubble.append(img);
      db.storage.from('chat-photos').createSignedUrl(m.photo_path, 3600).then(function (s) { if (s.data) img.src = s.data.signedUrl; });
    }
    bubble.append(h('time', { text: when(m.created_at) }));
    thread.append(bubble);
    body.scrollTop = body.scrollHeight;
  }
  function markRead(c) {
    setTotal(total - (c.unread || 0));
    c.unread = 0;
    db.from('conversation_reads').upsert({ user_id: me.id, conversation_id: c.id, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,conversation_id' }).then(function () {});
  }
  compose.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || !current) return;
    sendBtn.disabled = true;
    db.from('messages').insert({ conversation_id: current.id, body: text }).select().single().then(function (r) {
      sendBtn.disabled = false;
      if (r.error) { note.textContent = 'Couldn’t send: ' + errText(r.error); return; }
      note.textContent = '';
      input.value = '';
      add(r.data);
      bump(r.data);
    });
  });
  function bump(m) {
    var c = convos.filter(function (x) { return x.id === m.conversation_id; })[0];
    if (c) { c.last = m; sortConvos(); }
  }

  // ---------- Live: new messages in any of your chats (row-level security filters them) ----------
  function listen() {
    if (channel) db.removeChannel(channel);
    channel = db.channel('dock-' + me.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var m = p.new, c = convos.filter(function (x) { return x.id === m.conversation_id; })[0];
        if (!c) { loadConvos().then(function () { setTotal(countAll()); if (isOpen() && !current) showList(); }); return; }
        bump(m);
        if (m.meetup_id) refreshDeal(c);
        if (current && current.id === m.conversation_id && isOpen()) { add(m); markRead(c); return; }
        if (m.sender_id !== me.id) { c.unread = (c.unread || 0) + 1; setTotal(total + 1); btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping'); }
        if (isOpen() && !current) showList();
      })
      .subscribe();
  }

  // ---------- Top bar profile photo ----------
  var navMe = document.getElementById('nav-me');
  var guestSlot = !document.getElementById('login-btn');  // inner pages have no Log in button: logged out, the photo slot is it
  function drawMe(p) {
    if (!navMe) return;
    if (!me) {
      navMe.hidden = !guestSlot;
      navMe.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      navMe.href = 'index.html?login=1';
      navMe.setAttribute('aria-label', 'Log in');
      return;
    }
    navMe.hidden = false;
    navMe.href = 'profile.html';
    navMe.replaceChildren(p && p.avatar_url ? h('img', { src: p.avatar_url, alt: '' }) : document.createTextNode(initials(p && p.full_name)));
    navMe.setAttribute('aria-label', 'Your profile' + (p && p.full_name ? ': ' + p.full_name : ''));
  }

  // ---------- Start, and follow log-in / log-out on the home page ----------
  function start(user) {
    me = user || null;
    btn.hidden = !me;
    document.body.classList.toggle('has-dock', !!me);
    if (!me) { setOpen(false); convos = []; setTotal(0); drawMe(null); if (channel) { db.removeChannel(channel); channel = null; } return; }
    db.from('profiles').select('full_name, avatar_url').eq('id', me.id).maybeSingle().then(function (r) { drawMe(r.data); });
    loadConvos().then(function () { setTotal(countAll()); if (isOpen() && !current) showList(); }).catch(function () {});
    listen();
  }
  db.auth.getSession().then(function (r) { start(r.data.session && r.data.session.user); });
  document.addEventListener('uc:user', function (e) { var u = e.detail || null; if ((u && u.id) !== (me && me.id)) start(u); });

  window.UCChats = {
    open: function () { if (me) setOpen(true); else location.href = 'messages.html'; },
    openConversation: function (id) { if (!me) { location.href = 'messages.html?c=' + id; return; } openConvo(id); }
  };
})();

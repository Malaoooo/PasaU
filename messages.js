/* PasaU Messages page: conversation list + live chat with in-chat meetup suggestions (F8 + F10). */
(function () {
  var db = window.supabase.createClient(window.UC_CONFIG.url, window.UC_CONFIG.key);
  var inbox = document.getElementById('inbox'), listEl = document.getElementById('convo-list'), pane = document.getElementById('thread');
  var SPOTS = window.UC_DEFAULT_SPOTS || ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'];
  var QUICK = ['Is this still available?', 'Can we meet tomorrow?', 'I’ll take it', 'Thanks!'];
  var MAX_PHOTO = 5 * 1024 * 1024;
  var me = null, convos = [], current = null, seen = {}, meetupSlots = {};

  // ---------- helpers ----------
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
  function icon(d) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'icon');
    s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  var toastEl = document.getElementById('toast'), tTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  function when(t) { return new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function errText(e) {  // database messages written for students pass through; technical ones become one plain line
    var m = (e && (e.message || e.error_description)) || '';
    return m && m.length < 120 && !/fetch|network|jwt|permission|violates|relation|function|column|syntax|uuid|null value|schema|postgres|pgrst|duplicate key|constraint/i.test(m) ? m : 'Something went wrong. Try again.';
  }
  function rpc(name, args) { return db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function otherId(c) { return c.buyer_id === me.id ? c.seller_id : c.buyer_id; }
  function otherName(c) { return c.otherName || (c.buyer_id === me.id ? 'Seller' : 'Buyer'); }
  // Where this chat's deal stands, from the listing's state
  function statusOf(c) {
    var l = c.listings || {};
    if (l.status === 'sold') return l.reserved_by === c.buyer_id ? ['Completed', 'done'] : ['Sold', 'gone'];
    if (l.status === 'removed') return ['Removed', 'gone'];
    if (l.status === 'reserved') return l.reserved_by === c.buyer_id ? ['Reserved', 'res'] : [c.buyer_id === me.id ? 'Reserved by someone else' : 'Interested', 'int'];
    return ['Interested', 'int'];
  }
  function markRead(c) {
    c.unread = 0;
    db.from('conversation_reads').upsert({ user_id: me.id, conversation_id: c.id, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,conversation_id' }).then(function () {});
  }
  function photoOf(c, size) {
    var p = c.listings && (c.listings.listing_photos || []).slice().sort(function (a, b) { return a.position - b.position; })[0];
    var img = h('img', { alt: '', width: size, height: size });
    if (p) return PasaPhoto.thumbImg(img, p.path);
    img.src = 'logos/mark-small.svg';
    return img;
  }

  // ---------- conversation list ----------
  var SELECT = 'id, listing_id, buyer_id, seller_id, created_at,' +
    ' listings(id, title, kind, price_php, status, reserved_by, seller_id, school, listing_photos(path, position))';
  function loadConvos() {
    return db.from('conversations').select(SELECT).order('created_at', { ascending: false }).then(function (r) {
      if (r.error) { listEl.replaceChildren(h('li', { class: 'muted', text: errText(r.error) })); return; }
      convos = r.data || [];
      if (!convos.length) { listEl.replaceChildren(h('li', { class: 'muted', text: 'No conversations yet. Open a listing in the shop and tap Message seller.' })); return; }
      var ids = convos.map(function (c) { return c.id; });
      var people = convos.map(otherId).filter(function (v, i, a) { return a.indexOf(v) === i; });
      return Promise.all([
        db.from('messages').select('conversation_id, body, photo_path, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300),
        db.from('public_profiles').select('id, display_name, avatar_url').in('id', people),
        db.rpc('unread_counts')
      ]).then(function (res) {
          var m = res[0], last = {}, names = {}, unread = {};
          (res[1].data || []).forEach(function (p) { names[p.id] = p; });
          (res[2].data || []).forEach(function (u) { unread[u.conversation_id] = u.unread; });
          (m.data || []).forEach(function (x) { if (!last[x.conversation_id]) last[x.conversation_id] = x; });
          convos.forEach(function (c) {
            c.last = last[c.id];
            var p = names[otherId(c)];
            c.otherName = p && p.display_name;
            c.unread = unread[c.id] || 0;
          });
          convos.sort(function (a, b) { return new Date((b.last || b).created_at) - new Date((a.last || a).created_at); });
          renderList();
        });
    });
  }
  function renderList() {
    listEl.replaceChildren.apply(listEl, convos.map(function (c) {
      var preview = c.last ? (c.last.body || 'Photo') : 'No messages yet', st = statusOf(c);
      return h('li', {}, [h('button', { type: 'button', class: 'convo' + (current && current.id === c.id ? ' active' : '') + (c.unread ? ' unread' : ''), 'aria-current': current && current.id === c.id ? 'true' : null,
        'aria-label': (c.listings ? c.listings.title : 'Listing') + ', ' + otherName(c) + (c.unread ? ', ' + c.unread + ' unread' : ''),
        onclick: function () { openConvo(c.id, true); } }, [
        photoOf(c, 48),
        h('span', { class: 'convo-txt' }, [
          h('b', { text: c.listings ? c.listings.title : 'Listing' }),
          h('small', { text: otherName(c) + ' · ' + (c.buyer_id === me.id ? 'buying' : 'selling') }),
          h('span', { class: 'convo-last', text: preview })
        ]),
        h('span', { class: 'convo-end' }, [
          c.last ? h('time', { text: when(c.last.created_at) }) : null,
          h('span', { class: 'chat-status ' + st[1], text: st[0] }),
          c.unread ? h('b', { class: 'unread-badge', text: c.unread > 9 ? '9+' : String(c.unread) }) : null
        ])
      ])]);
    }));
  }

  // ---------- one conversation ----------
  var thread, note;
  function openConvo(id, push) {
    var c = convos.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!c) return;
    current = c;
    seen = {};
    meetupSlots = {};
    if (push) history.pushState({ c: c.id }, '', 'messages.html?c=' + c.id);
    inbox.classList.add('show-thread');
    renderList();
    var l = c.listings || {}, st = statusOf(c);
    markRead(c);
    thread = h('div', { class: 'thread' });
    note = h('p', { class: 'note', 'aria-live': 'polite' });
    var text = h('input', { id: 'chat-text', type: 'text', maxLength: 1000, placeholder: 'Write a message', autocomplete: 'off' });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    var meetBox = h('div', { class: 'meet-form', hidden: true });
    var canMeet = l.status === 'reserved' && l.reserved_by === c.buyer_id;

    pane.replaceChildren(
      h('div', { class: 'thread-head' }, [
        h('button', { class: 'round back', type: 'button', 'aria-label': 'All conversations', onclick: function () { history.pushState({}, '', 'messages.html'); closeConvo(); } }, [icon('M15 5l-7 7 7 7')]),
        photoOf(c, 44),
        h('span', { class: 'convo-txt' }, [
          h('b', { text: l.title || 'Listing' }),
          h('small', {}, [h('a', { href: 'profile.html?u=' + otherId(c), text: otherName(c) }),
            (l.kind === 'free' ? ' · Free' : l.kind === 'swap' ? ' · Swap' : l.price_php != null ? ' · ₱' + Number(l.price_php).toLocaleString('en-PH') : ''),
            ' ', h('span', { class: 'chat-status ' + st[1], text: st[0] })])
        ]),
        h('a', { class: 'pill light small', href: 'index.html?open=' + c.listing_id, text: 'View listing' })
      ]),
      canMeet ? h('div', { class: 'meet-bar' }, [
        h('button', { class: 'pill small', type: 'button', text: 'Suggest a meetup time', onclick: function () { meetBox.hidden = !meetBox.hidden; } }),
        meetBox
      ]) : h('p', { class: 'meet-hint muted', text: l.status === 'sold' ? 'This item has been handed over.' : 'Once the item is reserved for this buyer, you can suggest a meetup time here.' }),
      thread,
      h('div', { class: 'quick', role: 'group', 'aria-label': 'Quick replies' }, QUICK.map(function (q) {
        return h('button', { type: 'button', text: q, onclick: function () { send({ body: q }); } });
      })),
      h('form', { class: 'composer', onsubmit: function (e) {
        e.preventDefault();
        var v = text.value.trim();
        if (!v) return;
        text.value = '';
        send({ body: v });
      } }, [
        h('button', { class: 'round', type: 'button', 'aria-label': 'Send a photo', onclick: function () { file.click(); } }, [icon('M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')]),
        text,
        h('button', { class: 'round solid', type: 'submit', 'aria-label': 'Send' }, [icon('M4 12l16-8-6 16-2-7z')]),
        file
      ]),
      note
    );

    if (canMeet) {
      var campusSpots = window.UC_SPOTS_FOR ? window.UC_SPOTS_FOR(l.school) : SPOTS;  // the listing's campus spots (universities.js)
      var spot = h('select', { id: 'm-spot', 'aria-label': 'Pickup spot' }, campusSpots.map(function (s) { return h('option', { value: s, text: s }); }));
      function stamp(days) { var d = new Date(Date.now() + days * 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      var at = h('input', { id: 'm-at', type: 'datetime-local', 'aria-label': 'Date and time', min: stamp(0), max: stamp(365) });
      meetBox.append(spot, at, h('button', { class: 'pill small', type: 'button', text: 'Send suggestion', onclick: function () {
        // A real date in the future, within the next year (a 5-digit year used to freeze this button)
        var t = at.value ? new Date(at.value) : null, msg = !t ? 'Pick a date and time.' : isNaN(t.getTime()) ? 'That date isn’t valid. Check the year has 4 digits.'
          : t.getTime() < Date.now() ? 'Pick a time in the future.' : t.getTime() > Date.now() + 366 * 864e5 ? 'Pick a time within the next year.' : '';
        if (msg) { note.textContent = msg; note.classList.add('err'); return; }
        var b = this;
        b.disabled = true;
        rpc('propose_meetup', { p_listing: c.listing_id, p_spot: spot.value, p_at: t.toISOString() })
          .then(function () { meetBox.hidden = true; b.disabled = false; note.textContent = ''; })
          .catch(function (e) { b.disabled = false; note.textContent = errText(e); note.classList.add('err'); });
      } }));
    }

    file.addEventListener('change', function () {
      var f = file.files[0];
      file.value = '';
      if (!f) return;
      if (f.size > MAX_PHOTO) { note.textContent = 'Photos must be 5 MB or smaller.'; note.classList.add('err'); return; }
      note.textContent = 'Sending photo…';
      note.classList.remove('err');
      PasaPhoto.upload(db, 'chat-photos', c.id + '/' + Date.now(), f).then(function (path) {
        send({ photo_path: path });
      }, function (e) { note.textContent = "Couldn't send the photo: " + errText(e); note.classList.add('err'); });
    });

    db.from('messages').select('*').eq('conversation_id', c.id).order('created_at').limit(300).then(function (r) {
      (r.data || []).forEach(add);
      if (!r.data || !r.data.length) thread.append(h('p', { class: 'muted thread-first', text: 'No messages yet. Say hi or use a quick reply.' }));
    });
    if (window.matchMedia('(min-width: 861px)').matches) text.focus();
  }
  function closeConvo() {
    current = null;
    inbox.classList.remove('show-thread');
    renderList();
  }

  function send(row) {
    if (!current) return;
    row.conversation_id = current.id;
    note.textContent = '';
    note.classList.remove('err');
    return db.from('messages').insert(row).select().single().then(function (r) {
      if (r.error) { note.textContent = errText(r.error); note.classList.add('err'); return; }
      add(r.data);
      bumpPreview(r.data);
    });
  }

  function add(m) {
    if (seen[m.id] || !current || m.conversation_id !== current.id) return;
    seen[m.id] = 1;
    var first = thread.querySelector('.thread-first');
    if (first) first.remove();
    var mine = m.sender_id === me.id;
    var bubble;
    if (m.meetup_id) {
      bubble = h('div', { class: 'msg meetup' + (mine ? ' mine' : '') }, [h('b', { text: m.body })]);
      if (/^Meetup proposed/.test(m.body)) {
        var slot = h('div', { class: 'meet-actions' });
        bubble.append(slot);
        (meetupSlots[m.meetup_id] = meetupSlots[m.meetup_id] || []).push(slot);
        refreshMeetup(m.meetup_id);
      }
    } else {
      bubble = h('div', { class: 'msg' + (mine ? ' mine' : '') }, [m.body ? h('span', { text: m.body }) : null]);
      if (m.photo_path) {
        var img = h('img', { alt: 'Photo', loading: 'lazy' });
        bubble.append(img);
        db.storage.from('chat-photos').createSignedUrl(m.photo_path, 3600).then(function (s) { if (s.data) img.src = s.data.signedUrl; });
      }
    }
    bubble.append(h('time', { text: when(m.created_at) }));
    thread.append(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  // Meetup card actions: accept, show the buyer's code, or let the seller confirm the handover
  function refreshMeetup(id) {
    db.from('meetups').select('*').eq('id', id).maybeSingle().then(function (r) {
      var m = r.data;
      (meetupSlots[id] || []).forEach(function (slot) {
        if (!m) return slot.replaceChildren();
        var isSeller = me.id === m.seller_id, kids = [];
        if (m.status === 'cancelled') kids.push(h('small', { text: 'Cancelled or replaced by a newer suggestion' }));
        if (m.status === 'proposed' || m.status === 'accepted') kids.push(h('button', { class: 'linkish', type: 'button', text: 'Cancel this meetup', onclick: function () {
          this.disabled = true;
          rpc('cancel_meetup', { p_meetup: id }).catch(function (e) { toast(errText(e)); refreshMeetup(id); });
        } }));
        if (m.status === 'done') kids.push(h('small', { text: 'Handover complete' }));
        if (m.status === 'proposed') {
          if (m.proposed_by === me.id) kids.push(h('small', { text: 'Waiting for a reply' }));
          else kids.push(h('button', { class: 'pill small', type: 'button', text: 'Accept this time', onclick: function () {
            this.disabled = true;
            rpc('accept_meetup', { p_meetup: id }).catch(function (e) { toast(errText(e)); refreshMeetup(id); });
          } }));
        }
        if (m.status === 'accepted' && !isSeller) {
          var code = h('span', { class: 'code small', text: '······' });
          kids.push(h('small', { text: 'Confirmed. Check the item first, then read this code to the seller:' }), code);
          db.from('meetup_codes').select('code').eq('meetup_id', id).maybeSingle().then(function (c) { if (c.data) code.textContent = c.data.code; });
        }
        if (m.status === 'accepted' && isSeller) {
          var input = h('input', { type: 'text', inputMode: 'numeric', maxLength: 6, placeholder: 'Buyer’s 6-digit code', 'aria-label': 'Handover code' });
          kids.push(h('small', { text: 'Confirmed. When you hand it over, type the code the buyer reads to you:' }), h('div', { class: 'code-row' }, [input,
            h('button', { class: 'pill small', type: 'button', text: 'Confirm handover', onclick: function () {
              var b = this;
              b.disabled = true;
              rpc('confirm_handover', { p_meetup: id, p_code: input.value }).catch(function (e) { b.disabled = false; toast(errText(e)); });
            } })]));
        }
        slot.replaceChildren.apply(slot, kids);
      });
    });
  }

  function bumpPreview(m) {
    var c = convos.filter(function (x) { return x.id === m.conversation_id; })[0];
    if (!c) { loadConvos(); return; }
    c.last = m;
    convos.sort(function (a, b) { return new Date((b.last || b).created_at) - new Date((a.last || a).created_at); });
    renderList();
  }

  // ---------- start ----------
  window.addEventListener('popstate', function () {
    var id = new URLSearchParams(location.search).get('c');
    if (id) openConvo(id, false); else closeConvo();
  });
  db.auth.getSession().then(function (r) {
    me = r.data.session && r.data.session.user;
    if (!me) {
      listEl.replaceChildren(h('li', {}, [h('p', { text: 'Log in to see your messages.' }), h('a', { class: 'pill', href: 'index.html?login=1', text: 'Log in' })]));
      document.querySelector('.thread-empty').hidden = true;  // guests get one message, not two
      return;
    }
    // One live channel: every new message you can see (RLS filters it to your chats)
    db.channel('inbox-' + me.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var m = p.new;
        if (current && m.conversation_id === current.id) {
          add(m);
          markRead(current);
          if (m.meetup_id) { refreshMeetup(m.meetup_id); reloadCurrentListing(); }
        } else if (m.sender_id !== me.id) {
          var c2 = convos.filter(function (x) { return x.id === m.conversation_id; })[0];
          if (c2) c2.unread = (c2.unread || 0) + 1;
          toast('New message' + (c2 ? ' from ' + otherName(c2) : ''));
        }
        bumpPreview(m);
      })
      .subscribe();
    loadConvos().then(function () {
      var id = new URLSearchParams(location.search).get('c');
      if (id) openConvo(id, false);
    });
  });
  // A handover or new meetup changes the listing state shown in the header
  function reloadCurrentListing() {
    var id = current && current.id;
    loadConvos().then(function () { if (id && current && current.id === id) openConvo(id, false); });
  }
})();

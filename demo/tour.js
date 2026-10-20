/* PasaU judge demo: the guided tour and the "Demo" chip. Runs only in demo mode (see demo.js). */
(function () {
  var Demo = window.PasaUDemo, D = window.PASAU_DEMO_DATA;
  if (!Demo || !D) return;
  var L = D.L;
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function find(sel) {
    var list = [].concat(sel);
    for (var i = 0; i < list.length; i++) {
      var els = typeof list[i] === 'function' ? [].concat(list[i]() || []) : document.querySelectorAll(list[i]);
      for (var j = 0; j < els.length; j++) { var r = els[j].getBoundingClientRect(); if (r.width && r.height) return els[j]; }
    }
    return null;
  }
  function waitFor(sel, ms) {
    var end = Date.now() + (ms || 4000);
    return new Promise(function (res) { (function poll() { var el = find(sel); if (el || Date.now() > end) return res(el); setTimeout(poll, 120); })(); });
  }
  function click(sel) { return waitFor(sel).then(function (el) { if (el) el.click(); return wait(500); }); }
  function phone() { return innerWidth < 720; }

  function twoStep() {
    var hs = document.querySelectorAll('h2, h3');
    for (var i = 0; i < hs.length; i++) if (/two-step/i.test(hs[i].textContent)) return hs[i].closest('.p-section') || hs[i].parentNode;
    return null;
  }
  var steps = [
    { as: 'visitor', url: 'index.html', title: 'Welcome to PasaU',
      body: 'PasaU is where students from eight Baguio schools buy, sell, swap and give away school things: books, uniforms, lab gear and more. This short tour points out each feature using made-up sample data, so feel free to tap around.' },
    { as: 'visitor', url: 'index.html', target: ['#campus-toggle', '.campus-toggle'], title: 'Pick your campus',
      body: 'Students choose their school first, so the shop shows things they can pick up on their own campus.' },
    { as: 'visitor', url: 'index.html?login=1', target: ['#login form', '#login'],
      prep: function () { return click('#login-modes button[data-mode="signup"]').then(function () { var e = document.getElementById('login-email'); if (e) { e.value = 'andrea.santos@slu.edu.ph'; e.dispatchEvent(new Event('input', { bubbles: true })); } var n = document.getElementById('su-name'); if (n) n.value = 'Andrea Santos'; return wait(300); }); },
      title: 'Students only, by school email',
      body: 'Only a school email (like @slu.edu.ph) can sign up, and the school fills itself in. Gmail is turned away. Confirming the email with a 6-digit code gives the student a Verified badge automatically. Two-step login is available too.' },
    { as: 'student', url: 'index.html', title: 'You are now Andrea',
      body: 'For the rest of the tour you are logged in as Andrea Santos, a 2nd-year Nursing student at SLU. Every person and listing here is sample data, and nothing you do reaches real students.' },
    { as: 'student', url: 'index.html', target: ['#shop .grid', '#shop'], prep: function () { return waitFor('#shop').then(function (el) { if (el) el.scrollIntoView({ block: 'start' }); return wait(600); }); },
      title: 'The shop',
      body: 'Listings from verified students, with filters for category, condition, price, course and year level. Each card shows the price next to what it costs new.' },
    { as: 'student', url: 'index.html', target: '#spotlight', title: 'Free items and swaps',
      body: 'Students can give things away for free or trade one item for another, so last term’s books go to the next batch instead of the trash.' },
    { as: 'student', url: 'index.html?open=' + L.ANAT, target: ['dialog[open] .seller-card'], title: 'Know who you are dealing with',
      body: 'Every listing shows the seller’s school, course, Verified badge and how many students vouched for them.' },
    { as: 'student', url: 'index.html?open=' + L.ANAT, target: ['dialog[open] .steps-bar', 'dialog[open] .box'], title: 'Reserve, then follow the steps',
      body: 'Tap Reserve to hold an item. If someone already reserved it, you join a queue and get it automatically if they back out. The step bar shows where the deal is, from Available to Completed.' },
    { as: 'student', url: 'index.html?open=' + L.BAG, target: ['#swap-pick', 'dialog[open] .box'], title: 'Offer a swap',
      body: 'For swap listings, pick one of your own items to offer in exchange. The owner sees every offer and accepts the one they like.' },
    { as: 'student', url: 'index.html?open=' + L.SHIRT, target: ['dialog[open] .owner-row', 'dialog[open] .box'], title: 'Selling: offers and a waiting line',
      body: 'On your own listing you set it as available, reserved or sold. Right below, you see price offers, swap offers and who is waiting in line.' },
    { as: 'student', url: 'index.html?open=' + L.DRAW, target: ['dialog[open] .code', 'dialog[open] .box'], title: 'Safe campus meetups',
      body: 'Buyer and seller agree on a spot inside campus and a time. At the handover the buyer reads out a 6-digit code, and the seller enters it to mark the deal done. No code, no sale.' },
    { as: 'student', url: 'index.html?sell=1&title=Pharmacology%20textbook&cat=books', target: ['dialog[open] form', 'dialog[open]'], title: 'Selling takes a minute',
      body: 'Add photos, a price and a pickup spot on campus. Tag the course code and year level so the right students find it.' },
    { as: 'student', url: 'index.html', target: ['dialog[open]', '#nav-bell'], prep: function () { return phone() ? click('#menu-btn').then(function () { return click('.mnav-bell'); }) : click('#nav-bell'); }, title: 'Notifications',
      body: 'Students hear about new messages, offers, meetups, vouches and PasaMatch hits right away.' },
    { as: 'student', url: 'index.html', target: ['#dock-panel', '.dock-btn'], prep: function () { return click('.dock-btn'); }, title: 'Chats on every page',
      body: 'Buyers and sellers chat from a pop-up that follows them around the site.' },
    { as: 'student', url: 'messages.html?c=502', target: ['.meetup-card', '.mcard', '.inbox-thread'], title: 'Meetups live in the chat',
      body: 'A meetup is proposed and accepted right inside the conversation, and the handover code waits there for the day of the deal.' },
    { as: 'student', url: 'unimatch.html?post=901', target: ['#um-results'], prep: function () { return waitFor('#um-results').then(function (el) { if (el) el.scrollIntoView({ block: 'start' }); return wait(500); }); }, title: 'PasaMatch',
      body: 'Can’t find something? Post what you are looking for. PasaMatch matches it to listings and pings students who might have it.' },
    { as: 'student', url: 'profile.html#vouches', target: ['.p-panel:not([hidden])', '#panel-vouches', 'main'], title: 'Vouches build trust',
      body: 'After a deal, students vouch for each other. The count shows on every listing, so good traders stand out.' },
    { as: 'student', url: 'profile.html#settings', target: [twoStep, '.p-panel:not([hidden])', 'main'], title: 'Two-step login and privacy',
      body: 'Students can turn on two-step login with an authenticator app, and choose what others see and which alerts they get.' },
    { as: 'student', url: 'profile.html#family', target: ['.p-panel:not([hidden])', 'main'], title: 'Parents can follow along',
      body: 'A student can invite a parent or guardian with a link. The parent sees upcoming meetups and finished deals, never the chats.' },
    { as: 'parent', url: 'family.html', target: ['.p-panel', 'main'], title: 'The parent’s view',
      body: 'Now you are Maria, Andrea’s mother. She sees Andrea’s meetups, who she is meeting and where, and can report a concern to the PasaU team.' },
    { as: 'student', url: 'admin.html', target: ['.stats', '.a-stats', 'main'], title: 'Moderation',
      body: 'The PasaU team reviews reports, verifies students and removes listings that break the rules.' },
    { as: 'student', url: 'index.html', title: 'That’s PasaU',
      body: 'You are logged in as Andrea. Look around freely: open listings, send a message, post an item. Tap the Demo button at the bottom to restart the tour or leave the demo.' }
  ];

  // ---------- UI ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var dlg = el('dialog', 'pd-tour'); dlg.setAttribute('aria-labelledby', 'pd-title');
  var hole = el('div', 'pd-hole'), card = el('section', 'pd-card');
  var count = el('p', 'pd-count'), title = el('h2', 'pd-title'), body = el('p', 'pd-body');
  title.id = 'pd-title';
  var back = el('button', 'pd-btn pd-ghost', 'Back'), next = el('button', 'pd-btn', 'Next'), skip = el('button', 'pd-skip', 'Explore on my own');
  [back, next, skip].forEach(function (b) { b.type = 'button'; });
  var row = el('div', 'pd-row'); row.append(back, next);
  card.append(count, title, body, row, skip);
  dlg.append(hole, card);

  var chip = el('div', 'pd-chip');
  var chipMain = el('button', 'pd-chip-btn', 'Demo'), menu = el('div', 'pd-menu');
  chipMain.type = 'button'; chipMain.setAttribute('aria-expanded', 'false');
  var mResume = el('button', '', 'Continue the tour'), mRestart = el('button', '', 'Start the tour over'), mExit = el('button', '', 'Leave the demo');
  var mNote = el('p', 'pd-menu-note', 'Sample data only. Nothing here reaches real students.');
  menu.append(mNote, mResume, mRestart, mExit); menu.hidden = true;
  [mResume, mRestart, mExit].forEach(function (b) { b.type = 'button'; });
  chip.append(menu, chipMain);

  var cur = -1, target = null;
  function place() {
    var vw = innerWidth, vh = innerHeight, pad = 8;
    if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var top = Math.max(r.top - pad, 4), left = Math.max(r.left - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4), right = Math.min(r.right + pad, vw - 4);
      hole.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + Math.max(right - left, 0) + 'px;height:' + Math.max(bottom - top, 0) + 'px';
      hole.classList.remove('pd-none');
      var ch = card.offsetHeight, cw = card.offsetWidth;
      if (phone()) {
        var below = vh - bottom, above = top;
        card.style.cssText = below >= ch + 16 || below >= above ? 'bottom:12px;left:12px;right:12px' : 'top:12px;left:12px;right:12px';
      } else {
        var y = bottom + 14 + ch <= vh - 12 ? bottom + 14 : top - 14 - ch >= 12 ? top - 14 - ch : null;
        if (y == null) { // beside it
          var x = right + 16 + cw <= vw - 12 ? right + 16 : Math.max(left - 16 - cw, 12);
          card.style.cssText = 'top:' + Math.min(Math.max(top, 12), vh - ch - 12) + 'px;left:' + x + 'px';
        } else card.style.cssText = 'top:' + y + 'px;left:' + Math.min(Math.max(left, 12), vw - cw - 12) + 'px';
      }
    } else {
      hole.classList.add('pd-none'); hole.style.cssText = '';
      card.style.cssText = phone() ? 'bottom:12px;left:12px;right:12px' : 'top:50%;left:50%;transform:translate(-50%,-50%)';
    }
  }
  function show(i) {
    var s = steps[i];
    cur = i; ss.set('pasau-demo-tour', String(i));
    count.textContent = (i + 1) + ' of ' + steps.length;
    title.textContent = s.title; body.textContent = s.body;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? 'Start exploring' : 'Next';
    skip.hidden = i === steps.length - 1;
    chip.hidden = true;
    return Promise.resolve(s.prep && s.prep()).then(function () { return s.target ? waitFor(s.target) : null; }).then(function (t) {
      target = t;
      if (t) {
        var r = t.getBoundingClientRect(), room = innerHeight - (phone() ? 260 : 120);
        if (r.top < 70 || r.bottom > innerHeight - (phone() ? 250 : 20)) t.scrollIntoView({ block: r.height > room ? 'start' : 'center' });
      }
      return wait(t ? 350 : 0);
    }).then(function () {
      dlg.inert = false; // the full-screen chats pop-up makes everything else inert, the tour included
      if (!dlg.open) dlg.showModal();
      place(); place();
      next.focus();
    });
  }
  function close() { if (cur >= 0) ss.set('pasau-demo-last', String(cur)); if (dlg.open) dlg.close(); target = null; ss.set('pasau-demo-tour', ''); chip.hidden = false; }
  function same(url) { var u = new URL(url, location.href); return u.pathname === location.pathname && u.search === location.search && u.hash === location.hash; }
  var leaving = false;  // a second tap during the page change must not skip a step
  function go(i) {
    if (leaving) return;
    if (i >= steps.length) { close(); return; }
    var s = steps[i], prev = steps[cur] || {};
    ss.set('pasau-demo-tour', String(i));
    var inPlace = cur >= 0 && s.as === Demo.persona() && same(s.url) && !s.prep && !prev.prep && !document.querySelector('dialog[open]:not(.pd-tour)');
    if (inPlace) { show(i); return; }
    Demo.setPersona(s.as);
    var u = new URL(s.url, location.href);
    leaving = true;
    leave(i < cur ? 'back' : 'fwd', function () {
      if (u.pathname === location.pathname && u.search === location.search) { history.replaceState(null, '', u.href); location.reload(); }
      else location.href = u.href;
    });
  }
  // The site's own page transition (transition.js): a green panel sweeps across with the PasaU mark
  function leave(dir, then) {
    var m = document.documentElement.getAttribute('data-motion');
    if (m === 'reduce' || (m !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { if (dlg.open) dlg.close(); return then(); }
    ss.set('pasau-nav', dir);
    var wipe = el('div', 'pg-wipe out ' + dir); wipe.setAttribute('aria-hidden', 'true'); wipe.append(el('span'));
    (dlg.open ? dlg : document.body).appendChild(wipe);  // inside the tour so it sweeps over everything, open pop-ups included
    var went = false;
    function go2() { if (!went) { went = true; then(); } }
    wipe.addEventListener('animationend', go2);
    setTimeout(go2, 450);
  }
  next.onclick = function () { if (cur === steps.length - 1) { close(); return; } go(cur + 1); };
  back.onclick = function () { go(cur - 1); };
  skip.onclick = close;
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  chipMain.onclick = function () { menu.hidden = !menu.hidden; chipMain.setAttribute('aria-expanded', String(!menu.hidden)); };
  mResume.onclick = function () { menu.hidden = true; var i = +(ss.get('pasau-demo-last') || 0); go(Math.min(i, steps.length - 1)); };
  mRestart.onclick = function () { menu.hidden = true; cur = -1; go(0); };
  mExit.onclick = function () {
    ['pasau-demo', 'pasau-demo-db', 'pasau-demo-img', 'pasau-demo-as', 'pasau-demo-tour', 'pasau-demo-last', 'pasau-demo-2fa'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
    try { localStorage.removeItem('sb-' + new URL(window.UC_CONFIG.url).hostname.split('.')[0] + '-auth-token'); } catch (e) {}
    leaving = true;
    leave('back', function () { location.href = 'index.html'; });
  };
  // Follow the target while things settle (content rising in, images loading, pop-ups sliding open)
  (function follow() { if (dlg.open && !dlg.querySelector('.pg-wipe')) place(); requestAnimationFrame(follow); })();

  function boot() {
    document.body.append(chip, dlg);
    var t = ss.get('pasau-demo-tour');
    if (t === '' || t == null) return;
    var i = +t; ss.set('pasau-demo-last', String(i));
    // let the page draw itself (and its page-in animation) first
    // let the page draw itself and its page-in sweep finish first, but don't wait forever on slow photos or fonts
    var loaded = document.readyState === 'complete' ? Promise.resolve() : Promise.race([new Promise(function (r) { addEventListener('load', r, { once: true }); }), wait(2500)]);
    loaded.then(function () { return wait(700); }).then(function () { show(i); });
  }
  var save = function () { if (cur >= 0) ss.set('pasau-demo-last', String(cur)); };
  addEventListener('pagehide', save);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

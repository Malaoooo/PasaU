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
      body: 'Students from eight Baguio schools buy, sell, swap and give away school things. This quick tour uses sample data.' },
    { as: 'visitor', url: 'index.html', target: ['#campus-toggle', '.campus-toggle'], title: 'Pick your campus',
      body: 'Students pick their school so they see items they can pick up on campus.' },
    { as: 'visitor', url: 'index.html?login=1', target: ['#login form', '#login'],
      prep: function () { return click('#login-modes button[data-mode="signup"]').then(function () { var e = document.getElementById('login-email'); if (e) { e.value = 'andrea.santos@students.uc-bcf.edu.ph'; e.dispatchEvent(new Event('input', { bubbles: true })); } var n = document.getElementById('su-name'); if (n) n.value = 'Andrea Santos'; return wait(300); }); },
      title: 'Students only, by school email',
      body: 'Only school emails can sign up, and the school fills itself in. Confirming the email gives a Verified badge.' },
    { as: 'student', url: 'index.html', title: 'You are now Andrea',
      body: 'You’re logged in as Andrea, a 2nd-year UC Nursing student. Everyone here is sample data.' },
    { as: 'student', url: 'index.html', target: ['#shop .grid', '#shop'], prep: function () { return waitFor('#shop').then(function (el) { if (el) el.scrollIntoView({ block: 'start' }); return wait(600); }); },
      title: 'The shop',
      body: 'Filter by category, condition, price, course and year. Each card shows the price next to the price new.' },
    { as: 'student', url: 'index.html', target: '#spotlight', title: 'Free items and swaps',
      body: 'Give things away or trade them, so last term’s books go to the next batch.' },
    { as: 'student', url: 'index.html?open=' + L.ANAT, target: ['dialog[open] .seller-card'], title: 'Know who you are dealing with',
      body: 'Every listing shows the seller’s school, course, Verified badge and vouches.' },
    { as: 'student', url: 'index.html?open=' + L.ANAT, target: ['dialog[open] .steps-bar', 'dialog[open] .box'], title: 'Reserve, then follow the steps',
      body: 'Reserve to hold an item, or join the queue. The step bar shows where the deal is.' },
    { as: 'student', url: 'index.html?open=' + L.BAG, target: ['#swap-pick', 'dialog[open] .box'], title: 'Offer a swap',
      body: 'Offer one of your own items in exchange.' },
    { as: 'student', url: 'index.html?open=' + L.SHIRT, target: ['dialog[open] .owner-row', 'dialog[open] .box'], title: 'Selling: offers and a waiting line',
      body: 'Set your listing’s status and see offers and who’s waiting in line.' },
    { as: 'student', url: 'index.html?open=' + L.DRAW, target: ['dialog[open] .code', 'dialog[open] .box'], title: 'Safe campus meetups',
      body: 'Meet on campus. The buyer reads out this 6-digit code at handover to close the deal.' },
    { as: 'student', url: 'index.html?sell=1&title=Pharmacology%20textbook&cat=books', target: ['dialog[open] form', 'dialog[open]'], title: 'Selling takes a minute',
      body: 'Photos, price, pickup spot, and course tags so the right students find it.' },
    { as: 'student', url: 'index.html', target: ['dialog[open]', '#nav-bell'], prep: function () { return phone() ? click('#menu-btn').then(function () { return click('.mnav-bell'); }) : click('#nav-bell'); }, title: 'Notifications',
      body: 'Messages, offers, meetups, vouches and matches arrive right away.' },
    { as: 'student', url: 'index.html', target: ['#dock-panel', '.dock-btn'], prep: function () { return click('.dock-btn'); }, title: 'Chats on every page',
      body: 'Buyers and sellers chat from a pop-up on every page.' },
    { as: 'student', url: 'messages.html?c=502', target: ['.meetup-card', '.mcard', '.inbox-thread'], title: 'Meetups live in the chat',
      body: 'Meetups are proposed and accepted right in the chat, with the handover code.' },
    { as: 'student', url: 'unimatch.html?post=901', target: ['#um-results'], prep: function () { return waitFor('#um-results').then(function (el) { if (el) el.scrollIntoView({ block: 'start' }); return wait(500); }); }, title: 'PasaMatch',
      body: 'Post what you need. PasaMatch finds listings and pings students who might have it.' },
    { as: 'student', url: 'profile.html#vouches', target: ['.p-panel:not([hidden])', '#panel-vouches', 'main'], title: 'Vouches build trust',
      body: 'After a deal, students vouch for each other, so good traders stand out.' },
    { as: 'student', url: 'profile.html#settings', target: [twoStep, '.p-panel:not([hidden])', 'main'], title: 'Two-step login and privacy',
      body: 'Two-step login with an authenticator app, plus privacy and alert settings.' },
    { as: 'student', url: 'profile.html#family', target: ['.p-panel:not([hidden])', 'main'], title: 'Parents can follow along',
      body: 'Invite a parent by link. They see meetups and deals, never chats.' },
    { as: 'parent', url: 'family.html', target: ['.p-panel', 'main'], title: 'The parent’s view',
      body: 'You’re Maria, Andrea’s mother. She sees upcoming meetups and can report a concern.' },
    { as: 'student', url: 'admin.html', target: ['.stats', '.a-stats', 'main'], title: 'Moderation',
      body: 'The PasaU team handles reports, verifies students and removes bad listings.' },
    { as: 'student', url: 'index.html', title: 'That’s PasaU',
      body: 'Explore freely as Andrea. Tap Demo at the bottom to restart or leave.' }
  ];

  // ---------- UI ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var dlg = el('dialog', 'pd-tour'); dlg.setAttribute('aria-labelledby', 'pd-title');
  var hole = el('div', 'pd-hole'), card = el('section', 'pd-card');
  var count = el('p', 'pd-count'), title = el('h2', 'pd-title'), body = el('p', 'pd-body');
  title.id = 'pd-title';
  var back = el('button', 'pd-btn pd-ghost', 'Back'), next = el('button', 'pd-btn', 'Next'), skip = el('button', 'pd-skip', 'Skip tour');
  [back, next, skip].forEach(function (b) { b.type = 'button'; });
  var head = el('div', 'pd-head'); head.append(title, count);
  var row = el('div', 'pd-row'); row.append(skip, back, next);
  var bar = el('div', 'pd-bar'), fill = el('i'); bar.append(fill);
  card.append(bar, head, body, row);
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
        card.style.cssText = below >= ch + 16 || below >= above ? 'bottom:10px;left:10px;right:10px' : 'top:10px;left:10px;right:10px';
      } else {
        var y = bottom + 14 + ch <= vh - 12 ? bottom + 14 : top - 14 - ch >= 12 ? top - 14 - ch : null;
        if (y == null) { // beside it
          var x = right + 16 + cw <= vw - 12 ? right + 16 : Math.max(left - 16 - cw, 12);
          card.style.cssText = 'top:' + Math.min(Math.max(top, 12), vh - ch - 12) + 'px;left:' + x + 'px';
        } else card.style.cssText = 'top:' + y + 'px;left:' + Math.min(Math.max(left, 12), vw - cw - 12) + 'px';
      }
    } else {
      hole.classList.add('pd-none'); hole.style.cssText = '';
      card.style.cssText = phone() ? 'bottom:10px;left:10px;right:10px' : 'top:50%;left:50%;transform:translate(-50%,-50%)';
    }
  }
  function show(i) {
    var s = steps[i];
    cur = i; ss.set('pasau-demo-tour', String(i));
    count.textContent = (i + 1) + '/' + steps.length;
    fill.style.width = ((i + 1) / steps.length * 100) + '%';
    title.textContent = s.title; body.textContent = s.body;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? 'Start exploring' : 'Next';
    skip.hidden = i === steps.length - 1;
    chip.hidden = true;
    return Promise.resolve(s.prep && s.prep()).then(function () { return s.target ? waitFor(s.target) : null; }).then(function (t) {
      target = t;
      if (t) {
        var r = t.getBoundingClientRect(), room = innerHeight - (phone() ? 170 : 120);
        if (r.top < 70 || r.bottom > innerHeight - (phone() ? 160 : 20)) t.scrollIntoView({ block: r.height > room ? 'start' : 'center' });
      }
      return wait(t ? 350 : 0);
    }).then(function () {
      dlg.inert = false; // the full-screen chats pop-up makes everything else inert, the tour included
      if (!dlg.open) dlg.showModal();
      card.classList.remove('pd-pop'); void card.offsetWidth; card.classList.add('pd-pop');
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

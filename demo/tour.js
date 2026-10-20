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
  function inSheet(re) {  // a button in the open listing pop-up whose label matches
    var bs = document.querySelectorAll('dialog[open] button');
    for (var i = 0; i < bs.length; i++) if (re.test(bs[i].textContent.trim())) return bs[i];
    return null;
  }
  function sheetSays(re) { var d = document.querySelector('dialog[open]:not(.pd-tour)'); return !!d && re.test(d.textContent); }
  var replied = false;
  document.addEventListener('pasau-demo:reply', function () { replied = true; });

  var S = {
    welcome: { as: 'visitor', url: 'index.html', title: 'Welcome to PasaU',
      body: 'Students from eight Baguio schools buy, sell, swap and give away school things. This two-minute tour uses sample data.' },
    signup: { as: 'visitor', url: 'index.html?login=1', target: ['#login form', '#login'],
      prep: function () { return click('#login-modes button[data-mode="signup"]').then(function () { var e = document.getElementById('login-email'); if (e) { e.value = 'andrea.santos@students.uc-bcf.edu.ph'; e.dispatchEvent(new Event('input', { bubbles: true })); } var n = document.getElementById('su-name'); if (n) n.value = 'Andrea Santos'; return wait(300); }); },
      title: 'Students only, by school email',
      body: 'Only school emails can sign up, and the school fills itself in. Confirming the email gives a Verified badge.' },
    shop: { as: 'student', url: 'index.html', target: ['#shop .grid', '#shop'], prep: function () { return waitFor('#shop').then(function (el) { if (el) el.scrollIntoView({ block: 'start' }); return wait(600); }); },
      title: 'You’re now Andrea, a UC student',
      body: 'She signed up with her school email, so she’s Verified. In the shop, every price sits next to the price new.' },
    reserve: { as: 'student', url: 'index.html?open=' + L.ANAT, target: [function () { return inSheet(/^Reserve$/); }, 'dialog[open] .box'],
      try: { done: function () { return sheetSays(/Reserved for you/) || !inSheet(/^Reserve$/); }, after: ['dialog[open] .steps-bar', 'dialog[open] .box'], title: 'Reserved!', body: 'It’s held for you. If you back out, it goes to the next person in line automatically.' },
      title: 'Try it: tap Reserve',
      body: 'Reserving holds a book for you, first come, first served.' },
    meetup: { as: 'student', url: 'index.html?open=' + L.DRAW, target: ['dialog[open] .code', 'dialog[open] .box'], title: 'Safe campus meetups',
      body: 'Meet on campus. The buyer reads out this 6-digit code at handover to close the deal. No code, no sale.' },
    chat: { as: 'student', url: 'messages.html?c=501', target: ['.composer'],
      prep: function () { replied = false; return waitFor('.composer').then(function (f) { var i = f && f.querySelector('textarea, input[type=text], input:not([type])'); if (i && !i.value) { i.value = 'Hi! Is this still available?'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); },
      try: { done: function () { return replied; }, after: ['.inbox-thread', '.composer'], title: 'It arrived live', body: 'Bea answered right away, with a notification. Real chats on PasaU work the same way.' },
      title: 'Try it: send a message',
      body: 'Tap the send button and watch the seller reply.' },
    pasamatch: { as: 'student', url: 'unimatch.html', target: ['.um-hero', 'main'], title: 'PasaMatch: ask for what you need',
      body: 'Can’t find it in the shop? Post what you need once. PasaMatch checks every listing and asks the students most likely to have one.' },
    pmtry: { as: 'student', url: 'unimatch.html', target: ['#um-post', '#um-form'],
      prep: function () { return waitFor('#um-form').then(function (f) { var n = document.getElementById('um-need'); if (n && !n.value) { n.value = 'Nursing board exam reviewer'; n.dispatchEvent(new Event('input', { bubbles: true })); } var m = document.getElementById('um-max'); if (m && !m.value) m.value = '500'; if (f) f.scrollIntoView({ block: 'center' }); return wait(400); }); },
      try: { done: function () { var r = document.getElementById('um-results'); return r && !r.hidden && /Students PasaMatch asked/.test(r.textContent) && !/Loading/.test(r.textContent); },
        after: ['#um-results'], title: 'Matched in seconds', body: 'It found listings that fit now, and asked two students likely to have one. Andrea is notified when they reply.' },
      title: 'Try it: ask PasaMatch',
      body: 'Can’t find it in the shop? Ask once. We filled in a Nursing reviewer, so tap Find a match.' },
    pmasked: { as: 'student', url: 'unimatch.html', target: ['#um-asked', '#um-board'], prep: function () { return waitFor('#um-asked:not([hidden])').then(function (el) { if (el) el.scrollIntoView({ block: 'center' }); return wait(500); }); }, title: 'It works both ways',
      body: 'When someone needs what you have, PasaMatch asks you. One tap on “I have this” sends them your listing.' },
    vouches: { as: 'student', url: 'profile.html#vouches', target: ['.p-panel:not([hidden])', '#panel-vouches', 'main'], title: 'Vouches build trust',
      body: 'After a deal, students vouch for each other, so good traders stand out.' },
    parent: { as: 'parent', url: 'family.html', target: [function () { var l = document.querySelector('.f-student'); return l && l.closest('.p-panel'); }, '.p-panel', 'main'], title: 'Parents can follow along',
      body: 'Now you’re Maria, Andrea’s mom. Andrea invited her, so Maria sees her meetups: where, when and with whom. Never her chats.' },
    palerts: { as: 'parent', url: 'family.html', target: ['.f-alerts', 'main'], prep: function () { return waitFor('.f-alerts').then(function (el) { if (el) el.scrollIntoView({ block: 'center' }); return wait(400); }); }, title: 'Alerts and check-ins',
      body: 'Maria is told when a meetup is set, and gets a check-in if it isn’t marked done 30 minutes after it starts.' },
    pconcern: { as: 'parent', url: 'family.html', target: ['.f-concern', 'main'], prep: function () { return waitFor('.f-concern button').then(function (b) { if (b) { b.click(); b.scrollIntoView({ block: 'center' }); } return wait(400); }); }, title: 'Help, not control',
      body: 'Parents can report a concern straight to the PasaU team. They never see chats and can’t buy, sell or message anyone, and the student can unlink them.' },
    endH: { as: 'student', url: 'index.html', end: true, title: 'That’s the highlights',
      body: 'Explore freely as Andrea, or see the rest of PasaU’s features.', nextText: 'See all features', skipText: 'Explore' },

    campus: { as: 'visitor', url: 'index.html', target: ['#campus-toggle', '.campus-toggle'], title: 'Pick your campus',
      body: 'Students pick their school so they see items they can pick up on campus.' },
    free: { as: 'student', url: 'index.html', target: '#spotlight', title: 'Free items and swaps',
      body: 'Give things away or trade them, so last term’s books go to the next batch.' },
    seller: { as: 'student', url: 'index.html?open=' + L.CALC, target: ['dialog[open] .seller-card'], title: 'Know who you’re dealing with',
      body: 'Every listing shows the seller’s school, course, Verified badge and vouches. The step bar shows where a deal is.' },
    swap: { as: 'student', url: 'index.html?open=' + L.BAG, target: ['#swap-pick', 'dialog[open] .box'], title: 'Offer a swap',
      body: 'Offer one of your own items in exchange.' },
    selling: { as: 'student', url: 'index.html?open=' + L.SHIRT, target: ['dialog[open] .owner-row', 'dialog[open] .box'], title: 'Offers and a waiting line',
      body: 'On your own listing, set its status and see offers and who’s waiting in line.' },
    sell: { as: 'student', url: 'index.html?sell=1&title=Pharmacology%20textbook&cat=books', target: ['dialog[open] form', 'dialog[open]'], title: 'Selling takes a minute',
      body: 'Photos, price, pickup spot, and course tags so the right students find it.' },
    notes: { as: 'student', url: 'index.html', target: ['dialog[open]', '#nav-bell'], prep: function () { return phone() ? click('#menu-btn').then(function () { return click('.mnav-bell'); }) : click('#nav-bell'); }, title: 'Notifications',
      body: 'Messages, offers, meetups, vouches and matches arrive right away.' },
    dock: { as: 'student', url: 'index.html', target: ['#dock-panel', '.dock-btn'], prep: function () { return click('.dock-btn'); }, title: 'Chats on every page',
      body: 'Buyers and sellers chat from a pop-up that follows them around the site.' },
    twostep: { as: 'student', url: 'profile.html#settings', target: [twoStep, '.p-panel:not([hidden])', 'main'], title: 'Two-step login',
      body: 'Students can add an authenticator app, and choose what others see and which alerts they get.' },
    family: { as: 'student', url: 'profile.html#family', target: ['.p-panel:not([hidden])', 'main'], title: 'Invite a parent',
      body: 'Families worry about meeting strangers. Andrea can invite her mom or a guardian with a link, and she chooses what they see.' },
    admin: { as: 'student', url: 'admin.html', target: ['.stats', '.a-stats', 'main'], title: 'Moderation',
      body: 'The PasaU team handles reports, verifies students and removes bad listings.' },
    endF: { as: 'student', url: 'index.html', end: true, title: 'That’s everything',
      body: 'Explore freely as Andrea. Tap the Demo tab on the left to jump to any feature or leave.', nextText: 'Start exploring' }
  };
  var LISTS = {
    h: ['welcome', 'shop', 'reserve', 'meetup', 'chat', 'pmtry', 'pmasked', 'parent', 'palerts', 'endH'],
    x: ['signup', 'campus', 'free', 'seller', 'swap', 'selling', 'sell', 'notes', 'dock', 'pasamatch', 'vouches', 'family', 'pconcern', 'twostep', 'admin', 'endF']
  };
  // ---------- UI ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var dlg = el('dialog', 'pd-tour'); dlg.setAttribute('aria-labelledby', 'pd-title');
  var hole = el('div', 'pd-hole'), card = el('section', 'pd-card');
  var count = el('p', 'pd-count'), title = el('h2', 'pd-title'), body = el('p', 'pd-body');
  title.id = 'pd-title';
  var back = el('button', 'pd-btn pd-ghost', 'Back'), next = el('button', 'pd-btn pd-next', 'Next'), skip = el('button', 'pd-skip', 'Skip tour');
  [back, next, skip].forEach(function (b) { b.type = 'button'; });
  var head = el('div', 'pd-head'); head.append(title, count);
  var row = el('div', 'pd-row'); row.append(skip, back, next);
  var bar = el('div', 'pd-bar'), fill = el('i'); bar.append(fill);
  card.append(bar, head, body, row);
  dlg.append(hole, card);
  // Clicks on the card must not reach a listing pop-up underneath (it closes on outside clicks)
  card.addEventListener('click', function (e) { e.stopPropagation(); });

  // The Demo tab: continue, jump to a feature, start over, leave
  var chip = el('div', 'pd-chip');
  var chipMain = el('button', 'pd-chip-btn', 'Demo'), menu = el('div', 'pd-menu');
  chipMain.type = 'button'; chipMain.setAttribute('aria-expanded', 'false'); chipMain.setAttribute('aria-label', 'Demo menu');
  var mResume = el('button', 'pd-strong', 'Continue the tour'), mRestart = el('button', '', 'Start over'), mExit = el('button', '', 'Leave the demo');
  var jumps = el('div', 'pd-jumps');
  jumps.append(el('p', 'pd-menu-head', 'Jump to a feature'));
  ['h', 'x'].forEach(function (k) {
    LISTS[k].forEach(function (id, i) {
      if (id === 'welcome' || S[id].end) return;
      var b = el('button', '', S[id].title.replace(/^Try it: /, '').replace(/, a UC student$/, '').replace(/^You’re now Andrea$/, 'The shop'));
      b.type = 'button';
      b.onclick = function () { menu.hidden = true; go(k, i); };
      jumps.append(b);
    });
  });
  menu.append(el('p', 'pd-menu-note', 'Sample data only. Nothing here reaches real students.'), mResume, jumps, mRestart, mExit); menu.hidden = true;
  [mResume, mRestart, mExit].forEach(function (b) { b.type = 'button'; });
  chip.append(chipMain, menu);

  var list = 'h', cur = -1, target = null, trying = null;
  function step() { return S[LISTS[list][cur]] || {}; }
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
  function setState() { ss.set('pasau-demo-tour', list + ':' + cur); }
  // A "try it" step leaves the page usable: the tour sits inside whatever pop-up is open, without blocking it
  function openTour(interactive) {
    if (dlg.open) dlg.close();
    dlg.classList.toggle('pd-try', interactive);
    var host = interactive ? [].slice.call(document.querySelectorAll('dialog[open]:not(.pd-tour)')).pop() || document.body : document.body;
    if (dlg.parentNode !== host) host.appendChild(dlg);
    dlg.inert = false; // the full-screen chats pop-up makes everything else inert, the tour included
    if (interactive) dlg.show(); else dlg.showModal();
  }
  function show(k, i) {
    list = k; cur = i; setState();
    var s = step(), n = LISTS[k].length;
    trying = null; card.classList.remove('pd-win');
    count.textContent = (i + 1) + '/' + n;
    fill.style.width = ((i + 1) / n * 100) + '%';
    title.textContent = s.title; body.textContent = s.body;
    back.hidden = i === 0;
    next.textContent = s.nextText || (s.try ? 'Skip this' : 'Next');
    next.classList.toggle('pd-ghost', !!s.try);
    skip.textContent = s.skipText || 'Skip tour';
    skip.hidden = !!s.end && !s.skipText;
    chip.hidden = true;
    return Promise.resolve(s.prep && s.prep()).then(function () { return s.target ? waitFor(s.target) : null; }).then(function (t) {
      target = t;
      if (t) {
        var r = t.getBoundingClientRect(), room = innerHeight - (phone() ? 170 : 120);
        if (r.top < 70 || r.bottom > innerHeight - (phone() ? 160 : 20)) t.scrollIntoView({ block: r.height > room ? 'start' : 'center' });
      }
      return wait(t ? 350 : 0);
    }).then(function () {
      var tryIt = s.try && target && !s.try.done();
      openTour(!!tryIt);
      if (s.try && !tryIt) finishTry(s);
      else if (tryIt) trying = s;
      card.classList.remove('pd-pop'); void card.offsetWidth; card.classList.add('pd-pop');
      place(); place();
      if (!tryIt) next.focus();
    });
  }
  function finishTry(s) {
    trying = null;
    title.textContent = s.try.title; body.textContent = s.try.body;
    next.textContent = 'Next'; next.classList.remove('pd-ghost');
    card.classList.remove('pd-pop'); void card.offsetWidth; card.classList.add('pd-pop', 'pd-win');
    // back to a normal step: point at the result, page blocked again so Next is the obvious move
    target = s.try.after ? find(s.try.after) : target;
    openTour(false); place();
    next.focus();
  }
  setInterval(function () { if (trying && trying.try.done()) finishTry(trying); }, 300);

  function close() { if (cur >= 0) ss.set('pasau-demo-last', list + ':' + cur); if (dlg.open) dlg.close(); target = null; trying = null; ss.set('pasau-demo-tour', ''); chip.hidden = false; }
  function same(url) { var u = new URL(url, location.href); return u.pathname === location.pathname && u.search === location.search && u.hash === location.hash; }
  var leaving = false;  // a second tap during the page change must not skip a step
  function go(k, i) {
    if (leaving) return;
    var s = S[LISTS[k][i]];
    if (!s) { close(); return; }
    var prev = step(), goingBack = k === list && i < cur;
    var inPlace = cur >= 0 && s.as === Demo.persona() && same(s.url) && !s.prep && !s.try && !prev.prep && !prev.try && !document.querySelector('dialog[open]:not(.pd-tour)');
    if (inPlace) { show(k, i); return; }
    list = k; cur = i; setState();
    Demo.setPersona(s.as);
    var u = new URL(s.url, location.href);
    leaving = true;
    leave(goingBack ? 'back' : 'fwd', function () {
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
  next.onclick = function () {
    var s = step();
    if (s.end) { if (list === 'h') go('x', 0); else close(); return; }
    go(list, cur + 1);
  };
  back.onclick = function () { go(list, cur - 1); };
  skip.onclick = close;
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  chipMain.onclick = function () { menu.hidden = !menu.hidden; chipMain.setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', function (e) { if (!menu.hidden && !chip.contains(e.target)) { menu.hidden = true; chipMain.setAttribute('aria-expanded', 'false'); } });
  function parse(v) { var m = /^([hx]):(\d+)$/.exec(v || ''); return m ? [m[1], +m[2]] : null; }
  mResume.onclick = function () { menu.hidden = true; var p = parse(ss.get('pasau-demo-last')) || ['h', 0]; go(p[0], Math.min(p[1], LISTS[p[0]].length - 1)); };
  mRestart.onclick = function () {
    menu.hidden = true;
    ['pasau-demo-db', 'pasau-demo-img', 'pasau-demo-2fa'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });  // fresh sample data
    cur = -1; go('h', 0);
  };
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
    var p = parse(t) || (/^\d+$/.test(t || '') ? ['h', 0] : null);
    if (!p) return;
    ss.set('pasau-demo-last', p[0] + ':' + p[1]);
    // let the page draw itself and its page-in sweep finish first, but don't wait forever on slow photos or fonts
    var loaded = document.readyState === 'complete' ? Promise.resolve() : Promise.race([new Promise(function (r) { addEventListener('load', r, { once: true }); }), wait(2500)]);
    loaded.then(function () { return wait(700); }).then(function () { show(p[0], Math.min(p[1], LISTS[p[0]].length - 1)); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

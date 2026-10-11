/* Accessibility settings: saved on this device and applied before the page draws.
   Load in <head> on every page. Opens from the nav button or anything with [data-a11y]. */
(function () {
  var KEY = 'uc-a11y', root = document.documentElement;
  var GROUPS = [
    ['text', 'Text size', [['', 'Default'], ['l', 'Large'], ['xl', 'Larger']]],
    ['theme', 'Colours', [['', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']]],
    ['contrast', 'Contrast', [['', 'Default'], ['high', 'High']]],
    ['motion', 'Motion', [['', 'Match my device'], ['reduce', 'Reduce'], ['full', 'Always on']]],
    ['font', 'Font', [['', 'Default'], ['readable', 'Easy to read']]],
    ['links', 'Links', [['', 'Default'], ['underline', 'Always underlined']]],
    ['keys', 'Keyboard shortcuts', [['', 'On'], ['off', 'Off']]]
  ];
  // Single-key shortcuts (off switch above). Ignored while typing or when a pop-up is open.
  var KEYS = [
    ['/', 'Search listings', function () {
      var q = document.getElementById('q');
      if (q) { q.focus(); q.scrollIntoView({ block: 'center' }); } else location.href = 'index.html#shop';
    }],
    ['h', 'Home', function () { location.href = 'index.html'; }],
    ['s', 'Sell an item', function () { var b = document.querySelector('[data-sell]'); if (b) b.click(); else location.href = 'index.html?sell=1'; }],
    ['m', 'Messages', function () { if (window.UCChats) window.UCChats.open(); else location.href = 'messages.html'; }],
    ['n', 'Notifications', function () { var b = document.getElementById('nav-bell'); if (b && !b.hidden) b.click(); else if (!b) location.href = 'index.html'; }],
    ['p', 'Your profile', function () { location.href = 'profile.html'; }],
    ['a', 'Accessibility settings', function () { open(); }],
    ['?', 'Show these shortcuts', function () { open('keys'); }]
  ];
  var TIPS = [['Tab / Shift+Tab', 'Move to the next / previous button or link'], ['Enter or Space', 'Press the focused button'],
    ['Esc', 'Close a pop-up or menu'], ['← →', 'Move the featured-items carousel when it is focused']];
  var settings = load();

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }
  function apply() {
    GROUPS.forEach(function (g) {
      if (settings[g[0]]) root.setAttribute('data-' + g[0], settings[g[0]]); else root.removeAttribute('data-' + g[0]);
    });
    if (settings.font === 'readable' && !document.getElementById('a11y-font')) {
      var l = document.createElement('link');
      l.id = 'a11y-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    document.dispatchEvent(new CustomEvent('uc:a11y', { detail: settings }));
  }
  apply();

  var ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="2" fill="currentColor"/>' +
    '<path d="M5 8.5l7 1.5 7-1.5M12 10v4.5m0 0l-3.5 6m3.5-6l3.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function build() {
    var dlg = document.createElement('dialog');
    dlg.id = 'a11y'; dlg.className = 'sheet a11y'; dlg.setAttribute('aria-labelledby', 'a11y-title');
    dlg.innerHTML = '<button class="round close" type="button" aria-label="Close"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '<div class="sheet-in"><h2 id="a11y-title">Accessibility</h2><p class="muted">Changes apply right away and are saved on this device.</p>' +
      GROUPS.map(function (g) {
        return '<fieldset><legend>' + g[1] + '</legend><div class="a11y-opts">' + g[2].map(function (o) {
          return '<label><input type="radio" name="a11y-' + g[0] + '" value="' + o[0] + '"><span>' + o[1] + '</span></label>';
        }).join('') + '</div></fieldset>';
      }).join('') +
      '<section class="a11y-keys" aria-labelledby="a11y-keys-title" tabindex="-1"><h3 id="a11y-keys-title">Using a keyboard</h3><dl>' +
      TIPS.concat(KEYS).map(function (k) { return '<div><dt><kbd>' + k[0] + '</kbd></dt><dd>' + k[1] + '</dd></div>'; }).join('') +
      '</dl></section>' +
      '<button class="pill ghost" type="button" data-reset>Reset to default</button></div>';
    dlg.addEventListener('change', function (e) {
      settings[e.target.name.slice(5)] = e.target.value;
      save(); apply();
    });
    dlg.querySelector('.close').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('[data-reset]').addEventListener('click', function () { settings = {}; save(); apply(); sync(dlg); });
    // Close on a click on the backdrop, but not when a drag started inside the panel
    var downOutside = false;
    dlg.addEventListener('pointerdown', function (e) { downOutside = e.target === dlg; });
    dlg.addEventListener('click', function (e) { if (downOutside && e.target === dlg && e.detail) dlg.close(); downOutside = false; });
    document.body.appendChild(dlg);
    return dlg;
  }
  function sync(dlg) {
    [].forEach.call(dlg.querySelectorAll('input'), function (i) { i.checked = (settings[i.name.slice(5)] || '') === i.value; });
  }
  function open(section) {
    var dlg = document.getElementById('a11y') || build();
    sync(dlg);
    if (!dlg.open) dlg.showModal();
    if (section === 'keys') { var k = dlg.querySelector('.a11y-keys'); k.focus(); k.scrollIntoView({ block: 'start' }); }
  }
  window.UCA11y = { open: open, settings: function () { return settings; } };

  document.addEventListener('DOMContentLoaded', function () {
    // "Skip to main content": the first thing Tab reaches on every page
    var main = document.querySelector('main');
    if (main) {
      if (!main.id) main.id = 'main';
      main.setAttribute('tabindex', '-1');
      var skip = document.createElement('a');
      skip.className = 'skip-link'; skip.href = '#' + main.id; skip.textContent = 'Skip to main content';
      skip.addEventListener('click', function (e) { e.preventDefault(); main.focus(); main.scrollIntoView(); });
      document.body.insertBefore(skip, document.body.firstChild);
    }
    var nav = document.querySelector('.nav-right');
    if (nav && !document.getElementById('mnav')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'round a11y-btn'; b.setAttribute('aria-label', 'Accessibility settings');
      b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('data-a11y', ''); b.innerHTML = ICON;
      nav.insertBefore(b, nav.firstChild);
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-a11y]')) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', function (e) {
    if (settings.keys === 'off' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    var t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || document.querySelector('dialog[open]')) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (e.key && e.key.toLowerCase() === KEYS[i][0]) { e.preventDefault(); KEYS[i][2](); return; }
    }
  });
})();

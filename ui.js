/* Small shared helpers for profile.html and admin.html */
window.UI = (function () {
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k in e && k !== 'list') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.append(c); });
    return e;
  }
  function opt(v, t) { return h('option', { value: v, text: t }); }
  function field(label, input, hint) {
    return h('div', { class: 'field' }, [h('label', { htmlFor: input.id, text: label }), input, hint ? h('small', { class: 'hint', text: hint }) : null]);
  }
  var toastEl, tTimer;
  function toast(msg) {
    toastEl = toastEl || document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 4000);
  }
  function when(t) { return new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function day(t) { return new Date(t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function peso(n) { return '₱' + Number(n || 0).toLocaleString('en-PH'); }
  function errText(e) {  // database messages written for students pass through; technical ones become one plain line
    var m = (e && (e.message || e.error_description)) || '';
    return m && m.length < 120 && !/fetch|network|jwt|permission|violates|relation|function|column|syntax|uuid|null value|schema|postgres|pgrst|duplicate key|constraint/i.test(m) ? m : 'Something went wrong. Check your connection and try again.';
  }
  function initials(name) {
    var parts = (name || '?').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }
  // Profile photo, or the person's initials on a green circle
  function avatar(url, name, size) {
    var s = size || 40;
    var box = h('span', { class: 'avatar', style: 'width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * 0.38) + 'px' });
    if (url) box.append(h('img', { src: url, alt: '', loading: 'lazy' }));
    else box.textContent = initials(name);
    return box;
  }
  function note() { return h('p', { class: 'note', 'aria-live': 'polite' }); }
  function say(n, msg, isErr) { n.textContent = msg; n.classList.toggle('err', !!isErr); }
  // Button that disables itself while its promise runs and reports errors into a note
  function action(text, fn, n, cls) {
    return h('button', { class: cls || 'pill small', type: 'button', text: text, onclick: function () {
      var b = this;
      b.disabled = true;
      Promise.resolve().then(function () { return fn(b); })
        .then(function () { b.disabled = false; })
        .catch(function (e) { b.disabled = false; if (n) say(n, errText(e), true); else toast(errText(e)); });
    } });
  }
  function empty(title, sub, kids) {
    return h('div', { class: 'p-empty' }, [h('p', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null].concat(kids || []));
  }
  return { h: h, opt: opt, field: field, toast: toast, when: when, day: day, peso: peso, errText: errText,
           avatar: avatar, note: note, say: say, action: action, empty: empty };
})();

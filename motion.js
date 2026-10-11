/* Motion: content rises in as you scroll, pages slide between each other, the nav lifts when scrolled.
   Load in <head> after a11y.js. Everything stays still when the device or the Accessibility panel asks for reduced motion. */
(function () {
  var root = document.documentElement;
  var system = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Accessibility panel wins: "Reduce" = still, "Always on" = animate even if the device asks for less motion
  function ok() {
    var m = root.getAttribute('data-motion');
    return 'IntersectionObserver' in window && (m === 'full' || (m !== 'reduce' && !system.matches));
  }

  // What rises in. One list, used by both the CSS below and the observer.
  var SEL = '.hero-copy > *, .stage, section > .head, .chips, .card, .steps li, .spot-card, .wanted-list li, .cta, footer,' +
    ' .p-head, .p-tabs, .p-panel, .a-stat';
  var css = document.createElement('style');
  css.textContent =
    '.motion-ok :is(' + SEL + '):not(.in) { opacity: 0; transform: translateY(26px); }' +
    '.motion-ok :is(' + SEL + ').in:not(.done) { transition: opacity .6s ease var(--rd, 0s), transform .8s cubic-bezier(.16,1,.3,1) var(--rd, 0s); }';
  document.head.appendChild(css);
  function setOn() { root.classList.toggle('motion-ok', ok()); }
  setOn();
  document.addEventListener('uc:a11y', setOn);
  if (system.addEventListener) system.addEventListener('change', setOn);

  var io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
    var n = 0;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      el.style.setProperty('--rd', Math.min(n++, 6) * 70 + 'ms');  // stagger things that arrive together
      el.classList.add('in');
      el.addEventListener('transitionend', function done(ev) {
        if (ev.target !== el || ev.propertyName !== 'transform') return;
        el.removeEventListener('transitionend', done);
        el.classList.add('done');  // hand transitions back to the element's own hover effects
        el.style.removeProperty('--rd');
      });
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  function watch(node) {
    if (!io || node.nodeType !== 1) return;
    if (node.matches(SEL)) io.observe(node);
    [].forEach.call(node.querySelectorAll(SEL), function (el) { io.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    watch(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, watch); });
    }).observe(document.body, { childList: true, subtree: true });

    // Nav gets a shadow once the page is scrolled
    var nav = document.querySelector('.nav');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });

  // Page changes (browsers with cross-page view transitions): the nav stays put, the page slides
  function name(on) {
    var nav = document.querySelector('.nav'), main = document.querySelector('main');
    if (nav) nav.style.viewTransitionName = on ? 'nav' : '';
    if (main) main.style.viewTransitionName = on ? 'page' : '';
    if (on) [].forEach.call(document.querySelectorAll('.card'), function (c) { c.style.viewTransitionName = ''; });
  }
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    if (!ok()) return e.viewTransition.skipTransition();
    name(true);
  });
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    if (!ok()) return e.viewTransition.skipTransition();
    name(true);
    e.viewTransition.finished.then(function () { name(false); });
  });
})();

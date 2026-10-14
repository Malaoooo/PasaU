/* Page-to-page transition: a brand-green panel sweeps across carrying the PasaU mark, and the mark's U-turn arrow
   turns around in the direction of travel. Deeper into the site (Home > UniMatch > Messages > Profile > Admin) sweeps
   right and turns clockwise; back toward Home sweeps left and turns counter-clockwise.
   The incoming half is started by the inline script in each page's <head> (html[data-nav-in]). */
(function () {
  var ORDER = ['index', 'unimatch', 'messages', 'profile', 'admin'];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function rank(path) {
    var name = (path.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
    var i = ORDER.indexOf(name);
    return i < 0 ? 0 : i;
  }
  function motionOff() {
    var m = document.documentElement.getAttribute('data-motion');
    return m === 'reduce' || (m !== 'full' && reduce.matches);
  }

  // Incoming half: the panel is already covering the page (CSS); let it sweep off, then clean up
  var root = document.documentElement;
  if (root.dataset.navIn) setTimeout(function () { delete root.dataset.navIn; }, 700);

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin || url.pathname === location.pathname || !/(\.html|\/)$/.test(url.pathname)) return;
    if (motionOff()) return;
    e.preventDefault();
    var dir = rank(url.pathname) >= rank(location.pathname) ? 'fwd' : 'back';
    try { sessionStorage.setItem('pasau-nav', dir); } catch (err) { /* no storage: the new page simply appears */ }
    var wipe = document.createElement('div');
    wipe.className = 'pg-wipe out ' + dir;
    wipe.setAttribute('aria-hidden', 'true');
    wipe.innerHTML = '<span></span>';
    document.body.appendChild(wipe);
    var went = false;
    function go() { if (!went) { went = true; location.href = url.href; } }
    wipe.addEventListener('animationend', go);
    setTimeout(go, 450);  // never strand the click if animationend does not fire
  });

  // Coming back through the browser's back/forward cache: never leave a panel over the page
  addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    document.querySelectorAll('.pg-wipe').forEach(function (w) { w.remove(); });
    delete root.dataset.navIn;
  });
})();

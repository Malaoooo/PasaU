/* End of the pre-pilot test: no new listings, Looking For posts or accounts. Chats, reserves and meetups on existing listings still work.
   The database blocks the same things (db/lockdown.sql). To reopen: set LOCKED to false here and run the "reopen" line in db/lockdown.sql.
   The judges' demo (sample data in this tab only) is never locked. */
(function () {
  var LOCKED = true;
  var demo = false;
  try { demo = !!sessionStorage.getItem('pasau-demo'); } catch (e) {}
  window.PASAU_LOCKED = LOCKED && !demo;
  if (!window.PASAU_LOCKED) return;

  window.PASAU_LOCKED_MSG = 'The pre-pilot test is over, so new listings and Looking For posts are paused. You can still message sellers about existing listings.';
  document.documentElement.classList.add('pasau-locked');

  var css = document.createElement('style');
  css.textContent =
    '.lock-bar { position: relative; z-index: 30; background: var(--block, #1F5A36); color: #fff; font: 500 14px/1.45 var(--display, system-ui, sans-serif);' +
    ' padding: 10px 16px; padding-top: calc(env(safe-area-inset-top, 0px) + 10px); text-align: center; text-wrap: pretty; }' +
    '.lock-bar b { color: var(--brand-gold, #F2A900); font-weight: 700; }' +
    '.lock-bar p { margin: 0 auto; max-width: 72ch; }' +
    /* Everything that starts a new listing or a new account */
    '.pasau-locked [data-sell], .pasau-locked #login-modes, .pasau-locked .um-form .field, .pasau-locked .um-form .um-row, .pasau-locked #um-post { display: none !important; }';
  document.head.appendChild(css);

  function bar() {
    if (document.querySelector('.lock-bar')) return;
    var b = document.createElement('div');
    b.className = 'lock-bar';
    b.setAttribute('role', 'note');
    b.innerHTML = '<p><b>Thank you for testing PasaU!</b> Our pre-pilot testing phase is finished. You can still message sellers and finish deals on existing listings, ' +
      'but new listings, new Looking For posts and new accounts are paused for now.</p>';
    document.body.insertBefore(b, document.body.firstChild);
  }
  if (document.body) bar(); else document.addEventListener('DOMContentLoaded', bar);
})();

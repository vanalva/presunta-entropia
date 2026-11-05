/* =============================================================
   COMING SOON / 404 stage (css/pe-soon.css)
   The PE-83 sits below the title with only its screen on the page. The first
   click brings it to the centre of the screen and the logo and title leave
   upwards. Esc or a click outside sends it back.

   That first click only opens: nothing reaches the console underneath, or it
   would also press whatever is on its screen. The console stays at its biggest
   size and scales down to fit, so its pixels stay sharp and the whole move
   runs on the compositor.
   ============================================================= */
(function () {
  'use strict';

  var page = document.querySelector('.pe-soon');
  var stage = page && page.querySelector('.pe-soon_stage');
  var con = stage && stage.querySelector('.pe-con');
  if (!con) return;

  var EDGE = 16;   // px kept free above and below the open console
  var isOpen = false;

  function fit() {
    var h = con.offsetHeight, vh = window.innerHeight;
    if (!h) return;
    var s = Math.min(1, (vh - EDGE * 2) / h);
    page.style.setProperty('--pe-soon-open-s', s.toFixed(4));
    page.style.setProperty('--pe-soon-open-y', Math.round((vh - h * s) / 2 - stage.offsetTop) + 'px');
  }
  function setOpen(on) {
    if (on === isOpen) return;
    isOpen = on;
    if (on) fit();
    page.classList.toggle('is-open', on);
    stage.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) stage.removeAttribute('tabindex'); else stage.setAttribute('tabindex', '0');
  }

  // closed: the console is one big button
  function swallow(e) {
    if (isOpen) return;
    e.stopPropagation();
    e.preventDefault();
  }
  ['pointerdown', 'mousedown', 'touchstart'].forEach(function (type) {
    stage.addEventListener(type, swallow, { capture: true, passive: false });
  });
  stage.addEventListener('click', function (e) {
    if (isOpen) return;
    swallow(e);
    setOpen(true);
  }, true);
  stage.addEventListener('keydown', function (e) {
    if (isOpen || e.target !== stage || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    setOpen(true);
  });

  document.addEventListener('click', function (e) {
    if (isOpen && !con.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen) return;
    setOpen(false);
    stage.focus({ preventScroll: true });
  });
  window.addEventListener('resize', function () { if (isOpen) fit(); }, { passive: true });
})();

/* pe-metodo-values.js. la-escuela: the five method values as a tab selector.
   Hover or click/tap/arrow keys show a value; it also rotates every 7s until the
   person touches it (then never again), only while on screen, never under
   reduced motion. Own file because pe-motion only handles entrances. */
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-metodo-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-metodo-panel]'));
  if (!tabs.length || tabs.length !== panels.length) return;
  var cur = 0, stopped = false, visible = false, timer = null;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(i) {
    cur = i;
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      t.classList.toggle('is-active', on);
      panels[k].classList.toggle('is-active', on);
    });
  }
  function stop() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
  }
  function sync() {
    var run = !stopped && !reduced && visible && !document.hidden;
    if (run && !timer) timer = setInterval(function () { show((cur + 1) % tabs.length); }, 7000);
    else if (!run && timer) { clearInterval(timer); timer = null; }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') { stop(); show(i); }
    });
    t.addEventListener('click', function () { stop(); show(i); });
    t.addEventListener('keydown', function (e) {
      var n = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + tabs.length - 1) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n < 0) return;
      e.preventDefault(); stop(); show(n); tabs[n].focus();
    });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting; sync();
    }, { threshold: 0.2 }).observe(document.querySelector('.metodo_valores'));
  }
  document.addEventListener('visibilitychange', sync);
})();

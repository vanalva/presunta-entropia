/* =============================================================
   PHONE NAVIGATION (css/pe-mobile-nav.css)
   Top row: isotype, cart, MENU. Bottom row: music, assistant.
   The rows arrive when the hero's dock scrolls away and stay for two seconds
   of scrolling down. From then on the direction decides: up brings them back,
   down sends them off. Music that is playing stays, until the footer console
   with its own music screen comes in.

   Everything that happens on a change of direction is a Web Animation on these
   elements: a class on <html> restyles the whole page here (15-25ms at phone
   speed, in the very moment the finger reverses).
   ============================================================= */
(function () {
  'use strict';
  var LINGER = 2000;                // the rows stay this long after they arrive
  var TRAVEL = 8;                   // px in one direction before it counts
  var TOP = 8;                      // px from the top of the page that count as the top
  var MS = 320;
  var EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1)';
  var LOGO = '<svg viewBox="0 0 197.88 152.68" aria-hidden="true"><path d="M197.88,151.19l-1.26-27.83c-.05-.59-.45-1.09-1.01-1.28l-63.88-21.03,8.58-6.72.08-.06,54-36.43c.84-.57.87-1.8.06-2.4l-17.55-23.99c-.34-.96-1.52-1.3-2.31-.66l-50.96,40.62-.09.06-9.06,6.22-.15-10.9v-.1S117.96,1.56,117.96,1.56c.06-1.01-.9-1.78-1.88-1.5h-34.28c-.97-.28-1.94.48-1.88,1.5l3.63,65.12v.1s-.15,10.9-.15,10.9l-9.06-6.22-.08-.06L23.29,30.77c-.79-.63-1.97-.29-2.31.66L3.43,55.43c-.81.61-.78,1.83.06,2.4l54,36.43.08.06,8.58,6.72L2.27,122.08c-.56.19-.96.69-1.01,1.28L0,151.19c0,1.01.98,1.74,1.95,1.41l73.51-24.89c4.53-1.53,8.27-4.8,10.41-9.08l7.99-16.03c1.01-2.02,2.99-2.98,4.94-2.91h0s.1,0,.15,0c.05,0,.1,0,.15,0h0c1.95-.08,3.94.88,4.94,2.9l7.99,16.03c2.13,4.28,5.87,7.55,10.41,9.08l73.51,24.89c.96.33,1.96-.4,1.95-1.41Z"/></svg>';

  var mq = window.matchMedia('(max-width: 767px)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;
  var cluster, chat, chatRow, logo, float, screen, hasDock;
  var lastY = 0, maxY = 0, travel = 0, dir = 0, armed = true, timer = 0, frame = 0, settle = 0;
  var away = false, sounding = false, atTop = false;
  var large = 0, rest = 0, shift = 0, shiftAnim = null;

  /* ---------- the rows ---------- */
  // one animation per element, played forward to leave and backward to return,
  // so a change of mind mid-way turns around from where it is
  function slide(el, out, to) {
    if (!el || !el.animate) return;
    var a = el.__peMnav;
    if (!a) {
      if (!out) return;
      a = el.__peMnav = el.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: calm.matches ? 'none' : 'translateY(' + to + ')' }],
        { duration: MS, easing: EASE, fill: 'both' });
      a.onfinish = function () { if (a.playbackRate < 0) drop(el); };
      return;
    }
    a.playbackRate = out ? 1 : -1;
    a.play();
  }
  function drop(el) {
    if (!el || !el.__peMnav) return;
    el.__peMnav.cancel();
    el.__peMnav = null;
  }
  function moveRows() {
    slide(logo, away, '-8rem');
    slide(cluster, away, '-8rem');
    slide(chatRow, away, '10rem');
    slide(float, away && !sounding, '10rem');
    fit();
  }
  function setAway(v) {
    if (v === away) return;
    away = v;
    moveRows();
  }
  // nothing leaves while the chat or the phone menu is open
  function held() {
    return root.classList.contains('vanny-open') || root.classList.contains('pe-menu-sheet');
  }

  /* ---------- the music screen and the browser bar ----------
     The bar collapses as the page scrolls down. The other controls are leaving
     at that moment; the music screen stays, and a fixed element is not always
     carried down with the bar, which leaves it floating above the empty space.
     So it is measured against the bottom of the largest viewport and moved the
     difference, which is 0 wherever the browser already carried it. */
  function measureLarge() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(d);
    large = d.getBoundingClientRect().height;
    d.remove();
  }
  function fit() {
    if (!screen || !screen.animate || !large) return;
    var want = 0;
    if (away && sounding) want = Math.max(0, Math.min(140, large - rest - float.getBoundingClientRect().bottom));
    if (Math.abs(want - shift) < 2) return;
    var from = shift;
    shift = want;
    if (shiftAnim) shiftAnim.cancel();
    shiftAnim = screen.animate(
      [{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(' + want + 'px)' }],
      { duration: MS, easing: EASE, fill: 'forwards' });
  }

  /* ---------- scrolling ---------- */
  // At the top of the page the rows are off, whether or not the hero's dock has
  // been seen yet: on the template pages that takes over a second after load.
  function setTop(v) {
    if (v === atTop) return;
    atTop = v;
    root.classList.toggle('pe-mnav-top', v);
  }
  function stopTimer() { clearTimeout(timer); timer = 0; }
  function rearm() {
    stopTimer();
    armed = true;
    travel = 0;
    dir = 0;
    if (!away) return;
    away = false;
    [logo, cluster, chatRow, float].forEach(drop);
    fit();
  }
  function linger() {
    timer = 0;
    armed = false;
    if (dir > 0 && !held()) setAway(true);
  }

  function read() {
    frame = 0;
    if (!mq.matches) return;
    var raw = window.scrollY || 0;
    if (raw >= maxY) maxY = Math.max(0, root.scrollHeight - window.innerHeight);
    // iOS overscroll: the bounce back from either end is not a change of direction
    var y = Math.max(0, Math.min(maxY, raw));
    var d = y - lastY;
    lastY = y;
    setTop(y <= TOP && hasDock);
    if (y <= TOP) { rearm(); return; }
    if (!d) return;
    if (d > 0 !== dir > 0) travel = 0;
    dir = d;
    travel += Math.abs(d);
    if (away && sounding) { clearTimeout(settle); settle = setTimeout(fit, 160); }
    if (travel < TRAVEL) return;
    if (d < 0) {
      stopTimer();
      armed = false;
      setAway(false);
    } else if (armed) {
      // the two seconds start when the rows arrive, past the hero's own dock
      if (!timer && !root.classList.contains('hero-dock-in-view')) timer = setTimeout(linger, LINGER);
    } else if (!held()) {
      setAway(true);
    }
  }
  function onScroll() { if (!frame) frame = requestAnimationFrame(read); }

  function syncSound() {
    var M = window.PEMusic;
    var guest = M && M.guest && M.guest();
    var on = !!(M && (M.playing() || (guest && guest.playing())));
    if (on === sounding) return;
    sounding = on;
    if (away) slide(float, !on, '10rem');
    fit();
  }

  function place() {
    if (chat) (mq.matches ? chatRow : cluster).appendChild(chat);
    if (mq.matches) return;
    stopTimer();
    armed = true;
    away = false;
    [logo, cluster, chatRow, float].forEach(drop);
    setTop(false);
  }

  function build() {
    logo = document.createElement('a');
    var home = document.querySelector('.navbar18_logo-link');
    logo.className = 'pe-mnav_logo';
    logo.href = (home && home.getAttribute('href')) || 'index.html';
    logo.setAttribute('aria-label', 'Presunta Entropía, inicio');
    logo.innerHTML = LOGO;
    chatRow = document.createElement('div');
    chatRow.className = 'pe-mnav_chat';
    document.body.appendChild(logo);
    document.body.appendChild(chatRow);
  }

  /* A phone's browser bar changes the height on nearly every change of direction,
     and each resize re-measures the whole page: 280-430ms at phone speed, exactly
     when the bar comes back under a finger flicking up. Nothing here lays out by
     the height (the CSS units do that on their own), so on a touch phone a resize
     only reaches the page when the width changed. The open chat still needs it. */
  function guardResize() {
    var width = window.innerWidth;
    var touch = navigator.maxTouchPoints > 0;
    window.addEventListener('resize', function (e) {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        measureLarge();
        return;
      }
      if (touch && mq.matches && !root.classList.contains('vanny-open')) e.stopImmediatePropagation();
    }, true);
  }

  function init() {
    cluster = document.querySelector('.navbar_fixed-button-container');
    if (!cluster) return;
    chat = cluster.querySelector('button.chat-buddy');
    float = document.querySelector('.pe-float');
    screen = float && float.querySelector('.pe-mlcd');
    build();
    place();
    hasDock = !!document.querySelector('[data-hero-dock]');
    lastY = window.scrollY || 0;
    setTop(mq.matches && lastY <= TOP && hasDock);
    measureLarge();
    if (float) rest = parseFloat(getComputedStyle(float).bottom) || 0;
    guardResize();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', place);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (away && sounding) fit(); });
    // the keyboard reaches the rows even after they have left
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') setAway(false); });
    if (window.PEMusic) {
      window.PEMusic.onChange(syncSound);
      // the film can be the sound on the page, and it pauses without telling the music
      ['play', 'pause', 'ended', 'volumechange'].forEach(function (t) {
        document.addEventListener(t, syncSound, true);
      });
      syncSound();
    }
    window.PEMobileNav = { state: function () { return { away: away, sounding: sounding, shift: shift, large: large }; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

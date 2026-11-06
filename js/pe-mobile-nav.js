/* =============================================================
   PHONE NAVIGATION (css/pe-mobile-nav.css)
   Top row: isotype, cart, MENU. Bottom row: music, assistant.
   The rows arrive when the hero's dock scrolls away and stay for two seconds
   of scrolling down. From then on the direction decides: up brings them back,
   down sends them off. Music that is playing stays, until the footer console
   with its own music screen comes in. One class on <html> at each change of
   direction: the transitions run on opacity and transform.
   ============================================================= */
(function () {
  'use strict';
  var LINGER = 2000;                // the first scroll down leaves everything for this long
  var TRAVEL = 8;                   // px in one direction before it counts
  var TOP = 8;                      // px from the top of the page that count as the top
  var LOGO = '<svg viewBox="0 0 197.88 152.68" aria-hidden="true"><path d="M197.88,151.19l-1.26-27.83c-.05-.59-.45-1.09-1.01-1.28l-63.88-21.03,8.58-6.72.08-.06,54-36.43c.84-.57.87-1.8.06-2.4l-17.55-23.99c-.34-.96-1.52-1.3-2.31-.66l-50.96,40.62-.09.06-9.06,6.22-.15-10.9v-.1S117.96,1.56,117.96,1.56c.06-1.01-.9-1.78-1.88-1.5h-34.28c-.97-.28-1.94.48-1.88,1.5l3.63,65.12v.1s-.15,10.9-.15,10.9l-9.06-6.22-.08-.06L23.29,30.77c-.79-.63-1.97-.29-2.31.66L3.43,55.43c-.81.61-.78,1.83.06,2.4l54,36.43.08.06,8.58,6.72L2.27,122.08c-.56.19-.96.69-1.01,1.28L0,151.19c0,1.01.98,1.74,1.95,1.41l73.51-24.89c4.53-1.53,8.27-4.8,10.41-9.08l7.99-16.03c1.01-2.02,2.99-2.98,4.94-2.91h0s.1,0,.15,0c.05,0,.1,0,.15,0h0c1.95-.08,3.94.88,4.94,2.9l7.99,16.03c2.13,4.28,5.87,7.55,10.41,9.08l73.51,24.89c.96.33,1.96-.4,1.95-1.41Z"/></svg>';

  var mq = window.matchMedia('(max-width: 767px)');
  var root = document.documentElement;
  var cluster, chat, chatRow, hasDock;
  var lastY = 0, travel = 0, dir = 0, armed = true, timer = 0, frame = 0;
  var away = false, sounding = false, atTop = false;

  function setAway(v) {
    if (v === away) return;
    away = v;
    root.classList.toggle('pe-mnav-hide', v);
  }
  // nothing leaves while the chat or the phone menu is open
  function held() {
    return root.classList.contains('vanny-open') || root.classList.contains('pe-menu-sheet');
  }
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
    setAway(false);
  }
  function linger() {
    timer = 0;
    armed = false;
    if (dir > 0 && !held()) setAway(true);
  }

  function read() {
    frame = 0;
    if (!mq.matches) return;
    var max = Math.max(0, root.scrollHeight - window.innerHeight);
    // iOS overscroll: the bounce back from either end is not a change of direction
    var y = Math.max(0, Math.min(max, window.scrollY || root.scrollTop || 0));
    var d = y - lastY;
    lastY = y;
    setTop(y <= TOP && hasDock);
    if (y <= TOP) { rearm(); return; }
    if (!d) return;
    if (d > 0 !== dir > 0) travel = 0;
    dir = d;
    travel += Math.abs(d);
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
    root.classList.toggle('pe-mnav-sound', on);
  }

  function place() {
    if (chat) (mq.matches ? chatRow : cluster).appendChild(chat);
    if (mq.matches) return;
    stopTimer();
    armed = true;
    setAway(false);
  }

  function build() {
    var a = document.createElement('a');
    var home = document.querySelector('.navbar18_logo-link');
    a.className = 'pe-mnav_logo';
    a.href = (home && home.getAttribute('href')) || 'index.html';
    a.setAttribute('aria-label', 'Presunta Entropía, inicio');
    a.innerHTML = LOGO;
    chatRow = document.createElement('div');
    chatRow.className = 'pe-mnav_chat';
    document.body.appendChild(a);
    document.body.appendChild(chatRow);
  }

  function init() {
    cluster = document.querySelector('.navbar_fixed-button-container');
    if (!cluster) return;
    chat = cluster.querySelector('button.chat-buddy');
    build();
    place();
    hasDock = !!document.querySelector('[data-hero-dock]');
    lastY = window.scrollY || 0;
    setTop(lastY <= TOP && hasDock);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', place);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

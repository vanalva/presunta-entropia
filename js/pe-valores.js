/* =============================================================
   PE VALORES — la-escuela: the five values as cartridges on a ring
   above a horizontal PE-83. The ring's lowest point is the console's
   slot; the cartridges climb both sides and close behind the photo
   above. One step at a time: the cartridge ejects, the ring clicks
   one slot left, the next one drops in, the console jolts and the
   screen wakes on the new value.

   The panels stay plain markup in the page ([data-metodo-panel]),
   so the text is there without JS and in Webflow. The moves are Web
   Animations on transform: compositor only, because any style change
   in this document restyles it all (the site's :has() rules).
   ============================================================= */
(function () {
  'use strict';
  var root = document.querySelector('[data-pe-val]');
  if (!root) return;
  var belt = root.querySelector('[data-pe-val-belt]');
  var machine = root.querySelector('[data-pe-val-console]');
  var wake = root.querySelector('[data-pe-val-wake]');
  var label = root.querySelector('[data-pe-val-title]');
  var pager = Array.prototype.slice.call(root.querySelectorAll('[data-pe-val-pager] i'));
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-metodo-tab]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-metodo-panel]'));
  var V = tabs.length;
  if (!V || V !== panels.length) return;

  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SLOTS = 20, H = 10;                 // a whole number of rounds, or a cartridge sits next to itself
  var HOLD = 5200;                        // on a value before the next step
  var carts = [], W = 0, cw = 0, ch = 0, R = 0, drop = 0;
  var active = 0, busy = false, pending = 0, timer = 0, heard = false, seen = false, over = false;

  function sfx(n) {
    if (!heard) return;                   // nothing plays before the person has touched the page
    try { if (window.PEConsole && PEConsole.sfx) PEConsole.sfx(n); } catch (e) {}
  }
  document.addEventListener('pointerdown', function () { heard = true; }, { once: true, capture: true });
  document.addEventListener('keydown', function () { heard = true; }, { once: true, capture: true });

  /* ---------- the arc ---------- */
  function pose(s, ins) {
    // s slots round a circle centred above the console, contacts facing out
    var a = s * Math.PI * 2 / SLOTS;
    var x = R * Math.sin(a), y = R * Math.cos(a) - R + (ins || 0);
    return 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + (-a).toFixed(4) + 'rad)';
  }
  function run(c, frames, ms, ease) {
    if (c.anim) c.anim.cancel();
    c.anim = c.el.animate(frames, { duration: reduced ? 0 : ms, easing: ease || 'linear', fill: 'forwards' });
    return c.anim.finished.catch(function () {});
  }
  function sweep(c, from, to, ms, ease) {
    var n = Math.max(6, Math.round(Math.abs(to - from) * 6)), f = [];
    for (var i = 0; i <= n; i++) f.push({ transform: pose(from + (to - from) * (i / n)) });
    return run(c, f, ms, ease);
  }
  function place(c, ins) { run(c, [{ transform: pose(c.pos, ins) }], 0); }
  function measure() {
    W = root.clientWidth;
    var phone = W < 768;
    cw = phone ? Math.min(150, W * 0.36) : Math.max(150, Math.min(216, W * 0.15, window.innerHeight * 0.218));   // the section stays one screen tall
    ch = cw * 1.2;
    R = cw * 3.6;                      // with 20 slots, one cartridge plus a sliver between neighbours
    drop = ch * 0.56 + 18;
    root.style.setProperty('--pe-val-cart-w', cw.toFixed(1) + 'px');
    root.style.setProperty('--pe-val-cart-h', ch.toFixed(1) + 'px');
    carts.forEach(function (c) { place(c, c.pos === 0 ? drop : 0); });
  }

  /* ---------- the screen ---------- */
  /* On phones the screen stays a handheld's size: one value is three pages inside it
     (Valor, Texto, Icono), by the tabs or the d-pad's up and down. */
  var pageTabs = Array.prototype.slice.call(root.querySelectorAll('[data-pe-val-page]'));
  var pageBox = root.querySelector('.metodo_valores'), page = 0, stayT = 0;
  var phoneMq = window.matchMedia ? matchMedia('(max-width: 767px)') : null;
  function isPhone() { return !!(phoneMq && phoneMq.matches); }
  function setPage(n, user) {
    page = (n + pageTabs.length) % pageTabs.length;
    if (pageBox) { pageBox.setAttribute('data-page', page); pageBox.scrollTop = 0; }
    pageTabs.forEach(function (b, k) {
      b.classList.toggle('is-on', k === page);
      b.setAttribute('aria-selected', k === page ? 'true' : 'false');
    });
    if (user) {                            // someone's reading: the rotation waits
      over = true;
      clearTimeout(timer); timer = 0;
      clearTimeout(stayT);
      stayT = setTimeout(function () { over = false; plan(); }, 20000);
    }
  }
  function show(v) {
    active = v;
    setPage(0);
    tabs.forEach(function (t, k) {
      var on = k === v;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      panels[k].classList.toggle('is-active', on);
    });
    if (label) label.textContent = panels[v].querySelector('h2').textContent;
    pager.forEach(function (d, k) { d.classList.toggle('is-on', k === v); });
  }
  // the console's wake: the mark flickers, a line fills, and the value is there
  function bootScreen(v) {
    if (reduced || !wake) { show(v); return Promise.resolve(); }
    var a = wake.animate(
      [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.62 }, { opacity: 0, offset: 1 }],
      { duration: 520, easing: 'steps(6, end)', fill: 'none' });
    var bar = wake.firstElementChild;
    if (bar) bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300, easing: 'steps(8, end)' });
    setTimeout(function () { show(v); }, 150);
    return a.finished.catch(function () {});
  }
  function jolt() {
    if (reduced || !machine) return;
    machine.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' });
  }

  /* ---------- a step ---------- */
  function wrap(p) {
    while (p < -H) p += SLOTS;
    while (p > H) p -= SLOTS;
    return p;
  }
  function centre() { return carts.filter(function (c) { return c.pos === 0; })[0]; }
  function step(k) {
    busy = true;
    var out = centre();
    // 1. it comes out of the slot
    run(out, [{ transform: pose(0, drop) }, { transform: pose(0, -10) }, { transform: pose(0, 0) }], 300, 'cubic-bezier(0.2, 0.9, 0.3, 1)');
    sfx('pop');
    return new Promise(function (done) { setTimeout(done, reduced ? 0 : 280); }).then(function () {
      // 2. the belt clicks k slots along the arc
      var ms = Math.min(1100, 340 + 240 * Math.abs(k));
      for (var i = 0; i < Math.abs(k); i++) setTimeout(function () { sfx('nav'); }, i * ms / Math.abs(k));
      return Promise.all(carts.map(function (c) {
        return sweep(c, c.pos, c.pos - k, ms, 'cubic-bezier(0.32, 1.28, 0.5, 1)');
      }));
    }).then(function () {
      carts.forEach(function (c) {
        var was = c.pos - k, now = wrap(was);
        c.pos = now;
        if (now !== was) place(c, 0);     // round the back, out of sight
      });
      // 3. the next one drops in
      var inn = centre();
      return run(inn, [{ transform: pose(0, 0) }, { transform: pose(0, -14) }, { transform: pose(0, drop) }], 340, 'cubic-bezier(0.5, 0, 0.9, 0.6)').then(function () {
        sfx('stamp'); jolt();
        return bootScreen(inn.v);
      });
    }).then(function () {
      sfx('ok');
      busy = false;
      if (pending) { var p = pending; pending = 0; step(p); } else plan();
    });
  }
  function request(k) {
    if (!k) return;
    if (busy) pending = k; else step(k);
  }
  function go(v) {                         // the shortest way round to a value
    var best = null;
    carts.forEach(function (c) {
      if (c.v === v && (best === null || Math.abs(c.pos) < Math.abs(best.pos))) best = c;
    });
    if (best) request(best.pos);
  }

  /* ---------- the status clock and the top slot's little LCD ---------- */
  function clock() {
    var el = root.querySelector('[data-pe-val-clock]');
    if (!el || document.hidden) return;
    try {
      el.textContent = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (e) {}
  }
  function ticker() {
    var cv = root.querySelector('[data-pe-val-ticker]');
    if (!cv) return;
    var c = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, t = 0, COLS = 28;
    function draw() {
      c.clearRect(0, 0, W2, H2);
      for (var i = 0; i < COLS; i++) {
        var h = Math.round(1 + 2.5 * (1 + Math.sin(t * 0.6 + i * 0.7) * Math.sin(t * 0.23 + i * 0.31)));
        for (var j = 0; j < 5; j++) {
          c.fillStyle = j < h ? '#efa02e' : '#1f303d';
          c.fillRect(i * 6, H2 - (j + 1) * 4, 4, 3);
        }
      }
    }
    draw();
    if (reduced) return;
    setInterval(function () { if (seen && !document.hidden) { t += 1; draw(); } }, 160);
  }

  /* ---------- rotation: one step, a pause, the next ---------- */
  function plan() {
    clearTimeout(timer);
    timer = 0;
    if (reduced || !seen || over || document.hidden) return;
    timer = setTimeout(function () { if (!busy && !over && seen && !document.hidden) step(1); else plan(); }, HOLD);
  }

  /* ---------- build ---------- */
  function setup() {
    for (var i = 0; i < SLOTS; i++) {
      var v = i % V, el;
      if (i < V) el = tabs[i];
      else {
        el = tabs[v].cloneNode(true);
        el.removeAttribute('id');
        el.removeAttribute('role');
        el.removeAttribute('aria-controls');
        el.removeAttribute('aria-selected');
        el.removeAttribute('data-metodo-tab');
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
        belt.appendChild(el);
      }
      carts.push({ el: el, v: v, pos: wrap(i), anim: null });
    }
    carts.forEach(function (c) {
      c.el.addEventListener('click', function () { heard = true; request(c.pos); });
    });
    measure();
    show(0);
    root.classList.add('is-ready');

    // the console's parts, driven as the console drives them: .is-down while
    // held, data-dir on the d-pad, so its own press and rock apply
    var pad = root.querySelector('[data-pe-val-dpad]');
    function hold(b) {
      b.addEventListener('pointerdown', function () {
        heard = true;
        var d = b.getAttribute('data-dir');
        if (d) pad.setAttribute('data-dir', d); else b.classList.add('is-down');
      });
      function up() {
        var d = b.getAttribute('data-dir');
        if (d) { if (pad.getAttribute('data-dir') === d) pad.removeAttribute('data-dir'); }
        else b.classList.remove('is-down');
      }
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    }
    root.querySelectorAll('[data-pe-val-go]').forEach(function (b) {
      hold(b);
      b.addEventListener('click', function () {
        heard = true;
        sfx('click');
        var d = b.getAttribute('data-dir');
        if (isPhone() && (d === 'up' || d === 'down')) { setPage(page + (d === 'down' ? 1 : -1), true); return; }
        request(parseInt(b.getAttribute('data-pe-val-go'), 10));
      });
    });
    pageTabs.forEach(function (b, k) {
      b.addEventListener('click', function () { heard = true; sfx('nav'); setPage(k, true); });
    });
    var menu = root.querySelector('[data-pe-val-menu]');
    if (menu) {
      hold(menu);
      menu.addEventListener('click', function () {
        sfx('open');
        var real = document.querySelector('.navbar_fixed-button-container .navbar_menu-button');
        if (real) real.click();
      });
    }
    var sound = root.querySelector('[data-pe-val-sound]');
    if (sound) {
      hold(sound);
      var lit = function () { var v = null; try { v = localStorage.getItem('pe-sound'); } catch (e) {} sound.classList.toggle('is-lit', v !== '0'); };
      lit();
      sound.addEventListener('click', function () {
        if (window.PEConsole && PEConsole.press) { PEConsole.press('sound'); PEConsole.release('sound'); }
        setTimeout(lit, 60);
      });
    }
    clock();
    setInterval(clock, 30000);
    ticker();
    belt.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
      if (!k) return;
      e.preventDefault();
      heard = true;
      request(k);
      tabs[(active + k + V) % V].focus({ preventScroll: true });
    });
    root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { over = true; clearTimeout(timer); timer = 0; } });
    root.addEventListener('pointerleave', function () { over = false; plan(); });
    document.addEventListener('visibilitychange', plan);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { seen = en[en.length - 1].isIntersecting; plan(); }, { threshold: 0.3 }).observe(root);
    }
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
    window.PEValores = { go: go, step: request, active: function () { return active; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();

/* The brand film at the top of la-escuela, with the console's VIDEO controls: the same
   classes, the same keys, and the bar tucks away the same way. It starts as a silent
   loop while on screen, which the console's video doesn't, so the bar stays up until
   the sound is on: that's how you find the Sonido key. With sound on it keeps playing
   wherever you scroll, and the site's music screens pause or silence it. */
(function () {
  'use strict';
  var el = document.querySelector('[data-metodo-player]');
  if (!el) return;
  var v = el.querySelector('video');
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SRC = 'https://res.cloudinary.com/dn53emznt/video/upload/q_auto,w_%W%/v1763080295/presunta-entropia_bgg2ln.mp4';
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><rect x="16" y="9" width="2" height="6" fill="currentColor"/><rect x="19" y="7" width="2" height="10" fill="currentColor"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
    exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>'
  };
  var q = function (s) { return el.querySelector(s); };
  var track = q('[data-seek]'), segs = track.querySelectorAll('i'), tEl = q('[data-t]');
  var playTxt = q('[data-play-txt]'), big = q('[data-big]'), bar = q('.pe-os_vbar');
  var muteBtn = q('[data-mute]'), muteTxt = q('[data-mute-txt]'), muteIco = q('[data-mute-ico]');
  var fullBtn = q('[data-full]'), fullTxt = q('[data-full-txt]'), fullIco = q('[data-full-ico]');
  var SEG = segs.length, lit = -1, hideT = 0, seen = false, held = false, loaded = false, scrub = false;

  function sfx(n) { try { if (window.PEConsole && PEConsole.sfx) PEConsole.sfx(n); } catch (e) {} }
  // with sound on, the film is what the site's music screens control, from anywhere on the page
  var GUEST = {
    title: 'Vídeo',
    style: 'Presunta Entropía',
    playing: function () { return !v.paused; },
    toggle: function () { toggle(); },
    mute: function () { setMuted(true); },
    label: function () { return v.paused ? 'Seguir vídeo' : 'Pausar vídeo'; }
  };
  function duck() {
    if (!window.PEMusic) return;
    if (PEMusic.duck) PEMusic.duck(!v.muted && !v.paused);
    if (PEMusic.guest) PEMusic.guest(v.muted ? null : GUEST);
  }
  function load() {
    if (loaded) return;
    loaded = true;
    v.src = SRC.replace('%W%', window.innerWidth < 768 ? '960' : '1920');
  }
  function start() {
    load();
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  function fmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function sync() {
    var p = v.duration ? v.currentTime / v.duration : 0, n = Math.round(p * SEG);
    if (n !== lit) {
      lit = n;
      for (var i = 0; i < SEG; i++) segs[i].className = i < n ? 'is-on' : '';
      track.setAttribute('aria-valuenow', Math.round(p * 100));
    }
    tEl.textContent = fmt(v.currentTime) + '/' + fmt(v.duration);
  }
  function wake() {
    el.setAttribute('data-ui', 'on');
    clearTimeout(hideT);
    if (v.paused || v.muted) return;
    hideT = setTimeout(function hide() {
      if (bar.matches(':hover') || bar.querySelector(':focus-visible')) { hideT = setTimeout(hide, 1200); return; }
      el.setAttribute('data-ui', 'off');
    }, 2600);
  }
  function setMuted(m) {
    v.muted = m;
    if (!m) v.volume = 1;
    muteTxt.textContent = m ? 'Silencio' : 'Sonido';
    muteIco.innerHTML = m ? ICON.mute : ICON.vol;
    muteBtn.classList.toggle('is-lit', m);
    muteBtn.setAttribute('aria-label', m ? 'Activar el sonido' : 'Silenciar');
    duck();
    wake();
    if (m) ambient();                      // silenced from far away: back to the rule for the loop
  }
  function toggle() {
    if (v.paused) { held = false; start(); } else { held = true; v.pause(); }
  }
  function isFull() { return (document.fullscreenElement || document.webkitFullscreenElement) === el; }
  function toggleFull() {
    if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { var pr = rq.call(el); if (pr && pr.catch) pr.catch(function () {}); }
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();   // iPhone Safari: native player
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      var f = isFull();
      fullTxt.textContent = f ? 'Salir' : 'Pantalla';
      fullIco.innerHTML = f ? ICON.exit : ICON.full;
      fullBtn.classList.toggle('is-lit', f);
    });
  });

  v.addEventListener('play', function () { el.classList.add('is-playing'); playTxt.textContent = 'Pausa'; duck(); wake(); });
  v.addEventListener('pause', function () {
    el.classList.remove('is-playing');
    playTxt.textContent = 'Play';
    big.innerHTML = ICON.play + (v.currentTime > 0.5 ? ' Seguir' : ' Reproducir');
    duck();
    wake();
  });
  v.addEventListener('timeupdate', sync);
  v.addEventListener('loadedmetadata', sync);
  v.addEventListener('click', function () { sfx('click'); toggle(); });
  el.addEventListener('pointermove', wake);

  el.querySelectorAll('[data-play]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); sfx('click'); toggle(); });
  });
  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    sfx('click');
    var was = v.muted;
    setMuted(!was);
    if (was && v.paused) { held = false; start(); }
  });
  fullBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFull(); });

  function seekTo(e) {
    var r = track.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (v.duration) { v.currentTime = p * v.duration; sync(); }
  }
  track.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    scrub = true;
    try { track.setPointerCapture(e.pointerId); } catch (x) {}
    seekTo(e);
    wake();
  });
  track.addEventListener('pointermove', function (e) { if (scrub) seekTo(e); });
  track.addEventListener('pointerup', function () { scrub = false; });
  track.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowRight' ? 5 : (e.key === 'ArrowLeft' ? -5 : 0);
    if (!d || !v.duration) return;
    e.preventDefault();
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d));
    sync();
  });

  function ambient() {
    if (held || isFull()) return;
    if (!v.muted) return;                  // with sound it's the person's film: scrolling leaves it alone
    if (seen && !document.hidden && !reduced) start();
    else v.pause();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      seen = en[en.length - 1].isIntersecting;
      ambient();
    }, { threshold: 0.2 }).observe(el);
  }
  document.addEventListener('visibilitychange', ambient);
  if (reduced) { playTxt.textContent = 'Play'; big.innerHTML = ICON.play + ' Reproducir'; }
  else el.classList.add('is-playing');
  el.setAttribute('data-ui', 'on');
})();

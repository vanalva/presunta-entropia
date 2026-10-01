/* =============================================================
   PE MUSIC — the site's background music (page-level, any page can load
   it). Eleven tracks: "Nostalgia" from the brand video, then ten made to
   match it (80s synth, deep house / lo-fi, A minor family, 85–122 BPM).
   Files: assets/audio/pe-<slug>.mp3 (loudness-matched, -16 LUFS).

   - On by default. Browsers only allow sound after a gesture, so it starts
     on the visitor's first tap/click/key (unless that tap was on a music
     control). Choosing "Parar música" is remembered (localStorage
     'pe-music' '0'); the track and position carry across pages
     (sessionStorage 'pe-music-pos').
   - window.PEMusic: play, pause, toggle, next, prev, playing(), enabled(),
     track(), tracks, bytes(arr) (live spectrum 0-255), duck(on),
     volume(v), onChange(fn).
   - Music screens: every [data-pe-music-lcd] gets a pixel waveform; on hover
     (or a tap on touch) it turns yellow, the waveform leaves upward and
     "Parar música" / "Poner música" rises from below between two arrows.
     The PE-83 console builds the same screen inside its top slot.
   ============================================================= */
(function () {
  'use strict';
  var BASE = 'assets/audio/';
  var TRACKS = [
    { slug: 'nostalgia', title: 'Nostalgia', style: 'Synthwave' },
    { slug: 'neon-shadows', title: 'Neon Shadows', style: 'Downtempo synthwave' },
    { slug: 'midnight-mirage', title: 'Midnight Mirage', style: 'Minimal deep house' },
    { slug: 'nostalgiawave', title: 'Nostalgiawave', style: 'Lo-fi synthwave' },
    { slug: 'midnight-lounge', title: 'Midnight Lounge', style: 'Deep house' },
    { slug: 'soft-shadows', title: 'Soft Shadows', style: 'Lo-fi house' },
    { slug: 'night-dreams', title: 'Night Dreams', style: 'Deep house' },
    { slug: 'faded-dreams', title: 'Faded Dreams', style: 'Lo-fi chillwave' },
    { slug: 'retro-shadows', title: 'Retro Shadows', style: 'Melodic deep house' },
    { slug: '80s-vibe', title: '80s Vibe', style: 'Lo-fi funk' },
    { slug: 'starlit', title: 'Starlit', style: 'Dreamy house' }
  ];
  var Y = '#efa02e', AZ = '#0d161d', AZ3 = '#1f303d', CREAM = '#e8d5c4';
  var LEFT = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 8l9-6v12z"/></svg>';
  var NOTE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 2h8v3H9v7.5A2.5 2.5 0 1 1 6.5 10H6z"/></svg>';
  var RIGHT = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13 8L4 14V2z"/></svg>';

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch (e) { return null; } }
  function sess(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, String(v)); } catch (e) { return null; } }

  var enabled = store('pe-music') !== '0';
  var vol = parseFloat(store('pe-music-vol'));
  if (!(vol >= 0 && vol <= 1)) vol = 0.55;
  var idx = 0, resumeAt = 0;
  try {
    var pos = JSON.parse(sess('pe-music-pos') || 'null');
    if (pos && TRACKS[pos.i]) { idx = pos.i; resumeAt = pos.t || 0; }
  } catch (e) {}

  var el = new Audio();
  el.preload = 'none';
  el.crossOrigin = 'anonymous';
  el.setAttribute('playsinline', '');
  var AC = null, gain = null, analyser = null, duckOn = false, started = false, listeners = [];

  function graph(ctx) {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C && !ctx) return;
    try {
      AC = ctx || new C();
      var src = AC.createMediaElementSource(el);
      cancelAnimationFrame(rampRaf);
      el.volume = 1;                         // the gain node owns the level from here
      gain = AC.createGain();
      gain.gain.value = el.paused ? 0 : target();
      analyser = AC.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(gain); gain.connect(analyser); analyser.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  var master = 1;                           // the console's volume wheel (0-1)
  function target() { return duckOn ? 0 : vol * master; }
  function fade(to, secs) {
    if (gain && AC) {
      gain.gain.cancelScheduledValues(AC.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, AC.currentTime);
      gain.gain.linearRampToValueAtTime(to, AC.currentTime + (secs || 0.6));
    } else ramp(to, secs || 0.6);
  }
  // no audio graph yet (autoplay at load): fade the element's own volume
  var rampRaf = 0;
  function ramp(to, secs) {
    cancelAnimationFrame(rampRaf);
    var from = el.volume, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / (secs * 1000));
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) rampRaf = requestAnimationFrame(step);
    })(t0);
  }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); sync(); }

  function load(i, at) {
    idx = (i + TRACKS.length) % TRACKS.length;
    el.src = BASE + 'pe-' + TRACKS[idx].slug + '.mp3';
    if (at) {
      var seek = function () { try { el.currentTime = at; } catch (e) {} el.removeEventListener('loadedmetadata', seek); };
      el.addEventListener('loadedmetadata', seek);
    }
  }
  /* Browsers allow sound only after a real gesture (click, key, tap). play()
     is tried at load anyway (allowed where the visitor has played media on
     the site before) and again on every gesture until it truly runs:
     'started' flips only when the browser says yes. */
  function play() {
    graph();
    if (!el.src) load(idx, resumeAt);
    enabled = true; store('pe-music', '1');
    var p = el.play();
    if (p && p.then) p.then(function () { started = true; emit(); }, function () { started = false; emit(); });
    else started = true;
    if (!duckOn) fade(target(), 1.2);
    emit();
  }
  function pause() {
    enabled = false; store('pe-music', '0');
    fade(0, 0.35);
    setTimeout(function () { if (!enabled) el.pause(); }, 380);
    emit();
  }
  function go(d) {
    var was = !el.paused || enabled;
    graph();
    if (gain) fade(0, 0.25);
    setTimeout(function () {
      load(idx + d, 0);
      if (was) { enabled = true; store('pe-music', '1'); var p = el.play(); if (p && p.catch) p.catch(function () {}); fade(target(), 0.8); }
      flashTitle();
      emit();
    }, gain ? 260 : 0);
  }
  el.addEventListener('ended', function () { go(1); });
  el.addEventListener('play', emit);
  el.addEventListener('pause', emit);
  window.addEventListener('pagehide', function () { sess('pe-music-pos', JSON.stringify({ i: idx, t: el.currentTime || resumeAt })); });

  // first gesture starts the music (sound needs one); not when the gesture
  // is on a music control, which handles itself
  function firstGesture(e) {
    // autoplay worked at load: the first gesture only adds the audio graph
    // (the waveform needs it); otherwise it is the start
    if (started) { if (!AC && e && e.isTrusted !== false) graph(); return; }
    if (duckOn) return;
    if (e && e.target && e.target.closest && e.target.closest('[data-pe-music-lcd], .pe-mlcd')) return;
    if (e && e.composedPath && e.composedPath().some(function (n) { return n.classList && n.classList.contains && n.classList.contains('pe-mlcd'); })) return;
    if (!enabled) return;
    play();
  }
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(function (t) { document.addEventListener(t, firstGesture, true); });

  var api = {
    tracks: TRACKS,
    play: play, pause: pause,
    toggle: function () { (playing() ? pause : play)(); },
    next: function () { go(1); }, prev: function () { go(-1); },
    playing: playing,
    enabled: function () { return enabled; },
    track: function () { return TRACKS[idx]; },
    index: function () { return idx; },
    volume: function (v) { if (v === undefined) return vol; vol = Math.max(0, Math.min(1, v)); store('pe-music-vol', vol); if (playing()) fade(target(), 0.2); emit(); },
    master: function (m) {
      if (m === undefined) return master;
      master = Math.max(0, Math.min(1, m));
      if (playing()) fade(target(), 0.15);
      emit();
    },
    duck: function (on) {
      on = !!on;
      if (on === duckOn) return;
      duckOn = on;
      if (!enabled) return;
      if (on) {
        fade(0, 0.9);
        setTimeout(function () { if (duckOn) el.pause(); }, 950);
      } else if (started) {
        var pr = el.play(); if (pr && pr.catch) pr.catch(function () {});
        fade(target(), 1.6);
      }
      emit();
    },
    waiting: function () { return enabled && !started; },
    bytes: function (arr) { if (analyser && playing()) { analyser.getByteFrequencyData(arr); return true; } return false; },
    onChange: function (fn) { listeners.push(fn); },
    // QA: what the element and the graph are really doing
    state: function () { return { paused: el.paused, t: Math.round(el.currentTime * 10) / 10, vol: el.volume, ac: AC ? AC.state : null, gain: gain ? Math.round(gain.gain.value * 100) / 100 : null, started: started, enabled: enabled, duck: duckOn }; }
  };
  function playing() { return enabled && started && (!el.paused || duckOn); }
  window.PEMusic = api;

  /* ---------- music screens ---------- */
  var screens = [], freq = new Uint8Array(256), titleUntil = 0, t0 = performance.now();
  function flashTitle() { titleUntil = performance.now() + 1800; }
  function mount(host) {
    if (host.__peMlcd) return;
    host.__peMlcd = true;
    host.classList.add('pe-mlcd');
    host.innerHTML =
      '<div class="pe-mlcd_view"><canvas class="pe-mlcd_wave"></canvas><span class="pe-mlcd_title"></span></div>' +
      '<div class="pe-mlcd_ctrl">' +
        '<button type="button" class="pe-mlcd_arrow" data-d="-1" aria-label="Canción anterior">' + LEFT + '</button>' +
        '<button type="button" class="pe-mlcd_main"></button>' +
        '<button type="button" class="pe-mlcd_arrow" data-d="1" aria-label="Canción siguiente">' + RIGHT + '</button>' +
      '</div>';
    attach(host);
  }
  // wiring shared with the console's own screen (pe-console.js calls
  // PEMusic.attach(el) on a node shaped like the markup above)
  function attach(host) {
    var cv = host.querySelector('.pe-mlcd_wave'), main = host.querySelector('.pe-mlcd_main');
    var titleEl = host.querySelector('.pe-mlcd_title');
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b && api.waiting()) { e.stopPropagation(); play(); return; }
      if (!b) {
        // touch: the first tap opens the controls, the next ones use them
        if (!host.classList.contains('is-open')) { host.classList.add('is-open'); clearTimeout(host.__peT); host.__peT = setTimeout(function () { host.classList.remove('is-open'); }, 4000); }
        return;
      }
      e.stopPropagation();
      started = true;
      if (b === main) api.toggle();
      else go(+b.getAttribute('data-d'));
      clearTimeout(host.__peT);
      host.__peT = setTimeout(function () { host.classList.remove('is-open'); }, 4000);
    });
    host.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !api.waiting()) host.classList.add('is-open'); });
    host.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') host.classList.remove('is-open'); });
    screens.push({ host: host, cv: cv, ctx: cv.getContext('2d'), main: main, titleEl: titleEl, w: 0, h: 0 });
    sync();
    kick();
  }
  api.attach = attach;
  api.mount = mount;
  api.mountAll = function () { Array.prototype.forEach.call(document.querySelectorAll('[data-pe-music-lcd]'), mount); };

  function sync() {
    var on = playing();
    screens.forEach(function (s) {
      s.main.textContent = on ? 'Parar música' : 'Poner música';
      s.host.classList.toggle('is-playing', on);
      var wait = api.waiting();
      s.host.classList.toggle('is-waiting', wait);
      s.titleEl.innerHTML = wait ? NOTE + '<span>Activar música</span>' : '';
      if (!wait) s.titleEl.textContent = TRACKS[idx].title;
    });
  }

  // pixel waveform: chunky mirrored columns, yellow on aztec
  var raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    var any = false, live = api.bytes(freq), synth = !live && playing(), t = (now - t0) / 1000, showTitle = now < titleUntil;
    screens.forEach(function (s) {
      var r = s.cv.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
      any = true;
      var dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width), H = Math.round(r.height);
      if (s.w !== W || s.h !== H) { s.w = W; s.h = H; s.cv.width = W * dpr; s.cv.height = H * dpr; }
      var c = s.ctx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = AZ; c.fillRect(0, 0, W, H);
      s.host.classList.toggle('is-title', showTitle);
      var px = Math.max(2, Math.round(H / 10)), col = px + 1, n = Math.floor((W - 4) / col), mid = H / 2;
      for (var i = 0; i < n; i++) {
        var v;
        if (live) {
          // mirrored log scale: bass in the middle, ~10 kHz at the edges;
          // the highs get a lift (the tracks are dark, the edges sat flat)
          var d = Math.min(1, Math.abs(i - (n - 1) / 2) / (n / 2));
          var k = Math.min(255, Math.round(Math.exp(Math.log(1) + d * Math.log(120))));
          v = Math.min(1, Math.pow(freq[k] / 255, 1.15) * (0.85 + d * 1.6));
        } else if (synth) {
          // no live spectrum (no audio graph yet): a beat-ish stand-in so a
          // playing song never shows a flat line
          var dd = Math.abs(i - (n - 1) / 2) / (n / 2);
          var beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.72)), 6);
          v = (0.25 + 0.55 * beat) * (1 - dd * 0.6) + 0.18 * Math.abs(Math.sin(t * 5.3 + i * 0.9) * Math.sin(t * 2.1 + i * 0.37));
        } else v = 0.04 + 0.03 * (Math.sin(t * 1.5 + i * 0.5) * 0.5 + 0.5);
        var cells = Math.max(1, Math.round(v * (H - 4) / 2 / px));
        c.fillStyle = (live || synth) ? Y : AZ3;
        for (var j = 0; j < cells; j++) {
          c.fillRect(2 + i * col, Math.round(mid - (j + 1) * px), px, px - 1);
          c.fillRect(2 + i * col, Math.round(mid + j * px + 1), px, px - 1);
        }
      }
    });
    if (any || playing()) raf = requestAnimationFrame(frame);
  }
  window.addEventListener('scroll', kick, { passive: true });
  api.onChange(kick);

  function tryAutoplay() {
    if (!enabled || started) return;
    load(idx, resumeAt);
    el.volume = target();
    var p = el.play();
    if (p && p.then) p.then(function () { started = true; tryGraphNow(); emit(); }, function () { emit(); });
  }
  function tryGraphNow() {
    if (AC) return;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    var ctx;
    try { ctx = new C(); } catch (e) { return; }
    if (ctx.state === 'running') { graph(ctx); return; }
    // not allowed yet: try once more when it resumes, else leave the element alone
    var done = false;
    ctx.resume().then(function () {
      if (done) return; done = true;
      if (ctx.state === 'running' && !AC) graph(ctx); else ctx.close();
    }, function () { ctx.close(); });
    setTimeout(function () { if (!done) { done = true; try { ctx.close(); } catch (e) {} } }, 400);
  }
  // unmuted page videos (outside the console) fade the music the same way
  document.addEventListener('play', function (e) {
    var v = e.target;
    if (v && v.tagName === 'VIDEO' && !v.muted && v.volume > 0) {
      api.duck(true);
      var back = function () { api.duck(false); v.removeEventListener('pause', back); v.removeEventListener('ended', back); };
      v.addEventListener('pause', back); v.addEventListener('ended', back);
    }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { api.mountAll(); tryAutoplay(); });
  else { api.mountAll(); tryAutoplay(); }
})();

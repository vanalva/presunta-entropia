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
      if (chaos) fxOn();                     // CAOS was switched on before the graph existed
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

  var guest = null;
  var api = {
    tracks: TRACKS,
    play: play, pause: pause,
    toggle: function () { if (guest) { guest.toggle(); return; } (playing() ? pause : play)(); },
    next: function () { if (guest) { guest.mute(); return; } go(1); },
    prev: function () { if (guest) { guest.mute(); return; } go(-1); },
    /* Another sound on the page (the brand film) can take over every music screen:
       the main key then pauses it and the arrows silence it. Pass null to give the
       screens back. { title, style, playing(), toggle(), mute(), label() } */
    guest: function (g) {
      if (g === undefined) return guest;
      guest = g;
      emit();
      kick();
    },
    playing: playing,
    enabled: function () { return enabled; },
    track: function () { return guest ? { title: guest.title, style: guest.style } : TRACKS[idx]; },
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
    state: function () { return { paused: el.paused, t: Math.round(el.currentTime * 10) / 10, vol: el.volume, ac: AC ? AC.state : null, gain: gain ? Math.round(gain.gain.value * 100) / 100 : null, started: started, enabled: enabled, duck: duckOn, chaos: chaosState() }; }
  };
  function playing() { return enabled && started && (!el.paused || duckOn); }
  window.PEMusic = api;

  /* ---------- CAOS: the tape that is losing it ----------
     While the ORDEN/CAOS switch is on (pe:entropy event) tempo and pitch
     wander together: playbackRate with preservesPitch off, 0.80-1.25, a slow
     random walk with an occasional short lurch (none under reduced motion).
     A light distortion joins the graph: gain -> WaveShaper -> low-pass (its
     cutoff wanders too) -> wet gain, mixed against a lowered dry gain so the
     loudness stays put. Back to ORDEN the rate glides to 1 in ~1 s and the
     graph is rewired exactly as before (gain -> analyser). Without a graph
     (autoplay at load) only the playbackRate runs. Nothing here touches the DOM. */
  var chaos = false, cLog = 0, cTarget = 0, cNext = 0, cLurch = 0, cLurchAt = 0, cLast = 0, cLpAt = 0;
  var cTimer = 0, cGlide = null, cFx = null, cFxTimer = 0, cRate = 1;
  var LOG_LO = Math.log(0.8), LOG_HI = Math.log(1.25), CK = 5;     // CK: how hard the shaper bends
  function still() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function keepPitch(v) { el.preservesPitch = v; el.webkitPreservesPitch = v; el.mozPreservesPitch = v; }
  function setRate(r) { cRate = r; try { el.playbackRate = r; } catch (e) {} }
  function chaosState() {
    return { on: chaos, rate: Math.round(cRate * 1000) / 1000, el: el.playbackRate, keepPitch: el.preservesPitch, fx: !!cFx, glide: !!cGlide,
      lp: cFx ? Math.round(cFx.lp.frequency.value) : null, wet: cFx ? Math.round(cFx.wet.gain.value * 100) / 100 : null, dry: cFx ? Math.round(cFx.dry.gain.value * 100) / 100 : null };
  }
  function shaperCurve() {
    var n = 2048, c = new Float32Array(n), bias = 0.06, off = Math.tanh(CK * bias) / CK;
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(CK * (x + bias)) / CK - off; }
    return c;
  }
  function fxOn() {
    clearTimeout(cFxTimer); cFxTimer = 0;
    if (!AC || !gain || !analyser) return;
    var now = AC.currentTime;
    if (!cFx) {
      var sh = AC.createWaveShaper(), lp = AC.createBiquadFilter(), wet = AC.createGain(), dry = AC.createGain();
      sh.curve = shaperCurve();
      lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.7;
      wet.gain.value = 0; dry.gain.value = 1;
      try {
        gain.disconnect(analyser);
        gain.connect(dry); dry.connect(analyser);
        gain.connect(sh); sh.connect(lp); lp.connect(wet); wet.connect(analyser);
      } catch (e) { try { gain.disconnect(); gain.connect(analyser); } catch (e2) {} return; }
      cFx = { sh: sh, lp: lp, wet: wet, dry: dry };
    }
    cFx.dry.gain.cancelScheduledValues(now); cFx.wet.gain.cancelScheduledValues(now);
    cFx.dry.gain.setTargetAtTime(0.74, now, 0.25); cFx.wet.gain.setTargetAtTime(0.4, now, 0.25);
  }
  function fxOff() {
    if (!cFx || !AC) return;
    var now = AC.currentTime;
    cFx.dry.gain.cancelScheduledValues(now); cFx.wet.gain.cancelScheduledValues(now);
    cFx.dry.gain.setTargetAtTime(1, now, 0.22); cFx.wet.gain.setTargetAtTime(0, now, 0.22);
    clearTimeout(cFxTimer);
    cFxTimer = setTimeout(fxGone, 1100);
  }
  function fxGone() {
    cFxTimer = 0;
    if (!cFx || chaos) return;
    try {
      gain.disconnect();
      gain.connect(analyser);               // the graph exactly as graph() built it
    } catch (e) {}
    try { cFx.sh.disconnect(); cFx.lp.disconnect(); cFx.wet.disconnect(); cFx.dry.disconnect(); } catch (e) {}
    cFx = null;
  }
  function cReset() {
    clearInterval(cTimer); cTimer = 0; cGlide = null;
    cLog = 0; cLurch = 0; cTarget = 0; cNext = 0; cLurchAt = 0; cLast = 0;
    setRate(1); keepPitch(true);
  }
  function cTick() {
    var now = performance.now(), dt = cLast ? Math.min(0.5, (now - cLast) / 1000) : 0.06;
    cLast = now;
    if (cGlide) {
      // back to ORDEN: tempo and pitch return to 1 together, in about a second
      var k = Math.min(1, (now - cGlide.t0) / 1000);
      setRate(Math.exp(cGlide.from * (1 - k)));
      if (k >= 1) cReset();
      return;
    }
    if (!chaos || !playing() || document.hidden) return;
    if (el.preservesPitch !== false) keepPitch(false);
    if (now >= cNext) {
      // a new place to drift to; every so often it is almost normal
      var amp = Math.random() < 0.3 ? 0.04 : 0.2;
      cTarget = (Math.random() * 2 - 1) * amp;
      cNext = now + 2500 + Math.random() * 4500;
    }
    if (now >= cLurchAt) {
      if (cLurchAt && !still()) cLurch = (Math.random() < 0.5 ? -1 : 1) * (0.07 + Math.random() * 0.1);
      cLurchAt = now + 12000 + Math.random() * 16000;
    }
    cLog += (cTarget - cLog) * (1 - Math.exp(-dt / 2.2));
    cLurch *= Math.exp(-dt / 0.45);
    if (Math.abs(cLurch) < 0.002) cLurch = 0;
    var l = Math.max(LOG_LO, Math.min(LOG_HI, cLog + cLurch));
    setRate(Math.exp(l));
    if (cFx && AC && now >= cLpAt) {
      // the low-pass wanders between ~2.6 kHz and ~9 kHz
      cLpAt = now + 450 + Math.random() * 500;
      cFx.lp.frequency.setTargetAtTime(2600 * Math.exp(Math.random() * Math.log(3.5)), AC.currentTime, 0.35);
    }
  }
  function chaosSet(on) {
    on = !!on;
    if (on === chaos) return;
    chaos = on;
    if (on) {
      cGlide = null; cLast = 0;
      keepPitch(false);
      if (!cTimer) cTimer = setInterval(cTick, 60);
      fxOn();
    } else {
      fxOff();
      if (playing() && !document.hidden && cRate !== 1) { cGlide = { t0: performance.now(), from: Math.log(cRate) }; }
      else cReset();
    }
  }
  document.addEventListener('pe:entropy', function (e) { chaosSet(e.detail && e.detail.on); });
  // a new song resets the element's rate: put the drift back on it at once
  el.addEventListener('loadedmetadata', function () { if (chaos) { keepPitch(false); setRate(cRate); } });

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
      else if (guest) guest.mute();
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
      s.main.textContent = guest ? guest.label() : (on ? 'Parar música' : 'Poner música');
      s.host.classList.toggle('is-playing', on);
      var wait = api.waiting();
      s.host.classList.toggle('is-waiting', wait);
      s.titleEl.innerHTML = wait ? NOTE + '<span>Activar música</span>' : '';
      if (!wait) s.titleEl.textContent = guest ? guest.title : TRACKS[idx].title;
    });
  }

  // pixel waveform: chunky mirrored columns, yellow on aztec
  var raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    var any = false, live = api.bytes(freq), synth = !live && (playing() || !!(guest && guest.playing())), t = (now - t0) / 1000, showTitle = now < titleUntil;
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
      var px = Math.max(2, Math.round(H / 10)), col = px + 1, n = Math.floor((W - 4 + 1) / col), mid = H / 2, x0 = Math.round((W - (n * col - 1)) / 2);
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
          c.fillRect(x0 + i * col, Math.round(mid - (j + 1) * px), px, px - 1);
          c.fillRect(x0 + i * col, Math.round(mid + j * px + 1), px, px - 1);
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

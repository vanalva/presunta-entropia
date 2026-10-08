/* =============================================================
   PE-83 CONSOLE — core
   Hardware input (d-pad, A/B, MENÚ, SONIDO, volume wheel, entropy
   slide), a WebAudio synth, the screen OS (attract gallery,
   launcher, FECHAS, galería, video, ajustes) and the game host.

   Games live in ./games/*.js and queue themselves:
     (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
       id, title, tagline, order, controls: [['A','Cortar'], ...],
       preview(ctx, w, h, t, api),          // launcher + intro art
       create(api) -> { update(dt), draw(ctx, w, h), input(key, type), destroy() }
     });
   See GAME API below for what `api` carries. Load order is free.

   localStorage: pe-sound ('0'/'1'), pe-volume (0-10),
   pe-con-bright (1-5; 0 = off is never restored on load), pe-con-best-<gameId>.
   ============================================================= */
(function () {
  'use strict';

  var P = {
    aztec: '#0d161d', aztec2: '#15222c', aztec3: '#1f303d',
    walnut: '#442b26', walnutDark: '#36221e',
    fawn: '#9b4933', fawnDark: '#843c29', fawnLight: '#ad5840',
    white: '#e8d5c4', cream2: '#c6baaf', cream3: '#b2a79d',
    yellow: '#efa02e', yellowDark: '#d1892a', yellowLight: '#f3bc6c',
    olive: '#6b5d30', leaf: '#7d8a3c', tomato: '#c8452c'
  };
  var FONT = "'Space Grotesk', sans-serif";
  var GALLERY = [
    { src: 'assets/images/home-2026-10/grupo-amigos-cocina-1600.webp', cap: 'Cocinar juntos' },
    { src: 'assets/images/home-2026-10/pareja-curso-cocina-madrid-1600.webp', cap: 'Cocinar en pareja' },
    { src: 'assets/images/home-2026-10/ninos-curso-cocina-1600.webp', cap: 'Pequeños chefs' },
    { src: 'assets/images/home-2026-10/foto-trasera-delantal-curso-1600.webp', cap: 'Taller en marcha' },
    { src: 'assets/images/home-2026-10/muestra-plato-mano-1600.webp', cap: 'El emplatado' },
    { src: 'assets/images/home-2026-10/riendo-retrato-1600.webp', cap: 'Lo memorable' },
    { src: 'assets/images/home-2026-10/riendo-comida-1600.webp', cap: 'La sobremesa' },
    { src: 'assets/images/home-2026-10/local-sala-principal-1600.webp', cap: 'Zurbano 83' },
    { src: 'assets/images/home-2026-10/local-cocina-1600.webp', cap: 'La cocina' }
  ];
  var VIDEO_SRC = 'https://res.cloudinary.com/dn53emznt/video/upload/v1763080295/presunta-entropia_bgg2ln.mp4';
  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  /* ---------- tiny utils ---------- */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* ---------- icons: always SVG, never text glyphs (phones draw ▶◀ as emoji) ---------- */
  var SVGI = {
    up: '<path d="M8 3l6 9H2z"/>',
    down: '<path d="M8 13L2 4h12z"/>',
    left: '<path d="M3 8l9-6v12z"/>',
    right: '<path d="M13 8L4 14V2z"/>',
    close: '<path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/>',
    note: '<path d="M6 2h8v3H9v7.5A2.5 2.5 0 1 1 6.5 10H6z"/>',
    play: '<path d="M4 2l10 6-10 6z"/>',
    pause: '<path d="M3 2h4v12H3zM9 2h4v12H9z"/>',
    // toast icons
    mute: '<path d="M1 5.5h3l4-3.5v12l-4-3.5H1z"/><path d="M10.5 5.5l4.5 5M15 5.5l-4.5 5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    power: '<path d="M8 1v6.5M4.2 3.6a5.6 5.6 0 1 0 7.6 0" fill="none" stroke="currentColor" stroke-width="2.2"/>'
  };
  var GLYPH = { '\u25B2': 'up', '\u25BC': 'down', '\u25C0': 'left', '\u25B6': 'right', '\u2715': 'close', '\u266A': 'note' };
  var GLYPH_RE = /[\u25B2\u25BC\u25C0\u25B6\u2715\u266A]/g;
  function ico(name, cls) {
    return '<svg class="pe-ico' + (cls ? ' ' + cls : '') + '" data-i="' + name + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' + SVGI[name] + '</svg>';
  }
  // escaped text with any arrow/close glyphs swapped for their SVG
  function escIco(str) { return esc(str).replace(GLYPH_RE, function (c) { return ico(GLYPH[c]); }); }
  /* Touch-native navigation: follow-the-finger drag on one axis (mouse too).
     The pointer is captured only once the finger has really moved, so a
     plain tap still reaches the thing under it; the click that ends a drag
     is swallowed. o.move(d) while dragging, o.end(d, v) on release (d px,
     v px/ms). */
  function drag(el, o) {
    var axis = o.axis || 'x', start = null, d = 0, moved = false, pid = null, t0 = 0, endedAt = 0;
    el.style.touchAction = axis === 'x' ? 'pan-y' : 'pan-x';
    function pos(e) { return axis === 'x' ? e.clientX : e.clientY; }
    el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      start = pos(e); d = 0; moved = false; pid = e.pointerId; t0 = performance.now();
    });
    el.addEventListener('pointermove', function (e) {
      if (start == null || e.pointerId !== pid) return;
      d = pos(e) - start;
      if (!moved && Math.abs(d) > 8) { moved = true; try { el.setPointerCapture(pid); } catch (x) {} if (o.begin) o.begin(); }
      if (moved && o.move) o.move(d);
    });
    function up(e) {
      if (start == null || e.pointerId !== pid) return;
      start = null;
      if (!moved) return;
      endedAt = performance.now();
      o.end(d, d / Math.max(1, endedAt - t0));
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', function (e) { if (performance.now() - endedAt < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  // a swipe counts past 18% of the size or on a quick flick
  function flung(d, v, size) { return Math.abs(d) > size * 0.18 || Math.abs(v) > 0.45; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch (e) { return null; } }
  var ease = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { return t * t * t; },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; }
  };

  /* =============================================================
     AUDIO — synthesized, one master gain driven by the wheel
     ============================================================= */
  var AC = null, master = null, speakerEl = null, speakerT = 0, analyser = null, lastSound = 0;
  var sound = store('pe-sound') !== '0';
  var volume = clamp(parseInt(store('pe-volume') || '6', 10) || 6, 0, 10);

  function gainValue() { return sound ? Math.pow(volume / 10, 1.6) * 0.9 : 0; }
  function audio() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { AC = new C(); } catch (e) { return null; }
      master = AC.createGain();
      master.gain.value = gainValue();
      master.connect(AC.destination);
      try { analyser = AC.createAnalyser(); analyser.fftSize = 256; master.connect(analyser); } catch (e) { analyser = null; }
      loadSamples();
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function applyGain() {
    if (master) master.gain.setTargetAtTime(gainValue(), AC.currentTime, 0.02);
    var v = $('video', stage || document.createElement('div'));
    if (v) v.volume = sound ? volume / 10 : 0;
  }
  /* Cosmetic pulses use the Web Animations API on opacity (compositor only).
     Toggling classes inside the console during play forced a full-page
     re-layout per sound (cqi units need the container size): 60-90 ms. */
  var speakerAnim = null;
  function pulseSpeaker() {
    lastSound = performance.now();
    if (!speakerEl || !gainValue() || !speakerEl.animate) return;
    if (speakerAnim && speakerAnim.playState === 'running') return;
    speakerAnim = speakerEl.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  }
  function tone(freq, dur, o) {
    o = o || {};
    if (!AC || !master || !gainValue()) return;
    var t0 = AC.currentTime + (o.delay || 0);
    var osc = AC.createOscillator(), g = AC.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    var v = (o.vol == null ? 0.12 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    pulseSpeaker();
  }
  var noiseBuf = null;
  function noise(dur, o) {
    o = o || {};
    if (!AC || !master || !gainValue()) return;
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = AC.currentTime + (o.delay || 0);
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'highpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    var v = (o.vol == null ? 0.2 : o.vol);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
    pulseSpeaker();
  }
  var SFX = {
    click: function () { noise(0.014, { freq: 3200, vol: 0.18 }); },
    nav: function () { tone(520, 0.05, { vol: 0.08 }); },
    open: function () { tone(440, 0.07, { to: 880, vol: 0.09 }); tone(880, 0.07, { delay: 0.07, vol: 0.08 }); },
    back: function () { tone(660, 0.09, { to: 330, vol: 0.08 }); },
    tick: function (p) { noise(0.008, { filter: 'bandpass', freq: 1800 + (p || 0) * 160, q: 3, vol: 0.5 }); },
    ok: function () { tone(660, 0.07, { vol: 0.09 }); tone(990, 0.12, { delay: 0.07, vol: 0.09 }); },
    coin: function () { tone(988, 0.06, { vol: 0.08 }); tone(1319, 0.2, { delay: 0.06, vol: 0.08 }); },
    pop: function () { tone(300, 0.08, { type: 'sine', to: 900, vol: 0.22 }); },
    cut: function () { noise(0.09, { freq: 1400, vol: 0.32 }); tone(160, 0.1, { type: 'sine', to: 60, vol: 0.3 }); },
    thud: function () { tone(170, 0.16, { type: 'sine', to: 48, vol: 0.4 }); noise(0.05, { filter: 'lowpass', freq: 500, vol: 0.3 }); },
    fail: function () { tone(330, 0.36, { type: 'sawtooth', to: 110, vol: 0.08 }); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.12, { delay: i * 0.08, vol: 0.08 }); }); },
    count: function () { tone(440, 0.09, { vol: 0.09 }); },
    go: function () { tone(880, 0.22, { vol: 0.1 }); },
    whoosh: function () { noise(0.2, { filter: 'bandpass', freq: 400, to: 3000, q: 2, vol: 0.25 }); },
    stamp: function () { tone(120, 0.12, { type: 'sine', to: 50, vol: 0.45 }); noise(0.06, { filter: 'lowpass', freq: 900, vol: 0.4 }); },
    sizzle: function () { noise(0.25, { filter: 'highpass', freq: 5000, vol: 0.12 }); },
    boot: function () { [262, 392, 523, 784].forEach(function (f, i) { tone(f, 0.5, { type: 'sine', delay: i * 0.09, vol: 0.12, attack: 0.02 }); }); }
  };
  /* Power-off: an ethereal 80s synth sigh for switching the machine off
     (~0.9 s, lines up with the 0.56 s screen collapse). A soft A-minor
     add9 pad of detuned saws whose low-pass closes while the pitch glides
     down a fifth (a tape-stop feel), a sub sine dropping an octave, a last
     small spark as the dot on the glass vanishes, all through a short
     filtered echo for the tail. */
  SFX.poweroff = function () {
    if (!AC || !master || !gainValue()) return;
    var t0 = AC.currentTime + 0.01, END = 0.95;
    var bus = AC.createGain(); bus.gain.value = 1;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(3400, t0);
    lp.frequency.exponentialRampToValueAtTime(160, t0 + 0.75);
    // echo tail: 190 ms, soft feedback, darkened
    var dl = AC.createDelay(1), fb = AC.createGain(), dlp = AC.createBiquadFilter(), wet = AC.createGain();
    dl.delayTime.value = 0.19; fb.gain.value = 0.34; dlp.type = 'lowpass'; dlp.frequency.value = 1700; wet.gain.value = 0.45;
    lp.connect(bus); bus.connect(master);
    bus.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(master);
    // pad: A3 C4 E4 B4, two saws each, +/- 7 cents
    var env = AC.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.9, t0 + 0.025);
    env.gain.setValueAtTime(0.9, t0 + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.82);
    env.connect(lp);
    [220, 261.63, 329.63, 493.88].forEach(function (f) {
      [-7, 7].forEach(function (cents) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = 'sawtooth';
        o.detune.value = cents;
        o.frequency.setValueAtTime(f, t0);
        o.frequency.exponentialRampToValueAtTime(f * 0.667, t0 + 0.8);   // down a fifth
        g.gain.value = 0.028;
        o.connect(g); g.connect(env);
        o.start(t0); o.stop(t0 + END);
      });
    });
    // sub: A2 -> A1
    var sub = AC.createOscillator(), sg = AC.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t0);
    sub.frequency.exponentialRampToValueAtTime(55, t0 + 0.6);
    sg.gain.setValueAtTime(0.0001, t0);
    sg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
    sub.connect(sg); sg.connect(bus);
    sub.start(t0); sub.stop(t0 + 0.7);
    // the last spark as the dot vanishes (~0.5 s)
    var sp = AC.createOscillator(), spg = AC.createGain();
    sp.type = 'sine';
    sp.frequency.setValueAtTime(1760, t0 + 0.48);
    sp.frequency.exponentialRampToValueAtTime(880, t0 + 0.62);
    spg.gain.setValueAtTime(0.0001, t0 + 0.48);
    spg.gain.exponentialRampToValueAtTime(0.05, t0 + 0.49);
    spg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.64);
    sp.connect(spg); spg.connect(bus);
    sp.start(t0 + 0.48); sp.stop(t0 + 0.66);
    // let the echo ring out, then free the nodes
    setTimeout(function () { try { bus.disconnect(); wet.disconnect(); fb.disconnect(); } catch (e) {} }, 2200);
    pulseSpeaker();
  };
  function sfx(name, p) { if (AC && SFX[name]) SFX[name](p); }

  /* Juan's original console sounds for the big moments (boot, entering a
     game, leaving it, losing, the result). Decoded into the same master gain,
     so the wheel and SONIDO drive them too. The small UI ticks stay synth. */
  var CLD = 'https://res.cloudinary.com/dn53emznt/video/upload/';
  var SAMPLE_URLS = {
    boot: CLD + 'v1763111742/console-starts_bczuzf.mp3',
    gamestart: CLD + 'v1763111742/game-start-screen_qmzjil.mp3',
    exit: CLD + 'v1763111743/exit-game_a9ehju.mp3',
    lose: CLD + 'v1763111742/snake-game-lose_kxunmt.mp3',
    result: CLD + 'v1763111742/slice-result_m614lq.mp3'
  };
  var samples = {}, rawSamples = null, decoding = {};
  // fetch early (no AudioContext needed), decode once the context exists
  function fetchSamples() {
    if (rawSamples || !window.fetch) return;
    rawSamples = {};
    Object.keys(SAMPLE_URLS).forEach(function (k) {
      rawSamples[k] = fetch(SAMPLE_URLS[k]).then(function (r) { return r.arrayBuffer(); }).catch(function () { return null; });
    });
  }
  function decodeSample(k) {
    if (decoding[k]) return decoding[k];
    fetchSamples();
    decoding[k] = rawSamples[k].then(function (b) {
      if (!b || !AC) return null;
      return new Promise(function (ok) { AC.decodeAudioData(b.slice(0), ok, function () { ok(null); }); });
    }).then(function (buf) { if (buf) samples[k] = buf; return buf; });
    return decoding[k];
  }
  function loadSamples() { Object.keys(SAMPLE_URLS).forEach(decodeSample); }
  function sampleSoon(name, vol) {
    if (sample(name, vol)) return;
    if (!AC) return;
    var t0 = Date.now();
    decodeSample(name).then(function () { if (Date.now() - t0 < 1500) sample(name, vol); });
  }
  // returns true when it played, so callers can fall back to a synth sound
  function sample(name, vol) {
    if (!AC || !master || !gainValue() || !samples[name]) return false;
    var src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = samples[name];
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(master);
    src.start();
    pulseSpeaker();
    return true;
  }

  /* =============================================================
     DOM + STATE
     ============================================================= */
  var root, hostEl, inShadow = false, consoleInView = false, screenEl, stage, shakeEl, toastEl, dimEl, offEl, ledEl, statusApp, statusVol, clockEl, wheelEl, padEl, toggleEl = null;
  var visible = false, booted = false, armed = false;
  var bright = clamp(parseInt(store('pe-con-bright') || '5', 10) || 5, 1, 5);   // 0 (off) is not restored
  var apps = [];            // launcher entries
  var current = null;       // active app controller
  var launcher = null, attract = null;
  var idleT = 0;
  var GAMES = [];

  /* =============================================================
     SCREEN helpers
     ============================================================= */
  function setStatus(label) { statusApp.textContent = label; }
  function renderVolBars() {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<i class="' + (volume >= i * 2 - 1 ? 'is-on' : '') + '" style="height:' + (i * 2) + 'px"></i>';
    statusVol.innerHTML = h;
    statusVol.classList.toggle('is-muted', !sound || volume === 0);
  }
  function meter(n, max) {
    var h = '<span class="pe-os_meter">';
    for (var i = 1; i <= max; i++) h += '<i data-v="' + i + '" class="' + (i <= n ? 'is-on' : '') + '"></i>';
    return h + '</span>';
  }
  /* ONE TOAST: the cream bubble the volume and brightness feedback made
     (mono label + something), top centre of the screen, 1.1 s. Every
     transient console message uses it:
       toast('Vol', { meter: [6, 10] })            label + segmented meter
       toast('Silencio')                           plain text (Silencio, Modo caos, ...)
       toast('Carrito', { value: '+1' })           label + short value (cart feedback)
       toast('Sonido', { icon: 'mute' })           label + SVG icon (available, unused)
     { warn: true } colours the value/icon rust (sold out, failed);
     { ms } changes how long it stays. toast(html, ms) still takes raw HTML. */
  var toastT = 0;
  function toast(label, o) {
    var html = label, warn = false, ms = 0;
    if (o && typeof o === 'object') {
      html = '<span class="pe-os_toast-label">' + esc(label) + '</span>';
      if (o.meter) html += meter(o.meter[0], o.meter[1]);
      else if (o.icon) html += ico(o.icon, 'pe-os_toast-ico');
      else if (o.value != null) html += '<span class="pe-os_toast-val">' + esc(o.value) + '</span>';
      warn = !!o.warn; ms = o.ms;
    } else ms = o;
    toastEl.innerHTML = html;
    toastEl.classList.toggle('is-warn', warn);
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, ms || 1100);
  }
  function shake(px, ms) {
    if (!shakeEl.animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var d = px || 4;
    shakeEl.animate([
      { transform: 'translate(0, 0)' },
      { transform: 'translate(' + (-d) + 'px, ' + (d * 0.5) + 'px)' },
      { transform: 'translate(' + d + 'px, ' + (-d * 0.5) + 'px)' },
      { transform: 'translate(' + (-d * 0.6) + 'px, 0)' },
      { transform: 'translate(' + (d * 0.3) + 'px, ' + (d * 0.3) + 'px)' },
      { transform: 'translate(0, 0)' }
    ], { duration: ms || 280, easing: 'linear' });
  }
  /* 0 = the screen is OFF: fully dimmed, LED dark, and after a few seconds
     the DVD saver starts bouncing on the dark glass. */
  /* Power: brillo 0 switches the screen OFF with the boot line played
     backwards (a faint wash, top and bottom shutters close on a bright line,
     the line shrinks to a dot), then the DVD saver comes in quickly. Any
     touch on the console while off powers it back on at full brightness
     (the line grows back, the shutters open) and resumes where it was. */
  var offT = 0, powerEl = null, screenIsOff = false, powerT = 0;
  var POWER_OFF_MS = 560, POWER_ON_MS = 480;
  function powerAnim(kind) {
    if (!powerEl) return;
    clearTimeout(powerT);
    powerEl.className = 'pe-screen_power';
    void powerEl.offsetWidth;                       // restart the keyframes
    powerEl.className = 'pe-screen_power is-' + kind;
    powerT = setTimeout(function () { powerEl.className = 'pe-screen_power'; }, kind === 'off' ? POWER_OFF_MS + 40 : POWER_ON_MS + 40);
  }
  function applyBright() {
    clearTimeout(offT);
    if (bright === 0) {
      if (!screenIsOff) {
        screenIsOff = true;
        powerAnim('off');
        // the glass goes dark as the line closes, then the saver arrives
        offT = setTimeout(function () {
          if (bright !== 0) return;
          dimEl.style.setProperty('--pe-dim', '1');
          if (ledEl) ledEl.classList.add('is-off');
          offT = setTimeout(function () { if (bright === 0 && screenDvd) screenDvd.show('off'); }, 180);
        }, POWER_OFF_MS - 60);
      }
      return;
    }
    if (screenIsOff) {
      screenIsOff = false;
      if (screenDvd && screenDvd.mode === 'off') screenDvd.hide();
      powerAnim('on');
    }
    if (ledEl) ledEl.classList.remove('is-off');
    dimEl.style.setProperty('--pe-dim', String((5 - bright) * 0.12));
  }
  function powerOn() {
    if (bright !== 0) return false;
    bright = 5;
    store('pe-con-bright', bright);
    applyBright();
    sampleSoon('boot');                        // same start-up sound as the first touch after load
    toast('Brillo', { meter: [bright, 5] });
    assist('screenOn');
    if (current && current.refresh) current.refresh();
    return true;
  }
  var ledAnim = null;
  function blinkLed() {
    if (!ledEl.animate) return;
    if (ledAnim && ledAnim.playState === 'running') return;
    ledAnim = ledEl.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 90, easing: 'linear' });
  }
  function tickClock() {
    try {
      clockEl.textContent = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (e) {
      var d = new Date(); clockEl.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
  }
  // the cartridge drops into its slot and comes back up wearing the new label
  var cartT = 0, cartLabelNow = '';
  function swapCart() { if (typeof ticker !== 'undefined') ticker.swap(); }
  function makeView(cls) {
    var el = document.createElement('div');
    el.className = 'pe-os_view ' + cls;
    stage.appendChild(el);
    return el;
  }
  /* Element sizes come from a ResizeObserver cache. The loop must never read
     layout: the home page animates other things every frame, so one
     clientWidth read forces a full-page reflow (measured 40-80 ms stalls). */
  var sizeCache = new WeakMap(), sizeRO = null;
  function csize(el) {
    var z = sizeCache.get(el);
    if (z) return z;
    if (!sizeRO) sizeRO = new ResizeObserver(function (entries) {
      entries.forEach(function (en) { sizeCache.set(en.target, { w: en.contentRect.width, h: en.contentRect.height }); });
    });
    z = { w: el.clientWidth, h: el.clientHeight };   // first read only, then the observer keeps it fresh
    sizeCache.set(el, z);
    sizeRO.observe(el);
    return z;
  }
  /* Everything is drawn on a DETACHED buffer canvas and blitted once per
     frame. Setting ctx.font on a canvas that lives in the page makes Chrome
     resolve styles for the whole document (35-65 ms per frame here, since
     other page animations dirty it every frame); a detached canvas resolves
     fonts on its own. Callers draw on f.ctx, then call f.present(). */
  /* pixel (optional): size of one art pixel in CSS px. The game draws in CSS
     px as always; the buffer is just smaller and gets scaled up with hard
     edges, so nothing about the drawing changes, it only turns chunky. */
  function fitCanvas(cv, pixel) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var z = csize(cv), w = z.w, h = z.h;
    if (!w || !h) return null;
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    var k = pixel ? 1 / pixel : dpr;                      // buffer px per CSS px
    var BW = Math.max(1, Math.ceil(w * k)), BH = Math.max(1, Math.ceil(h * k));
    // pixel mode has its own CPU-backed buffer (read back every frame for the palette snap)
    var buf = pixel ? (cv.__pePixBuf || (cv.__pePixBuf = document.createElement('canvas')))
                    : (cv.__peBuf || (cv.__peBuf = document.createElement('canvas')));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (buf.width !== BW || buf.height !== BH) { buf.width = BW; buf.height = BH; }
    var ctx = pixel ? buf.getContext('2d', { willReadFrequently: true }) : buf.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    var out = cv.__peOut || (cv.__peOut = cv.getContext('2d'));
    var q = null;
    if (pixel) { q = { ctx: ctx, items: [] }; textQueue = q; }
    return {
      ctx: ctx, w: w, h: h,
      present: function () {
        if (pixel) snapToPalette(ctx, BW, BH);
        out.setTransform(1, 0, 0, 1, 0, 0);
        out.imageSmoothingEnabled = !pixel;
        out.clearRect(0, 0, W, H);
        out.drawImage(buf, 0, 0, BW, BH, 0, 0, BW / k * dpr, BH / k * dpr);
        if (!q) return;
        if (textQueue === q) textQueue = null;
        // replay the recorded text at full resolution, same place, same transform
        var f = dpr / k;
        q.items.forEach(function (it) {
          var m = it.m;
          out.setTransform(m.a * f, m.b * f, m.c * f, m.d * f, m.e * f, m.f * f);
          out.globalAlpha = it.a;
          text(out, it.s, it.x, it.y, it.o);
        });
        out.globalAlpha = 1;
        out.setTransform(1, 0, 0, 1, 0, 0);
      }
    };
  }
  /* Pixel art, not just low res: every buffer pixel snaps to the nearest
     brand colour, so anti-aliased edges become hard stair-steps and blends
     become flat fills. Nearest colour is cached per 15-bit RGB key. */
  var PALETTE = null, snapCache = new Map();
  function paletteRGB() {
    if (PALETTE) return PALETTE;
    PALETTE = Object.keys(P).map(function (k) {
      var h = P[k].replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    });
    return PALETTE;
  }
  function nearestIdx(r, g, b) {
    var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    var hit = snapCache.get(key);
    if (hit) return hit;
    var pal = paletteRGB(), best = 0, bd = 1e9;
    for (var j = 0; j < pal.length; j++) {
      var dr = r - pal[j][0], dg = g - pal[j][1], db = b - pal[j][2];
      var dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bd) { bd = dist; best = j; }
    }
    hit = [best, bd];
    snapCache.set(key, hit);
    return hit;
  }
  var snapIdx = null, snapPure = null;
  function snapToPalette(ctx, bw, bh) {
    var pal = paletteRGB(), img = ctx.getImageData(0, 0, bw, bh), d = img.data, n = bw * bh;
    if (!snapIdx || snapIdx.length !== n) { snapIdx = new Uint8Array(n); snapPure = new Uint8Array(n); }
    // pass 1: pixels that already are a brand colour (within a small tolerance) are "pure"
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      var hit = nearestIdx(d[i], d[i + 1], d[i + 2]);
      snapIdx[p] = hit[0];
      snapPure[p] = hit[1] < 120 ? 1 : 0;
    }
    // pass 2: an anti-aliased edge pixel takes the colour of the closest-matching
    // pure neighbour, so edges resolve to one side instead of a stray hue
    for (var y = 0; y < bh; y++) {
      for (var x = 0; x < bw; x++) {
        var q = y * bw + x, o = q * 4, idx = snapIdx[q];
        if (!snapPure[q]) {
          var bd = 1e9;
          for (var dy = -1; dy <= 1; dy++) {
            var yy = y + dy; if (yy < 0 || yy >= bh) continue;
            for (var dx = -1; dx <= 1; dx++) {
              var xx = x + dx; if ((!dx && !dy) || xx < 0 || xx >= bw) continue;
              var nq = yy * bw + xx;
              if (!snapPure[nq]) continue;
              var c = pal[snapIdx[nq]];
              var dr = d[o] - c[0], dg = d[o + 1] - c[1], db = d[o + 2] - c[2];
              var dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
              if (dist < bd) { bd = dist; idx = snapIdx[nq]; }
            }
          }
        }
        var col = pal[idx];
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  // the art-pixel size for games: 3 CSS px on the desktop screen, 2 on phones
  var pixelOn = store('pe-con-pixel') !== '0';
  function gamePixel(cv) {
    if (!pixelOn) return 0;
    var z = csize(cv);
    return Math.min(z.w, z.h) < 340 ? 2 : 3;
  }

  // which app a view is, for the assistant's first-visit lines
  function viewId(v) {
    for (var i = 0; i < apps.length; i++) if (apps[i].view === v) return apps[i].id;
    return v === videoView ? 'video' : v === recordsView ? 'records' : v === aboutView ? 'about' : v === navView ? 'nav' : '';
  }
  var seenApp = {}, leftApp = {};
  function go(app, opts) {
    if (current === app) return;
    var prev = current;
    if (current) { current.el.classList.remove('is-active'); if (current.leave) current.leave(); }
    current = app;
    app.el.classList.add('is-active');
    setStatus(app.status || app.title || 'PE·OS');
    swapCart(app.cart || app.title || 'PE·OS', app.cartColor);
    if (booted && app !== attract && app !== launcher) {
      // first visit of an app has its own line; after that the plain "Abriendo …"
      var id = viewId(app);
      // (marked as seen only once the line really made it on screen)
      if (id && !seenApp[id] && assist('enter', { sub: id })) seenApp[id] = 1;
      else assist('open', { name: String(app.title).toLowerCase() });
    } else if (booted && app === launcher && prev && prev !== attract && prev !== navView) {
      var pid = viewId(prev);
      if (pid && !leftApp[pid] && assist('leave', { sub: pid })) leftApp[pid] = 1;
    }
    if (app.enter) app.enter(opts || {});
    idleT = 0;
  }

  /* =============================================================
     IMAGES (shared by attract, galería, previews)
     ============================================================= */
  var imgs = GALLERY.map(function (g) { var im = new Image(); im.decoding = 'async'; im.src = g.src; return im; });
  function drawCover(ctx, im, x, y, w, h) {
    if (!im || !im.complete || !im.naturalWidth) { ctx.fillStyle = P.aztec3; ctx.fillRect(x, y, w, h); return; }
    var r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    var sw = w / r, sh = h / r;
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // pixel mode: text aimed at the chunky buffer is recorded and drawn crisp after the scale-up
  var textQueue = null;
  function text(ctx, s, x, y, o) {
    o = o || {};
    if (textQueue && ctx === textQueue.ctx) {
      textQueue.items.push({ s: s, x: x, y: y, o: o, m: ctx.getTransform(), a: ctx.globalAlpha });
      return;
    }
    ctx.font = (o.weight || 700) + ' ' + (o.size || 14) + 'px ' + FONT;
    ctx.fillStyle = o.color || P.white;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = o.spacing + 'px';
    if (GLYPH_RE.test(s)) { GLYPH_RE.lastIndex = 0; glyphText(ctx, String(s), x, y, o); }
    else ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  // text with arrow/close/note glyphs: the glyphs are drawn from the SVG
  // icon paths so no device ever swaps in its emoji
  var iconPaths = {};
  function iconPath(name) {
    if (!iconPaths[name]) iconPaths[name] = new Path2D((SVGI[name].match(/ d="([^"]+)"/) || [])[1] || '');
    return iconPaths[name];
  }
  function glyphText(ctx, str, x, y, o) {
    var size = o.size || 14, gw = size * 0.78, gap = size * 0.12;
    var parts = str.split(/([▲▼◀▶✕♪])/).filter(function (p) { return p !== ''; });
    var widths = parts.map(function (p) { return GLYPH[p] ? gw + gap : ctx.measureText(p).width; });
    var total = widths.reduce(function (t, w) { return t + w; }, 0);
    var al = ctx.textAlign, x0 = al === 'center' ? x - total / 2 : (al === 'right' || al === 'end') ? x - total : x;
    var bl = ctx.textBaseline;
    var cy = bl === 'middle' ? y : bl === 'top' || bl === 'hanging' ? y + size * 0.5 : bl === 'bottom' ? y - size * 0.5 : y - size * 0.36;
    ctx.textAlign = 'left';
    for (var i = 0, cx = x0; i < parts.length; cx += widths[i], i++) {
      var g = GLYPH[parts[i]];
      if (!g) { ctx.fillText(parts[i], cx, y); continue; }
      ctx.save();
      ctx.translate(cx + gap / 2, cy - gw / 2);
      ctx.scale(gw / 16, gw / 16);
      if (g === 'close') { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2.4; ctx.lineCap = 'square'; ctx.stroke(iconPath(g)); }
      else ctx.fill(iconPath(g));
      ctx.restore();
    }
    ctx.textAlign = al;
  }
  // brand asterisk, drawn as 5 petals
  function asterisk(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    for (var i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate(-Math.PI / 2 + i * (Math.PI * 2 / 5) + Math.PI / 2 * 0);
      rr(ctx, -r * 0.16, -r, r * 0.32, r, r * 0.08);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* =============================================================
     ATTRACT (idle gallery on the hero)
     ============================================================= */
  function makeAttract() {
    var el = makeView('pe-os_gallery pe-os_attract');
    var photos = GALLERY.map(function (g) {
      var d = document.createElement('div');
      d.className = 'pe-os_photo';
      d.style.backgroundImage = "url('" + g.src + "')";
      el.appendChild(d);
      return d;
    });
    var bar = document.createElement('div');
    bar.className = 'pe-os_photo-bar';
    bar.innerHTML = '<span class="pe-os_photo-cta">' + ico('play') + ' Pulsa para jugar</span><span class="pe-os_photo-ticks">' + GALLERY.map(function () { return '<i></i>'; }).join('') + '</span>';
    el.appendChild(bar);
    var ticks = $$('.pe-os_photo-ticks i', bar);
    var idx = 0, timer = 0;
    function show(i) {
      idx = (i + photos.length) % photos.length;
      photos.forEach(function (p, j) { p.classList.toggle('is-on', j === idx); });
      ticks.forEach(function (t, j) { t.classList.toggle('is-on', j === idx); });
    }
    return {
      el: el, title: 'PE·OS', status: 'PE·OS', cart: 'PE·OS',
      enter: function () { show(idx); timer = 0; },
      tick: function (dt) { timer += dt; if (timer > 4.6) { timer = 0; show(idx + 1); } },
      input: function (key, type) { if (type !== 'down') return; enterFromAttract(); },
      show: show
    };
  }

  // small straight icons (SVG), shared by the video bar and the lightbox
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><rect x="16" y="9" width="2" height="6" fill="currentColor"/><rect x="19" y="7" width="2" height="10" fill="currentColor"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
    exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>'
  };

  /* =============================================================
     LIGHTBOX — the gallery fullscreen. Lives in the page (not the
     console's shadow root: the console is paint-contained, which would
     trap a fixed overlay inside it). Rounded with the site radius tokens,
     square 12px buttons, arrows / Esc / swipe.
     ============================================================= */
  var lightbox = (function () {
    var el = null, img = null, cap = null, count = null, idx = 0, isOpen = false, onClose = null;
    function big(src) { return src.replace('-p-800', '-p-1600'); }
    function build() {
      el = document.createElement('div');
      el.className = 'pe-lightbox';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Galería');
      el.tabIndex = -1;
      el.innerHTML =
        '<div class="pe-lightbox_frame"><img class="pe-lightbox_img" alt=""></div>' +
        '<div class="pe-lightbox_bar"><span class="pe-lightbox_cap"></span><span class="pe-lightbox_count"></span></div>' +
        '<button type="button" class="pe-lightbox_btn is-prev" aria-label="Anterior">' + ICON.prev + '</button>' +
        '<button type="button" class="pe-lightbox_btn is-next" aria-label="Siguiente">' + ICON.next + '</button>' +
        '<button type="button" class="pe-lightbox_btn is-close" aria-label="Cerrar">' + ICON.close + '</button>';
      document.body.appendChild(el);
      img = el.querySelector('.pe-lightbox_img');
      cap = el.querySelector('.pe-lightbox_cap');
      count = el.querySelector('.pe-lightbox_count');
      el.querySelector('.is-prev').addEventListener('click', function () { go_(-1); });
      el.querySelector('.is-next').addEventListener('click', function () { go_(1); });
      el.querySelector('.is-close').addEventListener('click', close);
      el.addEventListener('click', function (e) { if (e.target === el) close(); });
      // swipe
      var sx = null;
      el.addEventListener('pointerdown', function (e) { sx = e.clientX; });
      el.addEventListener('pointerup', function (e) {
        if (sx == null) return;
        var dx = e.clientX - sx; sx = null;
        if (Math.abs(dx) > 45) go_(dx < 0 ? 1 : -1);
      });
      document.addEventListener('keydown', function (e) {
        if (!isOpen) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go_(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); go_(1); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
      }, true);
    }
    function render() {
      var g = GALLERY[idx];
      img.classList.remove('is-in');
      var src = big(g.src);
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        img.src = src; img.alt = g.cap;
        requestAnimationFrame(function () { img.classList.add('is-in'); });
      };
      pre.src = src;
      cap.textContent = g.cap;
      count.textContent = ('0' + (idx + 1)).slice(-2) + ' / ' + ('0' + GALLERY.length).slice(-2);
    }
    function go_(d) { idx = (idx + d + GALLERY.length) % GALLERY.length; sfx('nav'); render(); if (onNav) onNav(idx); }
    var onNav = null;
    function open(i, hooks) {
      if (!el) build();
      idx = i || 0; isOpen = true;
      onClose = hooks && hooks.close; onNav = hooks && hooks.nav;
      render();
      el.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
      sfx('open');
      el.focus({ preventScroll: true });   // the dialog takes focus; no button pre-highlighted
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      el.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      sfx('back');
      if (onClose) onClose(idx);
    }
    return { open: open, close: close, step: go_, get isOpen() { return isOpen; } };
  })();

  /* =============================================================
     GALERÍA app (manual) — the brand video is its first slide (poster +
     main-style "Ver vídeo" button → the VIDEO view, B comes back here);
     the photos follow. A or a tap opens the lightbox / plays the video.
     ============================================================= */
  var VIDEO_POSTER = VIDEO_SRC.replace('/upload/', '/upload/so_4,w_900,c_limit/').replace(/\.mp4$/, '.jpg');
  var videoView = null, galeriaView = null;
  function makeGaleria() {
    var el = makeView('pe-os_gallery pe-os_galeria');
    var ITEMS = [{ video: true, cap: 'Un minuto en Zurbano 83' }].concat(GALLERY);
    var photos = ITEMS.map(function (g) {
      var d = document.createElement('div');
      d.className = 'pe-os_photo' + (g.video ? ' is-video' : '');
      d.style.backgroundImage = "url('" + (g.video ? VIDEO_POSTER : g.src) + "')";
      if (g.video) d.innerHTML = '<button type="button" class="pe-os_vplay" data-watch aria-label="Ver vídeo"><span>' + ico('play') + ' Ver vídeo</span></button>';
      el.appendChild(d);
      return d;
    });
    var bar = document.createElement('div');
    bar.className = 'pe-os_photo-bar';
    bar.innerHTML = '<span data-cap></span><span class="pe-os_photo-right"><span data-count></span>' +
      '<button type="button" class="pe-os_vbtn" data-full aria-label="Pantalla completa">' + ICON.full + '</button></span>';
    el.appendChild(bar);
    var capEl = $('[data-cap]', bar), countEl = $('[data-count]', bar);
    var idx = 0, timer = 0;
    function show(i) {
      idx = (i + photos.length) % photos.length;
      photos.forEach(function (p, j) { p.classList.toggle('is-on', j === idx); });
      capEl.textContent = ITEMS[idx].cap;
      countEl.textContent = ('0' + (idx + 1)).slice(-2) + ' / ' + ('0' + photos.length).slice(-2);
      el.classList.toggle('is-video', !!ITEMS[idx].video);
    }
    // now and then the assistant says something about the photo on screen (SAY.gallery)
    function comment() { if (!ITEMS[idx].video) assist('gallery'); }
    // the lightbox holds the photos only (index - 1: the video is slide 0)
    function openBox() {
      if (ITEMS[idx].video) { sfx('open'); go(videoView); return; }
      lightbox.open(idx - 1, { nav: function (i) { show(i + 1); assist('gallery'); }, close: function (i) { show(i + 1); timer = 0; } });
    }
    el.addEventListener('click', function (e) { if (current === api_ && (!e.target.closest('button') || e.target.closest('[data-watch], [data-full]'))) openBox(); });
    drag(el, { axis: 'x', end: function (d, v) {
      if (!flung(d, v, el.clientWidth)) return;
      sfx('nav'); timer = 0; show(idx + (d < 0 ? 1 : -1)); comment();
    } });
    var api_ = {
      el: el, title: 'GALERÍA',
      enter: function () { show(idx); timer = 0; },
      tick: function (dt) { if (lightbox.isOpen || ITEMS[idx].video) return; timer += dt; if (timer > 6) { timer = 0; show(idx + 1); } },
      input: function (key, type) {
        if (type !== 'down') return;
        if (lightbox.isOpen) {
          if (key === 'left' || key === 'up') lightbox.step(-1);
          else if (key === 'right' || key === 'down') lightbox.step(1);
          else if (key === 'b' || key === 'a') lightbox.close();
          return;
        }
        if (key === 'left' || key === 'up') { sfx('nav'); timer = 0; show(idx - 1); comment(); }
        else if (key === 'right' || key === 'down') { sfx('nav'); timer = 0; show(idx + 1); comment(); }
        else if (key === 'a') openBox();
        else if (key === 'b') { sfx('back'); go(launcher); }
      },
      leave: function () { lightbox.close(); },
      preview: function (ctx, w, h, t) {
        var i = Math.floor(t / 2.2) % imgs.length;
        drawCover(ctx, imgs[i], 0, 0, w, h);
        for (var k = 0; k < imgs.length; k++) {
          ctx.fillStyle = k === i ? P.yellow : 'rgba(13,22,29,.7)';
          ctx.fillRect(w - 14 - (imgs.length - k) * 18, h - 14, 14, 4);
        }
      }
    };
    galeriaView = api_;
    return api_;
  }

  /* =============================================================
     VIDEO app — on-screen controls (play/pause, seek, mute, fullscreen)
     plus hardware: A play/pause · ◀▶ seek 5 s · ▲ fullscreen · ▼ mute · B back
     ============================================================= */
  function makeVideo() {
    var el = makeView('pe-os_video');
    var SEG = 28;
    el.innerHTML = '<video playsinline webkit-playsinline preload="none" src="' + VIDEO_SRC + '"></video>' +
      '<button type="button" class="pe-os_vplay" data-play aria-label="Reproducir"><span data-big>' + ico('play') + ' Reproducir</span></button>' +
      '<div class="pe-os_vbar">' +
        '<button type="button" class="pe-os_vkey" data-play aria-label="Reproducir o pausar"><span class="pe-os_vkey-cap">A</span><span class="pe-os_vkey-txt" data-play-txt>Play</span></button>' +
        '<div class="pe-os_vseg" data-seek role="slider" aria-label="Posición">' + new Array(SEG + 1).join('<i></i>') + '</div>' +
        '<span class="pe-os_vtime" data-t>0:00</span>' +
        '<button type="button" class="pe-os_vkey" data-mute aria-label="Silenciar"><span class="pe-os_vkey-cap is-icon" data-mute-ico>' + ICON.vol + '</span><span class="pe-os_vkey-txt" data-mute-txt>Sonido</span></button>' +
        '<button type="button" class="pe-os_vkey" data-full aria-label="Pantalla completa"><span class="pe-os_vkey-cap is-icon" data-full-ico>' + ICON.full + '</span><span class="pe-os_vkey-txt" data-full-txt>Pantalla</span></button>' +
      '</div>';
    var v = $('video', el), tEl = $('[data-t]', el), track = $('[data-seek]', el), segs = $$('i', track);
    var playTxt = $('[data-play-txt]', el), bigTxt = $('[data-big]', el), muteBtn = $('[data-mute]', el), muteTxt = $('[data-mute-txt]', el);
    var fullBtn = $('[data-full]', el), fullTxt = $('[data-full-txt]', el), vbar = $('.pe-os_vbar', el);
    var muteIco = $('[data-mute-ico]', el), fullIco = $('[data-full-ico]', el);
    var hideT = 0, lit = -1;
    new ResizeObserver(function () { el.classList.toggle('is-narrow', el.clientWidth < 380); }).observe(el);
    function fmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function sync() {
      var p = v.duration ? v.currentTime / v.duration : 0, n = Math.round(p * SEG);
      if (n !== lit) { lit = n; segs.forEach(function (sg, i) { sg.className = i < n ? 'is-on' : ''; }); }
      tEl.textContent = fmt(v.currentTime) + '/' + fmt(v.duration);
    }
    function wake_() {
      el.setAttribute('data-ui', 'on');
      clearTimeout(hideT);
      if (!v.paused) hideT = setTimeout(function hide() {
        // never tuck the bar away while the pointer is on it (you're about to click)
        if (vbar.matches(':hover') || vbar.querySelector(':focus-visible')) { hideT = setTimeout(hide, 1200); return; }
        el.setAttribute('data-ui', 'off');
      }, 2600);
    }
    v.addEventListener('play', function () { el.classList.add('is-playing'); playTxt.textContent = 'Pausa'; wake_(); if (window.PEMusic) window.PEMusic.duck(true); if (current === videoView) assist('videoPlay'); });
    ['pause', 'ended'].forEach(function (ev) { v.addEventListener(ev, function () { if (window.PEMusic) window.PEMusic.duck(false); }); });
    v.addEventListener('pause', function () {
      el.classList.remove('is-playing'); playTxt.textContent = 'Play';
      bigTxt.innerHTML = ico('play') + (v.currentTime > 0.5 ? ' Seguir' : ' Reproducir'); wake_();
      if (current === videoView && !v.ended) assist('videoPause');   // not when leaving the view
    });
    v.addEventListener('timeupdate', sync);
    v.addEventListener('loadedmetadata', sync);
    function toggle() { v.volume = sound ? volume / 10 : 0; if (v.paused) v.play().catch(function () {}); else v.pause(); }
    function setMuted(m) { v.muted = m; muteTxt.textContent = m ? 'Silencio' : 'Sonido'; muteIco.innerHTML = m ? ICON.mute : ICON.vol; muteBtn.classList.toggle('is-lit', m); assist(m ? 'videoMute' : 'videoUnmute'); }
    // inside the shadow root document.fullscreenElement is retargeted to the host,
    // so ask the root the view actually lives in
    function isFull() {
      var r = el.getRootNode ? el.getRootNode() : document;
      var fe = r.fullscreenElement || r.webkitFullscreenElement || document.fullscreenElement || document.webkitFullscreenElement;
      return fe === el;
    }
    function toggleFull() {
      if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) { var pr = rq.call(el); if (pr && pr.catch) pr.catch(function () {}); }
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();   // iPhone Safari: native player
    }
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
      document.addEventListener(ev, function () { var f = isFull(); fullTxt.textContent = f ? 'Salir' : 'Pantalla'; fullIco.innerHTML = f ? ICON.exit : ICON.full; fullBtn.classList.toggle('is-lit', f); wake_(); if (f) assist('videoFull'); });
    });
    // seek by click / drag on the segments
    var seeking = false;
    function seekTo(e) {
      var r = track.getBoundingClientRect(), p = clamp((e.clientX - r.left) / r.width, 0, 1);
      if (v.duration) { v.currentTime = p * v.duration; sync(); }
    }
    track.addEventListener('pointerdown', function (e) { e.stopPropagation(); seeking = true; try { track.setPointerCapture(e.pointerId); } catch (x) {} seekTo(e); wake_(); });
    track.addEventListener('pointermove', function (e) { if (seeking) seekTo(e); });
    track.addEventListener('pointerup', function () { seeking = false; });
    track.addEventListener('click', function (e) { e.stopPropagation(); });
    $$('[data-play]', el).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); sfx('click'); toggle(); }); });
    muteBtn.addEventListener('click', function (e) { e.stopPropagation(); setMuted(!v.muted); sfx('click'); wake_(); });
    fullBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFull(); });
    el.addEventListener('pointermove', wake_);
    v.addEventListener('click', function () { toggle(); });
    return {
      el: el, title: 'VIDEO',
      playing: function () { return !v.paused && !v.ended; },
      enter: function () { v.volume = sound ? volume / 10 : 0; v.play().catch(function () {}); wake_(); },
      leave: function () { v.pause(); if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); },
      input: function (key, type) {
        if (type !== 'down') return;
        wake_();
        if (key === 'a') toggle();
        else if (key === 'left') { v.currentTime = Math.max(0, v.currentTime - 5); sfx('nav'); }
        else if (key === 'right') { v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); sfx('nav'); }
        else if (key === 'up') toggleFull();
        else if (key === 'down') setMuted(!v.muted);
        else if (key === 'b') { if (isFull()) toggleFull(); else { sfx('back'); go(galeriaView || launcher); } }
      },
      preview: function (ctx, w, h, t) {
        drawCover(ctx, imgs[2], 0, 0, w, h);
        ctx.fillStyle = 'rgba(13,22,29,.35)';
        ctx.fillRect(0, 0, w, h);
        var s = Math.min(w, h) * 0.2 * (1 + Math.sin(t * 3) * 0.04);
        rr(ctx, w / 2 - s / 2, h / 2 - s / 2, s, s, s * 0.22);
        ctx.fillStyle = P.yellow; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w / 2 - s * 0.14, h / 2 - s * 0.2);
        ctx.lineTo(w / 2 + s * 0.22, h / 2);
        ctx.lineTo(w / 2 - s * 0.14, h / 2 + s * 0.2);
        ctx.fillStyle = P.aztec; ctx.fill();
        ctx.fillStyle = P.aztec3; ctx.fillRect(16, h - 16, w - 32, 4);
        ctx.fillStyle = P.yellow; ctx.fillRect(16, h - 16, (w - 32) * ((t * 0.08) % 1), 4);
      }
    };
  }

  /* =============================================================
     FECHAS app — sessions from window.PE_CMS, A adds to the cart
     ============================================================= */
  function fechasData() {
    var db = window.PE_CMS, out = [];
    if (!db) return out;
    (db.sesiones || []).forEach(function (s) {
      var it = db.find ? db.find(s.coleccion, s.item) : null;
      if (it) out.push({ it: it, col: s.coleccion, itemId: s.itemId, iso: s.iso, fecha: s.fecha });
    });
    ['talleres', 'cenas'].forEach(function (col) {
      (db[col] || []).forEach(function (it) {
        if (!out.some(function (o) { return o.it === it; })) out.push({ it: it, col: col, itemId: null });
      });
    });
    return out;
  }
  function madridParts(iso) {
    var d = new Date(iso);
    var fmt = function (o) { try { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: 'Europe/Madrid' }, o)).format(d); } catch (e) { return ''; } };
    return { time: fmt({ hour: '2-digit', minute: '2-digit' }) };
  }
  function openBookingModal(slug) {
    var a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-modal-open', 'modal-1');
    if (slug) a.setAttribute('data-booking-item', slug);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return !!document.getElementById('modal-1');
  }
  function makeFechas() {
    var el = makeView('pe-os_fechas');
    el.innerHTML =
      '<div class="pe-os_cal"><div class="pe-os_cal-head"><span class="pe-os_cal-month" data-month></span><span class="pe-os_kicker" data-count></span></div><div class="pe-os_cal-grid" data-grid></div></div>' +
      '<div class="pe-os_ticket-rail" data-rail></div>' +
      '<div class="pe-os_fechas-foot"><span class="pe-os_hint"><span><span class="pe-os_chip">' + ico('up') + ico('down') + '</span>Fecha</span></span><span class="pe-os_hint"><span data-a-label><span class="pe-os_chip is-a">A</span>Reservar</span><span><span class="pe-os_chip is-b">B</span>Salir</span></span></div>';
    var rail = $('[data-rail]', el), grid = $('[data-grid]', el), monthEl = $('[data-month]', el), countEl = $('[data-count]', el), aLabel = $('[data-a-label]', el);
    var list = [], idx = 0, tickets = [];

    function ticketHTML(s) {
      var it = s.it;
      var dateHTML;
      if (s.iso) {
        var d = new Date(s.fecha + 'T12:00:00');
        dateHTML = '<div class="pe-os_ticket-date"><span class="pe-os_ticket-mon">' + DIAS[d.getDay()] + '</span><span class="pe-os_ticket-day">' + d.getDate() + '</span><span class="pe-os_ticket-mon">' + MESES[d.getMonth()] + '</span><span class="pe-os_ticket-time">' + esc(madridParts(s.iso).time) + '</span></div>';
      } else {
        dateHTML = '<div class="pe-os_ticket-date is-soon"><span class="pe-os_ticket-mon">Nuevas</span><span class="pe-os_ticket-day">—</span><span class="pe-os_ticket-mon">fechas</span></div>';
      }
      var seats = '';
      if (s.iso && it.capacityTotal) {
        var cap = Math.min(it.capacityTotal, 24), left = it.seatsLeft == null ? cap : Math.round(it.seatsLeft / it.capacityTotal * cap);
        seats = '<span class="pe-os_seats" title="Plazas">';
        for (var i = 0; i < cap; i++) seats += '<i class="' + (i >= left ? 'is-taken' : '') + '"></i>';
        seats += '</span>';
      }
      var meta = [it.duracion, s.iso && it.seatsLeft != null ? 'Quedan ' + it.seatsLeft + ' plazas' : (s.iso ? '' : 'Te avisamos')].filter(Boolean).join(' · ');
      return dateHTML +
        '<div class="pe-os_ticket-body"><span class="pe-os_ticket-type">' + esc(it.tipo || (s.col === 'cenas' ? 'Cena' : 'Taller')) + '</span><span class="pe-os_ticket-name">' + esc(it.name) + '</span><span class="pe-os_ticket-meta">' + esc(meta) + '</span>' + (it.lead ? '<span class="pe-os_ticket-lead">' + esc(it.lead) + '</span>' : '') + '</div>' +
        '<div class="pe-os_ticket-foot"><span class="pe-os_ticket-price">' + (it.precio != null ? '€' + esc(it.precio) : '') + '</span>' + seats + '</div>';
    }
    function build() {
      list = fechasData();
      rail.innerHTML = '';
      tickets = list.map(function (s) {
        var t = document.createElement('div');
        t.className = 'pe-os_ticket';
        t.innerHTML = ticketHTML(s);
        t.addEventListener('click', function () {
          var i = tickets.indexOf(t);
          if (i === idx) reserve(); else { idx = i; sfx('nav'); layout(); }
        });
        rail.appendChild(t);
        return t;
      });
      if (!list.length) rail.innerHTML = '<div class="pe-os_ticket" style="display:flex;align-items:center;justify-content:center;padding:16px;text-align:center"><span class="pe-os_ticket-name">Nuevas fechas muy pronto</span></div>';
    }
    function layout(dragPx) {
      tickets.forEach(function (t, i) {
        var o = i - idx;
        t.style.transform = 'translateY(calc(' + (o * 108) + '% + ' + (dragPx || 0) + 'px)) scale(' + (o === 0 ? 1 : 0.94) + ')';
        t.style.opacity = Math.abs(o) > 1 ? '0' : (o === 0 ? '1' : '0.4');
      });
      var s = list[idx];
      countEl.textContent = list.length ? ((idx + 1) + ' / ' + list.length) : '';
      aLabel.innerHTML = '<span class="pe-os_chip is-a">A</span>' + (s && s.itemId ? 'Reservar' : 'Ver');
      calendar(s);
    }
    function calendar(s) {
      var today = new Date();
      var ref = s && s.fecha ? new Date(s.fecha + 'T12:00:00') : today;
      var y = ref.getFullYear(), m = ref.getMonth();
      monthEl.textContent = MESES_L[m] + ' ' + y;
      var marked = {};
      list.forEach(function (x) { if (x.fecha) marked[x.fecha] = true; });
      var first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      var h = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="is-dow">' + d + '</span>'; }).join('');
      for (var i = 0; i < startDow; i++) h += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var key = y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
        var dt = new Date(y, m, d, 23, 59);
        var cls = [];
        if (dt < today) cls.push('is-past');
        if (d === today.getDate() && m === today.getMonth() && y === today.getFullYear()) cls.push('is-today');
        if (marked[key]) cls.push('has-session');
        if (s && s.fecha === key) cls.push('is-sel');
        h += '<span class="' + cls.join(' ') + '"' + (marked[key] ? ' data-day="' + key + '"' : '') + '>' + d + '</span>';
      }
      grid.innerHTML = h;
    }
    function move(d) {
      if (!list.length) return;
      var n = clamp(idx + d, 0, list.length - 1);
      if (n === idx) { shake(3, 180); sfx('click'); return; }
      idx = n; sfx('nav'); layout();
    }
    function reserve() {
      var s = list[idx];
      if (!s) return;
      if (s.itemId) {
        // an add is already on its way: no second click, just show where it stands again
        if (cartBusy) { toast('Carrito', { value: cartPending, ms: cartPending === 'En camino' ? 2400 : 9000 }); return; }
        var btn = null;
        var q = window.CSS && CSS.escape ? CSS.escape(s.itemId) : s.itemId;
        // the cart button next to a Reservar (js/pe-booking-flow.js adds it); none rendered for this
        // session (another month, another tab) = a hidden one, same one-click add
        try { btn = document.querySelector('[data-pe-cart-add][data-item-id="' + q + '"], [data-cart-add][data-item-id="' + q + '"]'); } catch (e) {}
        if (!btn && window.EntropicalCart) {
          btn = document.createElement('a');
          btn.href = '#'; btn.hidden = true;
          btn.setAttribute('data-pe-cart-add', ''); btn.setAttribute('data-item-id', s.itemId);
          document.body.appendChild(btn);
          setTimeout(function (b) { return function () { b.remove(); }; }(btn), 0);
        }
        if (btn) {
          // sold out only when the page's live seat count for this session says 0
          // (the cart itself disables its button during every add, so that is no signal)
          if (liveSeats(s.itemId) === 0) {
            sfx('back');
            toast('Carrito', { value: 'Agotado', warn: true });
            assist('cartSoldOut');
            return;
          }
          cartAdd(btn, s.itemId);
          return;
        }
      }
      sfx('open');
      if (!openBookingModal(s.it.slug)) {
        location.href = s.col === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + encodeURIComponent(s.it.slug);
      }
    }
    function liveSeats(id) {
      var el = null;
      try { el = document.querySelector('#modal-1 [data-item-seats-left][data-item-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); } catch (e) {}
      var n = el ? parseInt(el.textContent, 10) : NaN;
      return isNaN(n) ? null : n;
    }
    /* The cart (webflow-cart.js) adds asynchronously: it fires
       'cart:updated' {action:'add'} on success and shows its own
       .cart-notification-error when it fails. The console says "added" or
       "failed" only on those two real signals. A slow cart gets a neutral
       "still on its way" after 8 s and the console keeps listening (up to
       a minute) so a late success still lands as a success. */
    var cartBusy = false, cartPending = 'Añadiendo';
    function cartAdd(btn, id) {
      cartBusy = true; cartPending = 'Añadiendo';
      var t0 = Date.now(), stale = document.getElementById('cart-notification'), slowSaid = false, pollT = 0, watch = null;
      function stop() {
        cartBusy = false;
        clearTimeout(pollT);
        window.removeEventListener('cart:updated', onAdd);
        if (watch) { watch.disconnect(); watch = null; }
      }
      function ok() {
        if (!cartBusy) return;
        stop();
        // the coin follows the stamp by 160 ms, as before, or lands with the real result
        setTimeout(function () {
          sfx('coin');
          toast('Carrito', { value: '+1' });
          shake(5, 260);
          assist('cartOk');
        }, Math.max(0, 160 - (Date.now() - t0)));
      }
      function failed() {
        if (!cartBusy) return;
        stop();
        sfx('back');
        toast('Carrito', { value: 'No se pudo', warn: true });
        assist('cartError');
      }
      function onAdd(e) { var d = e.detail || {}; if (d.action === 'add' && (!d.itemId || d.itemId === id)) ok(); }
      window.addEventListener('cart:updated', onAdd);
      /* The cart can insert its error notification and replace it with
         another one in the same tick (when the session is already in the
         cart), so the error is caught as it is inserted, not polled. Lives
         only for this add: stop() disconnects it. */
      if (window.MutationObserver) {
        watch = new MutationObserver(function (recs) {
          for (var i = 0; i < recs.length; i++) {
            var add = recs[i].addedNodes;
            for (var j = 0; j < add.length; j++) {
              var n = add[j];
              if (n.nodeType === 1 && n.id === 'cart-notification' && /cart-notification-error/.test(n.className)) { failed(); return; }
            }
          }
        });
        watch.observe(document.body, { childList: true });
      }
      sfx('stamp');
      // pending, replaced in place by the outcome (or by "En camino" at 8 s, without blinking off)
      toast('Carrito', { value: 'Añadiendo', ms: 9000 });
      try { btn.click(); } catch (x) { failed(); return; }
      (function poll() {
        if (!cartBusy) return;
        var n = document.getElementById('cart-notification');
        if (n && n !== stale && /cart-notification-error/.test(n.className)) { failed(); return; }
        var waited = Date.now() - t0;
        if (waited > 8000 && !slowSaid) {
          slowSaid = true; cartPending = 'En camino';
          toast('Carrito', { value: 'En camino', ms: 2400 });
          assist('cartSlow');
        }
        if (waited > 60000) { stop(); return; }   // stop listening quietly; never claim a failure we did not see
        pollT = setTimeout(poll, 200);
      })();
    }
    drag(rail, {
      axis: 'y',
      begin: function () { rail.classList.add('is-dragging'); },
      move: function (d) { layout(d * 0.9); },
      end: function (d, v) {
        rail.classList.remove('is-dragging');
        if (flung(d, v, rail.clientHeight)) move(d < 0 ? 1 : -1); else layout();
      }
    });
    grid.addEventListener('click', function (e) {
      var day = e.target.closest('[data-day]');
      if (!day) return;
      for (var i = 0; i < list.length; i++) if (list[i].fecha === day.getAttribute('data-day')) { if (i !== idx) { idx = i; sfx('nav'); layout(); } return; }
    });
    var ro = new ResizeObserver(function () { el.classList.toggle('is-compact', el.clientHeight < 300); });
    ro.observe(el);
    return {
      el: el, title: 'FECHAS',
      enter: function () { build(); idx = clamp(idx, 0, Math.max(0, list.length - 1)); layout(); },
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'up' || key === 'left') move(-1);
        else if (key === 'down' || key === 'right') move(1);
        else if (key === 'a') reserve();
        else if (key === 'b') { sfx('back'); go(launcher); }
      },
      preview: function (ctx, w, h, t) {
        // a flat month grid with the session days picked out
        // square cells, centred, starting under the card's tag (a tall phone
        // screen stretched them into bars and the tag covered 1-2)
        var cols = 7, rows = 5, pad = Math.min(w, h) * 0.12, top = Math.max(pad, 44);
        var cw = Math.min((w - pad * 2) / cols, (h - top - pad) / rows), ch = cw;
        var gx = (w - cw * cols) / 2, gy = top;
        var data = fechasData(), marked = {};
        data.forEach(function (x) { if (x.fecha) marked[+x.fecha.slice(8, 10)] = true; });
        var hot = Object.keys(marked).map(Number);
        var pulse = Math.floor(t * 1.4) % Math.max(1, hot.length || 1);
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
          var n = r * cols + c + 1;
          if (n > 31) continue;
          var x = gx + c * cw, y = gy + r * ch;
          var on = marked[n];
          rr(ctx, x + 2, y + 2, cw - 4, ch - 4, 4);
          ctx.fillStyle = on ? (hot[pulse] === n ? P.aztec : P.walnut) : 'rgba(13,22,29,.1)';
          ctx.fill();
          text(ctx, String(n), x + cw / 2, y + ch / 2 + 1, { size: Math.max(9, ch * 0.34), align: 'center', baseline: 'middle', color: on ? P.yellow : 'rgba(13,22,29,.55)' });
        }
      }
    };
  }

  /* =============================================================
     PACKS app — prepaid packs sold by Entropical (webflow-packs.js).
     Tickets come from EntropicalPacks.listTypes(); A opens the buy
     modal (or the redeem modal on the last row), B goes back. The
     modals are page-level dialogs drawn over the console: while one
     is open the console ignores its own keys (see bindHardware) and
     when it closes the console takes focus back. Server data only
     ever goes in through textContent.
     ============================================================= */
  var packsCache = null;   // last list, for the launcher preview + ticker
  function packsApi() { var E = window.EntropicalPacks; return E && typeof E.listTypes === 'function' ? E : null; }
  function packModalOpen() { return !!document.querySelector('.ep-backdrop'); }
  function plural(n, one, many) { return n === 1 ? '1 ' + one : n + ' ' + many; }
  function packPrice(ty) {
    if (typeof ty.priceCents !== 'number') return 'Consultar';
    return (ty.priceCents / 100).toLocaleString('es-ES', { minimumFractionDigits: ty.priceCents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
  }
  function packValidity(ty) {
    var exp = ty.expiresAt ? new Date(ty.expiresAt) : null;
    if (exp && isNaN(exp.getTime())) exp = null;
    if (ty.expiryMode === 'FIXED_DATE' && exp) return 'Hasta el ' + exp.getDate() + ' ' + MESES[exp.getMonth()] + ' ' + exp.getFullYear();
    if (ty.validityDays) return 'Válido ' + ty.validityDays + ' días';
    return '';
  }
  function makePacks() {
    var el = makeView('pe-os_fechas pe-os_packs');
    el.innerHTML =
      '<div class="pe-os_cal-head"><span class="pe-os_cal-month">Packs</span><span class="pe-os_kicker" data-count></span></div>' +
      '<div class="pe-os_ticket-rail" data-rail aria-live="polite"></div>' +
      '<div class="pe-os_fechas-foot"><span class="pe-os_hint"><span><span class="pe-os_chip">' + ico('up') + ico('down') + '</span>Pack</span></span><span class="pe-os_hint"><span data-a-label><span class="pe-os_chip is-a">A</span>Comprar</span><span><span class="pe-os_chip is-b">B</span>Salir</span></span></div>';
    var rail = $('[data-rail]', el), countEl = $('[data-count]', el), aLabel = $('[data-a-label]', el);
    var rows = [], tickets = [], idx = 0, reqN = 0;

    function node(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
    function ticket(r) {
      var t = node('div', 'pe-os_ticket');
      var stub = node('div', 'pe-os_ticket-date' + (r.kind === 'pack' ? '' : ' is-soon'));
      var body = node('div', 'pe-os_ticket-body'), foot = node('div', 'pe-os_ticket-foot');
      if (r.kind === 'pack') {
        var ty = r.type, cr = typeof ty.credits === 'number' ? ty.credits : null, seats = ty.seatsPerCredit || 1;
        stub.appendChild(node('span', 'pe-os_ticket-mon', 'PACK'));
        stub.appendChild(node('span', 'pe-os_ticket-day', cr != null ? String(cr) : '·'));
        stub.appendChild(node('span', 'pe-os_ticket-mon', cr === 1 ? 'RESERVA' : 'RESERVAS'));
        body.appendChild(node('span', 'pe-os_ticket-type', seats > 1 ? 'Para ' + seats + ' personas' : 'Individual'));
        body.appendChild(node('span', 'pe-os_ticket-name', ty.name || 'Pack'));
        if (cr != null) body.appendChild(node('span', 'pe-os_ticket-meta', plural(cr, 'reserva', 'reservas') + ' de ' + plural(seats, 'plaza', 'plazas')));
        var v = packValidity(ty);
        if (v) body.appendChild(node('span', 'pe-os_ticket-meta', v));
        if (ty.description) body.appendChild(node('span', 'pe-os_ticket-lead', String(ty.description)));
        foot.appendChild(node('span', 'pe-os_ticket-price', packPrice(ty)));
        foot.appendChild(node('span', 'pe-os_ticket-meta', typeof ty.priceCents === 'number' ? 'También para regalar' : 'Te lo preparamos'));
      } else if (r.kind === 'redeem') {
        stub.appendChild(node('span', 'pe-os_ticket-mon', 'TENGO'));
        stub.appendChild(node('span', 'pe-os_ticket-day', 'ENT'));
        stub.appendChild(node('span', 'pe-os_ticket-mon', 'CÓDIGO'));
        body.appendChild(node('span', 'pe-os_ticket-type', 'Canjear'));
        body.appendChild(node('span', 'pe-os_ticket-name', 'Canjear código'));
        body.appendChild(node('span', 'pe-os_ticket-meta', 'Reserva con tu pack y elige fecha.'));
      } else {
        stub.appendChild(node('span', 'pe-os_ticket-day', '—'));
        body.appendChild(node('span', 'pe-os_ticket-name', r.title));
        if (r.meta) body.appendChild(node('span', 'pe-os_ticket-meta', r.meta));
      }
      t.appendChild(stub); t.appendChild(body); t.appendChild(foot);
      t.addEventListener('click', function () {
        var i = tickets.indexOf(t);
        if (i === idx) act(); else { idx = i; sfx('nav'); layout(); }
      });
      return t;
    }
    function render() {
      rail.textContent = '';
      tickets = rows.map(function (r) { var t = ticket(r); rail.appendChild(t); return t; });
      idx = clamp(idx, 0, Math.max(0, rows.length - 1));
      layout();
    }
    function layout(dragPx) {
      tickets.forEach(function (t, i) {
        var o = i - idx;
        t.style.transform = 'translateY(calc(' + (o * 108) + '% + ' + (dragPx || 0) + 'px)) scale(' + (o === 0 ? 1 : 0.94) + ')';
        t.style.opacity = Math.abs(o) > 1 ? '0' : (o === 0 ? '1' : '0.4');
      });
      var packsN = rows.filter(function (r) { return r.kind === 'pack'; }).length;
      countEl.textContent = packsN ? ((Math.min(idx, packsN - 1) + 1) + ' / ' + packsN) : '';
      var r = rows[idx], label = 'Comprar';
      if (!r || r.kind === 'msg') label = r && r.action === 'retry' ? 'Reintentar' : (r && r.action === 'web' ? 'Ver web' : '');
      else if (r.kind === 'redeem') label = 'Canjear';
      else if (typeof r.type.priceCents !== 'number') label = 'Consultar';
      aLabel.style.visibility = label ? '' : 'hidden';
      aLabel.innerHTML = '<span class="pe-os_chip is-a">A</span>' + esc(label);
    }
    function load() {
      var E = packsApi();
      if (!E) {
        rows = [{ kind: 'msg', title: 'Packs no disponibles', meta: 'Míralos en la web. Pulsa A.', action: 'web' }];
        render(); return;
      }
      rows = [{ kind: 'msg', title: 'Cargando packs…', meta: 'Un momento.' }];
      render();
      var my = ++reqN;
      function fail() {
        if (my !== reqN) return;
        rows = [{ kind: 'msg', title: 'No hemos podido cargar los packs', meta: 'Pulsa A para reintentar.', action: 'retry' }, { kind: 'redeem' }];
        render();
      }
      E.listTypes().then(function (list) {
        if (my !== reqN) return;
        if (!list) { fail(); return; }
        packsCache = list;
        rows = list.map(function (ty) { return { kind: 'pack', type: ty }; });
        if (!rows.length) rows.push({ kind: 'msg', title: 'Nuevos packs muy pronto', meta: 'Mientras, puedes canjear el tuyo.' });
        rows.push({ kind: 'redeem' });
        render();
      }, fail);
    }
    function move(d) {
      if (!rows.length) return;
      var n = clamp(idx + d, 0, rows.length - 1);
      if (n === idx) { shake(3, 180); sfx('click'); return; }
      idx = n; sfx('nav'); layout();
    }
    // the modal is the page's: when it goes away the console takes focus back
    function watchClose() {
      if (!window.MutationObserver) return;
      var mo = new MutationObserver(function () {
        if (packModalOpen()) return;
        mo.disconnect();
        var a = $('[data-pe-key="a"]', root);
        if (a) { try { a.focus({ preventScroll: true }); } catch (e) {} }
      });
      mo.observe(document.body, { childList: true });
    }
    function openWith(fn, evt) {
      sfx('open');
      try { fn(); } catch (e) {}
      if (!packModalOpen()) { sfx('back'); toast('Packs', { value: 'No se pudo', warn: true }); return; }
      assist(evt);
      watchClose();
    }
    function act() {
      var r = rows[idx];
      if (!r) return;
      if (r.kind === 'msg') {
        if (r.action === 'retry') { sfx('ok'); load(); }
        else if (r.action === 'web') { sampleSoon('gamestart'); playWake(function () { location.href = 'packs.html'; }); }
        else { shake(3, 180); sfx('click'); }
        return;
      }
      var E = packsApi();
      if (!E) { load(); return; }
      if (r.kind === 'redeem') openWith(function () { E.openRedeem({}); }, 'packRedeem');
      else openWith(function () { E.openBuy(r.type.slug); }, 'packBuy');
    }
    drag(rail, {
      axis: 'y',
      begin: function () { rail.classList.add('is-dragging'); },
      move: function (d) { layout(d * 0.9); },
      end: function (d, v) {
        rail.classList.remove('is-dragging');
        if (flung(d, v, rail.clientHeight)) move(d < 0 ? 1 : -1); else layout();
      }
    });
    var ro = new ResizeObserver(function () { el.classList.toggle('is-compact', el.clientHeight < 300); });
    ro.observe(el);
    // a credit spent anywhere on the page (this view's redeem modal, the cart)
    window.addEventListener('entropical:pack-redeemed', function () {
      if (current !== view) return;
      sfx('coin');
      toast('Pack', { value: 'Reservado' });
      assist('packRedeemed');
    });
    var view = {
      el: el, title: 'PACKS',
      enter: function () { load(); },
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'up' || key === 'left') move(-1);
        else if (key === 'down' || key === 'right') move(1);
        else if (key === 'a') act();
        else if (key === 'b') { sfx('back'); go(launcher); }
      },
      preview: function (ctx, w, h, t) {
        // three flat tickets in a stack, the front one breathing
        var m = Math.min(w, h), tw = Math.min(w * 0.66, m * 1.2), th = Math.min(h * 0.3, tw * 0.42);
        var top = Math.max(44, h * 0.22), x0 = (w - tw) / 2;
        for (var i = 2; i >= 0; i--) {
          var lift = i === 0 ? (Math.sin(t * 2) * 0.5 + 0.5) * 3 : 0;
          var x = x0 + i * m * 0.035, y = top + (2 - i) * th * 0.3 - lift;
          rr(ctx, x, y + 3, tw, th, 8); ctx.fillStyle = P.aztec; ctx.fill();
          rr(ctx, x, y, tw, th, 8); ctx.fillStyle = i === 0 ? P.aztec2 : P.walnut; ctx.fill();
          var sw = tw * 0.32;
          rr(ctx, x, y, sw, th, 8); ctx.fillStyle = i === 0 ? P.yellow : P.fawn; ctx.fill();
          ctx.fillRect(x + sw - 8, y, 8, th);
          ctx.fillStyle = P.aztec;
          for (var k = 0; k < 6; k++) ctx.fillRect(x + sw - 1, y + th * (k + 0.25) / 6, 2, th / 12);
          if (i === 0) {
            text(ctx, '×3', x + sw / 2, y + th / 2, { size: Math.max(10, th * 0.34), weight: 700, align: 'center', baseline: 'middle', color: P.aztec });
            text(ctx, 'PACK', x + sw + (tw - sw) / 2, y + th / 2, { size: Math.max(9, th * 0.24), weight: 700, align: 'center', baseline: 'middle', color: P.white, spacing: 2 });
          }
        }
      }
    };
    return view;
  }

  /* =============================================================
     AJUSTES — grouped settings, scrolls with the selection
     ============================================================= */
  var clicksOn = store('pe-con-clicks') !== '0';
  var hapticsOn = store('pe-con-haptics') !== '0';
  var lcdOn = store('pe-con-lcd') !== '0';
  var buddyOn = store('pe-con-buddy') !== '0';
  function haptic(ms) { if (hapticsOn && navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } }
  function applyLcd() { if (screenEl) screenEl.setAttribute('data-lcd', lcdOn ? 'on' : 'off'); }

  function makeAjustes() {
    var el = makeView('pe-os_menuview');
    el.innerHTML = '<div class="pe-os_flist" data-list></div>';
    var listEl = $('[data-list]', el);
    var confirmReset = false;
    var rows = [
      { head: 'Sonido' },
      { id: 'sound', label: 'Sonido', type: 'toggle', desc: 'Todo el sonido de la consola. También con la tecla SONIDO.',
        get: function () { return sound; }, set: function () { setSound(!sound); } },
      { id: 'vol', label: 'Volumen', type: 'meter', max: 10, desc: 'O gira la rueda del lateral.',
        get: function () { return volume; }, step: function (d) { setVolume(volume + d, true); } },
      { id: 'clicks', label: 'Clic de teclas', type: 'toggle', desc: 'El clic mecánico al pulsar cada botón.',
        get: function () { return clicksOn; }, set: function () { clicksOn = !clicksOn; store('pe-con-clicks', clicksOn ? '1' : '0'); if (clicksOn) sfx('click'); assist(clicksOn ? 'clicksOn' : 'clicksOff'); } },
      { id: 'haptics', label: 'Vibración', type: 'toggle', desc: navigator.vibrate ? 'Un toque al pulsar, en el móvil.' : 'Tu dispositivo no vibra.',
        get: function () { return hapticsOn; }, set: function () { hapticsOn = !hapticsOn; store('pe-con-haptics', hapticsOn ? '1' : '0'); haptic(20); assist(hapticsOn ? 'hapticsOn' : 'hapticsOff'); } },
      { head: 'Música' },
      { id: 'music', label: 'Música', type: 'toggle', desc: 'La música de la web. También desde la pantallita de arriba.',
        get: function () { return !!(window.PEMusic && window.PEMusic.playing()); }, set: function () { if (window.PEMusic) { musicAskedAt = Date.now(); window.PEMusic.toggle(); } } },
      { id: 'mvol', label: 'Volumen música', type: 'meter', max: 10, desc: 'Solo la música; los sonidos de la consola van aparte.',
        get: function () { return window.PEMusic ? Math.round(window.PEMusic.volume() * 10) : 0; },
        step: function (d) { if (window.PEMusic) { window.PEMusic.volume((Math.round(window.PEMusic.volume() * 10) + d) / 10); sfx('tick', 6); } } },
      { id: 'song', label: 'Siguiente canción', type: 'action', get desc() { return 'Suena: ' + (window.PEMusic ? window.PEMusic.track().title : '—') + '.'; },
        run: function () { if (window.PEMusic) { musicAskedAt = Date.now(); window.PEMusic.next(); sfx('nav'); } } },
      { head: 'Pantalla' },
      { id: 'bright', label: 'Brillo', type: 'meter', max: 5, desc: 'O usa el interruptor BRILLO junto al asistente.',
        get: function () { return bright; }, step: function (d) { bright = clamp(bright + d, 0, 5); store('pe-con-bright', bright); applyBright(); sfx('tick', bright * 2); assist(bright ? 'bright' : 'brightOff', { n: bright }); } },
      { id: 'pixel', label: 'Píxeles', type: 'toggle', desc: 'Los juegos en píxeles gordos, como una consola de verdad.',
        get: function () { return pixelOn; }, set: function () { pixelOn = !pixelOn; store('pe-con-pixel', pixelOn ? '1' : '0'); sfx('tick', 6); assist(pixelOn ? 'pixelOn' : 'pixelOff'); } },
      { id: 'lcd', label: 'Líneas LCD', type: 'toggle', desc: 'La trama de líneas de una pantalla de verdad.',
        get: function () { return lcdOn; }, set: function () { lcdOn = !lcdOn; store('pe-con-lcd', lcdOn ? '1' : '0'); applyLcd(); sfx('tick', 6); assist(lcdOn ? 'lcdOn' : 'lcdOff'); } },
      { id: 'buddy', label: 'Asistente', type: 'toggle', desc: 'Apagado, la pantalla pequeña muestra la hora.',
        get: function () { return buddyOn; }, set: function () { buddyOn = !buddyOn; store('pe-con-buddy', buddyOn ? '1' : '0'); buddy.setEnabled(buddyOn); sfx('tick', 6); if (buddyOn) assist('buddyOn'); } },
      { head: 'Sistema' },
      { id: 'entropy', label: 'Modo entropía', type: 'toggle', desc: 'Desordena la página. También con el interruptor ORDEN / CAOS.',
        get: function () { return !!(window.__peEntropy && window.__peEntropy.active()); }, set: function () { toggleEntropy(); } },
      { id: 'records', label: 'Récords', type: 'action', desc: 'Tus mejores puntuaciones en cada juego.',
        run: function () { sfx('open'); go(recordsView); } },
      { id: 'reset', label: 'Borrar récords', type: 'action', desc: 'Pulsa dos veces para confirmar.',
        run: function () {
          if (!confirmReset) { confirmReset = true; sfx('nav'); return; }
          GAMES.forEach(function (g) { try { localStorage.removeItem('pe-con-best-' + g.id); } catch (e) {} });
          confirmReset = false; sfx('stamp'); toast('Récords borrados'); assist('recordsReset');
        } },
      { id: 'about', label: 'Acerca de PE—83', type: 'action', desc: 'Qué es esta consola.',
        run: function () { sfx('open'); go(aboutView); } }
    ];
    // menu-only console (sub-pages: no music, no Modo Entropía): drop those rows
    if (menuOnly()) rows = rows.filter(function (r) {
      var k = r.id || r.head;
      if (!MENU_ONLY_DROP[k]) return true;
      // keep the music rows when pe-music.js is on the page, the entropy row when entropy-mode.js is
      return k === 'entropy' ? hasScript('entropy-mode') : hasScript('pe-music');
    });
    var selectable = rows.filter(function (r) { return !r.head; });
    var sel = 0;

    function valueHTML(r) {
      if (r.type === 'toggle') { var on = r.get(); return '<span class="pe-os_sw" data-on="' + (on ? '1' : '0') + '"><i></i></span>'; }
      if (r.type === 'meter') return meter(r.get(), r.max);
      if (r.id === 'reset' && confirmReset) return '<span class="pe-os_set-warn">¿Seguro?</span>';
      return '<span class="pe-os_set-go">' + ico('right') + '</span>';
    }
    function render() {
      listEl.innerHTML = selectable.map(function (r, i) {
        var on = i === sel;
        return '<div class="pe-os_list-item' + (on ? ' is-sel' : '') + '" data-i="' + i + '">' +
          '<span class="pe-os_list-num">' + ('0' + (i + 1)).slice(-2) + '</span>' +
          '<span class="pe-os_list-main"><span>' + esc(r.label) + '</span>' + (on ? '<span class="pe-os_list-desc">' + esc(r.desc) + '</span>' : '') + '</span>' +
          '<span class="pe-os_list-val">' + valueHTML(r) + '</span></div>';
      }).join('');
      // keep the selected row in view (layout reads are cheap inside the shadow root)
      var rowEl = $('.pe-os_list-item.is-sel', listEl);
      if (rowEl) {
        var top = rowEl.offsetTop, bottom = top + rowEl.offsetHeight, view = listEl.clientHeight, sc = listEl.scrollTop;
        if (top < sc) listEl.scrollTop = top;
        else if (bottom > sc + view) listEl.scrollTop = bottom - view;
      }
    }
    // touch: a tap acts at once (toggle flips, action runs); a meter takes
    // the segment you tapped, or steps up (wrapping) when tapped elsewhere
    listEl.addEventListener('click', function (e) {
      var row = e.target.closest('[data-i]');
      if (!row) return;
      sel = +row.getAttribute('data-i');
      var r = selectable[sel], seg = e.target.closest('.pe-os_meter i');
      if (r.type === 'meter') {
        var v = seg ? +seg.getAttribute('data-v') : (r.get() >= r.max ? 1 : r.get() + 1);
        if (v !== r.get()) r.step(v - r.get());
        render();
        return;
      }
      change(1);
    });
    function change(d) {
      var r = selectable[sel];
      if (r.id !== 'reset') confirmReset = false;
      if (r.type === 'toggle') r.set();
      else if (r.type === 'meter') r.step(d);
      else if (d > 0) r.run();
      render();
    }
    return {
      el: el, title: 'AJUSTES',
      enter: function () { confirmReset = false; render(); },
      refresh: render,
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'up') { sel = (sel + selectable.length - 1) % selectable.length; confirmReset = false; sfx('nav'); render(); }
        else if (key === 'down') { sel = (sel + 1) % selectable.length; confirmReset = false; sfx('nav'); render(); }
        else if (key === 'left') change(-1);
        else if (key === 'right' || key === 'a') change(1);
        else if (key === 'b') { sfx('back'); go(launcher); }
      },
      preview: function (ctx, w, h, t) {
        var n = 3, gap = h * 0.08, bh = (h - gap * (n + 1)) / n;
        for (var i = 0; i < n; i++) {
          var y = gap + i * (bh + gap);
          rr(ctx, w * 0.12, y + bh * 0.4, w * 0.76, bh * 0.2, bh * 0.1);
          ctx.fillStyle = P.walnutDark; ctx.fill();
          var k = 0.5 + Math.sin(t * (0.7 + i * 0.35) + i * 2) * 0.38;
          rr(ctx, w * 0.12 + w * 0.76 * k - bh * 0.35, y + bh * 0.1, bh * 0.7, bh * 0.8, bh * 0.16);
          ctx.fillStyle = i === 1 ? P.yellow : P.white; ctx.fill();
        }
      }
    };
  }

  // Récords (from Ajustes): every game's best, with a bar against the top score
  var recordsView = null, aboutView = null;
  function makeRecords() {
    var el = makeView('pe-os_menuview');
    return {
      el: el, title: 'RÉCORDS',
      enter: function () {
        var list = GAMES.map(function (g) { return { t: g.title, b: parseInt(store('pe-con-best-' + g.id) || '0', 10) || 0 }; });
        el.innerHTML = '<div class="pe-os_flist">' + list.map(function (x, i) {
          return '<div class="pe-os_list-item"><span class="pe-os_list-num">' + ('0' + (i + 1)).slice(-2) + '</span>' +
            '<span class="pe-os_list-main"><span>' + esc(x.t) + '</span></span><span class="pe-os_list-val is-num">' + (x.b || '—') + '</span></div>';
        }).join('') + '</div>';
      },
      input: function (key, type) { if (type === 'down' && (key === 'b' || key === 'a')) { sfx('back'); go(ajustesView); } }
    };
  }
  function makeAbout() {
    var el = makeView('pe-os_ajustes');
    el.innerHTML = '<span class="pe-os_kicker">Acerca de</span>' +
      '<div class="pe-os_about"><div class="pe-os_about-title">PE—83</div>' +
      '<p>Sistema de entropía culinaria de Presunta Entropía. Seis juegos, las próximas fechas y un asistente que no se calla.</p>' +
      '<p>Zurbano 83 · Madrid</p><p class="pe-os_about-dim">Versión 1.0 · Hecho con orden y un poco de caos.</p></div>' +
      '<span class="pe-os_hint"><span><span class="pe-os_chip is-b">B</span>Volver</span></span>';
    return {
      el: el, title: 'ACERCA DE',
      input: function (key, type) { if (type === 'down' && (key === 'b' || key === 'a')) { sfx('back'); go(ajustesView); } }
    };
  }
  var ajustesView = null;

  /* =============================================================
     CHAT — the site chat (Vanny) mounted INSIDE the screen while the
     console is on screen. It mounts into a light-DOM element slotted into
     the screen (the widget looks its target up with document.querySelector).
     Loaded on first open. The floating ¿Hablamos? stays for the rest of the
     page (hidden while the console is in view).
     ============================================================= */
  var chatSlot = null, chatState = 'idle', savedVanny = null;
  function makeChat() {
    var el = makeView('pe-os_chat');
    el.innerHTML = '<div class="pe-os_chat-frame"><slot name="chat"></slot></div>' +
      '<div class="pe-os_chat-wait" data-wait><span class="pe-os_kicker">Chat</span><div class="pe-os_panel-sub" data-wait-msg>Conectando con Presunta…</div></div>';
    var wait = $('[data-wait]', el), waitMsg = $('[data-wait-msg]', el);
    function ready() { wait.setAttribute('data-hidden', '1'); }
    function load() {
      if (chatState !== 'idle') return;
      chatState = 'loading';
      savedVanny = window.Vanny ? { open: window.Vanny.open, close: window.Vanny.close, toggle: window.Vanny.toggle } : null;
      var sc = document.createElement('script');
      sc.src = 'https://vanny.chat/vanny-widget.js';
      sc.async = true;
      sc.setAttribute('data-tenant', 'presunta-entropia');
      sc.setAttribute('data-mode', 'inline');
      sc.setAttribute('data-target', '[data-pe-chat-slot]');
      sc.onload = function () {
        // the second widget instance must not hijack the page's own Vanny api
        if (savedVanny && window.Vanny) { window.Vanny.open = savedVanny.open; window.Vanny.close = savedVanny.close; window.Vanny.toggle = savedVanny.toggle; }
      };
      sc.onerror = function () { chatState = 'failed'; waitMsg.textContent = 'El chat no responde ahora. Prueba desde el botón ¿Hablamos? de la web.'; };
      document.body.appendChild(sc);
      var t0 = Date.now();
      (function poll() {
        var fr = chatSlot.querySelector('iframe');
        if (fr) { chatState = 'ready'; fr.addEventListener('load', ready); setTimeout(ready, 1500); return; }
        if (Date.now() - t0 > 8000) { chatState = 'failed'; waitMsg.textContent = 'El chat no responde ahora. Prueba desde el botón ¿Hablamos? de la web.'; return; }
        setTimeout(poll, 200);
      })();
    }
    return {
      el: el, title: 'CHAT',
      enter: function () { load(); assist('chat'); },
      input: function (key, type) { if (type === 'down' && key === 'b') { sfx('back'); go(launcher); } },
      preview: function (ctx, w, h, t) {
        // flat speech blocks, straight
        var pad = Math.min(w, h) * 0.12, bw = w - pad * 2;
        var lines = [[0.62, P.white, 0], [0.48, P.yellow, 1], [0.7, P.white, 0]];
        lines.forEach(function (l, i) {
          var y = pad + i * h * 0.26, ww = bw * l[0], x = l[2] ? w - pad - ww : pad;
          var show = Math.min(1, Math.max(0, (t % 4.5) - i * 0.7) * 2);
          if (show <= 0) return;
          rr(ctx, x, y + (1 - ease.outCubic(show)) * 8, ww, h * 0.17, 6);
          ctx.fillStyle = l[1]; ctx.fill();
          ctx.fillStyle = l[1] === P.white ? P.cream3 : P.yellowDark;
          for (var k = 0; k < 3; k++) ctx.fillRect(x + 10, y + h * 0.05 + k * h * 0.04 + (1 - ease.outCubic(show)) * 8, ww * (0.7 - k * 0.2), 2);
        });
      }
    };
  }

  // full-screen list, old-terminal style: every row stretches to fill the screen
  function listHTML(labels, sel) {
    return labels.map(function (l, i) {
      return '<div class="pe-os_list-item' + (i === sel ? ' is-sel' : '') + '" data-i="' + i + '">' +
        '<span class="pe-os_list-num">' + ('0' + (i + 1)).slice(-2) + '</span><span>' + esc(l) + '</span><span class="pe-os_list-arrow">' + ico('left') + '</span></div>';
    }).join('');
  }

  /* =============================================================
     NAVEGAR — the site menu on the console screen. Rows are read from
     the page's own fullscreen menu (.navbar_menu .navbar18_link), so the
     two never drift. Three presentations (PEConsole.nav(mode)):
       'inplace' hero on screen (desktop): the console screen becomes the menu
       'side'    scrolled (desktop): the fullscreen menu opens and the console
                 slides in from the right, synced with the big links
       'sheet'   phones: the console IS the fullscreen menu. It rises from the
                 bottom over a solid page cover; CERRAR sits in the screen's
                 status bar and JUGAR Y MÁS (pinned under the links) opens the
                 launcher without leaving the menu
     ============================================================= */
  var navView = null, navMode = null, navPrev = null;
  function navLinks() {
    // [data-pe-nav]: extra menu entries outside the big link list (Canjear pack)
    return $$('.navbar_menu .navbar18_link, .navbar_menu [data-pe-nav]').map(function (a) {
      var href = a.getAttribute('href') || '#';
      var here = href !== '#' && location.pathname.split('/').pop() === href.split('?')[0];
      return { label: (a.getAttribute('data-pe-nav') || a.textContent).trim(), el: a, href: href, modal: a.hasAttribute('data-modal-open') || a.hasAttribute('data-entropical-pack-redeem-open'), here: here };
    });
  }
  function makeNav() {
    var el = makeView('pe-os_menuview');
    el.innerHTML = '<div class="pe-os_flist" data-list></div>';
    var listEl = $('[data-list]', el), items = [], sel = 0, onSel = null;
    function build() {
      items = navLinks();
      items.push({ label: 'Jugar y más', play: true });
      el.classList.toggle('is-sheet', navMode === 'sheet');
      sel = Math.max(0, items.findIndex ? items.findIndex(function (x) { return x.here; }) : 0);
      if (sel < 0) sel = 0;
    }
    function render() {
      listEl.innerHTML = items.map(function (it, i) {
        if (it.play) {
          return '<div class="pe-os_list-item is-play' + (i === sel ? ' is-sel' : '') + '" data-i="' + i + '">' +
            '<span class="pe-os_play-btn">' + ico('play') + '<span>' + esc(it.label) + '</span></span></div>';
        }
        return '<div class="pe-os_list-item' + (i === sel ? ' is-sel' : '') + '" data-i="' + i + '">' +
          '<span class="pe-os_list-num">' + ('0' + (i + 1)).slice(-2) + '</span>' +
          '<span class="pe-os_list-main"><span>' + esc(it.label) + '</span></span>' +
          '<span class="pe-os_list-val">' + (it.here ? 'Aquí' : '') + '</span></div>';
      }).join('');
      var rowEl = $('.pe-os_list-item.is-sel', listEl);
      if (rowEl && !rowEl.classList.contains('is-play')) {
        var top = rowEl.offsetTop, bottom = top + rowEl.offsetHeight, view = listEl.clientHeight, sc = listEl.scrollTop;
        if (top < sc) listEl.scrollTop = top;
        else if (bottom > sc + view) listEl.scrollTop = bottom - view;
      }
      if (onSel) onSel(items[sel]);
    }
    function choose(i) {
      var it = items[i];
      if (!it) return;
      if (it.play) { sfx('open'); go(launcher); return; }
      if (it.here) { sfx('back'); closeNav(); return; }
      if (it.modal) { sfx('open'); closeNav(); setTimeout(function () { it.el.click(); }, 60); return; }
      sampleSoon('gamestart');
      playWake(function () { location.href = it.href; });
    }
    listEl.addEventListener('click', function (e) {
      var row = e.target.closest('[data-i]');
      if (!row) return;
      var i = +row.getAttribute('data-i');
      if (i !== sel) { sel = i; sfx('nav'); render(); }
      choose(i);
    });
    return {
      el: el, title: 'NAVEGAR',
      enter: function () { build(); render(); },
      refresh: render,
      setOnSelect: function (fn) { onSel = fn; },
      selectHref: function (href) {
        for (var i = 0; i < items.length; i++) if (items[i].href === href) { if (i !== sel) { sel = i; render(); } return; }
      },
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'up') { sel = (sel + items.length - 1) % items.length; sfx('nav'); render(); }
        else if (key === 'down') { sel = (sel + 1) % items.length; sfx('nav'); render(); }
        else if (key === 'a') choose(sel);
        else if (key === 'b') { sfx('back'); closeNav(); }
      }
    };
  }

  // ---- docking: the one console instance leaves its slot and comes back ----
  var dockPh = null, dockBackdrop = null, dockKind = null, closeKey = null;
  function dock(kind) {
    if (dockKind) return;
    var r = hostEl.getBoundingClientRect();
    dockKind = kind;
    if (r.height > 0) {                       // phones hide the hero console: no slot to hold
      dockPh = document.createElement('div');
      dockPh.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;';
      hostEl.parentNode.insertBefore(dockPh, hostEl);
    }
    var s = 1;
    if (kind === 'side') {
      hostEl.style.width = r.width + 'px';
      hostEl.style.height = r.height + 'px';
      s = sideLayout(r);
    }
    hostEl.classList.add('pe-dock', 'pe-dock--' + kind);
    if (kind === 'sheet') {
      // the console at its own phone width, scaled to fit the screen height
      var vw = document.documentElement.clientWidth;
      hostEl.style.width = Math.min(440, vw - 24) + 'px';
      hostEl.style.height = '';
      s = Math.min(1, (window.innerHeight - 24) / Math.max(1, hostEl.offsetHeight));
      if (!dockBackdrop) {
        dockBackdrop = document.createElement('div');
        dockBackdrop.className = 'pe-dock-backdrop';
        dockBackdrop.addEventListener('click', function () { closeNav(); });
        document.body.appendChild(dockBackdrop);
      }
      requestAnimationFrame(function () { dockBackdrop.classList.add('is-on'); });
      document.documentElement.classList.add('pe-menu-sheet');
    }
    hostEl.style.setProperty('--dock-s', s.toFixed(3));
    screenEl.classList.toggle('is-docked', kind === 'sheet');
    armed = true;
    // commit the off-screen start pose without a transition (otherwise it
    // animates from the in-page 'none' and the slide never starts off-screen)
    hostEl.style.transition = 'none';
    void hostEl.offsetWidth;
    hostEl.style.transition = '';
    requestAnimationFrame(function () { requestAnimationFrame(function () { hostEl.classList.add('is-in'); }); });
  }
  /* Side dock: the console owns a full-height right column framed like the
     menu (24px). The menu's RESERVAR AHORA + CERRAR move into a row beside
     the logo and the socials end the address row, both inside the left
     zone (pe-console.css, html.pe-menu-side). The scale is the largest that
     fills the height without the zone getting narrower than the logo row
     or the longest link. */
  function sideLayout(r) {
    var vw = document.documentElement.clientWidth;
    var closeEl = document.querySelector('.navbar_menu-close-button-wrapper');
    var ctaEl = document.querySelector('.menu_reservar-cta');
    var logoEl = document.querySelector('.navbar_menu .menu_fullscreen-icon');
    var closeW = closeEl ? closeEl.offsetWidth : 0, ctaW = ctaEl ? ctaEl.offsetWidth : 0;
    var need = (logoEl ? logoEl.getBoundingClientRect().right : 48) + 32 + ctaW + 12 + closeW;
    $$('.navbar_menu .navbar18_link').forEach(function (a) {
      var rg = document.createRange();
      rg.selectNodeContents(a);
      need = Math.max(need, rg.getBoundingClientRect().right);
    });
    var GAP = 48;
    // The parked menu-only console (inner pages) has a fixed 500px box, so on
    // narrower screens the width limit used to shrink it below full height,
    // under CERRAR. Like the home console (which reflows to its hero slot), it
    // narrows its own box until full height fits beside the menu.
    if (hostEl.hasAttribute('data-pe-menu-only')) {
      var sH = Math.min(1.25, (window.innerHeight - 48) / r.height);
      var maxW = Math.floor((vw - 24 - GAP - need) / sH);
      if (r.width > maxW) {
        var w = Math.max(260, maxW);
        hostEl.style.width = w + 'px';
        r = { width: w, height: r.height };
      }
    }
    var s = Math.min(1.25, (window.innerHeight - 48) / r.height, (vw - 24 - GAP - need) / r.width);
    s = Math.max(0.4, s);
    var de = document.documentElement;
    de.style.setProperty('--pe-zone-r', Math.round(r.width * s + GAP) + 'px');
    de.style.setProperty('--pe-close-w', closeW + 'px');
    de.classList.add('pe-menu-side');
    return s;
  }
  function undock() {
    if (!dockKind) return;
    var kind = dockKind;
    var de = document.documentElement;
    if (kind === 'side') {
      de.classList.remove('pe-menu-side');
      de.style.removeProperty('--pe-zone-r');
      de.style.removeProperty('--pe-close-w');
    }
    hostEl.classList.remove('is-in');
    if (dockBackdrop) dockBackdrop.classList.remove('is-on');
    screenEl.classList.remove('is-docked');
    setTimeout(function () {
      hostEl.classList.remove('pe-dock', 'pe-dock--' + kind);
      hostEl.style.width = ''; hostEl.style.height = '';
      if (dockPh) { dockPh.remove(); dockPh = null; }
      de.classList.remove('pe-menu-sheet');
      dockKind = null;
    }, 560);
  }
  // CERRAR inside the screen's status bar (shown while the console is the
  // phone menu): big, yellow, always in the same spot whatever app is open
  function makeCloseKey() {
    var bar = $('.pe-os_status-right', root);
    if (!bar) return;
    closeKey = document.createElement('button');
    closeKey.type = 'button';
    closeKey.className = 'pe-os_close';
    closeKey.setAttribute('aria-label', 'Cerrar menú');
    closeKey.innerHTML = '<span>Cerrar</span>' + ico('close');
    closeKey.addEventListener('click', function (e) { e.stopPropagation(); sfx('back'); closeNav(); });
    bar.appendChild(closeKey);
  }
  /* Every on-screen hint is a button: "A Abrir", "B Salir", the arrow
     chips (each arrow on its own). Same path as the hardware keys. */
  function tapKey(k) { press(k, 'tap'); release(k); }
  var TAP_KEYS = { a: 1, b: 1, up: 1, down: 1, left: 1, right: 1 };
  function bindHintTaps() {
    stage.addEventListener('click', function (e) {
      var unit = e.target.closest('.pe-os_hint > span');
      var chip = unit && unit.querySelector('.pe-os_chip');
      if (!chip) return;
      var k = chip.classList.contains('is-a') ? 'a' : chip.classList.contains('is-b') ? 'b' : null;
      if (!k) {
        var svg = e.target.closest('svg[data-i]') || chip.querySelector('svg[data-i]:last-child');
        k = svg && svg.getAttribute('data-i');
      }
      if (!k || !TAP_KEYS[k]) return;
      e.stopPropagation();
      tapKey(k);
    });
  }
  // back arrow in the status bar: any screen you can leave, except games
  // (their B is a game action; MENÚ pauses them)
  var backBtn = null, backOn = false;
  function makeBackKey() {
    var bar = $('.pe-os_status', root);
    if (!bar) return;
    backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'pe-os_back';
    backBtn.setAttribute('aria-label', 'Atrás');
    backBtn.innerHTML = ico('left');
    backBtn.addEventListener('click', function (e) { e.stopPropagation(); tapKey('b'); });
    bar.insertBefore(backBtn, bar.firstChild);
  }
  function syncBack() {
    if (!backBtn) return;
    var on = booted && (sysmenu.open || !!(current && current !== launcher && current !== attract && !current.def &&
      !(current === navView && dockKind === 'sheet')));
    if (on !== backOn) { backOn = on; backBtn.classList.toggle('is-on', on); }
  }
  // opening as the menu shows the menu straight away, without the power-on
  function bootNow() {
    if (booted) return;
    ledEl.classList.add('is-on');
    offEl.classList.add('is-gone');
    booted = true;
  }
  function openNav(mode) {
    // MENU is a deliberate request: wake the screen first, or the resting
    // saver (or a switched-off screen) stays on top and hides the menu
    consoleIdle = 0; restT = 0; restN = 0;
    if (screenDvd && screenDvd.on && screenDvd.mode === 'idle') screenDvd.hide();
    if (bright === 0) powerOn();
    navMode = mode;
    if (current !== navView) navPrev = current;
    if (mode === 'side' || mode === 'sheet') { dock(mode); bootNow(); kick(); }
    go(navView);
  }
  function closeNav() {
    var mode = navMode || dockKind;
    navMode = null;
    if (mode === 'side') {
      var c = document.querySelector('.navbar_menu-close-button-wrapper');
      if (c) c.click();                                   // the menu observer undocks
    } else if (mode === 'sheet') undock();
    if (current === navView || mode === 'sheet') go(navPrev && navPrev !== navView ? navPrev : (booted ? attract : launcher));
  }

  /* =============================================================
     SYSTEM MENU — MENÚ outside a game always opens this
     ============================================================= */
  var sysmenu = (function () {
    var el = null, open = false, sel = 0, items = [];
    function build() {
      items = [
        { label: 'Volver', run: function () { close(); } },
        { label: 'Menú de inicio', run: function () { close(); if (current !== launcher) go(launcher); } },
        { label: 'Fechas', run: function () { close(); window.PEConsole.open('fechas'); } },
        { label: 'Chat', run: function () { close(); window.PEConsole.open('chat'); } },
        { label: 'Ajustes', run: function () { close(); window.PEConsole.open('ajustes'); } },
        { label: sound ? 'Silenciar' : 'Activar sonido', run: function () { setSound(!sound); build(); render(); } }
      ];
    }
    function render() {
      el.innerHTML = listHTML(items.map(function (it) { return it.label; }), sel);
    }
    function close() {
      open = false; el.classList.remove('is-on');
      if (current) setStatus(current.status || current.title || 'PE·OS');
    }
    return {
      mount: function (stageEl) {
        el = document.createElement('div');
        el.className = 'pe-os_list-screen pe-os_sysmenu';
        stageEl.appendChild(el);
        el.addEventListener('click', function (e) {
          var row = e.target.closest('[data-i]');
          if (!row) return;
          sel = +row.getAttribute('data-i'); render(); sfx('ok'); items[sel].run();
        });
      },
      get open() { return open; },
      toggle: function () {
        if (open) { close(); sfx('back'); return; }
        open = true; sel = 0; build(); render(); el.classList.add('is-on'); setStatus('MENÚ'); sfx('open');
      },
      close: close,
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'up') { sel = (sel + items.length - 1) % items.length; sfx('nav'); render(); }
        else if (key === 'down') { sel = (sel + 1) % items.length; sfx('nav'); render(); }
        else if (key === 'a') { sfx('ok'); items[sel].run(); }
        else if (key === 'b' || key === 'menu') { close(); sfx('back'); }
      }
    };
  })();

  /* =============================================================
     GAME HOST
     ============================================================= */
  function makeGameHost(def) {
    var el = makeView('pe-os_game');
    el.innerHTML = '<canvas></canvas>' +
      '<div class="pe-os_panel" data-intro></div>' +
      '<div class="pe-os_panel" data-count></div>' +
      '<div class="pe-os_list-screen" data-pause></div>' +
      '<div class="pe-os_panel" data-result></div>';
    var cv = $('canvas', el);
    var introP = $('[data-intro]', el), countP = $('[data-count]', el), pauseP = $('[data-pause]', el), resultP = $('[data-result]', el);
    var state = 'intro', inst = null, api = null, pauseSel = 0, parts = [], floats = [], t = 0, down = {};
    var introCv = null, countT = 0, countN = 0, resultLock = 0, resultWait = -1, resultSfx = '', resultRecord = false, resultScore = 0, resultPrev = 0, resultFail = false;
    /* Which line the assistant gives a finished run. Four games always end
       with fail:false, so the outcome is read from the score too: a record
       is a record, an empty run or a loss gets consolation, praise only
       for a run near your own best, anything else a neutral line. */
    function resultLine() {
      if (resultRecord) return 'record';
      var near = resultPrev > 0 && resultScore >= resultPrev * 0.75;
      if (resultScore <= 0) return 'lose';
      if (resultFail) return near ? 'done' : 'lose';
      return near ? 'win' : 'done';
    }
    var paused = false;   // a layer over any state: intro, count, run, result

    function best() { return parseInt(store('pe-con-best-' + def.id) || '0', 10) || 0; }
    pauseP.addEventListener('click', function (e) {
      var row = e.target.closest('[data-i]');
      if (!row || !paused) return;
      pauseSel = +row.getAttribute('data-i');
      if (pauseSel === 0) resume();
      else if (pauseSel === 1) { paused = false; sfx('open'); startCount(); }
      else exitToLauncher();
    });
    function panel(p) {
      [introP, countP, pauseP, resultP].forEach(function (x) { x.classList.toggle('is-on', x === p); });
    }
    function controlsHTML() {
      return (def.controls || []).map(function (c) {
        var cls = c[0] === 'A' ? ' is-a' : c[0] === 'B' ? ' is-b' : '';
        return '<span class="pe-os_hint"><span><span class="pe-os_chip' + cls + '">' + escIco(c[0]) + '</span>' + escIco(c[1]) + '</span></span>';
      }).join('');
    }
    function showIntro() {
      state = 'intro';
      introP.innerHTML = '<span class="pe-os_kicker">' + (best() ? 'Récord ' + best() : 'Nuevo juego') + '</span>' +
        '<div class="pe-os_panel-art"><canvas></canvas></div>' +
        '<div class="pe-os_panel-title">' + esc(def.title) + '</div>' +
        '<div class="pe-os_panel-sub">' + esc(def.tagline || '') + '</div>' +
        '<div class="pe-os_controls">' + controlsHTML() + '</div>' +
        '<span class="pe-os_hint"><span><span class="pe-os_chip is-a">A</span>Empezar</span><span><span class="pe-os_chip is-b">B</span>Volver</span></span>';
      introCv = $('canvas', introP);
      panel(introP);
    }
    function startCount() {
      state = 'count'; countN = 3; countT = 0; resultWait = -1;
      countP.innerHTML = '<div class="pe-os_count">3</div>';
      panel(countP);
      sfx('count');
      spawn();
    }
    function spawn() {
      destroy();
      parts = []; floats = []; down = {};
      api = makeApi();
      inst = def.create(api) || {};
    }
    function destroy() {
      if (inst && inst.destroy) { try { inst.destroy(); } catch (e) {} }
      inst = null;
    }
    function run() { state = 'run'; panel(null); }
    function panelFor() {
      if (state === 'intro') return introP;
      if (state === 'count') return countP;
      if (state === 'result' && resultWait < 0) return resultP;
      return null;
    }
    function pause() {
      paused = true; pauseSel = 0; down = {}; renderPause(); panel(pauseP); setStatus('PAUSA'); sfx('back');
      assist('pause', { sub: def.id });
    }
    function resume() { paused = false; panel(panelFor()); setStatus(def.title); sfx('ok'); assist('resume', { sub: def.id }); }
    function exitToLauncher() { paused = false; sample('exit') || sfx('back'); go(launcher); }
    function renderPause() {
      pauseP.innerHTML = listHTML(['Continuar', state === 'intro' ? 'Empezar' : 'Reiniciar', 'Salir al menú'], pauseSel);
    }
    function end(res) {
      if (state !== 'run') return;
      res = res || {};
      state = 'result';
      resultLock = 0.7;
      var score = Math.round(res.score || 0), prev = best(), record = score > prev && score > 0;
      if (record) store('pe-con-best-' + def.id, score);
      resultP.innerHTML = '<span class="pe-os_kicker">' + esc(res.title || 'Fin del servicio') + '</span>' +
        '<div class="pe-os_score-big">' + score + '</div>' +
        '<span class="pe-os_kicker" style="color:var(--pe-cream-3)">' + esc(res.label || 'Puntos') + (prev && !record ? ' · Récord ' + prev : '') + '</span>' +
        (record ? '<span class="pe-os_record">¡Nuevo récord!</span>' : '') +
        (res.lines && res.lines.length ? '<div class="pe-os_panel-sub">' + res.lines.map(esc).join('<br>') + '</div>' : '') +
        '<span class="pe-os_hint"><span><span class="pe-os_chip is-a">A</span>Otra vez</span><span><span class="pe-os_chip is-b">B</span>Menú</span></span>';
      // shown from tick() on game time, so step()-driven tests see it too
      resultWait = (res.delay != null ? res.delay : 500) / 1000;
      resultSfx = res.fail ? 'lose' : (record ? 'win' : 'result');
      resultRecord = record;
      resultScore = score; resultPrev = prev; resultFail = !!res.fail;
    }

    function makeApi() {
      var a = {
        get w() { return csize(cv).w; },
        get h() { return csize(cv).h; },
        P: P, FONT: FONT, ease: ease,
        clamp: clamp, lerp: lerp, rand: rand, randi: randi, pick: pick,
        rr: rr, text: text, asterisk: asterisk, drawCover: drawCover, imgs: imgs,
        sfx: sfx,
        // o: { delay: seconds, to: end frequency (slide) }
        beep: function (freq, dur, type, vol, o) { o = o || {}; tone(freq, dur || 0.1, { type: type || 'square', vol: vol == null ? 0.1 : vol, delay: o.delay, to: o.to }); },
        noise: function (dur, o) { noise(dur, o); },
        shake: shake,
        isDown: function (k) { return !!down[k]; },
        get time() { return t; },
        get best() { return best(); },
        end: end,
        burst: function (x, y, o) {
          o = o || {};
          var n = o.count || 12, cols = o.colors || [o.color || P.yellow];
          for (var i = 0; i < n; i++) {
            var ang = o.angle != null ? o.angle + rand(-(o.spread || Math.PI), (o.spread || Math.PI)) : rand(0, Math.PI * 2);
            var sp = rand(0.4, 1) * (o.speed || 180);
            parts.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: o.gravity == null ? 420 : o.gravity,
              life: 0, max: rand(0.45, 0.9) * (o.life || 1), s: rand(0.6, 1.2) * (o.size || 5), c: pick(cols),
              r: rand(0, 6), vr: rand(-10, 10), shape: o.shape || (Math.random() < 0.5 ? 'sq' : 'dot') });
          }
        },
        float: function (x, y, s, color, size) { floats.push({ x: x, y: y, s: String(s), c: color || P.yellow, life: 0, size: size || 18 }); },
        hud: function (ctx, left, right, o) {
          o = o || {};
          var w = csize(cv).w, pad = 14, y = o.y || 24;
          text(ctx, left || '', pad, y, { size: 12, color: P.yellow, spacing: 1.5 });
          text(ctx, right || '', w - pad, y, { size: 12, color: P.white, align: 'right', spacing: 1.5 });
        }
      };
      return a;
    }

    function drawFx(ctx, dt) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        var k = 1 - p.life / p.max, s = p.s * (0.4 + k * 0.6);
        ctx.fillStyle = p.c;
        if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
      }
      for (var j = floats.length - 1; j >= 0; j--) {
        var f = floats[j];
        f.life += dt;
        if (f.life > 0.9) { floats.splice(j, 1); continue; }
        var pop = f.life < 0.15 ? ease.outBack(f.life / 0.15) : 1;
        ctx.globalAlpha = f.life > 0.6 ? 1 - (f.life - 0.6) / 0.3 : 1;
        ctx.save();
        ctx.font = '700 ' + f.size + 'px ' + FONT;
        var half = ctx.measureText(f.s).width / 2 + 6, cw = csize(cv).w;
        var fx = half * 2 < cw ? clamp(f.x, half, cw - half) : cw / 2;
        ctx.translate(fx, Math.max(f.size, f.y - ease.outCubic(Math.min(1, f.life / 0.9)) * 34));
        ctx.scale(pop, pop);
        text(ctx, f.s, 0, 0, { size: f.size, align: 'center', baseline: 'middle', color: f.c });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    return {
      el: el, title: def.title, def: def,
      isPaused: function () { return paused; },
      playing: function () { return state === 'run' && !paused; },
      enter: function () { t = 0; paused = false; showIntro(); sample('gamestart'); },
      leave: function () { destroy(); state = 'intro'; resultWait = -1; paused = false; panel(null); },
      exit: exitToLauncher,
      tick: function (dt) {
        if (paused) dt = 0;
        t += dt;
        if (state === 'intro' && introCv) {
          var f = fitCanvas(introCv, gamePixel(cv) || 0);
          if (f && def.preview) { f.ctx.clearRect(0, 0, f.w, f.h); def.preview(f.ctx, f.w, f.h, t, previewApi); f.present(); }
        }
        if (state === 'count') {
          countT += dt;
          if (countT > 0.62) {
            countT = 0; countN--;
            if (countN <= 0) { sfx('go'); run(); }
            else { countP.innerHTML = '<div class="pe-os_count">' + countN + '</div>'; sfx('count'); }
          }
        }
        var fc = fitCanvas(cv, gamePixel(cv));
        if (!fc) return;
        if (inst && !paused && (state === 'run' || state === 'result') && inst.update) {
          try { inst.update(state === 'run' ? dt : dt * 0.4); } catch (e) { console.error('[pe-console]', def.id, e); }
        }
        fc.ctx.clearRect(0, 0, fc.w, fc.h);
        fc.ctx.fillStyle = P.aztec; fc.ctx.fillRect(0, 0, fc.w, fc.h);
        if (inst && inst.draw) { try { inst.draw(fc.ctx, fc.w, fc.h); } catch (e) { console.error('[pe-console]', def.id, e); } }
        drawFx(fc.ctx, dt);
        fc.present();
        if (resultWait >= 0) {
          resultWait -= dt;
          if (resultWait < 0) {
            panel(resultP);
            if (resultSfx === 'win') { sfx('win'); sample('result', 0.12); } else sample(resultSfx) || sfx(resultSfx === 'lose' ? 'fail' : 'ok');
            assist(resultLine(), { sub: def.id });
          }
        }
        if (resultLock > 0 && resultWait < 0) resultLock -= dt;
      },
      input: function (key, type, o) {
        // MENÚ toggles the pause layer in every state
        if (key === 'menu') {
          if (type === 'down') { if (paused) resume(); else pause(); }
          return;
        }
        if (paused) {
          if (type !== 'down') return;
          if (key === 'up' || key === 'down') { pauseSel = (pauseSel + (key === 'up' ? 2 : 1)) % 3; sfx('nav'); renderPause(); }
          else if (key === 'b') resume();
          else if (key === 'a') {
            if (pauseSel === 0) resume();
            else if (pauseSel === 1) { paused = false; sfx('open'); startCount(); }
            else exitToLauncher();
          }
          return;
        }
        if (type === 'down') down[key] = true; else delete down[key];
        if (state === 'intro') {
          if (type !== 'down') return;
          if (key === 'a') { sfx('open'); startCount(); }
          else if (key === 'b') exitToLauncher();
          return;
        }
        if (state === 'count') return;
        if (state === 'run') {
          if (o && o.repeat) return;
          if (inst && inst.input) { try { inst.input(key, type); } catch (e) { console.error('[pe-console]', def.id, e); } }
          return;
        }
        if (state === 'result') {
          if (type !== 'down' || resultLock > 0 || resultWait >= 0) return;
          if (key === 'a') { sfx('open'); startCount(); }
          else if (key === 'b') exitToLauncher();
        }
      },
      preview: function (ctx, w, h, tt) { if (def.preview) def.preview(ctx, w, h, tt, previewApi); }
    };
  }
  var previewApi = { P: P, FONT: FONT, ease: ease, clamp: clamp, lerp: lerp, rand: rand, rr: rr, text: text, asterisk: asterisk, drawCover: drawCover, imgs: imgs };

  /* =============================================================
     LAUNCHER — cartridge cards, one at a time
     ============================================================= */
  function makeLauncher() {
    var el = makeView('pe-os_launcher');
    el.innerHTML = '<div class="pe-os_rail" data-rail></div><div class="pe-os_dots" data-dots></div>' +
      '<span class="pe-os_hint"><span><span class="pe-os_chip">' + ico('left') + ico('right') + '</span>Elegir</span><span><span class="pe-os_chip is-a">A</span>Abrir</span></span>';
    var railEl = $('[data-rail]', el), dotsEl = $('[data-dots]', el);
    var cards = [], idx = 0, t = 0;
    function build() {
      railEl.innerHTML = '';
      cards = apps.map(function (a, i) {
        var c = document.createElement('div');
        c.className = 'pe-os_card';
        if (a.cardBg) c.style.setProperty('--card-bg', a.cardBg);
        if (a.cardFg) c.style.setProperty('--card-fg', a.cardFg);
        c.innerHTML = '<div class="pe-os_card-art"><canvas></canvas>' +
          (a.tag ? '<span class="pe-os_card-tag">' + esc(a.tag) + '</span>' : '') +
          '<span class="pe-os_card-best" data-best></span></div>' +
          '<div class="pe-os_card-meta"><div><div class="pe-os_card-title">' + esc(a.title) + '</div><div class="pe-os_card-sub">' + esc(a.sub || '') + '</div></div>' +
          '<span class="pe-os_card-num">' + ('0' + (i + 1)).slice(-2) + '/' + ('0' + apps.length).slice(-2) + '</span></div>';
        c.addEventListener('click', function () {
          if (i === idx) open(); else { idx = i; sfx('nav'); layout(); }
        });
        railEl.appendChild(c);
        return { el: c, cv: $('canvas', c), best: $('[data-best]', c) };
      });
      dotsEl.innerHTML = apps.map(function () { return '<i></i>'; }).join('');
    }
    drag(railEl, {
      axis: 'x',
      begin: function () { railEl.classList.add('is-dragging'); },
      move: function (d) { layout(d); },
      end: function (d, v) {
        railEl.classList.remove('is-dragging');
        if (flung(d, v, railEl.clientWidth)) move(d < 0 ? 1 : -1); else layout();
      }
    });
    dotsEl.addEventListener('click', function (e) {
      var i = Array.prototype.indexOf.call(dotsEl.children, e.target);
      if (i >= 0 && i !== idx) { idx = i; sfx('nav'); layout(); }
    });
    function layout(dragPx) {
      cards.forEach(function (c, i) {
        var o = i - idx;
        c.el.style.transform = 'translateX(calc(' + (o * 106) + '% + ' + (dragPx || 0) + 'px)) scale(' + (o === 0 ? 1 : 0.9) + ')';
        c.el.style.opacity = Math.abs(o) > 1 ? '0' : '1';
        var app = apps[i];
        if (app.game) {
          var b = parseInt(store('pe-con-best-' + app.game.id) || '0', 10);
          c.best.textContent = b ? 'RÉCORD ' + b : '';
        }
      });
      $$('i', dotsEl).forEach(function (d, i) { d.classList.toggle('is-on', i === idx); });
      setStatus(apps[idx] ? apps[idx].title : 'PE·OS');
    }
    function open() {
      var a = apps[idx];
      if (!a) return;
      sfx('open');
      go(a.view);
    }
    function move(d) {
      var n = (idx + d + apps.length) % apps.length;
      idx = n; sfx('nav'); layout();
    }
    return {
      el: el, title: 'PE·OS',
      enter: function () { if (!cards.length || cards.length !== apps.length) build(); layout(); t = 0; },
      tick: function (dt) {
        t += dt;
        for (var i = idx - 1; i <= idx + 1; i++) {
          var c = cards[i], a = apps[i];
          if (!c || !a) continue;
          var f = fitCanvas(c.cv, a.game ? gamePixel(c.cv) : 0);
          if (!f) continue;
          f.ctx.clearRect(0, 0, f.w, f.h);
          if (a.view.preview) a.view.preview(f.ctx, f.w, f.h, i === idx ? t : 0.4);
          f.present();
        }
      },
      input: function (key, type) {
        if (type !== 'down') return;
        if (key === 'left' || key === 'up') move(-1);
        else if (key === 'right' || key === 'down') move(1);
        else if (key === 'a') open();
        else if (key === 'b') { sfx('back'); go(navMode ? navView : attract); }
      },
      rebuild: function () { build(); layout(); },
      focus: function (id) { apps.forEach(function (a, i) { if (a.id === id) idx = i; }); }
    };
  }

  /* =============================================================
     WHAT THE ASSISTANT SAYS — every line in one table. Edit the copy
     freely; the logic below never needs to change.
       lines  pool, picked at random, never the same line twice in a row.
              {n} = a number (volume, brightness), {track} = song title.
              Two short lines on the mini LCD at most (about 30 characters
              on a phone): longer lines get cut with "…". No marquee.
       p      priority 0-5. A line never interrupts a higher one still
              on screen; a different line of the same priority waits 1.2 s.
       cd     seconds before the same event may speak again.
       t      seconds on screen (default: by length, 2.4-4.2 s).
       mood   the chef's face: happy, sad, talk, music, sleep, dizzy.
       direct true = answers something the visitor just did, so it skips
              the global rate limit (one unprompted line per 6 s).
       chance 0-1 = speaks only sometimes (galería).
       g      a shared slot: events in the same g replace each other at once
              (on/off, pause/resume, brillo up/off) instead of waiting.
     Per-game or per-app variants live under 'event.id' (e.g. 'lose.punto')
     and are mixed with the event's general lines.
     ============================================================= */
  var SAY = {
    // waking up
    boot: { p: 0, cd: 0, mood: 'happy', lines: ['Hoy se cocina en Zurbano 83.', 'Fuego encendido. Pasa.', 'Delantal puesto. Empezamos.'] },
    screenOn: { p: 3, cd: 0, direct: true, g: 'bright', mood: 'happy', lines: ['Luz otra vez. Seguimos.', 'Ya te veo. Y tú a mí.'] },
    saverWake: { p: 2, cd: 0, direct: true, mood: 'happy', lines: ['Me había quedado frito.', 'Reposaba la masa.'] },
    // nothing happening for a while (rare, at most three in a row)
    rest: { p: 0, cd: 60, mood: 'talk', lines: ['Aquí nadie sigue la receta.', 'Huele a sofrito, ¿no?', 'Pruébalo antes de salar.', 'Sigo aquí, removiendo.', 'Una pizca de caos y listo.', 'Si te aburres, hay juegos.', 'Nada memorable es perfecto.', 'Fuego lento. Sin prisa.'] },
    // apps: first visit, every later visit, first time back out
    open: { p: 1, cd: 0, direct: true, g: 'app', mood: 'talk', t: 1.6, lines: ['Abriendo {name}…'] },
    enter: { p: 1, cd: 0, direct: true, g: 'app', mood: 'talk', lines: [] },
    'enter.fechas': { lines: ['Elige fecha y pulsa A.'] },
    'enter.packs': { lines: ['Paga hoy, elige fecha luego.', 'Un pack también se regala.'] },
    'enter.galeria': { lines: ['Así se ve un taller por dentro.'] },
    'enter.ajustes': { lines: ['Ajusta el punto de sal.'] },
    'enter.records': { lines: ['Tus marcas. Sin trampas.'] },
    'enter.about': { lines: ['Sí, soy yo el que no se calla.'] },
    'enter.slicer': { lines: ['Cuchillo afilado, dedos fuera.'] },
    'enter.servicio': { lines: ['Del pase a la mesa. Sin tirar.'] },
    'enter.comanda': { lines: ['Lee bien la comanda.'] },
    'enter.emplatado': { lines: ['Que entre por los ojos.'] },
    'enter.equilibrio': { lines: ['Pulso firme, bandeja recta.'] },
    'enter.punto': { lines: ['Ni crudo ni pasado.'] },
    leave: { p: 1, cd: 0, direct: true, g: 'app', mood: 'talk', lines: ['Vuelve cuando quieras.', 'Te lo dejo como estaba.', 'Aquí te espero.'] },
    chat: { p: 2, cd: 0, direct: true, mood: 'happy', t: 2.6, lines: ['Te escucho. Escribe abajo.'] },
    toFechas: { p: 2, cd: 0, direct: true, mood: 'jump', lines: ['¡Vamos a las fechas!'] },
    toRecord: { p: 2, cd: 0, direct: true, mood: 'jump', lines: ['¡A por el récord!'] },
    // games
    lose: { p: 4, cd: 0, direct: true, g: 'result', mood: 'sad', t: 3, lines: ['¡Uy! Otra vez.', 'Se quemó. Hasta a los mejores.', 'Eso no sale a sala.', 'Respira. Otra tanda.'] },
    'lose.slicer': { lines: ['Corte torcido. Nadie mira.', 'Juliana creativa, digamos.'] },
    'lose.servicio': { lines: ['La mesa 4 sigue esperando.', 'Ese pase se ha enfriado.'] },
    'lose.comanda': { lines: ['La comanda decía otra cosa.', 'Ese plato vuelve a cocina.'] },
    'lose.emplatado': { lines: ['Sabe bien. Se ve regular.', 'El plato pide otra mano.'] },
    'lose.equilibrio': { lines: ['La gravedad gana hoy.', 'Bandeja y orgullo, al suelo.'] },
    'lose.punto': { lines: ['Pasado. Al menos huele bien.', 'Eso ya es carbón.'] },
    win: { p: 4, cd: 0, direct: true, g: 'result', mood: 'happy', t: 2.6, lines: ['¡Bien servido!', 'Limpio. Sale a sala.', 'Eso tiene buena pinta.'] },
    'win.slicer': { lines: ['Cortes de escuela.', 'Ni un milímetro de más.'] },
    'win.servicio': { lines: ['Mesa servida, cliente feliz.', 'Pase limpio.'] },
    'win.comanda': { lines: ['Comanda clavada.', 'Justo lo que pidieron.'] },
    'win.emplatado': { lines: ['Plato de foto.', 'Plato servido.'] },
    'win.equilibrio': { lines: ['Ni una gota fuera.', 'Pulso de cirujano.'] },
    'win.punto': { lines: ['En su punto. Literal.', 'Dorado perfecto.'] },
    record: { p: 5, cd: 0, direct: true, g: 'result', mood: 'happy', t: 3, lines: ['¡Nuevo récord!', 'Récord nuevo. Lo apunto.', 'Eso va a la pizarra.'] },
    'record.slicer': { lines: ['Récord a cuchillo.'] },
    'record.servicio': { lines: ['Récord de servicio.'] },
    'record.comanda': { lines: ['Récord de comandas.'] },
    'record.emplatado': { lines: ['Récord de emplatado.'] },
    'record.equilibrio': { lines: ['Récord sin derramar.'] },
    'record.punto': { lines: ['Récord en su punto.'] },
    // a run that is neither a loss nor near your best: no praise, no pity
    done: { p: 4, cd: 0, direct: true, g: 'result', mood: 'talk', t: 2.8, lines: ['Servicio cerrado. A ver la nota.', 'Hecho. Siempre se puede afinar.', 'Apuntado. La próxima, mejor.'] },
    pause: { p: 3, cd: 6, direct: true, g: 'pause', mood: 'talk', lines: ['Tapo la olla y espero.', 'Pausa. El fuego no se va.', 'Me quedo vigilando.'] },
    resume: { p: 3, cd: 6, direct: true, g: 'pause', mood: 'happy', t: 1.8, lines: ['Seguimos.', 'Fuego otra vez.', 'A lo tuyo.'] },
    // vídeo
    videoPlay: { p: 3, cd: 20, direct: true, g: 'vplay', mood: 'happy', lines: ['Un minuto en Zurbano 83.', 'Palomitas no, croquetas.'] },
    videoPause: { p: 3, cd: 4, direct: true, g: 'vplay', mood: 'talk', lines: ['Pausa. Nadie se mueve.', 'Pausa. Que no se enfríe.'] },
    videoMute: { p: 3, cd: 0, direct: true, g: 'vmute', mood: 'sleep', lines: ['Sin sonido. Se lee igual.', 'Mudo, como un buen camarero.'] },
    videoUnmute: { p: 3, cd: 0, direct: true, g: 'vmute', mood: 'music', lines: ['Vuelve el ruido de cocina.', 'Ahora sí suena la sartén.'] },
    videoFull: { p: 3, cd: 10, direct: true, mood: 'happy', lines: ['A lo grande.', 'Pantalla entera para ti.'] },
    // galería: now and then, never on every photo
    gallery: { p: 1, cd: 25, chance: 0.35, mood: 'talk', lines: ['Esa luz no se finge.', 'Así se trabaja aquí.', 'Esto pasó en Zurbano 83.', 'Un martes cualquiera.'] },
    // ajustes and hardware
    volume: { g: 'volume', p: 3, cd: 0, direct: true, mood: 'music', t: 1.6, lines: ['Volumen {n} de 10'] },
    volumeZero: { g: 'volume', p: 3, cd: 0, direct: true, mood: 'music', t: 1.6, lines: ['Sin volumen'] },
    soundOn: { g: 'sound', p: 3, cd: 0, direct: true, mood: 'happy', t: 1.8, lines: ['¡Ya te oigo!'] },
    soundOff: { g: 'sound', p: 3, cd: 0, direct: true, mood: 'sleep', lines: ['Silencio. Me echo una siesta.'] },
    bright: { g: 'bright', p: 3, cd: 0, direct: true, mood: 'happy', t: 1.6, lines: ['Brillo {n} de 5'] },
    brightOff: { g: 'bright', p: 3, cd: 0, direct: true, mood: 'sleep', lines: ['Pantalla fuera. Yo sigo.'] },
    clicksOn: { g: 'clicks', p: 3, cd: 0, direct: true, mood: 'happy', lines: ['Clic, clic. Así me gusta.'] },
    clicksOff: { g: 'clicks', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Teclas mudas. Discreto.'] },
    hapticsOn: { g: 'haptics', p: 3, cd: 0, direct: true, mood: 'happy', lines: ['Vibración puesta. Bzz.'] },
    hapticsOff: { g: 'haptics', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Sin vibrar. Tranquilo.'] },
    lcdOn: { g: 'lcd', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Rayas de pantalla vieja.'] },
    lcdOff: { g: 'lcd', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Pantalla limpia, sin rayas.'] },
    pixelOn: { g: 'pixel', p: 3, cd: 0, direct: true, mood: 'happy', lines: ['Píxeles gordos. Como antes.'] },
    pixelOff: { g: 'pixel', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Píxeles finos. Alta cocina.'] },
    buddyOn: { p: 3, cd: 0, direct: true, mood: 'happy', lines: ['He vuelto a mi puesto.'] },
    musicOn: { g: 'music', p: 3, cd: 0, direct: true, mood: 'music', lines: ['Música. Se cocina mejor.'] },
    musicOff: { g: 'music', p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Sin música. Se oye el fuego.'] },
    track: { g: 'music', p: 3, cd: 0, direct: true, mood: 'music', lines: ['Suena {track}.'] },
    recordsReset: { p: 3, cd: 0, direct: true, mood: 'talk', lines: ['Pizarra limpia. A empezar.', 'Borrados. Sin rencor.'] },
    // Modo Entropía
    entropyOn: { g: 'entropy', p: 3, cd: 0, direct: true, mood: 'dizzy', lines: ['¡Todo se mueve!', 'Caos servido.', 'Hoy no se recoge nada.'] },
    entropyOff: { g: 'entropy', p: 3, cd: 0, direct: true, mood: 'happy', lines: ['Orden. Cada cosa en su sitio.', 'Recogido. Como debe ser.'] },
    // carrito desde FECHAS
    cartOk: { g: 'cart', p: 5, cd: 0, direct: true, mood: 'happy', t: 3, lines: ['¡Al carrito! Nos vemos.', 'En el carrito. Nos vemos.'] },
    cartSoldOut: { g: 'cart', p: 5, cd: 0, direct: true, mood: 'sad', t: 3, lines: ['Agotado. Mira otra fecha.', 'Esta se llenó. Hay más.'] },
    cartSlow: { g: 'cart', p: 5, cd: 0, direct: true, mood: 'talk', t: 3, lines: ['Va lento. Sigue en camino.', 'Un momento, que ya llega.'] },
    cartError: { g: 'cart', p: 5, cd: 0, direct: true, mood: 'sad', t: 3, lines: ['No ha entrado. Prueba otra vez.', 'El carrito no responde.'] },
    // packs (the buy / redeem modals open over the console)
    packBuy: { g: 'pack', p: 4, cd: 0, direct: true, mood: 'happy', t: 2.6, lines: ['Rellena y es tuyo.', 'Buena elección.'] },
    packRedeem: { g: 'pack', p: 4, cd: 0, direct: true, mood: 'talk', t: 2.6, lines: ['Escribe tu código.', 'A ver ese código.'] },
    packRedeemed: { g: 'pack', p: 5, cd: 0, direct: true, mood: 'happy', t: 3, lines: ['¡Reservado con tu pack!', 'Plaza guardada. Nos vemos.'] }
  };

  /* assist(event, ctx) — the one way the console makes the assistant talk.
     ctx: { sub: 'punto' (variant key), n, track, name, direct }. Returns true
     when the line went on screen. Respects the Asistente setting (off =
     silent), never interrupts a higher-priority line, waits the per-event
     cooldown and, for unprompted lines, a global gap. When the line ends the
     LCD goes back to the channel it was showing. */
  var SAY_GAP = 6, sayAt = {}, sayLast = {}, sayAny = -1e9;
  // the assistant's own clock: runs only while the console is drawn, so
  // cooldowns and the gap never expire while it is out of view
  function sayNow() { return buddy.time(); }
  function assist(evt, ctx) {
    ctx = ctx || {};
    var base = SAY[evt], sub = ctx.sub ? SAY[evt + '.' + ctx.sub] : null;
    var spec = base || sub;
    if (!spec || !buddyOn || !booted) return false;
    var pool = (sub && sub.lines ? sub.lines : []).concat(base && base.lines ? base.lines : []);
    if (!pool.length) return false;
    var now = sayNow(), key = evt + (sub ? '.' + ctx.sub : '');
    var slot = spec.g || evt;                 // paired events (on/off, pause/resume) replace each other
    var direct = ctx.direct != null ? ctx.direct : !!spec.direct;
    if (spec.cd && sayAt[evt] != null && now - sayAt[evt] < spec.cd) return false;
    if (!direct && now - sayAny < SAY_GAP) return false;
    if (spec.chance != null && Math.random() > spec.chance) return false;
    // random, never the same line twice in a row
    var line = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) while (line === sayLast[key]) line = pool[Math.floor(Math.random() * pool.length)];
    var text = line.replace(/\{(\w+)\}/g, function (m, k) { return ctx[k] != null ? ctx[k] : ''; });
    var dur = spec.t || clamp(1.6 + text.length * 0.06, 2.4, 4.2);
    if (!buddy.speak(spec.p || 0, slot, spec.mood || 'talk', text, dur)) return false;
    sayAt[evt] = now; sayAny = now; sayLast[key] = line;
    return true;
  }
  /* Resting comments: after a long quiet stretch on screen (the loop only
     runs while the console is in view and the tab is visible), at most three
     before the visitor touches something again. */
  var restT = 0, restN = 0, restNext = 70;
  function restTick(dt) {
    // never while a game is being played, the video runs, the menu is open or the screen is off
    var busy = bright === 0 || sysmenu.open || (current && current.playing && current.playing());
    if (busy) { restT = 0; return; }
    restT += dt;
    if (restT < restNext || restN >= 3) return;
    restT = 0; restNext = rand(75, 120);
    if (assist('rest')) restN++;
  }
  // music changes (Ajustes rows or the top music LCD): on/off and the song
  var musicAskedAt = 0;
  function bindMusicTalk() {
    var M = window.PEMusic;
    if (!M || !M.onChange) return;
    var on = M.enabled(), ti = M.index();
    M.onChange(function () {
      var o = M.enabled(), i = M.index();
      if (o !== on) { on = o; assist(o ? 'musicOn' : 'musicOff'); }
      if (i !== ti) {
        ti = i;
        if (!o) return;                       // skipping songs with the music off says nothing
        // only songs the visitor skipped to; the playlist moving on by itself says nothing
        if (Date.now() - musicAskedAt < 2500) assist('track', { track: (M.track() || {}).title || '' });
      }
    });
  }

  /* =============================================================
     ASSISTANT — the small LCD under the screen and its resident.
     A chef-hatted blob that watches the hardware (looks where the
     d-pad points, jumps on A, sleeps on mute, gets dizzy in caos) and
     carries three channels, switched with the rocker:
       0 CHEF    tips; click opens the site chat (the ¿Hablamos? widget)
       1 FECHA   next session; click opens FECHAS
       2 RÉCORDS best scores; click opens the menu
     ============================================================= */
  var buddy = (function () {
    var cv, box, chatBtn = null;
    var mode = 0, t = 0, msgT = 0, msgIdx = 0;
    var msg = { kick: '', body: '', shown: 0, scroll: 0 };
    var react = null;          // { kind, text, t, dur }
    var look = { x: 0, y: 0 }, lookT = 0;
    var jumpT = -1, blinkT = 2.5, blink = 0, hover = false, chaos = false, enabled = true;
    var CHANNELS = ['Asistente', 'Próxima fecha', 'Récords'];
    var TABS = ['CHAT', 'FECHA', 'RÉCORD'];
    var tabHits = [];
    var slide = 0, slideDir = 1;
    var SPRITE = [
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hhhhhhhh..',
      '...hhhhhh...',
      '...yyyyyy...',
      '..bbbbbbbb..',
      '.bbbbbbbbbb.',
      '.bbbbbbbbbb.',
      '.bbbbbbbbbb.',
      '.bbbbbbbbbb.',
      '..bbbbbbbb..',
      '..bb....bb..'
    ];

    function chefLines() {
      var l = [];
      l.push('¿Hablamos? Pulsa aquí.');
      l.push('Hoy se cocina en Zurbano 83.');
      l.push('Elige con ◀▶ y pulsa A.');
      l.push('El error también es un ingrediente.');
      l.push('Te ayudo a elegir taller.');
      return l;
    }
    function fechaLine() {
      var d = fechasData(), s = null;
      for (var i = 0; i < d.length; i++) if (d[i].iso) { s = d[i]; break; }
      if (!s) return 'Nuevas fechas muy pronto.';
      var dt = new Date(s.fecha + 'T12:00:00');
      var seats = s.it.seatsLeft != null ? ' · ' + s.it.seatsLeft + ' plazas' : '';
      return dt.getDate() + ' ' + MESES[dt.getMonth()] + ' · ' + s.it.name + seats;
    }
    function recordLines() {
      var l = [];
      GAMES.forEach(function (g) {
        var b = parseInt(store('pe-con-best-' + g.id) || '0', 10);
        if (b) l.push(String(g.title).toUpperCase() + ' · ' + b);
      });
      return l.length ? l : ['Aún sin récords. ¿Juegas?'];
    }
    function lines() { return mode === 0 ? chefLines() : mode === 1 ? [fechaLine()] : recordLines(); }
    function say(kick, body) {
      if (msg.kick === kick && msg.body === body) return;
      msg.kick = kick; msg.body = body; msg.shown = 0; msg.scroll = 0; msgT = 0;
    }
    function showChannel() {
      var l = lines();
      msgIdx = msgIdx % l.length;
      say(CHANNELS[mode], l[msgIdx]);
    }

    function fit() { return fitCanvas(cv); }

    /* Wrap a message into at most two lines that fit tw (one line with an
       ellipsis when two do not fit under the tabs). cut = text was lost. */
    var lay = null;
    function wrap2(ctx, body, tw, lh, room, bs) {
      var words = body.split(' '), lines2 = [''], li = 0, cut = false;
      words.forEach(function (wd) {
        var trial = lines2[li] ? lines2[li] + ' ' + wd : wd;
        if (ctx.measureText(trial).width > tw && lines2[li]) {
          if (li === 1) { lines2[1] = lines2[1] + ' ' + wd; return; }
          li++; lines2[li] = wd;
        } else lines2[li] = trial;
      });
      if (lines2[1]) {
        while (ctx.measureText(lines2[1]).width > tw && lines2[1].length > 1) { lines2[1] = lines2[1].slice(0, -2) + '…'; cut = true; }
      }
      // two lines only when they fit under the tabs; otherwise one line with an ellipsis
      if (lines2[1] && lh * 2 > room + bs * 0.25) {
        lines2 = [lines2.join(' ')];
        while (ctx.measureText(lines2[0]).width > tw && lines2[0].length > 1) { lines2[0] = lines2[0].slice(0, -2) + '…'; cut = true; }
      }
      if (ctx.measureText(lines2[0]).width > tw) cut = true;
      return { lines: lines2, cut: cut };
    }

    function drawGuy(ctx, x0, y0, u, mood) {
      var bob = Math.round(Math.sin(t * 3.2) * 0.5 + 0.5);
      var jy = 0;
      if (jumpT >= 0) { jy = -Math.round(Math.sin(Math.min(1, jumpT / 0.42) * Math.PI) * 4); }
      var sway = chaos ? Math.round(Math.sin(t * 9)) : 0;
      var ox = x0 + sway * u, oy = y0 + (jy + (jumpT >= 0 ? 0 : bob)) * u;
      var col = { h: P.white, y: P.yellow, b: P.yellow };
      for (var r = 0; r < SPRITE.length; r++) {
        for (var c = 0; c < 12; c++) {
          var ch = SPRITE[r][c];
          if (ch === '.') continue;
          ctx.fillStyle = col[ch];
          ctx.fillRect(ox + c * u, oy + r * u, u, u);
        }
      }
      // face lives on body rows 5..10
      ctx.fillStyle = P.aztec;
      var ex = look.x, ey = look.y;
      var er = 7 + ey;
      if (mood === 'sleep' || blink > 0) {
        ctx.fillRect(ox + (3 + ex) * u, oy + (er + 1) * u, u * 2, u);
        ctx.fillRect(ox + (7 + ex) * u, oy + (er + 1) * u, u * 2, u);
      } else if (mood === 'dizzy') {
        var f = Math.floor(t * 8) % 2;
        ctx.fillRect(ox + (3 + f) * u, oy + er * u, u, u);
        ctx.fillRect(ox + (4 - f) * u, oy + (er + 1) * u, u, u);
        ctx.fillRect(ox + (7 + f) * u, oy + er * u, u, u);
        ctx.fillRect(ox + (8 - f) * u, oy + (er + 1) * u, u, u);
      } else if (mood === 'happy') {
        ctx.fillRect(ox + 3 * u, oy + er * u, u * 2, u);
        ctx.fillRect(ox + 7 * u, oy + er * u, u * 2, u);
      } else {
        ctx.fillRect(ox + (3 + ex) * u, oy + er * u, u, u * 2);
        ctx.fillRect(ox + (8 + ex) * u, oy + er * u, u, u * 2);
      }
      // cheeks
      if (mood === 'happy' || mood === 'talk') {
        ctx.fillStyle = P.fawnLight;
        ctx.fillRect(ox + 2 * u, oy + 9 * u, u, u);
        ctx.fillRect(ox + 9 * u, oy + 9 * u, u, u);
      }
      // mouth
      ctx.fillStyle = P.aztec;
      if (mood === 'happy') {
        ctx.fillRect(ox + 4 * u, oy + 9 * u, u, u); ctx.fillRect(ox + 7 * u, oy + 9 * u, u, u);
        ctx.fillRect(ox + 5 * u, oy + 10 * u, u * 2, u);
      } else if (mood === 'sad') {
        ctx.fillRect(ox + 5 * u, oy + 9 * u, u * 2, u);
        ctx.fillRect(ox + 4 * u, oy + 10 * u, u, u); ctx.fillRect(ox + 7 * u, oy + 10 * u, u, u);
      } else if (mood === 'talk' && Math.floor(t * 10) % 2) {
        ctx.fillRect(ox + 5 * u, oy + 9 * u, u * 2, u * 2);
      } else if (mood !== 'sleep') {
        ctx.fillRect(ox + 5 * u, oy + 10 * u, u * 2, u);
      }
      // extras
      if (mood === 'sleep') {
        var zy = (t * 0.8) % 1;
        text(ctx, 'z', ox + 12 * u, oy + (3 - zy * 3) * u, { size: Math.max(8, u * 3), color: P.cream3 });
      }
      if (mood === 'music') {
        var ny = (t * 1.2) % 1;
        text(ctx, '♪', ox + 11 * u, oy + (4 - ny * 4) * u, { size: Math.max(9, u * 4), color: P.yellow });
      }
    }

    function mood() {
      if (react) return react.kind;
      if (!sound) return 'sleep';
      if (chaos) return 'dizzy';
      if (hover) return 'happy';
      if (msg.shown < msg.body.length) return 'talk';
      return 'idle';
    }

    return {
      init: function (el) {
        box = el;
        cv = $('canvas', el);
        chatBtn = document.querySelector('[data-vanny-toggle]');
        el.addEventListener('mouseenter', function () { hover = true; if (!react && mode === 0 && enabled) say('Asistente', '¡Pulsa aquí!'); });
        el.addEventListener('mouseleave', function () { hover = false; showChannel(); });
        showChannel();
      },
      /* speak(p, key, mood, text, dur): the only door for a reaction line
         (assist() decides what and when). A line still on screen with a
         higher priority is never cut; one of the same priority keeps the
         screen for 1.2 s unless it is the same event (the volume wheel
         replaces its own line as it turns). */
      speak: function (p, key, kind, text, dur) {
        if (!enabled) return false;
        if (react && react.t < react.dur) {
          if (react.p > p) return false;
          if (react.p === p && react.key !== key && react.t < 1.2) return false;
        }
        react = { kind: kind, t: 0, dur: dur || 2.4, p: p, key: key };
        say(kind === 'music' ? 'Volumen' : CHANNELS[mode], text);
        var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (still) msg.shown = msg.body.length;            // no typing, no hop
        else if (kind === 'happy' || kind === 'jump') jumpT = 0;
        return true;
      },
      heard: function () { return msg.body; },
      time: function () { return t; },
      // QA: does this text fit the LCD's two lines at the current size?
      fits: function (str) {
        if (!lay) return null;
        var c = lay.ctx;
        c.font = '600 ' + lay.bs + 'px ' + FONT;
        return !wrap2(c, str, lay.tw, lay.lh, lay.room, lay.bs).cut;
      },
      look: function (dir) {
        look.x = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
        look.y = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
        lookT = 1.2;
      },
      jump: function () { if (jumpT < 0) jumpT = 0; },
      setEnabled: function (on) { enabled = on; react = null; showChannel(); },
      setChaos: function (on) { chaos = on; if (on) { react = null; say('Modo caos', '¡Todo se mueve!'); } else showChannel(); },
      cycle: function (d) {
        mode = (mode + d + 3) % 3;
        slide = 1; slideDir = d < 0 ? -1 : 1;
        msgIdx = 0; react = null;
        showChannel();
      },
      refresh: function () { if (!react) showChannel(); },
      // a tap on a tab switches to that channel; anywhere else runs the channel
      clickAt: function (x, y) {
        for (var k = 0; k < tabHits.length; k++) {
          var h = tabHits[k];
          if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) {
            if (h.i !== mode) { slideDir = h.i > mode ? 1 : -1; mode = h.i; slide = 1; msgIdx = 0; react = null; showChannel(); sfx('nav'); }
            return;
          }
        }
        sfx('open');
        this.click();
      },
      click: function () {
        if (!enabled) { window.PEConsole && PEConsole.open('ajustes'); return; }
        if (mode === 0) { window.PEConsole && PEConsole.open('chat'); } else if (mode === 1) { window.PEConsole && PEConsole.open('fechas'); assist('toFechas'); }
        else { go(launcher); assist('toRecord'); }
      },
      tick: function (dt) {
        if (!cv) return;
        t += dt;
        if (react) { react.t += dt; if (react.t > react.dur) { react = null; showChannel(); } }
        if (jumpT >= 0) { jumpT += dt; if (jumpT > 0.42) jumpT = -1; }
        if (lookT > 0) { lookT -= dt; if (lookT <= 0) { look.x = 0; look.y = 0; } }
        blinkT -= dt;
        if (blink > 0) blink -= dt;
        if (blinkT <= 0) { blink = 0.12; blinkT = 2.2 + Math.random() * 2.5; }
        if (msg.shown < msg.body.length) msg.shown = Math.min(msg.body.length, msg.shown + dt * 34);
        else if (!react && !hover) {
          msgT += dt;
          var l = lines();
          if (msgT > 5 && l.length > 1) { msgIdx = (msgIdx + 1) % l.length; showChannel(); }
        }
        var f = fit();
        if (!f) return;
        var ctx = f.ctx, w = f.w, h = f.h;
        ctx.fillStyle = P.aztec; ctx.fillRect(0, 0, w, h);
        if (!enabled) {
          // assistant off: a plain clock
          var now = new Date(), hh = ('0' + now.getHours()).slice(-2), mm = ('0' + now.getMinutes()).slice(-2);
          var colon = Math.floor(t * 1.2) % 2 ? ':' : ' ';
          text(ctx, hh + colon + mm, w / 2, h * 0.62, { size: Math.round(h * 0.46), weight: 700, color: P.white, align: 'center', baseline: 'middle' });
          text(ctx, DIAS[now.getDay()] + ' ' + now.getDate() + ' ' + MESES[now.getMonth()], w / 2, h * 0.2, { size: Math.max(8, Math.round(h * 0.14)), color: P.yellow, align: 'center', baseline: 'middle', spacing: 1.2 });
          f.present();
          return;
        }
        var u = Math.max(2, Math.floor(h * 0.8 / 13));
        var gx = Math.round(h * 0.16), gy = Math.round((h - 12 * u) / 2);
        drawGuy(ctx, gx, gy, u, mood());
        // text column: channel tabs on top (what the rocker switches), the message below
        var tx = gx + 12 * u + Math.round(h * 0.22), tw = w - tx - Math.round(h * 0.16);
        var ks = Math.max(8, Math.round(h * 0.14)), bs = Math.max(10, Math.round(h * 0.2));
        // tabs shrink until all three fit the column
        var tabGap = function () { return ks * 1.1; };
        var tabsW = function () {
          ctx.font = '700 ' + ks + 'px ' + FONT;
          var sum = 0;
          TABS.forEach(function (tb) { sum += ctx.measureText(tb).width + tb.length * 1.2; });
          return sum + tabGap() * (TABS.length - 1);
        };
        while (ks > 6 && tabsW() > tw) ks -= 0.5;
        var tabX = tx, tabY = Math.round(Math.max(ks + 4, h * 0.3));
        ctx.font = '700 ' + ks + 'px ' + FONT;
        tabHits = [];
        for (var i = 0; i < TABS.length; i++) {
          var on = i === mode, lw = ctx.measureText(TABS[i]).width + TABS[i].length * 1.2;
          tabHits.push({ x0: tabX - 4, x1: tabX + lw + 4, y0: 0, y1: tabY + 8, i: i });
          text(ctx, TABS[i], tabX, tabY, { size: ks, color: on ? P.yellow : P.cream3, spacing: 1.2 });
          if (on) { ctx.fillStyle = P.yellow; ctx.fillRect(tabX, tabY + 3, lw - 1.2, 2); }
          tabX += lw + tabGap();
        }
        if (slide > 0) slide = Math.max(0, slide - dt * 5);
        var sy = Math.round(ease.outCubic(slide) * h * 0.25) * slideDir;
        ctx.save();
        ctx.beginPath(); ctx.rect(tx, tabY + 7, tw, h - tabY - 7); ctx.clip();
        ctx.font = '600 ' + bs + 'px ' + FONT;
        var lh = bs * 1.18, top = tabY + 8, room = h - top - 3;
        lay = { ctx: ctx, tw: tw, bs: bs, lh: lh, room: room };
        var lines2 = wrap2(ctx, msg.body, tw, lh, room, bs).lines;
        var budget = Math.floor(msg.shown);
        var blockH = lh * (lines2.length - 1) + bs;
        var baseY = top + Math.max(0, (room - blockH) / 2) + bs * 0.86 + sy;
        var cx = tx, cyEnd = baseY;
        for (var k = 0; k < lines2.length; k++) {
          var part = lines2[k].slice(0, Math.max(0, budget));
          budget -= lines2[k].length + 1;
          text(ctx, part, tx, baseY + k * lh, { size: bs, weight: 600, color: P.white });
          if (part.length) { cx = tx + ctx.measureText(part).width; cyEnd = baseY + k * lh; }
        }
        if (msg.shown < msg.body.length && Math.floor(t * 6) % 2) {
          ctx.fillStyle = P.yellow; ctx.fillRect(cx + 2, cyEnd - bs * 0.72, Math.max(2, bs * 0.45), bs * 0.8);
        }
        ctx.restore();
        f.present();
      }
    };
  })();

  /* =============================================================
     TICKER — the slot LCD in the top strip. Name of what is running on
     the left, a small live animation on the right that follows it:
     a waveform for the video, a mini scene per game, a marquee for the
     next date, typing dots for the chat... Whenever the console itself
     makes a sound, the real waveform (AnalyserNode on the master bus)
     takes over the animation area.
     ============================================================= */
  var ticker = (function () {
    var cv = null, t = 0, label = 'PE·OS', flash = 0, wave = new Uint8Array(128);
    function appId() {
      if (sysmenu.open) return 'menu';
      if (!current) return 'os';
      if (current.def) return current.isPaused && current.isPaused() ? 'pause' : 'game:' + current.def.id;
      for (var i = 0; i < apps.length; i++) if (apps[i].view === current) return apps[i].id;
      if (current === videoView) return 'video';
      if (current === recordsView || current === aboutView) return 'ajustes';
      return 'os';
    }
    function nameFor(id) {
      if (id === 'menu') return 'MENÚ';
      if (id === 'pause') return 'PAUSA';
      if (id === 'os') return 'PE·OS';
      return String(current && current.title || 'PE·OS').toUpperCase();
    }
    /* Pixel bars: an LED column meter. Square blocks on a coarse grid with
       1px gutters, growing from the bottom, heights snapped to whole blocks;
       unlit blocks stay faintly visible and the top lit block is the brighter
       peak cap. */
    function bars(ctx, x, y, w, h, n, fn, color) {
      var cell = Math.max(2, Math.floor((h + 1) / 5) - 1), step = cell + 1;
      var rows = Math.max(2, Math.floor((h + 1) / step));
      var cols = Math.max(1, Math.floor((w + 1) / step));
      var base = Math.round(y + (h - (rows * step - 1)) / 2) + (rows - 1) * step;   // top of the bottom block
      var peak = color === P.yellow ? P.yellowLight : P.cream3;
      for (var c = 0; c < cols; c++) {
        var v = Math.max(0, Math.min(1, fn(Math.floor(c * n / cols))));
        var k = Math.max(1, Math.round(v * rows));
        var cx = x + c * step;
        for (var r = 0; r < rows; r++) {
          ctx.fillStyle = r < k ? ((r === k - 1 && k > 1) ? peak : color) : P.aztec2;
          ctx.fillRect(cx, base - r * step, cell, cell);
        }
      }
    }
    function scene(ctx, id, x, y, w, h) {
      var mid = y + h / 2, u = Math.max(2, Math.round(h / 6));
      if (id === 'video') {
        var playing = current && current.playing && current.playing();
        if (playing) {
          bars(ctx, x, y, w, h, Math.floor(w / 3), function (i) {
            // speech-like envelope: phrases (slow) x syllables (fast), full range
            var env = Math.abs(Math.sin(t * 1.1 + i * 0.08)) * 0.6 + 0.4;
            return env * Math.pow(Math.abs(Math.sin(t * 7 + i * 0.55) * Math.sin(t * 2.3 + i * 0.21) + 0.35 * Math.sin(t * 13 + i * 1.7)), 0.7);
          }, P.yellow);
        } else {
          ctx.fillStyle = P.aztec3; ctx.fillRect(x, mid, w, 1);
          if (Math.floor(t * 2) % 2) { ctx.fillStyle = P.white; ctx.fillRect(x + w - 8, mid - 4, 2, 8); ctx.fillRect(x + w - 4, mid - 4, 2, 8); }
        }
        return;
      }
      if (id === 'game:slicer') {
        ctx.fillStyle = P.walnut; ctx.fillRect(x, mid + u, w, u);
        ctx.fillStyle = P.yellow; ctx.fillRect(x + 2, mid - u, w * 0.7, u * 2);
        var k = (Math.sin(t * 2.4) * 0.5 + 0.5) * (w - 4);
        ctx.fillStyle = P.white; ctx.fillRect(x + k, y, 2, h);
        ctx.fillStyle = P.aztec; for (var c = 1; c < 3; c++) ctx.fillRect(x + 2 + w * 0.7 * c / 3, mid - u, 1, u * 2);
        return;
      }
      if (id === 'game:servicio') {
        var cell = u + 1, cols = Math.floor(w / cell), head = Math.floor(t * 8) % (cols + 4);
        for (var s = 0; s < 4; s++) { var cx = head - s; if (cx < 0 || cx >= cols) continue; ctx.fillStyle = s === 0 ? P.yellow : P.white; ctx.fillRect(x + cx * cell, mid - u / 2, u, u); }
        ctx.fillStyle = P.fawnLight; ctx.fillRect(x + w - u * 2, mid - u, u * 2, u * 2);
        return;
      }
      if (id === 'game:comanda') {
        var cols4 = [P.tomato, P.yellow, P.white, P.leaf], step = Math.floor(t * 3) % 4;
        for (var q = 0; q < 4; q++) { ctx.fillStyle = q === step ? cols4[q] : P.aztec3; ctx.fillRect(x + q * (w / 4) + 2, mid - u, w / 4 - 4, u * 2); }
        return;
      }
      if (id === 'game:emplatado') {
        var r = h * 0.38, ox = x + w / 2, a = t * 1.6;
        ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(ox, mid, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.tomato; ctx.fillRect(ox + Math.cos(a) * r * 0.5 - u / 2, mid + Math.sin(a) * r * 0.5 - u / 2, u, u);
        ctx.fillStyle = P.leaf; ctx.fillRect(ox + Math.cos(a + 2.2) * r * 0.5 - u / 2, mid + Math.sin(a + 2.2) * r * 0.5 - u / 2, u, u);
        return;
      }
      if (id === 'game:equilibrio') {
        // spirit level: a straight tube, the bubble wanders
        ctx.fillStyle = P.aztec3; ctx.fillRect(x, mid - u, w, u * 2);
        ctx.fillStyle = P.white; ctx.fillRect(x + w / 2 - 1, mid - u - 2, 2, u * 2 + 4);
        var bx = x + w / 2 + Math.sin(t * 1.3) * Math.sin(t * 0.7) * (w / 2 - u * 2);
        ctx.fillStyle = P.yellow; ctx.fillRect(bx - u * 1.5, mid - u + 1, u * 3, u * 2 - 2);
        return;
      }
      if (id === 'game:punto') {
        // flames: taller in the middle of the burner, flickering
        var nf = Math.floor(w / 4);
        bars(ctx, x, y, w, h, nf, function (i) { var shape = Math.sin(Math.PI * (i + 0.5) / nf); return shape * (0.55 + 0.45 * Math.abs(Math.sin(t * 9 + i * 1.3) * Math.cos(t * 4 + i))); }, P.yellow);
        return;
      }
      if (id === 'fechas') {
        var msg = '', d = fechasData();
        for (var j = 0; j < d.length; j++) if (d[j].iso) { var dt = new Date(d[j].fecha + 'T12:00:00'); msg = dt.getDate() + ' ' + MESES[dt.getMonth()] + ' · ' + d[j].it.name.toUpperCase() + '   '; break; }
        if (!msg) msg = 'NUEVAS FECHAS MUY PRONTO   ';
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.font = '700 ' + Math.round(h * 0.62) + 'px ' + FONT;
        var mw = ctx.measureText(msg).width, off = (t * 26) % mw;
        text(ctx, msg + msg, x - off, mid + h * 0.22, { size: Math.round(h * 0.62), color: P.yellow });
        ctx.restore();
        return;
      }
      if (id === 'packs') {
        // tickets sliding past: yellow stub, cream body
        var pw = u * 7, pg = u * 2, span = pw + pg, poff = (t * 16) % span;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        for (var pk = -1; pk * span < w + span; pk++) {
          var px = x + pk * span + poff;
          ctx.fillStyle = P.yellow; ctx.fillRect(px, mid - u, pw * 0.34, u * 2);
          ctx.fillStyle = P.white; ctx.fillRect(px + pw * 0.34 + 1, mid - u, pw * 0.66 - 1, u * 2);
        }
        ctx.restore();
        return;
      }
      if (id === 'chat') {
        for (var dI = 0; dI < 3; dI++) { var hop = Math.max(0, Math.sin(t * 6 - dI * 0.8)) * u; ctx.fillStyle = P.white; ctx.fillRect(x + w / 2 - 10 + dI * 8, mid - u / 2 - hop, u, u); }
        return;
      }
      if (id === 'galeria') {
        var n5 = 5, cur = Math.floor(t / 2) % n5;
        for (var g = 0; g < n5; g++) { ctx.fillStyle = g === cur ? P.yellow : P.aztec3; ctx.fillRect(x + g * (w / n5) + 1, mid - 1, w / n5 - 3, 3); }
        return;
      }
      if (id === 'ajustes') {
        ctx.fillStyle = P.aztec3; ctx.fillRect(x, mid - 1, w, 2);
        var kx = x + (Math.sin(t * 1.4) * 0.5 + 0.5) * (w - u * 3);
        ctx.fillStyle = P.yellow; ctx.fillRect(kx, mid - u, u * 3, u * 2);
        return;
      }
      if (id === 'menu' || id === 'pause') {
        if (Math.floor(t * 2) % 2) { ctx.fillStyle = P.yellow; ctx.fillRect(x, mid - u, u * 1.5, u * 2); }
        return;
      }
      // PE·OS: a slow idle equaliser
      bars(ctx, x, y, w, h, Math.floor(w / 4), function (i) { return 0.2 + 0.55 * (Math.sin(t * 1.3 + i * 0.6) * 0.5 + 0.5); }, P.aztec3);
    }
    return {
      init: function (el) { cv = el ? $('canvas', el) : null; },
      swap: function () { flash = 0.25; },
      tick: function (dt) {
        if (!cv) return;
        t += dt;
        var f = fitCanvas(cv);
        if (!f) return;
        var ctx = f.ctx, w = f.w, h = f.h, id = appId(), name = nameFor(id);
        if (name !== label) { label = name; flash = 0.25; }
        ctx.fillStyle = P.aztec; ctx.fillRect(0, 0, w, h);
        var fs = Math.max(7, Math.round(h * 0.5)), pad = Math.round(h * 0.3);
        ctx.fillStyle = P.yellow; ctx.fillRect(pad, h / 2 - fs * 0.32, fs * 0.64, fs * 0.64);
        text(ctx, label, pad + fs, h / 2 + fs * 0.36, { size: fs, color: P.white, spacing: 1.2 });
        ctx.font = '700 ' + fs + 'px ' + FONT;
        var ax = Math.round(pad + fs + ctx.measureText(label).width + label.length * 1.2 + pad * 1.4);
        var aw = w - ax - pad, ay = Math.round(h * 0.2), ah = h - ay * 2;
        if (aw > 12) {
          // live console sound (spectrum of the master bus) takes over while it is audible
          var loud = false;
          if (analyser && performance.now() - lastSound < 600) {
            analyser.getByteFrequencyData(wave);
            var sum = 0, nb = 64;
            for (var q = 0; q < nb; q++) sum += wave[q];
            loud = sum / nb > 10;
          }
          if (loud) {
            var nbars = Math.max(8, Math.floor(aw / 3)), per = 64 / nbars;
            bars(ctx, ax, ay, aw, ah, nbars, function (i) { return Math.pow(wave[Math.floor(i * per)] / 255, 0.6); }, P.yellow);
          } else scene(ctx, id, ax, ay, aw, ah);
        }
        // a quick wipe when the program changes (the "cartridge" swap)
        if (flash > 0) { flash -= dt; ctx.fillStyle = P.white; ctx.fillRect(Math.round(w * (1 - Math.max(0, flash / 0.25))), 0, 2, h); }
        f.present();
      }
    };
  })();

  /* =============================================================
     INPUT — hardware keys, d-pad rolling thumb, keyboard, wheel
     ============================================================= */
  var held = {}, repeatT = {};
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
    ' ': 'a', z: 'a', Z: 'a', k: 'a', K: 'a',
    Enter: 'b', x: 'b', X: 'b', l: 'b', L: 'b',
    Escape: 'home', m: 'menu', M: 'menu', p: 'menu', P: 'menu'
  };
  function keyEls(key) { return $$('[data-pe-key="' + key + '"]', root); }
  function press(key, src) {
    if (held[key]) return;
    if (consoleActivity()) return;            // woke the DVD saver: this press does nothing else
    held[key] = src || true;
    keyEls(key).forEach(function (e) { e.classList.add('is-down'); });
    audio();
    wake();
    if (clicksOn) sfx('click');
    haptic(key === 'a' || key === 'b' ? 12 : 7);
    blinkLed();
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') { padEl.setAttribute('data-dir', key); buddy.look(key); }
    if (key === 'a') buddy.jump();
    if (key === 'sound') { setSound(!sound); return; }
    dispatch(key, 'down', {});
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
      clearTimeout(repeatT[key]);
      repeatT[key] = setTimeout(function rep() {
        if (!held[key]) return;
        dispatch(key, 'down', { repeat: true });
        repeatT[key] = setTimeout(rep, 140);
      }, 380);
    }
  }
  function release(key) {
    if (!held[key]) return;
    delete held[key];
    clearTimeout(repeatT[key]);
    keyEls(key).forEach(function (e) { e.classList.remove('is-down'); });
    if (padEl.getAttribute('data-dir') === key) padEl.removeAttribute('data-dir');
    if (key !== 'sound') dispatch(key, 'up', {});
  }
  function dispatch(key, type, o) {
    idleT = 0;
    if (!booted) return;
    // Escape: straight back to the main menu from anywhere
    if (key === 'home') {
      if (type !== 'down') return;
      // docked as the site menu (or lifted to play): Escape puts it back
      if (dockKind || navMode || current === navView) { if (sysmenu.open) sysmenu.close(); sfx('back'); closeNav(); return; }
      if (sysmenu.open) { sysmenu.close(); sfx('back'); }
      if (current === launcher) return;
      if (current && current.exit) current.exit(); else { sfx('back'); go(launcher); }
      return;
    }
    // the system menu captures input while it is open
    if (sysmenu.open) {
      if (key === 'home' && type === 'down') { sysmenu.close(); if (current !== launcher) go(launcher); return; }
      sysmenu.input(key, type); return;
    }
    // MENÚ outside a game opens the system menu (inside a game the host pauses)
    if (key === 'menu' && !(current && current.def)) {
      if (type === 'down') sysmenu.toggle();
      return;
    }
    if (current && current.input) {
      if (!current.def && o.repeat && current === attract) return;
      current.input(key, type, o);
    }
  }

  function bindHardware() {
    // plain keys (A, B, MENÚ, SONIDO)
    $$('.pe-con_btn[data-pe-key], .pe-con_key[data-pe-key]', root).forEach(function (b) {
      var key = b.getAttribute('data-pe-key');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(key, 'ptr'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        b.addEventListener(ev, function () { if (held[key] === 'ptr') release(key); });
      });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press(key, 'kb'); } });
      b.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); release(key); } });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    // d-pad: rolling thumb — the direction follows the finger across the cross
    var pad = $('[data-pe-dpad]', root), padDir = null, padId = null;
    var padRect = null;
    function dirFrom(e) {
      var r = padRect || (padRect = pad.getBoundingClientRect());
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      if (Math.abs(dx) < 0.16 && Math.abs(dy) < 0.16) return padDir;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      padId = e.pointerId;
      padRect = pad.getBoundingClientRect();
      try { pad.setPointerCapture(e.pointerId); } catch (x) {}
      padDir = dirFrom(e) || 'up';
      press(padDir, 'pad');
    });
    pad.addEventListener('pointermove', function (e) {
      if (padId !== e.pointerId || !padDir) return;
      var d = dirFrom(e);
      if (d && d !== padDir) { release(padDir); padDir = d; press(d, 'pad'); }
    });
    function padUp(e) { if (padId !== e.pointerId) return; if (padDir) release(padDir); padDir = null; padId = null; }
    pad.addEventListener('pointerup', padUp);
    pad.addEventListener('pointercancel', padUp);
    pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // keyboard — only while the console is armed (last interaction was on it)
    document.addEventListener('pointerdown', function (e) {
      armed = hostEl.contains(e.target);
      if (armed) { restT = 0; restN = 0; }
      audioUnlock();
      if (armed && consoleActivity()) { e.preventDefault(); e.stopPropagation(); swallowClickUntil = performance.now() + 500; }
    }, true);
    // the click that follows a waking touch does nothing either
    var swallowClickUntil = 0;
    document.addEventListener('click', function (e) {
      if (performance.now() < swallowClickUntil && hostEl.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('touchend', audioUnlock, true);
    document.addEventListener('click', audioUnlock, true);
    document.addEventListener('keydown', function (e) {
      audioUnlock();
      if (!armed || (!visible && !dockKind)) return;
      var tgt = e.composedPath ? e.composedPath()[0] : e.target;
      if (tgt && (tgt.isContentEditable || /INPUT|TEXTAREA|SELECT|IFRAME/.test(tgt.tagName))) return;
      var m = document.getElementById('modal-1');
      if (m && m.classList.contains('is-open')) return;
      // a packs buy/redeem dialog is open over the page: its keys are its own
      if (packModalOpen()) return;
      if (tgt === wheelEl || (tgt.closest && tgt.closest('[data-pe-rocker], [data-pe-mini]'))) return;
      var key = KEYMAP[e.key];
      if (!key) return;
      e.preventDefault();
      if (e.repeat) return;
      press(key, 'kb');
    });
    document.addEventListener('keyup', function (e) {
      var key = KEYMAP[e.key];
      if (key && held[key] === 'kb') release(key);
    });
    window.addEventListener('blur', function () { Object.keys(held).forEach(release); });
    hostEl.addEventListener('focusin', function () { armed = true; });

    // tapping the screen: acts like A on the attract loop / launcher card
    screenEl.addEventListener('click', function (e) {
      audio(); wake(); restT = 0; restN = 0;
      if (current === attract) enterFromAttract();
    });

    // the rocker (Juan's original up/down joystick) switches the assistant's channel
    var rocker = $('[data-pe-rocker]', root), rockT = 0;
    function rock(dir) {
      audio(); wake(); restT = 0; restN = 0;
      rocker.classList.remove('is-up', 'is-down');
      rocker.classList.add(dir < 0 ? 'is-up' : 'is-down');
      clearTimeout(rockT);
      rockT = setTimeout(function () { rocker.classList.remove('is-up', 'is-down'); }, 170);
      blinkLed();
      // up = brighter, like the wheel does for volume
      var nb = clamp(bright - dir, 0, 5);
      // switching the screen off has its own synth sigh (SFX.poweroff)
      if (nb === 0 && bright !== 0) sfx('poweroff');
      else if (bright === 0 && nb > 0) sampleSoon('boot');   // back on: the start-up sound
      else sfx('tick', nb * 2);
      if (nb !== bright) { bright = nb; store('pe-con-bright', bright); applyBright(); }
      if (bright === 0) { toast('Pantalla apagada'); assist('brightOff'); }
      else { toast('Brillo', { meter: [bright, 5] }); assist('bright', { n: bright }); }
      if (current && current.refresh) current.refresh();
    }
    if (rocker) {
      rocker.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var r = rocker.getBoundingClientRect();
        rock(e.clientY < r.top + r.height / 2 ? -1 : 1);
      });
      rocker.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); rock(-1); }
        else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); rock(1); }
      });
    }
    var mini = $('[data-pe-mini]', root);
    if (mini) {
      mini.addEventListener('click', function (e) {
        audio(); wake(); restT = 0; restN = 0;
        var cvEl = $('canvas', mini), r = cvEl.getBoundingClientRect();
        buddy.clickAt(e.clientX - r.left, e.clientY - r.top);
      });
      mini.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); sfx('open'); buddy.click(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); sfx('nav'); buddy.cycle(e.key === 'ArrowLeft' ? -1 : 1); }
      });
    }

    // volume wheel
    var acc = 0, pos = 0, wheelId = null, lastY = 0;
    function turn(px) {
      consoleIdle = 0; restT = 0; restN = 0;
      pos += px;
      wheelEl.style.setProperty('--wheel-pos', pos + 'px');
      acc += px;
      var step = 9;
      while (Math.abs(acc) >= step) {
        var d = acc > 0 ? -1 : 1;     // drag up = louder
        acc -= (acc > 0 ? step : -step);
        setVolume(volume + d, true);
      }
    }
    /* The wheel itself is a thin sliver at the console edge: on a phone a
       thumb missed it and scrolled the page instead. A wider invisible grab
       strip over the wheel and its + VOL - marks drives it too (it can only
       grow inward: the console's paint containment clips anything outside). */
    var wheelHit = document.createElement('div');
    wheelHit.className = 'pe-con_wheel-hit';
    wheelHit.setAttribute('aria-hidden', 'true');
    wheelEl.parentNode.appendChild(wheelHit);
    [wheelEl, wheelHit].forEach(function (w) {
      w.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        audio(); wake();
        wheelId = e.pointerId; lastY = e.clientY;
        wheelEl.classList.add('is-turning');
        try { w.setPointerCapture(e.pointerId); } catch (x) {}
      });
      w.addEventListener('pointermove', function (e) {
        if (wheelId !== e.pointerId) return;
        turn(e.clientY - lastY); lastY = e.clientY;
      });
      w.addEventListener('pointerup', wheelUp);
      w.addEventListener('pointercancel', wheelUp);
      w.addEventListener('wheel', function (e) {
        e.preventDefault();
        audio();
        turn(clamp(e.deltaY, -40, 40) * 0.5);
      }, { passive: false });
    });
    function wheelUp(e) { if (wheelId === e.pointerId) { wheelId = null; acc = 0; wheelEl.classList.remove('is-turning'); } }
    wheelEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); audio(); setVolume(volume + 1, true); pos -= 9; wheelEl.style.setProperty('--wheel-pos', pos + 'px'); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); audio(); setVolume(volume - 1, true); pos += 9; wheelEl.style.setProperty('--wheel-pos', pos + 'px'); }
    });
  }

  /* =============================================================
     DVD SAVER — the two-line PRESUNTA ENTROPÍA wordmark bouncing on aztec,
     changing to the next brand colour on every wall hit (classic DVD).
       · console screen: 4 s after the screen is switched OFF (brillo 0),
         or after 3 min without console input
       · whole page: after 5 min without any activity on the page
     Any input wakes it (the waking input is swallowed on the console).
     ============================================================= */
  var DVD_LOGO = '<svg viewBox="0 0 649.39 227.15" fill="currentColor" aria-hidden="true"><path d="M55.33,6c-4.76-2.66-10.79-4-17.9-4H0v103.38h15.51v-41.08h21.91c7.03,0,13-1.35,17.76-4,4.79-2.67,8.45-6.29,10.89-10.75,2.42-4.43,3.64-9.27,3.64-14.4v-4.28c0-5.12-1.2-9.92-3.57-14.25-2.39-4.36-6.03-7.93-10.82-10.61ZM54.2,31.72v2.57c0,10.47-5.79,15.35-18.21,15.35H15.51V16.65h20.49c6.25,0,10.91,1.4,13.84,4.16,2.94,2.77,4.37,6.34,4.37,10.91Z"/><path d="M139.51,6c-4.76-2.66-10.79-4-17.9-4h-40.08v103.38h15.51v-41.08h31.99c1.58,0,3.67.24,4.65,1.38.85,1,1.29,2.53,1.29,4.56v35.14h15.51v-37.71c0-3.75-.96-6.75-2.86-8.93-1.37-1.57-3.13-2.7-5.23-3.37,3.59-2.07,6.35-4.83,8.23-8.24,2.18-3.96,3.29-7.99,3.29-11.98v-4.28c0-5.12-1.2-9.92-3.57-14.25-2.39-4.36-6.03-7.93-10.82-10.61ZM138.39,31.72v2.57c0,10.47-5.79,15.35-18.21,15.35h-23.15V16.65h23.15c6.25,0,10.91,1.4,13.84,4.16,2.94,2.77,4.37,6.34,4.37,10.91Z"/><polygon points="232.3 90.72 182.94 90.72 182.94 60.87 230.59 60.87 230.59 46.22 182.94 46.22 182.94 16.65 231.44 16.65 231.44 2 167.43 2 167.43 105.37 232.3 105.37 232.3 90.72"/><path d="M287.16,45.66c-8.68-1.29-15.25-3.17-19.51-5.57-3.91-2.2-5.81-5.64-5.81-10.52v-.86c0-3.02.82-5.48,2.51-7.5,1.75-2.09,4.1-3.71,6.99-4.84,2.97-1.15,6.19-1.73,9.56-1.73,3.93,0,7.64.7,11.03,2.08,3.3,1.35,5.98,3.36,7.96,5.99,1.94,2.58,2.93,5.89,2.93,9.85v6.9h15.51v-7.75c0-5.72-1.51-11.05-4.47-15.84-2.96-4.77-7.27-8.65-12.81-11.54-5.51-2.88-12.24-4.34-20-4.34-6.69,0-12.7,1.21-17.86,3.59-5.2,2.4-9.35,5.74-12.32,9.92-3.01,4.23-4.53,9.21-4.53,14.79v1.71c0,9.12,3.25,16.06,9.66,20.62,6.14,4.38,14.44,7.34,24.67,8.8,8.33,1.19,14.38,3.1,17.98,5.68,3.39,2.43,5.04,5.88,5.04,10.55v.86c0,4.84-1.65,8.66-5.04,11.66-3.41,3.02-8.65,4.55-15.59,4.55-7.97,0-14.29-2.08-18.78-6.17-4.45-4.05-6.7-10.21-6.7-18.31v-5.19h-15.51v6.04c0,7.21,1.58,13.78,4.71,19.53,3.15,5.79,7.82,10.42,13.9,13.76,6.04,3.32,13.57,5,22.39,5,11.63,0,20.64-2.87,26.8-8.52,6.2-5.69,9.34-13.21,9.34-22.34v-1.71c0-8.08-2.69-14.66-7.98-19.55-5.19-4.79-13.28-8.01-24.04-9.58Z"/><path d="M385.98,69.95c0,7.5-1.74,13.25-5.18,17.08-3.44,3.83-8.44,5.69-15.31,5.69s-11.76-1.86-15.24-5.7c-3.48-3.83-5.25-9.57-5.25-17.07V2h-15.51v67.95c0,11.94,3.27,21.26,9.72,27.71,6.45,6.45,15.29,9.72,26.28,9.72s19.83-3.27,26.28-9.72c6.45-6.45,9.72-15.77,9.72-27.71V2h-15.51v67.95Z"/><polygon points="430.45 15.12 457.9 105.37 484.94 105.37 484.94 2 469.43 2 469.43 92.24 441.97 2 414.94 2 414.94 105.37 430.45 105.37 430.45 15.12"/><polygon points="495.53 16.65 521.33 16.65 521.33 103.98 536.83 87.72 536.83 16.65 562.39 16.65 562.39 2 495.53 2 495.53 16.65"/><path d="M585.43,80.55h40.15l7.27,24.82h16.53L618.08,2h-25.15l-31.31,103.38h16.53l7.27-24.82ZM589.75,65.9l15.76-53.66,15.76,53.66h-31.52Z"/><polygon points="15.51 180.65 63.15 180.65 63.15 166 15.51 166 15.51 136.43 64.01 136.43 64.01 121.78 0 121.78 0 225.15 64.86 225.15 64.86 210.5 15.51 210.5 15.51 180.65"/><polygon points="136.01 212.03 108.56 121.78 81.52 121.78 81.52 225.15 97.03 225.15 97.03 134.91 124.49 225.15 151.52 225.15 151.52 121.78 136.01 121.78 136.01 212.03"/><polygon points="167.43 136.43 190.74 136.43 190.74 225.15 206.25 225.15 206.25 136.43 232.3 136.43 232.3 121.78 167.43 121.78 167.43 136.43"/><path d="M302.15,125.78c-4.76-2.66-10.79-4-17.9-4h-37.42v103.38h15.51v-41.08h29.33c1.58,0,3.67.24,4.65,1.38.85,1,1.29,2.53,1.29,4.56v35.14h15.51v-37.71c0-3.75-.96-6.75-2.86-8.93-1.37-1.57-3.13-2.7-5.23-3.37,3.59-2.07,6.35-4.83,8.23-8.24,2.18-3.96,3.29-7.99,3.29-11.98v-4.28c0-5.12-1.2-9.92-3.57-14.25-2.39-4.36-6.03-7.93-10.82-10.61ZM301.02,151.5v2.57c0,10.47-5.79,15.35-18.21,15.35h-20.49v-32.99h20.49c6.25,0,10.91,1.4,13.84,4.16,2.94,2.77,4.37,6.34,4.37,10.91Z"/><path d="M365.5,119.78c-11.42,0-20.53,3.83-27.08,11.38-6.49,7.48-9.77,17.97-9.77,31.18v22.25c0,13.6,3.29,24.2,9.79,31.48,6.55,7.35,15.65,11.07,27.06,11.07s20.64-3.73,27.14-11.08c6.45-7.29,9.71-17.88,9.71-31.48v-22.25c0-13.21-3.26-23.7-9.7-31.18-6.51-7.55-15.64-11.38-27.15-11.38ZM386.84,163.2v20.54c0,9.28-1.83,16.51-5.44,21.5-3.53,4.88-8.73,7.26-15.9,7.26s-12.37-2.37-15.9-7.26c-3.61-4.99-5.44-12.23-5.44-21.5v-20.54c0-8.72,1.84-15.82,5.47-21.11,3.53-5.15,8.73-7.65,15.88-7.65s12.34,2.5,15.88,7.65c3.63,5.29,5.47,12.39,5.47,21.11Z"/><path d="M475.67,125.78c-4.76-2.66-10.79-4-17.9-4h-42.83v103.38h15.51v-41.08h27.32c7.03,0,13-1.35,17.76-4,4.79-2.67,8.46-6.29,10.89-10.75,2.41-4.42,3.64-9.27,3.64-14.4v-4.28c0-5.12-1.2-9.92-3.57-14.25-2.39-4.36-6.03-7.93-10.82-10.61ZM474.55,151.5v2.57c0,10.47-5.79,15.35-18.21,15.35h-25.89v-32.99h25.89c6.25,0,10.91,1.4,13.84,4.16,2.94,2.77,4.37,6.34,4.37,10.91Z"/><polygon points="495.53 136.43 521.21 136.43 521.21 210.5 495.53 210.5 495.53 225.15 550.84 225.15 555.17 210.5 536.72 210.5 536.72 136.43 562.39 136.43 562.39 121.78 495.53 121.78 495.53 136.43"/><path d="M592.93,121.78l-31.31,103.38h16.53l7.27-24.82h40.15l7.27,24.82h16.53l-31.31-103.38h-25.15ZM621.27,185.68h-31.52l15.76-53.66,15.76,53.66Z"/><polygon points="542.34 93.73 521.38 114.68 543.31 114.68 553.3 104.69 542.34 93.73"/></svg>';
  var DVD_COLORS = [P.white, P.yellow, P.fawnLight, P.yellowLight, P.cream2];
  var screenDvd = null, pageDvd = null;
  /* The logo is the footer's animated lottie (documents/presunta-anim.json,
     rendered with the lottie player Webflow already ships). Its 1920x1080
     canvas is cropped to the wordmark; frames 0-25 are the empty intro, so
     the bounce plays 26 -> 299 (letters roll in and settle) and the next
     bounce plays 299 -> 26, always alternating. The inline wordmark stays
     as the fallback when the player or the file is unavailable. */
  var DVD_LOT = { from: 26, to: 299, viewBox: '228 248 1464 579' };
  var dvdData = null;
  function lottiePlayer() {
    try { var m = window.Webflow && window.Webflow.require && window.Webflow.require('lottie'); return m && m.lottie; } catch (e) { return null; }
  }
  function dvdAnimation() {
    if (dvdData) return dvdData;
    var el = document.querySelector('[data-animation-type="lottie"][data-src*="presunta-anim"]');
    var url = el ? el.getAttribute('data-src') : '../documents/presunta-anim.json';
    dvdData = fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; });
    return dvdData;
  }
  var CONSOLE_IDLE = 180, PAGE_IDLE = 300;
  function makeDvd(host, cls) {
    var layer = document.createElement('div');
    layer.className = cls;
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="pe-dvd_logo">' + DVD_LOGO + '</div>';
    host.appendChild(layer);
    var logo = layer.firstChild, on = false, raf = 0, last = 0, ci = 0;
    var anim = null, forward = true;
    // swap the inline wordmark for the footer lottie once it is available
    function mountLottie() {
      var L = lottiePlayer();
      if (!L || anim) return;
      dvdAnimation().then(function (data) {
        if (!data || anim) return;
        logo.innerHTML = '';
        anim = L.loadAnimation({ container: logo, renderer: 'svg', loop: false, autoplay: false,
          animationData: JSON.parse(JSON.stringify(data)) });
        var svg = logo.querySelector('svg');
        if (svg) { svg.setAttribute('viewBox', DVD_LOT.viewBox); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
        logo.classList.add('is-lottie');
        anim.goToAndStop(DVD_LOT.to, true);
        measure();
      });
    }
    function playBounce() {
      if (!anim) return;
      anim.playSegments(forward ? [DVD_LOT.from, DVD_LOT.to] : [DVD_LOT.to, DVD_LOT.from], true);
      forward = !forward;
    }
    var x = 0, y = 0, vx = 0, vy = 0, W = 0, H = 0, lw = 0, lh = 0;
    function measure() { W = layer.clientWidth; H = layer.clientHeight; lw = logo.offsetWidth; lh = logo.offsetHeight; }
    function paint() { logo.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; }
    function hit() { ci = (ci + 1) % DVD_COLORS.length; logo.style.color = DVD_COLORS[ci]; playBounce(); }
    function frame(now) {
      raf = 0;
      if (!on) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (layer.clientWidth !== W || layer.clientHeight !== H) measure();
      x += vx * dt; y += vy * dt;
      var bx = false, by = false;
      if (x <= 0) { x = 0; vx = Math.abs(vx); bx = true; }
      else if (x + lw >= W) { x = W - lw; vx = -Math.abs(vx); bx = true; }
      if (y <= 0) { y = 0; vy = Math.abs(vy); by = true; }
      else if (y + lh >= H) { y = H - lh; vy = -Math.abs(vy); by = true; }
      if (bx || by) hit();
      paint();
      raf = requestAnimationFrame(frame);
    }
    var api = {
      mode: null,
      get on() { return on; },
      show: function (mode) {
        api.mode = mode || 'idle';
        if (on) return;
        on = true;
        layer.classList.add('is-on');
        mountLottie();
        measure();
        var sp = Math.max(36, Math.min(W, H) * 0.22);
        x = Math.random() * Math.max(1, W - lw); y = Math.random() * Math.max(1, H - lh);
        vx = sp * (Math.random() < 0.5 ? -1 : 1); vy = sp * 0.72 * (Math.random() < 0.5 ? -1 : 1);
        ci = Math.floor(Math.random() * DVD_COLORS.length); logo.style.color = DVD_COLORS[ci];
        last = 0; paint();
        if (!raf) raf = requestAnimationFrame(frame);
      },
      hide: function () {
        if (!on) return;
        on = false; api.mode = null;
        layer.classList.remove('is-on');
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    };
    return api;
  }
  // console input: resets the idle clock; wakes an idle saver (the waking
  // input does nothing else). A switched-off screen stays off.
  var consoleIdle = 0;
  function consoleActivity() {
    consoleIdle = 0;
    restT = 0; restN = 0;
    if (powerOn()) return true;
    if (screenDvd && screenDvd.on && screenDvd.mode === 'idle') { screenDvd.hide(); assist('saverWake'); return true; }
    return false;
  }
  // the page saver: its own clock (the console loop stops when scrolled away)
  var pageLast = Date.now();
  function anyVideoPlaying() {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
    if (videoView && videoView.playing && videoView.playing()) return true;
    return vids.some(function (v) { return !v.paused && !v.ended && !v.muted; });
  }
  function bindPageSaver() {
    pageDvd = makeDvd(document.body, 'pe-dvd is-page');
    var lastX = -1, lastY = -1;
    function activity() {
      pageLast = Date.now();
      if (pageDvd.on) pageDvd.hide();
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (t) {
      window.addEventListener(t, activity, { capture: true, passive: true });
    });
    window.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) < 6) return;   // ignore jitter
      lastX = e.clientX; lastY = e.clientY;
      activity();
    }, { capture: true, passive: true });
    setInterval(function () {
      if (pageDvd.on || document.hidden) return;
      if (Date.now() - pageLast < PAGE_IDLE * 1000) return;
      if (anyVideoPlaying()) { pageLast = Date.now(); return; }
      pageDvd.show('page');
    }, 1000);
  }

  var unlocked = false, wakePending = false;
  // first press after a silent boot: the start-up sound + a logo flash
  function wake() {
    if (!wakePending || !booted) return;
    wakePending = false;
    audio();
    sampleSoon('boot');
    bootSoundDone = true; bootSoundAt = performance.now();
  }
  /* Leaving the screensaver: the site's page-load animation, contained in the
     screen (yellow asterisk flickers in, a yellow line shoots out from the
     centre and fills the screen, then it fades to reveal the menu). The
     simpler boot line stays for the very first power-on only. */
  var wakeLayer = null, wakeRunning = false, bootSoundDone = false, bootSoundAt = 0;
  function enterFromAttract() {
    if (wakeRunning) return;
    if (!bootSoundDone) { bootSoundDone = true; bootSoundAt = performance.now(); sampleSoon('boot'); }
    else if (performance.now() - bootSoundAt > 1500) sampleSoon('gamestart');
    playWake(function () { go(launcher); });
  }
  function playWake(atFull) {
    if (!wakeLayer) {
      wakeLayer = document.createElement('div');
      wakeLayer.className = 'pe-screen_wake';
      var logo = $('.pe-screen_boot-logo svg', offEl);
      wakeLayer.innerHTML = '<div class="pe-screen_wake-line"></div><div class="pe-screen_wake-logo">' + (logo ? logo.outerHTML : '') + '</div>';
      screenEl.appendChild(wakeLayer);
    }
    wakeRunning = true;
    var w = wakeLayer;
    w.className = 'pe-screen_wake is-on';
    setTimeout(function () { w.classList.add('is-logo'); }, 100);          // logo flickers in
    setTimeout(function () { w.classList.add('is-line'); }, 500);          // line shoots out, fills
    setTimeout(function () { w.classList.add('is-logo-out'); if (atFull) atFull(); }, 1400);
    setTimeout(function () { w.classList.add('is-out'); }, 1700);          // reveal
    setTimeout(function () { w.className = 'pe-screen_wake'; wakeRunning = false; }, 2250);
  }
  /* Phones: iOS only lets audio start inside touchend/click (not pointerdown),
     and routes Web Audio through the ringer switch unless the page asks for
     the 'playback' session. Keep retrying on every gesture until the context
     really runs, and prime it with a silent buffer inside the gesture. */
  function audioUnlock() {
    if (unlocked && AC && AC.state === 'running') return;
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
    var ctx = audio();
    if (!ctx) return;
    try {
      var src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {}
    if (ctx.state === 'running') unlocked = true;
    else if (ctx.resume) ctx.resume().then(function () { unlocked = ctx.state === 'running'; }, function () {});
  }

  function setVolume(v, fromWheel) {
    var nv = clamp(v, 0, 10);
    if (nv === volume) { if (fromWheel) sfx('tick', volume); return; }
    volume = nv;
    store('pe-volume', volume);
    wheelEl.setAttribute('aria-valuenow', volume);
    if (!sound && volume > 0 && fromWheel) { sound = true; store('pe-sound', '1'); syncSoundKey(); }
    applyGain();
    if (window.PEMusic && window.PEMusic.master) window.PEMusic.master(volume / 10);
    renderVolBars();
    sfx('tick', volume);
    toast('Vol', { meter: [volume, 10] });
    assist(volume ? 'volume' : 'volumeZero', { n: volume });
    if (current && current.refresh) current.refresh();
  }
  function setSound(on) {
    sound = on;
    store('pe-sound', on ? '1' : '0');
    applyGain();
    renderVolBars();
    syncSoundKey();
    if (on) sfx('ok');
    if (on) toast('Sonido', { meter: [volume, 10] }); else toast('Silencio');
    assist(on ? 'soundOn' : 'soundOff');
    if (current && current.refresh) current.refresh();
  }
  function syncSoundKey() {
    $$('[data-pe-sound-key]', root).forEach(function (k) { k.classList.toggle('is-lit', sound); });
  }
  var entropySw = null;
  function syncEntropy() {
    if (!entropySw || !window.__peEntropy) return;
    var on = !!window.__peEntropy.active();
    if (on !== entropySw.classList.contains('is-on')) {
      entropySw.classList.toggle('is-on', on);
      entropySw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }
  function toggleEntropy() {
    if (window.__peEntropy) { window.__peEntropy.toggle(); syncEntropy(); }
    else {
      var sw = $('[data-entropy-switch]', root);
      sw.classList.toggle('is-on');
      sw.setAttribute('aria-checked', sw.classList.contains('is-on') ? 'true' : 'false');
    }
  }
  function bindEntropy() {
    var sw = $('[data-entropy-switch]', root);
    if (!sw) return;
    // In the shadow root entropy-mode.js can't find this switch, so we call its api
    // and mirror its state (syncEntropy runs from the loop). In light DOM it binds itself.
    sw.addEventListener('click', function () {
      audio(); wake();
      if (window.__peEntropy) { if (inShadow) { window.__peEntropy.toggle(); syncEntropy(); } }
      else {
        sw.classList.toggle('is-on');
        sw.setAttribute('aria-checked', sw.classList.contains('is-on') ? 'true' : 'false');
      }
    });
    entropySw = sw;
    syncEntropy();
    var last = sw.classList.contains('is-on');
    toggleEl = $('[data-pe-toggle]', root);
    if (toggleEl) toggleEl.classList.toggle('is-on', last);
    buddy.setChaos(last);
    new MutationObserver(function () {
      var on = sw.classList.contains('is-on');
      if (on === last) return;
      last = on;
      sfx(on ? 'whoosh' : 'thud');
      blinkLed();
      if (toggleEl) toggleEl.classList.toggle('is-on', on);
      buddy.setChaos(on);
      if (booted) { toast(on ? 'Modo caos' : 'Modo orden', 1300); assist(on ? 'entropyOn' : 'entropyOff'); }
      if (current && current.refresh) current.refresh();
    }).observe(sw, { attributes: true, attributeFilter: ['class'] });
  }

  /* =============================================================
     MAIN LOOP (only while visible)
     ============================================================= */
  var last = 0, raf = 0, frozen = false, entropyT = 0;   // frozen: test hook, see PEConsole.freeze
  function loop(now) {
    raf = 0;
    if (!visible || document.hidden || frozen) { last = 0; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    var saving = screenDvd && screenDvd.on;
    if (current && current.tick && !saving) current.tick(dt);
    if (!saving && booted) {
      consoleIdle += dt;
      if (videoView && videoView.playing && videoView.playing()) consoleIdle = 0;
      if (consoleIdle > CONSOLE_IDLE && screenDvd) screenDvd.show('idle');
    }
    buddy.tick(dt);
    ticker.tick(dt);
    syncBack();
    entropyT += dt;
    if (entropyT > 0.3) { entropyT = 0; syncEntropy(); }
    if (booted && !dockKind && current === launcher) { idleT += dt; if (idleT > 45) go(attract); }
    if (booted && !saving) restTick(dt);
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

  function boot() {
    offEl.classList.add('is-booting');
    fetchSamples();
    if (AC && AC.state === 'running') setTimeout(function () { sampleSoon('boot'); }, 300);
    else wakePending = true;
    setTimeout(function () {
      if (booted) return;                     // bootNow() got there first
      ledEl.classList.add('is-on');
      offEl.classList.add('is-gone');
      // docked as the site menu before it ever booted: keep the menu up.
      // Otherwise the console wakes on the launcher with the FECHAS card
      // selected (Juan, 8 Oct: the card, not the opened app); A opens it.
      if (current !== navView) {
        var hasFechas = false;
        apps.forEach(function (a) { if (a.id === 'fechas') hasFechas = true; });
        if (hasFechas) { launcher.focus('fechas'); go(launcher); } else go(attract);
      }
      booted = true;
      assist('boot');
    }, 1900);
  }

  // molded-plastic grain, generated once as a bitmap (cheap to composite)
  function makeGrain() {
    try {
      var c = document.createElement('canvas'), n = 128;
      c.width = n; c.height = n;
      var x = c.getContext('2d'), img = x.createImageData(n, n), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = Math.random();
        // dark flecks (walnut) and a few light ones, all very faint
        if (r < 0.5) { d[i] = 54; d[i + 1] = 34; d[i + 2] = 30; d[i + 3] = Math.random() * 38; }
        else if (r < 0.62) { d[i] = 232; d[i + 1] = 213; d[i + 2] = 196; d[i + 3] = Math.random() * 14; }
      }
      x.putImageData(img, 0, 0);
      hostEl.style.setProperty('--pe-grain', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) {}
  }

  /* The console lives in a shadow root. The home page's framework CSS carries
     :has() rules that watch class and text changes anywhere in the document,
     so every console update (a key press, a digit, a label) restyled all
     3,700 page elements: 18-40 ms each, the lag in the games. Inside a shadow
     root with layout/paint containment those updates cost nothing.
     The markup stays in the HTML (Webflow import); it is moved at runtime.
     Styles: every <link> to pe-console.css or <style data-pe-console-css>
     on the page is cloned into the shadow root. */
  function mountShadow(host) {
    if (!host.attachShadow) return host;
    var sr;
    try { sr = host.attachShadow({ mode: 'open' }); } catch (e) { return host; }
    $$('link[href*="pe-console.css"], link[href*="pe-music.css"], style[data-pe-console-css]').forEach(function (n) { sr.appendChild(n.cloneNode(true)); });
    var reset = document.createElement('style');
    reset.textContent = '*,*::before,*::after{box-sizing:border-box}' +
      'button{font:inherit;color:inherit;margin:0;-webkit-appearance:none;appearance:none}' +
      'p,span,div{margin:0}';
    sr.appendChild(reset);
    // everything except slotted light-DOM children (the chat mount) moves in
    Array.prototype.slice.call(host.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && n.hasAttribute('slot')) return;
      sr.appendChild(n);
    });
    inShadow = true;
    return sr;
  }

  /* Sub-pages carry the console only as the site menu: data-pe-menu-only on
     the host, parked off-screen in .pe-con-holder (css/pe-console-holder.css)
     until MENU docks it. They load no pe-music.js and no entropy-mode.js, so
     the music rows, the Modo entropía row, the ORDEN/CAOS slide and the idle
     page saver are left out there. Home (no attribute) is unchanged. */
  var MENU_ONLY_DROP = { 'Música': 1, music: 1, mvol: 1, song: 1, entropy: 1 };
  function menuOnly() { return !!(hostEl && hostEl.hasAttribute('data-pe-menu-only')); }
  function hasScript(name) { return !!document.querySelector('script[src*="' + name + '"]'); }

  /* the site's fullscreen menu <-> the console */
  function bindSiteMenu() {
    var realBtn = document.querySelector('.navbar_fixed-button-container .navbar_menu-button');
    var links = $$('.navbar_menu .navbar18_link');
    var mobile = function () { return window.innerWidth <= 767; };
    // phones: MENU raises the console sheet instead of the fullscreen menu
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.navbar_fixed-button-container .navbar_menu-button');
      if (!b || !mobile() || b.classList.contains('w--open')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      audio(); wake();
      openNav('sheet');
    }, true);
    // desktop, scrolled: when the fullscreen menu opens, the console slides in beside it
    if (realBtn) {
      var was = realBtn.classList.contains('w--open');
      new MutationObserver(function () {
        var open = realBtn.classList.contains('w--open');
        if (open === was) return;
        was = open;
        // any scroll at all counts: a half-visible console used to leave the
        // fullscreen menu open without the console (the in-between state)
        var scrolled = (window.scrollY || document.documentElement.scrollTop) > 0;
        if (open && !mobile() && (scrolled || !consoleInView)) { audio(); openNav('side'); }
        else if (!open && dockKind === 'side') {
          navMode = null; undock();
          links.forEach(function (a) { a.classList.remove('is-pe-hot'); });
          if (current === navView) go(navPrev && navPrev !== navView ? navPrev : launcher);
        }
      }).observe(realBtn, { attributes: true, attributeFilter: ['class'] });
    }
    // sync: console selection lights the big link; hovering a big link moves the console
    navView.setOnSelect(function (it) {
      if (dockKind !== 'side') return;
      links.forEach(function (a) { a.classList.toggle('is-pe-hot', !!it && a === it.el); });
    });
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () { if (dockKind === 'side') navView.selectHref(a.getAttribute('href')); });
    });
  }

  /* =============================================================
     INIT
     ============================================================= */
  function init() {
    hostEl = $('[data-pe-console]');
    if (!hostEl || hostEl.__peConsole) return;
    hostEl.__peConsole = true;
    root = mountShadow(hostEl);
    screenEl = $('[data-pe-screen]', root);
    stage = $('[data-pe-stage]', root);
    shakeEl = $('[data-pe-shake]', root);
    toastEl = $('[data-pe-toast]', root);
    dimEl = $('[data-pe-dim]', root);
    offEl = $('[data-pe-off]', root);
    ledEl = $('[data-pe-led]', root);
    statusApp = $('[data-pe-status-app]', root);
    statusVol = $('[data-pe-status-vol]', root);
    clockEl = $('[data-pe-clock]', root);
    wheelEl = $('[data-pe-wheel]', root);
    padEl = $('[data-pe-dpad]', root);
    speakerEl = $('[data-pe-speaker]', root);

    attract = makeAttract();
    launcher = makeLauncher();
    // the chat mounts into a light-DOM child slotted into the screen
    chatSlot = document.createElement('div');
    chatSlot.setAttribute('slot', 'chat');
    chatSlot.setAttribute('data-pe-chat-slot', '');
    chatSlot.style.cssText = 'position:absolute;inset:0;';
    hostEl.appendChild(chatSlot);
    var fechas = makeFechas(), packs = makePacks(), chat = makeChat(), galeria = makeGaleria(), video = makeVideo(), ajustes = makeAjustes();
    videoView = video;
    ajustesView = ajustes; recordsView = makeRecords(); aboutView = makeAbout();
    navView = makeNav();
    makeCloseKey();
    makeBackKey();
    bindHintTaps();
    // side-docked next to the fullscreen menu, the console sits outside
    // Webflow's nav element, and Webflow closes the menu on any document
    // click outside it. Clicks on the console stop at the console.
    hostEl.addEventListener('click', function (e) { if (dockKind === 'side') e.stopPropagation(); });
    sysmenu.mount(stage);
    applyLcd();

    GAMES = (window.PE_CONSOLE_GAMES || []).slice().sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
    apps = [{ id: 'fechas', title: 'Fechas', sub: 'Próximos talleres. Reserva desde aquí.', tag: 'RESERVAS', view: fechas, cardBg: P.yellow, cardFg: P.aztec },
      { id: 'packs', title: 'Packs', sub: 'Paga ahora, elige fecha después. O regálalo.', tag: 'PACKS', view: packs, cardBg: P.cream2, cardFg: P.aztec },
      { id: 'galeria', title: 'Galería', sub: 'El vídeo y un taller por dentro.', tag: 'VÍDEO', view: galeria, cardBg: P.walnut },
      { id: 'chat', title: 'Chat', sub: '¿Hablamos? Pregunta lo que quieras.', tag: 'EN DIRECTO', view: chat, cardBg: P.fawn, cardFg: P.white }];
    GAMES.forEach(function (g) {
      apps.push({ id: g.id, title: g.title, sub: g.tagline, tag: 'JUEGO', view: makeGameHost(g), game: g, cardBg: g.cardBg || P.aztec2, cardFg: g.cardFg || P.white });
    });
    apps.push({ id: 'ajustes', title: 'Ajustes', sub: 'Sonido, pantalla, asistente y récords.', view: ajustes, cardBg: P.walnutDark });

    makeGrain();
    renderVolBars();
    syncSoundKey();
    applyBright();
    wheelEl.setAttribute('aria-valuenow', volume);
    tickClock();
    setInterval(tickClock, 15000);
    buddy.init($('[data-pe-mini]', root));
    bindMusicTalk();
    ticker.init($('[data-pe-cart]', root));
    // the top slot LCD is also the music screen: waveform while a song plays,
    // hover/tap -> yellow, "Parar música" rises between two arrows (pe-music.js)
    if (window.PEMusic) {
      var cartEl = $('[data-pe-cart]', root);
      cartEl.removeAttribute('aria-hidden');
      var mus = document.createElement('div');
      cartEl.appendChild(mus);
      window.PEMusic.mount(mus);
      if (window.PEMusic.master) window.PEMusic.master(volume / 10);   // the wheel sets the music level too
    }
    screenDvd = makeDvd(screenEl, 'pe-dvd is-screen');
    powerEl = document.createElement('div');
    powerEl.className = 'pe-screen_power';
    powerEl.setAttribute('aria-hidden', 'true');
    powerEl.innerHTML = '<span class="pe-screen_power-line"></span>';
    screenEl.appendChild(powerEl);
    if (!menuOnly()) bindPageSaver();
    buddy.setEnabled(buddyOn);
    bindHardware();
    bindEntropy();
    if (menuOnly() && !hasScript('entropy-mode')) { var slideEl = $('[data-pe-toggle]', root); if (slideEl) slideEl.style.visibility = 'hidden'; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible = en.isIntersecting && en.intersectionRatio > 0.15;
        var inView = en.isIntersecting && en.intersectionRatio > 0.5;
        if (inView !== consoleInView) {
          consoleInView = inView;
          document.documentElement.classList.toggle('pe-con-in-view', inView);
          if (inView && window.Vanny && typeof window.Vanny.close === 'function') { try { window.Vanny.close(); } catch (e) {} }
        }
        if (visible) { if (!booted && !offEl.classList.contains('is-booting')) boot(); kick(); }
      });
    }, { threshold: [0, 0.15, 0.5] });
    io.observe(hostEl);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    bindSiteMenu();
    window.PEConsole = {
      nav: openNav, closeNav: closeNav,
      open: function (id) { apps.forEach(function (a) { if (a.id === id) { launcher.focus(id); go(a.view); } }); },
      apps: apps, sfx: sfx, P: P,
      press: function (k) { press(k, 'api'); }, release: function (k) { release(k); },
      // test hook: advance the active view by `sec` seconds synchronously (background tabs pause rAF)
      step: function (sec, fps) { var n = Math.round((sec || 1) * (fps || 60)); for (var i = 0; i < n; i++) { if (current && current.tick) current.tick(1 / (fps || 60)); buddy.tick(1 / (fps || 60)); ticker.tick(1 / (fps || 60)); } },
      // tap(k) releases immediately (safe inside synchronous step() scripts); tap(k, ms) holds for ms
      tap: function (k, ms) { press(k, 'api'); if (ms) setTimeout(function () { release(k); }, ms); else release(k); },
      freeze: function (on) { frozen = on !== false; if (!frozen) kick(); },
      // QA: make the assistant say an event now (same rules as the real thing), the
      // lines table, and which lines would be cut on the LCD at the current size
      say: assist, lines: SAY, heard: function () { return buddy.heard(); },
      fitCheck: function () {
        var bad = [];
        Object.keys(SAY).forEach(function (k) {
          (SAY[k].lines || []).forEach(function (l) {
            var txt = l.replace('{n}', '10').replace('{name}', 'equilibrio').replace('{track}', 'Mediterráneo');
            if (buddy.fits(txt) === false) bad.push(k + ': ' + txt);
          });
        });
        return bad;
      },
      toast: toast,
      // QA: show a saver now ('screen' | 'page'), or hide both
      saver: function (where) {
        if (where === 'page') pageDvd.show('page'); else if (where === 'screen') screenDvd.show('idle');
        else { pageDvd.hide(); screenDvd.hide(); }
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

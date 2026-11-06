/* =============================================================
   PE BAR — the wide console closing every footer (.pe-dockbar).
   Five units on the bar, all flat, all drawn like the PE-83 screens:
     RESERVAS  the console's launcher: FECHAS and PACKS cards
     JUEGO     Corre, chef: one-button horizontal runner
     MÚSICA    the live spectrum, big, with transport keys and the wheel
     CHEF      the assistant grown up: CHAT / FECHA / RÉCORD. The chat runs
               in his screen, which rises out of the bar to hold it
     ORDEN / CAOS  the switch and a tile field that shows it working
   CAOS isn't decoration: the game runs faster for double points, the
   spectrum breaks formation, the chef panics, the bar turns rust.

   The cart and MENU stay the real fixed controls and land in the bar
   (html.pe-bar-docked, js/hero-dock.js + css/pe-bar.css).

   Performance: nothing runs unless the bar is on screen. Every screen
   draws on a detached canvas and blits: ctx.font on a connected canvas
   forces a document style pass, and this site's :has() rules make that
   slow. Layout is read only on resize (ResizeObserver).
   ============================================================= */
(function () {
  'use strict';

  // the design tokens, read once. aztec 2 and 3, cream 2 and the light rust are the console's own
  // screen shades (--pe-aztec-2 and so on on .pe-con, in pe-console.css)
  var ROOT = getComputedStyle(document.documentElement);
  function tok(name, fallback) { return ROOT.getPropertyValue(name).trim() || fallback; }
  var P = {
    az: tok('--pe---color--aztec', '#0d161d'), az2: '#15222c', az3: '#1f303d',
    y: tok('--pe---color--fuel-yellow', '#efa02e'), yd: tok('--pe---color--fuel-yellow-dark', '#bf8024'),
    cream: tok('--pe---color--stark-white', '#e8d5c4'), cream2: '#c6baaf',
    rust: tok('--pe---color--mule-fawn', '#9b4933'), rustL: '#ad5840',
    walnut: tok('--pe---color--english-walnut', '#442b26')
  };
  var FONT = "'Space Grotesk', sans-serif";
  var BEST_KEY = 'pe-bar-run-best';
  var GAME = 'Corre, chef';
  var LINES = [
    '¿En qué puedo ayudarte?',
    '¿Buscas un taller?',
    'Pregúntame por las próximas fechas.',
    '¿Cocinamos algo juntos?'
  ];
  // CAOS has one voice across the site: the list lives in entropy-mode.js
  function chaosLines() {
    var E = window.__peEntropy;
    return (E && E.lines && E.lines.length) ? E.lines : LINES;
  }
  var GLITCH = '*#%&/=+~<>';
  // ORDEN and CAOS, from the approved design file (the same two as on the console)
  var SV_ORDEN = '<svg viewBox="0 0 23.27 23.27" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" d="M19.97,3.34L19.97,9.89L13.38,9.89L13.38,3.3L19.93,3.3L19.93,0L11.64,0L9.89,0L3.34,0L3.34,3.3L9.89,3.3L9.89,9.89L3.3,9.89L3.3,3.34L0,3.34L0,19.93L3.3,19.93L3.3,13.38L9.89,13.38L9.89,19.97L3.34,19.97L3.34,23.27L19.93,23.27L19.93,19.97L13.38,19.97L13.38,13.38L19.97,13.38L19.97,19.93L23.27,19.93L23.27,3.34L19.97,3.34Z"/></svg>';
  var SV_CAOS = '<svg viewBox="0 0 23.49 29.44" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.12,28.26L10.52,18.34L4.82,26.47L1.33,25.29L9.21,14.26L0,7.79L1.18,4.3L9.56,10.29L9.89,0L13.38,1.18L12.97,11.1L18.68,2.97L22.17,4.16L14.28,15.19L23.49,21.65L22.32,25.14L13.94,19.16L13.61,29.44L10.12,28.26Z"/></svg>';
  var LOGO = 'M101.82,77.78l-.65-14.31c-.03-.3-.23-.56-.52-.66l-32.86-10.82,4.41-3.46.04-.03,27.77-18.74c.43-.29.45-.92.03-1.24l-9.03-12.34c-.17-.49-.78-.67-1.19-.34l-26.21,20.89-.04.03-4.66,3.2-.08-5.61v-.05L60.7.8c.03-.52-.47-.91-.97-.77h-17.63c-.5-.14-1,.25-.97.77l1.86,33.5v.05l-.08,5.61-4.66-3.2-.04-.03L12,15.84c-.41-.33-1.02-.15-1.19.34L1.78,28.52c-.42.31-.4.94.03,1.24l27.77,18.74.04.03,4.41,3.46L1.17,62.81c-.29.1-.49.35-.52.66l-.65,14.31c0,.52.51.89,1,.73l37.81-12.8c2.33-.79,4.26-2.47,5.35-4.67l4.11-8.25c.52-1.04,1.54-1.53,2.54-1.5h.16c1-.04,2.02.45,2.54,1.49l4.11,8.25c1.1,2.2,3.02,3.88,5.35,4.67l37.81,12.8c.49.17,1.01-.2,1-.73h.04Z';   // presunta-icon.svg, the mark, viewBox 101.82 x 78.55
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
  var LEGS = ['..bb....bb..', '..bb.....bb.', '.bb.....bb..'];
  var FOOD = {
    tomato: { c: { r: P.rustL, g: P.yd }, m: ['...g...', '.rrgrr.', 'rrrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..'] },
    egg: { c: { w: P.cream, y: P.y }, m: ['..www..', '.wwwww.', 'wwyyyww', 'wwyyyww', 'wwwwwww', '.wwwww.', '..www..'] },
    cheese: { c: { y: P.y, d: P.yd }, m: ['.....yy', '...yyyy', '.yyyyyy', 'yyydyyy', 'yyyyyyd', 'ydyyyyy', 'yyyyyyy'] }
  };
  var HAZARD = {
    fire: [
      ['...r...', '..rr...', '..rrr..', '.rryrr.', '.ryyyr.', 'rryyyrr', 'rrrrrrr'],
      ['....r..', '...rr..', '..rrr..', '.rryrr.', '.ryyyr.', 'rryyyrr', 'rrrrrrr']
    ],
    pot: [['.......', '..www..', 'wwwwwww', '.ddddd.', '.ddddd.', '.ddddd.', '..ddd..']]
  };
  var HC = { r: P.rustL, y: P.y, w: P.cream2, d: P.az3 };

  var prm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function chaos() { return document.documentElement.classList.contains('modo-entropia'); }
  function prefersNoMotion() { return prm; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch (e) { return null; } return null; }
  function sfx(n) { try { if (window.PEConsole && PEConsole.sfx) PEConsole.sfx(n); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  var ICON = {
    prev: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M8 1 3 5l5 4zM1 1h1.6v8H1z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 1 5 4-5 4zM7.400 1H9v8H7.400z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 1 7 4-7 4z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1h2.400v8H2zM5.600 1H8v8H5.600z" fill="currentColor"/></svg>',
    left: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M8 1 2 5l6 4z" fill="currentColor"/></svg>',
    right: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 1 6 4-6 4z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 26.94 26.94" fill="currentColor" aria-hidden="true"><path d="M26.94 22.93L17.48 13.47L26.94 4.01L22.93 0L13.47 9.46L4.01 0L0 4.01L9.46 13.47L0 22.93L4.01 26.94L13.47 17.48L22.93 26.94Z"/></svg>',
  };

  /* ---------- one LCD: a visible canvas fed from a detached buffer ---------- */
  function Screen(host) {
    var cv = el('canvas');
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var buf = document.createElement('canvas'), b = buf.getContext('2d'), v = cv.getContext('2d');
    var s = { w: 0, h: 0, ctx: b, host: host };
    function size(W, H) {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = W; s.h = H;
      buf.width = cv.width = Math.round(W * dpr);
      buf.height = cv.height = Math.round(H * dpr);
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.imageSmoothingEnabled = false;
    }
    if (window.ResizeObserver) {
      new ResizeObserver(function (en) {
        var r = en[0].contentRect;
        if (r.width && r.height) { size(Math.round(r.width), Math.round(r.height)); needDraw = true; }
      }).observe(host);
    }
    var seed = host.getBoundingClientRect();
    if (seed.width) size(Math.round(seed.width), Math.round(seed.height));
    s.blit = function () { if (s.w) { v.drawImage(buf, 0, 0); } };
    return s;
  }
  function text(c, str, x, y, o) {
    o = o || {};
    c.font = (o.weight || 500) + ' ' + (o.size || 12) + 'px ' + FONT;
    c.textAlign = o.align || 'left';
    c.textBaseline = o.base || 'alphabetic';
    if (c.letterSpacing !== undefined) c.letterSpacing = (o.spacing || 0) + 'px';
    c.fillStyle = o.color || P.cream;
    c.fillText(str, x, y);
  }
  function wrap(c, str, max) {
    var words = String(str).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (c.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function art(c, rows, colors, x, y, u) {
    x = Math.round(x); y = Math.round(y);
    for (var r = 0; r < rows.length; r++) {
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (ch === '.') continue;
        c.fillStyle = colors[ch];
        c.fillRect(x + i * u, y + r * u, u, u);
      }
    }
  }
  // the screen's status line: where you are, in yellow, top left. Drawn on the
  // canvas because a DOM text change restyles this whole site.
  var STATUS = 26;
  function statusBar(c, W, title, right, rightColor) {
    c.fillStyle = P.az; c.fillRect(0, 0, W, STATUS);
    c.fillStyle = P.az3; c.fillRect(0, STATUS - 1, W, 1);
    var mid = Math.round(STATUS / 2) - 1, x = 11;
    c.fillStyle = P.y;
    c.beginPath(); c.moveTo(x, mid - 4); c.lineTo(x + 6, mid); c.lineTo(x, mid + 4); c.closePath(); c.fill();
    text(c, title.toUpperCase(), x + 12, mid + 1, { size: 12, weight: 700, color: P.y, spacing: 1.6, base: 'middle' });
    if (right) text(c, right, W - 10, mid + 1, { size: 12, weight: 700, color: rightColor || P.cream2, align: 'right', spacing: 0.6, base: 'middle' });
  }
  // the console's legend: a key cap and what it does
  function hint(c, x, y, cap, label, alignRight) {
    var fs = 10, cw = 15, ch = 15;
    c.font = '700 ' + fs + 'px ' + FONT;
    if (c.letterSpacing !== undefined) c.letterSpacing = '1px';
    var lw = c.measureText(label).width;
    if (alignRight) x -= cw + 6 + lw;
    c.fillStyle = P.y;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, cw, ch, 3); else c.rect(x, y, cw, ch);
    c.fill();
    text(c, cap, x + cw / 2, y + ch / 2 + 0.5, { size: 10, weight: 700, color: P.az, align: 'center', base: 'middle' });
    text(c, label, x + cw + 6, y + ch / 2 + 0.5, { size: fs, weight: 700, color: P.cream2, spacing: 1, base: 'middle' });
  }
  function chef(c, x, y, u, o) {
    o = o || {};
    var rows = SPRITE.slice();
    if (o.run !== undefined) rows[11] = LEGS[o.run];
    art(c, rows, { h: P.cream, y: P.y, b: P.y }, x, y, u);
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = P.az;
    var look = o.look || 0;
    if (o.mood === 'blink') {
      c.fillRect(x + 3 * u, y + 8 * u, 2 * u, u); c.fillRect(x + 7 * u, y + 8 * u, 2 * u, u);
    } else if (o.mood === 'sad') {
      c.fillRect(x + 3 * u, y + 7 * u, 2 * u, u); c.fillRect(x + 7 * u, y + 7 * u, 2 * u, u);
      c.fillRect(x + 4 * u, y + 10 * u, 4 * u, u);
    } else if (o.mood === 'panic') {
      c.fillRect(x + 3 * u, y + 6 * u, 2 * u, 2 * u); c.fillRect(x + 7 * u, y + 6 * u, 2 * u, 2 * u);
      c.fillRect(x + 5 * u, y + 9 * u, 2 * u, 2 * u);
    } else {
      c.fillRect(x + (3 + look) * u, y + 7 * u, u, 2 * u); c.fillRect(x + (8 + look) * u, y + 7 * u, u, 2 * u);
      if (o.mood === 'happy') { c.fillRect(x + 4 * u, y + 9 * u, u, u); c.fillRect(x + 7 * u, y + 9 * u, u, u); c.fillRect(x + 5 * u, y + 10 * u, 2 * u, u); }
      else c.fillRect(x + 5 * u, y + 10 * u, 2 * u, u);
      c.fillStyle = P.rustL;
      c.fillRect(x + 2 * u, y + 9 * u, u, u); c.fillRect(x + 9 * u, y + 9 * u, u, u);
    }
  }

  var needDraw = true;
  var bus = { best: parseInt(store(BEST_KEY), 10) || 0, last: 0, say: function () {} };

  /* ---------- JUEGO: Corre, chef ---------- */
  function Game(screen, btn) {
    var S = {
      mode: 'attract', y: 0, vy: 0, t: 0, dist: 0, score: 0, speed: 0, next: 0, things: [],
      over: 0, pops: [], record: false, scroll: 0
    };
    function unit() { return Math.max(2, Math.floor(screen.h / 42)); }
    function ground() { return screen.h - 24; }   // the key legend sits under the counter
    function reset(mode) {
      S.mode = mode; S.y = 0; S.vy = 0; S.dist = 0; S.score = 0; S.things = []; S.pops = [];
      S.next = 0.6; S.speed = 1; S.record = false; S.over = 0;
    }
    function jump() {
      if (S.y === 0) { S.vy = 1; sfx('nav'); } else { S.buffer = 0.13; }
    }
    function press() {
      if (S.mode === 'play') { jump(); return; }
      if (S.mode === 'over' && S.over < 0.35) return;
      reset('play'); jump(); sfx('go');
      bus.say('game');
    }
    btn.addEventListener('pointerdown', function (e) { if (e.button) return; e.preventDefault(); btn.focus({ preventScroll: true }); press(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(); }
    });
    function spawn() {
      var r = Math.random(), hard = chaos();
      var u = unit();
      if (r < 0.58) {
        S.things.push({ kind: 'hazard', art: Math.random() < 0.62 ? 'fire' : 'pot', x: screen.w + 10, w: 7 * u, h: 7 * u });
        if (hard && Math.random() < 0.3) S.things.push({ kind: 'hazard', art: 'fire', x: screen.w + 10 + 7 * u, w: 7 * u, h: 7 * u });
      } else {
        var names = Object.keys(FOOD);
        S.things.push({ kind: 'food', art: names[Math.floor(Math.random() * names.length)], x: screen.w + 10, w: 7 * u, h: 7 * u, lift: 0.5 + Math.random() * 0.4 });
      }
    }
    function step(dt) {
      S.t += dt;
      S.scroll += dt;
      if (S.mode === 'over') { S.over += dt; }
      var u = unit(), run = S.mode === 'play' || S.mode === 'attract';
      if (!run) return;
      var apex = u * 17, gUp = 1 / 0.36;                         // rise and fall in 0.72 s
      if (S.vy || S.y) {
        S.y += S.vy * dt * apex * 2 * gUp;
        S.vy -= dt * gUp;
        if (S.y <= 0) { S.y = 0; S.vy = 0; }
      }
      // a press just before landing counts, so a good reaction never feels ignored
      if (S.buffer > 0) { S.buffer -= dt; if (S.y === 0) { S.buffer = 0; S.vy = 1; sfx('nav'); } }
      var hot = chaos() ? 1.3 : 1;
      if (S.mode === 'play') S.speed = Math.min(2.1, S.speed + dt * 0.022);
      var vx = (screen.w * 0.42 + 120) * S.speed * hot;
      S.dist += vx * dt;
      S.next -= dt;
      // the gap is in time and never under one jump (0.72 s), so no run can become unwinnable
      if (S.next <= 0) { spawn(); S.next = 0.86 + Math.random() * 0.8; }
      var px = Math.round(screen.w * 0.14), g = ground(), cw = 12 * u, ch = 12 * u;
      for (var i = S.things.length - 1; i >= 0; i--) {
        var th = S.things[i];
        th.x -= vx * dt;
        if (th.x < -th.w - 6) { S.things.splice(i, 1); continue; }
        // the demo chef plays itself, so the screen is never idle
        if (S.mode === 'attract' && th.kind === 'hazard' && !S.y && th.x - px < cw + vx * 0.17 && th.x > px) { S.vy = 1; }
        var tTop = th.kind === 'food' ? g - th.h - apex * th.lift : g - th.h;
        var overX = th.x < px + cw - 2 * u && th.x + th.w > px + 2 * u;
        var chefTop = g - ch - S.y, overY = chefTop + 2 * u < tTop + th.h && chefTop + ch > tTop + u;
        if (overX && overY) {
          if (th.kind === 'food') {
            S.things.splice(i, 1);
            if (S.mode === 'play') {
              var add = chaos() ? 20 : 10;
              S.score += add; sfx('coin');
              S.pops.push({ x: th.x, y: tTop, t: 0, s: '+' + add });
              bus.say('food');
            }
          } else if (S.mode === 'play') {
            S.mode = 'over'; S.over = 0; sfx('fail');
            var fin = Math.floor(S.score);
            bus.last = fin;
            if (fin > bus.best) { bus.best = fin; S.record = true; store(BEST_KEY, fin); }
            bus.say(S.record ? 'record' : 'over');
            return;
          } else { S.things.splice(i, 1); }
        }
      }
      if (S.mode === 'play') S.score += dt * (chaos() ? 8 : 4);
      for (var p = S.pops.length - 1; p >= 0; p--) { S.pops[p].t += dt; if (S.pops[p].t > 0.7) S.pops.splice(p, 1); }
    }
    function draw() {
      var c = screen.ctx, W = screen.w, H = screen.h; if (!W) return;
      var u = unit(), g = ground(), hot = chaos();
      c.fillStyle = P.az; c.fillRect(0, 0, W, H);
      // the kitchen wall: two scroll speeds, no gradients
      var tile = u * 18, off = -(S.dist * 0.18 % tile);
      c.fillStyle = P.az2;
      for (var x = off; x < W; x += tile) c.fillRect(Math.round(x), 0, u, g);
      var shelf = Math.round(g * 0.36), o2 = -(S.dist * 0.4 % (u * 44));
      c.fillStyle = P.az3;
      for (var sx = o2; sx < W; sx += u * 44) {
        c.fillRect(Math.round(sx), shelf, u * 22, u);
        c.fillRect(Math.round(sx + u * 3), shelf - u * 5, u * 4, u * 5);
        c.fillRect(Math.round(sx + u * 11), shelf - u * 3, u * 6, u * 3);
      }
      // the line: a flat counter with ticks that sell the speed
      c.fillStyle = hot ? P.rust : P.yd; c.fillRect(0, g, W, u);
      c.fillStyle = P.az3;
      var o3 = -(S.dist % (u * 12));
      for (var tx = o3; tx < W; tx += u * 12) c.fillRect(Math.round(tx), g + u + 1, u * 5, Math.max(1, u >> 1));
      S.things.forEach(function (th) {
        if (th.kind === 'food') {
          var f = FOOD[th.art], bob = Math.round(Math.sin(S.t * 6 + th.x * 0.02) * u * 0.5);
          art(c, f.m, f.c, th.x, g - th.h - (u * 17) * th.lift + bob, u);
        } else {
          var fr = HAZARD[th.art], m = fr[Math.floor(S.t * 8) % fr.length];
          art(c, m, HC, th.x, g - th.h, u);
        }
      });
      var px = Math.round(screen.w * 0.14), ch = 12 * u;
      var airborne = S.y > 0, frame = S.mode === 'over' ? 0 : (airborne ? 0 : 1 + Math.floor(S.t * 11) % 2);
      chef(c, px, g - ch - S.y, u, { run: frame, look: 1, mood: S.mode === 'over' ? 'sad' : (hot ? 'panic' : (S.mode === 'play' ? 'happy' : '')) });
      S.pops.forEach(function (p) {
        text(c, p.s, p.x, p.y - p.t * 30, { size: Math.max(11, u * 6), weight: 700, color: P.y });
      });
      var right = '', rightC = null;
      if (S.mode === 'play') {
        right = (hot ? 'CAOS ×2  ' : '') + Math.floor(S.score);
        rightC = P.cream;
      } else if (bus.best) { right = 'RÉCORD ' + bus.best; }
      statusBar(c, W, 'Juego', right, rightC);
      if (S.mode === 'over') {
        var oy = STATUS + 8;
        text(c, S.record ? 'NUEVO RÉCORD: ' + bus.best : '¡SE QUEMÓ! ' + bus.last, W / 2, oy + 8, { size: 13, weight: 700, color: P.y, align: 'center', spacing: 1, base: 'middle' });
        hint(c, W - 10, H - 18, 'A', 'REPETIR', true);
      } else if (S.mode === 'attract') {
        text(c, GAME.toUpperCase(), W / 2, STATUS + 16, { size: 13, weight: 700, color: P.cream, align: 'center', spacing: 1.6, base: 'middle' });
        if (prm || Math.floor(S.t * 1.6) % 2 === 0) hint(c, W - 10, H - 18, 'A', 'JUGAR', true);
      }
      screen.blit();
    }
    reset('attract');
    return {
      tick: function (dt) { if (!prm || S.mode === 'play' || S.mode === 'over') step(dt); draw(); },
      playing: function () { return S.mode === 'play'; },
      draw: draw
    };
  }

  /* ---------- MÚSICA: the spectrum, big ---------- */
  function Music(screen, btn, keys) {
    var M = window.PEMusic, freq = new Uint8Array(256), t = 0, jit = [], titleT = 0, bass = 0;
    function draw() {
      var c = screen.ctx, W = screen.w, H = screen.h; if (!W) return;
      c.fillStyle = P.az; c.fillRect(0, 0, W, H);
      var guest = M && M.guest ? M.guest() : null;
      var hot = chaos(), on = !!(M && M.playing && M.playing()) || !!(guest && guest.playing());
      var live = !!(M && M.bytes && M.bytes(freq)), synth = !live && on;
      var top = STATUS + 20, room = H - top - 6;
      var px = Math.max(3, Math.round(room / 15)), col = px + 2, n = Math.floor((W - 8) / col), mid = Math.round(top + room / 2);
      var sum = 0;
      for (var i = 0; i < n; i++) {
        var d = Math.min(1, Math.abs(i - (n - 1) / 2) / (n / 2)), v;
        if (live) {
          var k = Math.min(255, Math.round(Math.exp(d * Math.log(120))));
          v = Math.min(1, Math.pow(freq[k] / 255, 1.15) * (0.85 + d * 1.6));
          if (d < 0.2) sum += v;
        } else if (synth) {
          var beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.72)), 6);
          v = (0.25 + 0.55 * beat) * (1 - d * 0.6) + 0.18 * Math.abs(Math.sin(t * 5.3 + i * 0.9) * Math.sin(t * 2.1 + i * 0.4));
          if (d < 0.2) sum += v;
        } else {
          v = 0.05 + 0.04 * (Math.sin(t * 1.5 + i * 0.5) * 0.5 + 0.5);
        }
        var cells = Math.max(1, Math.min(Math.floor(room / 2 / (px + 1)), Math.round(v * room / 2 / (px + 1))));
        if (hot) {
          // CAOS: every column leaves the line and walks on its own
          jit[i] = (jit[i] || 0) + (Math.random() - 0.5) * 3;
          jit[i] = clamp(jit[i] * 0.97, -room * 0.2, room * 0.2);
        } else if (jit[i]) { jit[i] *= 0.82; }
        var my = mid + Math.round((jit[i] || 0) / (px + 1)) * (px + 1);
        for (var j = 0; j < cells; j++) {
          var color = (on || live) ? (hot ? (i % 3 === 0 ? P.cream : (i % 3 === 1 ? P.rustL : P.y)) : (j > cells * 0.72 ? P.cream : P.y)) : P.az3;
          c.fillStyle = color;
          c.fillRect(4 + i * col, my - (j + 1) * (px + 1), px, px);
          c.fillRect(4 + i * col, my + j * (px + 1) + 1, px, px);
        }
      }
      bass += ((sum / Math.max(1, n * 0.2)) - bass) * 0.3;
      bus.bass = bass;
      var tr = M && M.track ? M.track() : null, right = '', pad = 11;
      var st = M && M.state ? M.state() : null;
      if (st && bus.volT <= 0) {
        var s = Math.floor(st.t || 0);
        right = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      }
      statusBar(c, W, 'Música', right);
      if (bus.volT > 0) {
        // the wheel: ten cells where the time was, while it's turning
        for (var vi = 0; vi < 10; vi++) {
          c.fillStyle = vi < bus.vol ? P.y : P.az3;
          c.fillRect(W - 10 - (10 - vi) * 6, 8, 4, 9);
        }
      }
      if (tr) {
        text(c, tr.title, pad, STATUS + 11, { size: 13, weight: 700, color: P.cream, base: 'middle' });
        c.font = '700 13px ' + FONT;
        var tw = c.measureText(tr.title).width;
        if (W > 300) text(c, tr.style, pad + tw + 10, STATUS + 11, { size: 11, color: P.cream2, base: 'middle' });
      }
      screen.blit();
    }
    function sync() {
      if (!M) return;
      var on = M.playing && M.playing();
      var guest = M.guest ? M.guest() : null;
      keys.play.textContent = guest ? guest.label() : (on ? 'Pausar' : 'Poner música');
    }
    if (M) {
      keys.prev.addEventListener('click', function () { M.prev(); sfx('nav'); });
      keys.next.addEventListener('click', function () { M.next(); sfx('nav'); });
      keys.play.addEventListener('click', function () { M.toggle(); sfx('click'); });
      // a mouse has the strip on hover; a finger gets it with the first tap, for
      // a few seconds, the way the console's music screen behaves
      var unit = btn.closest('.pe-bar_unit'), touch = false, shut = 0;
      // the keyboard gets it too; a mouse click's focus must not pin it open
      unit.addEventListener('focusin', function (e) {
        if (e.target.matches(':focus-visible')) unit.classList.add('is-open');
      });
      unit.addEventListener('focusout', function (e) {
        if (!unit.contains(e.relatedTarget)) unit.classList.remove('is-open');
      });
      btn.addEventListener('pointerdown', function (e) { touch = e.pointerType !== 'mouse'; });
      btn.addEventListener('click', function () {
        if (!touch) { M.toggle(); return; }
        unit.classList.add('is-open');
        clearTimeout(shut);
        shut = setTimeout(function () { unit.classList.remove('is-open'); }, 4000);
      });
      if (M.onChange) M.onChange(sync);
      sync();
    }
    return { tick: function (dt) { t += dt; if (bus.volT > 0) bus.volT -= dt; draw(); }, draw: draw };
  }

  /* ---------- VOL: a small ridged roller on the bar's right edge ----------
     The same volume as the console's wheel (PEConsole.volume), and it works the
     same way: drag up for louder, the mouse wheel over it, or the arrow keys. */
  function Wheel(w) {
    var pos = 0, acc = 0, id = null, last = 0, STEP = 9;
    function get() {
      var C = window.PEConsole;
      if (C && C.volume) return C.volume();
      var M = window.PEMusic;
      return M && M.master ? Math.round(M.master() * 10) : 6;
    }
    function set(v) {
      v = clamp(v, 0, 10);
      var C = window.PEConsole, M = window.PEMusic;
      if (C && C.volume) C.volume(v); else if (M && M.master) M.master(v / 10);
      w.setAttribute('aria-valuenow', v);
      bus.vol = v; bus.volT = 1.4;
    }
    function turn(px) {
      pos += px;
      w.style.setProperty('--pe-bar-wheel', pos + 'px');
      acc += px;
      while (Math.abs(acc) >= STEP) {
        var d = acc > 0 ? 1 : -1;       // up = louder
        acc -= d * STEP;
        set(get() + d);
      }
    }
    w.addEventListener('pointerdown', function (e) {
      id = e.pointerId; last = e.clientY;
      w.setPointerCapture(id); w.classList.add('is-turning');
      bus.vol = get(); bus.volT = 1.4;
      e.preventDefault();
    });
    w.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      turn(last - e.clientY); last = e.clientY;
    });
    function up(e) { if (e.pointerId === id) { id = null; w.classList.remove('is-turning'); } }
    w.addEventListener('pointerup', up);
    w.addEventListener('pointercancel', up);
    w.addEventListener('wheel', function (e) {
      e.preventDefault();
      turn(e.deltaY > 0 ? -STEP : STEP);
    }, { passive: false });
    w.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); turn(STEP); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); turn(-STEP); }
    });
  }

  /* ---------- RESERVAS: the month, with the real session days lit ---------- */
  function openCalendar(slug) {
    if (!document.getElementById('modal-1')) { location.href = 'todos-nuestros-talleres.html'; return; }
    var a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-modal-open', 'modal-1');
    if (slug) a.setAttribute('data-booking-item', slug);
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  /* the console's launcher, two cards: same copy, same legend, same slide */
  function Launcher(screen, btn) {
    var APPS = [
      { id: 'fechas', title: 'Fechas', tag: 'RESERVAS', sub: 'Próximos talleres. Reserva desde aquí.', bg: P.y },
      { id: 'packs', title: 'Packs', tag: 'PACKS', sub: 'Paga ahora, elige fecha después. O regálalo.', bg: P.cream2 }
    ];
    var at = 0, prev = -1, dir = 1, slide = 1, t = 0, hold = false, next = null, mark = null;
    var LEG = 22;                                 // the legend line at the foot
    function nextSession() {
      if (next !== null) return next;
      next = false;
      var db = window.PE_CMS, now = Date.now(), pick = null;
      ((db && db.sesiones) || []).forEach(function (s) {
        if (!s.iso || new Date(s.iso).getTime() < now) return;
        if (!pick || new Date(s.iso) < new Date(pick.iso)) pick = s;
      });
      if (pick) {
        var it = db.find ? db.find(pick.coleccion, pick.item) : null, f = function (o) {
          return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: 'Europe/Madrid' }, o)).format(new Date(pick.iso));
        };
        try {
          next = { day: f({ day: 'numeric' }), mon: f({ month: 'short' }).replace('.', '').toUpperCase(), title: (it && (it.nombre || it.titulo || it.title || it.name)) || '', slug: pick.item };
        } catch (e) { next = false; }
      }
      return next;
    }
    function asterisk() {
      if (mark !== null) return mark;
      mark = false;
      if (window.Path2D) { try { mark = new Path2D(LOGO); } catch (e) {} }
      return mark;
    }
    function rr(c, x, y, w, h, r) {
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    }
    function card(c, app, x, y, w, h) {
      var ink = P.az, pad = 10;
      c.fillStyle = app.bg; rr(c, x, y, w, h, 8); c.fill();
      // tag, as on the console's cards
      c.font = '700 9px ' + FONT;
      if (c.letterSpacing !== undefined) c.letterSpacing = '1.4px';
      var tw = Math.ceil(c.measureText(app.tag).width) + 13;
      c.fillStyle = ink; rr(c, x + pad, y + pad, tw, 16, 3); c.fill();
      text(c, app.tag, x + pad + 7, y + pad + 8.5, { size: 9, weight: 700, color: P.y, spacing: 1.4, base: 'middle' });
      // art, top right: the next date as the console's selected tile, or the mark
      var s = nextSession();
      if (app.id === 'fechas' && s) {
        var size = Math.min(38, Math.round(h * 0.42)), ax = x + w - pad - size, ay = y + pad;
        c.fillStyle = ink; rr(c, ax, ay, size, size, 5); c.fill();
        text(c, s.day, ax + size / 2, ay + size * 0.42, { size: Math.round(size * 0.5), weight: 700, color: P.y, align: 'center', base: 'middle' });
        text(c, s.mon, ax + size / 2, ay + size * 0.82, { size: 8, weight: 700, color: P.cream, align: 'center', spacing: 0.8, base: 'middle' });
      } else if (app.id === 'packs' && asterisk()) {
        var k = Math.min(36, h * 0.38) / 78.55, mx = x + w - pad - 101.82 * k, my = y + pad;
        c.save(); c.translate(mx, my); c.scale(k, k); c.fillStyle = ink; c.fill(mark); c.restore();
      }
      // title and line, at the foot of the card
      var sub = app.id === 'fechas' && s && s.title ? s.title : app.sub;
      var fs = 11, lh = 14;
      c.font = '500 ' + fs + 'px ' + FONT;
      if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      var ls = wrap(c, sub, w - pad * 2).slice(0, 2);
      var ts = clamp(Math.min(Math.round(w * 0.17), Math.round(h * 0.28)), 20, 34);
      var by = y + h - pad - ls.length * lh;
      text(c, app.title.toUpperCase(), x + pad - 1, by - 3, { size: ts, weight: 700, color: ink, spacing: -0.4 });
      ls.forEach(function (l, i) { text(c, l, x + pad, by + i * lh + 10, { size: fs, color: ink }); });
    }
    function legend(c, W, H) {
      var y = H - LEG + 3, x = 10;
      // the two-way key
      c.fillStyle = P.az3; rr(c, x, y, 28, 15, 3); c.fill();
      c.fillStyle = P.cream;
      c.beginPath(); c.moveTo(x + 11, y + 4); c.lineTo(x + 6, y + 7.5); c.lineTo(x + 11, y + 11); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + 17, y + 4); c.lineTo(x + 22, y + 7.5); c.lineTo(x + 17, y + 11); c.closePath(); c.fill();
      text(c, 'ELEGIR', x + 34, y + 8, { size: 10, weight: 700, color: P.cream2, spacing: 1, base: 'middle' });
      hint(c, W - 10, y, 'A', 'ABRIR', true);
    }
    function draw() {
      var c = screen.ctx, W = screen.w, H = screen.h; if (!W) return;
      c.fillStyle = P.az; c.fillRect(0, 0, W, H);
      statusBar(c, W, 'Reservas', '0' + (at + 1) + '/0' + APPS.length);
      var x = 6, y = STATUS + 6, w = W - 12, h = H - y - LEG - 2;
      c.save(); c.beginPath(); c.rect(0, STATUS, W, h + 12); c.clip();
      var e = 1 - Math.pow(1 - slide, 3), off = (1 - e) * (w + 8) * dir;
      if (slide < 1 && prev >= 0) card(c, APPS[prev], x + off - (w + 8) * dir, y, w, h);
      card(c, APPS[at], x + off, y, w, h);
      c.restore();
      legend(c, W, H);
      screen.blit();
    }
    function go(d) {
      prev = at; dir = d; slide = prefersNoMotion() ? 1 : 0; t = 0;
      at = (at + d + APPS.length) % APPS.length;
      btn.setAttribute('aria-label', APPS[at].title + '. ' + APPS[at].sub);
      needDraw = true;
    }
    function open() {
      if (APPS[at].id === 'packs') { location.href = 'packs.html'; return; }
      var s = nextSession();
      openCalendar(s && s.slug ? s.slug : null);
    }
    btn.setAttribute('aria-label', APPS[0].title + '. ' + APPS[0].sub);
    btn.addEventListener('click', function (e) {
      var r = btn.getBoundingClientRect();
      if (e.detail && e.clientY - r.top > r.height - LEG - 2 && e.clientX - r.left < r.width / 2) { go(1); sfx('nav'); return; }
      sfx('open'); open();
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); sfx('nav'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); sfx('nav'); }
    });
    btn.addEventListener('pointerenter', function () { hold = true; });
    btn.addEventListener('pointerleave', function () { hold = false; });
    btn.addEventListener('focus', function () { hold = true; });
    btn.addEventListener('blur', function () { hold = false; });
    return {
      tick: function (dt) {
        if (slide < 1) slide = Math.min(1, slide + dt / 0.28);
        if (!hold) { t += dt; if (t > 6) go(1); }
        draw();
      },
      draw: draw
    };
  }

  /* ---------- the chat, in the chef's screen ----------
     The site chat mounted inline, as the console does: a light-DOM target and
     a second widget instance that must not take over the page's Vanny api. */
  function Chat(unit, lcd) {
    var panel, wait, state = 'idle', open = false, saved = null;
    // the widget scrolls its target into view as it mounts, which throws the
    // page 300px and the chat off screen. Hold the page still until it has
    // settled; anything the person does themselves ends the hold.
    function holdScroll(ms) {
      var y = window.pageYOffset, until = performance.now() + ms;
      function stop() {
        window.removeEventListener('scroll', keep);
        ['wheel', 'touchmove'].forEach(function (n) { window.removeEventListener(n, stop); });
      }
      function keep() {
        if (performance.now() > until) { stop(); return; }
        if (window.pageYOffset !== y) window.scrollTo(0, y);
      }
      window.addEventListener('scroll', keep, { passive: true });
      ['wheel', 'touchmove'].forEach(function (n) { window.addEventListener(n, stop, { passive: true }); });
    }
    function fail() {
      state = 'failed';
      wait.innerHTML = 'El chat no responde ahora. <a href="contacto.html">Escríbenos en Contacto</a>.';
    }
    function load() {
      if (state !== 'idle') return;
      state = 'loading';
      var V = window.Vanny;
      saved = V ? { open: V.open, close: V.close, toggle: V.toggle } : null;
      var sc = document.createElement('script');
      sc.src = 'https://vanny.chat/vanny-widget.js';
      sc.async = true;
      sc.setAttribute('data-tenant', 'presunta-entropia');
      sc.setAttribute('data-mode', 'inline');
      sc.setAttribute('data-target', '[data-pe-bar-chat]');
      sc.onload = function () {
        if (saved && window.Vanny) { window.Vanny.open = saved.open; window.Vanny.close = saved.close; window.Vanny.toggle = saved.toggle; }
      };
      sc.onerror = fail;
      document.body.appendChild(sc);
      var t0 = Date.now(), slot = panel.querySelector('[data-pe-bar-chat]');
      (function poll() {
        var fr = slot.querySelector('iframe');
        if (fr) {
          state = 'ready';
          var done = function () { wait.hidden = true; };
          fr.addEventListener('load', done);
          setTimeout(done, 1500);
          return;
        }
        if (Date.now() - t0 > 8000) { fail(); return; }
        setTimeout(poll, 200);
      })();
    }
    function build() {
      panel = el('div', 'pe-bar_chat');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Chat con Presunta');
      panel.innerHTML =
        '<div class="pe-bar_chat-top"><span class="pe-bar_chat-title">Chat</span>' +
        '<button type="button" class="pe-bar_chat-close" aria-label="Cerrar el chat">' + ICON.close + '</button></div>' +
        '<div class="pe-bar_chat-frame" data-pe-bar-chat></div>' +
        '<div class="pe-bar_chat-wait">Conectando con Presunta…</div>';
      wait = panel.querySelector('.pe-bar_chat-wait');
      panel.querySelector('.pe-bar_chat-close').addEventListener('click', function () { set(false); });
      unit.appendChild(panel);
    }
    function set(v) {
      if (!panel) build();
      open = v;
      panel.classList.toggle('is-open', v);
      lcd.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) {
        if (window.Vanny && window.Vanny.close) { try { window.Vanny.close(); } catch (e) {} }
        holdScroll(5000);
        load();
        sfx('open');
      } else { lcd.focus({ preventScroll: true }); sfx('back'); }
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) set(false); });
    return { toggle: function () { set(!open); } };
  }

  /* ---------- CHEF: the assistant, grown up ---------- */
  function Agent(screen, btn, tabs, chat) {
    var mode = 0, t = 0, msgT = 0, idx = 0, shown = 0, kick = '', body = '', pinned = false;
    var mood = '', moodT = 0, blinkT = 2.5, blink = 0, jump = -1, react = 0;

    function nextDate() {
      var db = window.PE_CMS;
      if (!db || !db.sesiones || !db.sesiones.length) return null;
      var now = Date.now(), pick = null;
      db.sesiones.forEach(function (s) {
        if (!s.iso || new Date(s.iso).getTime() < now) return;
        if (!pick || new Date(s.iso) < new Date(pick.iso)) pick = s;
      });
      if (!pick) return null;
      var it = db.find ? db.find(pick.coleccion, pick.item) : null;
      var when = '';
      try {
        when = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(pick.iso));
      } catch (e) { when = pick.fecha || ''; }
      return { title: (it && (it.nombre || it.titulo || it.title || it.name)) || 'Próximo taller', when: when };
    }
    function load() {
      shown = 0; msgT = 0;
      var hot = chaos();
      if (mode === 0) {
        var pool = hot ? chaosLines() : LINES;
        kick = 'Hablar'; body = pool[idx++ % pool.length];
      } else if (mode === 1) {
        var d = nextDate();
        kick = 'Ver calendario';
        body = d ? d.title + ' · ' + d.when : 'Consulta el calendario de talleres.';
      } else {
        kick = 'Jugar';
        body = bus.best ? 'Tu récord: ' + bus.best + (bus.last ? ' · Última: ' + bus.last : '') : 'Aún no tienes récord. Juega al lado.';
      }
    }
    function setTab(i, user) {
      mode = i; if (user) pinned = true;
      tabs.forEach(function (b, k) {
        b.classList.toggle('is-on', k === i);
        b.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      btn.setAttribute('aria-label', i === 0 ? 'Abrir el chat' : (i === 1 ? 'Ver las fechas de talleres' : 'Jugar a ' + GAME));
      react = 0;
      load();
    }
    tabs.forEach(function (b, i) { b.addEventListener('click', function () { setTab(i, true); sfx('nav'); }); });
    btn.addEventListener('click', function () {
      if (mode === 0) chat.toggle();
      if (mode === 1) openCalendar();
      if (mode === 2) { var g = document.querySelector('.pe-bar_lcd.is-game'); if (g) g.focus({ preventScroll: true }); }
    });
    bus.say = function (ev) {
      if (ev === 'food') { jump = 0; return; }
      if (ev === 'game') { mood = 'happy'; moodT = 1.2; return; }
      if (ev === 'chaos') { setTabQuiet(); return; }
      mood = ev === 'record' ? 'happy' : 'sad'; moodT = 3;
      if (ev === 'record') jump = 0;
      setTab(2);
      pinned = false;
    };
    function setTabQuiet() { if (mode === 0) load(); }

    function draw() {
      var c = screen.ctx, W = screen.w, H = screen.h; if (!W) return;
      var hot = chaos();
      c.fillStyle = P.az; c.fillRect(0, 0, W, H);
      // on a narrow screen he gives up size for his text
      c.fillStyle = P.az3; c.fillRect(0, STATUS - 1, W, 1);
      var room = H - STATUS;
      var u = clamp(Math.min(Math.floor((room - 12) / 13), Math.floor(W * 0.27 / 12)), 2, 8), size = 12 * u, gx = Math.round(Math.min(H * 0.1, W * 0.05));
      var beat = Math.round(clamp((bus.bass || 0) * 1.6, 0, 1) * u);
      var hop = jump >= 0 ? Math.round(Math.sin(clamp(jump / 0.45, 0, 1) * Math.PI) * u * 3) : 0;
      var shake = hot && !prm ? Math.round((Math.random() - 0.5) * u) : 0;
      var cm = mood || (hot ? 'panic' : (blink > 0 ? 'blink' : ''));
      chef(c, gx + shake, STATUS + (room - size) / 2 + u - beat - hop, u, { mood: cm, look: mode === 2 ? -1 : 0 });
      var left = gx + size + Math.round(Math.min(H * 0.12, W * 0.06));
      var max = W - left - 10;
      if (max < 60) { screen.blit(); return; }
      var fs = clamp(Math.min(Math.round(H / 8.5), Math.round(W / 17)), 13, 17), lh = Math.round(fs * 1.25), top = STATUS + 10;
      c.font = '500 ' + fs + 'px ' + FONT;
      if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      var said = body.slice(0, Math.floor(shown));
      // CAOS: a letter or two flicker while it types and just after, then resolve
      if (hot && !prm && msgT < 1.6 && said.length > 3) {
        for (var g = 0; g < 2; g++) {
          var gi = Math.floor(Math.random() * said.length);
          if (said[gi] !== ' ') said = said.slice(0, gi) + GLITCH[Math.floor(Math.random() * GLITCH.length)] + said.slice(gi + 1);
        }
      }
      var ls = wrap(c, said, max);
      var lines = Math.max(1, Math.floor((H - top - 22) / lh));
      for (var i = 0; i < Math.min(ls.length, lines); i++) {
        text(c, ls[i], left, top + i * lh + Math.round(fs * 0.5), { size: fs, color: P.cream });
      }
      if (shown >= body.length && (prm || Math.floor(t * 2) % 2 === 0)) {
        var lastI = Math.min(ls.length, lines) - 1;
        if (lastI >= 0) {
          c.font = '500 ' + fs + 'px ' + FONT;
          c.fillStyle = P.y;
          c.fillRect(Math.round(left + c.measureText(ls[lastI]).width + 4), top + lastI * lh - Math.round(fs * 0.3), Math.round(fs * 0.45), Math.round(fs * 0.85));
        }
      }
      hint(c, left, H - 22, 'A', kick.toUpperCase());
      screen.blit();
    }
    function tick(dt) {
      t += dt; msgT += dt;
      shown = prm ? body.length : Math.min(body.length, shown + dt * 34);
      blinkT -= dt; if (blink > 0) blink -= dt;
      if (blinkT <= 0) { blink = 0.12; blinkT = 2.4 + Math.random() * 2.6; }
      if (moodT > 0) { moodT -= dt; if (moodT <= 0) mood = ''; }
      if (jump >= 0) { jump += dt; if (jump > 0.45) jump = -1; }
      if (msgT > 8) {
        if (pinned) { if (mode === 0) load(); else msgT = 0; }
        else setTab((mode + 1) % 3);
      }
      draw();
    }
    setTab(0);
    return { tick: tick, draw: draw };
  }

  /* ---------- ORDEN / CAOS: the tiles do what the switch says ---------- */
  function Tiles(screen) {
    var T = [], t = 0, ready = false, was = null;
    var COL = [P.y, P.cream, P.rustL];
    function layout() {
      var W = screen.w, H = screen.h - STATUS, s = clamp(Math.round(H / 4.5), 4, 10), gap = 2;
      var cols = Math.floor((W - 12) / (s + gap)), rows = Math.max(1, Math.floor((H - 8) / (s + gap))), n = cols * rows;
      var ox = (W - cols * (s + gap) + gap) / 2, oy = STATUS + (H - rows * (s + gap) + gap) / 2;
      T = [];
      for (var i = 0; i < n; i++) {
        var cx = i % cols, cy = Math.floor(i / cols);
        var hx = ox + cx * (s + gap), hy = oy + cy * (s + gap);
        T.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, c: COL[Math.floor(cx / cols * 3)], s: s, r: Math.random() });
      }
      ready = true;
    }
    function step(dt) {
      var W = screen.w, H = screen.h, hot = chaos();
      if (hot !== was) {
        if (hot && was !== null) { T.forEach(function (p) { p.vx = (p.r - 0.5) * 520; p.vy = (Math.random() - 0.5) * 320; }); }
        was = hot;
      }
      T.forEach(function (p) {
        if (hot) {
          p.vx += (Math.random() - 0.5) * 60; p.vy += (Math.random() - 0.5) * 60;
          p.vx *= 0.992; p.vy *= 0.992;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
          if (p.x > W - p.s) { p.x = W - p.s; p.vx = -Math.abs(p.vx); }
          if (p.y < STATUS) { p.y = STATUS; p.vy = Math.abs(p.vy); }
          if (p.y > H - p.s) { p.y = H - p.s; p.vy = -Math.abs(p.vy); }
        } else {
          // ORDEN: every tile goes home, hard and with a small overshoot
          p.vx += (p.hx - p.x) * dt * 90; p.vy += (p.hy - p.y) * dt * 90;
          p.vx *= 0.82; p.vy *= 0.82;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
      });
    }
    function draw() {
      var c = screen.ctx, W = screen.w, H = screen.h; if (!W) return;
      if (!ready || T.w !== W || T.h !== H) { layout(); T.w = W; T.h = H; }
      c.fillStyle = P.az; c.fillRect(0, 0, W, H);
      T.forEach(function (p) { c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); });
      statusBar(c, W, chaos() ? 'Caos' : 'Orden');
      screen.blit();
    }
    return { tick: function (dt) { t += dt; if (!prm) step(dt); draw(); }, draw: draw };
  }

  /* ---------- build + run ---------- */
  function init() {
    var bar = document.querySelector('[data-pe-dockbar]');
    if (!bar || bar.__peBar) return;
    bar.__peBar = true;

    bar.innerHTML =
      '<span class="pe-bar_screw is-tl"></span><span class="pe-bar_screw is-tr"></span>' +
      '<span class="pe-bar_screw is-bl"></span><span class="pe-bar_screw is-br"></span>' +
      '<div class="pe-bar_wheel" role="slider" tabindex="0" aria-orientation="vertical" aria-label="Volumen" aria-valuemin="0" aria-valuemax="10" aria-valuenow="6"><span class="pe-bar_wheel-ridges"></span></div>' +
      '<span class="pe-bar_vol" aria-hidden="true"><span class="pe-bar_silk">+</span><span class="pe-bar_silk is-v">Vol</span><span class="pe-bar_silk">−</span></span>' +
      '<div class="pe-bar_unit is-agenda"><div class="pe-bar_bezel"><div class="pe-bar_screen">' +
        '<button type="button" class="pe-bar_lcd is-agenda"></button>' +
      '</div></div></div>' +
      '<div class="pe-bar_unit is-game"><div class="pe-bar_bezel"><div class="pe-bar_screen">' +
        '<button type="button" class="pe-bar_lcd is-game" aria-label="Jugar a ' + GAME + '. Pulsa para saltar."></button>' +
      '</div></div></div>' +
      '<div class="pe-bar_unit is-music">' +
        '<div class="pe-bar_bezel"><div class="pe-bar_screen">' +
          '<button type="button" class="pe-bar_lcd is-music" aria-label="Reproducir o pausar la música"></button>' +
          '<div class="pe-bar_strip">' +
            '<button type="button" class="pe-bar_strip-key" data-k="prev" aria-label="Canción anterior">' + ICON.left + '</button>' +
            '<button type="button" class="pe-bar_strip-main" data-k="play">Poner música</button>' +
            '<button type="button" class="pe-bar_strip-key" data-k="next" aria-label="Canción siguiente">' + ICON.right + '</button>' +
          '</div>' +
        '</div></div>' +
      '</div>' +
      '<div class="pe-bar_unit is-agent"><div class="pe-bar_bezel"><div class="pe-bar_screen">' +
        '<div class="pe-bar_tabs" role="tablist" aria-label="Pantalla del chef">' +
          '<button type="button" class="pe-bar_tab" role="tab">Chat</button>' +
          '<button type="button" class="pe-bar_tab" role="tab">Fecha</button>' +
          '<button type="button" class="pe-bar_tab" role="tab">Récord</button>' +
        '</div>' +
        '<button type="button" class="pe-bar_lcd is-agent"></button>' +
      '</div></div></div>' +
      '<div class="pe-bar_unit is-side">' +
        '<div class="pe-bar_toggle">' +
          '<div class="pe-bar_toggle-labels">' +
            '<span class="pe-bar_silk">Orden</span>' +
            '<span class="pe-bar_silk"><span class="pe-bar_toggle-led"></span>Caos</span>' +
          '</div>' +
          '<button type="button" class="pe-bar_slide" role="switch" aria-checked="false" aria-label="Modo entropía">' +
            '<span class="pe-bar_slide-ico is-orden" aria-hidden="true">' + SV_ORDEN + '</span>' +
            '<span class="pe-bar_slide-ico is-caos" aria-hidden="true">' + SV_CAOS + '</span>' +
            '<span class="pe-bar_slide-knob"></span>' +
          '</button>' +
        '</div>' +
        '<div class="pe-bar_bezel"><div class="pe-bar_screen"><div class="pe-bar_lcd is-tiles" aria-hidden="true"></div></div></div>' +
      '</div>';

    var q = function (s) { return bar.querySelector(s); };
    var game = Game(Screen(q('.pe-bar_lcd.is-game')), q('.pe-bar_lcd.is-game'));
    var music = Music(Screen(q('.pe-bar_lcd.is-music')), q('.pe-bar_lcd.is-music'), {
      prev: q('[data-k="prev"]'), next: q('[data-k="next"]'), play: q('[data-k="play"]')
    });
    var chat = Chat(q('.pe-bar_unit.is-agent'), q('.pe-bar_lcd.is-agent'));
    var agent = Agent(Screen(q('.pe-bar_lcd.is-agent')), q('.pe-bar_lcd.is-agent'), Array.prototype.slice.call(bar.querySelectorAll('.pe-bar_tabs .pe-bar_tab')), chat);
    var agenda = Launcher(Screen(q('.pe-bar_lcd.is-agenda')), q('.pe-bar_lcd.is-agenda'));
    var tiles = Tiles(Screen(q('.pe-bar_lcd.is-tiles')));
    var units = [game, music, agent, agenda, tiles];
    Wheel(q('.pe-bar_wheel'));

    // two rows when five units won't fit in one (the tablet layout has its own)
    var phoneOrTablet = window.matchMedia ? matchMedia('(max-width: 991px)') : null;
    function fit() {
      bar.classList.toggle('is-stack', !(phoneOrTablet && phoneOrTablet.matches) && bar.clientWidth < 1240);
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(bar);

    // the controls land when the bar's last edge is on screen: an element at
    // that edge, so the bar's height at any layout doesn't matter
    // (phones keep cart and MENU at the top; only the music screen steps aside)
    var phone = window.matchMedia ? matchMedia('(max-width: 767px)') : null;
    var large = function () { return !(phone && phone.matches); };
    var end = el('span', 'pe-bar_end');
    bar.appendChild(end);
    new IntersectionObserver(function (en) {
      document.documentElement.classList.toggle('pe-bar-docked', en[0].isIntersecting && large());
    }, { threshold: 0 }).observe(end);
    new IntersectionObserver(function (en) {
      document.documentElement.classList.toggle('pe-bar-near', en[0].isIntersecting);
    }, { threshold: 0 }).observe(bar);

    // the switch: the same site-wide mode the hero and console switches drive
    var lever = q('.pe-bar_slide'), toggle = q('.pe-bar_toggle');
    function syncLever() {
      var on = chaos();
      lever.classList.toggle('is-on', on);
      toggle.classList.toggle('is-on', on);
      lever.setAttribute('aria-checked', on ? 'true' : 'false');
      bus.say('chaos');
      needDraw = true;
    }
    lever.addEventListener('click', function () {
      var E = window.__peEntropy;
      if (E && E.toggle) { E.toggle(); sfx('stamp'); }
    });
    document.addEventListener('pe:entropy', syncLever);
    syncLever();

    // nothing runs off screen; 30 fps is plenty for this art
    var raf = 0, last = 0, visible = false, acc = 0;
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; acc += dt;
      if (acc >= 1 / 31) {
        var step = Math.min(0.05, acc); acc = 0;
        if (prm && !game.playing()) { if (needDraw) { units.forEach(function (u) { u.tick(0); }); needDraw = false; } game.tick(step); }
        else units.forEach(function (u) { u.tick(step); });
      }
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }, { threshold: 0 }).observe(bar);
    document.addEventListener('visibilitychange', kick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

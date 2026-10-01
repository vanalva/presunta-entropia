/* PE-83 console game: PUNTO
   Cook each order exactly to the point. ▲▼ heat, A flip, B serve.
   Contract: ../GAME-API.md */
(function () {
  'use strict';

  var E = 0.433;                       // camera elevation, sin(E) ≈ 0.42 (3/4 view)
  var STEPS = [0.16, 0.32, 0.5, 0.68, 0.86];
  var BURNT = 0.86;
  var RAMPS = {
    solomillo: ['tomato', 'fawnLight', 'fawn', 'fawnDark', 'walnut', 'walnutDark'],
    huevo: ['white', 'cream2', 'yellowLight', 'yellowDark', 'fawn', 'walnutDark'],
    tortilla: ['yellowLight', 'yellowLight', 'yellow', 'yellowDark', 'fawn', 'walnutDark'],
    pan: ['white', 'yellowLight', 'yellow', 'yellowDark', 'fawn', 'walnut']
  };
  var CRUST = ['yellowDark', 'yellowDark', 'fawnLight', 'fawn', 'walnut', 'walnutDark'];
  var THICK = { solomillo: 0.42, huevo: 0.12, tortilla: 0.34, pan: 0.2 };
  var MENU = [
    { kind: 'solomillo', name: 'Solomillo', done: 'AL PUNTO', t: 0.56, hw: 0.08 },
    { kind: 'solomillo', name: 'Solomillo', done: 'POCO HECHO', t: 0.42, hw: 0.08 },
    { kind: 'huevo', name: 'Huevo', done: 'POCO HECHO', t: 0.36, hw: 0.08 },
    { kind: 'huevo', name: 'Huevo', done: 'BIEN HECHO', t: 0.62, hw: 0.08 },
    { kind: 'tortilla', name: 'Tortilla', done: 'CUAJADA', t: 0.6, hw: 0.08 },
    { kind: 'tortilla', name: 'Tortilla', done: 'JUGOSA', t: 0.44, hw: 0.08 },
    { kind: 'pan', name: 'Pan', done: 'TOSTADO', t: 0.66, hw: 0.08 },
    { kind: 'pan', name: 'Pan', done: 'DORADITO', t: 0.5, hw: 0.08 }
  ];
  var STAMPS = {
    punto: { label: '¡AL PUNTO!', bg: 'leaf', off: 'olive', fg: 'white' },
    casi: { label: 'CASI', bg: 'yellow', off: 'yellowDark', fg: 'walnut' },
    crudo: { label: 'CRUDO', bg: 'white', off: 'cream3', fg: 'fawn' },
    pasado: { label: 'PASADO', bg: 'fawnLight', off: 'fawnDark', fg: 'white' },
    quemado: { label: 'QUEMADO', bg: 'tomato', off: 'walnut', fg: 'white' }
  };
  var HEAT_RATE = [0.05, 0.085, 0.14];
  var HEAT_FLAME = [0.4, 0.7, 1];
  var HEAT_NAME = ['BAJO', 'MEDIO', 'ALTO'];
  var ORDER_TIME = 18, N = 6, DROP = 0.45;
  // flip timeline (s): dip → thrust → air → land
  var F_LAUNCH = 0.16, F_LAND = 0.66, F_END = 0.85;

  function c01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function stepOf(d) { var s = 0; for (var i = 0; i < STEPS.length; i++) if (d >= STEPS[i]) s = i + 1; return s; }
  function tone(P, kind, step) { return P[RAMPS[kind][Math.max(0, Math.min(5, step))]]; }
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
  function measure(ctx, A, s, size, spacing) {
    ctx.font = '700 ' + size + 'px ' + A.FONT;
    var ls = 'letterSpacing' in ctx;
    if (ls) ctx.letterSpacing = (spacing || 0) + 'px';
    var m = ctx.measureText(s).width;
    if (ls) ctx.letterSpacing = '0px';
    return m;
  }

  /* ---------- item art (top-down shape, flattened by the caller) ---------- */
  function shapePath(ctx, kind, r) {
    ctx.beginPath();
    if (kind === 'huevo') {
      ctx.ellipse(0, 0, r * 0.92, r * 0.84, 0, 0, Math.PI * 2);
      ctx.moveTo(r * 0.42 + r * 0.55, -r * 0.3); ctx.arc(r * 0.42, -r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.4 + r * 0.56, r * 0.28); ctx.arc(-r * 0.4, r * 0.28, r * 0.56, 0, Math.PI * 2);
    } else if (kind === 'pan') {
      var x = -r * 0.9, y = -r * 0.5, w = r * 1.8, h = r * 1.35, q = r * 0.2;
      ctx.moveTo(x + q, y);
      ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
      ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
      ctx.moveTo(r * 0.98, -r * 0.5); ctx.ellipse(0, -r * 0.5, r * 0.98, r * 0.44, 0, 0, Math.PI * 2);
    } else if (kind === 'solomillo') {
      ctx.ellipse(0, 0, r * 1.0, r * 0.9, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, 0, r * 1.04, r * 1.0, 0, 0, Math.PI * 2);
    }
  }
  var CHAR = [[-0.35, -0.2, 0.16], [0.3, 0.1, 0.2], [-0.05, 0.42, 0.12], [0.45, -0.38, 0.1]];
  function details(A, ctx, kind, step, r) {
    detailsBase(A, ctx, kind, step, r);
    if (step >= 5) {
      ctx.fillStyle = A.P.aztec;
      for (var i = 0; i < CHAR.length; i++) { ell(ctx, CHAR[i][0] * r, CHAR[i][1] * r, CHAR[i][2] * r, CHAR[i][2] * r * 0.8); ctx.fill(); }
    }
  }
  function detailsBase(A, ctx, kind, step, r) {
    var P = A.P;
    if (kind === 'solomillo') {
      if (step < 1) {
        ctx.fillStyle = P.fawnLight;   // raw marbling
        ell(ctx, r * 0.25, -r * 0.2, r * 0.32, r * 0.12); ctx.fill();
        ell(ctx, -r * 0.3, r * 0.3, r * 0.22, r * 0.08); ctx.fill();
        return;
      }
      ctx.save(); shapePath(ctx, kind, r); ctx.clip();
      ctx.fillStyle = step >= 5 ? P.aztec2 : tone(P, kind, step + 1);
      for (var k = -1; k <= 1; k++) {
        ctx.save(); ctx.translate(k * r * 0.52, 0); ctx.rotate(0.55);
        ctx.fillRect(-r * 0.075, -r * 1.6, r * 0.15, r * 3.2); ctx.restore();
      }
      ctx.restore();
    } else if (kind === 'huevo') {
      ctx.fillStyle = step >= 4 ? P.fawnDark : P.yellowDark;
      ell(ctx, -r * 0.1, r * 0.12, r * 0.34, r * 0.34); ctx.fill();
      ctx.fillStyle = step >= 5 ? P.fawn : P.yellow;
      ell(ctx, -r * 0.1, -r * 0.02, r * 0.34, r * 0.34); ctx.fill();
    } else if (kind === 'tortilla') {
      if (step < 1) return;
      ctx.fillStyle = step >= 5 ? P.aztec2 : tone(P, kind, step + 1);
      var dots = [[-0.42, -0.25, 0.11], [0.36, -0.38, 0.08], [0.12, 0.42, 0.12], [-0.25, 0.5, 0.07], [0.55, 0.18, 0.08], [-0.6, 0.15, 0.06]];
      for (var i = 0; i < dots.length; i++) { ell(ctx, dots[i][0] * r, dots[i][1] * r, dots[i][2] * r, dots[i][2] * r); ctx.fill(); }
    } else if (kind === 'pan') {
      ctx.save(); ctx.translate(0, r * 0.06); ctx.scale(0.8, 0.8);
      shapePath(ctx, kind, r); ctx.fillStyle = tone(P, kind, step); ctx.fill();
      ctx.restore();
    }
  }
  // a: flip angle around the horizontal axis (0 = resting, PI = flipped)
  function drawItem(A, ctx, kind, x, y, r, upStep, downStep, a, sx, sy, spin) {
    var P = A.P, sv = Math.sin(E + a), cv = Math.cos(E + a), sg = sv >= 0 ? 1 : -1;
    var show = sv >= 0 ? upStep : downStep, hid = sv >= 0 ? downStep : upStep;
    var ratio = Math.max(0.06, Math.abs(sv));
    var off = r * THICK[kind] * sg * cv;
    var faceCol = kind === 'pan' ? P[CRUST[show]] : tone(P, kind, show);
    var slabCol = kind === 'pan' ? P[CRUST[Math.min(5, hid + 1)]] : (hid >= 5 ? P.aztec : tone(P, kind, hid + 1));
    ctx.save();
    ctx.translate(x, y); ctx.rotate(spin || 0); ctx.scale(sx || 1, sy || 1);
    ctx.fillStyle = slabCol;
    var n = Math.max(2, Math.ceil(Math.abs(off) / 1.5));
    for (var i = n; i >= 1; i--) {
      ctx.save(); ctx.translate(0, off * i / n); ctx.scale(1, ratio); shapePath(ctx, kind, r); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.scale(1, ratio);
    shapePath(ctx, kind, r); ctx.fillStyle = faceCol; ctx.fill();
    details(A, ctx, kind, show, r);
    ctx.restore();
    ctx.restore();
  }

  /* ---------- stove + pan ---------- */
  function flamePath(ctx, x, y, w, h, lean) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.9, y - h * 0.55, x + lean, y - h);
    ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.55, x + w, y);
    ctx.arc(x, y, w, 0, Math.PI, false);
    ctx.closePath();
  }
  function drawFlames(A, ctx, cx, by, R, fl, t) {
    var P = A.P;
    for (var row = 0; row < 2; row++) {
      var n = row === 0 ? 7 : 6;
      for (var i = 0; i < n; i++) {
        var u = row === 0 ? (i / (n - 1)) * 2 - 1 : ((i + 0.5) / 6) * 2 - 1;
        var x = cx + u * R * (row === 0 ? 0.72 : 0.66);
        var fh = R * 0.72 * fl * (0.84 + 0.16 * Math.sin(t * 11 + i * 2.3 + row * 1.7)) * (1 - 0.3 * u * u) * (row === 0 ? 1.1 : 0.72);
        var fw = R * (row === 0 ? 0.12 : 0.085) * (0.7 + 0.4 * fl);
        flamePath(ctx, x, by + (row === 0 ? -R * 0.02 : R * 0.05), fw, fh, Math.sin(t * 6 + i * 1.3 + row) * fw * 0.35);
        ctx.fillStyle = row === 0 ? P.fawn : P.yellow;
        ctx.fill();
      }
    }
  }
  function drawPan(A, ctx, R) {
    var P = A.P, rx = R, ry = R * 0.42, wall = R * 0.2;
    // cream handle, behind the body
    ctx.save();
    ctx.translate(-rx * 0.9, ry * 0.15); ctx.rotate(-0.16);
    var hl = R * 0.8, hh = R * 0.17;
    ctx.fillStyle = P.cream3; A.rr(ctx, -hl, -hh / 2 + 3, hl, hh, hh / 2); ctx.fill();
    ctx.fillStyle = P.white; A.rr(ctx, -hl, -hh / 2, hl, hh, hh / 2); ctx.fill();
    ctx.fillStyle = P.aztec; ell(ctx, -hl + hh * 0.72, 0, hh * 0.2, hh * 0.2); ctx.fill();
    ctx.restore();
    // walnut body with a hard offset
    ctx.fillStyle = P.walnutDark; ell(ctx, 0, wall + 3, rx, ry); ctx.fill();
    ctx.fillStyle = P.walnut;
    ctx.fillRect(-rx, 0, rx * 2, wall);
    ell(ctx, 0, wall, rx, ry); ctx.fill();
    ell(ctx, 0, 0, rx, ry); ctx.fill();
    ctx.fillStyle = P.aztec3; ell(ctx, 0, ry * 0.08, rx * 0.86, ry * 0.8); ctx.fill();
  }
  function drawStove(A, ctx, cx, cy, R, fl, t, pa, inPan) {
    var P = A.P, by = cy + R * 1.08;
    ctx.fillStyle = P.aztec2; ell(ctx, cx, by + R * 0.08 + 3, R * 0.8, R * 0.13); ctx.fill();
    ctx.fillStyle = P.aztec3; ell(ctx, cx, by + R * 0.08, R * 0.8, R * 0.13); ctx.fill();
    // grate
    ctx.fillStyle = P.aztec3;
    A.rr(ctx, cx - R * 0.95, cy + R * 0.42, R * 0.07, by - cy - R * 0.3, R * 0.03); ctx.fill();
    A.rr(ctx, cx + R * 0.88, cy + R * 0.42, R * 0.07, by - cy - R * 0.3, R * 0.03); ctx.fill();
    A.rr(ctx, cx - R * 0.98, cy + R * 0.4, R * 1.96, R * 0.06, R * 0.03); ctx.fill();
    drawFlames(A, ctx, cx, by, R, fl, t);
    ctx.save();
    ctx.translate(cx + pa.ox, cy + pa.dy); ctx.rotate(pa.rot);
    drawPan(A, ctx, R);
    if (inPan) inPan(ctx);
    ctx.restore();
  }
  function drawPlate(A, ctx, x, y, R) {
    var P = A.P, rx = R * 0.82, ry = rx * 0.42;
    ctx.fillStyle = P.cream3; ell(ctx, x, y + R * 0.07, rx, ry); ctx.fill();
    ctx.fillStyle = P.white; ell(ctx, x, y, rx, ry); ctx.fill();
    ctx.strokeStyle = P.cream3; ctx.lineWidth = Math.max(1.5, R * 0.025);
    ell(ctx, x, y + ry * 0.04, rx * 0.7, ry * 0.68); ctx.stroke();
  }
  // pan dip → thrust → settle during a flip (f = seconds since A)
  function flipDy(ease, f, R) {
    if (f < 0) return 0;
    if (f < 0.14) return R * 0.13 * ease.outCubic(f / 0.14);
    if (f < 0.24) return R * 0.13 + (-R * 0.25) * ease.outCubic((f - 0.14) / 0.1);
    if (f < 0.5) return -R * 0.12 * (1 - ease.inOutSine((f - 0.24) / 0.26));
    return 0;
  }
  function catchDy(R, l, amp) { return l < 0 || l > 1.2 ? 0 : R * 0.07 * amp * Math.exp(-8 * l) * Math.sin(l * 26); }
  function squash(l, amp) {
    var S = l < 0 ? 0 : amp * Math.exp(-9 * l) * Math.cos(l * 21);
    return { sx: 1 + 0.26 * S, sy: 1 - 0.32 * S };
  }
  function restY(R, r, kind) { return R * 0.042 - r * THICK[kind] * 0.85; }
  function toWorld(cx, cy, pa, lx, ly) {
    var c = Math.cos(pa.rot), s = Math.sin(pa.rot);
    return { x: cx + pa.ox + lx * c - ly * s, y: cy + pa.dy + lx * s + ly * c };
  }

  (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
    id: 'punto',
    title: 'Punto',
    tagline: 'Cada pedido, justo en su punto.',
    order: 60,
    controls: [['▲▼', 'Fuego'], ['A', 'Voltear'], ['B', 'Servir']],

    preview: function (ctx, w, h, t, A) {
      var P = A.P, R = Math.min(h * 0.33, w * 0.2), cx = w / 2 + R * 0.3, cy = h - R * 1.25 - 4, r = R * 0.5;
      var kinds = ['tortilla', 'solomillo', 'pan', 'huevo'], Tp = 2.1;
      var n = Math.floor(t / Tp), lt = t - n * Tp, kind = kinds[Math.floor(n / 2) % 4];
      var f = lt - 0.55, landAt = 0.55 + F_LAND;
      var l = lt >= landAt ? lt - landAt : lt + Tp - landAt;
      var dy = (f >= 0 && f < 0.5 ? flipDy(A.ease, f, R) : 0) + catchDy(R, l, 1);
      var pa = { ox: 0, dy: dy, rot: dy / R * 0.6 };
      var steps = [2, 3], up = (n + (f >= F_LAND ? 1 : 0)) % 2;
      var upS = steps[up], dnS = steps[1 - up];
      var iy = restY(R, r, kind), air = f >= F_LAUNCH && f < F_LAND;
      var sq = squash(l, 1);
      if (f >= 0 && f < F_LAUNCH) { var kd = Math.sin(f / F_LAUNCH * Math.PI / 2); sq.sx *= 1 + 0.1 * kd; sq.sy *= 1 - 0.14 * kd; }
      drawStove(A, ctx, cx, cy, R, 0.78, t, pa, air ? null : function (c) {
        drawItem(A, c, kind, 0, iy, r, upS, dnS, 0, sq.sx, sq.sy, 0);
      });
      if (air) {
        var p = (f - F_LAUNCH) / (F_LAND - F_LAUNCH), rest = toWorld(cx, cy, pa, 0, iy);
        var H = Math.min(R * 1.5, rest.y - r * 1.2);
        drawItem(A, ctx, kind, rest.x + Math.sin(p * Math.PI) * R * 0.06, rest.y - H * 4 * p * (1 - p), r, upS, dnS,
          Math.PI * p, 1 - 0.06 * Math.sin(p * Math.PI), 1 + 0.1 * Math.sin(p * Math.PI), Math.sin(p * Math.PI) * 0.22);
      }
      // sizzle sparks on landing
      if (l < 0.35) {
        var k = l / 0.35, o = toWorld(cx, cy, pa, 0, iy);
        for (var j = 0; j < 6; j++) {
          var ang = -Math.PI / 2 + (j - 2.5) * 0.42, dist = R * 0.95 * A.ease.outCubic(k);
          ctx.fillStyle = j % 2 ? P.white : P.yellowLight;
          ell(ctx, o.x + Math.cos(ang) * dist, o.y + Math.sin(ang) * dist * 0.7, R * 0.035 * (1 - k) + 0.5, R * 0.035 * (1 - k) + 0.5);
          ctx.fill();
        }
      }
    },

    create: function (api) {
      var P = api.P, ease = api.ease;
      var orders = (function () {
        var out = [], rest, i, j, tmp;
        ['solomillo', 'huevo', 'tortilla', 'pan'].forEach(function (k) {
          out.push(api.pick(MENU.filter(function (m) { return m.kind === k; })));
        });
        rest = MENU.filter(function (m) { return out.indexOf(m) < 0; });
        for (i = rest.length - 1; i > 0; i--) { j = api.randi(0, i); tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp; }
        out.push(rest[0], rest[1]);
        for (i = out.length - 1; i > 0; i--) { j = api.randi(0, i); tmp = out[i]; out[i] = out[j]; out[j] = tmp; }
        return out;
      })();

      var oi = 0, o = null, score = 0, streak = 0, perfects = 0;
      var phase = 'drop', pt = 0, clock = ORDER_TIME, tt = 0, ticketT = 0;
      var d = [0, 0], down = 0, heat = 1, fl = HEAT_FLAME[1], fv = 0;
      var flipT = -1, swapped = false, lt = 9, landAmp = 0, landOn = 'pan';
      var puffs = [], sizAcc = 0, smokeAcc = 0, slotY = [0, 1], pulse = [0, 0];
      var queued = false, heatPop = 0, stamp = null, scored = false, lastTick = 99, ended = false;

      function lay() {
        var w = api.w, h = api.h, s = Math.min(w, h);
        var topY = 34, th = api.clamp(s * 0.19, 50, 84), tw = Math.min(w - 24, s * 1.05);
        var mh = api.clamp(s * 0.17, 46, 74), stripY = h - mh - 8;
        var areaTop = topY + th + 8, areaBot = stripY - 8, areaH = areaBot - areaTop;
        var R = Math.max(20, Math.min(s * 0.3, areaH * 0.46, w * 0.28));
        var cx = w / 2 + R * 0.3, cy = areaBot - R * 1.22;
        return {
          w: w, h: h, s: s, topY: topY, th: th, tw: tw, mh: mh, stripY: stripY, R: R, r: R * 0.5, cx: cx, cy: cy,
          plateX: Math.min(w - R * 0.82 - 10, cx + R * 1.05), plateY: cy + R * 0.28,
          stampX: w / 2, stampY: Math.max(cy - R * 0.3, topY + th + api.clamp(s * 0.075, 18, 34) * 1.3)
        };
      }
      function panAnim(L) {
        var R = L.R, dy = 0, rot = 0, ox = 0;
        if (flipT >= 0) { dy = flipDy(ease, flipT, R); rot = dy / R * 0.6; }
        if (landOn === 'pan') dy += catchDy(R, lt, landAmp);
        if (phase === 'serve') {
          var m = ease.outCubic(c01(pt / 0.3)) * (1 - ease.inOutSine(c01((pt - 0.75) / 0.4)));
          ox = -R * 0.24 * m; dy += -R * 0.14 * m; rot += 0.24 * m;
        }
        return { ox: ox, dy: dy, rot: rot };
      }
      function plateXNow(L) {
        var enter = ease.outCubic(c01(pt / 0.35)), exit = ease.inCubic(c01((pt - 2.2) / 0.4));
        return api.lerp(L.w + L.R, L.plateX, enter) + (L.w + L.R * 1.3 - L.plateX) * exit;
      }
      function plateTop(L) { return L.plateY - L.r * THICK[o.kind] * 0.9; }
      function itemState(L, pa) {
        var iy = restY(L.R, L.r, o.kind), sq = squash(lt, landAmp);
        if (phase === 'drop') {
          var k = c01(pt / DROP), rest = toWorld(L.cx, L.cy, pa, 0, iy);
          return { world: true, x: rest.x, y: api.lerp(-L.r * 2, rest.y, ease.inCubic(k)), a: -1.3 * (1 - ease.outCubic(k)), sx: 0.94, sy: 1.08, spin: 0.5 * (1 - k) };
        }
        if (phase === 'cook' && flipT >= F_LAUNCH && flipT < F_LAND) {
          var p = (flipT - F_LAUNCH) / (F_LAND - F_LAUNCH), r2 = toWorld(L.cx, L.cy, pa, 0, iy);
          var H = Math.max(L.R * 0.45, Math.min(L.R * 1.3, r2.y - (L.topY + L.th * 0.8) - L.r * 1.05));
          var sp = Math.sin(p * Math.PI);
          return { world: true, x: r2.x + sp * L.R * 0.06, y: r2.y - H * 4 * p * (1 - p), a: Math.PI * p, sx: 1 - 0.06 * sp, sy: 1 + 0.1 * sp, spin: sp * 0.22 };
        }
        if (phase === 'serve' && pt >= 0.25) {
          var px = plateXNow(L), py = plateTop(L);
          if (pt < 0.65) {
            var k2 = (pt - 0.25) / 0.4, e = ease.inOutSine(k2), s0 = toWorld(L.cx, L.cy, pa, 0, iy);
            return { world: true, x: api.lerp(s0.x, px, e), y: api.lerp(s0.y, py, e) - L.R * 0.35 * Math.sin(k2 * Math.PI), a: 0, sx: 1, sy: 1, spin: Math.sin(k2 * Math.PI) * 0.18 };
          }
          return { world: true, x: px, y: py, a: 0, sx: sq.sx, sy: sq.sy, spin: 0 };
        }
        var sx = sq.sx, sy = sq.sy;
        if (flipT >= 0 && flipT < F_LAUNCH) { var kd = Math.sin(flipT / F_LAUNCH * Math.PI / 2); sx *= 1 + 0.1 * kd; sy *= 1 - 0.14 * kd; }
        return { world: false, x: 0, y: iy, a: 0, sx: sx, sy: sy, spin: 0 };
      }
      function itemWorld(L) {
        var pa = panAnim(L), it = itemState(L, pa);
        return it.world ? { x: it.x, y: it.y } : toWorld(L.cx, L.cy, pa, it.x, it.y);
      }
      function land(where) {
        lt = 0; landAmp = 1; landOn = where;
        var L = lay(), p = itemWorld(L);
        api.burst(p.x, p.y + L.r * 0.2, {
          count: where === 'pan' ? 14 : 8, colors: where === 'pan' ? [P.white, P.yellowLight, P.yellow] : [P.white, P.cream2],
          speed: L.R * 2.4, gravity: L.R * 9, size: Math.max(3, L.R * 0.05), angle: -Math.PI / 2, spread: 1.2, life: 0.7, shape: 'dot'
        });
      }
      function puff(x, y, L) {
        puffs.push({ x: x, y: y, vx: api.rand(-0.15, 0.15) * L.R, vy: -L.R * api.rand(0.55, 0.85), r0: L.r * api.rand(0.2, 0.32), life: 0, max: api.rand(0.9, 1.3) });
      }
      function newOrder() {
        o = orders[oi]; d = [0, 0]; down = 0; phase = 'drop'; pt = 0; clock = ORDER_TIME;
        flipT = -1; swapped = false; queued = false; stamp = null; scored = false; slotY = [0, 1]; pulse = [0, 0];
        lastTick = 99; ticketT = 0; smokeAcc = 0;
      }
      function serve() { phase = 'serve'; pt = 0; flipT = -1; api.sfx('whoosh'); }
      function judge(L) {
        var lo = o.t - o.hw, hi = o.t + o.hw;
        function acc(v) { var dist = Math.abs(v - o.t); return dist <= o.hw ? 1 : Math.max(0, 1 - (dist - o.hw) / 0.22); }
        var a = (acc(d[0]) + acc(d[1])) / 2;
        var perfect = d[0] >= lo && d[0] <= hi && d[1] >= lo && d[1] <= hi;
        var pts = Math.round(a * 100), bonus = 0;
        if (perfect) { streak++; perfects++; bonus = streak >= 2 ? 20 * (streak - 1) : 0; } else streak = 0;
        score += pts + bonus;
        var mx = Math.max(d[0], d[1]), err = (d[0] - o.t) + (d[1] - o.t), st;
        if (perfect) st = STAMPS.punto;
        else if (mx >= BURNT) st = STAMPS.quemado;
        else if (a >= 0.8) st = STAMPS.casi;
        else if (err < 0) st = STAMPS.crudo;
        else st = STAMPS.pasado;
        stamp = { s: st, t: 0, pts: pts, bonus: bonus, streak: streak };
        api.sfx('stamp'); api.shake(3, 110);
        if (perfect) {
          api.sfx('coin');
          api.burst(L.stampX, L.stampY, { count: 28, colors: [P.yellow, P.leaf, P.white, P.fawnLight], speed: L.R * 3.2, gravity: L.R * 9, size: Math.max(4, L.R * 0.07), life: 1.1 });
        } else if (st === STAMPS.quemado) {
          for (var i = 0; i < 5; i++) puff(L.plateX + api.rand(-L.r, L.r), plateTop(L), L);
        }
      }
      function finish() {
        phase = 'end'; pt = 0;
        if (ended) return;
        ended = true;
        api.end({ score: score, label: 'Puntos', title: perfects >= 4 ? '¡Cocina al punto!' : 'Servicio cerrado', lines: ['Al punto: ' + perfects + ' de ' + N], fail: false, delay: 300 });
      }
      function cook(dt, L) {
        var rate = HEAT_RATE[heat], prev = d[down];
        d[down] = Math.min(1, d[down] + rate * dt);
        d[1 - down] = Math.min(1, d[1 - down] + rate * 0.04 * dt);
        var lo = o.t - o.hw, hi = o.t + o.hw;
        if (prev < lo && d[down] >= lo) {
          pulse[down] = 1; api.beep(740, 0.07, 'sine', 0.07); api.beep(1110, 0.09, 'sine', 0.06);
          lt = 0; landAmp = 0.45; landOn = 'pan';
          var yp = itemWorld(L); api.float(yp.x, yp.y - L.r * 1.1, '¡YA!', P.leaf, Math.round(api.clamp(L.s * 0.045, 13, 18)));
        }
        if (prev < BURNT && d[down] >= BURNT) { api.noise(0.35, { filter: 'lowpass', freq: 700, vol: 0.09 }); api.beep(110, 0.18, 'square', 0.05); }
        var pos = itemWorld(L);
        sizAcc += dt * (1.5 + heat * 3.5);
        while (sizAcc >= 1) {
          sizAcc -= 1;
          api.burst(pos.x + api.rand(-L.r, L.r), pos.y + L.r * 0.1, {
            count: 1, colors: [P.white, P.yellowLight], speed: L.R * 2.2, gravity: L.R * 7,
            size: Math.max(2, L.R * 0.04), angle: -Math.PI / 2, spread: 0.5, life: 0.55, shape: 'dot'
          });
        }
        var over = d[down] - hi;
        if (over > 0.03 || d[down] >= BURNT) {
          smokeAcc += dt * (d[down] >= BURNT ? 7 : 1.5 + over * 25);
          while (smokeAcc >= 1) { smokeAcc -= 1; puff(pos.x + api.rand(-L.r * 0.8, L.r * 0.8), pos.y + api.rand(0, L.r * 0.2), L); }
        }
      }

      /* ---------- drawing ---------- */
      function ticketPath(ctx, x, y, w, h, tz) {
        var q = 6, n = Math.max(6, Math.round(w / (tz * 2.4))), step = w / n, i;
        ctx.beginPath(); ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + q);
        ctx.lineTo(x + w, y + h - tz);
        for (i = n - 1; i >= 0; i--) { ctx.lineTo(x + (i + 0.5) * step, y + h); ctx.lineTo(x + i * step, y + h - tz); }
        ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y); ctx.closePath();
      }
      function drawTicket(ctx, L) {
        if (phase === 'end' || !o) return;
        var th = L.th, tw = L.tw, x0 = (L.w - tw) / 2, slide;
        if (phase === 'serve' && pt > 2.2) slide = -(th + 50) * ease.inCubic(c01((pt - 2.2) / 0.35));
        else slide = -(th + 50) * (1 - ease.outBack(c01(ticketT / 0.45)));
        var y0 = L.topY + slide, tz = Math.max(4, th * 0.08), pad = Math.max(8, th * 0.16);
        ticketPath(ctx, x0, y0 + 3, tw, th, tz); ctx.fillStyle = P.cream3; ctx.fill();
        ticketPath(ctx, x0, y0, tw, th, tz); ctx.fillStyle = P.white; ctx.fill();
        var ks = api.clamp(L.s * 0.026, 9, 11), ns = api.clamp(L.s * 0.062, 16, 28), ps = api.clamp(L.s * 0.03, 10, 13);
        api.text(ctx, 'COMANDA ' + (oi + 1) + '/' + N, x0 + pad, y0 + pad + ks * 0.8, { size: ks, color: P.fawn, spacing: 1.5 });
        api.asterisk(ctx, x0 + tw - pad - ks * 0.5, y0 + pad + ks * 0.4, ks * 0.62, P.fawn, 0);
        var ny = y0 + th * 0.56;
        api.text(ctx, o.name, x0 + pad, ny, { size: ns, color: P.walnut, baseline: 'middle' });
        var pw = measure(ctx, api, o.done, ps, 1.2) + ps * 1.4, ph = ps * 1.9;
        ctx.fillStyle = P.fawnDark; api.rr(ctx, x0 + tw - pad - pw, ny - ph / 2 + 2, pw, ph, ph / 2); ctx.fill();
        ctx.fillStyle = P.fawn; api.rr(ctx, x0 + tw - pad - pw, ny - ph / 2, pw, ph, ph / 2); ctx.fill();
        api.text(ctx, o.done, x0 + tw - pad - pw / 2, ny + 1, { size: ps, color: P.white, align: 'center', baseline: 'middle', spacing: 1.2 });
        // clock bar
        var by = y0 + th - tz - Math.max(6, pad * 0.6), bw = tw - pad * 2, k = c01(clock / ORDER_TIME);
        ctx.fillStyle = P.cream2; api.rr(ctx, x0 + pad, by, bw, 4, 2); ctx.fill();
        ctx.fillStyle = clock < 4 ? P.tomato : P.fawn; api.rr(ctx, x0 + pad, by, Math.max(4, bw * k), 4, 2); ctx.fill();
      }
      function miniFlame(ctx, x, y, w, h) { flamePath(ctx, x, y, w, h, 0); ctx.fill(); }
      function drawStrip(ctx, L) {
        var w = L.w, pad = 12, y = L.stripY, mh = L.mh, s = L.s;
        ctx.fillStyle = P.aztec2; api.rr(ctx, pad, y, w - pad * 2, mh, 10); ctx.fill();
        var heatW = api.clamp(s * 0.3, 84, 124);
        var mx0 = pad + 10, mx1 = w - pad - heatW - 4;
        ctx.fillStyle = P.aztec3; ctx.fillRect(mx1 + 2, y + 8, 2, mh - 16);
        var ls = api.clamp(s * 0.026, 9, 11), lw = measure(ctx, api, 'ARRIBA', ls, 1.2) + 8;
        var bx = mx0 + lw, bw = mx1 - bx - 10, bh = api.clamp(s * 0.03, 8, 12);
        var rows = [y + mh * 0.3, y + mh * 0.72];
        api.text(ctx, 'ARRIBA', mx0, rows[0], { size: ls, color: P.cream3, baseline: 'middle', spacing: 1.2 });
        api.text(ctx, 'ABAJO', mx0, rows[1], { size: ls, color: P.yellow, baseline: 'middle', spacing: 1.2 });
        if (o && phase !== 'end') {
          for (var i = 0; i < 2; i++) {
            var yy = api.lerp(rows[0], rows[1], slotY[i]), st = stepOf(d[i]);
            ctx.fillStyle = P.aztec3; api.rr(ctx, bx, yy - bh / 2, bw, bh, bh / 2); ctx.fill();
            ctx.fillStyle = P.walnut; api.rr(ctx, bx + bw * BURNT, yy - bh / 2, bw * (1 - BURNT), bh, bh / 2); ctx.fill();
            ctx.fillStyle = st >= 5 ? P.tomato : tone(P, o.kind, st);
            api.rr(ctx, bx, yy - bh / 2, Math.max(bh, bw * d[i]), bh, bh / 2); ctx.fill();
            var b0 = bx + bw * (o.t - o.hw), b1 = bx + bw * (o.t + o.hw), ext = 2 + bh * 0.3 * (1 + pulse[i] * 1.2), lwid = 2;
            ctx.fillStyle = P.leaf;
            ctx.fillRect(b0 - lwid, yy - bh / 2 - ext, lwid, bh + ext * 2);
            ctx.fillRect(b1, yy - bh / 2 - ext, lwid, bh + ext * 2);
            ctx.fillRect(b0 - lwid, yy - bh / 2 - ext, b1 - b0 + lwid * 2, lwid);
            ctx.fillRect(b0 - lwid, yy + bh / 2 + ext - lwid, b1 - b0 + lwid * 2, lwid);
            var mxp = bx + bw * d[i];
            ctx.fillStyle = P.white; ctx.beginPath();
            ctx.moveTo(mxp, yy - bh / 2 - 1); ctx.lineTo(mxp - 4, yy - bh / 2 - 8); ctx.lineTo(mxp + 4, yy - bh / 2 - 8); ctx.closePath(); ctx.fill();
          }
        }
        // heat
        var hx = w - pad - heatW, hc = hx + heatW / 2;
        var l1 = measure(ctx, api, 'FUEGO ', ls, 1.2), l2 = measure(ctx, api, HEAT_NAME[heat], ls, 1.2), lx = hc - (l1 + l2) / 2;
        api.text(ctx, 'FUEGO ', lx, rows[0], { size: ls, color: P.cream3, baseline: 'middle', spacing: 1.2 });
        api.text(ctx, HEAT_NAME[heat], lx + l1, rows[0], { size: ls, color: P.yellow, baseline: 'middle', spacing: 1.2 });
        for (var k = 0; k < 3; k++) {
          var sc = k === heat ? 1 + 0.35 * ease.outCubic(heatPop) : 1;
          var fx = hc + (k - 1) * heatW * 0.22, base = y + mh - 9;
          ctx.fillStyle = k <= heat ? P.yellow : P.aztec3;
          miniFlame(ctx, fx, base, mh * 0.075 * sc, mh * (0.24 + 0.07 * k) * sc);
        }
      }
      function drawStamp(ctx, L) {
        if (!stamp) return;
        var st = stamp.t, sc;
        if (st < 0.14) sc = 2.1 - 1.1 * ease.inCubic(st / 0.14);
        else sc = 1 - 0.12 * Math.exp(-10 * (st - 0.14)) * Math.cos((st - 0.14) * 30);
        if (phase === 'serve' && pt > 2.2) sc *= 1 - ease.inCubic(c01((pt - 2.2) / 0.3));
        if (phase === 'end') sc = 0;
        if (sc <= 0.01) return;
        var S = stamp.s, fs = api.clamp(L.s * 0.075, 18, 34);
        var tw = measure(ctx, api, S.label, fs, 2), bw = tw + fs * 1.1, bh = fs * 1.55;
        ctx.save(); ctx.translate(L.stampX, L.stampY); ctx.scale(sc, sc);
        ctx.fillStyle = P[S.off]; api.rr(ctx, -bw / 2, -bh / 2 + 4, bw, bh, 8); ctx.fill();
        ctx.fillStyle = P[S.bg]; api.rr(ctx, -bw / 2, -bh / 2, bw, bh, 8); ctx.fill();
        ctx.strokeStyle = P[S.fg]; ctx.lineWidth = Math.max(2, fs * 0.08);
        api.rr(ctx, -bw / 2 + 5, -bh / 2 + 5, bw - 10, bh - 10, 5); ctx.stroke();
        api.text(ctx, S.label, 0, fs * 0.04, { size: fs, color: P[S.fg], align: 'center', baseline: 'middle', spacing: 2 });
        ctx.restore();
        // points tab under the stamp, pops in after the slam
        var tk = c01((st - 0.18) / 0.25);
        if (tk <= 0) return;
        var ts = api.clamp(L.s * 0.036, 11, 15);
        var label = '+' + stamp.pts + (stamp.bonus ? '   RACHA x' + stamp.streak + ' +' + stamp.bonus : '');
        var pw = measure(ctx, api, label, ts, 1.2) + ts * 1.6, ph = ts * 1.9;
        var k2 = ease.outBack(tk) * (sc > 1 ? 1 : sc);
        ctx.save(); ctx.translate(L.stampX, L.stampY + bh * 0.62 + ph * 0.5); ctx.scale(k2, k2);
        ctx.fillStyle = P.aztec3; api.rr(ctx, -pw / 2, -ph / 2 + 3, pw, ph, ph / 2); ctx.fill();
        ctx.fillStyle = P.aztec2; api.rr(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
        api.text(ctx, label, 0, 1, { size: ts, color: stamp.pts >= 100 ? P.yellow : P.white, align: 'center', baseline: 'middle', spacing: 1.2 });
        ctx.restore();
      }

      newOrder();

      return {
        update: function (dt) {
          tt += dt; lt += dt; ticketT += dt;
          var L = lay();
          fv += ((HEAT_FLAME[heat] - fl) * 170 - fv * 13) * dt; fl += fv * dt;
          heatPop = Math.max(0, heatPop - dt * 3.5);
          pulse[0] = Math.max(0, pulse[0] - dt * 2.5); pulse[1] = Math.max(0, pulse[1] - dt * 2.5);
          for (var i = 0; i < 2; i++) slotY[i] += ((i === down ? 1 : 0) - slotY[i]) * Math.min(1, dt * 10);
          for (var j = puffs.length - 1; j >= 0; j--) {
            var p = puffs[j];
            p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.life >= p.max) puffs.splice(j, 1);
          }
          if (stamp) stamp.t += dt;
          if (phase === 'drop') {
            pt += dt;
            if (pt >= DROP) { phase = 'cook'; pt = 0; land('pan'); api.sfx('sizzle'); }
          } else if (phase === 'cook') {
            pt += dt; clock -= dt;
            if (flipT >= 0) {
              flipT += dt;
              if (flipT >= F_LAND && !swapped) {
                swapped = true; down = 1 - down;
                land('pan'); api.sfx('sizzle'); api.shake(2, 80);
              }
              if (flipT >= F_END) { flipT = -1; if (queued) { queued = false; serve(); } }
            }
            var air = flipT >= F_LAUNCH && flipT < F_LAND;
            if (!air) cook(dt, L);
            if (clock <= 4 && clock > 0 && Math.ceil(clock) !== lastTick) { lastTick = Math.ceil(clock); api.sfx('tick', 4 - lastTick); }
            if (clock <= 0 && flipT < 0) serve();
          } else if (phase === 'serve') {
            pt += dt;
            if (pt >= 0.65 && !scored) { scored = true; land('plate'); api.sfx('pop'); judge(L); }
            if (pt >= 2.65) { oi++; if (oi >= orders.length) finish(); else newOrder(); }
          }
        },
        draw: function (ctx) {
          var L = lay(), pa = panAnim(L), it = (o && phase !== 'end') ? itemState(L, pa) : null;
          var upS = stepOf(d[1 - down]), dnS = stepOf(d[down]), kind = o ? o.kind : 'tortilla';
          drawStove(api, ctx, L.cx, L.cy, L.R, fl, tt, pa, it && !it.world ? function (c) {
            drawItem(api, c, kind, it.x, it.y, L.r, upS, dnS, it.a, it.sx, it.sy, it.spin);
          } : null);
          if (phase === 'serve') drawPlate(api, ctx, plateXNow(L), L.plateY, L.R);
          if (it && it.world) drawItem(api, ctx, kind, it.x, it.y, L.r, upS, dnS, it.a, it.sx, it.sy, it.spin);
          for (var i = 0; i < puffs.length; i++) {
            var p = puffs[i], k = p.life / p.max;
            var rad = p.r0 * (0.45 + 0.75 * ease.outCubic(Math.min(1, k * 2.2))) * (k > 0.6 ? 1 - ease.inCubic((k - 0.6) / 0.4) : 1);
            if (rad < 0.5) continue;
            ctx.fillStyle = P.cream3; ell(ctx, p.x, p.y + rad * 0.25, rad, rad); ctx.fill();
            ctx.fillStyle = P.cream2; ell(ctx, p.x, p.y, rad, rad); ctx.fill();
          }
          drawTicket(ctx, L);
          drawStrip(ctx, L);
          drawStamp(ctx, L);
          api.hud(ctx, 'PEDIDO ' + Math.min(oi + 1, N) + '/' + N, score + ' PTS');
        },
        input: function (key, type) {
          if (type !== 'down') return;
          if (key === 'up' || key === 'down') {
            var nh = api.clamp(heat + (key === 'up' ? 1 : -1), 0, 2);
            if (nh !== heat) {
              heat = nh; heatPop = 1;
              api.beep(260 + heat * 130, 0.07, 'triangle', 0.08);
              if (key === 'up') api.noise(0.18, { filter: 'bandpass', freq: 900, to: 2400, vol: 0.05 });
            } else api.beep(150, 0.05, 'square', 0.04);
            return;
          }
          if (phase !== 'cook') return;
          if (flipT >= 0) { if (key === 'b') queued = true; return; }
          if (key === 'a') { flipT = 0; swapped = false; api.sfx('whoosh'); }
          else if (key === 'b') serve();
        },
        destroy: function () { puffs = []; }
      };
    }
  });
})();

/* =============================================================
   PE-83 · EMPLATADO
   Top-down pass. A plate turns under a pair of chef's tweezers
   that swing like a pendulum. Drop each element onto its dashed
   ghost. A full, slightly wonky plate beats an empty perfect one.
   ============================================================= */
(function () {
  'use strict';

  var TYPES = ['proteina', 'salsa', 'hoja', 'crumble', 'punto'];
  var PLATES = [
    { n: 3, base: 0.6, amp: 0, f: 0, pend: 2.6, sw: 0.2 },
    { n: 4, base: -0.75, amp: 0, f: 0, pend: 2.9, sw: 0.26 },
    { n: 4, base: 0.45, amp: 1.0, f: 0.9, pend: 3.1, sw: 0.3 },
    { n: 5, base: -0.85, amp: 0.5, f: 1.3, pend: 3.3, sw: 0.34 },
    { n: 5, base: 0.65, amp: 1.3, f: 1.05, pend: 3.5, sw: 0.4 }
  ];
  var CRUMBS = [[-0.065, -0.025, 0.05, 0.3], [0.025, -0.07, 0.042, -0.5], [0.075, 0.015, 0.05, 0.9],
    [-0.005, 0.04, 0.046, 0.2], [-0.085, 0.06, 0.03, -0.7], [0.055, 0.08, 0.032, 0.4]];

  function tones(P, type) {
    switch (type) {
      case 'proteina': return [P.fawn, P.walnut];
      case 'salsa': return [P.tomato, P.fawnDark];
      case 'hoja': return [P.leaf, P.olive];
      case 'crumble': return [P.walnut, P.walnutDark];
      default: return [P.yellow, P.yellowDark];
    }
  }

  // Shape at the origin, u = plate radius. tone: 'main' | 'dark' | 'ghost' | <flat colour for shadow>
  function paint(ctx, P, rr, type, u, tone) {
    u *= 1.25;
    var t = tones(P, type), ghost = tone === 'ghost';
    var col = tone === 'main' ? t[0] : tone === 'dark' ? t[1] : tone;
    if (ghost) {
      ctx.setLineDash([Math.max(3, u * 0.035), Math.max(2.5, u * 0.028)]);
      ctx.strokeStyle = P.cream3; ctx.lineWidth = Math.max(1.6, u * 0.018); ctx.lineJoin = 'round';
    } else ctx.fillStyle = col;
    function out() { if (ghost) ctx.stroke(); else ctx.fill(); }
    if (type === 'proteina') {
      rr(ctx, -0.17 * u, -0.105 * u, 0.34 * u, 0.21 * u, 0.055 * u); out();
      if (tone === 'main') {
        ctx.strokeStyle = t[1]; ctx.lineWidth = Math.max(1.5, u * 0.02); ctx.lineCap = 'round';
        for (var i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo((i * 0.085 - 0.04) * u, -0.06 * u); ctx.lineTo((i * 0.085 + 0.04) * u, 0.06 * u);
          ctx.stroke();
        }
      }
    } else if (type === 'salsa') {
      var r = 0.24 * u;
      ctx.beginPath();
      ctx.arc(0, r * 0.55, r, Math.PI * 1.13, Math.PI * 1.87, false);
      ctx.arc(0, r * 0.55 + r * 0.26, r * 0.93, Math.PI * 1.9, Math.PI * 1.1, true);
      ctx.closePath(); out();
    } else if (type === 'hoja') {
      var L = 0.14 * u, W = 0.12 * u;
      ctx.beginPath();
      ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -W, L, 0); ctx.quadraticCurveTo(0, W, -L, 0);
      ctx.closePath(); out();
      if (tone === 'main') {
        ctx.strokeStyle = t[1]; ctx.lineWidth = Math.max(1.2, u * 0.014); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-L * 1.25, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-L * 0.2, 0); ctx.lineTo(L * 0.15, -W * 0.32);
        ctx.moveTo(L * 0.2, 0); ctx.lineTo(L * 0.5, W * 0.26); ctx.stroke();
      } else if (!ghost) {
        ctx.fillRect(-L * 1.3, -u * 0.007, L * 0.4, u * 0.014);
      }
    } else if (type === 'crumble') {
      if (ghost) { ctx.beginPath(); ctx.arc(0, 0.012 * u, 0.13 * u, 0, Math.PI * 2); ctx.stroke(); }
      else {
        for (var c = 0; c < CRUMBS.length; c++) {
          var k = CRUMBS[c];
          ctx.save(); ctx.translate(k[0] * u, k[1] * u); ctx.rotate(k[3]);
          rr(ctx, -k[2] * u / 2, -k[2] * u / 2, k[2] * u, k[2] * u, k[2] * u * 0.25); ctx.fill();
          ctx.restore();
        }
      }
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 0.065 * u, 0, Math.PI * 2); out();
      ctx.beginPath(); ctx.arc(0.1 * u, -0.045 * u, 0.026 * u, 0, Math.PI * 2); out();
    }
    if (ghost) ctx.setLineDash([]);
  }

  // Solid element with its hard offset copy. Offset is always screen-down.
  function drawEl(ctx, P, rr, type, x, y, u, rot, sx, sy) {
    var off = Math.max(1.5, u * 0.03);
    ctx.save(); ctx.translate(x, y + off); ctx.rotate(rot); ctx.scale(sx || 1, sy || sx || 1);
    paint(ctx, P, rr, type, u, 'dark'); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx || 1, sy || sx || 1);
    paint(ctx, P, rr, type, u, 'main'); ctx.restore();
  }

  function drawPlate(ctx, P, x, y, R, ang) {
    ctx.fillStyle = P.walnut;
    ctx.beginPath(); ctx.arc(x, y + R * 0.06, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.white;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.cream2; ctx.lineWidth = Math.max(1.5, R * 0.018);
    ctx.beginPath(); ctx.arc(x, y, R * 0.8, 0, Math.PI * 2); ctx.stroke();
    // two rim marks so the spin always reads
    ctx.lineWidth = Math.max(2, R * 0.03); ctx.lineCap = 'round';
    for (var i = 0; i < 2; i++) {
      var a = ang + i * Math.PI;
      ctx.beginPath(); ctx.arc(x, y, R * 0.9, a - 0.16, a + 0.16); ctx.stroke();
    }
  }

  function rot2(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function layout(n) {
    var types = shuffle(TYPES.slice()).slice(0, n), ghosts = [], sep = n >= 5 ? 0.4 : 0.46;
    for (var tries = 0; tries < 600 && ghosts.length < n; tries++) {
      var big = types[ghosts.length] === 'proteina' || types[ghosts.length] === 'salsa';
      var rmax = big ? 0.5 : 0.6;
      var r = Math.sqrt(Math.random()) * rmax, a = Math.random() * Math.PI * 2;
      var x = Math.cos(a) * r, y = Math.sin(a) * r, ok = true;
      for (var g = 0; g < ghosts.length; g++) {
        if (Math.hypot(ghosts[g].x - x, ghosts[g].y - y) < sep) { ok = false; break; }
      }
      if (tries > 400) sep *= 0.995;
      if (ok) ghosts.push({ type: types[ghosts.length], x: x, y: y, rot: Math.random() * Math.PI * 2, filled: false });
    }
    return ghosts;
  }

  window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || [];
  window.PE_CONSOLE_GAMES.push({
    id: 'emplatado',
    title: 'Emplatado',
    tagline: 'Mejor un plato lleno que uno perfecto.',
    order: 40,
    controls: [['A', 'Soltar'], ['◀▶', 'Apuntar'], ['B', 'Cambiar']],

    preview: function (ctx, w, h, t, api) {
      var P = api.P, s = Math.min(w, h), R = s * 0.36, cx = w / 2, cy = h * 0.54;
      var period = 6, lt = t % period, ang = t * 0.5;
      var G = [{ type: 'salsa', x: -0.1, y: -0.32, rot: 0.3 }, { type: 'proteina', x: 0.05, y: 0.05, rot: -0.4 },
        { type: 'hoja', x: 0.42, y: 0.2, rot: 1.1 }, { type: 'crumble', x: -0.38, y: 0.3, rot: 0 }, { type: 'punto', x: 0.36, y: -0.3, rot: 0 }];
      var out = lt > 5.3 ? api.ease.inCubic(api.clamp((lt - 5.3) / 0.35, 0, 1)) : 0;
      drawPlate(ctx, P, cx, cy, R, ang);
      for (var i = 0; i < G.length; i++) {
        var g = G[i], land = 0.5 + i * 0.85, p;
        if (lt < land - 0.32 || out > 0.99) {
          // dashed ghost, turning with the plate
          p = rot2(g.x * R, g.y * R, ang);
          ctx.save(); ctx.translate(cx + p[0], cy + p[1]); ctx.rotate(g.rot + ang);
          paint(ctx, P, api.rr, g.type, R, 'ghost'); ctx.restore();
          continue;
        }
        if (lt < land) {
          var k = api.clamp((lt - (land - 0.32)) / 0.32, 0, 1), e = api.ease.inCubic(k);
          var la = (t - lt + land) * 0.5;
          p = rot2(g.x * R, g.y * R, la);
          var sc = api.lerp(1.3, 1, e);
          ctx.fillStyle = P.cream3;
          ctx.save(); ctx.translate(cx + p[0], cy + p[1]); ctx.rotate(g.rot + la);
          paint(ctx, P, api.rr, g.type, R * api.lerp(0.7, 1, e), P.cream3); ctx.restore();
          drawEl(ctx, P, api.rr, g.type, cx + p[0], cy + p[1] - (1 - e) * R * 0.5, R * sc, g.rot + la);
          continue;
        }
        var q = api.clamp((lt - land) / 0.35, 0, 1), sq = 1 + 0.25 * (1 - api.ease.outElastic(q));
        p = rot2(g.x * R, g.y * R, ang);
        var so = 1 - out;
        drawEl(ctx, P, api.rr, g.type, cx + p[0], cy + p[1], R * so, g.rot + ang, sq, sq * 0.94);
      }
    },

    create: function (api) {
      var P = api.P;
      var plateIdx = 0, score = 0, ended = false;
      var plate = null, placed = [], splats = [], sup = [], cur = null, curSwapped = false, retries = 0;
      var phase = 'play', phaseT = 0, stampHit = false;
      var phi = 0, theta = 0, thetaV = 0, aim = 0, aimV = 0;
      var reload = 0, openT = 0, swapT = 0, falling = null, lastTick = 99, streak = 0;
      var results = [];

      function geo() {
        var w = api.w, h = api.h, s = Math.min(w, h);
        var R = Math.min(w * 0.38, h * 0.32);
        var cy = Math.min(h * 0.6, h - R * 1.12);
        var cx = w / 2;
        var L = Math.max(h * 1.1, R * 3);
        var lift = R * 0.24;
        var tipY0 = cy - R * 0.08;
        return { w: w, h: h, s: s, R: R, cx: cx, cy: cy, L: L, lift: lift, pivX: cx, pivY: tipY0 - L,
          fs: api.clamp(s * 0.05, 12, 20) };
      }
      function tip(G) { return { x: G.pivX + G.L * Math.sin(theta), y: G.pivY + G.L * Math.cos(theta) }; }

      function newPlate() {
        var cfg = PLATES[plateIdx];
        var ghosts = layout(cfg.n);
        var dir = Math.random() < 0.5 ? -1 : 1;
        plate = { cfg: cfg, ghosts: ghosts, ang: Math.random() * Math.PI * 2, t: 0, ox: 0, base: cfg.base * dir,
          time: 5 + cfg.n * 3.8, max: 5 + cfg.n * 3.8, pts: 0, perfect: 0, claimed: 0, stamp: null };
        placed = []; splats = [];
        sup = shuffle(ghosts.map(function (g) { return g.type; }));
        retries = 2;
        cur = sup.shift(); curSwapped = false; reload = 0; swapT = 0.25; lastTick = 99;
      }

      function say(x, y, label, col, size) {
        var half = label.length * size * 0.33 + 8;
        api.float(api.clamp(x, half, api.w - half), Math.max(size + 40, y), label, col, size);
      }

      function remaining() { return plate.ghosts.filter(function (g) { return !g.filled; }); }

      function drop() {
        var G = geo(), tp = tip(G);
        falling = { type: cur, lx: (tp.x - G.cx) / G.R, ly: (tp.y - G.cy) / G.R, rot: -theta, t: 0, dur: 0.26 };
        cur = null; curSwapped = false; reload = 0.42; openT = 0.18;
        api.beep(520, 0.05, 'triangle', 0.06);
      }

      function land(f) {
        var G = geo();
        var wx = G.cx + f.lx * G.R, wy = G.cy + f.ly * G.R;
        var d0 = Math.hypot(f.lx, f.ly);
        var col = tones(P, f.type);
        var fs = G.fs;
        var claimed = false;
        if (d0 > 0.97) {
          // al mantel
          var pts = [];
          for (var i = 0; i < 10; i++) pts.push(api.rand(0.7, 1.15));
          splats.push({ type: f.type, x: f.lx, y: f.ly, pts: pts, rot: api.rand(0, 6.28), t: 0,
            drops: [[api.rand(-1, 1), api.rand(-1, 1)], [api.rand(-1, 1), api.rand(-1, 1)], [api.rand(-1, 1), api.rand(-1, 1)]] });
          score = Math.max(0, score - 10); plate.pts -= 10; streak = 0;
          api.shake(3, 180);
          api.sfx('thud'); api.noise(0.18, { filter: 'lowpass', freq: 900, vol: 0.12 });
          api.burst(wx, wy, { count: 10, colors: [col[0], col[1]], speed: G.R * 0.9, gravity: 0, size: G.R * 0.04, life: 0.5, shape: 'dot' });
          say(wx, wy - G.R * 0.1, 'AL MANTEL −10', P.tomato, fs);
        } else {
          var l = rot2(f.lx, f.ly, -plate.ang);
          var best = null, bd = 9;
          plate.ghosts.forEach(function (g) {
            if (g.filled || g.type !== f.type) return;
            var d = Math.hypot(g.x - l[0], g.y - l[1]);
            if (d < bd) { bd = d; best = g; }
          });
          var p = { type: f.type, sx: l[0], sy: l[1], x: l[0], y: l[1], tx: l[0], ty: l[1], rot: f.rot - plate.ang, trot: f.rot - plate.ang, snap: 0, t: 0 };
          var label, pcol, add;
          if (best && bd < 0.4) {
            claimed = true; best.filled = true; plate.claimed++;
            p.tx = best.x; p.ty = best.y;
            var dr = ((best.rot - p.rot) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
            p.trot = p.rot + dr;
            if (bd < 0.1) { p.snap = 1; add = 30; label = '¡PERFECTO! +30'; pcol = P.yellow; plate.perfect++; }
            else if (bd < 0.22) { p.snap = 0.6; add = 15; label = 'BIEN +15'; pcol = P.white; }
            else { p.snap = 0.3; add = 6; label = 'LEJOS +6'; pcol = P.cream3; }
          } else { add = 2; label = 'SUELTO +2'; pcol = P.cream3; }
          score += add; plate.pts += add;
          placed.push(p);
          say(wx, wy - G.R * 0.12, label, pcol, fs);
          if (claimed && p.snap === 1) {
            streak++;
            if (streak >= 2) {
              var bonus = 5 * (streak - 1);
              score += bonus; plate.pts += bonus;
              say(wx, wy + G.R * 0.1, 'RACHA ×' + streak + ' +' + bonus, P.yellowLight, Math.round(fs * 0.85));
              api.beep(660 + streak * 90, 0.08, 'triangle', 0.06);
            }
          } else streak = 0;
          if (claimed && p.snap === 1) {
            api.sfx('coin');
            api.burst(wx, wy, { count: 16, colors: [P.yellow, col[0], P.white], speed: G.R * 1.3, gravity: 0, size: G.R * 0.045, life: 0.6 });
          } else {
            api.sfx('pop');
            api.burst(wx, wy, { count: 7, colors: [col[0], col[1]], speed: G.R * 0.7, gravity: 0, size: G.R * 0.035, life: 0.45, shape: 'sq' });
          }
        }
        // the pass sends one more if you still need that element
        if (!claimed && retries > 0 && plate.ghosts.some(function (g) { return !g.filled && g.type === f.type; })) {
          sup.push(f.type); retries--;
        }
        if (!remaining().length) finishPlate();
      }

      function finishPlate() {
        if (phase !== 'play') return;
        var n = plate.ghosts.length, full = plate.claimed === n;
        var G = geo();
        var rating;
        if (full) {
          score += 40; plate.pts += 40;
          say(G.cx, G.cy - G.R * 0.55, '¡COMPLETO! +40', P.yellow, G.fs * 1.1);
          rating = plate.perfect >= Math.ceil(n / 2) ? 'EXQUISITO' : 'BIEN';
        } else rating = plate.claimed >= n - 1 && plate.perfect >= 1 ? 'BIEN' : 'CAÓTICO';
        plate.stamp = { text: rating, sub: 'Plato ' + (plateIdx + 1) + ' · ' + Math.max(0, plate.pts) + ' pts', t: 0 };
        results.push({ n: plateIdx + 1, rating: rating, pts: plate.pts, full: full });
        phase = 'stamp'; phaseT = 0; stampHit = false;
      }

      newPlate();

      return {
        update: function (dt) {
          var G = geo();
          // pendulum swings around an aim point the player slides with the D-pad
          var L = api.isDown('left'), Rt = api.isDown('right');
          var want = (Rt && !L) ? 1.15 : (L && !Rt) ? -1.15 : 0;
          aimV = api.lerp(aimV, want, 1 - Math.exp(-12 * dt));
          var aimMax = Math.min(0.95, 1.15 - plate.cfg.sw);
          aim = api.clamp(aim + aimV * dt, -aimMax, aimMax);
          if (Math.abs(aim) >= aimMax) aimV = 0;
          phi += plate.cfg.pend * dt;
          var nt = Math.asin(api.clamp((aim + plate.cfg.sw * Math.sin(phi)) * G.R / G.L, -0.9, 0.9));
          thetaV = api.lerp(thetaV, (nt - theta) / Math.max(dt, 0.001), 0.3);
          theta = nt;

          // plate spin (speed varies, some plates reverse)
          plate.t += dt;
          var om = plate.base + (plate.cfg.amp ? plate.cfg.amp * Math.cos(plate.t * plate.cfg.f) * (plate.base < 0 ? -1 : 1) : 0);
          plate.ang += om * dt;

          if (reload > 0) { reload -= dt; if (reload <= 0.2 && !cur && sup.length && (phase === 'play' || phase === 'in')) { cur = sup.shift(); swapT = 0.25; } }
          if (openT > 0) openT -= dt;
          if (swapT > 0) swapT -= dt;

          if (falling) {
            falling.t += dt;
            if (falling.t >= falling.dur) { var f = falling; falling = null; land(f); }
          }
          placed.forEach(function (p) {
            p.t += dt;
            var k = api.ease.outCubic(api.clamp(p.t / 0.3, 0, 1)) * p.snap;
            p.x = api.lerp(p.sx, p.tx, k); p.y = api.lerp(p.sy, p.ty, k);
            p.rot = api.lerp(p.rot, p.trot, p.snap ? 1 - Math.exp(-14 * dt) : 0);
          });
          splats.forEach(function (s) { s.t += dt; });

          if (phase === 'play') {
            plate.time -= dt;
            var secs = Math.ceil(plate.time);
            if (secs <= 3 && secs >= 1 && secs !== lastTick) { lastTick = secs; api.sfx('tick'); }
            if (!falling && (plate.time <= 0 || (!cur && !sup.length && reload <= 0))) finishPlate();
          } else if (phase === 'stamp') {
            phaseT += dt;
            plate.stamp.t = phaseT;
            if (!stampHit && phaseT >= 0.45) {
              stampHit = true;
              api.sfx('stamp'); api.shake(3, 160);
              api.burst(G.cx, G.cy, { count: 14, colors: [P.fawn, P.fawnLight], speed: G.R * 1.4, gravity: 0, size: G.R * 0.03, life: 0.5, shape: 'sq' });
            }
            if (phaseT >= 1.55) { phase = 'out'; phaseT = 0; api.sfx('whoosh'); }
          } else if (phase === 'out') {
            phaseT += dt;
            plate.ox = -api.ease.inCubic(api.clamp(phaseT / 0.42, 0, 1)) * 1.4;
            if (phaseT >= 0.42) {
              plateIdx++;
              if (plateIdx >= PLATES.length) {
                phase = 'done';
                if (!ended) {
                  ended = true;
                  var bestP = results.slice().sort(function (a, b) { return b.pts - a.pts; })[0];
                  var fulls = results.filter(function (r) { return r.full; }).length;
                  api.end({ score: score, label: 'Puntos de emplatado', title: '¡Pase cerrado!',
                    lines: ['Mejor plato: nº' + bestP.n + ' · ' + bestP.rating + ' (' + Math.max(0, bestP.pts) + ')',
                      'Platos completos: ' + fulls + '/' + PLATES.length], fail: false, delay: 250 });
                }
              } else {
                newPlate(); plate.ox = 1.4; phase = 'in'; phaseT = 0;
                sup.unshift(cur); cur = null; reload = 0.42;
              }
            }
          } else if (phase === 'in') {
            phaseT += dt;
            plate.ox = 1.4 * (1 - api.ease.outBack(api.clamp(phaseT / 0.55, 0, 1)));
            if (phaseT >= 0.55) { plate.ox = 0; phase = 'play'; }
          }
        },

        draw: function (ctx, w, h) {
          var G = geo(), R = G.R, rr = api.rr;
          var pcx = G.cx + plate.ox * w, pcy = G.cy;

          // placemat (stays put)
          ctx.fillStyle = P.aztec2;
          ctx.beginPath(); ctx.arc(G.cx, G.cy + R * 0.03, R * 1.2, 0, Math.PI * 2); ctx.fill();

          // splats on the table
          splats.forEach(function (s) {
            var k = api.ease.outBack(api.clamp(s.t / 0.22, 0, 1)) * (plate.ox ? Math.max(0, 1 - Math.abs(plate.ox) * 2) : 1);
            if (k <= 0) return;
            var x = G.cx + s.x * R, y = G.cy + s.y * R, r = R * 0.17 * k, c = tones(P, s.type);
            ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot);
            ctx.fillStyle = c[1];
            ctx.beginPath();
            for (var i = 0; i <= s.pts.length; i++) {
              var a = (i % s.pts.length) / s.pts.length * Math.PI * 2, rad = r * s.pts[i % s.pts.length];
              if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad + 2);
              else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.8 + 2);
            }
            ctx.fill();
            ctx.fillStyle = c[0];
            ctx.beginPath();
            for (var j = 0; j <= s.pts.length; j++) {
              var b = (j % s.pts.length) / s.pts.length * Math.PI * 2, rb = r * s.pts[j % s.pts.length];
              if (j === 0) ctx.moveTo(Math.cos(b) * rb, Math.sin(b) * rb * 0.8);
              else ctx.lineTo(Math.cos(b) * rb, Math.sin(b) * rb * 0.8);
            }
            ctx.fill();
            s.drops.forEach(function (d, n) {
              ctx.beginPath(); ctx.arc(d[0] * r * 1.9, d[1] * r * 1.6, r * (0.16 + n * 0.05), 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
          });

          // plate
          drawPlate(ctx, P, pcx, pcy, R, plate.ang);
          plate.ghosts.forEach(function (g) {
            if (g.filled) return;
            var p = rot2(g.x * R, g.y * R, plate.ang);
            ctx.save(); ctx.translate(pcx + p[0], pcy + p[1]); ctx.rotate(g.rot + plate.ang);
            paint(ctx, P, rr, g.type, R, 'ghost'); ctx.restore();
          });
          placed.forEach(function (e) {
            var p = rot2(e.x * R, e.y * R, plate.ang);
            var q = api.clamp(e.t / 0.4, 0, 1), sq = 1 + 0.26 * (1 - api.ease.outElastic(q));
            drawEl(ctx, P, rr, e.type, pcx + p[0], pcy + p[1], R, e.rot + plate.ang, sq, 1 + 0.16 * (1 - api.ease.outElastic(q)));
          });

          // shadow helper: cream3 on the plate, aztec3 on the table
          function shadow(type, x, y, rot, u) {
            ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, R, 0, Math.PI * 2); ctx.clip();
            ctx.translate(x, y); ctx.rotate(rot); paint(ctx, P, rr, type, u, P.cream3); ctx.restore();
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(pcx, pcy, R, 0, Math.PI * 2, true); ctx.clip('evenodd');
            ctx.translate(x, y); ctx.rotate(rot); paint(ctx, P, rr, type, u, P.aztec3); ctx.restore();
          }

          // falling element
          if (falling) {
            var k = api.clamp(falling.t / falling.dur, 0, 1), e = api.ease.inCubic(k);
            var fx = G.cx + falling.lx * R, fy = G.cy + falling.ly * R;
            shadow(falling.type, fx, fy, falling.rot, R * api.lerp(0.82, 1, e));
            drawEl(ctx, P, rr, falling.type, fx, fy - G.lift * (1 - e), R * api.lerp(1.22, 1, e), falling.rot, 1 - 0.1 * e, 1 + 0.12 * e);
          }

          // tweezers + held element
          var tp = tip(G);
          var lift = G.lift + (reload > 0 ? Math.sin(Math.PI * api.clamp(1 - reload / 0.42, 0, 1)) * R * 0.45 : 0);
          var hx = tp.x, hy = tp.y - lift;
          var sway = api.clamp(-thetaV * 0.12, -0.35, 0.35);
          if (cur && phase === 'play') {
            var pop = swapT > 0 ? api.ease.outBack(1 - swapT / 0.25) : 1;
            shadow(cur, tp.x, tp.y, -theta + sway, R * 0.82 * pop);
            drawEl(ctx, P, rr, cur, hx, hy, R * 1.22 * pop, -theta + sway);
          }
          // tweezers live below the clock bar and never cross the queue
          var qsz = api.clamp(G.s * 0.1, 28, 44);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 40, w, h);
          ctx.rect(w - 22 - qsz * 2 - 6 - 50, 40, qsz * 2 + 6 + 58, qsz + 14); ctx.clip('evenodd');
          var dx = -Math.sin(theta), dy = -Math.cos(theta), nx = -dy, ny = dx;
          var len = h * 1.2, gapT = R * (0.05 + (openT > 0 ? 0.1 * Math.sin(Math.PI * (1 - openT / 0.18)) : 0) + (cur ? 0 : 0.03));
          [[P.cream3, 3], [P.cream2, 0]].forEach(function (layer) {
            ctx.fillStyle = layer[0];
            [-1, 1].forEach(function (side) {
              var tx = hx + nx * gapT * side, ty = hy + ny * gapT * side + layer[1];
              var bx = hx + dx * len + nx * R * 0.05 * side, by = hy + dy * len + ny * R * 0.05 * side + layer[1];
              var w0 = R * 0.022, w1 = R * 0.05;
              ctx.beginPath();
              ctx.moveTo(tx - nx * w0 / 2, ty - ny * w0 / 2);
              ctx.lineTo(tx + nx * w0 / 2, ty + ny * w0 / 2);
              ctx.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
              ctx.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2);
              ctx.closePath(); ctx.fill();
            });
          });
          // walnut grip band
          var gd = R * 0.75, gx = hx + dx * gd, gy = hy + dy * gd, gw = R * 0.2;
          ctx.save(); ctx.translate(gx, gy); ctx.rotate(-theta);
          ctx.fillStyle = P.walnutDark; rr(ctx, -gw / 2, -R * 0.06 + 3, gw, R * 0.12, R * 0.03); ctx.fill();
          ctx.fillStyle = P.walnut; rr(ctx, -gw / 2, -R * 0.06, gw, R * 0.12, R * 0.03); ctx.fill();
          ctx.restore();
          ctx.restore();

          // stamp
          if (plate.stamp && plate.stamp.t > 0.3) {
            var st = plate.stamp, sk = api.clamp((st.t - 0.3) / 0.15, 0, 1);
            var sc = api.lerp(1.9, 1, api.ease.inCubic(sk));
            var size = Math.round(R * 0.25);
            ctx.font = '700 ' + size + 'px ' + (api.FONT || "'Space Grotesk', sans-serif");
            if ('letterSpacing' in ctx) ctx.letterSpacing = (size * 0.08) + 'px';
            var tw = ctx.measureText(st.text).width;
            var ss = Math.max(10, Math.round(size * 0.38));
            ctx.font = '700 ' + ss + 'px ' + (api.FONT || "'Space Grotesk', sans-serif");
            if ('letterSpacing' in ctx) ctx.letterSpacing = '1.2px';
            tw = Math.max(tw, ctx.measureText(st.sub.toUpperCase()).width);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
            var bw = tw + size * 1.1, bh = size * 2.05;
            ctx.save(); ctx.translate(pcx, pcy); ctx.scale(sc, sc);
            ctx.fillStyle = P.walnut; rr(ctx, -bw / 2, -bh / 2 + 4, bw, bh, size * 0.06); ctx.fill();
            ctx.fillStyle = P.white; rr(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.06); ctx.fill();
            ctx.strokeStyle = P.fawn; ctx.lineWidth = Math.max(3, size * 0.14);
            rr(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.06); ctx.stroke();
            ctx.lineWidth = Math.max(1.2, size * 0.05);
            rr(ctx, -bw / 2 + size * 0.2, -bh / 2 + size * 0.2, bw - size * 0.4, bh - size * 0.4, size * 0.03); ctx.stroke();
            api.text(ctx, st.text, 0, -size * 0.12, { size: size, color: P.fawn, align: 'center', baseline: 'middle', spacing: size * 0.08 });
            api.text(ctx, st.sub.toUpperCase(), 0, size * 0.62, { size: ss, color: P.fawn, align: 'center', baseline: 'middle', spacing: 1.2 });
            ctx.restore();
          }

          // HUD + service clock
          api.hud(ctx, 'PLATO ' + Math.min(plateIdx + 1, PLATES.length) + '/' + PLATES.length, score + ' PTS');
          var bx0 = 14, bw0 = w - 28, by0 = 33, fr = api.clamp(plate.time / plate.max, 0, 1);
          ctx.fillStyle = P.aztec3; rr(ctx, bx0, by0, bw0, 4, 2); ctx.fill();
          ctx.fillStyle = fr < 0.25 ? P.tomato : P.yellow; rr(ctx, bx0, by0, Math.max(4, bw0 * fr), 4, 2); ctx.fill();

          // queue: next two
          var qs = api.clamp(G.s * 0.1, 28, 44), qy = 46, qx = w - 14 - qs;
          api.text(ctx, 'SIGUE', qx - qs - 14, qy + qs / 2 + 1, { size: 11, color: P.cream3, align: 'right', baseline: 'middle', spacing: 1.5 });
          for (var q = 0; q < 2; q++) {
            var x0 = qx - (1 - q) * (qs + 6), type = sup[q];
            var canSwap = q === 0 && type && cur && !curSwapped && phase === 'play';
            ctx.fillStyle = P.aztec3; rr(ctx, x0, qy + 3, qs, qs, qs * 0.22); ctx.fill();
            ctx.fillStyle = canSwap ? P.yellow : P.aztec2; rr(ctx, x0, qy, qs, qs, qs * 0.22); ctx.fill();
            if (canSwap) { ctx.fillStyle = P.aztec2; rr(ctx, x0 + 2, qy + 2, qs - 4, qs - 4, qs * 0.18); ctx.fill(); }
            if (type) drawEl(ctx, P, rr, type, x0 + qs / 2, qy + qs / 2, qs * 1.45, 0);
          }
        },

        input: function (key, type) {
          if (type !== 'down' || phase !== 'play') return;
          if (key === 'a') {
            if (cur && !falling && reload <= 0) drop();
          } else if (key === 'b') {
            if (cur && sup.length && sup[0] && !curSwapped) {
              var t = cur; cur = sup[0]; sup[0] = t; curSwapped = true; swapT = 0.25;
              api.sfx('tick');
            } else api.beep(140, 0.06, 'square', 0.05);
          }
        },
        destroy: function () {}
      };
    }
  });
})();

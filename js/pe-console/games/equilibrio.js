/* PE-83 console · EQUILIBRIO
   Waiter's tray balance game. Things fall from the pass, you catch them on the tray,
   the load tilts the tray around your hand, A/B counter-tilt, ▲ serves at the table.
   World is laid out in units: 1u = min(w, h) / 100, so phone and desktop play the same. */
(function () {
  'use strict';

  var DURATION = 75;
  var HALF = 17;          // tray half width (u)
  var G = 170;            // slide gravity (u/s²)
  var TW = 26;            // table width (u)

  var TYPES = {
    glass:   { w: 6,  h: 9,   m: 0.7, mu: 0.13, fragile: true,  pts: 1, shards: ['white', 'yellow'] },
    plate:   { w: 13, h: 2.4, m: 1.0, mu: 0.17, fragile: true,  pts: 1, shards: ['white', 'cream3'] },
    bread:   { w: 9,  h: 5,   m: 0.6, mu: 0.21, fragile: false, pts: 1, shards: ['yellowDark', 'fawn'] },
    jar:     { w: 7,  h: 8.5, m: 1.3, mu: 0.15, fragile: true,  pts: 1, shards: ['tomato', 'walnut', 'white'] },
    cazuela: { w: 14, h: 7.5, m: 2.6, mu: 0.19, fragile: true,  pts: 2, heavy: true, shards: ['fawn', 'fawnDark'] },
    pan:     { w: 11, h: 3,   m: 2.0, mu: 0.18, fragile: false, pts: 0, bad: true, shards: ['aztec3', 'walnut'] }
  };

  /* ---------- flat drawing, origin = bottom-centre, units ---------- */
  function drawItem(ctx, P, rr, type, liq, t) {
    switch (type) {
      case 'glass': {
        // hard offset
        ctx.fillStyle = P.aztec3;
        glassPath(ctx, 0.9); ctx.fill();
        // liquid, level stays world-horizontal (liq = -rotation)
        ctx.save();
        glassPath(ctx, 0); ctx.clip();
        var lvl = -5.2, sl = Math.tan(liq || 0);
        ctx.beginPath();
        ctx.moveTo(-5, lvl - 5 * sl); ctx.lineTo(5, lvl + 5 * sl); ctx.lineTo(5, 1); ctx.lineTo(-5, 1); ctx.closePath();
        ctx.fillStyle = P.yellow; ctx.fill();
        ctx.restore();
        glassPath(ctx, 0);
        ctx.lineWidth = 0.95; ctx.lineJoin = 'round'; ctx.strokeStyle = P.white; ctx.stroke();
        ctx.fillStyle = P.white; rr(ctx, -3, -1.1, 6, 1.1, 0.4); ctx.fill();
        break;
      }
      case 'plate': {
        ctx.fillStyle = P.cream3; platePath(ctx, 0.8); ctx.fill();
        ctx.fillStyle = P.white; platePath(ctx, 0); ctx.fill();
        ctx.fillStyle = P.cream3; rr(ctx, -3.8, -0.7, 7.6, 0.7, 0.3); ctx.fill();
        break;
      }
      case 'bread': {
        ctx.fillStyle = P.fawn; rr(ctx, -4.5, -5 + 0.9, 9, 5, 2.5); ctx.fill();
        ctx.fillStyle = P.yellowDark; rr(ctx, -4.5, -5, 9, 5, 2.5); ctx.fill();
        ctx.strokeStyle = P.fawn; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
        for (var i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i * 2.4 - 0.8, -2.2); ctx.lineTo(i * 2.4 + 0.8, -4.1); ctx.stroke();
        }
        break;
      }
      case 'jar': {
        ctx.fillStyle = P.fawnDark; rr(ctx, -3.5, -7 + 0.9, 7, 7, 1.6); ctx.fill();
        ctx.fillStyle = P.tomato; rr(ctx, -3.5, -7, 7, 7, 1.6); ctx.fill();
        ctx.fillStyle = P.white; ctx.fillRect(-3.5, -4.9, 7, 2.1);
        ctx.fillStyle = P.walnut; rr(ctx, -3, -8.5, 6, 1.9, 0.5); ctx.fill();
        break;
      }
      case 'cazuela': {
        ctx.fillStyle = P.fawnDark; rr(ctx, -6.5, -6 + 1, 13, 6, 2.6); ctx.fill();
        ctx.fillStyle = P.fawn; rr(ctx, -6.5, -6, 13, 6, 2.6); ctx.fill();
        ctx.fillStyle = P.fawnDark;
        rr(ctx, -7.3, -7.5, 14.6, 1.7, 0.8); ctx.fill();
        rr(ctx, -8.6, -5.4, 2.6, 1.6, 0.8); ctx.fill();
        rr(ctx, 6, -5.4, 2.6, 1.6, 0.8); ctx.fill();
        break;
      }
      case 'pan': {
        ctx.fillStyle = P.walnutDark; rr(ctx, -5.5, -3 + 0.8, 11, 3, 1.2); ctx.fill();
        ctx.fillStyle = P.walnut; rr(ctx, 4.5, -2.5, 6.5, 1.3, 0.6); ctx.fill();
        ctx.fillStyle = P.aztec3; rr(ctx, -5.5, -3, 11, 3, 1.2); ctx.fill();
        ctx.fillStyle = P.cream3; rr(ctx, -5.5, -3, 11, 0.8, 0.4); ctx.fill();
        ctx.fillStyle = P.walnut;
        rr(ctx, -3.6, -2.2, 2.2, 1, 0.5); ctx.fill();
        rr(ctx, 0.6, -1.8, 3, 0.9, 0.45); ctx.fill();
        // smoke puffs (flat dots, rising in a loop)
        var tt = t || 0;
        for (var k = 0; k < 3; k++) {
          var ph = (tt * 0.9 + k / 3) % 1;
          var r = 0.6 + ph * 1.2;
          if (r > 0.3) {
            ctx.fillStyle = P.cream3;
            ctx.beginPath();
            ctx.arc(-2 + k * 2 + Math.sin((tt + k) * 5) * 0.8, -4 - ph * 7, r * (1 - ph * 0.6), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
    }
  }
  function glassPath(ctx, dy) {
    ctx.beginPath();
    ctx.moveTo(-2.9, dy); ctx.lineTo(2.9, dy); ctx.lineTo(3.4, -9 + dy); ctx.lineTo(-3.4, -9 + dy); ctx.closePath();
  }
  function platePath(ctx, dy) {
    ctx.beginPath();
    ctx.moveTo(-3.8, dy); ctx.lineTo(3.8, dy); ctx.lineTo(6.5, -1.5 + dy); ctx.lineTo(6.5, -2.4 + dy);
    ctx.lineTo(-6.5, -2.4 + dy); ctx.lineTo(-6.5, -1.5 + dy); ctx.closePath();
  }
  // tray in its own rotated frame, pivot at (0,0) = tray surface centre
  function drawTray(ctx, P, rr) {
    ctx.fillStyle = P.walnutDark; rr(ctx, -HALF, 1.6, HALF * 2, 3, 1.2); ctx.fill();
    ctx.fillStyle = P.walnut; rr(ctx, -HALF, 0, HALF * 2, 3, 1.2); ctx.fill();
    ctx.fillStyle = P.fawnDark; rr(ctx, -HALF + 1, 0, HALF * 2 - 2, 0.9, 0.45); ctx.fill();
    ctx.fillStyle = P.walnut;
    rr(ctx, -HALF - 0.4, -2, 2.4, 4, 1); ctx.fill();
    rr(ctx, HALF - 2, -2, 2.4, 4, 1); ctx.fill();
    ctx.fillStyle = P.fawnDark;
    rr(ctx, -HALF - 0.4, -2, 2.4, 0.9, 0.45); ctx.fill();
    rr(ctx, HALF - 2, -2, 2.4, 0.9, 0.45); ctx.fill();
  }
  // arm in world units: palm centre under the tray at (hx, py); lean = horizontal lag
  function drawArm(ctx, P, rr, hx, py, lean, bottom) {
    ctx.lineCap = 'round';
    var wx = hx + 3 + lean, wy = py + 6, ex = hx + 13 + lean * 1.6, ey = bottom + 8;
    ctx.strokeStyle = P.cream3; ctx.lineWidth = 8.5;
    ctx.beginPath(); ctx.moveTo(wx + 1.4, wy + 3.4); ctx.lineTo(ex + 1.4, ey + 1.4); ctx.stroke();
    ctx.strokeStyle = P.white;
    ctx.beginPath(); ctx.moveTo(wx, wy + 2); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = P.fawnLight; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(hx + 1.5, py + 1.6); ctx.lineTo(wx - 0.4, wy + 0.6); ctx.stroke();
    ctx.fillStyle = P.fawnLight; rr(ctx, hx - 5, py, 10, 2.6, 1.3); ctx.fill();
    ctx.fillStyle = P.cream3; rr(ctx, wx - 3.6, wy + 0.2, 7.4, 2.4, 1.2); ctx.fill();
  }
  function drawTable(ctx, P, rr, cx, top, bottom, items, t) {
    var hw = TW / 2;
    ctx.fillStyle = P.walnutDark;
    ctx.fillRect(cx - hw + 2.5, top + 3, 2.4, bottom - top - 3);
    ctx.fillRect(cx + hw - 4.9, top + 3, 2.4, bottom - top - 3);
    ctx.fillStyle = P.cream3; rr(ctx, cx - hw, top + 1.4, TW, 5.2, 1); ctx.fill();
    ctx.fillStyle = P.white; rr(ctx, cx - hw, top, TW, 5, 1); ctx.fill();
    if (items) for (var i = 0; i < items.length; i++) {
      var it = items[i];
      ctx.save(); ctx.translate(cx + it.ox, top); drawItem(ctx, P, rr, it.type, 0, t); ctx.restore();
    }
  }

  (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
    id: 'equilibrio',
    title: 'Equilibrio',
    tagline: 'Carga la bandeja, que no se te caiga nada y sirve en mesa.',
    order: 50,
    controls: [['◀▶', 'Mover'], ['A B', 'Inclinar'], ['▼', 'Firme'], ['▲', 'Servir']],

    preview: function (ctx, w, h, t, api) {
      var P = api.P, rr = api.rr;
      var S = Math.min(w / 64, h / 44);
      ctx.save();
      ctx.translate(w / 2, h);
      ctx.scale(S, S);
      var H = h / S, floorY = -5, trayY = floorY - 17;
      ctx.fillStyle = P.aztec2; ctx.fillRect(-w / S, floorY, 2 * w / S, 10);
      ctx.fillStyle = P.aztec3; ctx.fillRect(-w / S, floorY, 2 * w / S, 0.9);
      var cyc = 2.2, p = (t % cyc) / cyc, landP = 0.55;
      var land = p > landP ? (p - landP) / (1 - landP) : 0;
      var kick = land > 0 ? Math.sin(land * 14) * Math.exp(-land * 5) * 0.12 : 0;
      var a = Math.sin(t * 2.1) * 0.06 + kick;
      var dip = land > 0 ? Math.sin(land * 12) * Math.exp(-land * 6) * 1.2 : 0;
      drawArm(ctx, P, rr, 0, trayY + 2.6 + dip, Math.sin(t * 2.1) * -1.2, floorY);
      ctx.save();
      ctx.translate(0, trayY + dip); ctx.rotate(a);
      drawTray(ctx, P, rr);
      var stack = [['plate', -8, 0], ['glass', -8, 2.4], ['bread', 9, 0]];
      stack.forEach(function (s) {
        ctx.save(); ctx.translate(s[1], -s[2]); drawItem(ctx, P, rr, s[0], -a, t); ctx.restore();
      });
      if (land > 0) {
        var e = Math.exp(-land * 7) * Math.cos(land * 16);
        ctx.save(); ctx.translate(1.5, 0); ctx.scale(1 + 0.28 * e, 1 - 0.28 * e);
        drawItem(ctx, P, rr, 'jar', -a, t); ctx.restore();
      }
      ctx.restore();
      if (land === 0) {
        var fp = api.ease.inCubic(p / landP);
        var fy = api.lerp(-H - 10, trayY, fp);
        ctx.save(); ctx.translate(1.5, fy); ctx.rotate((1 - fp) * 1.6);
        drawItem(ctx, P, rr, 'jar', 0, t); ctx.restore();
      }
      ctx.restore();
    },

    create: function (api) {
      var P = api.P, rr = api.rr;
      var S = 1, W = 100, H = 100, floorY = 92, trayY = 70;
      var hx = 50, hvx = 0, axS = 0, lastVx = 0;
      var a = 0, av = 0, dip = 0, dipV = 0;
      var items = [], falling = [], loose = [], shards = [], flyers = [];
      var table = null, nextTable = 10, spawnT = 1.0;
      var time = 0, score = 0, served = 0, broken = 0, streak = 0, combo = 1;
      var ended = false, lastTick = -1, serveFlash = 0, idc = 0, clock = 0;
      var later = [], stamp = null, nudge = 0, hudBand = 50;

      // floats in px, kept inside the screen so long labels never clip at the edges
      function fl(x, y, str, color, size) {
        var half = String(str).length * (size || 18) * 0.34;
        x = api.clamp(x, half + 8, Math.max(half + 8, api.w - half - 8));
        y = Math.max(y, 74);
        api.float(x, y, str, color, size);
      }

      function layout() {
        S = Math.min(api.w, api.h) / 100 || 1;
        W = api.w / S; H = api.h / S;
        floorY = H - 7;
        trayY = floorY - 24;
      }
      layout();
      hx = W / 2;

      function toWorld(lx, ly) {
        var c = Math.cos(a), s = Math.sin(a);
        return { x: hx + lx * c - ly * s, y: trayY + dip + lx * s + ly * c };
      }
      function stackTopAt(lx, w, except) {
        var top = 0;
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it === except) continue;
          if (Math.abs(lx - it.lx) < (w + it.T.w) / 2 - 0.8) top = Math.max(top, it.tb + it.T.h);
        }
        return top;
      }

      function setCombo() {
        var c = Math.min(5, 1 + Math.floor(streak / 3));
        if (c > combo) {
          var p = toWorld(0, -8);
          fl(p.x * S, (p.y - 14) * S, 'x' + c, P.yellowLight, 16);
        }
        combo = c;
      }
      function breakStreak() { streak = 0; combo = 1; }

      function shatter(x, y, T, type, vx, fromTray) {
        if (!T.fragile) {
          // bread / pan: bounce and roll away (pan clangs)
          api.burst(x * S, y * S, { count: 5, colors: [P.aztec3, P.cream3], speed: 70, gravity: 300, size: 3, angle: -Math.PI / 2, spread: 1.1 });
          if (type === 'pan') { api.sfx('thud'); api.beep(210, 0.12, 'square', 0.05); }
          else api.beep(160, 0.06, 'triangle', 0.06);
          shards.push({ x: x, y: floorY, vx: (vx || 0) * 0.4 + api.rand(-12, 12), whole: type, rot: 0, life: 0 });
          return;
        }
        if (!ended) broken++;
        // a miss is just a miss; dropping something you already held costs the streak
        if (fromTray) breakStreak();
        var cols = T.shards.map(function (k) { return P[k]; });
        var n = api.randi ? api.randi(5, 8) : 6;
        for (var i = 0; i < n; i++) {
          var s = api.rand(1.1, 2.6) * (T.heavy ? 1.3 : 1);
          shards.push({
            x: x + api.rand(-T.w / 2, T.w / 2), y: floorY, vx: (vx || 0) * 0.3 + api.rand(-38, 38),
            c: cols[i % cols.length], rot: api.rand(0, 6.28), vr: api.rand(-8, 8),
            pts: [[-s, 0.2], [s * api.rand(0.2, 1), -s * api.rand(0.5, 0.9)], [s * api.rand(0.4, 1), 0.2]], life: 0
          });
        }
        if (shards.length > 60) shards.splice(0, shards.length - 60);
        api.burst(x * S, (floorY - 1) * S, { count: 12, colors: cols, speed: 150, gravity: 520, size: 4, angle: -Math.PI / 2, spread: 1.2, shape: 'sq' });
        if (fromTray) api.shake(3, 160);
        api.sfx('thud');
        if (type === 'glass' || type === 'jar') api.beep(2100, 0.05, 'triangle', 0.035);
      }

      function spawn() {
        var el = time;
        var pool = [['glass', 26], ['plate', 22], ['bread', 18], ['jar', 14]];
        if (el > 8) pool.push(['cazuela', 11]);
        if (el > 14) pool.push(['pan', 8]);
        var tot = 0; pool.forEach(function (p) { tot += p[1]; });
        var r = Math.random() * tot, type = 'glass';
        for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) { type = pool[i][0]; break; } }
        var T = TYPES[type];
        var x = api.rand(T.w / 2 + 4, W - T.w / 2 - 4);
        falling.push({
          id: idc++, type: type, T: T, x: x, y: -T.h - 4, vx: api.rand(-3, 3),
          vy: api.rand(12, 22) + el * 0.22, acc: api.rand(16, 30), rot: api.rand(-0.6, 0.6),
          vr: api.rand(-2.2, 2.2) * (T.bad ? 1.6 : 1), wob: api.rand(0, 6)
        });
      }

      function land(f, lx, top) {
        var T = f.T;
        items.push({ id: f.id, type: f.type, T: T, lx: lx, tb: top, base: top, vx: 0, sliding: false, sq: 1, seq: idc });
        var imp = f.vy * T.m;
        av += T.m * lx * f.vy * 0.00085;
        dipV += imp * 0.07;
        var p = toWorld(lx, -top);
        if (T.bad) {
          breakStreak();
          api.sfx('thud'); api.shake(2, 120);
          api.burst(p.x * S, (p.y - 3) * S, { count: 10, colors: [P.cream3, P.aztec3], speed: 60, gravity: -60, size: 5, angle: -Math.PI / 2, spread: 0.8, shape: 'dot' });
          fl(p.x * S, (p.y - 10) * S, '¡QUEMADA!', P.tomato, 13);
        } else {
          streak++; setCombo();
          api.sfx('pop');
          api.beep(420 + Math.min(10, streak) * 40, 0.05, 'square', 0.04);
          api.burst(p.x * S, p.y * S, { count: 6, colors: [P.white, P.yellow], speed: 70, gravity: 300, size: 3, angle: -Math.PI / 2, spread: 1.3, shape: 'dot' });
        }
      }

      function knockOff(it, idx) {
        var p = toWorld(it.lx, -it.base);
        var dir = it.lx >= 0 ? 1 : -1;
        var c = Math.cos(a), s = Math.sin(a);
        var along = it.vx || dir * 12;
        loose.push({
          type: it.type, T: it.T, x: p.x, y: p.y, rot: a,
          vx: hvx + along * c + dir * 6, vy: along * s - av * it.lx * 0.5 - 6,
          vr: dir * api.rand(3, 6)
        });
        items.splice(idx, 1);
        api.sfx('whoosh');
      }

      function serve() {
        if (!table || table.state !== 'open') { api.beep(180, 0.05, 'square', 0.03); return; }
        if (!inZone()) {
          api.sfx('tick'); nudge = 1;
          var pz = toWorld(0, -6);
          fl(pz.x * S, (pz.y - 10) * S, serveX() > hx ? 'MESA ▶' : '◀ MESA', P.cream2, 12);
          return;
        }
        if (!items.length) { api.sfx('tick'); fl(tableX() * S, (tableTop() - 8) * S, 'BANDEJA VACÍA', P.cream3, 12); return; }
        var sorted = items.slice().sort(function (p, q) { return q.base - p.base; });
        var n = sorted.length, good = 0, bad = 0;
        var gap = Math.min(4.5, (TW - 6) / Math.max(1, n - 1));
        sorted.forEach(function (it, k) {
          var p = toWorld(it.lx, -it.base);
          var ox = (k - (n - 1) / 2) * gap;
          flyers.push({ type: it.type, T: it.T, x0: p.x, y0: p.y, ox: ox, t: -k * 0.06, rot0: a, k: k });
          if (it.T.bad) bad++; else good += it.T.pts;
        });
        items = [];
        var pts = good * combo - bad * 5;
        score = Math.max(0, score + pts);
        served += n - bad;
        table.state = 'served'; table.timer = 1.3 + n * 0.06;
        table.items = [];
        api.sfx('coin');
        var tx = tableX() * S, ty = (tableTop() - 14) * S;
        // the score lands with the last plate, not before
        var landAt = 0.42 + (n - 1) * 0.06;
        later.push({ t: landAt, fn: function () {
          fl(tx, ty, (pts >= 0 ? '+' : '') + pts, pts >= 0 ? P.yellow : P.tomato, 22);
          if (bad) fl(tx, ty + 22, 'SARTÉN −' + (bad * 5), P.tomato, 12);
        } });
        stamp = { t: -landAt };
        serveFlash = 1;
      }

      function tableX() {
        if (!table) return -100;
        var base = table.side > 0 ? W - TW / 2 - 1.5 : TW / 2 + 1.5;
        return base + table.side * (1 - table.p) * (TW + 6);
      }
      function tableTop() { return trayY + 9; }
      // serve spot: tray beside the table, its near edge just over the tablecloth
      function serveX() { return table ? tableX() - table.side * (TW / 2 + HALF - 1.5) : -100; }
      function inZone() { return table && Math.abs(hx - serveX()) < 7; }

      function finish() {
        ended = true;
        var good = 0;
        items.forEach(function (it) { if (!it.T.bad) good += it.T.pts; });
        var bonus = good * 2;
        if (bonus) {
          var p = toWorld(0, -10);
          fl(p.x * S, (p.y - 8) * S, '+' + bonus + ' BANDEJA', P.yellow, 16);
          api.sfx('coin');
        }
        var lines = ['Servidos: ' + served + ' · Rotos: ' + broken];
        if (bonus) lines.push('En bandeja al final: +' + bonus);
        api.end({ score: score + bonus, label: 'Puntos', title: '¡Servicio cerrado!', lines: lines, delay: 900 });
      }

      return {
        update: function (dt) {
          layout();
          clock += dt;
          if (!ended) {
            time += dt;
            if (time >= DURATION) finish();
            var left = Math.ceil(DURATION - time);
            if (left <= 5 && left !== lastTick && left > 0) { lastTick = left; api.sfx('tick'); }
          }

          /* hand: acceleration + friction */
          var dir = ended ? 0 : (api.isDown('right') ? 1 : 0) - (api.isDown('left') ? 1 : 0);
          var steady = !ended && api.isDown('down');
          var ACC = 340, DEC = 300, MAXV = steady ? 42 : 78;
          if (dir) hvx += dir * ACC * dt * (hvx * dir < 0 ? 1.7 : 1);
          else hvx -= Math.sign(hvx) * Math.min(Math.abs(hvx), DEC * dt);
          hvx = api.clamp(hvx, -MAXV, MAXV);
          hx += hvx * dt;
          var lo = HALF + 2, hi = W - HALF - 2;
          if (hx < lo) { hx = lo; hvx = 0; } if (hx > hi) { hx = hi; hvx = 0; }
          var ax = dt > 0 ? (hvx - lastVx) / dt : 0; lastVx = hvx;
          axS = api.lerp(axS, ax, 1 - Math.exp(-12 * dt));

          /* tilt: centre of mass vs hand + player counter-tilt, as a damped spring */
          var torque = 0, mass = 0, comH = 0;
          items.forEach(function (it) { torque += it.T.m * it.lx; mass += it.T.m; comH += it.T.m * (it.base + it.T.h / 2); });
          comH = mass ? comH / mass : 0;
          var input = ended ? 0 : (api.isDown('b') ? 1 : 0) - (api.isDown('a') ? 1 : 0);
          var target = torque * 0.0052 + input * 0.24 - axS * 0.00022;
          // a tall load is top-heavy: any lean feeds itself, so stacks need active balancing
          target += a * Math.min(0.75, comH * 0.035);
          av += (58 * (target - a) - (steady ? 17 : 8.5) * av) * dt;
          a += av * dt;
          if (a > 0.55) { a = 0.55; av = Math.min(av, 0); }
          if (a < -0.55) { a = -0.55; av = Math.max(av, 0); }
          dipV += (-140 * dip - 11 * dipV) * dt;
          dip += dipV * dt;

          /* stack: support + sliding, bottom-up */
          items.sort(function (p, q) { return p.tb - q.tb || p.seq - q.seq; });
          var done = [];
          for (var i = 0; i < items.length; i++) {
            var it = items[i], tb = 0, parent = null;
            for (var j = 0; j < done.length; j++) {
              var o = done[j];
              if (Math.abs(it.lx - o.lx) < (it.T.w + o.T.w) / 2 - 0.8 && o.tb + o.T.h > tb) { tb = o.tb + o.T.h; parent = o; }
            }
            it.tb = tb; it.parent = parent;
            if (it.base > tb) it.base = Math.max(tb, it.base - (8 + (it.base - tb) * 20) * dt);
            else it.base = tb;
            var f = G * Math.sin(a) - axS * 0.06;
            var mu = it.T.mu * G * Math.cos(a) * (1 - Math.min(0.35, tb * 0.02));
            if (!it.sliding && Math.abs(f) > mu) it.sliding = true;
            if (it.sliding) {
              var fr = Math.abs(it.vx) > 0.5 ? Math.sign(it.vx) : Math.sign(f);
              it.vx += (f - fr * mu * 0.55) * dt;
              if (Math.abs(f) < mu * 0.7 && Math.abs(it.vx) < 3) { it.vx = 0; it.sliding = false; }
            }
            it.dx = it.vx * dt + (parent ? parent.dx : 0);
            it.lx += it.dx;
            if (it.sq > 0) it.sq = Math.max(0, it.sq - dt * 3.2);
            done.push(it);
          }
          for (var k = items.length - 1; k >= 0; k--) {
            if (Math.abs(items[k].lx) > HALF + items[k].T.w * 0.12) knockOff(items[k], k);
          }

          /* spawn + falling */
          if (!ended && time < DURATION - 1.6) {
            spawnT -= dt;
            if (spawnT <= 0) { spawn(); spawnT = api.lerp(1.45, 0.72, time / DURATION) * api.rand(0.8, 1.2); }
          }
          for (var fi = falling.length - 1; fi >= 0; fi--) {
            var fo = falling[fi];
            fo.vy += fo.acc * dt; fo.y += fo.vy * dt; fo.x += fo.vx * dt; fo.rot += fo.vr * dt;
            if (fo.x < fo.T.w / 2) { fo.x = fo.T.w / 2; fo.vx = Math.abs(fo.vx); }
            if (fo.x > W - fo.T.w / 2) { fo.x = W - fo.T.w / 2; fo.vx = -Math.abs(fo.vx); }
            var dx = fo.x - hx, dy = fo.y - (trayY + dip);
            var c = Math.cos(a), s = Math.sin(a);
            var lx = dx * c + dy * s, ly = -dx * s + dy * c;
            if (Math.abs(lx) < HALF + fo.T.w * 0.25) {
              var top = stackTopAt(lx, fo.T.w);
              if (ly >= -top && ly < -top + 7) {
                falling.splice(fi, 1);
                if (trayY - top - fo.T.h < hudBand / S + 3) {
                  // stack already reaches the pass: it bounces off the top and tumbles
                  var sd = lx >= 0 ? 1 : -1;
                  loose.push({ type: fo.type, T: fo.T, x: fo.x, y: fo.y, rot: fo.rot, vx: hvx + sd * 22, vy: -24, vr: sd * 5 });
                  api.beep(240, 0.06, 'square', 0.04);
                  continue;
                }
                land(fo, api.clamp(lx, -HALF, HALF), top);
                continue;
              }
            }
            if (fo.y >= floorY) { falling.splice(fi, 1); shatter(fo.x, fo.y, fo.T, fo.type, fo.vx); }
          }
          for (var li = loose.length - 1; li >= 0; li--) {
            var lo2 = loose[li];
            lo2.vy += 210 * dt; lo2.x += lo2.vx * dt; lo2.y += lo2.vy * dt; lo2.rot += lo2.vr * dt;
            if (lo2.y >= floorY - 0.5) { loose.splice(li, 1); shatter(lo2.x, floorY, lo2.T, lo2.type, lo2.vx, true); }
          }
          for (var si = shards.length - 1; si >= 0; si--) {
            var sh = shards[si];
            sh.life += dt;
            sh.x += sh.vx * dt; sh.vx *= Math.exp(-5 * dt);
            var edge = sh.whole ? TYPES[sh.whole].w / 2 + 1 : 2;
            if (sh.x < edge) { sh.x = edge; sh.vx = Math.abs(sh.vx) * 0.4; }
            if (sh.x > W - edge) { sh.x = W - edge; sh.vx = -Math.abs(sh.vx) * 0.4; }
            if (sh.vr) { sh.rot += sh.vr * dt; sh.vr *= Math.exp(-6 * dt); }
            if (sh.life > 6.5) shards.splice(si, 1);
          }

          /* table / deliver */
          if (!ended) {
            nextTable -= dt;
            if (!table && nextTable <= 0) {
              table = { side: hx < W / 2 ? 1 : -1, p: 0, state: 'in', timer: 0, t: 0, items: [] };
              if (Math.random() < 0.25) table.side *= -1;
              nextTable = 12;
              api.sfx('whoosh');
            }
          }
          if (table) {
            table.t += dt;
            if (table.state === 'in') {
              table.p = api.ease.outBack(Math.min(1, table.t / 0.6));
              if (table.t >= 0.6) { table.state = 'open'; table.timer = 6; table.p = 1; }
            } else if (table.state === 'open') {
              table.timer -= dt;
              if (table.timer <= 0 || ended) { table.state = 'out'; table.t = 0; api.sfx('whoosh'); }
            } else if (table.state === 'served') {
              table.timer -= dt;
              if (table.timer <= 0) { table.state = 'out'; table.t = 0; }
            } else if (table.state === 'out') {
              table.p = 1 - api.ease.inCubic(Math.min(1, table.t / 0.45));
              if (table.t >= 0.45) table = null;
            }
          }
          for (var q = flyers.length - 1; q >= 0; q--) {
            var fl = flyers[q];
            var was = fl.t;
            fl.t += dt / 0.42;
            if (was < 0 && fl.t >= 0) api.beep(620 + fl.k * 70, 0.04, 'square', 0.035);
            if (fl.t >= 1) {
              flyers.splice(q, 1);
              if (table) {
                table.items.push({ type: fl.type, ox: fl.ox });
                api.burst((tableX() + fl.ox) * S, tableTop() * S, { count: 4, colors: [P.yellow, P.white], speed: 60, gravity: 200, size: 3, angle: -Math.PI / 2, spread: 1 });
              }
            }
          }
          if (serveFlash > 0) serveFlash = Math.max(0, serveFlash - dt * 2);
          if (nudge > 0) nudge = Math.max(0, nudge - dt * 2.5);
          if (stamp) { stamp.t += dt; if (!table) stamp = null; }
          for (var lt = later.length - 1; lt >= 0; lt--) {
            later[lt].t -= dt;
            if (later[lt].t <= 0) { var job = later[lt]; later.splice(lt, 1); job.fn(); }
          }
        },

        draw: function (ctx, w, h) {
          layout();
          ctx.save();
          ctx.scale(S, S);

          /* floor */
          ctx.fillStyle = P.aztec2; ctx.fillRect(0, floorY, W, H - floorY + 1);
          ctx.fillStyle = P.aztec3; ctx.fillRect(0, floorY, W, 0.9);

          /* landing markers on the floor */
          falling.forEach(function (f) {
            var k = api.clamp(f.y / trayY, 0, 1);
            var mw = f.T.w * (0.3 + 0.7 * k);
            ctx.fillStyle = f.T.bad ? P.walnut : P.aztec3;
            rr(ctx, f.x - mw / 2, floorY + 1.6, mw, 1.3, 0.65); ctx.fill();
          });

          /* shards */
          shards.forEach(function (sh) {
            var k = sh.life > 6 ? 1 - (sh.life - 6) / 0.5 : 1;
            if (k <= 0) return;
            ctx.save(); ctx.translate(sh.x, sh.y);
            if (sh.whole) {
              ctx.scale(k, k); ctx.rotate(sh.whole === 'pan' ? 0 : 0.2);
              drawItem(ctx, P, rr, sh.whole, 0, clock);
            } else {
              ctx.scale(k, k); ctx.rotate(Math.sin(sh.rot) * 0.4);
              ctx.fillStyle = sh.c;
              ctx.beginPath(); ctx.moveTo(sh.pts[0][0], sh.pts[0][1]); ctx.lineTo(sh.pts[1][0], sh.pts[1][1]); ctx.lineTo(sh.pts[2][0], sh.pts[2][1]); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
          });

          /* arm + tray + load */
          drawArm(ctx, P, rr, hx, trayY + dip + 2.6, -hvx * 0.05 - axS * 0.004, floorY);
          /* table */
          if (table) {
            var tx = tableX(), tt = tableTop();
            drawTable(ctx, P, rr, tx, tt, floorY, table.items, clock);
            if (table.state === 'open') {
              var frac = api.clamp(table.timer / 6, 0, 1);
              ctx.fillStyle = P.cream3; rr(ctx, tx - TW / 2 + 3, tt + 2, TW - 6, 1.4, 0.7); ctx.fill();
              ctx.fillStyle = frac < 0.3 ? P.tomato : P.yellow; rr(ctx, tx - TW / 2 + 3, tt + 2, (TW - 6) * frac, 1.4, 0.7); ctx.fill();
              if (!inZone()) {
                var sx = serveX(), pul = 0.5 + 0.5 * Math.sin(clock * 7);
                ctx.fillStyle = P.yellowDark; rr(ctx, sx - 7, floorY + 1.5, 14, 1.6, 0.8); ctx.fill();
                ctx.fillStyle = P.yellow; rr(ctx, sx - 3.5 - pul * 3.5, floorY + 1.5, 7 + pul * 7, 1.6, 0.8); ctx.fill();
                var bob = Math.sin(clock * 7) * 1.2 - nudge * 3;
                var ay = tt - 16 + bob;
                ctx.fillStyle = P.yellow;
                ctx.beginPath(); ctx.moveTo(tx - 3, ay); ctx.lineTo(tx + 3, ay); ctx.lineTo(tx, ay + 3.6); ctx.closePath(); ctx.fill();
              }
            }
          }

          ctx.save();
          ctx.translate(hx, trayY + dip); ctx.rotate(a);
          drawTray(ctx, P, rr);
          items.forEach(function (it) {
            ctx.save();
            ctx.translate(it.lx, -it.base);
            var e = it.sq > 0 ? Math.sin(it.sq * Math.PI * 1.5) * it.sq : 0;
            var jig = it.sliding ? Math.sin(clock * 40 + it.id) * 0.04 : 0;
            ctx.rotate(jig);
            ctx.scale(1 + 0.3 * e, 1 - 0.3 * e);
            drawItem(ctx, P, rr, it.type, -a, clock);
            ctx.restore();
          });
          ctx.restore();

          /* serve prompt */
          if (table && table.state === 'open' && inZone() && !ended) {
            var top = 0; items.forEach(function (it) { top = Math.max(top, it.base + it.T.h); });
            var py = Math.max(20, trayY - top - 9) + Math.sin(clock * 6) * 0.8;
            var pw = 22;
            ctx.fillStyle = P.yellowDark; rr(ctx, hx - pw / 2, py - 4 + 1.1, pw, 7, 3.5); ctx.fill();
            ctx.fillStyle = P.yellow; rr(ctx, hx - pw / 2, py - 4, pw, 7, 3.5); ctx.fill();
          }

          /* falling + loose + flyers */
          falling.forEach(function (f) {
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
            var st = 1 + Math.min(0.12, f.vy * 0.0015);
            ctx.scale(1 / Math.sqrt(st), st);
            drawItem(ctx, P, rr, f.type, -f.rot, clock);
            ctx.restore();
          });
          loose.forEach(function (f) {
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
            drawItem(ctx, P, rr, f.type, -f.rot, clock);
            ctx.restore();
          });
          flyers.forEach(function (fl) {
            if (fl.t < 0) return;
            var e = api.ease.inOutSine(Math.min(1, fl.t));
            var x1 = tableX() + fl.ox, y1 = tableTop();
            var x = api.lerp(fl.x0, x1, e), y = api.lerp(fl.y0, y1, e) - Math.sin(e * Math.PI) * 12;
            ctx.save(); ctx.translate(x, y); ctx.rotate(fl.rot0 * (1 - e));
            drawItem(ctx, P, rr, fl.type, 0, clock);
            ctx.restore();
          });
          ctx.restore();

          /* serve prompt label (px) */
          if (table && table.state === 'open' && inZone() && !ended) {
            var top2 = 0; items.forEach(function (it) { top2 = Math.max(top2, it.base + it.T.h); });
            var py2 = Math.max(20, trayY - top2 - 9) + Math.sin(clock * 6) * 0.8;
            api.text(ctx, '▲ SERVIR', hx * S, (py2 - 0.6) * S, { size: Math.max(10, Math.round(S * 3.6)), color: P.aztec, align: 'center', baseline: 'middle', spacing: 1 });
          }

          /* served mark: brand asterisk pops onto the tablecloth */
          if (stamp && table) {
            var st = stamp.t, sc = st <= 0 ? 0 : st < 0.35 ? api.ease.outBack(st / 0.35) : 1;
            if (sc > 0) api.asterisk(ctx, tableX() * S, (tableTop() + 2.6) * S, 2.1 * S * sc, P.fawn, 0);
          }

          /* HUD band: items come out from under it, nothing covers the HUD */
          ctx.font = '700 12px ' + (api.FONT || 'sans-serif');
          var leftW = ctx.measureText('PUNTOS ' + score).width + 12 * 1.5 + 14;
          // tilt meter sits between score and clock; only drops a row on very narrow screens
          var bh = 8, by = 16, bw = Math.min(w * 0.26, 110), bx = w / 2 - bw / 2;
          if (bx < leftW + 10) { bx = leftW + 10; bw = Math.min(bw, w - 64 - bx); }
          if (bw < 48) { bw = Math.min(w * 0.4, 110); bx = w / 2 - bw / 2; by = combo > 1 ? 50 : 34; }
          var mcx = bx + bw / 2;
          var band = Math.max(combo > 1 ? 50 : 36, by + bh + 8);
          hudBand = band;
          ctx.fillStyle = P.aztec; ctx.fillRect(0, 0, w, band);
          ctx.fillStyle = P.aztec2; ctx.fillRect(0, band, w, 2);

          /* HUD */
          var remain = Math.max(0, Math.ceil(DURATION - time));
          api.hud(ctx, 'PUNTOS ' + score, Math.floor(remain / 60) + ':' + ('0' + remain % 60).slice(-2));
          if (combo > 1) api.text(ctx, 'x' + combo + ' RACHA', 14, 42, { size: 11, color: P.cream2, spacing: 1.5 });
          // tilt meter
          var thr = 0.13 / 0.5;
          ctx.fillStyle = P.aztec2; rr(ctx, bx, by, bw, bh, 4); ctx.fill();
          ctx.fillStyle = P.walnut;
          rr(ctx, bx, by, bw * (0.5 - thr / 2), bh, 4); ctx.fill();
          rr(ctx, bx + bw * (0.5 + thr / 2), by, bw * (0.5 - thr / 2), bh, 4); ctx.fill();
          ctx.fillStyle = P.aztec3; ctx.fillRect(mcx - 1, by - 2, 2, bh + 4);
          var mk = api.clamp(a / 0.5, -1, 1);
          var danger = Math.abs(a) > 0.13;
          ctx.fillStyle = danger ? P.tomato : P.yellow;
          ctx.beginPath(); ctx.arc(mcx + mk * (bw / 2 - 4), by + bh / 2, 5, 0, Math.PI * 2); ctx.fill();
        },

        input: function (key, type) {
          if (type !== 'down' || ended) return;
          if (key === 'up') serve();
        },
        destroy: function () {}
      };
    }
  });
})();

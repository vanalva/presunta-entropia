/* PE-83 console game: COMANDA
   Simon-style memory game. The chef calls the order (ingredients light up, each with its
   note), you repeat it with the D-pad and the ingredients hop into the pot. */
(function () {
  'use strict';

  var KEYS = ['up', 'right', 'down', 'left'];
  // A minor pentatonic-ish: A4 C5 E5 G5, one per ingredient
  var NOTE = { up: 659.25, right: 783.99, down: 523.25, left: 440 };
  var TAU = Math.PI * 2;
  var MAX_ROUND = 20;

  function tones(P, k) {
    if (k === 'up') return { c: P.tomato, d: P.fawnDark };
    if (k === 'right') return { c: P.yellow, d: P.yellowDark };
    if (k === 'down') return { c: P.white, d: P.cream3 };
    return { c: P.leaf, d: P.olive };
  }
  function c01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    ctx.fill();
  }
  function leafPath(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
    ctx.closePath();
  }

  /* ---------- ingredient art (flat, 2 tones + hard offset) ---------- */
  function drawIng(ctx, P, rr, k, x, y, r, rot, sx, sy) {
    if (!(r > 0.4)) return;
    var o = Math.max(1, r * 0.13);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(sx || 1, sy || 1);
    if (k === 'up') { // tomate
      ctx.fillStyle = P.fawnDark; ell(ctx, 0, o, r * 0.98, r * 0.84);
      ctx.fillStyle = P.tomato; ell(ctx, 0, 0, r * 0.98, r * 0.84);
      ctx.fillStyle = P.leaf;
      for (var i = 0; i < 5; i++) {
        var a = i * TAU / 5 - Math.PI / 2;
        ell(ctx, Math.cos(a) * r * 0.2, -r * 0.66 + Math.sin(a) * r * 0.1, r * 0.25, r * 0.085, a);
      }
      rr(ctx, -r * 0.055, -r * 0.98, r * 0.11, r * 0.3, r * 0.05); ctx.fill();
    } else if (k === 'right') { // limón (sits level, per the brand's straight-alignment rule)
      ctx.fillStyle = P.yellowDark;
      ell(ctx, 0, o, r * 0.9, r * 0.68);
      ell(ctx, r * 0.9, o, r * 0.19, r * 0.15);
      ell(ctx, -r * 0.9, o, r * 0.19, r * 0.15);
      ctx.fillStyle = P.yellow;
      ell(ctx, 0, 0, r * 0.9, r * 0.68);
      ell(ctx, r * 0.9, 0, r * 0.19, r * 0.15);
      ell(ctx, -r * 0.9, 0, r * 0.19, r * 0.15);
      ctx.save();
      ctx.translate(r * 0.2, -r * 0.55);
      ctx.rotate(0.9);
      ctx.fillStyle = P.leaf;
      leafPath(ctx, r * 0.62, r * 0.5); ctx.fill();
      ctx.restore();
    } else if (k === 'down') { // champiñón
      ctx.fillStyle = P.cream3;
      rr(ctx, -r * 0.3, -r * 0.05, r * 0.6, r * 0.85, r * 0.24); ctx.fill();
      // cap offset (gills band) then cap
      ctx.beginPath();
      ctx.ellipse(0, r * 0.08 + o, r, r * 0.86, 0, Math.PI, TAU);
      ctx.quadraticCurveTo(0, r * 0.3 + o, -r, r * 0.08 + o);
      ctx.fill();
      ctx.fillStyle = P.white;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.08, r, r * 0.86, 0, Math.PI, TAU);
      ctx.quadraticCurveTo(0, r * 0.3, -r, r * 0.08);
      ctx.fill();
    } else { // albahaca
      ctx.save();
      ctx.translate(-r * 0.1, r * 0.8);
      ctx.rotate(-0.95);
      ctx.fillStyle = P.olive; leafPath(ctx, r * 1.25, r * 1.05); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(r * 0.05, r * 0.92);
      ctx.fillStyle = P.olive;
      ctx.translate(0, o); leafPath(ctx, r * 1.85, r * 1.55); ctx.fill();
      ctx.translate(0, -o);
      ctx.fillStyle = P.leaf; leafPath(ctx, r * 1.85, r * 1.55); ctx.fill();
      ctx.strokeStyle = P.olive;
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.05); ctx.lineTo(0, -r * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.3, -r * 0.85);
      ctx.moveTo(0, -r * 0.8); ctx.lineTo(-r * 0.28, -r * 1.08); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- pot (walnut body, cream rim, fawn soup) ---------- */
  // origin = bottom centre. returns nothing; geometry is shared via potGeo()
  function potGeo(pw, ph) {
    return { bw: pw * 0.86, bh: ph * 0.7, rx: pw, ry: pw * 0.3, srx: pw * 0.8, sry: pw * 0.3 * 0.62 };
  }
  function drawPot(ctx, P, rr, cx, by, pw, ph, sx, sy) {
    var g = potGeo(pw, ph), o = Math.max(2, pw * 0.08);
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(sx || 1, sy || 1);
    // handles
    var hw = pw * 0.3, hh = Math.max(4, ph * 0.12), hy = -g.bh * 0.78;
    ctx.fillStyle = P.walnutDark;
    rr(ctx, -g.bw - hw * 0.75, hy + o * 0.6, hw * 1.2, hh, hh / 2); ctx.fill();
    rr(ctx, g.bw - hw * 0.45, hy + o * 0.6, hw * 1.2, hh, hh / 2); ctx.fill();
    ctx.fillStyle = P.walnut;
    rr(ctx, -g.bw - hw * 0.75, hy, hw * 1.2, hh, hh / 2); ctx.fill();
    rr(ctx, g.bw - hw * 0.45, hy, hw * 1.2, hh, hh / 2); ctx.fill();
    // body
    ctx.fillStyle = P.walnutDark;
    rr(ctx, -g.bw, -g.bh + o, g.bw * 2, g.bh, g.bw * 0.32); ctx.fill();
    ctx.fillStyle = P.walnut;
    rr(ctx, -g.bw, -g.bh, g.bw * 2, g.bh, g.bw * 0.32); ctx.fill();
    // rim
    ctx.fillStyle = P.cream3; ell(ctx, 0, -g.bh + o * 0.7, g.rx, g.ry);
    ctx.fillStyle = P.white; ell(ctx, 0, -g.bh, g.rx, g.ry);
    // soup
    ctx.fillStyle = P.fawn; ell(ctx, 0, -g.bh + g.ry * 0.08, g.srx, g.sry);
    ctx.restore();
  }

  (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
    id: 'comanda',
    title: 'Comanda',
    tagline: 'Escucha la comanda y échala a la olla en orden.',
    order: 30,
    controls: [['▲▼◀▶', 'Ingredientes'], ['A', 'Repetir comanda']],

    preview: function (ctx, w, h, t, api) {
      var P = api.P, s = Math.min(w, h);
      var cx = w / 2, cy = h / 2 + s * 0.03;
      var D = s * 0.31, Dx = Math.min(w * 0.3, D * 1.45), r = s * 0.105;
      var ph = D * 0.95, pw = D * 0.5;
      var PAT = ['up', 'right', 'down', 'left', 'right', 'up', 'left', 'down'];
      var step = 0.42, cyc = PAT.length * step + 0.8;
      var lt = t % cyc, idx = Math.floor(lt / step), f = (lt % step) / step;
      var litK = idx < PAT.length ? PAT[idx] : null;
      var amt = f < 0.65 ? api.ease.outBack(c01(f / 0.3)) : c01(1 - (f - 0.65) / 0.3);
      drawPot(ctx, P, api.rr, cx, cy + ph * 0.5, pw, ph, 1, 1);
      var pos = { up: [cx, cy - D], right: [cx + Dx, cy], down: [cx, cy + D], left: [cx - Dx, cy] };
      KEYS.forEach(function (k, i) {
        var a = k === litK ? amt : 0;
        var x = pos[k][0], y = pos[k][1] + Math.sin(t * 2.2 + i * 1.3) * r * 0.05;
        ctx.fillStyle = P.aztec2; ell(ctx, x, y + r * 0.95, r * 0.8 * (1 - a * 0.2), r * 0.2);
        if (a > 0.02) {
          ctx.strokeStyle = tones(P, k).c;
          ctx.lineWidth = Math.max(1.5, r * 0.12);
          ctx.beginPath(); ctx.arc(x, y - r * 0.3 * a, api.lerp(r * 0.8, r * 1.32, c01(a)), 0, TAU); ctx.stroke();
        }
        var sc = 1 + 0.26 * a;
        drawIng(ctx, P, api.rr, k, x, y - r * 0.3 * a, r * sc, 0, 1, 1);
      });
    },

    create: function (api) {
      var P = api.P, E = api.ease;
      var T = 0, round = 1, seq = [], phase = 'ready', phT = 0, pos = 0, score = 0;
      var roundBonus = 0, repeatUsed = false, replay = false, callIdx = -1, step = 0.6, limit = 3, left = 3;
      var failKind = '', boilAt = -1, ended = false, denyAt = -9, tickDone = 0, lastGain = 0;
      var hops = [], bubbles = [], ripples = [], foam = [], drips = [], sched = [], tk = [];
      var spring = { v: 0, vel: 0 }, nextBubble = 0.3;
      var slots = {};
      KEYS.forEach(function (k) { slots[k] = { on: false, litAt: -9, offAt: -9, press: -9, back: -9, nudge: -9, hint: false }; });

      function later(dt, fn) { sched.push({ at: T + dt, fn: fn }); }
      function note(k, len, v) {
        var f = NOTE[k];
        api.beep(f, len || 0.3, 'triangle', v || 0.16);
        api.beep(f * 2, 0.05, 'square', 0.016);
      }
      function L() {
        var w = api.w, h = api.h, s = Math.min(w, h), pad = 14;
        var th = api.clamp(s * 0.1, 26, 40), ty = 36;
        var top = ty + th + 10, bot = h - 36, ah = bot - top, m = Math.min(ah, w);
        var D = m * 0.34, Dx = Math.min(w * 0.33, D * 1.35), r = m * 0.1;
        var ph = D * 0.95, pw = D * 0.52;
        var cx = w / 2, cy = top + ah / 2 + r * 0.15;
        var g = potGeo(pw, ph), by = cy + ph * 0.5;
        return {
          w: w, h: h, s: s, pad: pad, th: th, ty: ty, D: D, Dx: Dx, r: r, ph: ph, pw: pw, cx: cx, cy: cy, by: by, g: g,
          ox: cx, oy: by - g.bh,
          pos: { up: [cx, cy - D], right: [cx + Dx, cy], down: [cx, cy + D], left: [cx - Dx, cy] }
        };
      }
      function litAmt(s) {
        if (s.on) return E.outBack(c01((T - s.litAt) / 0.16));
        return c01(1 - (T - s.offAt) / 0.16);
      }
      function light(k, dur) { var s = slots[k]; s.on = true; s.litAt = T; s.offAt = T + dur; }

      function newRound() {
        var n = round + 1;
        while (seq.length < n) {
          var k, tries = 0;
          do { k = api.pick(KEYS); tries++; }
          while (tries < 8 && seq.length >= 1 && seq[seq.length - 1] === k && (seq.length >= 2 && seq[seq.length - 2] === k || Math.random() < 0.6));
          seq.push(k);
        }
        tk = seq.map(function () { return { st: 0, at: T }; });
        pos = 0; roundBonus = 0; repeatUsed = false; replay = false;
        step = Math.max(0.3, 0.6 * Math.pow(0.9, Math.floor((round - 1) / 3)));
        limit = Math.max(1.8, 3 - (round - 1) * 0.1);
        left = limit;
        phase = 'ready'; phT = 0;
      }
      function startCall(isReplay) {
        phase = 'call'; phT = isReplay ? -0.25 : 0; replay = isReplay; callIdx = -1;
      }
      function startInput() {
        phase = 'input'; phT = 0; left = limit; tickDone = 0;
        tk.forEach(function (c, i) { if (c.st === 1) { c.st = 2; c.at = T + i * 0.035; } });
      }
      function launch(k, bad) {
        var l = L(), s = slots[k];
        s.press = T; s.back = T + 0.06 + 0.2;
        hops.push({ k: k, t: -0.06, dur: 0.36, x0: l.pos[k][0], y0: l.pos[k][1], bad: bad, spin: api.rand(-4, 4), done: false });
      }
      function land(hp) {
        var l = L(), col = tones(P, hp.k);
        api.burst(l.ox, l.oy, { count: 14, colors: [col.c, col.d, P.fawnLight], speed: l.D * 2.4, gravity: l.D * 9, size: Math.max(3, l.s * 0.018), angle: -Math.PI / 2, spread: 0.95, life: 0.8 });
        ripples.push({ at: T });
        spring.v = 0.11; spring.vel = 0;
        api.noise(0.09, { filter: 'lowpass', freq: 1300, to: 260, q: 3, vol: 0.09 });
        if (hp.bad) startBoil();
      }
      function startBoil() {
        if (boilAt >= 0) return;
        boilAt = T; phase = 'fail'; phT = 0;
        var l = L(), g = l.g;
        foam = []; drips = [];
        // ring of foam around the rim (back half first so the front overlaps), then a heap on top
        for (var i = 0; i < 12; i++) {
          var a = -Math.PI / 2 + (i / 12) * TAU;
          foam.push({
            x: Math.cos(a) * g.rx * 0.9, y: -g.bh + Math.sin(a) * g.ry * 0.95,
            r: l.pw * api.rand(0.22, 0.3), delay: Math.abs(Math.sin(a / 2)) * 0.12 + api.rand(0, 0.06), z: Math.sin(a)
          });
        }
        for (var m = 0; m < 4; m++) {
          foam.push({ x: (m - 1.5) * g.rx * 0.36, y: -g.bh - g.ry * api.rand(0.5, 0.9), r: l.pw * api.rand(0.24, 0.32), delay: 0.12 + m * 0.04, z: 0.5 });
        }
        foam.sort(function (p, q) { return p.z - q.z; });
        for (var j = 0; j < 4; j++) {
          drips.push({ x: (j < 2 ? -1 : 1) * g.bw * api.rand(0.35, 0.8), r: l.pw * api.rand(0.12, 0.17), delay: 0.25 + j * 0.08, len: g.bh * api.rand(0.3, 0.6) });
        }
        api.sfx('fail');
        api.shake(5, 260);
        api.noise(0.7, { filter: 'lowpass', freq: 1500, to: 300, q: 2, vol: 0.13 });
        for (var b = 0; b < 6; b++) later(0.08 + b * 0.1, function () { api.beep(api.rand(150, 260), 0.07, 'sine', 0.08); });
        later(1.0, function () {
          if (ended) return;
          ended = true;
          api.end({
            score: score, label: 'Comandas', fail: true, delay: 250,
            title: failKind === 'time' ? '¡Se pasó el tiempo!' : '¡Se desbordó la olla!',
            lines: ['Llegaste a la ronda ' + round]
          });
        });
      }
      function fail(kind, wrongKey) {
        failKind = kind;
        var want = seq[pos];
        slots[want].hint = true;
        if (tk[pos]) { tk[pos].st = 4; tk[pos].at = T; }
        if (kind === 'wrong') {
          phase = 'failing'; phT = 0;
          launch(wrongKey, true);
          note(wrongKey, 0.2, 0.12);
          api.beep(NOTE[wrongKey] * 1.06, 0.22, 'square', 0.03);
        } else {
          startBoil();
        }
      }
      function celebrate() {
        var l = L();
        lastGain = 10 + roundBonus;
        score += lastGain;
        api.float(l.ox - l.Dx * 0.55, l.oy - l.D * 0.3, '+' + lastGain, P.yellow, Math.round(api.clamp(l.s * 0.07, 18, 28)));
        [440, 523.25, 659.25, 783.99, 880].forEach(function (f, i) {
          later(i * 0.055, function () { api.beep(f, 0.16, 'triangle', 0.1); });
        });
        later(0.3, function () { api.sfx('coin'); });
        spring.v = -0.14; spring.vel = 0;
        for (var i = 0; i < 9; i++) bubbles.push({ x: api.rand(-0.75, 0.75), y: api.rand(-0.5, 0.5), at: T + i * 0.05, life: api.rand(0.35, 0.6), r: api.rand(0.12, 0.2) });
        api.burst(l.ox, l.oy - l.g.ry, { count: 12, colors: [P.fawnLight, P.white, P.yellow], speed: l.D * 1.8, gravity: l.D * 3, size: Math.max(3, l.s * 0.016), angle: -Math.PI / 2, spread: 0.7, shape: 'dot', life: 0.9 });
      }

      newRound();

      return {
        update: function (dt) {
          T += dt; phT += dt;
          // scheduled sounds / events
          for (var i = sched.length - 1; i >= 0; i--) {
            if (sched[i].at <= T) { var f = sched[i].fn; sched.splice(i, 1); f(); }
          }
          // pot spring
          spring.vel += (-420 * spring.v - 13 * spring.vel) * dt;
          spring.v += spring.vel * dt;
          KEYS.forEach(function (k) { var s = slots[k]; if (s.on && T >= s.offAt) s.on = false; });

          if (phase === 'ready') {
            if (phT >= 0.45 && phT - dt < 0.45) { api.beep(2093, 0.4, 'triangle', 0.05); api.beep(3136, 0.25, 'sine', 0.018); }
            if (phT >= 0.85) startCall(false);
          } else if (phase === 'call') {
            var n = seq.length;
            var idx = phT < 0 ? -1 : Math.floor(phT / step);
            if (idx > callIdx && idx < n) {
              callIdx = idx;
              var k = seq[idx];
              light(k, step * 0.62);
              note(k, Math.min(0.36, step * 0.85));
              if (tk[idx].st !== 3) { tk[idx].st = 1; tk[idx].at = T; }
            }
            if (phT >= n * step + 0.12) startInput();
          } else if (phase === 'input') {
            left -= dt;
            if (left < 0.9 && tickDone === 0) { tickDone = 1; api.beep(1319, 0.04, 'square', 0.025); }
            if (left < 0.45 && tickDone === 1) { tickDone = 2; api.beep(1319, 0.04, 'square', 0.03); }
            if (left <= 0) { left = 0; fail('time'); }
          } else if (phase === 'done') {
            if (phT >= 0 && phT - dt < 0) celebrate();
            if (phT >= 1.0) {
              if (round >= MAX_ROUND) {
                if (!ended) {
                  ended = true;
                  api.end({ score: score, label: 'Comandas', fail: false, title: '¡Comanda perfecta!', lines: ['Cerraste las ' + MAX_ROUND + ' rondas'] });
                }
                phase = 'over';
              } else { round++; newRound(); }
            }
          }

          // hops
          for (var h = hops.length - 1; h >= 0; h--) {
            var hp = hops[h];
            hp.t += dt;
            if (!hp.done && hp.t >= hp.dur) { hp.done = true; land(hp); hops.splice(h, 1); }
          }
          // idle soup bubbles
          nextBubble -= dt;
          if (nextBubble <= 0) {
            nextBubble = phase === 'fail' ? 0.05 : api.rand(0.35, 0.7);
            bubbles.push({ x: api.rand(-0.7, 0.7), y: api.rand(-0.45, 0.45), at: T, life: api.rand(0.4, 0.7), r: api.rand(0.07, 0.13) });
          }
          for (var b = bubbles.length - 1; b >= 0; b--) if (T - bubbles[b].at > bubbles[b].life) bubbles.splice(b, 1);
          for (var rp = ripples.length - 1; rp >= 0; rp--) if (T - ripples[rp].at > 0.4) ripples.splice(rp, 1);
        },

        draw: function (ctx, w, h) {
          var l = L(), r = l.r, g = l.g;
          api.hud(ctx, 'RONDA ' + round, String(score));

          /* ----- ticket ----- */
          var th = l.th, tw = w - l.pad * 2, tx = l.pad, off = 0;
          if (phase === 'ready') off = -(th + 50) * (1 - E.outBack(c01(phT / 0.42)));
          else if (phase === 'done' || phase === 'over') off = -(th + 50) * E.inCubic(c01((phT - 0.62) / 0.3));
          var ty = l.ty + off, slotY = l.ty - 5;
          // the ticket prints out of a slot under the HUD, so it never covers the HUD text
          ctx.fillStyle = P.aztec3; api.rr(ctx, tx - 3, slotY - 2, tw + 6, 3, 1.5); ctx.fill();
          ctx.save();
          ctx.beginPath(); ctx.rect(0, slotY, w, h - slotY); ctx.clip();
          ctx.fillStyle = P.cream3; api.rr(ctx, tx, ty + 3, tw, th, 6); ctx.fill();
          ctx.fillStyle = P.white; api.rr(ctx, tx, ty, tw, th, 6); ctx.fill();
          ctx.fillStyle = P.aztec;
          ctx.beginPath(); ctx.arc(tx, ty + th / 2, th * 0.14, 0, TAU); ctx.arc(tx + tw, ty + th / 2, th * 0.14, 0, TAU); ctx.fill();
          var lw = th * 1.15;
          api.text(ctx, 'Nº' + round, tx + lw / 2 + 2, ty + th / 2 + 1, { size: Math.round(th * 0.36), color: P.walnut, align: 'center', baseline: 'middle' });
          ctx.fillStyle = P.cream3;
          for (var dy = ty + 5; dy < ty + th - 5; dy += 5) ctx.fillRect(tx + lw + 1, dy, 1.5, 2.5);
          var n = tk.length, ax0 = tx + lw + 8, ax1 = tx + tw - 10, avail = ax1 - ax0;
          var cw = Math.min(th * 0.66, avail / n - 3), gap = Math.min(th * 0.16, (avail - n * cw) / Math.max(1, n - 1));
          var tot = n * cw + (n - 1) * gap, sx0 = ax0 + (avail - tot) / 2, ccy = ty + th / 2 + 1;
          for (var i = 0; i < n; i++) {
            var c = tk[i], ccx = sx0 + i * (cw + gap) + cw / 2;
            if (c.st === 0) {
              ctx.fillStyle = P.cream2;
              api.rr(ctx, ccx - cw * 0.3, ccy + cw * 0.26, cw * 0.6, Math.max(2, cw * 0.09), 1); ctx.fill();
              continue;
            }
            var sc = E.outBack(c01((T - c.at) / 0.2));
            if (sc <= 0.01) continue;
            ctx.save();
            ctx.translate(ccx, ccy);
            ctx.scale(c.st === 2 ? sc : sc, sc);
            ctx.fillStyle = c.st === 4 ? P.tomato : P.walnut;
            api.rr(ctx, -cw / 2, -cw / 2, cw, cw, cw * 0.26); ctx.fill();
            if (cw < 14) {
              // too small for icons: coloured dot = ingredient, empty cell = still hidden
              if (c.st === 4) { ctx.fillStyle = P.walnut; api.rr(ctx, -cw * 0.34, -cw * 0.34, cw * 0.68, cw * 0.68, cw * 0.16); ctx.fill(); }
              if (c.st !== 2) { ctx.fillStyle = tones(P, seq[i]).c; ctx.beginPath(); ctx.arc(0, 0, cw * 0.3, 0, TAU); ctx.fill(); }
              if (c.st === 3) { ctx.fillStyle = P.leaf; api.rr(ctx, -cw / 2, cw * 0.62, cw, Math.max(2, cw * 0.18), 1); ctx.fill(); }
            } else if (c.st === 2) {
              api.text(ctx, '?', 0, 1, { size: Math.max(8, Math.round(cw * 0.55)), color: P.cream3, align: 'center', baseline: 'middle' });
            } else {
              if (c.st === 4) { ctx.fillStyle = P.walnut; api.rr(ctx, -cw * 0.4, -cw * 0.4, cw * 0.8, cw * 0.8, cw * 0.2); ctx.fill(); }
              drawIng(ctx, P, api.rr, seq[i], 0, 0, cw * 0.34, 0, 1, 1);
              if (c.st === 3) {
                var br = Math.max(3, cw * 0.2);
                ctx.fillStyle = P.leaf;
                ctx.beginPath(); ctx.arc(cw * 0.42, cw * 0.42, br, 0, TAU); ctx.fill();
                ctx.strokeStyle = P.white; ctx.lineWidth = Math.max(1, br * 0.35); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(cw * 0.42 - br * 0.45, cw * 0.42);
                ctx.lineTo(cw * 0.42 - br * 0.1, cw * 0.42 + br * 0.35);
                ctx.lineTo(cw * 0.42 + br * 0.45, cw * 0.42 - br * 0.35);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
          ctx.restore();

          /* ----- ingredients ----- */
          KEYS.forEach(function (k, idx) {
            var s = slots[k], p = l.pos[k];
            var a = litAmt(s);
            var bob = Math.sin(T * 2.2 + idx * 1.3) * r * 0.05;
            var x = p[0], y = p[1] + bob;
            ctx.fillStyle = P.aztec2; ell(ctx, x, p[1] + r * 0.98, r * 0.82 * (1 - a * 0.2), r * 0.2);
            if (s.hint && boilAt >= 0) {
              var pr = 1 + Math.sin((T - boilAt) * 9) * 0.05;
              ctx.strokeStyle = P.white; ctx.lineWidth = Math.max(1.5, r * 0.1);
              ctx.beginPath(); ctx.arc(x, y, r * 1.32 * pr, 0, TAU); ctx.stroke();
            }
            if (a > 0.02) {
              ctx.strokeStyle = tones(P, k).c;
              ctx.lineWidth = Math.max(1.5, r * 0.13);
              ctx.beginPath(); ctx.arc(x, y - r * 0.32 * a, api.lerp(r * 0.8, r * 1.34, c01(a)), 0, TAU); ctx.stroke();
            }
            var age = T - s.press, sxx = 1, syy = 1, rad = r * (1 + 0.26 * a), yy = y - r * 0.32 * a, rot = 0;
            var na = T - s.nudge;
            if (na >= 0 && na < 0.35) rot = Math.sin(na * 38) * 0.22 * (1 - na / 0.35);
            if (age >= 0 && age < 0.06) {
              var q = E.inOutSine(age / 0.06);
              sxx = 1 + 0.16 * q; syy = 1 - 0.22 * q; yy += r * 0.2 * q;
            } else if (T < s.back && age >= 0) {
              return;
            } else if (T - s.back < 0.24) {
              rad *= E.outBack(c01((T - s.back) / 0.24));
            }
            drawIng(ctx, P, api.rr, k, x, yy, rad, rot, sxx, syy);
          });

          /* ----- pot ----- */
          var jx = 0, psx = 1 + spring.v * 0.8, psy = 1 - spring.v;
          if (boilAt >= 0 && T - boilAt < 0.7) jx = Math.sin(T * 55) * l.pw * 0.035 * (1 - (T - boilAt) / 0.7);
          var pcx = l.cx + jx;
          drawPot(ctx, P, api.rr, pcx, l.by, l.pw, l.ph, psx, psy);
          // soup life (in the pot's squashed space)
          ctx.save();
          ctx.translate(pcx, l.by);
          ctx.scale(psx, psy);
          var soy = -g.bh + g.ry * 0.08;
          bubbles.forEach(function (b) {
            var u = (T - b.at) / b.life;
            if (u < 0 || u > 1) return;
            var br = g.srx * b.r * (u < 0.8 ? E.outBack(c01(u / 0.35)) : 1 - (u - 0.8) / 0.2 * 0.9);
            ctx.fillStyle = P.fawnLight;
            ell(ctx, b.x * g.srx * 0.85, soy + b.y * g.sry * 0.7, br, br * 0.8);
          });
          ripples.forEach(function (rp) {
            var u = c01((T - rp.at) / 0.4), e = E.outCubic(u);
            ctx.strokeStyle = P.fawnLight;
            ctx.lineWidth = Math.max(1, g.sry * 0.3 * (1 - u));
            ctx.beginPath(); ctx.ellipse(0, soy, g.srx * (0.2 + 0.72 * e), g.sry * (0.2 + 0.72 * e), 0, 0, TAU); ctx.stroke();
          });
          // boil-over foam
          if (boilAt >= 0) {
            var bt = T - boilAt, fo = Math.max(1.5, l.pw * 0.06);
            drips.forEach(function (d) {
              var u = c01((bt - d.delay) / 0.6);
              if (u <= 0) return;
              var len = d.len * E.outCubic(u), dr = d.r * E.outBack(c01(u * 3));
              ctx.fillStyle = P.cream3; api.rr(ctx, d.x - dr, -g.bh - dr + fo, dr * 2, len + dr * 2, dr); ctx.fill();
              ctx.fillStyle = P.white; api.rr(ctx, d.x - dr, -g.bh - dr, dr * 2, len + dr * 2, dr); ctx.fill();
            });
            var fr = function (f) { return f.r * E.outBack(c01((bt - f.delay) / 0.3)) * (1 + Math.sin(bt * 7 + f.x) * 0.05); };
            foam.forEach(function (f) {
              var rr2 = fr(f);
              if (rr2 <= 0.3) return;
              ctx.fillStyle = P.cream3; ell(ctx, f.x, f.y + fo, rr2, rr2 * 0.9);
              ctx.fillStyle = P.white; ell(ctx, f.x, f.y, rr2, rr2 * 0.9);
            });
          }
          ctx.restore();

          /* ----- hops ----- */
          hops.forEach(function (hp) {
            if (hp.t < 0) return;
            var u = c01(hp.t / hp.dur);
            var x = api.lerp(hp.x0, l.ox, E.inOutSine(u));
            var peak = Math.max(l.D * 0.45, (hp.y0 - l.oy) * 0.4 + l.D * 0.35);
            var y = api.lerp(hp.y0, l.oy - g.ry * 0.2, u) - peak * 4 * u * (1 - u);
            var st = Math.sin(Math.PI * u) * 0.14;
            var rad = r * api.lerp(1, 0.62, u) * (u > 0.82 ? 1 - (u - 0.82) / 0.18 * 0.7 : 1);
            drawIng(ctx, P, api.rr, hp.k, x, y, rad, hp.spin * u, 1 - st, 1 + st);
          });

          /* ----- bottom row: status, repeat, timer ----- */
          var ly = h - 24, lab = '', lc = P.white;
          if (phase === 'ready') { lab = 'MARCHANDO…'; lc = P.cream3; }
          else if (phase === 'call') { lab = replay ? 'OTRA VEZ' : 'ESCUCHA'; lc = P.white; }
          else if (phase === 'input') { lab = 'TU TURNO · ' + pos + '/' + seq.length; lc = P.yellow; }
          else if (phase === 'done' || phase === 'over') { lab = '¡MARCHA!'; lc = P.leaf; }
          else { lab = failKind === 'time' ? '¡TIEMPO!' : '¡NO ERA ESE!'; lc = P.tomato; }
          api.text(ctx, lab, l.pad, ly, { size: 11, color: lc, spacing: 1.5 });
          var can = !repeatUsed && phase === 'input';
          var shx = T - denyAt < 0.3 ? Math.sin((T - denyAt) * 60) * 3 * (1 - (T - denyAt) / 0.3) : 0;
          var chx = w - l.pad - 8 + shx, chy = ly - 4;
          ctx.fillStyle = !repeatUsed ? P.fawn : P.aztec3;
          ctx.beginPath(); ctx.arc(chx, chy, 8, 0, TAU); ctx.fill();
          api.text(ctx, 'A', chx, chy + 1, { size: 10, color: !repeatUsed ? P.white : P.aztec2, align: 'center', baseline: 'middle' });
          api.text(ctx, 'REPETIR ×' + (repeatUsed ? 0 : 1), chx - 14, ly, { size: 11, color: can ? P.white : repeatUsed ? P.aztec3 : P.cream3, align: 'right', spacing: 1.2 });
          var bx = l.pad, bw = w - l.pad * 2, byy = h - 13, bh = 5;
          ctx.fillStyle = P.aztec2; api.rr(ctx, bx, byy, bw, bh, bh / 2); ctx.fill();
          var frac = 0, bc = P.yellow;
          if (phase === 'input') { frac = left / limit; bc = frac < 0.34 ? P.tomato : P.yellow; }
          else if (phase === 'done' || phase === 'over') { frac = 1; bc = P.leaf; }
          else if (phase === 'fail' || phase === 'failing') { frac = left / limit; bc = P.tomato; }
          if (frac > 0.005) { ctx.fillStyle = bc; api.rr(ctx, bx, byy, bw * frac, bh, bh / 2); ctx.fill(); }
        },

        input: function (key, type) {
          if (type !== 'down') return;
          if (key === 'a') {
            if (phase === 'input' && !repeatUsed) {
              repeatUsed = true;
              var l = L();
              if (score > 0) { score = Math.max(0, score - 5); api.float(l.w - l.pad - 40, l.h - 44, '-5', P.cream3, 14); }
              api.sfx('whoosh');
              tk.forEach(function (c) { if (c.st === 2) { c.st = 0; c.at = T; } });
              startCall(true);
            } else if (phase === 'input' || repeatUsed) {
              denyAt = T; api.beep(196, 0.08, 'triangle', 0.06);
            }
            return;
          }
          if (KEYS.indexOf(key) < 0) return;
          if (phase === 'ready' || phase === 'call') {
            // not your turn yet: the ingredient shakes its head, quietly
            slots[key].nudge = T; api.beep(NOTE[key] / 2, 0.05, 'triangle', 0.04);
            return;
          }
          if (phase !== 'input') return;
          var want = seq[pos];
          if (key !== want) { fail('wrong', key); return; }
          note(key, 0.3);
          launch(key, false);
          roundBonus += Math.round(3 * c01(left / limit));
          tk[pos].st = 3; tk[pos].at = T;
          pos++;
          left = limit; tickDone = 0;
          if (pos >= seq.length) { phase = 'done'; phT = -0.46; }
        },

        // read-only snapshot for scripted tests
        debug: function () { return { seq: seq.slice(), pos: pos, phase: phase, round: round, score: score, left: left }; },
        destroy: function () { sched = []; hops = []; }
      };
    }
  });
})();

/* PE-83 · SLICER — cut the ingredient into N equal pieces.
   The knife sweeps across; A chops where it is. After N-1 cuts the
   pieces spread out and get measured against the ideal. */
(function () {
  'use strict';

  var TYPES = [
    { id: 'zanahoria', name: 'Zanahoria' },
    { id: 'pepino', name: 'Pepino' },
    { id: 'baguette', name: 'Baguette' },
    { id: 'chorizo', name: 'Chorizo' },
    { id: 'puerro', name: 'Puerro' }
  ];
  var ROUNDS = [
    { type: 'zanahoria', n: 3, speed: 0.55, sine: false, guide: true },
    { type: 'pepino', n: 4, speed: 0.62, sine: false, guide: false },
    { type: 'baguette', n: 4, speed: 0.72, sine: true, guide: false },
    { type: 'chorizo', n: 5, speed: 0.78, sine: true, guide: false },
    { type: 'puerro', n: 6, speed: 0.86, sine: true, guide: false }
  ];

  /* ---------- ingredient art: full shape in [x, x+L], clipped by caller ---------- */
  function capsule(ctx, api, x, y, L, T, r) {
    api.rr(ctx, x, y - T / 2, L, T, r == null ? T / 2 : r);
  }
  function drawBody(ctx, api, type, x, y, L, T) {
    var P = api.P;
    // hard depth layer
    ctx.save();
    ctx.translate(0, T * 0.14);
    shape(ctx, api, type, x, y, L, T, true);
    ctx.restore();
    shape(ctx, api, type, x, y, L, T, false);
  }
  function shape(ctx, api, type, x, y, L, T, depth) {
    var P = api.P, i;
    if (type === 'zanahoria') {
      ctx.beginPath();
      ctx.moveTo(x + T * 0.3, y - T / 2);
      ctx.lineTo(x + L - T * 0.2, y - T * 0.08);
      ctx.quadraticCurveTo(x + L, y, x + L - T * 0.2, y + T * 0.08);
      ctx.lineTo(x + T * 0.3, y + T / 2);
      ctx.quadraticCurveTo(x, y + T / 2, x, y);
      ctx.quadraticCurveTo(x, y - T / 2, x + T * 0.3, y - T / 2);
      ctx.fillStyle = depth ? P.yellowDark : P.yellow;
      ctx.fill();
      if (depth) return;
      ctx.fillStyle = P.yellowDark;
      for (i = 1; i < 6; i++) {
        var px = x + L * i / 6.5, th = T * (1 - i / 7.5);
        ctx.fillRect(px, y - th * 0.28, T * 0.08, th * 0.34);
      }
      // leaves (left end)
      ctx.fillStyle = P.leaf;
      ctx.beginPath(); ctx.ellipse(x - T * 0.28, y - T * 0.28, T * 0.42, T * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - T * 0.32, y + T * 0.12, T * 0.4, T * 0.15, 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'pepino') {
      capsule(ctx, api, x, y, L, T);
      ctx.fillStyle = depth ? P.olive : P.leaf;
      ctx.fill();
      if (depth) return;
      ctx.fillStyle = P.olive;
      for (i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(x + T * 0.6 + (L - T * 1.2) * i / 8, y + (i % 2 ? -T * 0.18 : T * 0.14), T * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(x + T * 0.25, y - T * 0.34, L - T * 0.5, T * 0.07);
    } else if (type === 'baguette') {
      capsule(ctx, api, x, y, L, T);
      ctx.fillStyle = depth ? P.yellowDark : P.yellowLight;
      ctx.fill();
      if (depth) return;
      ctx.fillStyle = P.yellowDark;
      for (i = 0; i < 5; i++) {
        var sx = x + T * 0.7 + (L - T * 1.4) * i / 4;
        ctx.save();
        ctx.translate(sx, y);
        ctx.rotate(-0.55);
        api.rr(ctx, -T * 0.34, -T * 0.06, T * 0.68, T * 0.12, T * 0.06);
        ctx.fill();
        ctx.restore();
      }
    } else if (type === 'chorizo') {
      capsule(ctx, api, x, y, L, T);
      ctx.fillStyle = depth ? P.fawnDark : P.tomato;
      ctx.fill();
      if (depth) return;
      ctx.fillStyle = P.white;
      for (i = 0; i < 14; i++) {
        var fx = x + T * 0.5 + (L - T) * ((i * 0.618) % 1);
        var fy = y + (((i * 0.37) % 1) - 0.5) * T * 0.6;
        ctx.fillRect(fx, fy, T * 0.08, T * 0.08);
      }
      ctx.fillStyle = P.walnut;
      ctx.fillRect(x - T * 0.12, y - T * 0.06, T * 0.2, T * 0.12);
      ctx.fillRect(x + L - T * 0.08, y - T * 0.06, T * 0.2, T * 0.12);
    } else { // puerro
      var split = x + L * 0.55;
      capsule(ctx, api, x, y, L, T, T * 0.3);
      ctx.fillStyle = depth ? P.cream3 : P.white;
      ctx.fill();
      if (depth) return;
      ctx.save();
      capsule(ctx, api, x, y, L, T, T * 0.3);
      ctx.clip();
      ctx.fillStyle = P.leaf;
      ctx.fillRect(split, y - T, L, T * 2);
      ctx.fillStyle = P.olive;
      for (i = 0; i < 4; i++) ctx.fillRect(split + T * 0.2 + i * (L * 0.45 - T * 0.4) / 3, y - T, T * 0.06, T * 2);
      ctx.fillStyle = P.cream3;
      ctx.fillRect(x, y + T * 0.12, split - x, T * 0.06);
      ctx.restore();
      // roots
      ctx.strokeStyle = P.cream3;
      ctx.lineWidth = Math.max(1, T * 0.05);
      for (i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + i * T * 0.1); ctx.lineTo(x - T * 0.25, y + i * T * 0.16); ctx.stroke();
      }
    }
  }
  function faceColor(api, type) {
    var P = api.P;
    return { zanahoria: P.yellowLight, pepino: P.cream2, baguette: P.white, chorizo: P.fawnLight, puerro: P.white }[type];
  }
  function crumbColors(api, type) {
    var P = api.P;
    return {
      zanahoria: [P.yellow, P.yellowLight], pepino: [P.leaf, P.cream2], baguette: [P.yellowLight, P.white],
      chorizo: [P.tomato, P.white], puerro: [P.white, P.leaf]
    }[type];
  }

  /* ---------- board ---------- */
  function drawBoard(ctx, api, x, y, w, h) {
    var P = api.P;
    api.rr(ctx, x, y + h * 0.12, w, h, h * 0.18); ctx.fillStyle = P.walnutDark; ctx.fill();
    api.rr(ctx, x, y, w, h, h * 0.18); ctx.fillStyle = P.walnut; ctx.fill();
    ctx.fillStyle = P.walnutDark;
    for (var i = 1; i < 4; i++) ctx.fillRect(x + w * 0.06, y + h * i / 4, w * (0.5 + (i % 2) * 0.3), Math.max(1, h * 0.03));
    ctx.beginPath(); ctx.arc(x + w - h * 0.35, y + h * 0.5, h * 0.12, 0, Math.PI * 2); ctx.fillStyle = P.aztec; ctx.fill();
  }

  /* ---------- knife ---------- */
  function drawKnife(ctx, api, x, tipY, T, tilt) {
    var P = api.P;
    var bh = T * 1.45, bw = T * 0.72;
    ctx.save();
    ctx.translate(x, tipY);
    ctx.rotate(tilt || 0);
    // blade: cleaver, edge at the bottom (y = 0)
    ctx.beginPath();
    ctx.moveTo(-bw * 0.08, 0);
    ctx.lineTo(bw * 0.92, 0);
    ctx.lineTo(bw * 0.92, -bh);
    ctx.lineTo(-bw * 0.08, -bh);
    ctx.closePath();
    ctx.fillStyle = P.cream3; ctx.fill();
    ctx.fillStyle = P.white;
    ctx.fillRect(-bw * 0.08, -bh, bw, bh * 0.78);
    ctx.beginPath(); ctx.arc(bw * 0.68, -bh * 0.8, bw * 0.09, 0, Math.PI * 2); ctx.fillStyle = P.aztec; ctx.fill();
    // cutting line marker
    ctx.fillStyle = P.yellow;
    ctx.fillRect(-bw * 0.08, -bh, Math.max(2, T * 0.07), bh);
    // handle
    api.rr(ctx, bw * 0.14, -bh - T * 0.95, bw * 0.56, T * 1.0, T * 0.16);
    ctx.fillStyle = P.walnut; ctx.fill();
    ctx.fillStyle = P.yellow;
    ctx.fillRect(bw * 0.12, -bh - T * 0.05, bw * 0.6, T * 0.1);
    ctx.restore();
  }

  function layout(w, h) {
    var m = Math.min(w, h);
    var L = w * 0.68;
    var T = Math.min(h * 0.11, L * 0.2, m * 0.14);
    var boardW = w * 0.9, boardH = T * 2.2;
    var cy = h * 0.66;
    return {
      L: L, T: T, x0: (w - L) / 2, y: cy,
      board: { x: (w - boardW) / 2, y: cy - boardH * 0.3, w: boardW, h: boardH },
      knifeRest: cy - T * 2.4
    };
  }

  function rating(e) {
    if (e >= 0.95) return { t: 'Perfecto', c: 'yellow' };
    if (e >= 0.86) return { t: 'Fino', c: 'white' };
    if (e >= 0.7) return { t: 'Rústico', c: 'cream3' };
    return { t: 'Entrópico', c: 'fawnLight' };
  }

  (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
    id: 'slicer',
    title: 'Slicer',
    tagline: 'Corta en partes iguales. El cuchillo no espera.',
    order: 10,
    controls: [['A', 'Cortar'], ['B', 'Cambiar sentido']],

    preview: function (ctx, w, h, t, api) {
      var Ly = layout(w, h * 1.15);
      var T = Ly.T, L = Ly.L, x0 = Ly.x0, y = h * 0.62;
      drawBoard(ctx, api, Ly.board.x, y - T * 0.66, Ly.board.w, T * 2.2);
      var cyc = t % 4, cuts = [0.33, 0.67].filter(function (c, i) { return cyc > 0.8 + i * 0.9; });
      var spread = cyc > 2.6 ? api.ease.outBack(Math.min(1, (cyc - 2.6) / 0.4)) * T * 0.35 : 0;
      var edges = [0].concat(cuts, [1]);
      for (var i = 0; i < edges.length - 1; i++) {
        var a = x0 + edges[i] * L, b = x0 + edges[i + 1] * L, off = (i - (edges.length - 2) / 2) * spread;
        ctx.save();
        ctx.beginPath(); ctx.rect(a + off - (i === 0 ? T : 0), y - T * 2, b - a + (i === 0 ? T : 0) + (i === edges.length - 2 ? T : 0), T * 4); ctx.clip();
        ctx.translate(off, 0);
        drawBody(ctx, api, 'zanahoria', x0, y, L, T);
        ctx.restore();
      }
      var kx = cyc < 2.6 ? x0 + L * (0.5 + 0.45 * Math.sin(cyc * 3)) : x0 + L * 1.05;
      var chop = (cyc > 0.8 && cyc < 0.95) || (cyc > 1.7 && cyc < 1.85);
      drawKnife(ctx, api, kx, chop ? y + T * 0.5 : y - T * 0.85, T, 0);
    },

    create: function (api) {
      var P = api.P;
      var round = 0, score = 0, perfects = 0, phase = 'enter', phaseT = 0;
      var knife = { p: 0, dir: 1, chop: 0, x: 0 };
      var cuts = [], pieces = null, evalRes = null, missCount = 0, trail = [];
      var R = ROUNDS[0];

      function startRound() {
        R = ROUNDS[round];
        cuts = []; pieces = null; evalRes = null;
        phase = 'enter'; phaseT = 0;
        knife.p = 0; knife.dir = 1; knife.chop = 0;
        api.sfx('whoosh');
      }
      startRound();

      function knifeU() {
        var p = knife.p;
        return R.sine ? api.ease.inOutSine(p) : p;
      }
      function chop() {
        if (phase !== 'play' || knife.chop > 0) return;
        knife.chop = 0.0001;
      }
      function landCut(Ly) {
        var u = -0.06 + knifeU() * 1.12;          // knife range overshoots the ingredient a little
        if (u <= 0.01 || u >= 0.99) {
          missCount++;
          score = Math.max(0, score - 15);
          api.float(knife.x, Ly.y - Ly.T, '¡Tabla! −15', P.fawnLight, 15);
          api.sfx('thud'); api.shake(3, 200);
          return;
        }
        cuts.push(u);
        cuts.sort(function (a, b) { return a - b; });
        api.sfx('cut'); api.shake(2, 140);
        api.burst(knife.x, Ly.y - Ly.T * 0.3, { count: 10, colors: crumbColors(api, R.type), speed: 160, size: Ly.T * 0.14, angle: -Math.PI / 2, spread: 1.2 });
        if (cuts.length >= R.n - 1) { phase = 'settle'; phaseT = 0; }
      }
      function evaluate(Ly) {
        var edges = [0].concat(cuts, [1]), lens = [];
        for (var i = 0; i < edges.length - 1; i++) lens.push(edges[i + 1] - edges[i]);
        var ideal = 1 / R.n, err = 0;
        lens.forEach(function (l) { err += Math.abs(l - ideal); });
        var e = Math.max(0, 1 - err * 2.2);
        var pts = Math.round(e * 100) + (e >= 0.95 ? 50 : 0);
        if (e >= 0.95) perfects++;
        score += pts;
        evalRes = { lens: lens, e: e, pts: pts, r: rating(e) };
        var cx = api.w / 2;
        api.float(cx, Ly.y - Ly.T * 2.6, '+' + pts, e >= 0.95 ? P.yellow : P.white, 22);
        if (e >= 0.95) { api.sfx('win'); api.burst(cx, Ly.y - Ly.T, { count: 26, colors: [P.yellow, P.white, P.fawnLight], speed: 260, size: Ly.T * 0.16 }); }
        else if (e >= 0.7) api.sfx('coin');
        else api.sfx('fail');
      }

      return {
        update: function (dt) {
          var Ly = layout(api.w, api.h);
          phaseT += dt;
          if (phase === 'enter' && phaseT > 0.7) { phase = 'play'; phaseT = 0; }
          if (phase === 'play' || phase === 'enter') {
            knife.p += knife.dir * R.speed * dt * (phase === 'enter' ? 0.5 : 1);
            if (knife.p > 1) { knife.p = 2 - knife.p; knife.dir = -1; }
            if (knife.p < 0) { knife.p = -knife.p; knife.dir = 1; }
          }
          knife.x = Ly.x0 + (-0.06 + knifeU() * 1.12) * Ly.L;
          if (knife.chop > 0) {
            var prev = knife.chop;
            knife.chop += dt;
            if (prev < 0.07 && knife.chop >= 0.07) landCut(Ly);
            if (knife.chop > 0.3) knife.chop = 0;
          }
          if (phase === 'play') {
            trail.push({ x: knife.x, t: 0 });
          }
          trail.forEach(function (p) { p.t += dt; });
          while (trail.length && trail[0].t > 0.12) trail.shift();
          if (phase === 'settle' && phaseT > 0.35) { phase = 'spread'; phaseT = 0; evaluate(Ly); }
          if (phase === 'spread' && phaseT > 1.9) { phase = 'exit'; phaseT = 0; api.sfx('whoosh'); }
          if (phase === 'exit' && phaseT > 0.55) {
            round++;
            if (round >= ROUNDS.length) {
              phase = 'done';
              api.end({
                score: score, label: 'Puntos de corte', title: perfects >= 3 ? '¡Mano de chef!' : 'Servicio terminado',
                lines: ['Cortes perfectos: ' + perfects + ' de ' + ROUNDS.length].concat(missCount ? ['Golpes a la tabla: ' + missCount] : [])
              });
            } else startRound();
          }
        },

        draw: function (ctx, w, h) {
          var Ly = layout(w, h), T = Ly.T, L = Ly.L, i;
          api.hud(ctx, 'RONDA ' + Math.min(round + 1, ROUNDS.length) + '/' + ROUNDS.length, score + ' PTS');

          // order ticket: three rows, nothing overlaps
          //   1 ingredient ........ CORTES 1/3
          //   2 EN N PARTES IGUALES   (auto-fit)
          //   3 segmented progress, one segment per cut
          var tw = Math.min(w * 0.84, 340), pad = Math.max(10, tw * 0.045);
          var s1 = Math.max(10, Math.min(14, h * 0.026)), s2 = Math.max(14, Math.min(24, h * 0.046)), barH = 5;
          var instr = 'EN ' + R.n + ' PARTES IGUALES';
          ctx.font = '700 ' + s2 + 'px ' + api.FONT;
          while (s2 > 11 && ctx.measureText(instr).width > tw - pad * 2) { s2 -= 1; ctx.font = '700 ' + s2 + 'px ' + api.FONT; }
          var th = pad + s1 + 8 + s2 + 10 + barH + pad, tx = (w - tw) / 2, ty = Math.max(34, h * 0.1);
          api.rr(ctx, tx, ty + 4, tw, th, 6); ctx.fillStyle = P.cream3; ctx.fill();
          api.rr(ctx, tx, ty, tw, th, 6); ctx.fillStyle = P.white; ctx.fill();
          var tn = TYPES.filter(function (x) { return x.id === R.type; })[0];
          var y1 = ty + pad + s1 * 0.8;
          api.text(ctx, tn.name.toUpperCase(), tx + pad, y1, { size: s1, color: P.fawn, spacing: 1.5 });
          api.text(ctx, 'CORTES ' + Math.min(cuts.length, R.n - 1) + '/' + (R.n - 1), tx + tw - pad, y1, { size: s1, color: P.cream3, align: 'right', spacing: 1.2 });
          var y2 = y1 + 8 + s2 * 0.85;
          api.text(ctx, instr, tx + pad, y2, { size: s2, color: P.aztec });
          var segs = R.n - 1, gapS = 4, segW = (tw - pad * 2 - gapS * (segs - 1)) / segs, yb = y2 + 10;
          for (i = 0; i < segs; i++) {
            ctx.fillStyle = i < cuts.length ? P.yellow : P.cream2;
            ctx.fillRect(tx + pad + i * (segW + gapS), yb, segW, barH);
          }

          // board
          var slide = 0;
          if (phase === 'enter') slide = (1 - api.ease.outCubic(Math.min(1, phaseT / 0.6))) * -w;
          if (phase === 'exit') slide = api.ease.inCubic(Math.min(1, phaseT / 0.5)) * w;
          drawBoard(ctx, api, Ly.board.x, Ly.board.y, Ly.board.w, Ly.board.h);

          // guide ticks (first round only, or after evaluation)
          if (R.guide || phase === 'spread') {
            for (i = 1; i < R.n; i++) {
              var gx = Ly.x0 + L * i / R.n + slide;
              ctx.fillStyle = phase === 'spread' ? P.yellow : P.aztec3;
              for (var d = 0; d < 5; d++) ctx.fillRect(gx - 1, Ly.y - T * 1.35 + d * T * 0.55, 2, T * 0.3);
            }
          }

          // ingredient (split into pieces at the cuts)
          var edges = [0].concat(cuts, [1]);
          var spread = 0;
          if (phase === 'settle') spread = api.ease.outBack(Math.min(1, phaseT / 0.3)) * T * 0.18;
          if (phase === 'spread' || phase === 'exit') spread = T * 0.18 + api.ease.outBack(Math.min(1, (phase === 'exit' ? 1 : phaseT / 0.45))) * T * 0.5;
          var nP = edges.length - 1;
          for (i = 0; i < nP; i++) {
            var a = Ly.x0 + edges[i] * L, b = Ly.x0 + edges[i + 1] * L;
            var off = (i - (nP - 1) / 2) * spread + slide;
            var hop = 0;
            if (phase === 'spread') hop = -Math.max(0, Math.sin(Math.min(1, (phaseT - i * 0.06) / 0.35) * Math.PI)) * T * 0.35;
            ctx.save();
            ctx.beginPath();
            ctx.rect(a + off - (i === 0 ? T : 0), Ly.y - T * 2 + hop, b - a + (i === 0 ? T : 0) + (i === nP - 1 ? T : 0), T * 4);
            ctx.clip();
            ctx.translate(off, hop);
            drawBody(ctx, api, R.type, Ly.x0, Ly.y, L, T);
            ctx.restore();
            // cut faces
            if (spread > 0.5) {
              ctx.fillStyle = faceColor(api, R.type);
              if (i > 0) ctx.fillRect(a + off, Ly.y - T * 0.42 + hop, Math.max(2, T * 0.1), T * 0.84);
              if (i < nP - 1) ctx.fillRect(b + off - Math.max(2, T * 0.1), Ly.y - T * 0.42 + hop, Math.max(2, T * 0.1), T * 0.84);
            }
            // measurements
            if (evalRes && (phase === 'spread')) {
              var pct = Math.round(evalRes.lens[i] * 100), ideal = Math.round(100 / R.n);
              var ok = Math.abs(pct - ideal) <= 2;
              api.text(ctx, pct + '%', (a + b) / 2 + off, Ly.y + T * 1.35, { size: Math.max(10, T * 0.34), align: 'center', color: ok ? P.yellow : P.cream3 });
            }
          }
          // hairline cut marks during play
          if (phase === 'play' || phase === 'enter') {
            ctx.fillStyle = P.aztec;
            cuts.forEach(function (u) { ctx.fillRect(Ly.x0 + u * L - 1 + slide, Ly.y - T * 0.5, 2, T); });
          }

          // rating stamp
          if (evalRes && phase === 'spread') {
            var k = api.ease.outBack(Math.min(1, phaseT / 0.35));
            ctx.save();
            ctx.translate(w / 2, Ly.y - T * 2.35);
            ctx.scale(k, k);
            var label = evalRes.r.t.toUpperCase(), fs = Math.max(16, T * 0.6);
            ctx.font = '700 ' + fs + 'px ' + api.FONT;
            var lw = ctx.measureText(label).width + fs;
            api.rr(ctx, -lw / 2, -fs * 0.8, lw, fs * 1.5, 6);
            ctx.lineWidth = 3; ctx.strokeStyle = P[evalRes.r.c]; ctx.stroke();
            api.text(ctx, label, 0, 0, { size: fs, align: 'center', baseline: 'middle', color: P[evalRes.r.c] });
            ctx.restore();
          }

          // knife (+ motion trail as flat ticks)
          if (phase === 'play' || phase === 'enter' || phase === 'settle') {
            trail.forEach(function (p) {
              ctx.fillStyle = P.aztec3;
              ctx.fillRect(p.x - 1, Ly.y - T * 2.2, 2, T * 0.5 * (1 - p.t / 0.12));
            });
            var c = knife.chop, tipY;
            if (c > 0) {
              if (c < 0.07) tipY = api.lerp(Ly.y - T * 0.85, Ly.y + T * 0.55, api.ease.inCubic(c / 0.07));
              else if (c < 0.14) tipY = Ly.y + T * 0.55;
              else tipY = api.lerp(Ly.y + T * 0.55, Ly.y - T * 0.85, api.ease.outCubic((c - 0.14) / 0.16));
            } else tipY = Ly.y - T * 0.85 + Math.sin(api.time * 6) * T * 0.05;
            var tilt = 0;   // the knife stays upright (no tilted elements)
            drawKnife(ctx, api, knife.x + slide * 0, tipY, T, tilt);
          }
        },

        input: function (key, type) {
          if (type !== 'down') return;
          if (key === 'a') chop();
          else if (key === 'b' && phase === 'play') { knife.dir *= -1; api.sfx('nav'); }
        },
        destroy: function () {}
      };
    }
  });
})();

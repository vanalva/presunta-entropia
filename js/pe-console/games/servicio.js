/* =============================================================
   SERVICIO — PE-83 console game
   A waiter line snakes through the dining room: pick the dish up
   at the pass, carry it to the numbered table that ordered it.
   Logic lives on a grid; rendering interpolates between cells.
   ============================================================= */
(function () {
  'use strict';

  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
  // [main blob, garnish]
  var FOODS = [['tomato', 'leaf'], ['yellow', 'fawn'], ['leaf', 'tomato'], ['fawn', 'yellowLight'], ['olive', 'yellow'], ['yellowLight', 'leaf']];
  var TAU = Math.PI * 2;

  function angLerp(a, b, k) {
    var d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * k;
  }

  /* ---------- shared drawing ---------- */
  function circle(ctx, x, y, r) { if (!(r > 0)) return; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // flat top-down plate with a food blob
  function drawPlate(ctx, P, x, y, r, food) {
    var d = Math.max(1.5, r * 0.2);
    ctx.fillStyle = P.cream3; circle(ctx, x, y + d, r);
    ctx.fillStyle = P.white; circle(ctx, x, y, r);
    ctx.fillStyle = P.cream2; circle(ctx, x, y, r * 0.64);
    if (!food) return;
    ctx.fillStyle = P[food[0]];
    circle(ctx, x - r * 0.17, y + r * 0.04, r * 0.3);
    circle(ctx, x + r * 0.16, y + r * 0.06, r * 0.26);
    circle(ctx, x - r * 0.02, y - r * 0.16, r * 0.24);
    ctx.fillStyle = P[food[1]];
    ctx.save(); ctx.translate(x + r * 0.12, y - r * 0.14); ctx.rotate(-0.6);
    ctx.fillRect(-r * 0.2, -r * 0.06, r * 0.4, r * 0.12);
    ctx.restore();
  }

  // one waiter segment. kind: 'head' | 0 | 1. fx/fy = scale along forward / sideways
  function waiterShape(ctx, api, x, y, s, ang, fx, fy, col) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(fx, fy);
    ctx.fillStyle = col;
    api.rr(ctx, -s / 2, -s / 2, s, s, s * 0.3); ctx.fill();
    ctx.restore();
  }
  function waiterDetail(ctx, api, x, y, s, ang, fx, fy, kind, look) {
    var P = api.P;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(fx, fy);
    if (kind === 'dazed') {
      // crossed eyes, empty hands
      ctx.fillStyle = P.aztec;
      [-1, 1].forEach(function (k) {
        ctx.save(); ctx.translate(s * 0.2, k * s * 0.17); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.1, -s * 0.03, s * 0.2, s * 0.06); ctx.fillRect(-s * 0.03, -s * 0.1, s * 0.06, s * 0.2);
        ctx.restore();
      });
    } else if (kind === 'head') {
      // eyes (forward = +x); look = -1/1 glances toward a queued turn
      var ly = (look || 0) * s * 0.07;
      ctx.fillStyle = P.aztec;
      circle(ctx, s * 0.2, -s * 0.17 + ly, s * 0.075);
      circle(ctx, s * 0.2, s * 0.17 + ly, s * 0.075);
      // tray held out on the right hand
      ctx.fillStyle = P.walnut; circle(ctx, s * 0.12, s * 0.5 + s * 0.06, s * 0.24);
      ctx.fillStyle = P.cream3; circle(ctx, s * 0.12, s * 0.5, s * 0.24);
      ctx.fillStyle = P.white; circle(ctx, s * 0.12, s * 0.5, s * 0.14);
    } else {
      // bow tie at the front
      var b = s * 0.13, bx = s * 0.26;
      ctx.fillStyle = P.aztec;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx - b * 0.8, -b); ctx.lineTo(bx - b * 0.8, b); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + b * 0.8, -b); ctx.lineTo(bx + b * 0.8, b); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawTable(ctx, api, x, y, c, num, sc, isTarget, pulse) {
    var P = api.P, s = c * 0.74 * sc, d = Math.max(2, c * 0.1) * sc;
    if (sc <= 0.01) return;
    // chairs
    ctx.fillStyle = P.walnutDark;
    api.rr(ctx, x - s * 0.24, y - s / 2 - c * 0.1 * sc, s * 0.48, c * 0.16 * sc, c * 0.05); ctx.fill();
    api.rr(ctx, x - s * 0.24, y + s / 2 + d - c * 0.04 * sc, s * 0.48, c * 0.16 * sc, c * 0.05); ctx.fill();
    // table
    ctx.fillStyle = P.walnutDark; api.rr(ctx, x - s / 2, y - s / 2 + d, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = P.walnut; api.rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.18); ctx.fill();
    api.text(ctx, String(num), x, y + s * 0.03, { size: Math.max(9, Math.round(c * 0.42 * sc)), weight: 700, color: isTarget ? P.yellow : P.white, align: 'center', baseline: 'middle' });
    if (isTarget) {
      // breathing corner brackets
      var g = c * (0.5 + 0.07 * pulse), L = c * 0.2, lw = Math.max(2, c * 0.08);
      ctx.fillStyle = P.yellow;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (k) {
        var cx = x + k[0] * g, cy = y + k[1] * g + d * 0.5;
        ctx.fillRect(k[0] < 0 ? cx : cx - L, k[1] < 0 ? cy : cy - lw, L, lw);
        ctx.fillRect(k[0] < 0 ? cx : cx - lw, k[1] < 0 ? cy : cy - L, lw, L);
      });
    }
  }

  function drawTicket(ctx, api, x, y, c, num, cold, pulse) {
    var P = api.P, w = c * 0.52, h = c * 0.46;
    if (c < 6) return;
    ctx.save(); ctx.translate(x, y); if (pulse) ctx.scale(pulse, pulse); x = 0; y = 0;
    ctx.fillStyle = P.walnutDark; api.rr(ctx, x - w / 2, y - h / 2 + 2, w, h, c * 0.08); ctx.fill();
    ctx.fillStyle = cold ? P.fawn : P.white; api.rr(ctx, x - w / 2, y - h / 2, w, h, c * 0.08); ctx.fill();
    api.text(ctx, String(num), x, y + 1, { size: Math.max(9, Math.round(c * 0.34)), weight: 700, color: cold ? P.white : P.walnut, align: 'center', baseline: 'middle' });
    ctx.restore();
  }

  function floor(ctx, P, ox, oy, cols, rows, c) {
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? P.aztec2 : P.aztec;
        ctx.fillRect(ox + x * c, oy + y * c, c, c);
      }
    }
  }

  /* =============================================================
     PREVIEW — a short line circling a table with a plate
     ============================================================= */
  var RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function ringDir(i) {
    var a = RING[((i % 8) + 8) % 8], b = RING[(((i + 1) % 8) + 8) % 8];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  function preview(ctx, w, h, t, api) {
    var P = api.P;
    var c = Math.floor(Math.min(w / 7, h / 4.6));
    var cx = w / 2, cy = h / 2 + c * 0.35;
    ctx.fillStyle = P.aztec; ctx.fillRect(0, 0, w, h);
    // floor checker aligned to the centre table
    var n = Math.ceil(w / c / 2) + 1, m = Math.ceil(h / c / 2) + 2;
    for (var gy = -m; gy <= m; gy++) {
      for (var gx = -n; gx <= n; gx++) {
        ctx.fillStyle = ((gx + gy) % 2 + 2) % 2 ? P.aztec2 : P.aztec;
        ctx.fillRect(cx + (gx - 0.5) * c, cy + (gy - 0.5) * c, c, c);
      }
    }
    // pass counter along the top
    var cb = cy - 1.5 * c - c * 0.3;
    ctx.fillStyle = P.walnutDark; ctx.fillRect(0, cb - c * 0.2 + 3, w, c * 0.2);
    ctx.fillStyle = P.walnut; ctx.fillRect(0, 0, w, cb);
    var bob = Math.sin(t * 3) * c * 0.04;
    drawPlate(ctx, P, cx + c * 2, cb - c * 0.4 + bob, c * 0.3, FOODS[1]);
    drawTicket(ctx, api, cx + c * 2.6, cb - c * 0.55, c * 0.8, 2, false);
    // side tables
    if (w / c > 6.5) {
      drawTable(ctx, api, cx - 3 * c, cy + 0.5 * c, c, 1, 1, false, 0);
      drawTable(ctx, api, cx + 3 * c, cy, c, 4, 1, false, 0);
    }
    var pulse = (Math.sin(t * 5) + 1) / 2;
    drawTable(ctx, api, cx, cy, c, 3, 1, true, pulse);

    // the line: 4 waiters on the 8-cell ring
    var pos = t * 3.1, segs = 4, s = c * 0.78, d = Math.max(2, c * 0.12);
    var pts = [];
    for (var i = 0; i < segs; i++) {
      var p = pos - i, k = Math.floor(p), f = p - k;
      var a = RING[((k % 8) + 8) % 8], b = RING[(((k + 1) % 8) + 8) % 8];
      var ang = ringDir(k);
      var turnK = f < 0.22 ? api.ease.outCubic(f / 0.22) : 1;
      ang = angLerp(ringDir(k - 1), ang, turnK);
      var bobS = 1 + 0.04 * Math.sin(t * 14 - i * 0.9);
      var turning = ringDir(k - 1) !== ringDir(k) && f < 0.3 ? (1 - f / 0.3) : 0;
      pts.push({ x: cx + (a[0] + (b[0] - a[0]) * f) * c, y: cy + (a[1] + (b[1] - a[1]) * f) * c, ang: ang,
        fx: (1 - 0.16 * turning) * bobS, fy: (1 + 0.14 * turning) * bobS, head: i === 0, alt: i % 2 });
    }
    for (var j = pts.length - 1; j >= 0; j--) {
      var q = pts[j], sz = q.head ? c * 0.86 : s;
      waiterShape(ctx, api, q.x, q.y + d, sz, q.ang, q.fx, q.fy, q.head ? P.yellowDark : P.walnut);
    }
    for (j = pts.length - 1; j >= 0; j--) {
      q = pts[j]; sz = q.head ? c * 0.86 : s;
      waiterShape(ctx, api, q.x, q.y, sz, q.ang, q.fx, q.fy, q.head ? P.yellow : (q.alt ? P.cream3 : P.white));
      waiterDetail(ctx, api, q.x, q.y, sz, q.ang, q.fx, q.fy, q.head ? 'head' : 0);
    }
    var hd = pts[0];
    drawPlate(ctx, P, hd.x, hd.y - c * 0.12 + Math.sin(t * 14) * c * 0.03, c * 0.3, FOODS[0]);
  }

  /* =============================================================
     GAME
     ============================================================= */
  function create(api) {
    var P = api.P;
    var cols = 11;
    var w0 = api.w || 420, h0 = api.h || 500;
    var rows = api.clamp(Math.round(cols * (h0 - 54) / Math.max(1, w0 - 20) - 0.5), 9, 15);
    var L = {};
    function layout(w, h) {
      var top = 42;
      var c = Math.floor(Math.min((w - 20) / cols, (h - top - 10) / (rows + 0.6)));
      c = Math.max(8, c);
      var counter = Math.round(c * 0.6);
      var gw = c * cols, gh = c * rows;
      L = { c: c, gw: gw, gh: gh, counter: counter, w: w, h: h,
        ox: Math.round((w - gw) / 2),
        oy: Math.round(top + counter + Math.max(0, (h - top - 10 - counter - gh) / 2)) };
    }
    layout(w0, h0);
    function px(x) { return L.ox + (x + 0.5) * L.c; }
    function py(y) { return L.oy + (y + 0.5) * L.c; }

    var t = 0, acc = 0, frac = 0, score = 0, served = 0, grow = 0;
    var sx = Math.floor(cols / 2), sy = rows - 3;
    var body = [];
    for (var i = 0; i < 3; i++) body.push({ x: sx, y: sy + i, px: sx, py: sy + i, born: 1 });
    var dir = 'up', queue = [], headAng = ANG.up, squash = 0, hurry = false;
    var tables = [], pending = [], later = [];
    var order = null, nextOrderIn = 0.9, lastTarget = 0, carryPop = 0;
    var dead = false, crashT = 0, crashKind = '', crashTable = null, ended = false, bumpDir = null;
    var fly = null, shards = [];

    function stepDur() { return Math.max(0.1, 0.19 * Math.pow(0.965, served)); }
    function onSnake(x, y) { for (var k = 0; k < body.length; k++) if (body[k].x === x && body[k].y === y) return true; return false; }
    function tableAt(x, y) {
      for (var k = 0; k < tables.length; k++) { var tb = tables[k]; if (tb.state === 'in' && tb.x === x && tb.y === y) return tb; }
      return null;
    }
    function placeTable(num, initial) {
      var h = body[0], d = DIRS[dir], tries = 0;
      while (tries++ < 400) {
        var x = api.randi(1, cols - 2), y = api.randi(2, rows - 2);
        if (initial && Math.abs(x - sx) < 2) continue;
        if (onSnake(x, y)) continue;
        if (Math.abs(x - h.x) + Math.abs(y - h.y) < 3) continue;
        var ahead = false;
        for (var k = 1; k <= 4; k++) if (h.x + d[0] * k === x && h.y + d[1] * k === y) ahead = true;
        if (ahead) continue;
        var near = false;
        tables.forEach(function (o) { if (o.state !== 'gone' && Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) < 2) near = true; });
        if (near) continue;
        tables.push({ x: x, y: y, num: num, state: 'in', t: 0, hit: 0 });
        return true;
      }
      return false;
    }
    for (i = 1; i <= 4; i++) placeTable(i, true);

    function spawnOrder() {
      var avail = tables.filter(function (tb) { return tb.state === 'in' && tb.num !== lastTarget; });
      if (!avail.length) avail = tables.filter(function (tb) { return tb.state === 'in'; });
      if (!avail.length) { nextOrderIn = 0.3; return; }
      var tb = api.pick(avail), xs = [];
      for (var x = 0; x < cols; x++) if (!onSnake(x, 0) && Math.abs(x - body[0].x) + body[0].y > 1) xs.push(x);
      if (!xs.length) { nextOrderIn = 0.3; return; }
      var ox = api.pick(xs), h = body[0];
      var est = Math.abs(h.x - ox) + h.y + Math.abs(ox - tb.x) + tb.y + 5;
      var max = est * stepDur() * 1.45 + 2.2;
      order = { x: ox, food: api.pick(FOODS), target: tb.num, clock: max, max: max, state: 'pass', t: 0, cold: false };
      lastTarget = tb.num;
      api.beep(1568, 0.07, 'sine', 0.07);
      later.push({ t: 0.09, fn: function () { api.beep(2093, 0.12, 'sine', 0.06); } });
    }

    function crash(kind, tb) {
      dead = true; crashT = 0; crashKind = kind; crashTable = tb || null; bumpDir = DIRS[dir];
      frac = 1;
      body.forEach(function (s) { s.px = s.x; s.py = s.y; });
      if (tb) tb.hit = 1;
      squash = 1;
      api.shake(7, 280);
      api.sfx('thud');
      api.noise(0.2, { filter: 'lowpass', freq: 700, vol: 0.25 });
      var h = body[0], c = L.c;
      var side = Math.random() < 0.5 ? -1 : 1;
      // ground velocity: sideways to the impact, a little back
      var gvx = (bumpDir[1] !== 0 ? side * 2.4 : -bumpDir[0] * 1.2) * c;
      var gvy = (bumpDir[0] !== 0 ? side * 1.6 : -bumpDir[1] * 1.2) * c;
      var carrying = order && order.state === 'carry';
      fly = { x: px(h.x), y: py(h.y) - c * 0.12, vx: gvx, vy: gvy, z: 0, vz: c * 7, g: c * 34, rot: 0, vr: side * 9,
        plate: carrying, food: carrying ? order.food : null, bounces: 0, done: false };
      if (carrying) order = null;
    }

    function breakPlate(x, y) {
      var c = L.c;
      for (var k = 0; k < 8; k++) {
        var a = k / 8 * TAU + api.rand(-0.3, 0.3), sp = api.rand(2.5, 5) * c;
        shards.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, rot: api.rand(0, TAU), vr: api.rand(-12, 12),
          s: api.rand(0.12, 0.22) * c, col: k % 3 === 0 ? P.cream3 : P.white, shape: k % 2 });
      }
      api.burst(x, y, { count: 12, colors: [P[fly.food[0]], P[fly.food[1]]], speed: c * 5, gravity: c * 18, size: Math.max(3, c * 0.16), life: 0.8, angle: -Math.PI / 2, spread: 1.3, shape: 'dot' });
      api.noise(0.35, { filter: 'highpass', freq: 2600, vol: 0.22 });
      api.beep(1760, 0.05, 'triangle', 0.06);
      later.push({ t: 0.06, fn: function () { api.beep(1320, 0.05, 'triangle', 0.05); } });
    }

    function deliver(tb, dur) {
      var clockFrac = order.clock / order.max, cold = order.clock <= 0;
      var pts = cold ? 5 : 10 + Math.round(20 * clockFrac);
      var food = order.food;
      score += pts; served++; grow++;
      tb.state = 'serving';
      order = null; nextOrderIn = 0.75 + dur;
      var num = tb.num;
      later.push({ t: dur * 0.85, fn: function () {
        tb.state = 'out'; tb.t = 0;
        var x = px(tb.x), y = py(tb.y), c = L.c;
        squash = 1;
        api.sfx('coin');
        api.burst(x, y, { count: 16, colors: [P.yellow, P.white, P[food[0]]], speed: c * 6, gravity: c * 14, size: Math.max(3, c * 0.18), life: 0.9 });
        api.float(x, y - c * 0.6, cold ? 'FRÍO +' + pts : '+' + pts, cold ? P.cream3 : P.yellow, Math.max(14, Math.round(c * 0.7)));
      } });
      pending.push({ num: num, t: 0.9 + dur });
      if ((served === 4 || served === 10) && tables.length < 6) {
        var nn = served === 4 ? 5 : 6;
        if (!tables.some(function (o) { return o.num === nn; })) pending.push({ num: nn, t: 1.4 + dur, fresh: true });
      }
    }

    function pickup(dur) {
      order.state = 'carry';
      carryPop = -dur * 0.7; // becomes visible once the head reaches the pass
      later.push({ t: dur * 0.7, fn: function () { api.sfx('pop'); squash = 1; } });
    }

    function step(dur) {
      if (queue.length) {
        var nd = queue.shift();
        if (nd !== dir) { dir = nd; squash = 1; api.beep(520, 0.025, 'square', 0.025); }
      }
      var d = DIRS[dir], h = body[0], nx = h.x + d[0], ny = h.y + d[1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return crash('wall');
      var tb = tableAt(nx, ny), delivering = false;
      if (tb) {
        if (order && order.state === 'carry' && tb.num === order.target) delivering = true;
        else return crash('table', tb);
      }
      var lim = grow > 0 ? body.length : body.length - 1;
      for (var k = 0; k < lim; k++) if (body[k].x === nx && body[k].y === ny) return crash('self');
      for (k = body.length - 1; k > 0; k--) {
        body[k].px = body[k].x; body[k].py = body[k].y;
        body[k].x = body[k - 1].x; body[k].y = body[k - 1].y;
      }
      h.px = h.x; h.py = h.y; h.x = nx; h.y = ny;
      if (grow > 0) {
        grow--;
        var tl = body[body.length - 1];
        body.push({ x: tl.px, y: tl.py, px: tl.px, py: tl.py, born: 0 });
      }
      if (hurry) api.burst(px(h.px), py(h.py), { count: 3, colors: [P.aztec3, P.cream3], speed: L.c * 1.6, gravity: 0, size: Math.max(2, L.c * 0.14), life: 0.4, shape: 'dot' });
      if (delivering) deliver(tb, dur);
      else if (order && order.state === 'pass' && nx === order.x && ny === 0) pickup(dur);
    }

    function glance() {
      if (!queue.length) return 0;
      var a = ANG[queue[0]] - ANG[dir];
      while (a > Math.PI) a -= TAU;
      while (a < -Math.PI) a += TAU;
      return a > 0.1 ? 1 : a < -0.1 ? -1 : 0;
    }
    // low clock: the ticket throbs (straight, no tilt)
    function urgentPulse() {
      if (!order || order.cold || order.clock / order.max >= 0.3) return 1;
      return 1 + 0.12 * Math.abs(Math.sin(t * 9));
    }
    function endGame() {
      ended = true;
      var why = crashKind === 'wall' ? 'Contra la pared.' : crashKind === 'table' ? 'Contra la mesa ' + (crashTable ? crashTable.num : '') + '.' : 'Te has chocado con tu propia fila.';
      api.end({ score: score, label: 'Puntos', title: 'Servicio cerrado', lines: [served + (served === 1 ? ' plato servido' : ' platos servidos'), why], fail: true, delay: 350 });
    }

    return {
      update: function (dt) {
        t += dt;
        squash = Math.max(0, squash - dt / 0.16);
        tables.forEach(function (tb) { tb.t += dt; tb.hit = Math.max(0, tb.hit - dt * 2.2); });
        tables = tables.filter(function (tb) { return !(tb.state === 'out' && tb.t > 0.35); });
        body.forEach(function (s) { if (s.born < 1) s.born = Math.min(1, s.born + dt * 5); });
        for (var k = later.length - 1; k >= 0; k--) { later[k].t -= dt; if (later[k].t <= 0) { var fn = later[k].fn; later.splice(k, 1); fn(); } }
        if (order) order.t += dt;
        carryPop += dt;
        // shards + flying plate run during the crash too
        if (fly && !fly.done) {
          fly.x += fly.vx * dt; fly.y += fly.vy * dt; fly.rot += fly.vr * dt;
          fly.x = api.clamp(fly.x, L.ox + L.c * 0.3, L.ox + L.gw - L.c * 0.3);
          fly.y = api.clamp(fly.y, L.oy + L.c * 0.3, L.oy + L.gh - L.c * 0.3);
          fly.vz -= fly.g * dt; fly.z += fly.vz * dt;
          if (fly.z <= 0 && fly.vz < 0) {
            fly.z = 0;
            if (fly.plate) { breakPlate(fly.x, fly.y); fly.done = true; }
            else if (fly.bounces < 2) { fly.bounces++; fly.vz = -fly.vz * 0.38; fly.vx *= 0.5; fly.vy *= 0.5; fly.vr *= 0.5; api.beep(880 - fly.bounces * 180, 0.05, 'square', 0.04); }
            else { fly.vx = fly.vy = fly.vr = fly.vz = 0; fly.rest = true; }
          }
        }
        shards.forEach(function (s) {
          var f = Math.exp(-5 * dt);
          s.vx *= f; s.vy *= f; s.vr *= f;
          s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
          if (Math.abs(s.vr) < 2) { var sn = Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2); s.rot += (sn - s.rot) * Math.min(1, dt * 8); }
          if (s.x < L.ox + 4 || s.x > L.ox + L.gw - 4) { s.vx = -s.vx * 0.5; s.x = api.clamp(s.x, L.ox + 4, L.ox + L.gw - 4); }
          if (s.y < L.oy + 4 || s.y > L.oy + L.gh - 4) { s.vy = -s.vy * 0.5; s.y = api.clamp(s.y, L.oy + 4, L.oy + L.gh - 4); }
        });
        if (dead) {
          crashT += dt;
          if (crashT > 0.9 && !ended) endGame();
          return;
        }
        for (k = pending.length - 1; k >= 0; k--) {
          pending[k].t -= dt;
          if (pending[k].t <= 0) {
            if (placeTable(pending[k].num, false)) {
              var nt = tables[tables.length - 1];
              api.beep(660, 0.06, 'triangle', 0.05);
              if (pending[k].fresh) api.float(px(nt.x), py(nt.y) - L.c * 0.7, 'MESA ' + nt.num, P.white, Math.max(12, Math.round(L.c * 0.5)));
              pending.splice(k, 1);
            } else pending[k].t = 0.3;
          }
        }
        if (!order && nextOrderIn > 0) { nextOrderIn -= dt; if (nextOrderIn <= 0) spawnOrder(); }
        if (order && !order.cold) {
          var before = order.clock;
          order.clock -= dt;
          if (order.clock / order.max < 0.3 && Math.floor(before * 2) !== Math.floor(order.clock * 2)) api.beep(order.state === 'carry' ? 988 : 784, 0.03, 'square', 0.03);
          if (order.clock <= 0) { order.clock = 0; order.cold = true; api.beep(196, 0.14, 'triangle', 0.06); }
        }
        hurry = api.isDown('a') || api.isDown('b');
        var dur = stepDur() / (hurry ? 1.6 : 1);
        acc += dt;
        while (acc >= dur && !dead) { acc -= dur; step(dur); }
        if (!dead) frac = api.clamp(acc / dur, 0, 1);
        headAng = angLerp(headAng, ANG[dir], Math.min(1, dt * 20));
      },

      draw: function (ctx, w, h) {
        layout(w, h);
        var c = L.c, T = t;
        // room
        floor(ctx, P, L.ox, L.oy, cols, rows, c);
        ctx.fillStyle = P.aztec3;
        ctx.fillRect(L.ox - 3, L.oy, 3, L.gh + 3);
        ctx.fillRect(L.ox + L.gw, L.oy, 3, L.gh + 3);
        ctx.fillRect(L.ox - 3, L.oy + L.gh, L.gw + 6, 3);
        // the pass
        var cy0 = L.oy - L.counter;
        ctx.fillStyle = P.walnutDark; ctx.fillRect(L.ox - 3, cy0 + 3, L.gw + 6, L.counter);
        ctx.fillStyle = P.walnut; ctx.fillRect(L.ox - 3, cy0, L.gw + 6, L.counter - 1);
        api.text(ctx, 'PASE', L.ox + 6, cy0 + L.counter / 2, { size: Math.max(9, Math.round(L.counter * 0.45)), weight: 700, color: P.cream3, baseline: 'middle', spacing: 2 });
        for (var k = 0; k < cols; k++) {
          if (k % 3 !== 1) continue;
          ctx.fillStyle = P.walnutDark; ctx.fillRect(L.ox + (k + 0.5) * c - c * 0.18, cy0 + L.counter * 0.72, c * 0.36, Math.max(2, L.counter * 0.12));
        }

        // tables
        var pulse = (Math.sin(T * 5) + 1) / 2;
        tables.forEach(function (tb) {
          var sc = 1;
          if (tb.state === 'in' && tb.t < 0.35) sc = api.ease.outBack(tb.t / 0.35);
          if (tb.state === 'out') sc = tb.t < 0.08 ? 1 + 0.14 * tb.t / 0.08 : 1.14 * (1 - api.ease.inCubic(Math.min(1, (tb.t - 0.08) / 0.27)));
          var isT = order && order.target === tb.num && tb.state !== 'out';
          var wob = tb.hit > 0 ? Math.sin(T * 60) * tb.hit * c * 0.08 : 0;
          drawTable(ctx, api, px(tb.x) + wob, py(tb.y), c, tb.num, sc, !!isT, order && order.state === 'carry' ? pulse : pulse * 0.4);
        });

        // dish waiting on the pass
        if (order && order.state === 'pass') {
          var ps = order.t < 0.3 ? api.ease.outBack(order.t / 0.3) : 1;
          var dx = px(order.x), dy = L.oy - L.counter * 0.35 + Math.sin(T * 4) * c * 0.03;
          drawPlate(ctx, P, dx, dy, c * 0.34 * ps, order.food);
          var tside = order.x >= cols - 1 ? -1 : 1;
          if (ps > 0.5) drawTicket(ctx, api, dx + tside * c * 0.55, dy - c * 0.28, c * ps, order.target, order.cold, urgentPulse());
        }

        // the line
        var pts = [], n = body.length, s = c * 0.78, dep = Math.max(2, c * 0.12);
        for (var i = 0; i < n; i++) {
          var sg = body[i];
          var x = px(sg.px + (sg.x - sg.px) * frac), y = py(sg.py + (sg.y - sg.py) * frac);
          var ang = i === 0 ? headAng : Math.atan2(sg.y - sg.py, sg.x - sg.px);
          if (i > 0 && sg.x === sg.px && sg.y === sg.py) ang = pts[i - 1] ? pts[i - 1].ang : 0;
          var bob = 1 + 0.045 * Math.sin(T * 15 - i * 0.9);
          var born = sg.born < 1 ? Math.max(0.01, api.ease.outBack(sg.born)) : 1;
          var fx = bob * born, fy = bob * born;
          if (i === 0) {
            fx *= 1 - 0.2 * squash; fy *= 1 + 0.18 * squash;
            if (dead && bumpDir) {
              var bk = Math.sin(Math.min(1, crashT / 0.16) * Math.PI) * c * 0.26;
              x += bumpDir[0] * bk; y += bumpDir[1] * bk;
            }
          }
          pts.push({ x: x, y: y, ang: ang, fx: fx, fy: fy, head: i === 0, alt: i % 2 });
        }
        for (i = n - 1; i >= 0; i--) {
          var q = pts[i], sz = q.head ? c * 0.86 : s;
          waiterShape(ctx, api, q.x, q.y + dep, sz, q.ang, q.fx, q.fy, q.head ? P.yellowDark : P.walnut);
        }
        for (i = n - 1; i >= 0; i--) {
          q = pts[i]; sz = q.head ? c * 0.86 : s;
          waiterShape(ctx, api, q.x, q.y, sz, q.ang, q.fx, q.fy, q.head ? P.yellow : (q.alt ? P.cream3 : P.white));
          waiterDetail(ctx, api, q.x, q.y, sz, q.ang, q.fx, q.fy, q.head ? (dead ? 'dazed' : 'head') : 0, q.head ? glance() : 0);
        }
        var hd = pts[0];
        if (order && order.state === 'carry') {
          if (carryPop < 0) {
            // plate still sitting on the pass until the head gets there
            drawPlate(ctx, P, px(order.x), L.oy - L.counter * 0.35, c * 0.34, order.food);
          } else {
            var pop = carryPop < 0.25 ? api.ease.outBack(carryPop / 0.25) : 1;
            var hop = carryPop < 0.25 ? Math.sin(carryPop / 0.25 * Math.PI) * c * 0.35 : 0;
            drawPlate(ctx, P, hd.x, hd.y - c * 0.12 - hop + Math.sin(T * 15) * c * 0.025, c * 0.32 * pop, order.food);
            if (pop > 0.4) drawTicket(ctx, api, hd.x + c * 0.5, Math.max(L.oy - L.counter + c * 0.32, hd.y - c * 0.7), c * 1.15 * pop, order.target, order.cold, urgentPulse());
          }
        }

        // crash debris
        shards.forEach(function (sh) {
          ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.rot);
          ctx.fillStyle = sh.col;
          ctx.beginPath();
          if (sh.shape) { ctx.moveTo(-sh.s, -sh.s * 0.6); ctx.lineTo(sh.s, -sh.s * 0.2); ctx.lineTo(-sh.s * 0.2, sh.s * 0.8); }
          else { ctx.moveTo(0, -sh.s); ctx.lineTo(sh.s * 0.9, sh.s * 0.5); ctx.lineTo(-sh.s * 0.7, sh.s * 0.6); }
          ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        if (fly && !fly.done) {
          var shs = Math.max(0.3, 1 - fly.z / (c * 2));
          ctx.fillStyle = P.aztec3;
          ctx.beginPath(); ctx.ellipse(fly.x, fly.y + c * 0.1, c * 0.3 * shs, c * 0.14 * shs, 0, 0, TAU); ctx.fill();
          ctx.save(); ctx.translate(fly.x, fly.y - fly.z); ctx.rotate(fly.rot);
          if (fly.plate) drawPlate(ctx, P, 0, 0, c * 0.34, fly.food);
          else { ctx.fillStyle = P.walnut; circle(ctx, 0, c * 0.05, c * 0.24); ctx.fillStyle = P.cream3; circle(ctx, 0, 0, c * 0.24); ctx.fillStyle = P.white; circle(ctx, 0, 0, c * 0.14); }
          ctx.restore();
        }

        // HUD + order clock
        api.hud(ctx, 'PLATOS ' + served, score + ' PTS');
        var mid = order && !dead ? (order.state === 'pass' ? 'AL PASE' : 'MESA ' + order.target) : '';
        if (mid) api.text(ctx, mid, w / 2, 24, { size: 12, weight: 700, color: order.cold ? P.fawnLight : P.white, align: 'center', spacing: 1.5 });
        var bx = L.ox, bw = L.gw, by = 32, bh = 4;
        ctx.fillStyle = P.aztec3; api.rr(ctx, bx, by, bw, bh, 2); ctx.fill();
        if (order && !dead) {
          var fr = order.clock / order.max;
          if (fr > 0) { ctx.fillStyle = fr < 0.3 ? P.fawn : P.yellow; api.rr(ctx, bx, by, Math.max(bh, bw * fr), bh, 2); ctx.fill(); }
        }
        if (hurry && !dead) api.text(ctx, 'PRISA', L.ox + L.gw - 4, cy0 + L.counter / 2, { size: Math.max(9, Math.round(L.counter * 0.45)), weight: 700, color: P.yellow, align: 'right', baseline: 'middle', spacing: 2 });
      },

      input: function (key, type) {
        if (type !== 'down' || dead || !DIRS[key]) return;
        var last = queue.length ? queue[queue.length - 1] : dir;
        if (key === last || key === OPP[last]) return;
        if (queue.length < 2) queue.push(key);
      },

      destroy: function () { later = []; pending = []; shards = []; fly = null; ended = true; }
    };
  }

  (window.PE_CONSOLE_GAMES = window.PE_CONSOLE_GAMES || []).push({
    id: 'servicio',
    title: 'Servicio',
    tagline: 'Del pase a la mesa sin tirar nada.',
    order: 20,
    controls: [['▲▼◀▶', 'Mover'], ['A', 'Prisa']],
    preview: preview,
    create: create
  });
})();

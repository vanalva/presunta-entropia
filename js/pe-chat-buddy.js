/* =============================================================
   CHAT BUDDY — the round chat button next to the cart (replaces the
   ¿Hablamos? pill). The console's pixel chef lives inside; now and then
   a speech bubble pops above it; on hover it widens into a pill that
   reads "Chat en vivo".
   Lives in the fixed cart/MENU cluster and opens the site chat (Vanny)
   via data-vanny-toggle, like the old pill did. Not in the hero dock:
   up there the console's own assistant and CHAT app cover it.
   ============================================================= */
(function () {
  'use strict';
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
  var C = { h: '#e8d5c4', y: '#efa02e', b: '#efa02e', face: '#0d161d', cheek: '#ad5840' };
  var LINES = [
    '¿En qué puedo ayudarte?',
    'Hola, ¿cómo estás?',
    'Estoy aquí para lo que necesites.',
    '¿Buscas un taller?',
    'Pregúntame por las próximas fechas.',
    '¿Cocinamos algo juntos?'
  ];

  function make(opts) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat-buddy';
    b.setAttribute('aria-label', 'Chat en vivo');
    if (opts.vanny) b.setAttribute('data-vanny-toggle', '');
    b.innerHTML = '<canvas class="chat-buddy_face" aria-hidden="true"></canvas><span class="chat-buddy_label">Chat en vivo</span>' +
      (opts.bubbles ? '<span class="chat-buddy_bubble" aria-live="polite"></span>' : '');
    return b;
  }

  function Face(btn) {
    var cv = btn.querySelector('canvas'), ctx = cv.getContext('2d');
    var t = 0, blink = 0, blinkT = 2, hover = false, jump = -1;
    btn.addEventListener('mouseenter', function () { hover = true; jump = 0; });
    btn.addEventListener('mouseleave', function () { hover = false; });
    btn.addEventListener('focus', function () { hover = true; });
    btn.addEventListener('blur', function () { hover = false; });
    this.draw = function (dt) {
      t += dt;
      blinkT -= dt; if (blink > 0) blink -= dt;
      if (blinkT <= 0) { blink = 0.12; blinkT = 2.4 + Math.random() * 2.6; }
      if (jump >= 0) { jump += dt; if (jump > 0.4) jump = -1; }
      var dpr = Math.min(window.devicePixelRatio || 1, 2), S = 48;
      if (cv.width !== S * dpr) { cv.width = S * dpr; cv.height = S * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      var u = 2, ox = (S - 12 * u) / 2;
      var bob = jump >= 0 ? -Math.round(Math.sin(jump / 0.4 * Math.PI) * 3) : Math.round(Math.sin(t * 3) * 0.5 + 0.5);
      var oy = (S - 12 * u) / 2 + bob * u * 0.5;
      for (var r = 0; r < SPRITE.length; r++) for (var c = 0; c < 12; c++) {
        var ch = SPRITE[r][c]; if (ch === '.') continue;
        ctx.fillStyle = C[ch]; ctx.fillRect(ox + c * u, oy + r * u, u, u);
      }
      ctx.fillStyle = C.face;
      if (blink > 0) { ctx.fillRect(ox + 3 * u, oy + 8 * u, 2 * u, u); ctx.fillRect(ox + 7 * u, oy + 8 * u, 2 * u, u); }
      else if (hover) { ctx.fillRect(ox + 3 * u, oy + 7 * u, 2 * u, u); ctx.fillRect(ox + 7 * u, oy + 7 * u, 2 * u, u); }
      else { ctx.fillRect(ox + 3 * u, oy + 7 * u, u, 2 * u); ctx.fillRect(ox + 8 * u, oy + 7 * u, u, 2 * u); }
      if (hover) {
        ctx.fillStyle = C.cheek; ctx.fillRect(ox + 2 * u, oy + 9 * u, u, u); ctx.fillRect(ox + 9 * u, oy + 9 * u, u, u);
        ctx.fillStyle = C.face; ctx.fillRect(ox + 4 * u, oy + 9 * u, u, u); ctx.fillRect(ox + 7 * u, oy + 9 * u, u, u); ctx.fillRect(ox + 5 * u, oy + 10 * u, 2 * u, u);
      } else ctx.fillRect(ox + 5 * u, oy + 10 * u, 2 * u, u);
    };
    this.jump = function () { jump = 0; };
  }

  function Bubbles(btn, face) {
    var el = btn.querySelector('.chat-buddy_bubble');
    if (!el) return { tick: function () {} };
    var wait = 4 + Math.random() * 3, show = 0, last = -1;
    function visible() {
      var r = btn.getBoundingClientRect();
      return r.width > 0 && getComputedStyle(btn.parentNode).visibility !== 'hidden';
    }
    return {
      tick: function (dt) {
        if (show > 0) {
          show -= dt;
          if (show <= 0) { el.classList.remove('is-on'); wait = 14 + Math.random() * 10; }
          return;
        }
        wait -= dt;
        if (wait > 0) return;
        if (!visible() || btn.matches(':hover')) { wait = 3; return; }
        var i; do { i = Math.floor(Math.random() * LINES.length); } while (i === last && LINES.length > 1);
        last = i;
        el.textContent = LINES[i];
        el.classList.add('is-on');
        face.jump();
        show = 4.5;
      }
    };
  }

  /* ---------- Vanny open/closed state ----------
     The widget's iframe (#vanny-widget-frame) stays click-through while the
     chat is closed (CSS); this file owns html.vanny-open. */
  var OPEN = 'vanny-open';
  var root = document.documentElement;
  var guardUntil = 0;
  function isOpen() { return root.classList.contains(OPEN); }
  function updateLift() {
    // lift the open frame above the fixed buttons so the robot can close it
    var top = Infinity;
    ['.navbar_menu-button', '.cart-header_button', 'button.chat-buddy'].forEach(function (s) {
      var e = document.querySelector(s); if (!e) return;
      var r = e.getBoundingClientRect(); if (r.height > 0 && r.top < top) top = r.top;
    });
    if (top === Infinity || top <= 0) { root.style.removeProperty('--pe-vanny-lift'); return; }
    root.style.setProperty('--pe-vanny-lift', Math.max(0, Math.round(window.innerHeight - top + 14)) + 'px');
  }
  function setOpen(v) {
    v = !!v;
    if (v) updateLift();
    if (v !== isOpen()) root.classList.toggle(OPEN, v);
  }
  function wrapVanny() {
    var V = window.Vanny;
    if (!V || typeof V !== 'object' && typeof V !== 'function') return;
    ['open', 'close', 'toggle'].forEach(function (name) {
      var orig = V[name];
      if (typeof orig !== 'function' || orig.__peWrapped) return;
      var w = function () {
        var res = orig.apply(this, arguments);
        if (Date.now() > guardUntil) {
          if (name === 'open') setOpen(true);
          else if (name === 'close') setOpen(false);
          else setOpen(!isOpen());
        }
        return res;
      };
      w.__peWrapped = true;
      try { V[name] = w; } catch (e) {}
    });
  }
  function closeChat() {
    var V = window.Vanny;
    if (V && typeof V.close === 'function') { try { V.close(); } catch (e) {} }
    setOpen(false);
  }
  function watchFrame() {
    var seen = [];
    function check(f) {
      var w = parseFloat(f.style.width), h = parseFloat(f.style.height);
      if ((w > 0 && w < 200) || (h > 0 && h < 200)) setOpen(false);  // widget collapsed itself
    }
    function scan() {
      var list = document.querySelectorAll('body > iframe#vanny-widget-frame');
      for (var i = 0; i < list.length; i++) {
        var f = list[i];
        if (seen.indexOf(f) !== -1) continue;
        seen.push(f);
        new MutationObserver(function (m) { check(m[0].target); }).observe(f, { attributes: true, attributeFilter: ['style'] });
        check(f);
      }
    }
    scan();
    // the frame is injected after load: watch <body> children until it shows up
    new MutationObserver(scan).observe(document.body || root, { childList: true });
  }
  function initVanny() {
    wrapVanny();
    // the script is async and the console's CHAT swaps window.Vanny methods: re-check lazily
    var n = 0, t = setInterval(function () { wrapVanny(); if (++n > 20) clearInterval(t); }, 500);
    window.addEventListener('load', wrapVanny);
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-vanny-toggle]');
      if (!t) return;
      wrapVanny();
      guardUntil = Date.now() + 60;   // the widget may call its own toggle(); do not flip twice
      setOpen(!isOpen());
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closeChat();
    });
    window.addEventListener('resize', function () { if (isOpen()) updateLift(); });
    watchFrame();
  }

  function init() {
    initVanny();
    var inst = [];
    // fixed cluster: left of the cart, opens the site chat
    var cluster = document.querySelector('.navbar_fixed-button-container');
    if (cluster) {
      var b1 = make({ vanny: true, bubbles: true });
      b1.classList.add('is-fixed');
      cluster.appendChild(b1);
      inst.push(b1);
    }
    // the old ¿Hablamos? pill steps aside for good
    document.documentElement.classList.add('has-chat-buddy');

    var parts = inst.map(function (b) { var f = new Face(b); return { f: f, bub: Bubbles(b, f) }; });
    var last = 0;
    (function loop(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      parts.forEach(function (p) { p.f.draw(dt); p.bub.tick(dt); });
      requestAnimationFrame(loop);
    })(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

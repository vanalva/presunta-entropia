/* =============================================================
   TALLERES BENTO HEADER — talleres.html
   (option L of hero-options, 7 Oct 2026; rotation 8 Oct 2026).
   [data-pe-bento-next]  the next workshop. Fixed, yellow (is-feature).
   [data-pe-bento-list]  three boxes that rotate through the rest of the
                         workshops (window.PE_CMS.talleres): dated ones
                         first, then the ones waiting for dates. A box
                         rolls like the buttons' hover (pe-motion.css
                         .pe-rise): the old link slides up and out, the
                         new one rises in. The frame (li) never moves.
   [data-pe-bento-photo] crossfades through the site's photography.
   Rotation pauses while the pointer or focus is on the rotating boxes, while
   the header is off screen or the tab hidden, and never runs under
   prefers-reduced-motion. Seat numbers carry
   [data-item-seats-left][data-item-id] so webflow-cart.js keeps them
   live. Dated boxes open the booking modal (#modal-1) narrowed to that
   workshop; undated ones link to its page. Links are replaced, never
   re-targeted: some modal wiring binds per element at load.
   ============================================================= */
(function () {
  'use strict';

  var TZ = 'Europe/Madrid';
  var METER_MAX = 16;
  var STEP_MS = 3200;          // one box changes every STEP_MS (each box every 3 steps)
  var PHOTO_MS = 6400;
  var ROLL_MS = 650;
  var IMG = 'assets/images/home-2026-10/';
  var PHOTOS = [
    ['instructor-clase-cocina.webp', 'Instructor en la cocina de Presunta Entropía'],
    ['grupo-amigos-cocina.webp', 'Grupo de amigos cocinando juntos en un taller'],
    ['pasta-close-up.webp', 'Pasta fresca hecha a mano, en primer plano'],
    ['riendo-comida.webp', 'Participante riendo durante un taller de cocina'],
    ['pareja-curso-cocina-madrid.webp', 'Pareja en un curso de cocina en Madrid'],
    ['muestra-plato-mano.webp', 'Plato terminado presentado en la mano']
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso, o) {
    try { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: TZ }, o)).format(new Date(iso)); } catch (e) { return ''; }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function day(iso) { return fmt(iso, { day: 'numeric' }); }
  function mon(iso) { return fmt(iso, { month: 'short' }).replace('.', ''); }
  function wd(iso) { return fmt(iso, { weekday: 'short' }).replace('.', ''); }
  function hour(iso) { return fmt(iso, { hour: '2-digit', minute: '2-digit' }); }
  function longDate(iso) { return cap(fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })); }
  function price(p) { return p === null || p === undefined ? '' : p + ' €'; }
  function state(n) { return n === null || n === undefined ? '' : n <= 0 ? 'full' : n <= 5 ? 'low' : 'ok'; }

  function seatsLine(it) {
    var n = it.seatsLeft;
    if (n === null || n === undefined) return '';
    if (n <= 0) return 'Completo';
    var live = '<span data-item-seats-left' + (it.entropicalId ? ' data-item-id="' + esc(it.entropicalId) + '"' : '') + '>' + esc(n) + '</span>';
    return (n === 1 ? 'Queda ' : 'Quedan ') + live + (n === 1 ? ' plaza' : ' plazas');
  }
  function meter(n, extra) {
    if (n === null || n === undefined) return '';
    var on = Math.max(0, Math.min(METER_MAX, n)), out = '', x = extra ? ' ' + extra : '';
    for (var i = 0; i < METER_MAX; i++) out += '<span class="pe-bento_seg' + (i < on ? ' is-on' : '') + x + '"></span>';
    return '<span class="pe-bento_meter" aria-hidden="true">' + out + '</span>';
  }
  function led(it, extra) { return '<span class="pe-bento_led is-' + (state(it.seatsLeft) || 'ok') + (extra ? ' ' + extra : '') + '" aria-hidden="true"></span>'; }
  function book(it) { return 'href="#calendario" data-modal-open="modal-1" data-booking-item="' + esc(it.slug) + '"'; }
  function sr(t) { return '<span class="f-sr-only">' + esc(t) + '</span>'; }
  function upcomingIso(it) {
    return it.nextSession && new Date(it.nextSession).getTime() > Date.now() ? it.nextSession : null;
  }

  // the next dated session, then every other workshop: dated first (by date), then undated
  function data() {
    var db = window.PE_CMS;
    if (!db || !db.find) return null;
    var now = Date.now();
    var next = (db.sesiones || []).filter(function (s) { return s.coleccion === 'talleres' && new Date(s.iso).getTime() > now; })
      .map(function (s) { var it = db.find(s.coleccion, s.item); return it ? { it: it, iso: s.iso } : null; })
      .filter(Boolean)[0] || null;
    var rest = (db.talleres || []).filter(function (it) { return !next || it.slug !== next.it.slug; });
    rest.sort(function (a, b) {
      var da = upcomingIso(a), dbb = upcomingIso(b);
      if (da && dbb) return new Date(da) - new Date(dbb);
      return da ? -1 : dbb ? 1 : 0;
    });
    return { next: next, rest: rest };
  }

  function renderNext(nx, first) {
    var it = first.it, iso = first.iso, st = state(it.seatsLeft);
    nx.innerHTML =
      '<div class="pe-bento_head"><span class="pe-bento_head-left">' + led(it, 'is-feature') + '<span class="pe-bento_silk is-feature">Próximo taller</span></span><span class="pe-bento_silk is-feature">' + esc(hour(iso)) + ' h</span></div>' +
      '<div class="pe-bento_nx-row"><span class="pe-bento_day is-feature" aria-hidden="true">' + esc(day(iso)) + '</span>' +
      '<span class="pe-bento_nx-when"><span class="pe-bento_silk is-feature">' + esc(mon(iso)) + ' · ' + esc(wd(iso)) + '</span>' +
      '<span class="f-text-h4 f-text-uppercase pe-bento_nx-name">' + sr(longDate(iso) + ': ') + esc(it.name) + '</span></span></div>' +
      '<div class="pe-bento_nx-foot"><span class="pe-bento_seats is-feature">' + meter(it.seatsLeft, 'is-feature') + '<span class="f-text-small pe-bento_seats-text">' + seatsLine(it) + '</span></span>' +
      '<span class="pe-bento_price is-large">' + esc(price(it.precio)) + '</span></div>' +
      '<div class="pe-bento_nx-cta"><a ' + book(it) + ' class="button is-secondary is-small w-button f-text-label">' + (st === 'full' ? 'Ver otras fechas' : 'Reservar esta fecha') + sr(': ' + it.name) + '</a></div>';
  }

  // one rotating face: the whole link, laid out inside the fixed frame
  function face(it) {
    var iso = upcomingIso(it);
    var a = document.createElement('a');
    a.className = 'pe-bento_item';
    if (iso) {
      a.href = '#calendario';
      a.setAttribute('data-modal-open', 'modal-1');
      a.setAttribute('data-booking-item', it.slug);
    } else {
      a.href = 'taller-item.html?slug=' + encodeURIComponent(it.slug);
    }
    var n = it.seatsLeft;
    var seatsTxt = iso && n !== null && n !== undefined ? (n <= 0 ? 'Completo' : (n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas')) : '';
    var meta = iso ? longDate(iso) + (seatsTxt ? ' · ' + seatsTxt : '') : 'Nuevas fechas próximamente' + (it.nivel ? ' · Nivel ' + it.nivel.toLowerCase() : '');
    a.innerHTML =
      '<span class="pe-bento_head pe-bento_item-head"><span class="pe-bento_head-left">' + (iso ? led(it) : '<span class="pe-bento_led is-soon" aria-hidden="true"></span>') +
      '<span class="pe-bento_silk">' + (iso ? 'Próxima fecha' : 'Próximamente') + '</span></span><span class="pe-bento_silk">' + esc(iso ? hour(iso) + ' h' : (it.duracion || '')) + '</span></span>' +
      (iso
        ? '<span class="pe-bento_item-date" aria-hidden="true"><span class="pe-bento_item-day">' + esc(day(iso)) + '</span><span class="pe-bento_silk">' + esc(mon(iso)) + '</span></span>'
        : '<span class="pe-bento_item-date" aria-hidden="true"><span class="pe-bento_item-day">—</span><span class="pe-bento_silk">Pronto</span></span>') +
      '<span class="pe-bento_item-name"><span class="f-text-h6 f-text-uppercase">' + esc(it.name) + '</span>' +
      '<span class="f-text-small pe-bento_item-meta">' + esc(meta) + '</span></span>' +
      '<span class="pe-bento_price">' + esc(price(it.precio)) + '</span>' + sr(iso ? '. Reservar' : '. Ver el taller');
    return a;
  }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function roll(slot, it) {
    var old = slot.querySelector('.pe-bento_item:not(.is-leaving)');
    var nu = face(it);
    nu.classList.add('is-below');
    slot.appendChild(nu);
    void nu.offsetWidth;                         // commit the start pose
    var hadFocus = old && old === document.activeElement;
    nu.classList.remove('is-below');
    if (old) {
      old.classList.add('is-leaving');
      old.setAttribute('aria-hidden', 'true');
      old.tabIndex = -1;
      setTimeout(function () { old.remove(); }, ROLL_MS + 50);
    }
    if (hadFocus) nu.focus();
  }

  function init() {
    var header = document.querySelector('.pe-bento');
    var nx = document.querySelector('[data-pe-bento-next]');
    var ls = document.querySelector('[data-pe-bento-list]');
    if (!header || !nx || !ls) return;
    var d = data();
    if (!d || !d.next) {
      nx.innerHTML = '<p class="f-text-lead pe-bento_empty">Estamos preparando nuevas fechas.</p>';
    } else {
      renderNext(nx, d.next);
    }
    var pool = d ? d.rest : [];
    if (!pool.length) { ls.style.display = 'none'; return; }

    var SLOTS = Math.min(3, pool.length);
    ls.innerHTML = '';
    var slots = [], shown = [];
    for (var i = 0; i < SLOTS; i++) {
      var li = document.createElement('li');
      li.className = 'pe-bento_li';
      li.appendChild(face(pool[i]));
      ls.appendChild(li);
      slots.push(li);
      shown.push(i);
    }
    var cursor = SLOTS, turn = 0;

    var photoBox = document.querySelector('[data-pe-bento-photo]');
    var photoIdx = 0;
    function nextPhoto() {
      if (!photoBox) return;
      photoIdx = (photoIdx + 1) % PHOTOS.length;
      var cur = photoBox.querySelector('.pe-bento_img.is-on');
      var img = new Image();
      img.className = 'pe-bento_img';
      img.alt = PHOTOS[photoIdx][1];
      img.decoding = 'async';
      img.onload = function () {
        photoBox.insertBefore(img, photoBox.querySelector('.pe-bento_strip'));
        void img.offsetWidth;
        img.classList.add('is-on');
        if (cur) { cur.classList.remove('is-on'); setTimeout(function () { cur.remove(); }, 1300); }
      };
      img.src = IMG + PHOTOS[photoIdx][0];
    }

    if (reduce || pool.length <= SLOTS && PHOTOS.length < 2) return;

    var paused = false, inView = true, lastStep = 0, lastPhoto = 0;
    // pause only while someone is on the rotating boxes (reading or about to click)
    ls.addEventListener('pointerenter', function () { paused = true; });
    ls.addEventListener('pointerleave', function () { paused = false; });
    ls.addEventListener('focusin', function () { paused = true; });
    ls.addEventListener('focusout', function (e) { if (!ls.contains(e.relatedTarget)) paused = false; });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.2 }).observe(header);
    }
    function step() {
      if (pool.length <= SLOTS) return;
      var k = turn % SLOTS; turn++;
      // the next workshop not already on screen
      var guard = 0;
      while (shown.indexOf(cursor % pool.length) !== -1 && guard++ < pool.length) cursor++;
      var idx = cursor % pool.length; cursor++;
      shown[k] = idx;
      roll(slots[k], pool[idx]);
    }
    setInterval(function () {
      if (paused || !inView || document.hidden) return;
      var now = Date.now();
      if (now - lastStep >= STEP_MS) { lastStep = now; step(); }
      if (now - lastPhoto >= PHOTO_MS) { lastPhoto = now; nextPhoto(); }
    }, 250);
    lastStep = lastPhoto = Date.now();
  }

  // deferred: runs before DOMContentLoaded, so pe-motion.js's buttonFx pass
  // still reaches the button rendered in the next-workshop box
  init();
})();

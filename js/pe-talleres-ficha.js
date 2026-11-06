/* =============================================================
   FICHA TECNICA HERO — talleres.html
   (option O of hero-options, chosen 8 Oct 2026).
   Fills [data-pe-ficha]: the next four workshop dates as tabs
   (ARIA tablist, arrow keys), the sheet of the selected one (name,
   summary, Fecha / Hora / Duración / Plazas / Precio) and its photo,
   from window.PE_CMS (platform sync, src/data/pe-experiencias.js).
   Seat numbers are plain text on purpose: webflow-cart.js writes 0 into
   [data-item-seats-left] when its seat request fails, so that hook showed
   false zeros. "Reservar plaza" opens the booking
   modal (#modal-1) narrowed to the selected workshop (data-booking-item).
   The sheet advances through the dates on its own (rolling like the
   buttons' hover; the photo crossfades) until a tab is picked; it pauses
   while the pointer or focus is on the sheet, and never auto-advances
   under prefers-reduced-motion.
   Phones (767 and below, css/pe-taller-hero.css): the sheet's facts sit in a
   closed native <details> (the desktop table stays in the page beside it, each
   hidden at the other's widths), the two calls take the button roles and the
   date stays where it was picked: a rolling sheet would move the buttons under
   the reader's thumb.
   ============================================================= */
(function () {
  'use strict';

  var TZ = 'Europe/Madrid';
  var METER_MAX = 16;
  var MAX_TABS = 4;
  // platform items have no photo yet: site photography, pasta has its own
  var IMG = 'assets/images/r4-2026-10/';
  var PHOTO_BY_SLUG = { 'pasta-fresca-di-cuore': 'pasta-hands-1600.webp' };
  var PHOTO_ROTATION = ['instructor-talk-1600.webp', 'friends-cooking-1600.webp', 'meal-laugh-1600.webp', 'pareja-paella-1600.webp'];
  var PHONE = window.matchMedia ? matchMedia('(max-width: 767px)') : { matches: false };
  var ARROW = '<svg class="pe-arrow" viewBox="0 0 102.82 48.29" fill="currentColor" aria-hidden="true"><path d="M45.96 48.29V39.19L97.19 24.14L45.96 9.1V0L102.82 17.22V31.06L45.96 48.29ZM0 19.88H99.51V28.42H0Z"/></svg>';
  var ICON_X = '<svg class="pe-x" viewBox="0 0 26.94 26.94" fill="currentColor" aria-hidden="true"><path d="M26.94 22.93L17.48 13.47L26.94 4.01L22.93 0L13.47 9.46L4.01 0L0 4.01L9.46 13.47L0 22.93L4.01 26.94L13.47 17.48L22.93 26.94Z"/></svg>';

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
  function hour(iso) { return fmt(iso, { hour: '2-digit', minute: '2-digit' }); }
  function longDate(iso) { return cap(fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })); }
  function price(p) { return p === null || p === undefined ? '' : p + ' €'; }
  function state(n) { return n === null || n === undefined ? '' : n <= 0 ? 'full' : n <= 5 ? 'low' : 'ok'; }
  function photo(it, i) { return it.image || IMG + (PHOTO_BY_SLUG[it.slug] || PHOTO_ROTATION[i % PHOTO_ROTATION.length]); }

  function seats(it) {
    var n = it.seatsLeft;
    if (n === null || n === undefined) return '';
    var on = Math.max(0, Math.min(METER_MAX, n)), segs = '';
    for (var i = 0; i < METER_MAX; i++) segs += '<span class="pe-ficha_seg' + (i < on ? ' is-on' : '') + '"></span>';
    var text = n <= 0 ? 'Completo' : (n === 1 ? 'Queda ' : 'Quedan ') +
      esc(n) +
      (n === 1 ? ' plaza' : ' plazas');
    return '<span class="pe-ficha_seats is-' + state(n) + '"><span class="pe-ficha_meter" aria-hidden="true">' + segs + '</span>' +
      '<span class="f-text-small pe-ficha_seats-text">' + text + '</span></span>';
  }
  function row(label, value, cls) {
    return '<div class="pe-ficha_row"><dt class="pe-ficha_silk">' + label + '</dt><dd class="' + (cls || 'f-text-body') + ' pe-ficha_value">' + value + '</dd></div>';
  }

  var root, rows = [], cur = 0, moreOpen = false;

  function upcoming() {
    var db = window.PE_CMS;
    if (!db || !db.find) return [];
    var now = Date.now();
    return (db.sesiones || []).filter(function (s) { return s.coleccion === 'talleres' && new Date(s.iso).getTime() > now; })
      .map(function (s) { var it = db.find(s.coleccion, s.item); return it ? { iso: s.iso, it: it } : null; })
      .filter(Boolean).slice(0, MAX_TABS);
  }

  var ROLL_MS = 650, AUTO_MS = 6500;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // photo: crossfade (the new image fades in over the old one)
  function setPhoto(src, alt, fade) {
    var box = root.querySelector('.pe-ficha_photo');
    var curImg = box && box.querySelector('.pe-ficha_img.is-on');
    if (!box || !curImg) return;
    if (!fade) { curImg.removeAttribute('srcset'); curImg.src = src; curImg.alt = alt; return; }
    var img = new Image();
    img.className = 'pe-ficha_img';
    img.alt = alt;
    img.onload = function () {
      box.insertBefore(img, box.querySelector('.pe-ficha_strip'));
      void img.offsetWidth;
      img.classList.add('is-on');
      curImg.classList.remove('is-on');
      setTimeout(function () { curImg.remove(); }, 1300);
    };
    img.src = src;
  }
  // sheet: the old face rolls up and out, the new one rises in (the
  // buttons' hover roll, pe-motion.css .pe-rise)
  function setFace(panel, html, rollIt) {
    var old = panel.querySelector('.pe-ficha_face:not(.is-leaving)');
    var nu = document.createElement('div');
    nu.className = 'pe-ficha_face';
    nu.innerHTML = html;
    if (!old || !rollIt || reduce) { panel.innerHTML = ''; panel.appendChild(nu); return; }
    nu.classList.add('is-below');
    panel.appendChild(nu);
    void nu.offsetWidth;
    nu.classList.remove('is-below');
    old.classList.add('is-leaving');
    old.setAttribute('aria-hidden', 'true');
    setTimeout(function () { old.remove(); }, ROLL_MS + 50);
  }

  function show(i, focus, animate) {
    var r = rows[i]; if (!r) return;
    if (i === cur && root.querySelector('.pe-ficha_face')) { if (focus) { var t = root.querySelector('#pe-ficha-tab-' + i); if (t) t.focus(); } return; }
    cur = i;
    Array.prototype.forEach.call(root.querySelectorAll('[data-pe-ficha-i]'), function (b) {
      var on = +b.getAttribute('data-pe-ficha-i') === i;
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('is-active', on);
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    var it = r.it, iso = r.iso;
    setPhoto(photo(it, i), 'Taller ' + it.name, animate);
    var tag = root.querySelector('[data-pe-ficha-tag]');
    if (tag) tag.textContent = it.name;
    var panel = root.querySelector('[data-pe-ficha-panel]');
    panel.setAttribute('aria-labelledby', 'pe-ficha-tab-' + i);
    var table = '<dl class="pe-ficha_table">' +
      row('Fecha', esc(longDate(iso))) +
      row('Hora', esc(hour(iso)) + ' h') +
      (it.duracion ? row('Duración', esc(it.duracion)) : '') +
      (seats(it) ? row('Plazas', seats(it)) : '') +
      row('Precio', esc(price(it.precio) || '—'), 'f-text-h5') +
      '</dl>';
    setFace(panel,
      '<h2 class="f-text-h1 f-text-uppercase pe-ficha_name">' + esc(it.name) + '</h2>' +
      (it.summary ? '<p class="f-text-lead pe-ficha_summary">' + esc(it.summary) + '</p>' : '') +
      '<details class="pe-ficha_more"' + (moreOpen ? ' open' : '') + '>' +
      '<summary class="f-text-label pe-ficha_more-q">Más información' + ICON_X + '</summary>' + table + '</details>' +
      table, animate);
    var book = root.querySelector('[data-pe-ficha-book]');
    if (book) book.setAttribute('data-booking-item', it.slug);
    var info = root.querySelector('[data-pe-ficha-info]');
    if (info) info.href = 'taller-item.html?slug=' + encodeURIComponent(it.slug);
  }

  // the two calls: primary + link on desktop, primary + secondary on phones.
  // classList.toggle writes nothing when the class is already right.
  function roles() {
    var book = root.querySelector('[data-pe-ficha-book]');
    var info = root.querySelector('[data-pe-ficha-info]');
    var ctas = root.querySelector('.pe-ficha_ctas');
    if (!book || !info || !ctas) return;
    var phone = PHONE.matches;
    book.classList.toggle('is-secondary', !phone);
    info.classList.toggle('is-link', !phone);
    info.classList.toggle('is-secondary', phone);
    info.classList.toggle('f-text-ui-lg', phone);
    ctas.classList.toggle('is-with-link', !phone);
    ctas.classList.toggle('is-pair', phone);
    ctas.classList.toggle('is-stack-phone', phone);
  }

  function render() {
    root = document.querySelector('[data-pe-ficha]');
    if (!root) return;
    var book = root.querySelector('[data-pe-ficha-book]');
    if (book) book.insertAdjacentHTML('beforeend', ARROW);
    roles();
    if (PHONE.addEventListener) PHONE.addEventListener('change', roles);
    rows = upcoming();
    var tabs = root.querySelector('[data-pe-ficha-tabs]');
    if (!rows.length) { tabs.parentNode.style.display = 'none'; return; }
    tabs.innerHTML = rows.map(function (r, i) {
      return '<button type="button" role="tab" class="pe-ficha_tab' + (i === 0 ? ' is-active' : '') + '" id="pe-ficha-tab-' + i + '" aria-controls="pe-ficha-panel" data-pe-ficha-i="' + i + '"' +
        ' aria-label="' + esc(day(r.iso)) + ' ' + esc(mon(r.iso)) + ', ' + esc(r.it.name) + '"' +
        ' aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' +
        '<span class="pe-ficha_tab-date">' + esc(day(r.iso)) + ' ' + esc(mon(r.iso)) + '</span>' +
        '<span class="pe-ficha_silk pe-ficha_tab-name">' + esc(r.it.name) + '</span></button>';
    }).join('');
    // auto-advance through the dates until someone picks one; paused
    // while the pointer or focus is on the sheet, off screen or tab hidden
    var picked = false, paused = false, inView = true, last = Date.now();
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pe-ficha-i]');
      if (b) { picked = true; show(+b.getAttribute('data-pe-ficha-i'), false, true); }
    });
    tabs.addEventListener('keydown', function (e) {
      var n = rows.length, k = e.key, next = null;
      if (k === 'ArrowRight' || k === 'ArrowDown') next = (cur + 1) % n;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') next = (cur + n - 1) % n;
      else if (k === 'Home') next = 0;
      else if (k === 'End') next = n - 1;
      if (next !== null) { e.preventDefault(); picked = true; show(next, true, true); }
    });
    // a new date keeps the disclosure as the reader left it (toggle does not bubble)
    root.querySelector('[data-pe-ficha-panel]').addEventListener('toggle', function (e) {
      if (e.target.classList.contains('pe-ficha_more')) moreOpen = e.target.open;
    }, true);
    var first = root.querySelector('[data-pe-ficha-photo]');
    if (first) first.classList.add('pe-ficha_img', 'is-on');
    cur = -1;
    show(0, false, false);
    if (reduce || rows.length < 2) return;
    var sheet = root.querySelector('.pe-ficha_sheet') || root;
    sheet.addEventListener('pointerenter', function () { paused = true; });
    sheet.addEventListener('pointerleave', function () { paused = false; last = Date.now(); });
    sheet.addEventListener('focusin', function () { paused = true; });
    sheet.addEventListener('focusout', function (e) { if (!sheet.contains(e.relatedTarget)) { paused = false; last = Date.now(); } });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.2 }).observe(root);
    }
    setInterval(function () {
      if (picked || paused || !inView || document.hidden || PHONE.matches) return;
      if (Date.now() - last < AUTO_MS) return;
      last = Date.now();
      show((cur + 1) % rows.length, false, true);
    }, 250);
  }

  // deferred: runs before DOMContentLoaded, so pe-motion.js's buttonFx pass
  // still reaches the hero buttons (their labels are never rewritten here)
  render();
})();

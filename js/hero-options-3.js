/* =============================================================
   HERO OPTIONS, ROUND 3 (L–P) — data + render for
   src/pages/hero-options-all.html (review page, 7 Oct 2026).
   Same data path as hero-options.js: live Entropical API, snapshot
   window.PE_EXPERIENCIAS as fallback. Every "Reservar" / "Ver
   calendario" is a [data-modal-open="modal-1"] opener; data-booking-item
   narrows it to one workshop when that workshop is in window.PE_CMS.
   ============================================================= */
(function () {
  'use strict';

  var API = 'https://presunta.ntropical.com';
  var COLLECTION = { workshop: 'talleres', experience: 'talleres', dinner: 'cenas', team_building: 'team-building' };
  var IMG = 'assets/images/home-2026-10/';
  var PHOTO_BY_SLUG = { 'pasta-fresca-di-cuore': 'pasta-close-up-800.webp' };
  var PHOTO_ROTATION = ['instructor-clase-cocina-800.webp', 'grupo-amigos-cocina-800.webp', 'pareja-curso-cocina-madrid-800.webp', 'riendo-comida-800.webp', 'muestra-plato-mano-800.webp'];
  var TZ = 'Europe/Madrid';
  var METER_MAX = 16;

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
  function duracion(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
  }
  function price(p) { return p === null || p === undefined ? '' : (Math.round(p) === p ? p : p.toFixed(2).replace('.', ',')) + ' €'; }
  function seatsText(n) {
    if (n === null || n === undefined) return '';
    if (n <= 0) return 'Completo';
    return n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas';
  }
  function seatsState(n) { return n === null || n === undefined ? '' : n <= 0 ? 'full' : n <= 5 ? 'low' : 'ok'; }
  function full(s) { return s.seats !== null && s.seats !== undefined && s.seats <= 0; }

  function withTimeout(ms) {
    if (!window.AbortController) return { signal: undefined, done: function () {} };
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    return { signal: c.signal, done: function () { clearTimeout(t); } };
  }
  function getJSON(url, ms) {
    var to = withTimeout(ms);
    return fetch(url, { headers: { accept: 'application/json' }, signal: to.signal })
      .then(function (r) { return r.json().then(function (b) { to.done(); if (!r.ok || !b || !b.success) throw new Error(url + ' ' + r.status); return b.data; }); },
        function (e) { to.done(); throw e; });
  }
  function snapshotSeats(slug) {
    var src = window.PE_EXPERIENCIAS && window.PE_EXPERIENCIAS.items || [];
    for (var i = 0; i < src.length; i++) if (src[i].slug === slug) return src[i].seatsLeft;
    return null;
  }
  function photoFor(slug, url, i) { return url || IMG + (PHOTO_BY_SLUG[slug] || PHOTO_ROTATION[i % PHOTO_ROTATION.length]); }

  function fromSnapshot() {
    var now = Date.now();
    var src = window.PE_EXPERIENCIAS && window.PE_EXPERIENCIAS.items || [];
    return src.filter(function (x) { return x.isPublished !== false && x.sessionDate && new Date(x.sessionDate).getTime() > now; })
      .sort(function (a, b) { return a.sessionDate < b.sessionDate ? -1 : 1; })
      .map(function (x, i) {
        return { slug: x.slug, name: x.name, coleccion: x.coleccion || 'talleres', iso: x.sessionDate, price: x.priceEuros,
          seats: x.seatsLeft, minutes: x.durationMinutes, image: photoFor(x.slug, x.heroImageUrl, i), summary: x.shortDescription || '' };
      });
  }
  function fromApi() {
    var now = Date.now();
    return getJSON(API + '/api/items', 6000).then(function (list) {
      var up = (list || []).filter(function (d) {
        return d.isPublished && d.isActive !== false && !d.isArchived && !d.isTestData && d.sessionDate && new Date(d.sessionDate).getTime() > now;
      }).sort(function (a, b) { return a.sessionDate < b.sessionDate ? -1 : 1; }).slice(0, 8);
      return Promise.all(up.map(function (d) {
        var override = d.capacityDisplayOverride;
        var seatP = override !== null && override !== undefined ? Promise.resolve(override)
          : getJSON(API + '/api/items/' + encodeURIComponent(d.id) + '/seat-status', 5000).then(function (s) { return s.seatsLeft; }, function () { return snapshotSeats(d.slug); });
        return seatP.then(function (seats) {
          return { slug: d.slug, name: d.name, coleccion: COLLECTION[d.category] || 'talleres', iso: d.sessionDate,
            price: typeof d.priceCurrentCents === 'number' ? d.priceCurrentCents / 100 : null, seats: seats,
            minutes: d.durationMinutes, image: d.heroImageUrl || '', summary: d.shortDescription || '' };
        });
      }));
    }).then(function (rows) { rows.forEach(function (r, i) { r.image = photoFor(r.slug, r.image, i); }); return rows; });
  }

  /* ---- shared bits ---- */
  function inCms(s) {
    var db = window.PE_CMS;
    return !!(db && db.find && db.find(s.coleccion === 'cenas' ? 'cenas' : 'talleres', s.slug));
  }
  function bookAttrs(s) {
    return 'href="#calendario" data-modal-open="modal-1"' + (s && inCms(s) ? ' data-booking-item="' + esc(s.slug) + '"' : '');
  }
  function setBook(a, s) {
    if (!a) return;
    if (s && inCms(s)) a.setAttribute('data-booking-item', s.slug); else a.removeAttribute('data-booking-item');
  }
  function detailHref(s) { return s.coleccion === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + encodeURIComponent(s.slug); }
  function sr(t) { return '<span class="f-sr-only">' + esc(t) + '</span>'; }
  function led(s) { return '<span class="hz-led" data-state="' + (seatsState(s.seats) || 'ok') + '" aria-hidden="true"></span>'; }
  // one segment per free seat (up to 16); text says the real number
  function seats(s) {
    var t = seatsText(s.seats);
    if (!t) return '';
    var n = Math.max(0, Math.min(METER_MAX, s.seats)), segs = '';
    for (var i = 0; i < METER_MAX; i++) segs += '<span' + (i < n ? ' class="is-on"' : '') + '></span>';
    return '<span class="hz-seats" data-state="' + seatsState(s.seats) + '"><span class="hz-meter" aria-hidden="true">' + segs + '</span>' +
      '<span class="hz-seats_text f-text-small">' + esc(t) + '</span></span>';
  }
  function bookLabel(s, label) { return full(s) ? 'Ver otras fechas' : label; }
  function two(n) { return ('0' + n).slice(-2); }
  function q(sel, el) { return (el || document).querySelector(sel); }
  var EMPTY = '<p class="hz-empty f-text-lead">Estamos preparando nuevas fechas.</p>';

  /* ---- L. Panel de mandos ---- */
  function renderL(el, list) {
    var s = list[0], nx = q('[data-l-next]', el), ls = q('[data-l-list]', el);
    if (!s) { nx.innerHTML = EMPTY; ls.innerHTML = ''; return; }
    var img = q('[data-l-photo]', el); img.src = s.image; img.alt = 'Taller ' + s.name;
    q('[data-l-tag]', el).textContent = day(s.iso) + ' ' + mon(s.iso) + ' · ' + s.name;
    nx.innerHTML =
      '<div class="hz-cell_head"><span>' + led(s) + '<span class="hz-silk">02 · Próximo taller</span></span><span class="hz-silk">' + esc(hour(s.iso)) + ' h</span></div>' +
      '<div class="hz-l_nx-row"><span class="hz-read hz-l_day" aria-hidden="true">' + esc(day(s.iso)) + '</span>' +
      '<span class="hz-l_nx-when"><span class="hz-silk is-accent">' + esc(mon(s.iso)) + ' · ' + esc(wd(s.iso)) + '</span>' +
      '<h3 class="f-text-h4 f-text-uppercase">' + sr(longDate(s.iso) + ': ') + esc(s.name) + '</h3></span></div>' +
      '<div class="hz-l_nx-foot">' + seats(s) + '<span class="hz-read hz-l_price">' + esc(price(s.price)) + '</span></div>' +
      '<div class="hz-ctas"><a ' + bookAttrs(s) + ' class="button is-secondary is-small w-button f-text-label">' + esc(bookLabel(s, 'Reservar esta fecha')) + sr(': ' + s.name) + '</a></div>';
    ls.innerHTML = list.slice(1, 4).map(function (x, i) {
      return '<li><a ' + bookAttrs(x) + ' class="hz-cell hz-l_item">' +
        '<span class="hz-cell_head"><span>' + led(x) + '<span class="hz-silk">' + two(i + 3) + ' · Después</span></span><span class="hz-silk">' + esc(hour(x.iso)) + ' h</span></span>' +
        '<span class="hz-l_item-date" aria-hidden="true"><span class="hz-read">' + esc(day(x.iso)) + '</span><span class="hz-silk">' + esc(mon(x.iso)) + '</span></span>' +
        '<span class="hz-l_item-name"><span class="f-text-h6 f-text-uppercase">' + esc(x.name) + '</span>' +
        '<span class="hz-light f-text-small">' + esc(longDate(x.iso)) + (seatsText(x.seats) ? ' · ' + esc(seatsText(x.seats)) : '') + '</span></span>' +
        '<span class="hz-read hz-l_price">' + esc(price(x.price)) + '</span>' + sr('. Reservar') + '</a></li>';
    }).join('');
  }

  /* ---- M. La pantalla ---- */
  var mState = { list: [], i: 0 };
  function renderM(el, list) {
    mState.list = list.slice(0, 6);
    var box = q('[data-m-list]', el);
    if (!mState.list.length) { box.innerHTML = '<li>' + EMPTY + '</li>'; q('[data-m-body]', el).innerHTML = ''; return; }
    if (mState.i >= mState.list.length) mState.i = 0;
    box.innerHTML = mState.list.map(function (s, i) {
      return '<li><button type="button" class="hz-m_opt" data-m-i="' + i + '" aria-pressed="' + (i === mState.i) + '">' +
        '<span class="hz-m_opt-date" aria-hidden="true"><span class="hz-read">' + esc(day(s.iso)) + '</span><span class="hz-silk">' + esc(mon(s.iso)) + ' · ' + esc(wd(s.iso)) + '</span></span>' +
        '<span class="hz-m_opt-name"><span class="f-text-h6 f-text-uppercase">' + esc(s.name) + '</span><span class="hz-light f-text-small">' + sr(longDate(s.iso) + ', ') + esc(hour(s.iso)) + ' h' + (seatsText(s.seats) ? ' · ' + esc(seatsText(s.seats)) : '') + '</span></span>' +
        '<span class="hz-read hz-m_opt-price">' + esc(price(s.price)) + '</span></button></li>';
    }).join('');
    showM(el, mState.i, false);
  }
  function showM(el, i, focus) {
    var s = mState.list[i]; if (!s) return;
    mState.i = i;
    Array.prototype.forEach.call(el.querySelectorAll('[data-m-i]'), function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-m-i') === i)); });
    var cnt = q('[data-m-count]', el); if (cnt) cnt.textContent = (i + 1) + ' / ' + mState.list.length;
    var img = q('[data-m-photo]', el); img.src = s.image; img.alt = 'Taller ' + s.name;
    q('[data-m-body]', el).innerHTML =
      '<p class="hz-silk is-accent">' + esc(longDate(s.iso)) + ' · ' + esc(hour(s.iso)) + ' h</p>' +
      '<h3 class="f-text-h3 f-text-uppercase">' + esc(s.name) + '</h3>' +
      (s.summary ? '<p class="hz-m_summary hz-light f-text-body">' + esc(s.summary) + '</p>' : '') +
      '<dl class="hz-spec">' +
      '<div><dt class="hz-silk">Duración</dt><dd class="f-text-h6">' + esc(duracion(s.minutes) || '—') + '</dd></div>' +
      '<div><dt class="hz-silk">Plazas</dt><dd class="f-text-h6">' + esc(s.seats === null || s.seats === undefined ? '—' : full(s) ? 'Completo' : s.seats) + '</dd></div>' +
      '<div><dt class="hz-silk">Precio</dt><dd class="f-text-h6">' + esc(price(s.price) || '—') + '</dd></div></dl>';
    var book = q('[data-m-book]', el); setBook(book, s);
    var info = q('[data-m-info]', el); info.href = detailHref(s);
    if (focus) { var b = q('[data-m-i="' + i + '"]', el); if (b) b.focus(); }
  }
  function wireM() {
    var el = q('[data-hz="m"]'); if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m-i]'); if (b) showM(el, +b.getAttribute('data-m-i'), false);
    });
    q('[data-m-list]', el).addEventListener('keydown', function (e) {
      var n = mState.list.length; if (!n) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        showM(el, (mState.i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n, true);
      } else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); q('[data-m-book]', el).click(); }
      else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); q('[data-m-info]', el).click(); }
    });
  }

  /* ---- N. El rack ---- */
  function renderN(el, list) {
    var box = q('[data-n-list]', el);
    var rows = list.slice(0, 5);
    if (!rows.length) { box.innerHTML = '<li class="hz-n_unit">' + EMPTY + '</li>'; return; }
    box.innerHTML = rows.map(function (s, i) {
      return '<li><a ' + bookAttrs(s) + ' class="hz-n_unit hz-n_row">' + led(s) +
        '<span class="hz-silk hz-n_ch" aria-hidden="true">CH ' + two(i + 2) + '</span>' +
        '<span class="hz-n_date" aria-hidden="true"><span class="hz-read">' + esc(day(s.iso)) + '</span><span class="hz-silk is-accent">' + esc(mon(s.iso)) + '</span></span>' +
        '<span class="hz-n_name"><span class="f-text-h5 f-text-uppercase">' + esc(s.name) + '</span><span class="hz-light f-text-small">' + esc(longDate(s.iso)) + ' · ' + esc(hour(s.iso)) + ' h' + (s.minutes ? ' · ' + esc(duracion(s.minutes)) : '') + '</span></span>' +
        (seats(s) || '<span></span>') +
        '<span class="hz-read hz-n_price">' + esc(price(s.price)) + '</span>' +
        '<span class="button is-secondary is-small w-button f-text-label" aria-hidden="true">' + esc(bookLabel(s, 'Reservar')) + '</span>' + sr('. Reservar') + '</a></li>';
    }).join('');
  }

  /* ---- O. Ficha técnica ---- */
  var oState = { list: [], i: 0 };
  function renderO(el, list) {
    oState.list = list.slice(0, 4);
    var tabs = q('[data-o-tabs]', el);
    if (!oState.list.length) { tabs.innerHTML = ''; q('[data-o-panel]', el).innerHTML = EMPTY; return; }
    if (oState.i >= oState.list.length) oState.i = 0;
    tabs.innerHTML = oState.list.map(function (s, i) {
      return '<button type="button" role="tab" class="hz-o_tab" id="hz-o-tab-' + i + '" aria-controls="hz-o-panel" data-o-i="' + i + '" aria-selected="' + (i === oState.i) + '" tabindex="' + (i === oState.i ? 0 : -1) + '">' +
        '<span class="hz-read">' + esc(day(s.iso)) + ' ' + esc(mon(s.iso)) + '</span><span class="hz-silk">' + esc(s.name) + '</span></button>';
    }).join('');
    showO(el, oState.i, false);
  }
  function showO(el, i, focus) {
    var s = oState.list[i]; if (!s) return;
    oState.i = i;
    Array.prototype.forEach.call(el.querySelectorAll('[data-o-i]'), function (b) {
      var on = +b.getAttribute('data-o-i') === i;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    var panel = q('[data-o-panel]', el);
    panel.setAttribute('aria-labelledby', 'hz-o-tab-' + i);
    var img = q('[data-o-photo]', el); img.src = s.image; img.alt = 'Taller ' + s.name;
    q('[data-o-tag]', el).textContent = s.name;
    panel.innerHTML =
      '<h3 class="f-text-h1 f-text-uppercase">' + esc(s.name) + '</h3>' +
      (s.summary ? '<p class="hz-light f-text-lead">' + esc(s.summary) + '</p>' : '') +
      '<dl class="hz-o_table">' +
      '<div><dt class="hz-silk">Fecha</dt><dd class="f-text-body">' + esc(longDate(s.iso)) + '</dd></div>' +
      '<div><dt class="hz-silk">Hora</dt><dd class="f-text-body">' + esc(hour(s.iso)) + ' h</dd></div>' +
      (s.minutes ? '<div><dt class="hz-silk">Duración</dt><dd class="f-text-body">' + esc(duracion(s.minutes)) + '</dd></div>' : '') +
      (seatsText(s.seats) ? '<div><dt class="hz-silk">Plazas</dt><dd class="f-text-body">' + seats(s) + '</dd></div>' : '') +
      '<div><dt class="hz-silk">Precio</dt><dd class="f-text-h5">' + esc(price(s.price) || '—') + '</dd></div></dl>';
    var book = q('[data-o-book]', el); setBook(book, s);
    q('[data-o-info]', el).href = detailHref(s);
  }
  function wireO() {
    var el = q('[data-hz="o"]'); if (!el) return;
    var tabs = q('[data-o-tabs]', el);
    tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-o-i]'); if (b) showO(el, +b.getAttribute('data-o-i'), false); });
    tabs.addEventListener('keydown', function (e) {
      var n = oState.list.length; if (!n) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); showO(el, (oState.i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n, true);
      }
    });
  }

  /* ---- P. Bento de fotos ---- */
  function renderP(el, list) {
    var box = q('[data-p-tiles]', el);
    var rows = list.slice(0, 3);
    if (!rows.length) { box.innerHTML = '<div class="hz-cell hz-p_tile" data-slot="1">' + EMPTY + '</div>'; return; }
    box.innerHTML = rows.map(function (s, i) {
      return '<a ' + bookAttrs(s) + ' class="hz-cell hz-p_tile" data-slot="' + (i + 1) + '">' +
        '<span class="hz-p_img"><img src="' + esc(s.image) + '" alt="" loading="lazy"></span>' +
        '<span class="hz-p_info"><span class="hz-cell_head"><span>' + led(s) + '<span class="hz-silk' + (i ? '' : ' is-accent') + '">' + (i ? 'Después' : 'Próximo taller') + '</span></span>' +
        '<span class="hz-silk">' + esc(cap(wd(s.iso))) + ' ' + esc(day(s.iso)) + ' ' + esc(mon(s.iso)) + ' · ' + esc(hour(s.iso)) + '</span></span>' +
        '<span class="' + (i ? 'f-text-h5' : 'f-text-h2') + ' f-text-uppercase">' + esc(s.name) + '</span>' +
        (i === 0 && s.summary ? '<span class="hz-light f-text-body">' + esc(s.summary) + '</span>' : '') +
        '<span class="hz-p_foot">' + seats(s) + '<span class="hz-read hz-p_price">' + esc(price(s.price)) + '</span></span></span>' +
        sr(longDate(s.iso) + '. Reservar') + '</a>';
    }).join('');
  }

  var RENDER = { l: renderL, m: renderM, n: renderN, o: renderO, p: renderP };
  function renderAll(list) {
    Object.keys(RENDER).forEach(function (k) {
      var el = q('[data-hz="' + k + '"]');
      if (el) { try { RENDER[k](el, list); } catch (e) { if (window.console) console.warn('hero-options-3 ' + k, e); } }
    });
    if (window.PEMotion && PEMotion.buttonFx) { try { PEMotion.buttonFx(q('.hz')); } catch (e) {} }
  }
  function start() {
    wireM(); wireO();
    renderAll(fromSnapshot());
    fromApi().then(renderAll, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

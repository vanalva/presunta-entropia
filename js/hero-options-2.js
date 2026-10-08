/* =============================================================
   HERO OPTIONS, ROUND 2 — data + render for src/pages/hero-options-2.html
   (review page, 7 Oct 2026). Not used by any other page.
   Same data path as hero-options.js: live Entropical API, snapshot
   window.PE_EXPERIENCIAS as fallback. Every "Reservar" is a
   [data-modal-open="modal-1"] opener (the site's booking calendar).
   ============================================================= */
(function () {
  'use strict';

  var API = 'https://presunta.ntropical.com';
  var COLLECTION = { workshop: 'talleres', experience: 'talleres', dinner: 'cenas', team_building: 'team-building' };
  var IMG = 'assets/images/home-2026-10/';
  var PHOTO_BY_SLUG = { 'pasta-fresca-di-cuore': 'pasta-close-up.webp' };
  var PHOTO_ROTATION = ['grupo-amigos-cocina.webp', 'instructor-clase-cocina.webp', 'pareja-curso-cocina-madrid.webp', 'riendo-comida.webp', 'muestra-plato-mano.webp'];
  var TZ = 'Europe/Madrid';
  var DAY = 86400000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso, o) {
    try { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: TZ }, o)).format(new Date(iso)); } catch (e) { return ''; }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function dayNum(iso) { return fmt(iso, { day: 'numeric' }); }
  function monShort(iso) { return fmt(iso, { month: 'short' }).replace('.', ''); }
  function wdShort(iso) { return fmt(iso, { weekday: 'short' }).replace('.', ''); }
  function hour(iso) { return fmt(iso, { hour: '2-digit', minute: '2-digit' }); }
  function longDate(iso) { return cap(fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })); }
  function price(p) { return p === null || p === undefined ? '' : (Math.round(p) === p ? p : p.toFixed(2).replace('.', ',')) + ' €'; }
  function seatsText(n) {
    if (n === null || n === undefined) return '';
    if (n <= 0) return 'Completo';
    return n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas';
  }
  function seatsState(n) { return n === null || n === undefined ? '' : n <= 0 ? 'full' : n <= 5 ? 'low' : 'ok'; }
  function full(s) { return s.seats !== null && s.seats !== undefined && s.seats <= 0; }
  function madridMidnight(t) {
    var p = fmt(new Date(t).toISOString(), { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/');
    return Date.UTC(+p[2], +p[1] - 1, +p[0]);
  }
  function daysUntil(iso) { return Math.round((madridMidnight(new Date(iso).getTime()) - madridMidnight(Date.now())) / DAY); }

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
          seats: x.seatsLeft, image: photoFor(x.slug, x.heroImageUrl, i), summary: x.shortDescription || '' };
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
            image: d.heroImageUrl || '', summary: d.shortDescription || '' };
        });
      }));
    }).then(function (rows) { rows.forEach(function (r, i) { r.image = photoFor(r.slug, r.image, i); }); return rows; });
  }

  function inCms(s) {
    var db = window.PE_CMS;
    return !!(db && db.find && db.find(s.coleccion === 'cenas' ? 'cenas' : 'talleres', s.slug));
  }
  function bookAttrs(s) {
    return 'href="#calendario" data-modal-open="modal-1"' + (s && inCms(s) ? ' data-booking-item="' + esc(s.slug) + '"' : '');
  }
  function detailHref(s) { return s.coleccion === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + encodeURIComponent(s.slug); }
  function seatsChip(s) {
    var t = seatsText(s.seats);
    return t ? '<span class="hx-seats" data-state="' + seatsState(s.seats) + '">' + esc(t) + '</span>' : '';
  }
  function q(sel, el) { return (el || document).querySelector(sel); }

  /* ---- F. La comanda ---- */
  function renderF(el, list) {
    var box = q('[data-f-lines]', el), no = q('[data-f-no]', el);
    if (no && list[0]) no.textContent = 'Nº ' + ('00' + dayNum(list[0].iso)).slice(-3);
    if (!box) return;
    box.innerHTML = list.slice(0, 4).map(function (s) {
      return '<li><a class="hx-f_line" ' + bookAttrs(s) + ' aria-label="Reservar ' + esc(s.name) + ', ' + esc(longDate(s.iso)) + ' a las ' + esc(hour(s.iso)) + '">' +
        '<span class="hx-f_when"><b>' + esc(dayNum(s.iso)) + ' ' + esc(monShort(s.iso)) + '</b> ' + esc(wdShort(s.iso)) + ' · ' + esc(hour(s.iso)) + '</span>' +
        '<span class="hx-f_name">' + esc(s.name) + '</span>' +
        '<span class="hx-f_price">' + esc(price(s.price)) + '</span>' +
        '<span class="hx-f_meta">' + seatsChip(s) + '</span></a></li>';
    }).join('');
  }

  /* ---- G. La carta ---- */
  function renderG(el, list) {
    var groups = { talleres: [], cenas: [] };
    list.forEach(function (s) { (s.coleccion === 'cenas' ? groups.cenas : groups.talleres).push(s); });
    function rows(arr) {
      return arr.slice(0, 5).map(function (s) {
        return '<li><a class="hx-g_row" ' + bookAttrs(s) + '>' +
          '<span class="hx-g_name">' + esc(s.name) + '</span><span class="hx-g_dots" aria-hidden="true"></span>' +
          '<span class="hx-g_val">' + esc(dayNum(s.iso) + ' ' + monShort(s.iso)) + ' · ' + esc(price(s.price)) + '</span></a>' +
          '<span class="hx-g_sub">' + esc(cap(wdShort(s.iso))) + ' ' + esc(hour(s.iso)) + (seatsText(s.seats) ? ' · ' + esc(seatsText(s.seats)) : '') + '</span></li>';
      }).join('');
    }
    var t = q('[data-g-talleres]', el), c = q('[data-g-cenas]', el), cw = q('[data-g-cenas-wrap]', el);
    if (t) t.innerHTML = rows(groups.talleres);
    if (c) c.innerHTML = rows(groups.cenas);
    if (cw) cw.hidden = !groups.cenas.length;
  }

  /* ---- H. Cuenta atrás ---- */
  function renderH(el, list) {
    var s = list[0]; if (!s) return;
    var d = daysUntil(s.iso);
    var big = d <= 0 ? 'Hoy' : d === 1 ? 'Mañana' : d;
    var unit = d > 1 ? 'días' : '';
    var img = q('[data-h-photo]', el); if (img) { img.src = s.image; }
    var body = q('[data-h-body]', el);
    if (body) body.innerHTML =
      '<p class="hx-eyebrow f-text-label">El próximo taller empieza en</p>' +
      '<p class="hx-h_count" aria-label="' + (d > 1 ? 'Faltan ' + d + ' días' : esc(String(big))) + '"><span>' + esc(String(big)) + '</span>' + (unit ? '<small>' + unit + '</small>' : '') + '</p>' +
      '<h2 class="hx-h_name f-text-h2 f-text-uppercase">' + esc(s.name) + '</h2>' +
      '<p class="hx-h_when f-text-lead">' + esc(longDate(s.iso)) + ' · ' + esc(hour(s.iso)) + ' · ' + esc(price(s.price)) + '</p>' +
      '<div class="hx-h_row">' + seatsChip(s) + '</div>' +
      '<div class="hx-ctas"><a ' + bookAttrs(s) + ' class="button w-button f-text-label f-text-ui-lg">' + (full(s) ? 'Ver otras fechas' : 'Reservar plaza') + '</a>' +
      '<a href="' + detailHref(s) + '" class="button is-secondary w-button f-text-label f-text-ui-lg">Qué se cocina</a></div>';
    var rest = q('[data-h-rest]', el);
    if (rest) rest.innerHTML = list.slice(1, 4).map(function (x) {
      return '<li><a ' + bookAttrs(x) + ' class="hx-h_pill"><b>' + esc(dayNum(x.iso) + ' ' + monShort(x.iso)) + '</b> ' + esc(x.name) + '</a></li>';
    }).join('') + '<li><a href="#calendario" data-modal-open="modal-1" class="hx-h_pill is-all">Todo el calendario →</a></li>';
  }

  /* ---- I. Orden / caos ---- */
  function renderI(el, list) {
    var box = q('[data-i-list]', el); if (!box) return;
    box.innerHTML = list.slice(0, 5).map(function (s, i) {
      return '<li><a class="hx-i_row" ' + bookAttrs(s) + '>' +
        '<span class="hx-i_n" aria-hidden="true">' + ('0' + (i + 1)).slice(-2) + '</span>' +
        '<span class="hx-i_date">' + esc(dayNum(s.iso)) + '<small>' + esc(monShort(s.iso)) + '</small></span>' +
        '<span class="hx-i_name">' + esc(s.name) + '<small>' + esc(cap(wdShort(s.iso))) + ' ' + esc(hour(s.iso)) + ' · ' + esc(price(s.price)) + '</small></span>' +
        '<span class="hx-i_go" aria-hidden="true">Reservar →</span></a></li>';
    }).join('');
  }

  /* ---- J. Cartelera ---- */
  function renderJ(el, list) {
    var box = q('[data-j-posters]', el); if (!box) return;
    box.innerHTML = list.slice(0, 4).map(function (s) {
      return '<li class="hx-j_poster">' +
        '<img src="' + esc(s.image) + '" alt="" loading="lazy">' +
        '<div class="hx-j_stamp" aria-hidden="true"><b>' + esc(dayNum(s.iso)) + '</b><span>' + esc(monShort(s.iso)) + '</span></div>' +
        '<div class="hx-j_info"><h3 class="hx-j_name f-text-h4 f-text-uppercase">' + esc(s.name) + '</h3>' +
        '<p class="hx-j_meta">' + esc(longDate(s.iso)) + ' · ' + esc(hour(s.iso)) + '</p>' +
        '<p class="hx-j_meta2"><span class="hx-j_price">' + esc(price(s.price)) + '</span>' + seatsChip(s) + '</p>' +
        '<a ' + bookAttrs(s) + ' class="button w-button f-text-label f-text-ui-md hx-j_cta">' + (full(s) ? 'Ver otras fechas' : 'Reservar') + '<span class="f-sr-only"> ' + esc(s.name) + '</span></a></div></li>';
    }).join('');
  }

  /* ---- K. Una pregunta ---- */
  var kList = [];
  function renderK(el, list) {
    kList = list;
    var picked = el.getAttribute('data-k-picked');
    if (picked) showK(el, picked);
  }
  function showK(el, which) {
    var now = Date.now();
    var res = kList.filter(function (s) {
      var d = daysUntil(s.iso);
      if (which === 'semana') return d <= 7;
      if (which === 'mes') return d <= 31;
      return true;
    });
    var out = q('[data-k-out]', el); if (!out) return;
    var label = which === 'semana' ? 'esta semana' : which === 'mes' ? 'este mes' : 'en las próximas fechas';
    out.innerHTML = res.length
      ? '<p class="hx-k_count f-text-lead">' + res.length + (res.length === 1 ? ' taller ' : ' talleres ') + esc(label) + ':</p><ul class="hx-k_list" role="list">' +
        res.slice(0, 4).map(function (s) {
          return '<li><span class="hx-k_date"><b>' + esc(dayNum(s.iso)) + '</b> ' + esc(monShort(s.iso)) + '</span><span class="hx-k_name">' + esc(s.name) +
            '<small>' + esc(cap(wdShort(s.iso))) + ' ' + esc(hour(s.iso)) + ' · ' + esc(price(s.price)) + (seatsText(s.seats) ? ' · ' + esc(seatsText(s.seats)) : '') + '</small></span>' +
            '<a ' + bookAttrs(s) + ' class="button w-button f-text-label f-text-ui-md">' + (full(s) ? 'Otras fechas' : 'Reservar') + '<span class="f-sr-only"> ' + esc(s.name) + '</span></a></li>';
        }).join('') + '</ul>'
      : '<p class="hx-k_count f-text-lead">No hay talleres ' + esc(label) + '. <a href="#calendario" data-modal-open="modal-1">Mira el calendario completo</a>.</p>';
    el.setAttribute('data-k-picked', which);
    Array.prototype.forEach.call(el.querySelectorAll('[data-k-pick]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k-pick') === which)); });
    if (window.PEMotion && PEMotion.buttonFx) { try { PEMotion.buttonFx(out); } catch (e) {} }
  }
  function wireK() {
    var el = q('[data-hx="k"]'); if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k-pick]'); if (!b) return;
      e.preventDefault(); showK(el, b.getAttribute('data-k-pick'));
      var out = q('[data-k-out]', el); if (out) out.focus({ preventScroll: true });
    });
  }

  var RENDER = { f: renderF, g: renderG, h: renderH, i: renderI, j: renderJ, k: renderK };
  function renderAll(list) {
    Object.keys(RENDER).forEach(function (k) {
      var el = q('[data-hx="' + k + '"]');
      if (el) { try { RENDER[k](el, list); } catch (e) { if (window.console) console.warn('hero-options-2 ' + k, e); } }
    });
    if (window.PEMotion && PEMotion.buttonFx) { try { PEMotion.buttonFx(q('.hx')); } catch (e) {} }
  }
  function setStatus(state, text) {
    var el = q('[data-hx-status]');
    if (el) { el.setAttribute('data-state', state); el.textContent = text; }
  }
  function start() {
    wireK();
    renderAll(fromSnapshot());
    setStatus('loading', 'Cargando fechas en directo…');
    fromApi().then(function (rows) {
      rows.forEach(function (r) {
        var rec = window.PE_CMS && PE_CMS.find && PE_CMS.find(r.coleccion === 'cenas' ? 'cenas' : 'talleres', r.slug);
        if (rec) { if (r.seats !== null && r.seats !== undefined) rec.seatsLeft = r.seats; if (r.price !== null) rec.precio = r.price; }
      });
      renderAll(rows);
      setStatus('live', 'Fechas en directo de la plataforma (' + rows.length + ' próximas)');
    }, function () { setStatus('fallback', 'Sin conexión con la plataforma: fechas de la última sincronización'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

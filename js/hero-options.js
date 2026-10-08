/* =============================================================
   HERO OPTIONS — data + render for src/pages/hero-options.html
   (review page, 7 Oct 2026). Not used by any other page.

   Data: the live Entropical API (the same one webflow-cart.js and
   tools/sync-entropical.js use):
     GET https://presunta.ntropical.com/api/items            list
     GET https://presunta.ntropical.com/api/items/:id/seat-status
   Upcoming = published, active, not archived/test, sessionDate in the
   future, sorted by date. If the list fetch fails or times out, the
   static snapshot window.PE_EXPERIENCIAS (src/data/pe-experiencias.js)
   is used instead.

   Actions: every "Reservar" / "Ver calendario" is a
   [data-modal-open="modal-1"] opener, so it opens the site's booking
   calendar modal (copied from index.html); data-booking-item narrows
   it to one workshop when that workshop is in window.PE_CMS.
   ============================================================= */
(function () {
  'use strict';

  var API = 'https://presunta.ntropical.com';
  var COLLECTION = { workshop: 'talleres', experience: 'talleres', dinner: 'cenas', team_building: 'team-building' };
  var IMG = 'assets/images/home-2026-10/';
  // workshops without a platform photo get a site photo (pasta gets the pasta one)
  var PHOTO_BY_SLUG = { 'pasta-fresca-di-cuore': 'pasta-close-up-800.webp' };
  var PHOTO_ROTATION = ['instructor-clase-cocina-800.webp', 'grupo-amigos-cocina-800.webp', 'pareja-curso-cocina-madrid-800.webp', 'foto-trasera-delantal-curso-800.webp'];
  var TZ = 'Europe/Madrid';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso, o) {
    try { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: TZ }, o)).format(new Date(iso)); } catch (e) { return ''; }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function dayKey(iso) { return fmt(iso, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-'); }
  function when(iso) { return cap(fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })) + ' · ' + fmt(iso, { hour: '2-digit', minute: '2-digit' }); }
  function shortDate(iso) { return fmt(iso, { day: 'numeric', month: 'short' }).replace('.', ''); }
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
  function seatsClass(n) { return n === null || n === undefined ? '' : n <= 0 ? ' is-full' : n <= 5 ? ' is-low' : ''; }

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
        return { id: x.entropicalId, slug: x.slug, name: x.name, coleccion: x.coleccion || 'talleres', iso: x.sessionDate, price: x.priceEuros,
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
          return { id: d.id, slug: d.slug, name: d.name, coleccion: COLLECTION[d.category] || 'talleres', iso: d.sessionDate,
            price: typeof d.priceCurrentCents === 'number' ? d.priceCurrentCents / 100 : null, seats: seats,
            minutes: d.durationMinutes, image: d.heroImageUrl || '', summary: d.shortDescription || '' };
        });
      }));
    }).then(function (rows) {
      rows.forEach(function (r, i) { r.image = photoFor(r.slug, r.image, i); });
      return rows;
    });
  }

  /* ---- shared bits ---- */
  function inCms(s) {
    var db = window.PE_CMS;
    return !!(db && db.find && db.find(s.coleccion === 'cenas' ? 'cenas' : 'talleres', s.slug));
  }
  function bookAttrs(s) {
    return 'href="#calendario" data-modal-open="modal-1"' + (s && inCms(s) ? ' data-booking-item="' + esc(s.slug) + '"' : '');
  }
  function detailHref(s) { return s.coleccion === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + encodeURIComponent(s.slug); }
  function seatsSpan(s, extra) {
    var t = seatsText(s.seats);
    return t ? '<span class="hero-opt_seats' + seatsClass(s.seats) + (extra ? ' ' + extra : '') + '">' + esc(t) + '</span>' : '';
  }
  function bookLabel(s, label) { return s.seats !== null && s.seats !== undefined && s.seats <= 0 ? 'Ver otras fechas' : label; }
  function sr(text) { return '<span class="f-sr-only">' + esc(text) + '</span>'; }

  /* ---- A. next workshop spotlight ---- */
  function renderA(el, list) {
    var s = list[0];
    if (!s) {
      el.querySelector('[data-a-body]').innerHTML = '<p class="hero-opt_empty f-text-lead">Estamos preparando nuevas fechas.</p>';
      return;
    }
    var img = el.querySelector('[data-a-photo]');
    img.src = s.image; img.alt = 'Taller ' + s.name;
    el.querySelector('[data-a-tag]').textContent = shortDate(s.iso) + ' · ' + s.name;
    var facts = '';
    facts += '<div><dt class="f-text-small">Plazas</dt><dd class="f-text-h5">' + (seatsSpan(s) || '—') + '</dd></div>';
    facts += '<div><dt class="f-text-small">Precio</dt><dd class="f-text-h5">' + esc(price(s.price) || '—') + '</dd></div>';
    facts += '<div><dt class="f-text-small">Duración</dt><dd class="f-text-h5">' + esc(duracion(s.minutes) || '—') + '</dd></div>';
    el.querySelector('[data-a-body]').innerHTML =
      '<p class="hero-opt_eyebrow f-text-eyebrow">Próximo taller</p>' +
      '<h2 class="hero-opt_title f-text-display f-text-uppercase">' + esc(s.name) + '</h2>' +
      '<p class="hero-opt_a-when f-text-h4">' + esc(when(s.iso)) + '</p>' +
      (s.summary ? '<p class="hero-opt_lede f-text-body">' + esc(s.summary) + '</p>' : '') +
      '<dl class="hero-opt_facts">' + facts + '</dl>';
    el.querySelector('[data-a-ctas]').innerHTML =
      '<a ' + bookAttrs(s) + ' class="button hero_cta w-button f-text-label f-text-ui-lg">' + esc(bookLabel(s, 'Reservar plaza')) + '</a>' +
      '<a href="' + detailHref(s) + '" class="button is-secondary hero_cta w-button f-text-label f-text-ui-lg">Ver el taller' + sr(': ' + s.name) + '</a>';
  }

  /* ---- B. calendar first ---- */
  function renderB(el, list) {
    var box = el.querySelector('[data-b-list]');
    var rows = list.slice(0, 4);
    if (!rows.length) { box.innerHTML = '<li class="hero-opt_row"><p class="hero-opt_empty f-text-lead">Estamos preparando nuevas fechas.</p></li>'; return; }
    box.innerHTML = rows.map(function (s) {
      var meta = [fmt(s.iso, { hour: '2-digit', minute: '2-digit' }) + ' h', duracion(s.minutes)].filter(Boolean).join(' · ');
      return '<li class="hero-opt_row">' +
        '<div class="hero-opt_date" aria-hidden="true"><span class="hero-opt_date-day f-text-h3">' + esc(fmt(s.iso, { day: 'numeric' })) + '</span>' +
        '<span class="f-text-tiny f-text-uppercase">' + esc(fmt(s.iso, { month: 'short' }).replace('.', '')) + ' · ' + esc(fmt(s.iso, { weekday: 'short' }).replace('.', '')) + '</span></div>' +
        '<div class="hero-opt_row-info"><h3 class="hero-opt_row-name f-text-h5"><a href="' + detailHref(s) + '">' + esc(s.name) + '</a></h3>' +
        '<p class="hero-opt_row-meta f-text-small">' + sr(when(s.iso) + '. ') + esc(meta) + (seatsText(s.seats) ? ' · ' : '') + seatsSpan(s) + '</p></div>' +
        '<div class="hero-opt_row-price f-text-h5">' + esc(price(s.price)) + '</div>' +
        '<a ' + bookAttrs(s) + ' class="button is-small w-button f-text-label">' + esc(bookLabel(s, 'Reservar')) + sr(' ' + s.name + ', ' + shortDate(s.iso)) + '</a>' +
        '</li>';
    }).join('');
  }

  /* ---- C. phones: next date line in place of the console ---- */
  function renderC(el, list) {
    var s = list[0], p = el.querySelector('[data-c-next]');
    if (!p) return;
    p.innerHTML = s ? 'Próximo: <a href="' + detailHref(s) + '">' + esc(s.name) + '</a>, ' + esc(when(s.iso).toLowerCase()) + (seatsText(s.seats) ? '. ' + seatsSpan(s) : '') : '';
  }

  /* ---- D. collage + cards ---- */
  function renderD(el, list) {
    var box = el.querySelector('[data-d-list]');
    var rows = list.slice(0, 3);
    if (!rows.length) { box.innerHTML = '<li><p class="hero-opt_empty f-text-lead">Estamos preparando nuevas fechas.</p></li>'; return; }
    box.innerHTML = rows.map(function (s) {
      return '<li class="hero-opt_card">' +
        '<div class="hero-opt_card-thumb"><img src="' + esc(s.image) + '" alt="" loading="lazy"></div>' +
        '<div><h3 class="f-text-h6 f-text-uppercase"><a ' + bookAttrs(s) + '>' + esc(s.name) + sr(': reservar') + '</a></h3>' +
        '<p class="hero-opt_row-meta f-text-small">' + esc(when(s.iso)) + (seatsText(s.seats) ? ' · ' : '') + seatsSpan(s) + '</p></div>' +
        '<div class="hero-opt_card-price f-text-h5">' + esc(price(s.price)) + '</div>' +
        '</li>';
    }).join('');
  }

  /* ---- E. wall calendar ---- */
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DOW_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  function renderE(el, list) {
    var box = el.querySelector('[data-e-months]'), legend = el.querySelector('[data-e-legend]');
    var byDay = {};
    list.forEach(function (s) { var k = dayKey(s.iso); (byDay[k] = byDay[k] || []).push(s); });
    var today = dayKey(new Date().toISOString());
    var start = today.slice(0, 7);
    var months = [start];
    // the month of the second upcoming session (or next month) as the second sheet
    var next = list.length ? dayKey(list[list.length > 1 ? 1 : 0].iso).slice(0, 7) : null;
    var ym = start.split('-').map(Number);
    var follow = ym[1] === 12 ? (ym[0] + 1) + '-01' : ym[0] + '-' + String(ym[1] + 1).padStart(2, '0');
    months.push(next && next > start ? next : follow);
    box.innerHTML = months.map(function (m) {
      var p = m.split('-').map(Number), y = p[0], mo = p[1];
      var first = new Date(Date.UTC(y, mo - 1, 1, 12));
      var title = cap(new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first));
      var lead = (first.getUTCDay() + 6) % 7;
      var days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      var cells = DOW.map(function (d, i) { return '<li class="is-dow f-text-tiny" aria-hidden="true"><abbr title="' + DOW_LONG[i] + '">' + d + '</abbr></li>'; }).join('');
      for (var i = 0; i < lead; i++) cells += '<li aria-hidden="true"></li>';
      for (var d = 1; d <= days; d++) {
        var key = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var hit = byDay[key];
        if (hit) {
          var s = hit[0];
          cells += '<li><a ' + bookAttrs(s) + ' class="hero-opt_day f-text-small" aria-label="' + esc(d + ' de ' + fmt(s.iso, { month: 'long' }) + ': ' + hit.map(function (h) { return h.name; }).join(' y ') + '. Reservar') + '">' + d + '</a></li>';
        } else {
          cells += '<li><span class="hero-opt_day f-text-small' + (key < today ? ' is-past' : '') + '">' + d + '</span></li>';
        }
      }
      return '<div class="hero-opt_month"><h3 class="f-text-h5 f-text-uppercase">' + esc(title) + '</h3><ul class="hero-opt_grid" role="list">' + cells + '</ul></div>';
    }).join('');
    legend.innerHTML = list.slice(0, 4).map(function (s) {
      return '<li class="f-text-small"><span class="hero-opt_legend-date">' + esc(shortDate(s.iso)) + '</span><span>' + esc(s.name) + (s.price !== null ? ' · ' + esc(price(s.price)) : '') + '</span></li>';
    }).join('');
  }

  var RENDER = { a: renderA, b: renderB, c: renderC, d: renderD, e: renderE };
  function renderAll(list) {
    Object.keys(RENDER).forEach(function (k) {
      var el = document.querySelector('[data-hero-opt="' + k + '"]');
      if (el) { try { RENDER[k](el, list); } catch (e) { if (window.console) console.warn('hero-options ' + k, e); } }
    });
    // the site's button hovers (pe-motion.js) for the buttons just rendered
    if (window.PEMotion && PEMotion.buttonFx) { try { PEMotion.buttonFx(document.querySelector('.hero-opt')); } catch (e) {} }
  }
  function setStatus(state, text) {
    var el = document.querySelector('[data-hero-opt-status]');
    if (el) { el.setAttribute('data-state', state); el.textContent = text; }
  }

  /* Option C: the PE-83 console opens straight on FECHAS once it has booted */
  function consoleToFechas() {
    var host = document.querySelector('.hero-opt [data-pe-console]');
    if (!host) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var root = host.shadowRoot || host;
      var led = root.querySelector('[data-pe-led]');
      if (window.PEConsole && led && led.classList.contains('is-on')) {
        clearInterval(t);
        try { window.PEConsole.open('fechas'); } catch (e) {}
      } else if (tries > 120) clearInterval(t);
    }, 250);
  }

  function start() {
    var snap = fromSnapshot();
    renderAll(snap);
    setStatus('loading', 'Cargando fechas en directo…');
    fromApi().then(function (rows) {
      // live seats/price into the snapshot records the console (FECHAS) reads
      rows.forEach(function (r) {
        var rec = window.PE_CMS && PE_CMS.find && PE_CMS.find(r.coleccion === 'cenas' ? 'cenas' : 'talleres', r.slug);
        if (rec) { if (r.seats !== null && r.seats !== undefined) rec.seatsLeft = r.seats; if (r.price !== null) rec.precio = r.price; }
      });
      renderAll(rows);
      setStatus('live', 'Fechas en directo de la plataforma (' + rows.length + ' próximas)');
    }, function () {
      setStatus('fallback', 'Sin conexión con la plataforma: fechas de la última sincronización');
    });
    consoleToFechas();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

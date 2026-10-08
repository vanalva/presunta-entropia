/* ============================================================
   PRESUNTA ENTROPÍA — Explorador (site-fixes 2026-10-08)
   One explorer for every place the site lists experiences:
     · home #calendario ............ light, opens on the Experiencias tab
     · todos-nuestros-talleres ..... light, opens on the Experiencias tab
     · booking overlay #modal-1 .... dark, opens on the Calendario tab
   Mount: <div data-pe-explorer data-mode="light|dark"
                data-tab="calendario|experiencias" data-title="…" data-lead="…">
   Same filter bar, tags, empty state and motion everywhere; two tabs:
     Calendario    a real calendar (Mes / Semana / Día) of the dated sessions;
                   a day opens inline with its sessions and a direct Reservar.
     Experiencias  the workshop cards (pe-tcard), 1–4 columns.
   The packs card sits in both tabs.
   In the page, nothing opens an overlay: Reservar puts the session in the
   cart (js/pe-booking-flow.js, [data-pe-add]) and a day shows inline. The
   overlay only opens from the rest of the site, through the existing contract
   [data-modal-open="modal-1"] (+ data-booking-item="<slug>" to narrow it).
   Data: window.PE_CMS (data/pe-cms.js, from the platform sync).
   Styles: css/pe-explorer.css (embed) + the LIST CONTROLS classes (pe-lc_*).
   ============================================================ */
(function () {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DIAS_C = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var TYPES = [['talleres', 'Talleres'], ['cenas', "Chef's Table"], ['team-building', 'Team Building']];
  var SORTS = [['', 'Ordenar'], ['fecha-asc', 'Fecha: próximas primero'], ['fecha-desc', 'Fecha: más lejanas primero'],
    ['price-asc', 'Precio: de menor a mayor'], ['price-desc', 'Precio: de mayor a menor'], ['name-asc', 'Nombre: A-Z']];
  var COLS_KEY = 'pe-xp-cols';
  var COMPACT_KEY = 'pe-xp-compact';
  var AVAIL = [['', 'Disponibilidad'], ['plazas', 'Con plazas'], ['pocas', 'Últimas plazas'], ['promo', 'En promoción']];
  var DEBOUNCE = 280;
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function attr(el, map) { for (var k in map) if (map[k] != null && map[k] !== false) el.setAttribute(k, map[k] === true ? '' : map[k]); return el; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); var wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function madrid(iso, o) { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: 'Europe/Madrid' }, o)).format(new Date(iso)); }
  function seatsText(n) { return n === null || n === undefined ? '' : n <= 0 ? 'Completo' : n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas'; }
  function itemHref(it) { return it.coleccion === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + encodeURIComponent(it.slug); }
  function getCols() { try { var v = parseInt(localStorage.getItem(COLS_KEY), 10); return v >= 1 && v <= 4 ? v : 3; } catch (e) { return 3; } }
  function getCompact() { try { return localStorage.getItem(COMPACT_KEY) === '1'; } catch (e) { return false; } }
  function setCompact(v) { try { localStorage.setItem(COMPACT_KEY, v ? '1' : '0'); } catch (e) { /* private mode */ } }
  function setCols(v) { try { localStorage.setItem(COLS_KEY, String(v)); } catch (e) { /* private mode */ } }

  // ---------- data ----------
  // Sessions come from PE_CMS.sesionesAll (data/pe-cms.js): past and cancelled ones are
  // kept and flagged, and each carries its own seats, price and promo.
  var LOW_SEATS = 3;   // "Últimas plazas" from 1 to 3 (the old site's "Quedan pocos")
  function loadData() {
    var db = window.PE_CMS;
    if (!db || !db.talleres) return null;
    var items = [];
    db.talleres.forEach(function (t) { items.push(Object.assign({}, t, { coleccion: 'talleres' })); });
    (db.cenas || []).forEach(function (t) { items.push(Object.assign({}, t, { coleccion: 'cenas' })); });
    (db['team-building'] || []).forEach(function (t) { items.push(Object.assign({}, t, { coleccion: 'team-building' })); });
    var bySlug = {};
    items.forEach(function (it) { bySlug[it.slug] = it; it.sessions = []; });
    var sessions = [];
    (db.sesionesAll || db.sesiones || []).forEach(function (x) {
      var it = bySlug[x.item];
      if (!it) return;
      var ses = {
        iso: x.iso, day: x.fecha, itemId: x.itemId || it.entropicalId, item: it,
        seatsLeft: typeof x.seatsLeft === 'number' ? x.seatsLeft : it.seatsLeft,
        capacity: x.capacity || it.capacityTotal || null,
        precio: typeof x.precio === 'number' ? x.precio : it.precio,
        precioOriginal: x.precioOriginal || null,
        past: x.past === undefined ? new Date(x.iso) < new Date() : !!x.past,
        cancelled: !!x.cancelled,
        test: !!x.test
      };
      it.sessions.push(ses);
      sessions.push(ses);
    });
    sessions.sort(function (a, b) { return a.iso < b.iso ? -1 : 1; });
    items.forEach(function (it) {
      it.sessions.sort(function (a, b) { return a.iso < b.iso ? -1 : 1; });
      it.upcoming = it.sessions.filter(function (x) { return !x.past && !x.cancelled; });
      // the date a card shows: the next one that can still be booked, else the next one, else the last past
      it.next = it.upcoming.filter(function (x) { return x.seatsLeft !== 0; })[0] || it.upcoming[0] || null;
      it.last = it.sessions.filter(function (x) { return x.past && !x.cancelled; }).pop() || null;
    });
    return { items: items, sessions: sessions, bySlug: bySlug };
  }
  // the state of one session (or of an experience without a date to show)
  function stateOf(ses) {
    if (!ses) return 'soon';
    if (ses.cancelled) return 'cancelled';
    if (ses.past) return 'past';
    if (ses.seatsLeft === 0) return 'full';
    if (ses.seatsLeft > 0 && ses.seatsLeft <= LOW_SEATS) return 'low';
    return 'open';
  }
  function promoPct(ses) {
    return ses && ses.precioOriginal && typeof ses.precio === 'number' ? Math.round((1 - ses.precio / ses.precioOriginal) * 100) : 0;
  }
  function euro(n) { return typeof n === 'number' ? (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €' : '—'; }

  // ---------- the cards (one builder: the explorer, "Otros talleres", profiles) ----------
  // Under the summary the body is two columns:
  //   left   Precio + Reservar / Más info (full-size buttons, stacked)
  //   right  Plazas as the ficha's seat meter + the experience's facts as pills
  var METER_MAX = 16;
  function btnCls(dark, primary) {
    return (primary ? (dark ? 'button' : 'button is-alternate') : (dark ? 'button is-secondary is-alternate' : 'button is-secondary')) +
      ' pe-tcard_cta w-button f-text-label';
  }
  function reservarBtn(ses, dark) {
    var d = parseKey(ses.day);
    return attr(h('a', btnCls(dark, true), 'Reservar'), {
      href: '#', 'data-pe-add': true, 'data-item-id': ses.itemId, 'data-booking-item': ses.item.slug, 'data-ep-role': 'primary',
      'aria-label': 'Reservar ' + ses.item.name + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]
    });
  }
  // the ficha's seat meter (js/pe-talleres-ficha.js, .pe-ficha_seats), scaled to the room
  function meter(left, total) {
    var wrap = h('span', 'pe-ficha_seats pe-tcard_seats is-' + (left <= 0 ? 'full' : left <= 5 ? 'low' : 'ok'));
    var segs = Math.max(1, Math.min(METER_MAX, total || METER_MAX));
    var on = total ? Math.round(Math.max(0, Math.min(left, total)) / total * segs) : Math.min(left, segs);
    if (left > 0 && on === 0) on = 1;
    var m = attr(h('span', 'pe-ficha_meter'), { 'aria-hidden': 'true' });
    for (var i = 0; i < segs; i++) m.appendChild(h('span', 'pe-ficha_seg' + (i < on ? ' is-on' : '')));
    wrap.appendChild(m);
    wrap.appendChild(h('span', 'pe-ficha_seats-text f-text-small', seatsText(left)));
    return wrap;
  }
  function pills(list) {
    var ul = h('ul', 'pe-tcard_pills');
    list.filter(Boolean).forEach(function (p) {
      if (typeof p === 'string') { ul.appendChild(h('li', 'tag pe-tcard_pill f-text-small', p)); return; }
      var li = h('li', 'pe-tcard_pill-item'); li.appendChild(p); ul.appendChild(li);
    });
    return ul;
  }
  function fact(label, value, cls) {
    var c = h('div', 'pe-tcard_fact' + (cls ? ' ' + cls : ''));
    c.appendChild(h('div', 'pe-tcard_fact-label f-text-small', label));
    if (value != null) c.appendChild(typeof value === 'string' ? h('div', 'pe-tcard_fact-value f-text-h6', value) : value);
    return c;
  }
  function facts(L, R) { var f = h('div', 'pe-tcard_facts'); f.appendChild(L); f.appendChild(R); return f; }
  // a narrow card (4 across, a slider slide, a phone) stacks its lower half: measured per card,
  // because the same card sits in grids, sliders and the hover card at any width
  var NARROW = 360;
  var narrowRO = window.ResizeObserver ? new ResizeObserver(function (list) {
    list.forEach(function (e) { e.target.classList.toggle('is-narrow', e.contentRect.width < NARROW); });
  }) : null;
  function shell(dark, extra) {
    var c = h('article', 'talleres_card pe-tcard' + (dark ? ' is-dark' : '') + (extra || ''));
    if (narrowRO) narrowRO.observe(c);
    return c;
  }

  // who teaches it (platform instructors: chefs, special guests): a small round photo and
  // the name, each linked to the profile (persona.html?slug=). Two shown, the rest as "+N".
  function peopleRow(it) {
    var list = (it.instructors || []).filter(function (p) { return p && p.name; });
    if (!list.length) return null;
    var row = h('div', 'pe-tcard_people');
    list.slice(0, 2).forEach(function (p) {
      var a = attr(h('a', 'pe-tcard_person'), { href: p.slug ? 'persona.html?slug=' + encodeURIComponent(p.slug) : itemHref(it), 'aria-label': 'Perfil de ' + p.name + (p.role ? ', ' + p.role : '') });
      var ph = attr(h('img', 'pe-tcard_person-img'), { alt: '', loading: 'lazy' });
      if (window.PE_CMS && window.PE_CMS.setImage) window.PE_CMS.setImage(ph, p.photoUrl || p.image, ''); else ph.src = p.photoUrl || '';
      a.appendChild(ph);
      var tx = h('span', 'pe-tcard_person-txt');
      tx.appendChild(h('span', 'pe-tcard_person-name f-text-small', p.name));
      if (p.role || p.rol) tx.appendChild(h('span', 'pe-tcard_person-role f-text-tiny', p.role || p.rol));
      a.appendChild(tx);
      row.appendChild(a);
    });
    if (list.length > 2) row.appendChild(h('span', 'pe-tcard_person-more f-text-small', '+' + (list.length - 2)));
    return row;
  }
  var STATE_FLAG = { cancelled: 'Cancelada', past: 'Finalizado', full: 'Completo', low: 'Últimas plazas' };
  // "Ver fechas": the calendar narrowed to this experience (inside an Explorador: its own
  // Calendario tab; anywhere else: the booking overlay)
  // the date pill and the "+N fechas" pill are the calendar buttons: a click shows this
  // experience's dates in the calendar (the calendar icon says it opens something)
  var CAL_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.4"/></svg>';
  function datesPill(it, text, withIcon) {
    var b = attr(h('button', 'tag pe-tcard_pill is-dates f-text-small'), {
      type: 'button', 'data-pe-dates': it.slug, title: 'Ver en el calendario',
      'aria-label': text + ': ver las fechas de ' + it.name + ' en el calendario'
    });
    if (withIcon) b.insertAdjacentHTML('afterbegin', CAL_SVG);
    b.appendChild(h('span', '', text));
    return b;
  }
  function card(it, opts) {
    var ses = (opts && opts.ses) || it.next || (it.upcoming && it.upcoming[0]) || it.last || null;
    var st = stateOf(ses);
    var pct = st === 'open' || st === 'low' ? promoPct(ses) : 0;
    // a past experience turns dark (the site's dark card); on the dark overlay it dims instead
    var dark = !!(opts && opts.dark) || st === 'past';
    var boxed = !!(opts && opts.boxed) || (st === 'past' && !(opts && opts.dark));
    // compact (the hover card): square photo left, the essentials right; no summary, level or duration
    var compact = !!(opts && opts.compact);
    var c = shell(dark, ' is-' + st + (pct ? ' is-promo' : '') + (it.featured ? ' is-featured' : '') + (boxed ? ' is-boxed' : '') + (compact ? ' is-compact' : ''));
    c.setAttribute('data-pe-card-href', itemHref(it));
    c.setAttribute('data-pe-state', st);
    var media = h('div', 'pe-tcard_media');
    var img = attr(h('img', 'pe-tcard_image'), { loading: 'lazy', alt: it.name });
    if (window.PE_CMS && window.PE_CMS.setImage) window.PE_CMS.setImage(img, it.image, it.name); else img.src = it.image;
    media.appendChild(img);
    var badge = h('div', 'pe-tcard_date' + (ses ? '' : ' is-soon'));
    if (ses) {
      var d = parseKey(ses.day);
      badge.setAttribute('aria-label', DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]);
      badge.appendChild(h('span', 'pe-tcard_date-day f-text-h3', String(d.getDate())));
      badge.appendChild(h('span', 'pe-tcard_date-month f-text-label f-text-ui-sm', MESES_C[d.getMonth()]));
    } else badge.appendChild(h('span', 'pe-tcard_date-month f-text-label f-text-ui-sm', 'Próximamente'));
    media.appendChild(badge);
    // flags, top right: the state, the promo, featured
    var flags = h('div', 'pe-tcard_flags');
    if (STATE_FLAG[st]) flags.appendChild(h('span', 'pe-tcard_flag is-' + st + ' f-text-label f-text-ui-sm', STATE_FLAG[st]));
    if (pct) flags.appendChild(h('span', 'pe-tcard_flag is-promo f-text-label f-text-ui-sm', 'Promo −' + pct + '%'));
    if (it.featured && flags.children.length < 2) flags.appendChild(h('span', 'pe-tcard_flag is-featured f-text-label f-text-ui-sm', 'Destacado'));
    if (flags.children.length) media.appendChild(flags);
    c.appendChild(media);

    var body = h('div', 'pe-tcard_body');
    if (it.tipo) body.appendChild(h('div', 'pe-tcard_meta f-text-label f-text-ui-sm', it.tipo));
    var t = h('h3', 'pe-tcard_title f-text-h4');
    var a = h('a', 'pe-tcard_link', it.name); a.href = itemHref(it);
    t.appendChild(a); body.appendChild(t);
    var ppl = peopleRow(it);
    if (ppl) body.appendChild(ppl);
    if (it.summary && !compact) body.appendChild(h('p', 'pe-tcard_text f-text-body', it.summary));

    var price = ses && typeof ses.precio === 'number' ? ses.precio : it.precio;
    var priceEl = h('div', 'pe-tcard_fact-value pe-tcard_price f-text-h6');
    if (pct) { priceEl.appendChild(h('s', 'pe-tcard_price-was', euro(ses.precioOriginal))); priceEl.appendChild(document.createTextNode(' ')); }
    priceEl.appendChild(h('span', 'pe-tcard_price-now', euro(price)));
    var L = fact('Precio', priceEl);
    var ctas = h('div', 'pe-tcard_ctas');
    if (ses && (st === 'open' || st === 'low')) ctas.appendChild(reservarBtn(ses, dark));
    ctas.appendChild(attr(h('a', btnCls(dark, false), 'Más info'), { href: itemHref(it), 'data-ep-role': 'secondary', 'aria-label': 'Más información sobre ' + it.name }));
    L.appendChild(ctas);

    var seatsVal;
    if (st === 'past') seatsVal = h('div', 'pe-tcard_fact-value f-text-h6', 'Finalizado');
    else if (st === 'cancelled') seatsVal = h('div', 'pe-tcard_fact-value f-text-h6', 'Cancelada');
    else if (ses && typeof ses.seatsLeft === 'number') seatsVal = meter(ses.seatsLeft, ses.capacity || it.capacityTotal);
    else seatsVal = h('div', 'pe-tcard_fact-value f-text-h6', it.capacityTotal ? it.capacityTotal + ' plazas' : '—');
    var R = fact('Plazas', seatsVal, 'is-next');
    var others = it.upcoming ? it.upcoming.filter(function (x) { return x !== ses; }).length : 0;
    var dateTxt = ses ? cap(madrid(ses.iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')) + ' · ' + madrid(ses.iso, { hour: '2-digit', minute: '2-digit' }) : '';
    var canDates = !!(it.upcoming && it.upcoming.length) && !(opts && opts.noDates);
    R.appendChild(pills([
      dateTxt && canDates && st !== 'past' ? datesPill(it, dateTxt, true) : dateTxt,
      st === 'past' ? 'Próximamente' : '',
      compact ? '' : it.duracion,
      compact ? '' : (it.nivel ? 'Nivel ' + it.nivel.toLowerCase() : ''),
      others > 0 ? (canDates ? datesPill(it, '+' + others + (others === 1 ? ' fecha' : ' fechas'), false) : '+' + others + (others === 1 ? ' fecha' : ' fechas')) : ''
    ]));
    body.appendChild(facts(L, R));
    c.appendChild(body);
    return c;
  }

  // packs: pay now, pick the date later (copy and figures as js/pe-packs.js's list card)
  var PACK_BASE = ['Fecha cuando quieras', 'Para regalar'];
  function pack(opts) {
    var dark = !!(opts && opts.dark);
    var c = shell(dark, ' is-pack' + (opts && opts.wide ? ' is-wide' : ''));
    c.setAttribute('data-pe-card-href', 'packs.html');
    var media = h('div', 'pe-tcard_media');
    media.appendChild(attr(h('img', 'pe-tcard_image'), { loading: 'lazy', alt: '', src: 'assets/images/home-2026-10/grupo-amigos-cocina.webp' }));
    var badge = h('div', 'pe-tcard_date is-pack');
    badge.appendChild(h('span', 'pe-tcard_date-month f-text-label f-text-ui-sm', 'Pack'));
    media.appendChild(badge);
    c.appendChild(media);

    var body = h('div', 'pe-tcard_body');
    body.appendChild(h('div', 'pe-tcard_meta f-text-label f-text-ui-sm', 'Packs'));
    var t = h('h3', 'pe-tcard_title f-text-h4'); var a = h('a', 'pe-tcard_link', 'Paga hoy, elige fecha después'); a.href = 'packs.html'; t.appendChild(a); body.appendChild(t);
    body.appendChild(h('p', 'pe-tcard_text f-text-body', 'Compra un pack y reserva cuando quieras. También para regalar.'));
    var price = h('div', 'pe-tcard_fact-value f-text-h6', '—');
    var L = fact('Precio', price);
    var ctas = h('div', 'pe-tcard_ctas');
    ctas.appendChild(attr(h('a', btnCls(dark, true), 'Ver packs'), { href: 'packs.html', 'data-ep-role': 'primary' }));
    ctas.appendChild(attr(h('a', btnCls(dark, false), 'Regalar'), { href: 'packs.html#regalo', 'data-ep-role': 'secondary', 'aria-label': 'Regalar un pack' }));
    L.appendChild(ctas);
    var R = fact('Incluye', null, 'is-next');
    var list = pills(PACK_BASE);
    R.appendChild(list);
    body.appendChild(facts(L, R));
    c.appendChild(body);
    var E = window.EntropicalPacks;
    if (E && E.listTypes) E.listTypes().then(function (types) {
      types = (types || []).filter(function (x) { return x && !x.hidden; });
      function nums(k) { return types.map(function (x) { return x[k]; }).filter(function (v) { return typeof v === 'number' && v > 0; }); }
      var cents = nums('priceCents'), credits = nums('credits'), days = nums('validityDays');
      if (cents.length) {
        var min = Math.min.apply(null, cents);
        price.textContent = 'Desde ' + (min / 100).toLocaleString('es-ES', { minimumFractionDigits: min % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
      }
      var extra = [];
      if (credits.length) {
        var lo = Math.min.apply(null, credits), hi = Math.max.apply(null, credits);
        extra.push(lo === hi ? lo + (lo === 1 ? ' reserva' : ' reservas') : lo + '–' + hi + ' reservas');
      }
      if (days.length) extra.push('Válido ' + Math.max.apply(null, days) + ' días');
      var nl = pills(extra.concat(PACK_BASE));
      R.replaceChild(nl, list); list = nl;
    }, function () {});
    return c;
  }

  // ---------- the explorer ----------
  function Explorer(mount) {
    var data = loadData();
    if (!data) return null;
    var dark = mount.getAttribute('data-mode') === 'dark';
    var BTN_P = dark ? 'button' : 'button is-alternate';
    var BTN_S = dark ? 'button is-secondary is-alternate' : 'button is-secondary';
    var now = new Date();
    var state = {
      tab: mount.getAttribute('data-tab') === 'experiencias' ? 'experiencias' : 'calendario',
      q: '', month: '', sort: '', types: {}, item: '', avail: '',
      view: 'month', cursor: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), selected: '',
      cols: getCols(), compact: getCompact()
    };
    var uid = 'xp' + Math.random().toString(36).slice(2, 7);

    // ---- skeleton ----
    var root = h('div', 'pe-xp pe-lc' + (dark ? ' is-dark' : ''));   // pe-lc: the LIST CONTROLS sizes for every control
    var head = h('div', 'pe-xp_head');
    var headL = h('div', 'pe-xp_head-left');
    var title = mount.getAttribute('data-title');
    if (title) headL.appendChild(h('h2', 'pe-xp_title f-text-h1', title));
    var lead = mount.getAttribute('data-lead');
    if (lead) headL.appendChild(h('p', 'pe-xp_lead f-text-lead', lead));
    var headR = h('div', 'pe-xp_head-right');
    var tabs = attr(h('div', 'pe-xp_tabs'), { role: 'tablist', 'aria-label': 'Ver por' });
    var tabBtns = {};
    [['calendario', 'Calendario'], ['experiencias', 'Experiencias']].forEach(function (t) {
      var b = attr(h('button', 'pe-xp_tab f-text-label', t[1]), { type: 'button', role: 'tab', id: uid + '-tab-' + t[0], 'aria-controls': uid + '-panel-' + t[0] });
      b.addEventListener('click', function () { setTab(t[0]); });
      tabBtns[t[0]] = b;
      tabs.appendChild(b);
    });
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = state.tab === 'calendario' ? 'experiencias' : 'calendario';
      setTab(next); tabBtns[next].focus(); e.preventDefault();
    });
    var tags = attr(h('div', 'pe-xp_tags'), { 'aria-live': 'polite' });
    headR.appendChild(tabs); headR.appendChild(tags);
    head.appendChild(headL); head.appendChild(headR);

    // ---- filter bar (the home's: Buscar, Mes, Ordenar, types, Columnas) ----
    var bar = attr(h('form', 'pe-lc pe-xp_bar'), { role: 'search', 'aria-label': 'Filtrar experiencias' });
    var barRow = h('div', 'pe-lc_bar');
    var search = attr(h('input', 'pe-lc_control pe-lc_field pe-lc_search pe-xp_search'), { type: 'search', placeholder: 'Buscar talleres', 'aria-label': 'Buscar talleres', autocomplete: 'off' });
    var monthSel = makeSelect('Mes', [['', 'Mes']].concat(MESES.map(function (m, i) { return [String(i), cap(m)]; })), function (v) { state.month = v; if (v !== '') jumpToMonth(+v); refresh(); });
    var sortSel = makeSelect('Ordenar', SORTS, function (v) { state.sort = v; refresh(); });
    var availSel = makeSelect('Disponibilidad', AVAIL, function (v) { state.avail = v; refresh(); });
    var chips = h('div', 'pe-lc_chips pe-xp_chips');
    var chipBtns = {};
    TYPES.forEach(function (t) {
      var b = attr(h('button', 'pe-lc_control pe-lc_chip pe-xp_chip'), { type: 'button', 'aria-pressed': 'false' });
      b.appendChild(attr(h('span', 'pe-xp_box'), { 'aria-hidden': 'true' }));
      b.appendChild(h('span', 'f-text-label f-text-ui-sm', t[1]));
      b.addEventListener('click', function () { if (state.types[t[0]]) delete state.types[t[0]]; else state.types[t[0]] = true; refresh(); });
      chipBtns[t[0]] = b;
      chips.appendChild(b);
    });
    var colsWrap = h('label', 'pe-lc_control pe-lc_cols pe-xp_cols');
    var colsLabel = h('span', 'pe-lc_cols-label f-text-label f-text-ui-sm', 'Columnas ');
    var colsOut = h('output', 'pe-lc_cols-out', String(state.cols));
    colsLabel.appendChild(colsOut);
    var colsRange = attr(h('input', 'pe-lc_range'), { type: 'range', min: '1', max: '4', step: '1', value: String(state.cols), 'aria-label': 'Número de columnas' });
    colsRange.addEventListener('input', function () { state.cols = +colsRange.value; colsOut.textContent = colsRange.value; setCols(state.cols); applyCols(); });
    colsWrap.appendChild(colsLabel); colsWrap.appendChild(colsRange);
    barRow.appendChild(search); barRow.appendChild(monthSel.el); barRow.appendChild(sortSel.el); barRow.appendChild(availSel.el); barRow.appendChild(chips); barRow.appendChild(colsWrap);
    bar.appendChild(barRow);
    bar.addEventListener('submit', function (e) { e.preventDefault(); });
    var qT = 0;
    search.addEventListener('input', function () {
      // narrowed to one experience (Ver fechas): the field shows its name; touching it lifts that
      if (state.item) { state.item = ''; if (!search.value.trim()) { clearTimeout(qT); state.q = ''; refresh(); return; } }
      clearTimeout(qT);
      stage.classList.add('is-settling');
      qT = setTimeout(function () { state.q = search.value.trim(); refresh(); }, DEBOUNCE);
    });

    // ---- panels ----
    var stage = h('div', 'pe-xp_stage');
    var panelCal = attr(h('div', 'pe-xp_panel'), { role: 'tabpanel', id: uid + '-panel-calendario', 'aria-labelledby': uid + '-tab-calendario' });
    var panelExp = attr(h('div', 'pe-xp_panel'), { role: 'tabpanel', id: uid + '-panel-experiencias', 'aria-labelledby': uid + '-tab-experiencias' });
    var empty = h('div', 'pe-xp_empty');
    empty.appendChild(h('h3', 'f-text-h3 pe-state_title', 'No se han encontrado coincidencias con tu búsqueda'));
    empty.appendChild(h('p', 'pe-state_text f-text-body', 'Inténtalo de nuevo'));
    var reset = attr(h('button', BTN_S + ' pe-xp_reset f-text-label', 'Reestablecer búsqueda'), { type: 'button', 'data-ep-role': 'secondary' });
    reset.addEventListener('click', clearAll);
    empty.appendChild(reset);
    stage.appendChild(panelCal); stage.appendChild(panelExp); stage.appendChild(empty);

    root.appendChild(head); root.appendChild(bar); root.appendChild(stage);
    mount.innerHTML = '';
    mount.appendChild(root);

    // ---- custom select (the home's look, a real <select> underneath for forms/a11y) ----
    function makeSelect(label, options, onPick) {
      var wrap = h('div', 'pe-lc_select pe-xp_select');
      var trig = attr(h('button', 'pe-lc_control pe-lc_field pe-xp_select-trigger'), { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
      var lab = h('span', 'pe-xp_select-label', label);
      trig.appendChild(lab);
      trig.appendChild(attr(h('span', 'pe-xp_select-arrow'), { 'aria-hidden': 'true' }));
      var list = attr(h('div', 'pe-xp_select-list'), { role: 'listbox', hidden: true });
      var value = '';
      options.forEach(function (o) {
        var opt = attr(h('button', 'pe-xp_select-option f-text-small', o[1]), { type: 'button', role: 'option', 'data-value': o[0] });
        opt.addEventListener('click', function () { set(o[0]); close(); onPick(o[0]); trig.focus(); });
        list.appendChild(opt);
      });
      function set(v) {
        value = v;
        var o = options.filter(function (x) { return x[0] === v; })[0] || options[0];
        lab.textContent = v === '' ? label : o[1];
        trig.classList.toggle('is-set', v !== '');
        Array.prototype.forEach.call(list.children, function (c) { c.setAttribute('aria-selected', c.getAttribute('data-value') === v ? 'true' : 'false'); });
      }
      function open() { list.hidden = false; trig.setAttribute('aria-expanded', 'true'); wrap.classList.add('is-open'); }
      function close() { list.hidden = true; trig.setAttribute('aria-expanded', 'false'); wrap.classList.remove('is-open'); }
      trig.addEventListener('click', function () { if (list.hidden) open(); else close(); });
      document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
      wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { close(); trig.focus(); e.stopPropagation(); } });
      wrap.appendChild(trig); wrap.appendChild(list);
      set('');
      return { el: wrap, set: set, get: function () { return value; } };
    }

    // ---- filtering ----
    function matches(it) {
      if (state.item && it.slug !== state.item) return false;
      var on = Object.keys(state.types);
      if (on.length && on.indexOf(it.coleccion) === -1) return false;
      if (state.q) {
        var hay = norm(it.name + ' ' + (it.summary || '') + ' ' + (it.tipo || ''));
        if (hay.indexOf(norm(state.q)) === -1) return false;
      }
      return true;
    }
    // availability, per session: bookable / last seats / promo (past and cancelled never match)
    function availOk(x) {
      if (!state.avail) return true;
      if (x.past || x.cancelled) return false;
      if (state.avail === 'plazas') return x.seatsLeft !== 0;
      if (state.avail === 'pocas') return x.seatsLeft > 0 && x.seatsLeft <= LOW_SEATS;
      if (state.avail === 'promo') return !!x.precioOriginal && x.seatsLeft !== 0;
      return true;
    }
    function filteredItems() {
      var list = data.items.filter(matches);
      if (state.avail) list = list.filter(function (it) { return it.sessions.some(availOk); });
      if (state.month !== '') list = list.filter(function (it) { return it.sessions.some(function (s) { return parseKey(s.day).getMonth() === +state.month; }); });
      var price = function (it) { return typeof it.precio === 'number' ? it.precio : 1e9; };
      // experiences with a date to book first, then the ones still to be dated, past ones last
      var when = function (it) { return it.next ? it.next.iso : it.last ? 'z' + it.last.iso : 'y'; };
      var sorts = {
        '': function (a, b) { return when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : 0; },
        'fecha-asc': function (a, b) { return when(a) < when(b) ? -1 : 1; },
        'fecha-desc': function (a, b) { return (b.next ? b.next.iso : '') < (a.next ? a.next.iso : '') ? -1 : 1; },
        'price-asc': function (a, b) { return price(a) - price(b); },
        'price-desc': function (a, b) { return price(b) - price(a); },
        'name-asc': function (a, b) { return a.name.localeCompare(b.name, 'es'); }
      };
      return list.sort(sorts[state.sort] || sorts['']);
    }
    function filteredSessions() { return data.sessions.filter(function (s) { return matches(s.item) && availOk(s); }); }

    // ---- tags (top right): plain, removable ----
    function renderTags() {
      tags.innerHTML = '';
      var list = [];
      if (state.item && data.bySlug[state.item]) list.push([data.bySlug[state.item].name, function () { state.item = ''; search.value = state.q; }]);
      if (state.q) list.push(['“' + state.q + '”', function () { state.q = ''; search.value = ''; }]);
      if (state.month !== '') list.push([cap(MESES[+state.month]), function () { state.month = ''; monthSel.set(''); }]);
      TYPES.forEach(function (t) { if (state.types[t[0]]) list.push([t[1], function () { delete state.types[t[0]]; }]); });
      if (state.sort) list.push([SORTS.filter(function (s) { return s[0] === state.sort; })[0][1], function () { state.sort = ''; sortSel.set(''); }]);
      if (state.avail) list.push([AVAIL.filter(function (s) { return s[0] === state.avail; })[0][1], function () { state.avail = ''; availSel.set(''); }]);
      list.forEach(function (t) {
        var b = attr(h('button', 'pe-xp_tag f-text-small'), { type: 'button', 'aria-label': 'Quitar filtro: ' + t[0] });
        b.appendChild(h('span', 'pe-xp_tag-label', t[0]));
        b.appendChild(attr(h('span', 'pe-xp_tag-x'), { 'aria-hidden': 'true' }));
        b.addEventListener('click', function () { t[1](); refresh(); });
        tags.appendChild(b);
      });
      if (list.length > 1) {
        var all = attr(h('button', 'pe-xp_tag-clear f-text-small', 'Borrar todo'), { type: 'button' });
        all.addEventListener('click', clearAll);
        tags.appendChild(all);
      }
    }
    function clearAll() {
      state.q = ''; search.value = ''; state.month = ''; monthSel.set(''); state.sort = ''; sortSel.set(''); state.avail = ''; availSel.set(''); state.types = {}; state.item = '';
      refresh();
    }

    // ---- cards (Experiencias): the shared card() / pack() below the explorer ----
    function tcard(it) { return card(it, { dark: dark }); }
    function packCard(wide) { return pack({ dark: dark, wide: wide }); }
    function reservar(ses, cls) { var b = reservarBtn(ses, dark); b.className = cls; return b; }
    function applyCols() {
      var grid = panelExp.querySelector('.pe-xp_grid');
      if (!grid) return;
      grid.className = 'pe-xp_grid is-cols-' + state.cols;
    }
    // Experiencias shows a page at a time: three rows of the chosen columns on a desktop
    // (never fewer than 6), 6 on tablet and phone. "Ver más" adds the next page; any new
    // filter, sort or search starts again from the first page.
    function pageSize() {
      if (window.matchMedia && matchMedia('(max-width: 991px)').matches) return 6;
      return Math.max(6, state.cols * 3);
    }
    function renderExp(more) {
      var list = filteredItems();
      if (!more) state.limit = pageSize();
      var shown = list.slice(0, state.limit);
      var grid = panelExp.querySelector('.pe-xp_grid');
      var from = 0;
      if (more && grid) {
        // keep what is there, append the next page before the packs card
        var pack = grid.querySelector('.pe-tcard.is-pack');
        from = grid.querySelectorAll('.pe-tcard:not(.is-pack)').length;
        shown.slice(from).forEach(function (it) { var c = tcard(it); c.setAttribute('role', 'listitem'); grid.insertBefore(c, pack); });
      } else {
        panelExp.innerHTML = '';
        grid = h('div', 'pe-xp_grid is-cols-' + state.cols);
        grid.setAttribute('role', 'list');
        shown.forEach(function (it) { var c = tcard(it); c.setAttribute('role', 'listitem'); grid.appendChild(c); });
        var p = packCard(false); p.setAttribute('role', 'listitem'); grid.appendChild(p);
        panelExp.appendChild(grid);
      }
      var old = panelExp.querySelector('.pe-xp_more');
      if (old) old.remove();
      if (list.length > shown.length) {
        var box = h('div', 'pe-xp_more');
        box.appendChild(h('p', 'pe-xp_more-count f-text-small', 'Mostrando ' + shown.length + ' de ' + list.length));
        var left = list.length - shown.length;
        var btn = attr(h('button', BTN_S + ' pe-xp_more-btn w-button f-text-label', 'Ver más (' + Math.min(left, pageSize()) + ')'), { type: 'button', 'data-ep-role': 'secondary' });
        btn.addEventListener('click', function () {
          state.limit += pageSize();
          renderExp(true);
          var cards = panelExp.querySelectorAll('.pe-tcard:not(.is-pack)');
          if (!reduced) Array.prototype.slice.call(cards, from).forEach(function (c, i) {
            c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: Math.min(i * 40, 240), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' });
          });
          // keyboard users land on the first new card
          var nextLink = cards[from] && cards[from].querySelector('.pe-tcard_link');
          if (nextLink) nextLink.focus({ preventScroll: true });
        });
        box.appendChild(btn);
        panelExp.appendChild(box);
      }
      return list.length;
    }

    // ---- calendar (Calendario) ----
    function jumpToMonth(m) {
      var y = state.cursor.getFullYear();
      if (m < now.getMonth() && y === now.getFullYear()) y += 1;   // a month already gone means next year's
      state.cursor = new Date(y, m, 1, 12);
      state.view = 'month';
      state.selected = '';
    }
    function sessionsByDay(list) {
      var map = {};
      list.forEach(function (s) { (map[s.day] = map[s.day] || []).push(s); });
      return map;
    }
    function viewLabel() {
      var c = state.cursor;
      if (state.view === 'month') return cap(MESES[c.getMonth()]) + ' ' + c.getFullYear();
      if (state.view === 'week') {
        var a = mondayOf(c), b = addDays(a, 6);
        return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MESES_C[a.getMonth()] : '') + ' – ' + b.getDate() + ' ' + MESES_C[b.getMonth()] + ' ' + b.getFullYear();
      }
      return DIAS[c.getDay()] + ' ' + c.getDate() + ' de ' + MESES[c.getMonth()];
    }
    function move(dir) {
      var c = state.cursor;
      if (state.view === 'month') state.cursor = new Date(c.getFullYear(), c.getMonth() + dir, 1, 12);
      else if (state.view === 'week') state.cursor = addDays(c, 7 * dir);
      else state.cursor = addDays(c, dir);
      state.selected = '';
      renderCal(true);
    }
    function sessionRow(s, compact) {
      var it = s.item, st = stateOf(s), pct = promoPct(s);
      var row = h('div', 'pe-xp_row is-' + st + (compact ? ' is-compact' : '') + (pct && (st === 'open' || st === 'low') ? ' is-promo' : ''));
      row.appendChild(h('div', 'pe-xp_row-time f-text-h5', madrid(s.iso, { hour: '2-digit', minute: '2-digit' })));
      var main = h('div', 'pe-xp_row-main');
      var a = h('a', 'pe-xp_row-name f-text-h5', it.name); a.href = itemHref(it);
      main.appendChild(a);
      main.appendChild(h('span', 'pe-xp_row-meta f-text-small', [it.tipo, it.duracion].filter(Boolean).join(' · ')));
      row.appendChild(main);
      var seatsTxt = st === 'cancelled' ? 'Cancelada' : st === 'past' ? 'Finalizado' : seatsText(s.seatsLeft);
      row.appendChild(h('div', 'pe-xp_row-seats f-text-small' + (st === 'low' ? ' is-low' : ''), seatsTxt));
      var pr = h('div', 'pe-xp_row-price f-text-h5');
      if (pct && (st === 'open' || st === 'low')) { pr.appendChild(h('s', 'pe-xp_row-was f-text-small', euro(s.precioOriginal))); pr.appendChild(document.createTextNode(' ')); }
      pr.appendChild(document.createTextNode(typeof s.precio === 'number' ? euro(s.precio) : ''));
      row.appendChild(pr);
      if (st === 'open' || st === 'low') row.appendChild(reservar(s, BTN_P + ' is-small pe-xp_row-cta w-button f-text-label f-text-ui-sm'));
      // full / past / cancelled: the seats column already says so, no second label
      return row;
    }
    function agenda(dayKey, list) {
      var box = h('div', 'pe-xp_agenda');
      var d = parseKey(dayKey);
      box.appendChild(h('h3', 'pe-xp_agenda-title f-text-h5', DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]));
      if (!list || !list.length) box.appendChild(h('p', 'pe-xp_agenda-none f-text-small', 'No hay sesiones este día.'));
      else list.forEach(function (s) { box.appendChild(sessionRow(s)); });
      return box;
    }
    function nextSessionAfter(list, d) {
      var k = key(d);
      for (var i = 0; i < list.length; i++) if (list[i].day >= k) return list[i];
      return null;
    }
    // a session as a yellow ticket: time, name (+ duración · plazas when there is room)
    var curList = [];
    function ticket(s, rich) {
      var it = s.item, st = stateOf(s), pct = st === 'open' || st === 'low' ? promoPct(s) : 0;
      var t = attr(h('span', 'pe-xp_tk is-' + st + (pct ? ' is-promo' : '')), { 'data-sid': curList.indexOf(s) });
      t.appendChild(h('span', 'pe-xp_tk-time f-text-label f-text-ui-sm', madrid(s.iso, { hour: '2-digit', minute: '2-digit' })));
      t.appendChild(h('span', 'pe-xp_tk-name', it.name));
      if (pct) t.appendChild(h('span', 'pe-xp_tk-promo f-text-label f-text-ui-sm', '−' + pct + '%'));
      if (rich) t.appendChild(h('span', 'pe-xp_tk-meta f-text-small', [it.duracion, st === 'cancelled' ? 'Cancelada' : st === 'past' ? 'Finalizado' : seatsText(s.seatsLeft)].filter(Boolean).join(' · ')));
      return t;
    }
    function selectDay(k) {
      state.selected = state.selected === k ? '' : k;
      renderCal(false);
      var ag = panelCal.querySelector('.pe-xp_agenda');
      if (ag && !reduced) ag.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2,0.8,0.2,1)' });
    }
    // "Ocultar días vacíos": only the days with sessions, laid out by how many there are
    //   1–4 days   one big column each       5–8   four columns       9+   a grid of squares
    function tiles(days, byDay) {
      var n = days.length;
      var wrap = h('div', 'pe-xp_tiles ' + (n <= 4 ? 'is-few is-n-' + n : n <= 8 ? 'is-some' : 'is-many'));
      days.forEach(function (k) {
        var d = parseKey(k), ses = byDay[k];
        var tile = attr(h('button', 'pe-xp_tile' + (k === state.selected ? ' is-selected' : '') + (k === key(now) ? ' is-today' : '') + (d < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? ' is-past' : '')), {
          type: 'button', 'data-day': k, 'data-first-sid': curList.indexOf(ses[0]), 'aria-pressed': k === state.selected ? 'true' : 'false',
          'aria-label': DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ', ' + ses.length + (ses.length === 1 ? ' sesión' : ' sesiones')
        });
        var head = h('span', 'pe-xp_tile-head');
        head.appendChild(h('span', 'pe-xp_tile-num', String(d.getDate())));
        var hd = h('span', 'pe-xp_tile-when');
        hd.appendChild(h('span', 'pe-xp_tile-wd f-text-label f-text-ui-sm', DIAS[d.getDay()]));
        hd.appendChild(h('span', 'pe-xp_tile-mon f-text-small', MESES[d.getMonth()]));
        head.appendChild(hd);
        tile.appendChild(head);
        // up to 8 days there is room for the photo of the day's first experience
        if (n <= 8) {
          var media = h('span', 'pe-xp_tile-media');
          var im = attr(h('img', 'pe-xp_tile-img'), { loading: 'lazy', alt: '' });
          if (window.PE_CMS && window.PE_CMS.setImage) window.PE_CMS.setImage(im, ses[0].item.image, ses[0].item.name); else im.src = ses[0].item.image;
          media.appendChild(im);
          tile.appendChild(media);
        }
        var tl = h('span', 'pe-xp_tile-list');
        ses.forEach(function (s) { tl.appendChild(ticket(s, true)); });
        tile.appendChild(tl);
        tile.addEventListener('click', function () { selectDay(k); });
        wrap.appendChild(tile);
      });
      return wrap;
    }
    function renderCal(animate) {
      floatHide();
      panelCal.innerHTML = '';
      var list = filteredSessions();
      curList = list;
      var byDay = sessionsByDay(list);
      var calbar = h('div', 'pe-xp_calbar');
      var left = h('div', 'pe-xp_calbar-left');
      var seg = attr(h('div', 'pe-lc_control pe-xp_seg'), { role: 'group', 'aria-label': 'Vista del calendario' });
      [['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].forEach(function (v) {
        var b = attr(h('button', 'pe-xp_seg-btn f-text-small' + (state.view === v[0] ? ' is-active' : ''), v[1]), { type: 'button', 'aria-pressed': state.view === v[0] ? 'true' : 'false' });
        b.addEventListener('click', function () {
          if (state.view === v[0]) return;
          if (state.selected) state.cursor = parseKey(state.selected);
          state.view = v[0]; renderCal(true);
        });
        seg.appendChild(b);
      });
      left.appendChild(seg);
      if (state.view !== 'day') {
        var hide = attr(h('button', 'pe-lc_control pe-lc_chip pe-xp_chip pe-xp_hide' + (state.compact ? ' is-active' : '')), { type: 'button', 'aria-pressed': state.compact ? 'true' : 'false' });
        hide.appendChild(attr(h('span', 'pe-xp_box'), { 'aria-hidden': 'true' }));
        hide.appendChild(h('span', 'f-text-label f-text-ui-sm', 'Ocultar días vacíos'));
        hide.addEventListener('click', function () { state.compact = !state.compact; setCompact(state.compact); renderCal(true); });
        left.appendChild(hide);
      }
      var nav = h('div', 'pe-xp_nav');
      var prev = attr(h('button', 'pe-lc_control pe-xp_navbtn'), { type: 'button', 'aria-label': 'Anterior' });
      prev.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3L5 8L10 13" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
      prev.addEventListener('click', function () { move(-1); });
      var next = attr(h('button', 'pe-lc_control pe-xp_navbtn'), { type: 'button', 'aria-label': 'Siguiente' });
      next.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3L11 8L6 13" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
      next.addEventListener('click', function () { move(1); });
      var label = attr(h('div', 'pe-xp_navlabel f-text-h5', viewLabel()), { 'aria-live': 'polite' });
      var today = attr(h('button', 'pe-lc_control pe-xp_today f-text-small', 'Hoy'), { type: 'button' });
      today.addEventListener('click', function () { state.cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12); state.selected = state.view === 'month' ? key(now) : ''; renderCal(true); });
      nav.appendChild(prev); nav.appendChild(label); nav.appendChild(next); nav.appendChild(today);
      calbar.appendChild(left); calbar.appendChild(nav);
      panelCal.appendChild(calbar);

      var body = h('div', 'pe-xp_calbody');
      var c = state.cursor;
      var days = [];   // days of this range that have sessions
      function showAgenda(inRange) {
        if (state.selected && inRange(parseKey(state.selected)) && byDay[state.selected]) body.appendChild(agenda(state.selected, byDay[state.selected]));
      }
      if (state.view === 'month') {
        var first = new Date(c.getFullYear(), c.getMonth(), 1, 12);
        var start = mondayOf(first);
        var last = new Date(c.getFullYear(), c.getMonth() + 1, 0, 12);
        var cells = Math.ceil(((first.getDay() + 6) % 7 + last.getDate()) / 7) * 7;
        for (var i = 0; i < cells; i++) {
          var dk0 = addDays(start, i);
          if (dk0.getMonth() === c.getMonth() && byDay[key(dk0)]) days.push(key(dk0));
        }
        if (!state.selected && days.length) state.selected = days.filter(function (k3) { return k3 >= key(now); })[0] || '';
        var inMonth = function (d) { return d.getMonth() === c.getMonth() && d.getFullYear() === c.getFullYear(); };
        if (state.compact) {
          if (days.length) body.appendChild(tiles(days, byDay));
        } else {
          var grid = attr(h('div', 'pe-xp_month'), { role: 'grid', 'aria-label': viewLabel() });
          DIAS_C.forEach(function (d) { grid.appendChild(attr(h('div', 'pe-xp_wd f-text-label f-text-ui-sm', d), { role: 'columnheader' })); });
          for (var j = 0; j < cells; j++) {
            var d = addDays(start, j), k = key(d), ses = byDay[k] || [];
            var out = d.getMonth() !== c.getMonth();
            var cell = attr(h('button', 'pe-xp_cell' + (out ? ' is-out' : '') + (k === key(now) ? ' is-today' : '') + (d < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? ' is-past' : '') + (ses.length ? ' has-sessions' : '') + (k === state.selected && !out ? ' is-selected' : '')), {
              type: 'button', role: 'gridcell', 'data-day': k, 'aria-pressed': k === state.selected ? 'true' : 'false',
              'data-first-sid': ses.length ? curList.indexOf(ses[0]) : null,
              'aria-label': d.getDate() + ' de ' + MESES[d.getMonth()] + (ses.length ? ', ' + ses.length + (ses.length === 1 ? ' sesión' : ' sesiones') : '')
            });
            cell.appendChild(h('span', 'pe-xp_cell-num f-text-small', String(d.getDate())));
            ses.slice(0, 2).forEach(function (s) { cell.appendChild(ticket(s, false)); });
            if (ses.length > 2) cell.appendChild(h('span', 'pe-xp_cell-more f-text-small', '+' + (ses.length - 2)));
            cell.addEventListener('click', (function (k2) { return function () { selectDay(k2); }; })(k));
            grid.appendChild(cell);
          }
          body.appendChild(grid);
        }
        showAgenda(inMonth);
        if (!days.length) body.appendChild(noneHere(list, first));
      } else if (state.view === 'week') {
        var mon = mondayOf(c);
        for (var w = 0; w < 7; w++) { var wk0 = key(addDays(mon, w)); if (byDay[wk0]) days.push(wk0); }
        var inWeek = function (d) { return d >= mon && d < addDays(mon, 7); };
        if (state.compact) {
          if (days.length) body.appendChild(tiles(days, byDay));
          showAgenda(inWeek);
        } else {
          var wk = h('div', 'pe-xp_week');
          for (var x = 0; x < 7; x++) {
            var dd = addDays(mon, x), kk = key(dd), ss = byDay[kk] || [];
            var col = attr(h('div', 'pe-xp_wcol' + (kk === key(now) ? ' is-today' : '')), { 'data-first-sid': ss.length ? curList.indexOf(ss[0]) : null });
            col.appendChild(h('div', 'pe-xp_wcol-head f-text-label f-text-ui-sm', DIAS[dd.getDay()].slice(0, 3) + ' ' + dd.getDate()));
            ss.forEach(function (s) { var r = sessionRow(s, true); r.setAttribute('data-sid', curList.indexOf(s)); col.appendChild(r); });
            wk.appendChild(col);
          }
          body.appendChild(wk);
        }
        if (!days.length) body.appendChild(noneHere(list, mon));
      } else {
        var dk = key(c);
        body.appendChild(agenda(dk, byDay[dk]));
        if (!(byDay[dk] || []).length) body.appendChild(noneHere(list, c));
      }
      panelCal.appendChild(body);
      panelCal.appendChild(packCard(true));
      if (animate && !reduced) body.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      return list.length;
    }

    // ---- hover: the Experiencia card floats next to the pointer (mouse only) ----
    // follow  while the pointer moves over a session (cell, ticket, tile, week column)
    // settle  after a short rest (REST_MS) or as soon as the pointer leaves the session:
    //         the card stops where it is and takes clicks
    // pinned  while the pointer is on the card (Reservar / Más info / the card itself)
    // leaving the card closes it (the same session does not reopen it until the pointer
    // leaves that session); leaving the calendar without reaching it hides it after GRACE_MS
    var REST_MS = 450, GRACE_MS = 280, SETTLED_GRACE_MS = 600;
    var canHover = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
    var fl = null, flSid = -1, flCache = {}, fx = 0, fy = 0, tx = 0, ty = 0, flRaf = 0, flOn = false;
    var settled = false, pinned = false, restT = 0, hideT = 0, dismissed = -1, switchT = 0, switchSid = -1;
    function floatEl() {
      if (fl) return fl;
      fl = attr(h('div', 'pe-xp_float' + (dark ? ' is-dark' : '')), { 'aria-hidden': 'true' });
      (root.closest('[data-flwr]') || document.body).appendChild(fl);
      fl.addEventListener('pointerenter', function () {
        if (!flOn) return;
        pinned = true; settle();
        clearTimeout(hideT); clearTimeout(restT); clearTimeout(switchT); switchSid = -1;
      });
      fl.addEventListener('pointerleave', function () {
        // been on it and left: it closes. The same session does not bring it back until the
        // pointer has left that session; another session opens it again.
        if (!pinned) return;
        dismissed = flSid;
        floatHide();
      });
      return fl;
    }
    function floatTick() {
      flRaf = 0;
      if (!flOn || settled) return;
      fx += (tx - fx) * (reduced ? 1 : 0.22);
      fy += (ty - fy) * (reduced ? 1 : 0.22);
      fl.style.transform = 'translate3d(' + Math.round(fx) + 'px,' + Math.round(fy) + 'px,0)';
      if (Math.abs(tx - fx) > 0.5 || Math.abs(ty - fy) > 0.5) flRaf = requestAnimationFrame(floatTick);
    }
    function floatAim(e, snap) {
      var w = fl.offsetWidth, hh = fl.offsetHeight, gap = 14;
      tx = e.clientX + gap;
      if (tx + w > innerWidth - 16) tx = e.clientX - w - gap;
      ty = Math.max(16, Math.min(e.clientY - hh * 0.3, innerHeight - hh - 16));
      if (snap) { fx = tx; fy = ty; fl.style.transform = 'translate3d(' + Math.round(fx) + 'px,' + Math.round(fy) + 'px,0)'; }
      if (!flRaf) flRaf = requestAnimationFrame(floatTick);
    }
    function settle() {
      if (!fl || !flOn) return;
      settled = true;
      fl.classList.add('is-settled');
      // land where it was heading, so the card is where the eye expects it
      fx = tx; fy = ty;
      fl.style.transform = 'translate3d(' + Math.round(fx) + 'px,' + Math.round(fy) + 'px,0)';
    }
    function hideSoon(ms) { clearTimeout(hideT); hideT = setTimeout(floatHide, ms || GRACE_MS); }
    function floatShow(sid, e) {
      var s = curList[sid];
      if (!s) return floatHide();
      floatEl();
      clearTimeout(hideT);
      if (settled && sid === flSid) return;          // resting on the same session: stay put
      if (sid !== flSid) {
        var cardEl = flCache[sid] || (flCache[sid] = card(s.item, { dark: dark, ses: s, boxed: true, compact: true }));
        fl.innerHTML = ''; fl.appendChild(cardEl); flSid = sid;
      }
      settled = false; fl.classList.remove('is-settled');
      var snap = !flOn;
      if (!flOn) { flOn = true; fl.classList.add('is-on'); }
      floatAim(e, snap);
      clearTimeout(restT);
      restT = setTimeout(settle, REST_MS);
    }
    function floatHide() {
      clearTimeout(restT); clearTimeout(hideT); clearTimeout(switchT); switchSid = -1;
      if (!fl || !flOn) return;
      flOn = false; flSid = -1; settled = false; pinned = false;
      fl.classList.remove('is-on', 'is-settled');
    }
    if (canHover) {
      panelCal.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (pinned) return;
        var t = e.target.closest && e.target.closest('[data-sid], [data-first-sid]');
        if (!t || !panelCal.contains(t)) {
          dismissed = -1;
          clearTimeout(switchT); switchSid = -1;
          // off the session: stop, give the pointer time to reach the card
          if (flOn) { var was = settled; if (!settled) settle(); hideSoon(was ? SETTLED_GRACE_MS : GRACE_MS); }
          return;
        }
        var sid = t.hasAttribute('data-sid') ? +t.getAttribute('data-sid') : +t.getAttribute('data-first-sid');
        if (sid === dismissed) return;
        dismissed = -1;
        // stopped card: the pointer is on its way to it, crossing other sessions. Another
        // session takes over only when the pointer RESTS on it (REST_MS), never on the way.
        if (settled && flOn && sid !== flSid) {
          clearTimeout(hideT);
          // every move restarts the wait: only a real pause on that session switches
          clearTimeout(switchT);
          switchSid = sid;
          var at = { clientX: e.clientX, clientY: e.clientY };
          switchT = setTimeout(function () { switchSid = -1; settled = false; floatShow(sid, at); }, REST_MS);
          return;
        }
        clearTimeout(switchT); switchSid = -1;
        floatShow(sid, e);
      });
      panelCal.addEventListener('pointerleave', function (e) {
        if (fl && e.relatedTarget && fl.contains(e.relatedTarget)) return;
        if (flOn) { if (!settled) settle(); hideSoon(); }
      });
      panelCal.addEventListener('pointerdown', function () { if (!pinned) floatHide(); });
      window.addEventListener('scroll', function () { if (!pinned) floatHide(); }, { passive: true, capture: true });
      window.addEventListener('cart:updated', floatHide);
    }


    // nothing in this range: point at the next date instead of a dead end
    function noneHere(list, from) {
      var box = h('div', 'pe-xp_none');
      var nx = nextSessionAfter(list, from);
      if (!nx) { box.appendChild(h('p', 'f-text-small', 'No hay más fechas por ahora.')); return box; }
      var d = parseKey(nx.day);
      box.appendChild(h('p', 'f-text-small', 'No hay sesiones en estas fechas.'));
      var go = attr(h('button', BTN_S + ' is-small w-button f-text-label f-text-ui-sm', 'Ir a la próxima: ' + d.getDate() + ' ' + MESES_C[d.getMonth()]), { type: 'button', 'data-ep-role': 'secondary' });
      go.addEventListener('click', function () { state.cursor = new Date(d); state.selected = nx.day; if (state.view === 'month') state.cursor = new Date(d.getFullYear(), d.getMonth(), 1, 12); renderCal(true); });
      box.appendChild(go);
      return box;
    }

    // ---- render ----
    function setTab(t) {
      state.tab = t;
      Object.keys(tabBtns).forEach(function (k) {
        var on = k === t;
        tabBtns[k].setAttribute('aria-selected', on ? 'true' : 'false');
        tabBtns[k].setAttribute('tabindex', on ? '0' : '-1');
        tabBtns[k].classList.toggle('is-active', on);
      });
      panelCal.hidden = t !== 'calendario';
      panelExp.hidden = t !== 'experiencias';
      colsWrap.hidden = t !== 'experiencias';
      root.setAttribute('data-tab', t);
      refresh();
    }
    function refresh() {
      stage.classList.remove('is-settling');
      Object.keys(chipBtns).forEach(function (k) {
        var on = !!state.types[k];
        chipBtns[k].classList.toggle('is-active', on);
        chipBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderTags();
      var n = state.tab === 'calendario' ? renderCal(true) : renderExp();
      empty.hidden = n > 0;
      (state.tab === 'calendario' ? panelCal : panelExp).classList.toggle('is-empty', !n);
      if (state.tab === 'experiencias' && !reduced) {
        Array.prototype.forEach.call(panelExp.querySelectorAll('.pe-tcard'), function (c, i) {
          c.animate([{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
            { duration: 300, delay: Math.min(i * 45, 270), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' });
        });
      }
    }

    // the calendar narrowed to one experience, on its next date (or its last one)
    function showDates(slug) {
      var it = data.bySlug[slug];
      if (!it) return;
      state.item = slug;
      state.q = ''; search.value = it.name;
      var at = it.next || (it.upcoming && it.upcoming[0]) || it.last;
      if (at) { var d = parseKey(at.day); state.view = 'month'; state.cursor = new Date(d.getFullYear(), d.getMonth(), 1, 12); state.selected = at.day; }
      setTab('calendario');
      var top = root.getBoundingClientRect().top;
      if (!root.closest('#modal-1') && (top < 0 || top > innerHeight * 0.5)) root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    var api = {
      showDates: showDates,
      // narrow to one experience (an opener's data-booking-item) and show its next date
      focusItem: function (slug) {
        if (slug && data.bySlug[slug]) { showDates(slug); return; }
        state.item = '';
        setTab('calendario');
      },
      setTab: setTab,
      root: root
    };
    root.__peXp = api;
    setTab(state.tab);
    return api;
  }

  // ---------- the booking overlay (#modal-1) ----------
  function initOverlay() {
    var modal = document.getElementById('modal-1');
    if (!modal) return;
    var mount = modal.querySelector('[data-pe-explorer]');
    var xp = mount ? Explorer(mount) : null;
    var lastFocus = null;
    function open(slug) {
      if (xp) xp.focusItem(slug || '');
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('pe-modal-open');
      var close = modal.querySelector('.booking-modal_close');
      if (close) setTimeout(function () { close.focus(); }, 30);
    }
    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('pe-modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    document.addEventListener('click', function (e) {
      var opener = e.target.closest && e.target.closest('[data-modal-open="modal-1"]');
      if (opener) { e.preventDefault(); open(opener.getAttribute('data-booking-item')); return; }
      if (e.target.closest && e.target.closest('#modal-1 [data-modal-close]')) { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open') && !document.querySelector('.ep-backdrop')) close();
    });
    window.PEBookingModal = { open: open, close: close };
  }

  // any "Ver fechas" button: its own Explorador if it sits in one, else the booking overlay
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pe-dates]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var slug = b.getAttribute('data-pe-dates');
    var host = b.closest('.pe-xp');
    if (host && host.__peXp) { host.__peXp.showDates(slug); return; }
    if (window.PEBookingModal) window.PEBookingModal.open(slug);
  }, true);

  window.PEExplorer = {
    // card for one experience by slug (light unless opts.dark), or null when unknown
    card: function (slug, opts) { var d = loadData(); var it = d && d.bySlug[slug]; return it ? card(it, opts) : null; },
    pack: function (opts) { return pack(opts); }
  };

  ready(function () {
    document.querySelectorAll('[data-pe-explorer]').forEach(function (m) {
      if (m.closest('#modal-1')) return;          // the overlay builds its own on load
      Explorer(m);
    });
    initOverlay();
  });
})();

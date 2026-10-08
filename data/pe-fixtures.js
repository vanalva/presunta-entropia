/* ============================================================
   PRESUNTA ENTROPÍA — test data for the card and calendar states
   (site-fixes 2026-10-08). DELETE BEFORE LAUNCH (with its script
   tag on every page: grep "pe-fixtures.js").

   Inert unless switched on:   any page ?fixtures=1   (remembered)
                    off:       any page ?fixtures=0
   While on, a banner says so on every page.

   It loads between pe-experiencias.js (the platform sync) and
   pe-cms.js, and rewrites window.PE_EXPERIENCIAS in place so every
   state shows up at once: several dates per workshop, several
   workshops on one day, last seats, sold out, promo, cancelled,
   past-only, no date, featured, Chef's Table and Team Building.
   Dates are relative to today, so the set never goes stale.

   Test sessions and test experiences carry ids starting "test-":
   js/pe-booking-flow.js refuses to put them in the cart.
   Nothing here is written to the Entropical app.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'pe-fixtures';
  var on = false;
  try {
    var q = new URLSearchParams(location.search).get('fixtures');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    on = localStorage.getItem(KEY) === '1';
  } catch (e) { on = /[?&]fixtures=1/.test(location.search); }
  var src = window.PE_EXPERIENCIAS;
  if (!on || !src || !src.items) return;

  var IMG = '../assets/images/home-2026-10/';
  var n = 0;
  // a date `days` from today at hh:mm Madrid time (summer or winter time, whichever that day has)
  function at(days, hh, mm) {
    var d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(12, 0, 0, 0);
    var madridNoon = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(d);
    d.setUTCHours(hh - (madridNoon - 12), mm || 0, 0, 0);
    return d.toISOString();
  }
  function ses(days, hh, mm, extra) {
    n++;
    return Object.assign({ id: 'test-ses-' + n, sessionDate: at(days, hh, mm), status: 'SCHEDULED' }, extra || {});
  }
  function bySlug(slug) { return src.items.filter(function (x) { return x.slug === slug; })[0]; }
  function setSessions(slug, list, more) {
    var x = bySlug(slug);
    if (!x) return;
    x.sessions = list;
    Object.assign(x, more || {});
  }

  // ---- people (platform shape: Person via PersonItem; the profiles exist in data/pe-personas.js) ----
  var P = {
    juan: { slug: 'juan-perez', name: 'Juan Pérez', role: 'Chef', photoUrl: '../assets/images/site-2026-10/equipo-chef-brazos-cruzados-1600.webp', bio: 'Apasionado por la cocina mediterránea, con más de 10 años de experiencia en restaurantes de Madrid.' },
    carlos: { slug: 'carlos-ruiz', name: 'Carlos Ruiz', role: 'Invitado especial', photoUrl: '../assets/images/home-2026-10/instructor-clase-cocina-1600.webp', bio: 'Sommelier certificado: marida cada plato con la bebida que le toca.' },
    lara: { slug: 'lara-ladriana', name: 'Lara Ladriana', role: 'Chef', photoUrl: '../assets/images/site-2026-10/equipo-retrato-cocinera-1600.webp', bio: 'Cocinera del equipo de Presunta Entropía.' },
    manuel: { slug: 'manuel-lugo', name: 'Manuel Lugo', role: 'Chef', photoUrl: '../assets/images/home-2026-10/riendo-retrato-1600.webp', bio: 'Cocinero del equipo de Presunta Entropía.' },
    ana: { slug: 'ana-lobenco', name: 'Ana Lobenco', role: 'Chef invitada', photoUrl: '../assets/images/site-2026-10/equipo-retrato-sentada-1600.webp', bio: 'Chef invitada para las noches nikkei.' }
  };
  function people() { return Array.prototype.map.call(arguments, function (p) { return { person: null, slug: p.slug, name: p.name, role: p.role, photoUrl: p.photoUrl, bio: p.bio, specialties: [] }; }); }

  // ---- the real workshops, with test dates ----
  // Pasta: past date, promo, sold out, last seats on the same day, a normal one
  setSessions('pasta-fresca-di-cuore', [
    ses(-6, 20, 0, { seatsLeft: 0 }),
    ses(2, 20, 0, { seatsLeft: 9, priceEuros: 59, priceOriginalEuros: 70 }),
    ses(14, 13, 0, { seatsLeft: 2 }),
    ses(14, 20, 0, { seatsLeft: 0 }),
    ses(30, 20, 0, { seatsLeft: 12 })
  ], { instructors: people(P.juan, P.carlos) });
  // Indian Nights: last seats, two sittings the same day, one cancelled
  setSessions('indian-nights', [
    ses(7, 13, 30, { seatsLeft: 2 }),
    ses(7, 20, 0, { seatsLeft: 1 }),
    ses(21, 20, 0, { status: 'CANCELLED', seatsLeft: 14 }),
    ses(40, 20, 0, { seatsLeft: 14 })
  ], { instructors: people(P.manuel) });
  // Tacos + Arabian: they join Pasta on day +14 (four sessions that day)
  setSessions('tacos-margaritas-night', [
    ses(14, 18, 0, { seatsLeft: 6 }),
    ses(22, 20, 0, { seatsLeft: 10, priceEuros: 56, priceOriginalEuros: 70 })
  ], { hasOffer: true, priceOriginalEuros: 70 });
  setSessions('arabian-nights', [
    ses(14, 21, 30, { seatsLeft: 13 }),
    ses(45, 20, 0, { seatsLeft: 13 })
  ]);
  // Taste of Thailand: only past dates (the past state)
  setSessions('taste-of-thailand', [
    ses(-10, 20, 0, { seatsLeft: 0 }),
    ses(-3, 20, 0, { seatsLeft: 4 })
  ]);
  // Raw Nikkei: every date sold out
  setSessions('raw-nikkei-nights', [
    ses(5, 20, 0, { seatsLeft: 0 }),
    ses(19, 20, 0, { seatsLeft: 0 })
  ], { isFeatured: true, instructors: people(P.ana) });
  // Dim Sum stays without a date (Próximamente)

  // ---- test experiences ----
  function item(o) {
    n++;
    return Object.assign({
      entropicalId: 'test-item-' + n,
      coleccion: 'talleres',
      categoria: 'Talleres de Cocina',
      descriptionHtml: '<p>Experiencia de prueba para revisar los estados de las tarjetas y del calendario.</p>',
      includesHtml: '', requirementsHtml: '', policiesHtml: '',
      durationMinutes: 180, level: 'Básico', capacityTotal: 12, seatsLeft: 12,
      galleryUrls: [], bookingMode: 'book_now', isPublished: true, instructors: [],
      test: true
    }, o);
  }
  src.items.push(item({
    slug: 'prueba-ramen-desde-cero', name: 'Ramen desde cero (prueba)',
    shortDescription: 'Una semana entera de sesiones: para ver muchas fechas de un mismo taller.',
    priceEuros: 65, heroImageUrl: IMG + 'muestra-plato-mano-1600.webp',
    instructors: people(P.lara, P.manuel, P.juan),
    sessions: [15, 16, 17, 18, 19, 20, 21].map(function (d, i) { return ses(d, 19, 0, { seatsLeft: [12, 8, 5, 3, 1, 0, 10][i] }); })
  }));
  src.items.push(item({
    slug: 'prueba-cata-vinos-naturales', name: 'Cata de vinos naturales (prueba)',
    coleccion: 'cenas', categoria: "Chef's Table", level: 'Intermedio',
    shortDescription: "Chef's Table de prueba con promoción y fecha destacada.",
    priceEuros: 72, priceOriginalEuros: 90, hasOffer: true, isFeatured: true,
    durationMinutes: 150, capacityTotal: 10, instructors: people(P.carlos), heroImageUrl: IMG + 'muestra-plato-salmon-1600.webp',
    sessions: [ses(9, 21, 0, { seatsLeft: 3 }), ses(23, 21, 0, { seatsLeft: 10 })]
  }));
  src.items.push(item({
    slug: 'prueba-paella-de-equipo', name: 'Paella de equipo (prueba)',
    coleccion: 'team-building', categoria: 'Team Building', level: 'Básico',
    shortDescription: 'Team Building de prueba: un grupo, una paella, una fecha.',
    priceEuros: 85, durationMinutes: 240, capacityTotal: 24, heroImageUrl: IMG + 'grupo-amigos-cocina-1600.webp',
    sessions: [ses(12, 10, 0, { seatsLeft: 24 })]
  }));
  src.items.push(item({
    slug: 'prueba-pan-de-masa-madre', name: 'Pan de masa madre (prueba)',
    shortDescription: 'Sin fechas todavía: el estado Próximamente con foto.',
    priceEuros: 60, heroImageUrl: IMG + 'local-cocina-1600.webp', sessions: []
  }));

  // ---- the banner: never mistake this for real data ----
  function banner() {
    var b = document.createElement('div');
    b.className = 'pe-fixtures-banner f-text-small';
    b.setAttribute('role', 'status');
    b.innerHTML = 'Datos de prueba activos (pe-fixtures.js) · <a href="?fixtures=0">Quitar</a>';
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
})();

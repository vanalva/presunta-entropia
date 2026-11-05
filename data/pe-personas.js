/* ============================================================
   PRESUNTA ENTROPÍA — people for the profile template (persona.html)
   Local preview only. Fields mirror the Entropical Person model
   (prisma: Person) so the Webflow "Personas" collection binds 1:1:
     slug, name, rol (role label), tipo (equipo | colaborador),
     bio, image (photoUrl), specialties[], instagramUrl, websiteUrl,
     linkedinUrl, items[] (experience slugs = PersonItem links).
   CONTENT IS PLACEHOLDER: names, roles, bios and photos are the ones
   already on nuestras-caras.html today. Real bios, roles, photos,
   specialties and social URLs come from Carlos / the admin.
   Instructors synced from the platform (pe-cms.js) are kept and
   take precedence when the slug matches.
   Load after pe-cms.js.
   ============================================================ */
(function () {
  var db = window.PE_CMS;
  if (!db) return;
  var EQUIPO_BIO = 'En Presunta Entropía, valoramos la calidad y la sostenibilidad en cada aspecto de nuestro trabajo. Nuestro equipo está compuesto por profesionales apasionados que buscan ofrecer experiencias culinarias memorables y responsables.';
  var IMG = window.PE_ASSETS + 'images/';
  var page = [
    { slug: 'lara-ladriana', name: 'Lara Ladriana', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'site-2026-10/equipo-retrato-cocinera-1600.webp' },
    { slug: 'rebecca-soto', name: 'Rebecca Soto', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'home-2026-10/riendo-comida-1600.webp' },
    { slug: 'diego-duscol', name: 'Diego Duscol', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'site-2026-10/equipo-chef-brazos-cruzados-1600.webp' },
    { slug: 'lucia-goyas', name: 'Lucia Goyas', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'home-2026-10/riendo-retrato-1600.webp' },
    { slug: 'manuel-lugo', name: 'Manuel Lugo', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'home-2026-10/instructor-clase-cocina-1600.webp' },
    { slug: 'ana-lobenco', name: 'Ana Lobenco', rol: 'Equipo', tipo: 'equipo', bio: EQUIPO_BIO, image: IMG + 'site-2026-10/equipo-retrato-sentada-1600.webp' },
    { slug: 'juan-perez', name: 'Juan Pérez', rol: 'Chef Ejecutivo', tipo: 'colaborador', bio: 'Apasionado por la cocina mediterránea, con más de 10 años de experiencia en restaurantes.', image: IMG + 'site-2026-10/equipo-retrato-joven-1600.webp' },
    { slug: 'ana-gomez', name: 'Ana Gómez', rol: 'Coordinadora de Eventos', tipo: 'colaborador', bio: 'Experta en organización de eventos, siempre buscando experiencias únicas para nuestros clientes.', image: IMG + 'site-2026-10/equipo-retrato-sentada-1600.webp' },
    { slug: 'carlos-ruiz', name: 'Carlos Ruiz', rol: 'Sommelier Certificado', tipo: 'colaborador', bio: 'Conocedor de vinos, se encarga de maridar cada plato con la bebida perfecta.', image: IMG + 'site-2026-10/carlos-fundador-1600.webp' },
    { slug: 'laura-torres', name: 'Laura Torres', rol: 'Diseñadora Gráfica', tipo: 'colaborador', bio: 'Creativa apasionada por la gastronomía, transforma ideas en experiencias visuales inolvidables.', image: IMG + 'site-2026-10/equipo-retrato-cocinera-1600.webp' },
    { slug: 'miguel-soto', name: 'Miguel Soto', rol: 'Asistente Administrativo', tipo: 'colaborador', bio: 'Organiza y gestiona operaciones diarias, asegurando un flujo de trabajo eficiente.', image: IMG + 'site-2026-10/equipo-chef-brazos-cruzados-1600.webp' },
    { slug: 'sofia-martinez', name: 'Sofía Martínez', rol: 'Community Manager', tipo: 'colaborador', bio: 'Conecta con nuestra comunidad, compartiendo recetas y novedades en redes sociales.', image: IMG + 'home-2026-10/riendo-retrato-1600.webp' }
  ];
  var synced = (db.personas || []).filter(function (p) { return p.items && p.items.length; });
  var out = synced.slice();
  page.forEach(function (p) {
    var dup = false;
    out.forEach(function (q) { if (q.slug === p.slug) dup = true; });
    if (dup) return;
    p.specialties = []; p.instagramUrl = ''; p.websiteUrl = ''; p.linkedinUrl = ''; p.items = [];
    out.push(p);
  });
  db.personas = out;
  db.findPersona = function (slug) {
    for (var i = 0; i < out.length; i++) if (out[i].slug === slug) return out[i];
    return null;
  };
})();

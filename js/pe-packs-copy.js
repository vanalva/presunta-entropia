/* =====================================================================
   PACKS — card copy that the Entropical API does not carry.
   EDIT THE COPY HERE. One entry per pack slug (the slug set in the
   Entropical admin, Packs). Name, description, price, credits, seats and
   validity always come from the API; this file only adds:
     subtitle  top-right line of the card ("Pack para parejas")
     tag       the "Ideal para…" chip
     incluye   the "Incluye:" list (leave it out to hide the list)
   A slug that is not here shows the API name + description only.
   Plain text only (it is written with textContent).
   ===================================================================== */
window.PE_PACKS_COPY = {
  'presunto-sacrificio': {
    subtitle: 'Pack taller individual',
    tag: 'Ideal para todos',
    incluye: ['Un taller a tu elección', 'Materiales incluidos', 'Recetas para llevar']
  },
  'presunto-detalle': {
    subtitle: 'Pack para parejas',
    tag: 'Ideal para parejas en peligro de extinción',
    incluye: ['Un taller para dos personas', 'Materiales incluidos', 'Recetas para llevar']
  },
  'presunta-constancia': {
    subtitle: 'Pack de 3 talleres',
    tag: 'Ideal para ir probando',
    incluye: ['Tres talleres a tu ritmo', 'Materiales incluidos', 'Recetas para llevar']
  },
  'presunta-calma': {
    subtitle: 'Pack para equipos y familias',
    tag: 'Ideal para workaholics'
  },
  'presunta-cordura': {
    subtitle: 'Chef’s Table',
    tag: 'Cenas privadas'
  },
  'presunta-sobremesa': {
    subtitle: 'Cena para dos',
    tag: 'Noches temáticas'
  }
};

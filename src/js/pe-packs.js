/* =====================================================================
   PACKS — site glue around Entropical's webflow-packs.js.
   Load after webflow-packs.js and js/pe-packs-copy.js (all defer).

   webflow-packs.js fetches GET /api/packs/types (already in the admin's
   sortOrder) and clones [data-pack-template] once per pack inside every
   [data-entropical-packs-list], setting data-state loading|ready|empty|error.
   This file never fetches on its own; it reads the same cached list through
   EntropicalPacks.listTypes() and only dresses what the script rendered:
     - colour scheme per card, cycled by position (4 variants);
     - copy the API does not carry (subtitle, "Ideal para…" tag, "Incluye"
       list) from window.PE_PACKS_COPY, by slug;
     - the "N reservas de M plazas · Válido N días" facts line;
     - a pack without price ("Consultar") becomes a contact card;
     - data-pe-packs-limit="4": only the first N cards (home and the other
       pricing sections, with a "Ver todos los packs" link);
     - data-pe-packs-page="6": N at first, then [data-pe-packs-more]
       ("Cargar más") shows N more, hidden once all are visible;
     - the loading / empty / error blocks ([data-pe-packs-skeleton],
       [data-pe-packs-empty], [data-pe-packs-error]) follow data-state.
   Server data only ever goes in through textContent / attributes.
   ===================================================================== */
(function () {
  'use strict';

  var SCHEMES = ['color-scheme-4', 'color-scheme-5', 'color-scheme-3', 'color-scheme-1'];
  var CONTACT_URL = 'contacto.html';   // the contact page slug after the import (/contacto)

  function api() { return window.EntropicalPacks && typeof window.EntropicalPacks.listTypes === 'function' ? window.EntropicalPacks : null; }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function copyFor(slug) { var c = window.PE_PACKS_COPY || {}; return Object.prototype.hasOwnProperty.call(c, slug) ? c[slug] : null; }
  function n(x, one, many) { return x === 1 ? '1 ' + one : x + ' ' + many; }
  function validity(t) {
    var exp = t.expiresAt ? new Date(t.expiresAt) : null;
    if (exp && isNaN(exp.getTime())) exp = null;
    if (t.expiryMode === 'FIXED_DATE' && exp) {
      try { return 'Hasta el ' + new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(exp); } catch (e) { return ''; }
    }
    return t.validityDays ? 'Válido ' + t.validityDays + ' días' : '';
  }
  function facts(t) {
    var out = [];
    if (typeof t.credits === 'number') out.push(n(t.credits, 'reserva', 'reservas') + ' de ' + n(t.seatsPerCredit || 1, 'plaza', 'plazas'));
    var v = validity(t);
    if (v) out.push(v);
    return out.join(' · ');
  }
  function setText(el, txt) { if (!el) return; el.textContent = txt || ''; el.hidden = !txt; }

  /* one card ------------------------------------------------------------------ */
  function dressCard(card, i, type) {
    SCHEMES.forEach(function (s) { card.classList.remove(s); });
    card.classList.add(SCHEMES[i % SCHEMES.length]);
    var slug = card.getAttribute('data-pack-slug') || (type && type.slug) || '';
    var c = copyFor(slug) || {};
    setText(card.querySelector('[data-pe-copy="subtitle"]'), c.subtitle);
    setText(card.querySelector('[data-pe-copy="tag"]'), c.tag);
    var list = card.querySelector('[data-pe-copy="incluye"]');
    if (list) {
      var tpl = list.querySelector('[data-pe-copy-item]');
      $$('[data-pe-copy-item]', list).forEach(function (el, k) { if (k) el.remove(); });
      var items = Array.isArray(c.incluye) ? c.incluye : [];
      if (tpl) {
        items.forEach(function (txt, k) {
          var el = k ? tpl.cloneNode(true) : tpl;
          var label = el.querySelector('[data-pe-copy-text]') || el;
          label.textContent = String(txt);
          if (k) list.appendChild(el);
        });
      }
      var show = items.length > 0;
      list.hidden = !show;
      $$('[data-pe-copy-show="incluye"]', card).forEach(function (el) { el.hidden = !show; });
    }
    if (type) setText(card.querySelector('[data-pe-pack-facts]'), facts(type));
    // "Consultar": no online sale, the button goes to the contact page
    if (type && typeof type.priceCents !== 'number') {
      card.classList.add('is-consult');
      $$('[data-pack-buy], [data-entropical-pack-buy]', card).forEach(function (btn) {
        btn.removeAttribute('data-entropical-pack-buy');
        btn.removeAttribute('data-pack-buy');
        btn.setAttribute('href', CONTACT_URL);
        var label = btn.querySelector('.pe-pwr_label');   // pe-motion.js may have wrapped the label
        (label || btn).textContent = 'Contáctanos';
      });
    }
  }

  /* one list ------------------------------------------------------------------ */
  function setupList(container) {
    var limit = parseInt(container.getAttribute('data-pe-packs-limit') || '0', 10) || 0;
    var page = parseInt(container.getAttribute('data-pe-packs-page') || '0', 10) || 0;
    var shown = page;
    var more = container.parentNode ? container.parentNode.querySelector('[data-pe-packs-more]') : null;
    var dressed = false;

    function cards() { return $$('[data-pack-card]', container).filter(function (el) { return el.hasAttribute('data-pack-slug'); }); }
    function paginate() {
      var all = cards(), cap = limit || shown || all.length;
      all.forEach(function (el, i) { el.hidden = i >= cap; });
      if (more) more.hidden = !page || all.length <= cap;
    }
    function dress() {
      var all = cards();
      var p = api() ? api().listTypes() : Promise.resolve(null);
      p.then(function (list) {
        var bySlug = {};
        (list || []).forEach(function (t) { if (t && t.slug) bySlug[t.slug] = t; });
        all.forEach(function (card, i) { dressCard(card, i, bySlug[card.getAttribute('data-pack-slug')]); });
        dressed = true;
        paginate();
        container.setAttribute('data-pe-dressed', '');
      }, function () { all.forEach(function (card, i) { dressCard(card, i, null); }); paginate(); container.setAttribute('data-pe-dressed', ''); });
    }
    function onState() {
      var s = container.getAttribute('data-state');
      if (s === 'ready' && !dressed) dress();
    }
    if (more) {
      more.hidden = true;
      more.addEventListener('click', function (e) {
        e.preventDefault();
        var before = shown;
        shown += page;
        paginate();
        // keyboard users land on the first new card
        var first = cards()[before];
        if (first) {
          var f = first.querySelector('a, button');
          if (f) { try { f.focus({ preventScroll: false }); } catch (e) {} }
        }
      });
    }
    // Reintentar: the script has no public "render this list again", and this file never
    // fetches on its own. Ask the script's own fetcher; once the API answers, reload the
    // page so webflow-packs.js renders the list itself.
    $$('[data-pe-packs-retry]', container.parentNode || container).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (btn.getAttribute('aria-disabled') === 'true') return;
        var E = api();
        if (!E) { location.reload(); return; }
        btn.setAttribute('aria-disabled', 'true');
        var label = btn.textContent;
        btn.textContent = 'Reintentando…';
        E.listTypes().then(function (list) {
          if (list) { location.reload(); return; }
          btn.removeAttribute('aria-disabled');
          btn.textContent = label;
        }, function () { btn.removeAttribute('aria-disabled'); btn.textContent = label; });
      });
    });
    new MutationObserver(onState).observe(container, { attributes: true, attributeFilter: ['data-state'] });
    onState();
  }

  /* webflow-packs.js did not load (blocked, offline, not deployed) ---------------- */
  function noScript() {
    $$('[data-entropical-packs-list]').forEach(function (c) {
      if (!c.getAttribute('data-state')) c.setAttribute('data-state', 'error');
    });
    $$('[data-entropical-pack-redeem]').forEach(function (c) {
      if (c.childElementCount) return;
      var p = document.createElement('p');
      p.className = 'pe-packs_status';
      p.textContent = 'El canje no está disponible en este momento. Vuelve a intentarlo en unos minutos o escríbenos.';
      c.appendChild(p);
    });
  }

  /* pack card in the calendar lists ------------------------------------------
     Every Calendario list ([data-pe-list], js/pe-list-controls.js) gets one extra
     card at the end: "no date" packs, a call to action to /packs. It is added
     after Finsweet has indexed the list, so search / filters / sort never treat it
     as a result (it stays visible, also next to "no results"); if a re-render
     drops it, it comes back. Type classes are borrowed from the list's first real
     card so it matches every page. Price "Desde N €" from the live pack list. */
  function cls(card, sel, fallback) { var el = card && card.querySelector(sel); return el ? el.className : fallback; }
  function el(tag, className, text) { var n = document.createElement(tag); if (className) n.className = className; if (text != null) n.textContent = text; return n; }
  function buildCta(list) {
    var ref = list.querySelector('.pe-lc_card');
    var item = el('div', 'collection-item pe-lc_item pe-pack-cta');
    item.setAttribute('role', 'listitem');
    item.setAttribute('data-pe-pack-cta', '');
    var card = el('div', 'eventos_item pe-lc_card is-pack');
    var top = el('div', 'eventos_top-item-content pe-lc_top');
    var date = el('div', 'eventos_date-wrapper pe-lc_date');
    date.appendChild(el('div', cls(ref, '[fs-list-field="day"]', 'f-text-stat').replace('w-dyn-bind-empty', ''), 'Pack'));
    var price = el('div', 'precio_content-wrap pe-lc_price');
    var from = el('div', 'f-text-small pe-pack-cta_from', 'Desde');
    var amount = el('div', 'precio ' + cls(ref, '.precio', 'f-text-stat').replace(/\bprecio\b|w-dyn-bind-empty/g, '').trim(), '');
    from.hidden = true; amount.hidden = true;
    price.appendChild(from); price.appendChild(amount);
    top.appendChild(date); top.appendChild(price);
    var body = el('div', 'event2_item-content pe-lc_body');
    body.appendChild(el('div', cls(ref, '[fs-list-field="name"]', 'f-text-h4').replace('w-dyn-bind-empty', ''), 'Paga hoy, elige fecha después'));
    body.appendChild(el('p', 'f-text-body pe-lc_text', 'Compra un pack y reserva cuando quieras. También para regalar.'));
    var tags = el('div', 'button-group max-width-full gap-0 pe-lc_tags');
    tags.appendChild(el('div', 'tag is-category-tag', 'Packs'));
    var cta = el('div', 'button-group max-width-full pe-lc_cta');
    var a1 = el('a', 'button is-alternate is-simple max-width-full w-button f-text-label', 'Ver packs');
    a1.href = 'packs.html';
    var a2 = el('a', 'button is-secondary is-alternate is-simple max-width-full w-button f-text-label', 'Regalar un pack');
    a2.href = 'packs.html#regalo';
    cta.appendChild(a1); cta.appendChild(a2);
    card.appendChild(top); card.appendChild(body); card.appendChild(tags); card.appendChild(cta);
    item.appendChild(card);
    var E = api();
    if (E) E.listTypes().then(function (types) {
      var cents = (types || []).map(function (t) { return t.priceCents; }).filter(function (c) { return typeof c === 'number' && c > 0; });
      if (!cents.length) return;
      var min = Math.min.apply(null, cents);
      amount.textContent = (min / 100).toLocaleString('es-ES', { minimumFractionDigits: min % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
      from.hidden = false; amount.hidden = false;
    }, function () {});
    return item;
  }
  function initListCta() {
    if (/(^|\/)packs(\.html)?$/.test(location.pathname)) return;    // /packs links to itself otherwise
    $$('[data-pe-list]').forEach(function (list) {
      if (!list.querySelector('.pe-lc_card')) return;
      var item = buildCta(list);
      function keep() { if (item.parentNode !== list || list.lastElementChild !== item) list.appendChild(item); }
      keep();
      new MutationObserver(function () { if (item.parentNode !== list || list.lastElementChild !== item) requestAnimationFrame(keep); })
        .observe(list, { childList: true });
    });
  }
  // after Finsweet has indexed (and possibly re-indexed) the lists
  function whenListsSettled(fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    if (document.readyState === 'complete') setTimeout(go, 1200);
    else window.addEventListener('load', function () { setTimeout(go, 1200); });
  }

  function init() {
    $$('[data-entropical-packs-list]').forEach(setupList);
    whenListsSettled(initListCta);
    if (!api()) noScript();
  }

  // webflow-packs.js is deferred like this file and runs first; 'load' covers a slow async copy
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { if (api()) init(); else window.addEventListener('load', init); });
  else if (api()) init();
  else window.addEventListener('load', init);
})();

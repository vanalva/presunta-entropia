/* ============================================================
   PRESUNTA ENTROPÍA — booking flow glue (site-fixes 2026-10-07/08)
   Carlos: "land → see dates → pick → see the content → buy",
   with no step that does not earn its place.

   1. Reservar = book now. Every [data-pe-add] + data-item-id="<entropical id>"
      (a dated session) opens the booking dialog: the session, a seat
      stepper, the total, "Continuar al pago" (puts those seats in the
      cart and goes straight to the one-step checkout) or "Añadir al
      carrito". Packs work the same way (click → dialog → pay).
      Without an id (an experience with no date yet) it falls back to
      the calendar overlay narrowed to that experience
      (data-booking-item="<slug>").
   2. The small cart button. Next to every Reservar with an id this
      script puts a square cart button ([data-pe-cart-add]): one click
      adds one seat. Nothing opens; the cart's own notification (top
      right) says so, and its "Ver carrito" opens the cart panel here
      instead of leaving for the checkout page.
   3. [data-pe-card-href]: a click anywhere on a card that is not a link
      or button opens that URL (the detail page). The title inside stays
      a real link for keyboards and screen readers.
   4. Glass: while any overlay is open the page behind holds still.

   Webflow: custom code embed (site-wide, before </body>), after
   webflow-cart.js. Binds by delegation and watches the DOM, so buttons
   rendered later (CMS, the Explorador) work without re-binding.
   ============================================================ */
(function () {
  'use strict';

  var ADDED_MS = 2200;
  var MAX_SEATS = 10;
  var TZ = 'Europe/Madrid';

  function cart() { return window.EntropicalCart || null; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmt(iso, o) { try { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: TZ }, o)).format(new Date(iso)); } catch (e) { return ''; } }
  function euros(n) { return (Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function openCalendar(slug) {
    if (window.PEBookingModal) { window.PEBookingModal.open(slug || ''); return; }
    var a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-modal-open', 'modal-1');
    if (slug) a.setAttribute('data-booking-item', slug);
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function openCartPanel() {
    var c = cart();
    var cal = document.getElementById('modal-1');
    if (cal && cal.classList.contains('is-open') && window.PEBookingModal) window.PEBookingModal.close();
    if (c && typeof c.openModal === 'function') c.openModal();
  }

  // the session behind an id, from the platform sync (window.PE_CMS)
  // a session's own seats, price and promo (data/pe-cms.js sesionesAll), the experience's otherwise
  function session(id) {
    var db = window.PE_CMS;
    if (!db || !db.sesiones) return null;
    var list = db.sesionesAll || db.sesiones, s = null;
    for (var i = 0; i < list.length; i++) if (list[i].itemId === id) { s = list[i]; break; }
    var all = (db.talleres || []).concat(db.cenas || [], db['team-building'] || []);
    var slug = s ? s.item : null, it = null;
    for (var j = 0; j < all.length; j++) {
      if ((slug && all[j].slug === slug) || (!slug && all[j].entropicalId === id)) { it = all[j]; break; }
    }
    if (!it) return null;
    return {
      id: id, iso: s ? s.iso : it.nextSession, item: it,
      seatsLeft: s && typeof s.seatsLeft === 'number' ? s.seatsLeft : it.seatsLeft,
      capacity: (s && s.capacity) || it.capacityTotal,
      precio: s && typeof s.precio === 'number' ? s.precio : it.precio,
      precioOriginal: s ? s.precioOriginal : null
    };
  }
  // test data (data/pe-fixtures.js) never reaches the cart
  function isTest(id) { return /^test-/.test(id || ''); }
  function refuseTest() { var c = cart(); if (c && c.notify) c.notify('Sesión de prueba: no se puede reservar', 'warning'); }

  /* ---------- 2. add to cart (the small cart button, the console) ---------- */
  function addToCart(btn, id, qty) {
    if (isTest(id)) { refuseTest(); return Promise.resolve(); }
    var c = cart();
    if (!c || typeof c.addToCart !== 'function') return Promise.reject(new Error('cart'));
    var s = session(id), it = s && s.item;
    var price = s && typeof s.precio === 'number' ? s.precio : null;
    var name = it ? it.name : null;
    if (btn) { btn.setAttribute('aria-busy', 'true'); btn.classList.add('is-adding'); }
    return Promise.resolve(c.addToCart(id, name, price, qty || 1, it && it.image || null)).then(function () {
      if (btn) { btn.removeAttribute('aria-busy'); btn.classList.remove('is-adding'); setAdded(btn); }
      var line = (c.getCart().items || []).filter(function (x) { return x.itemId === id; })[0];
      if (c.notify) c.notify((line ? line.name : name || 'Sesión') + ' añadido al carrito', 'success');
    }, function (err) {
      if (btn) { btn.removeAttribute('aria-busy'); btn.classList.remove('is-adding'); }
      throw err;
    });
  }
  function setAdded(btn) {
    if (!btn || btn.hasAttribute('data-pe-added')) return;
    btn.setAttribute('data-pe-added', '');
    btn.classList.add('is-added');
    var label = btn.getAttribute('aria-label');
    btn.setAttribute('aria-label', 'Añadido al carrito');
    setTimeout(function () {
      btn.classList.remove('is-added');
      btn.removeAttribute('data-pe-added');
      if (label) btn.setAttribute('aria-label', label);
    }, ADDED_MS);
  }

  // next to every Reservar with a session id: the site's own cart button (the dock's
  // .cart-header_button, same skin and icon), without its badge and without data-cart-toggle
  var CART_SVG = '<svg class="cart-header_icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M9 22C9.55228 22 10 21.5523 10 21C10 20.4477 9.55228 20 9 20C8.44772 20 8 20.4477 8 21C8 21.5523 8.44772 22 9 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<path d="M20 22C20.5523 22 21 21.5523 21 21C21 20.4477 20.5523 20 20 20C19.4477 20 19 20.4477 19 21C19 21.5523 19.4477 22 20 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<path d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  function enhance() {
    queued = false;
    document.querySelectorAll('[data-pe-add]').forEach(function (b) {
      if (b.closest('[data-pe-tcard-template]') || b.hidden) return;
      // joined CTA pairs (the inner-page heroes, owned by the hero work) keep their shape:
      // their Reservar still opens the dialog, without a cart button. Opt out with data-pe-no-cart.
      if (b.classList.contains('hero_cta') || b.closest('[data-pe-no-cart]')) return;
      var id = b.getAttribute('data-item-id');
      var row = b.parentNode && b.parentNode.classList && b.parentNode.classList.contains('pe-book') ? b.parentNode : null;
      if (!id) { if (row) row.parentNode.replaceChild(b, row); return; }
      if (!row) {
        row = el('span', 'pe-book');
        b.parentNode.insertBefore(row, b);
        row.appendChild(b);
      }
      var add = row.querySelector('[data-pe-cart-add]');
      if (!add) {
        add = el('button', 'cart-header_button pe-book_cart');
        add.type = 'button';
        add.setAttribute('data-pe-cart-add', '');
        add.innerHTML = CART_SVG;
        row.appendChild(add);
      }
      if (add.getAttribute('data-item-id') !== id) add.setAttribute('data-item-id', id);   // only on change: the observer watches this attribute
      var name = (b.getAttribute('aria-label') || '').replace(/^Reservar\s*/, '');
      add.setAttribute('aria-label', 'Añadir al carrito' + (name ? ': ' + name : ''));
      add.title = 'Añadir al carrito';
    });
  }
  var queued = false;
  function queueEnhance() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }

  /* ---------- 1. the booking dialog ---------- */
  var dlg = null, lastFocus = null;
  function closeBooking() {
    if (!dlg) return;
    var d = dlg; dlg = null;
    d.classList.remove('is-open');
    document.removeEventListener('keydown', onKey, true);
    d.remove();   // the platform dialogs close at once too
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (!dlg) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeBooking(); return; }
    if (e.key === 'Tab') {
      var f = dlg.querySelectorAll('button:not([disabled]), a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }
  function openBooking(btn, id) {
    var s = session(id);
    if (!s) {   // no synced data for this id: the old one-click path, straight to checkout
      addToCart(null, id, 1).then(function () { var c = cart(); if (c && c.checkout) c.checkout(); }, function () {});
      return;
    }
    closeBooking();
    lastFocus = btn;
    var it = s.item;
    var left = typeof s.seatsLeft === 'number' ? s.seatsLeft : null;
    var max = Math.max(1, Math.min(MAX_SEATS, left === null ? MAX_SEATS : left));
    var price = typeof s.precio === 'number' ? s.precio : null;
    var was = s.precioOriginal && price !== null && s.precioOriginal > price ? s.precioOriginal : null;
    var qty = 1;

    var root = el('div', 'pe-bookdlg');
    root.setAttribute('data-flwr', '');
    var panel = el('div', 'pe-bookdlg_panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'pe-bookdlg-title');
    var close = el('button', 'pe-bookdlg_close f-text-label');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8"/></svg>';
    close.addEventListener('click', closeBooking);
    panel.appendChild(close);

    var head = el('div', 'pe-bookdlg_head');
    var media = el('div', 'pe-bookdlg_media');
    var img = el('img', 'pe-bookdlg_img');
    img.alt = '';
    if (window.PE_CMS && window.PE_CMS.setImage) window.PE_CMS.setImage(img, it.image, it.name); else if (it.image) img.src = it.image;
    media.appendChild(img);
    head.appendChild(media);
    var txt = el('div', 'pe-bookdlg_txt');
    txt.appendChild(el('div', 'pe-bookdlg_eyebrow f-text-label f-text-ui-sm', 'Reservar'));
    var h = el('h2', 'pe-bookdlg_title f-text-h4', it.name);
    h.id = 'pe-bookdlg-title';
    txt.appendChild(h);
    var when = s.iso ? cap(fmt(s.iso, { weekday: 'long', day: 'numeric', month: 'long' })) + ' · ' + fmt(s.iso, { hour: '2-digit', minute: '2-digit' }) : '';
    txt.appendChild(el('p', 'pe-bookdlg_when f-text-body', [when, it.duracion].filter(Boolean).join(' · ')));
    head.appendChild(txt);
    panel.appendChild(head);

    var rows = el('div', 'pe-bookdlg_rows');
    // seats: the ficha's meter + a stepper
    var r1 = el('div', 'pe-bookdlg_row');
    var l1 = el('div', 'pe-bookdlg_label');
    l1.appendChild(el('div', 'f-text-small pe-bookdlg_k', 'Plazas'));
    if (left !== null) {
      var meter = el('span', 'pe-ficha_seats is-' + (left <= 0 ? 'full' : left <= 5 ? 'low' : 'ok'));
      var m = el('span', 'pe-ficha_meter');
      m.setAttribute('aria-hidden', 'true');
      var total = s.capacity || 16, segs = Math.max(1, Math.min(16, total)), on = Math.max(left > 0 ? 1 : 0, Math.round(Math.min(left, total) / total * segs));
      for (var i = 0; i < segs; i++) m.appendChild(el('span', 'pe-ficha_seg' + (i < on ? ' is-on' : '')));
      meter.appendChild(m);
      meter.appendChild(el('span', 'pe-ficha_seats-text f-text-small', left <= 0 ? 'Completo' : (left === 1 ? 'Queda 1 plaza' : 'Quedan ' + left + ' plazas')));
      l1.appendChild(meter);
    }
    r1.appendChild(l1);
    var step = el('div', 'pe-bookdlg_step');
    step.setAttribute('role', 'group');
    step.setAttribute('aria-label', 'Número de plazas');
    var minus = el('button', 'pe-bookdlg_stepbtn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Una plaza menos');
    var out = el('output', 'pe-bookdlg_qty f-text-h5', '1'); out.setAttribute('aria-live', 'polite');
    var plus = el('button', 'pe-bookdlg_stepbtn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'Una plaza más');
    step.appendChild(minus); step.appendChild(out); step.appendChild(plus);
    r1.appendChild(step);
    rows.appendChild(r1);
    // total
    var r2 = el('div', 'pe-bookdlg_row is-total');
    var l2 = el('div', 'pe-bookdlg_label');
    l2.appendChild(el('div', 'f-text-small pe-bookdlg_k', 'Total'));
    var unit = el('div', 'f-text-small pe-bookdlg_unit', price !== null ? euros(price) + ' por plaza' : '');
    if (was) { unit.appendChild(document.createTextNode(' · ')); unit.appendChild(el('s', 'pe-bookdlg_was', euros(was))); unit.appendChild(el('span', 'pe-bookdlg_promo f-text-label f-text-ui-sm', 'Promo −' + Math.round((1 - price / was) * 100) + '%')); }
    l2.appendChild(unit);
    r2.appendChild(l2);
    var tot = el('div', 'pe-bookdlg_total f-text-h3', price !== null ? euros(price) : '—');
    r2.appendChild(tot);
    rows.appendChild(r2);
    panel.appendChild(rows);

    function sync() {
      out.textContent = String(qty);
      minus.disabled = qty <= 1;
      plus.disabled = qty >= max;
      if (price !== null) tot.textContent = euros(price * qty);
    }
    minus.addEventListener('click', function () { if (qty > 1) { qty--; sync(); } });
    plus.addEventListener('click', function () { if (qty < max) { qty++; sync(); } });
    sync();

    var ctas = el('div', 'pe-bookdlg_ctas');
    var pay = el('button', 'button pe-bookdlg_cta w-button f-text-label', 'Continuar al pago');
    pay.type = 'button'; pay.setAttribute('data-ep-role', 'primary');
    var later = el('button', 'button is-secondary is-alternate pe-bookdlg_cta w-button f-text-label', 'Añadir al carrito');
    later.type = 'button'; later.setAttribute('data-ep-role', 'secondary');
    ctas.appendChild(pay); ctas.appendChild(later);
    panel.appendChild(ctas);
    panel.appendChild(el('p', 'pe-bookdlg_note f-text-small', 'El pago se completa en el siguiente paso.'));
    var err = el('p', 'pe-bookdlg_err f-text-small');
    err.setAttribute('role', 'alert');
    panel.appendChild(err);

    if (left === 0) { pay.disabled = true; later.disabled = true; plus.disabled = true; }

    function busy(on, b) { pay.disabled = on; later.disabled = on; if (b) b.classList.toggle('is-adding', on); }
    // the seats picked here are the seats in the cart for this session (not added on top)
    function put() {
      var c = cart();
      var line = c && c.getCart ? (c.getCart().items || []).filter(function (x) { return x.itemId === id; })[0] : null;
      if (line && c.updateQuantity) { c.updateQuantity(id, qty); return Promise.resolve(); }
      return Promise.resolve(c.addToCart(id, it.name, price, qty, it.image || null));
    }
    pay.addEventListener('click', function () {
      var c = cart();
      if (!c) return;
      if (isTest(id)) { refuseTest(); return; }
      err.textContent = '';
      busy(true, pay);
      put().then(function () { c.checkout(); }, function () { busy(false, pay); err.textContent = 'No se pudo reservar. Inténtalo de nuevo.'; });
    });
    later.addEventListener('click', function () {
      var c = cart();
      if (!c) return;
      if (isTest(id)) { refuseTest(); return; }
      err.textContent = '';
      busy(true, later);
      put().then(function () {
        busy(false, later);
        closeBooking();
        if (c.notify) c.notify(it.name + ' añadido al carrito', 'success');
      }, function () { busy(false, later); err.textContent = 'No se pudo añadir. Inténtalo de nuevo.'; });
    });

    root.addEventListener('click', function (e) { if (e.target === root) closeBooking(); });
    root.appendChild(panel);
    document.body.appendChild(root);
    dlg = root;
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { (left === 0 ? close : pay).focus(); }, 30);
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    // 2. the small cart button: add one seat, nothing opens
    var add = e.target.closest('[data-pe-cart-add]');
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      if (add.getAttribute('aria-busy') === 'true') return;
      var aid = add.getAttribute('data-item-id');
      if (!aid) return;
      addToCart(add, aid, 1).catch(function () {});
      return;
    }
    // 1. Reservar: the booking dialog (no id: the calendar)
    var book = e.target.closest('[data-pe-add]');
    if (book) {
      e.preventDefault();
      e.stopPropagation();
      var id = book.getAttribute('data-item-id');
      if (!id || !cart()) { openCalendar(book.getAttribute('data-booking-item')); return; }
      openBooking(book, id);
      return;
    }
    // the cart notification's "Ver carrito": open the cart here, not the checkout page
    var view = e.target.closest('.cart-notification-link');
    if (view) {
      e.preventDefault();
      var n = document.getElementById('cart-notification');
      if (n) n.remove();
      openCartPanel();
      return;
    }
    // 3. whole-card links
    var card = e.target.closest('[data-pe-card-href]');
    if (card && !e.target.closest('a, button, input, label, select, textarea')) {
      var href = card.getAttribute('data-pe-card-href');
      if (href) {
        if (e.metaKey || e.ctrlKey) window.open(href, '_blank');
        else window.location.href = href;
      }
    }
  }, true);

  /* 4. Glass: while any overlay is open (cart, calendar, packs dialogs, booking dialog,
     console lightbox) the page behind holds still. A backdrop blur is recomputed on
     every frame that something behind it moves, which is what made the glass
     feel slow. html.pe-glass-on pauses the CSS animations (pe-overlays.css);
     here GSAP and the PE-83 console pause too, and resume on close. */
  var GLASS_SEL = '.cart-modal_component.is-open, #modal-1.is-open, .ep-backdrop, .pe-lightbox.is-open, .pe-bookdlg';
  var glassOn = false, glassQueued = false;
  function syncGlass() {
    glassQueued = false;
    var on = !!document.querySelector(GLASS_SEL);
    if (on === glassOn) return;
    glassOn = on;
    document.documentElement.classList.toggle('pe-glass-on', on);
    if (window.gsap && window.gsap.globalTimeline) {
      if (on) window.gsap.globalTimeline.pause(); else window.gsap.globalTimeline.resume();
    }
    if (window.PEConsole && typeof window.PEConsole.freeze === 'function') window.PEConsole.freeze(on);
  }
  function queueGlass() { if (!glassQueued) { glassQueued = true; requestAnimationFrame(syncGlass); } }
  function watch() {
    var mo = new MutationObserver(queueGlass);
    ['.cart-modal_component', '#modal-1'].forEach(function (sel) {
      var x = document.querySelector(sel);
      if (x) mo.observe(x, { attributes: true, attributeFilter: ['class'] });
    });
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains('pe-lightbox')) mo.observe(n, { attributes: true, attributeFilter: ['class'] });
        });
      });
      queueGlass();
    }).observe(document.body, { childList: true });
    // new Reservar buttons (CMS, the Explorador, ids filled in later) get their cart button
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' || m.addedNodes.length || m.removedNodes.length) { queueEnhance(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-id', 'data-pe-add'] });
    enhance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.PEBooking = { open: function (id) { openBooking(null, id); }, add: function (id, qty) { return addToCart(null, id, qty || 1); } };
})();

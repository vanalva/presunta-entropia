/* ============================================================
   PRESUNTA ENTROPÍA — CMS list hydrator (local preview only)
   The Webflow export ships empty CMS templates (.w-dyn-bind-empty
   placeholders). On Webflow, the CMS fills them; locally this file
   clones each template item and fills it from window.PE_CMS so
   Juan can preview real-looking lists, swipers and the calendar.
   Load AFTER pe-cms.js. Webflow migration: delete nothing — this
   script no-ops when it finds no .w-dyn-bind-empty placeholders.
   ============================================================ */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function minutes(duracion) {
        // "3 Horas y media" -> 210, "2 Horas y media" -> 150, "4 Horas" -> 240
        var h = (duracion.match(/(\d+)\s*Hora/) || [])[1];
        var media = /media/i.test(duracion);
        if (!h) return 180;
        return parseInt(h, 10) * 60 + (media ? 30 : 0);
    }

    function firstSession(db, slug) {
        var list = (db.sesiones || []).filter(function (s) { return s.item === slug; });
        return list.length ? list[0] : null;
    }

    function fillText(el, txt) {
        if (!el) return;
        el.textContent = txt;
        el.classList.remove('w-dyn-bind-empty');
    }

    /* ---------- A. talleres_card grids + swiper card lists ---------- */
    function hydrateTalleresCards(db) {
        document.querySelectorAll('.w-dyn-items:not([data-pe-tcards])').forEach(function (list) {
            var tpl = list.querySelector('.talleres_card.w-dyn-item');
            if (!tpl || !tpl.querySelector('.w-dyn-bind-empty')) return;
            var wrap = list;
            db.talleres.forEach(function (it, i) {
                var card = tpl.cloneNode(true);
                var ses = firstSession(db, it.slug);
                // image
                var img = card.querySelector('.productos_card-image');
                if (img) { db.setImage(img, it.image, it.name); img.classList.remove('w-dyn-bind-empty'); }
                // title + description
                fillText(card.querySelector('h3'), it.name);
                var tagline = card.querySelector('.text-style-tagline');
                if (tagline && tagline.classList.contains('w-dyn-bind-empty')) {
                    if (it.subtitle) fillText(tagline, it.subtitle); else tagline.style.display = 'none';
                }
                fillText(card.querySelector('p.w-dyn-bind-empty'), it.summary);
                // meta buttons: [precio][promo][soldout][fecha?][min pair][min pair]
                var emptyBtns = card.querySelectorAll('.button.w-dyn-bind-empty');
                if (emptyBtns[0]) fillText(emptyBtns[0], it.precio + '€');
                if (emptyBtns[1]) fillText(emptyBtns[1], ses ? ses.fecha.split('-').reverse().join('/') : 'Próximamente');
                var minPairs = card.querySelectorAll('.button > .w-dyn-bind-empty');
                if (minPairs.length) {
                    fillText(minPairs[0], String(it.durationMinutes || minutes(it.duracion || '')));
                    // hide the duplicated "Minutos" chip the template carries
                    for (var k = 1; k < minPairs.length; k++) {
                        var b = minPairs[k].closest('.button');
                        if (b) b.style.display = 'none';
                    }
                }
                // badges come from platform data only: "Agotado" when seats-left is 0;
                // promo stays hidden (the offer fields are not synced)
                card.querySelectorAll('.button').forEach(function (btn) {
                    if (/^\s*Promo\s*$/i.test(btn.textContent)) btn.style.display = 'none';
                });
                var promo = card.querySelector('.is-promo');
                var sold = card.querySelector('.is-soldout');
                if (promo) promo.style.display = 'none';
                if (sold) sold.style.display = it.seatsLeft === 0 ? '' : 'none';
                // links
                var href = 'taller-item.html?slug=' + it.slug;
                card.querySelectorAll('a').forEach(function (a) { a.href = href; });
                card.style.cursor = 'pointer';
                card.addEventListener('click', function (e) {
                    if (!e.target.closest('a')) window.location.href = href;
                });
                wrap.appendChild(card);
            });
            tpl.remove();
            var dyn = wrap.closest('.w-dyn-list');
            if (dyn) { var empty = dyn.querySelector('.w-dyn-empty'); if (empty) empty.style.display = 'none'; }
        });
    }

    /* ---------- B. eventos_item (#calendario Finsweet list) ---------- */
    function hydrateEventos(db) {
        document.querySelectorAll('.eventos_item').forEach(function (tpl) {
            if (!tpl.querySelector('.w-dyn-bind-empty')) return;
            var host = tpl.parentElement;
            var items = (db.sesiones || []).slice(0, 8);
            items.forEach(function (ses, i) {
                var col = ses.coleccion === 'cenas' ? db.cenas : db.talleres;
                var it = null;
                for (var j = 0; j < col.length; j++) if (col[j].slug === ses.item) { it = col[j]; break; }
                if (!it) return;
                var card = tpl.cloneNode(true);
                var d = new Date(ses.fecha + 'T12:00:00');
                fillText(card.querySelector('[fs-list-field="week-day"]'), DIAS[d.getDay()]);
                fillText(card.querySelector('[fs-list-field="day"]'), String(d.getDate()));
                fillText(card.querySelector('[fs-list-field="mes"]'), MESES[d.getMonth()]);
                var dt = card.querySelector('[data-date-translate]');
                if (dt) fillText(dt, MESES[d.getMonth()]);
                // price (template has "€" + empty twin — fill the twin, keep one)
                var prices = card.querySelectorAll('[fs-list-field="price"]');
                if (prices.length) {
                    fillText(prices[0], '€' + it.precio);
                    for (var k = 1; k < prices.length; k++) prices[k].style.display = 'none';
                }
                var before = card.querySelector('.precio-antes');
                if (before) before.style.display = 'none';
                fillText(card.querySelector('[fs-list-field="name"]'), it.name);
                var sub = card.querySelector('.event2_title p');
                if (sub) fillText(sub, it.subtitle || it.summary || '');
                // availability: "seats-left / capacity-total" from the platform sync
                var left = it.seatsLeft;
                var avail = card.querySelectorAll('.disponibilidad_content-wrap .w-dyn-bind-empty');
                if (avail[0] && left !== null && left !== undefined) fillText(avail[0], String(left));
                if (avail[1] && it.capacityTotal) fillText(avail[1], String(it.capacityTotal));
                // tags
                var cat = card.querySelector('[fs-list-field="category"]');
                if (cat) fillText(cat, it.tipo);
                card.querySelectorAll('[fs-list-field="promo"]').forEach(function (t) {
                    if (t.classList.contains('is-filter-fomo-tag')) t.style.display = left > 0 && left <= 3 ? '' : 'none';
                    else t.style.display = 'none';
                });
                // Reservar on a dated session puts it straight in the cart
                // (js/pe-booking-flow.js, [data-pe-add]); no modal detour.
                // Webflow: bind data-item-id to the CMS field entropical-id.
                card.querySelectorAll('[data-cart-add]').forEach(function (b) { b.remove(); });
                card.querySelectorAll('a').forEach(function (a) {
                    if (/RESERVA/i.test(a.textContent)) {
                        a.removeAttribute('data-modal-open');
                        a.setAttribute('data-pe-add', '');
                        a.setAttribute('data-item-id', ses.itemId || it.entropicalId || '');
                        a.setAttribute('data-booking-item', it.slug);
                        a.setAttribute('aria-label', 'Reservar ' + it.name + ', ' + DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]);
                    }
                });
                // any remaining unfilled binds: hide
                card.querySelectorAll('.w-dyn-bind-empty').forEach(function (e) { e.style.display = 'none'; });
                // link buttons to the item page / booking modal
                var href = ses.coleccion === 'cenas' ? 'cenas.html' : 'taller-item.html?slug=' + it.slug;
                card.querySelectorAll('a').forEach(function (a) {
                    if (/SABER|VER/i.test(a.textContent)) a.href = href;
                });
                // the whole card opens the detail page (title/Saber más stay real links)
                card.setAttribute('data-pe-card-href', href);
                card.style.cursor = 'pointer';
                host.appendChild(card);
            });
            tpl.remove();
            var dyn = host.closest('.w-dyn-list');
            if (dyn) { var empty = dyn.querySelector('.w-dyn-empty'); if (empty) empty.style.display = 'none'; }
            // the Finsweet "no results" banner outside the list
            document.querySelectorAll('[fs-list-element="empty"], .eventos_empty').forEach(function (e) { e.style.display = 'none'; });
        });
    }

    /* ---------- C. talleres_event_item placeholder cards (la-escuela) ---------- */
    function hydrateEventCards(db) {
        var cards = document.querySelectorAll('.talleres_event_item');
        if (!cards.length) return;
        cards.forEach(function (card, i) {
            var img = card.querySelector('.talleres_event_image');
            if (!img || img.src.indexOf('Placeholder') === -1 && img.src.indexOf('placeholder') === -1) return;
            var it = db.talleres[i % db.talleres.length];
            var ses = firstSession(db, it.slug);
            db.setImage(img, it.image, it.name);
            var title = card.querySelector('h3');
            if (title) title.textContent = it.name;
            var desc = card.querySelector('.text-size-regular');
            if (desc) desc.textContent = it.summary;
            if (ses) {
                var d = new Date(ses.fecha + 'T12:00:00');
                var dw = card.querySelector('.talleres_event_date-wrapper');
                if (dw) {
                    var small = dw.querySelectorAll('div');
                    if (small[0]) small[0].textContent = DIAS[d.getDay()];
                    if (small[1]) small[1].textContent = String(d.getDate());
                    if (small[2]) small[2].textContent = MESES[d.getMonth()] + ' ' + d.getFullYear();
                }
            }
            var link = card.querySelector('a.talleres_event_item-link') || card.querySelector('a');
            if (link) link.href = 'taller-item.html?slug=' + it.slug;
        });
    }


    /* ---------- D. productos_card swiper templates (talleres/cenas/team-building) ---------- */
    function hydrateProductosSwipers(db) {
        document.querySelectorAll('.slider_list .w-dyn-list').forEach(function (list) {
            var tplItem = list.querySelector('.w-dyn-item');
            if (!tplItem || !tplItem.querySelector('.w-dyn-bind-empty')) return;
            var sliderList = list.closest('.slider_list');
            var isCenas = /cenas/.test(location.pathname);
            var data = isCenas ? db.cenas.concat(db.talleres.slice(0, 3)) : db.talleres;
            data.forEach(function (it) {
                var item = tplItem.cloneNode(true);
                var img = item.querySelector('.productos_card-image');
                if (img) db.setImage(img, it.image, it.name);
                fillText(item.querySelector('h3'), it.name);
                var tag = item.querySelector('.text-style-tagline');
                if (tag) { if (it.subtitle) fillText(tag, it.subtitle); else tag.style.display = 'none'; }
                fillText(item.querySelector('p.w-dyn-bind-empty'), it.summary);
                var href = (db.talleres.indexOf(it) !== -1)
                    ? 'taller-item.html?slug=' + it.slug
                    : 'cenas.html';
                item.querySelectorAll('a').forEach(function (a) { a.href = href; });
                // flatten: each item becomes a direct swiper child (a real slide)
                sliderList.appendChild(item);
            });
            list.remove();
        });
    }

    /* ---------- E. pe-tcard: the workshop card (listing + similares) ----------
       One template per list: [data-pe-tcards] > [data-pe-tcard-template].
       Order: dated sessions first (soonest first), then "Próximamente".
       Optional on the list: data-pe-tcards-exclude="<slug>" (the current
       item on its own page; "auto" = ?slug=), data-pe-tcards-limit="6".
       Webflow: the CMS list renders one card per item; bind
         image -> hero-image, name -> name (link: item page),
         summary -> short-description, price -> price-current,
         seats -> seats-left / capacity-total, date badge -> next-session-at,
         Reservar data-item-id -> entropical-id (hide when no future date). */
    var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    function hydrateTcards(db) {
        document.querySelectorAll('[data-pe-tcards]').forEach(function (list) {
            var tpl = list.querySelector('[data-pe-tcard-template]');
            if (!tpl || !tpl.querySelector('.w-dyn-bind-empty')) return;
            var ex = list.getAttribute('data-pe-tcards-exclude');
            if (ex === 'auto') ex = new URLSearchParams(location.search).get('slug') || (db.talleres[0] && db.talleres[0].slug);
            var limit = parseInt(list.getAttribute('data-pe-tcards-limit'), 10) || 99;
            // data-pe-tcards-person="auto": only the workshops of the profile on screen (persona.html?slug=)
            var who = list.getAttribute('data-pe-tcards-person');
            var person = who && db.findPersona ? db.findPersona(who === 'auto' ? new URLSearchParams(location.search).get('slug') : who) : null;
            var items = db.talleres.filter(function (it) {
                if (it.slug === ex) return false;
                if (who) return !!(person && person.items && person.items.indexOf(it.slug) !== -1);
                return true;
            }).map(function (it) {
                return { it: it, ses: firstSession(db, it.slug) };
            });
            items.sort(function (a, b) {
                if (a.ses && b.ses) return a.ses.iso < b.ses.iso ? -1 : 1;
                return a.ses ? -1 : b.ses ? 1 : 0;
            });
            items.slice(0, limit).forEach(function (x) {
                var it = x.it, ses = x.ses;
                // the Explorador card (js/pe-explorer.js) when it is on the page: one card site-wide
                var shared = window.PEExplorer && window.PEExplorer.card(it.slug);
                if (shared) { list.appendChild(shared); return; }
                var card = tpl.cloneNode(true);
                card.removeAttribute('data-pe-tcard-template');
                var q = function (k) { return card.querySelector('[data-pe-tcard="' + k + '"]'); };
                var href = 'taller-item.html?slug=' + encodeURIComponent(it.slug);
                var img = q('image');
                if (img) { db.setImage(img, it.image, it.name); img.classList.remove('w-dyn-bind-empty'); }
                var name = q('name');
                if (name) { fillText(name, it.name); name.href = href; }
                fillText(q('summary'), it.summary || '');
                fillText(q('meta'), [it.tipo, it.duracion].filter(Boolean).join(' · '));
                fillText(q('price'), it.precio !== null && it.precio !== undefined ? it.precio + '€' : '—');
                var seats = q('seats');
                if (seats) {
                    var n = it.seatsLeft;
                    if (!ses || n === null || n === undefined) fillText(seats, it.capacityTotal ? it.capacityTotal + ' plazas' : '—');
                    else if (n <= 0) { fillText(seats, 'Completo'); card.classList.add('is-full'); }
                    else { fillText(seats, (n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas')); if (n <= 5) seats.classList.add('is-low'); }
                }
                // filter keys read by the listing's filter bar
                var kf = card.querySelector('[data-todos-field="fecha"]');
                if (kf) fillText(kf, ses ? ses.fecha.split('-').reverse().join('/') : 'Próximamente');
                var kd = card.querySelector('[data-todos-field="duracion"]');
                if (kd) fillText(kd, String(it.durationMinutes || ''));
                var d = ses ? new Date(ses.fecha + 'T12:00:00') : null;
                fillText(q('day'), d ? String(d.getDate()) : '');
                fillText(q('month'), d ? MESES[d.getMonth()] : 'Próximamente');
                var badge = q('badge');
                if (badge) {
                    badge.classList.toggle('is-soon', !d);
                    if (d) badge.setAttribute('aria-label', DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES_LARGO[d.getMonth()]);
                }
                var add = card.querySelector('[data-pe-add]');
                if (add) {
                    if (ses && (it.seatsLeft === null || it.seatsLeft === undefined || it.seatsLeft > 0)) {
                        add.setAttribute('data-item-id', ses.itemId || it.entropicalId || '');
                        add.setAttribute('data-booking-item', it.slug);
                        add.setAttribute('aria-label', 'Reservar ' + it.name + (d ? ', ' + d.getDate() + ' de ' + MESES_LARGO[d.getMonth()] : ''));
                    } else add.remove();
                }
                var more = q('more');
                if (more) {
                    more.href = href;
                    more.setAttribute('aria-label', 'Más información sobre ' + it.name);
                    if (!add || !card.contains(add)) more.textContent = 'Más información';
                }
                card.setAttribute('data-pe-card-href', href);
                list.appendChild(card);
            });
            tpl.remove();
            var dyn = list.closest('.w-dyn-list');
            var none = !list.querySelector('.pe-tcard');
            if (dyn) { var empty = dyn.querySelector('.w-dyn-empty'); if (empty) empty.style.display = none ? '' : 'none'; }
            if (none) list.style.display = 'none';
        });
    }

    ready(function () {
        var db = window.PE_CMS;
        if (!db || !db.talleres) return;
        // the shared card comes from js/pe-explorer.js, a later deferred script: wait for it
        if (!window.PEExplorer && document.querySelector('script[src*="pe-explorer.js"]') && document.readyState !== 'complete') {
            document.addEventListener('DOMContentLoaded', function () { hydrateTcards(db); });
        } else hydrateTcards(db);
        hydrateTalleresCards(db);
        hydrateEventos(db);
        hydrateEventCards(db);
        hydrateProductosSwipers(db);
        // Finsweet may wipe injected eventos on its late init — re-run once.
        setTimeout(function () {
            if (!document.querySelector('.eventos_item [fs-list-field="name"]:not(.w-dyn-bind-empty)')) {
                hydrateEventos(db);
            }
        }, 1800);
    });
})();

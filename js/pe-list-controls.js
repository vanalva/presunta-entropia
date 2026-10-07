/* ============================================================
   PRESUNTA ENTROPIA — unified list controls (no framework)
   Pairs with the "LIST CONTROLS" block at the end of css/project.css.

   1. Column slider. Any input[data-pe-list-cols-target] drives the list that
      lives in its [data-pe-list-root] section. The chosen count is stored in
      localStorage (one value per visitor) and written to the list as the
      custom property --pe-list-cols plus the combo class is-cols-N, which the
      CSS reads to pick the card shape. The cap per breakpoint comes from the
      CSS (--pe-lc-cap), so the script never knows a breakpoint.

   2. Calendario data flow (local preview). pe-cms-lists.js appends every
      hydrated event card INSIDE the single template .collection-item, so
      Finsweet sees one list item and cannot filter or sort per card. This file
      gives each card its own .collection-item, adds the two sort/filter keys
      the cards lack (an ISO date, the English month the Mes select uses), and
      re-initialises Finsweet List once if it indexed the old structure. On
      Webflow the CMS already renders one item per card and this is a no-op.
   ============================================================ */
(function () {
    'use strict';

    var KEY = 'pe-list-cols';
    var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /* ---------- 2a. one .collection-item per event card ---------- */
    function splitItems() {
        var changed = false;
        document.querySelectorAll('[data-pe-list]').forEach(function (list) {
            var wrap = list.querySelector(':scope > .pe-lc_item');
            if (!wrap) return;
            var cards = Array.prototype.slice.call(wrap.querySelectorAll(':scope > .pe-lc_card'));
            if (cards.length < 2) return;
            cards.slice(1).forEach(function (card) {
                var w = wrap.cloneNode(false);
                w.removeAttribute('id');
                w.appendChild(card);
                list.appendChild(w);
            });
            changed = true;
        });
        return changed;
    }

    /* ---------- 2b. sort / filter keys ---------- */
    function sessionISO(name, day, monthIdx) {
        var db = window.PE_CMS;
        if (db && db.sesiones) {
            var all = (db.talleres || []).concat(db.cenas || []);
            for (var i = 0; i < db.sesiones.length; i++) {
                var s = db.sesiones[i];
                var d = new Date(s.fecha + 'T12:00:00');
                if (d.getDate() !== day || d.getMonth() !== monthIdx) continue;
                for (var j = 0; j < all.length; j++) {
                    if (all[j].slug === s.item && all[j].name === name) return s.fecha;
                }
            }
        }
        var now = new Date();
        var y = now.getFullYear();
        if (new Date(y, monthIdx, day + 1) < now) y += 1;
        return y + '-' + pad(monthIdx + 1) + '-' + pad(day);
    }

    function enrichCards() {
        var changed = false;
        document.querySelectorAll('[data-pe-list] .pe-lc_card').forEach(function (card) {
            if (card.querySelector('[fs-list-field="fecha"]')) return;
            var mes = card.querySelector('[fs-list-field="mes"]');
            var dayEl = card.querySelector('[fs-list-field="day"]');
            var nameEl = card.querySelector('[fs-list-field="name"]');
            if (!mes || !dayEl || !nameEl) return;
            var abbr = mes.textContent.trim().toLowerCase().slice(0, 3);
            var idx = MONTHS_ES.indexOf(abbr);
            var day = parseInt(dayEl.textContent, 10);
            if (idx < 0 || !day) return;
            mes.textContent = MONTHS_EN[idx];
            var key = document.createElement('span');
            key.hidden = true;
            key.className = 'pe-lc_key';
            key.setAttribute('fs-list-field', 'fecha');
            key.setAttribute('fs-list-fieldtype', 'date');
            key.textContent = sessionISO(nameEl.textContent.trim(), day, idx);
            var date = card.querySelector('.pe-lc_date') || card;
            date.appendChild(key);
            changed = true;
        });
        return changed;
    }

    /* ---------- 2c. make Finsweet see the per-card items ---------- */
    function syncFinsweet() {
        var FA = window.FinsweetAttributes = window.FinsweetAttributes || [];
        var done = false;
        FA.push(['list', function (lists) {
            if (done) return;
            var stale = (lists || []).some(function (L) {
                var el = L.listElement;
                if (!el || !el.hasAttribute('data-pe-list')) return false;
                var n = el.querySelectorAll(':scope > .pe-lc_item').length;
                var items = L.items && L.items.value ? L.items.value : [];
                var noKey = items.length && !(items[0].fields && items[0].fields.fecha);
                return items.length !== n || noKey;
            });
            if (!stale) return;
            done = true;
            try {
                window.FinsweetAttributes.destroy();
                window.FinsweetAttributes.load('list');
            } catch (e) { /* Finsweet missing: the cards still render, just unfiltered */ }
        }]);
    }

    /* ---------- 2d. "no results" banner ----------
       The hydrator hides [fs-list-element="empty"] with an inline display:none and
       Finsweet only clears its own classes, so the banner never came back once a
       filter matched nothing. Show it whenever the list has no items. */
    function watchEmpty() {
        document.querySelectorAll('[data-pe-list]').forEach(function (list) {
            var root = list.closest('[data-pe-list-root]');
            var empty = root && root.querySelector('[fs-list-element="empty"]');
            if (!empty) return;
            function sync() {
                // the pack card (js/pe-packs.js) is a call to action, not a result
                var any = Array.prototype.some.call(list.children, function (c) { return c.style.display !== 'none' && !c.hasAttribute('data-pe-pack-cta'); });
                empty.style.display = any ? 'none' : '';
            }
            new MutationObserver(sync).observe(list, { childList: true });
            sync();
        });
    }

    /* ---------- 1. column slider ---------- */
    function readSaved() {
        try {
            var v = parseInt(localStorage.getItem(KEY), 10);
            return v >= 1 && v <= 3 ? v : 3;
        } catch (e) { return 3; }
    }

    function save(n) {
        try { localStorage.setItem(KEY, String(n)); } catch (e) { /* private mode */ }
    }

    function capOf(list) {
        var c = parseInt(getComputedStyle(list).getPropertyValue('--pe-lc-cap'), 10);
        return c >= 1 ? c : 3;
    }

    function listFor(input) {
        var root = input.closest('[data-pe-list-root]');
        return root ? root.querySelector('[data-pe-list]') : null;
    }

    function apply(wanted) {
        document.querySelectorAll('[data-pe-list-cols-target]').forEach(function (input) {
            var list = listFor(input);
            if (!list) return;
            var cap = capOf(list);
            var n = Math.min(wanted, cap);
            list.style.setProperty('--pe-list-cols', String(n));
            list.classList.remove('is-cols-1', 'is-cols-2', 'is-cols-3');
            list.classList.add('is-cols-' + n);
            input.max = String(cap);
            input.value = String(n);
            var out = input.parentNode.querySelector('[data-pe-list-cols-out]');
            if (out) out.textContent = String(n);
            input.setAttribute('aria-valuetext', n + (n === 1 ? ' columna' : ' columnas'));
        });
    }

    function initSliders() {
        var inputs = document.querySelectorAll('[data-pe-list-cols-target]');
        if (!inputs.length) return;
        var wanted = readSaved();
        apply(wanted);
        inputs.forEach(function (input) {
            input.addEventListener('input', function () {
                wanted = parseInt(input.value, 10) || 3;
                save(wanted);
                apply(wanted);
            });
        });
        var raf = 0;
        window.addEventListener('resize', function () {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(function () { apply(wanted); });
        });
    }

    /* ---------- 3. filter tags: the whole tag removes its filter ----------
       Finsweet only wires the small x ([fs-list-element="tag-remove"]); a click
       anywhere on the tag, or Enter / Space on it, now does the same. */
    function removeVia(tag) {
        var x = tag.querySelector('[fs-list-element="tag-remove"]');
        if (x) x.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    function initTags() {
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var tag = t.closest('[data-pe-list-root] [fs-list-element="tag"]');
            if (!tag || t.closest('[fs-list-element="tag-remove"]')) return;
            e.preventDefault();
            removeVia(tag);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var tag = e.target && e.target.closest && e.target.closest('[data-pe-list-root] [fs-list-element="tag"]');
            if (!tag) return;
            e.preventDefault();
            removeVia(tag);
        });
        function label(root) {
            root.querySelectorAll('[fs-list-element="tag"]').forEach(function (tag) {
                var v = tag.querySelector('[fs-list-element="tag-value"]');
                var txt = 'Quitar filtro: ' + (v ? v.textContent.trim() : '');
                if (tag.getAttribute('aria-label') === txt) return;
                tag.setAttribute('role', 'button');
                tag.setAttribute('tabindex', '0');
                tag.setAttribute('aria-label', txt);
            });
        }
        document.querySelectorAll('[data-pe-list-root]').forEach(function (root) {
            label(root);
            new MutationObserver(function () { label(root); }).observe(root, { childList: true, subtree: true, characterData: true });
        });
    }

    /* ---------- 4. motion: results enter and reflow softly ----------
       Finsweet swaps the list's children instantly. Just before a control changes
       (input, click, key), the card positions are recorded; when the list changes,
       cards that stayed glide from their old place (FLIP) and new ones fade + scale
       in, lightly staggered. Changes the visitor did not cause (first render) are not
       animated. prefers-reduced-motion: nothing moves. */
    function initMotion() {
        if (!Element.prototype.animate) return;
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
        document.querySelectorAll('[data-pe-list]').forEach(function (list) {
            var root = list.closest('[data-pe-list-root]') || document;
            var snap = null, snapAt = 0, raf = 0;
            function take() {
                snap = new Map();
                Array.prototype.forEach.call(list.children, function (c) {
                    if (c.offsetParent !== null) snap.set(c, c.getBoundingClientRect());
                });
                snapAt = performance.now();
            }
            ['input', 'change', 'click', 'keydown'].forEach(function (ev) { root.addEventListener(ev, take, true); });
            function play() {
                raf = 0;
                if (!snap || performance.now() - snapAt > 3000) { snap = null; return; }
                var k = 0, next = new Map();
                Array.prototype.forEach.call(list.children, function (c) {
                    if (c.offsetParent === null) return;
                    var now = c.getBoundingClientRect(), was = snap.get(c);
                    next.set(c, now);
                    if (was) {
                        var dx = was.left - now.left, dy = was.top - now.top;
                        var resized = Math.abs(was.width - now.width) > 4;
                        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !resized) return;
                        c.animate([
                            { transform: 'translate(' + dx + 'px, ' + dy + 'px)', opacity: resized ? 0.55 : 1 },
                            { transform: 'none', opacity: 1 }
                        ], { duration: 340, easing: EASE });
                    } else {
                        c.animate([
                            { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
                            { opacity: 1, transform: 'none' }
                        ], { duration: 300, delay: Math.min(k++ * 45, 270), easing: EASE, fill: 'backwards' });
                    }
                });
                // a second change in the same interaction starts from where things landed
                snap = next;
            }
            new MutationObserver(function () {
                if (!raf) raf = requestAnimationFrame(play);
            }).observe(list, { childList: true, attributes: true, attributeFilter: ['class', 'style'] });
        });
    }

    /* ---------- 5. every card in a list is the same height ----------
       CSS grid sizes each row to its own tallest card, so rows differ as soon as the
       page narrows and text wraps. This measures the tallest card in the list and
       gives every row that height (--pe-lc-row-h, read by grid-auto-rows in
       project.css). Re-measured when the list width, its columns or its results
       change; the measuring pass drops the variable first, so it never ratchets. */
    function initEqualRows() {
        // calendar lists + the full-screen booking modal grid (#modal-1)
        document.querySelectorAll('[data-pe-list], [data-booking-grid]').forEach(function (list) {
            var raf = 0, lastKey = '';
            function measure() {
                raf = 0;
                var items = Array.prototype.filter.call(list.children, function (c) { return c.offsetParent !== null; });
                var key = list.clientWidth + '|' + items.length + '|' + list.className;
                list.style.removeProperty('--pe-lc-row-h');
                var max = 0;
                items.forEach(function (c) { max = Math.max(max, c.getBoundingClientRect().height); });
                if (max > 0) list.style.setProperty('--pe-lc-row-h', Math.ceil(max) + 'px');
                lastKey = key;
            }
            function schedule() { if (!raf) raf = requestAnimationFrame(measure); }
            if (window.ResizeObserver) {
                var lastW = 0;
                new ResizeObserver(function () {
                    if (list.clientWidth === lastW) return;      // our own row change only alters the height
                    lastW = list.clientWidth;
                    schedule();
                }).observe(list);
            }
            new MutationObserver(schedule).observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
            window.addEventListener('load', schedule);
            schedule();
        });
    }

    ready(function () {
        initTags();
        initMotion();
        initEqualRows();
        var a = splitItems();
        var b = enrichCards();
        initSliders();
        watchEmpty();
        if (document.querySelector('[data-pe-list] .pe-lc_card')) syncFinsweet();
        void a; void b;
    });
})();

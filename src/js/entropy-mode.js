/* ============================================================
   PRESUNTA ENTROPÍA — Modo Entropía v4 (2026-11-05, performance)
   NEVER touches image colors, theme colors or font styles.
   Chaos = geometry only: position, rotation, subtle scale.

   v3 froze the page for 3.7 s on toggle: it measured every element
   on the page and interleaved reads with writes, so each element
   forced a full layout. Then it wrote a transform per element per
   frame from JavaScript. v4 is built the other way round:

   · Lazy. An IntersectionObserver (35% margin) says what is near
     the screen, and reports its box without forcing layout. Only
     those elements join; the rest join as the page scrolls.
   · Batched. Elements join in small chunks, one chunk per frame,
     all reads first, then all writes. Toggling never blocks.
   · Compositor. Scatter, float and the Magneto return are Web
     Animations on the individual `translate` / `rotate` / `scale`
     properties, so they run off the main thread and never fight a
     `transform` owned by GSAP, a reveal or a hover.
   · Off-screen costs nothing. Leaving the margin cancels the
     element's animation (its layer is released); coming back
     restarts it. Floats are capped so a phone is never asked to
     keep hundreds of layers.
   · JavaScript per frame only for the few movers (escapees,
     wanderers, DVD floaters), and only while one is on screen.

   The disaster is the same: scatter with a gravity bias and a couple
   of tipped elements, ambient float, wanderers, escapees, DVD
   floaters, live swaps, unclipped containers, a gentle tier for big
   interactive components, and the Magneto return.

   State: localStorage 'pe-entropy' ('1' on); html.modo-entropia is
   applied pre-paint by the tiny head snippet on each page.
   API: window.__peEntropy { on, off, toggle, active } (the console's
   M. ENTROPÍA entry calls __peEntropy.toggle()).
   prefers-reduced-motion: static scatter only, no animation.
   v1 (scheme swaps / font-weight / hue-rotate chaos) is archived; do
   not restore those effects. Juan limited the mode to geometry.
   ============================================================ */
(function () {
    'use strict';

    var KEY = 'pe-entropy';
    var TAU = Math.PI * 2;
    var prm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var lowEnd = (navigator.hardwareConcurrency || 8) <= 4 ||
        !!(window.matchMedia && matchMedia('(max-width: 767px)').matches);

    var MARGIN = '35% 0px';              // elements join this far before they reach the screen
    var CHUNK = 14;                      // elements adopted per frame
    var MAX_FLOATS = lowEnd ? 26 : 80;   // running float animations (each one is a layer)
    var CAPS = { escapee: lowEnd ? 2 : 5, wander: lowEnd ? 2 : 4, dvd: lowEnd ? 1 : 2 };   // movers on screen

    var SEL = [
        '.productos_card', '.espacios_card', '.image_card', '.info_card',
        '.similar-card', '.talleres_event_item', '.eventos_item',
        '.chef-card_box', '.chef-card_portrait',
        '.taller-detail_thumb', '.taller-detail_media-image',
        '.logo3_wrapper', '.tag', '.button_registrate', '.button_similares',
        'main h1', 'main h2', 'main h3', 'main p',
        '.footer15_link', '.hero_image-wrapper', '.button'
    ].join(', ');
    var EXCLUDE = '.w-nav, .navbar_fullscreen, .navbar_menu, #modal-1, [data-modal-id], ' +
        '.cart-modal_component, .presunta-game-wrapper, .console, .pe-val, .entropy-switch_wrap, ' +
        '.navbar_fixed-button-container, .w-embed, .pe-preloader-container, .hero_image-marquee_component, ' +
        '.pe-xp_float, .pe-bookdlg, .ep-backdrop';
    /* big interactive components: only a gentle float (interactivity stays usable) */
    var GENTLE = '.presunta-game-wrapper, .hero_image-marquee_component, ' +
        '.values-marquee_component, .swiper, .w-slider';
    var NAV_GUARD = '.w-nav, .navbar_fullscreen, .navbar_menu';    // overflow never touched
    var TRACKED = '[class*="marquee"], .swiper, .w-slider';        // keep x containment
    var GRIDS = '.similares_grid, .w-layout-grid';

    var applied = false;
    var rng = Math.random;
    var items = new Map();        // el -> state
    var seen = null;              // WeakSet of elements already handed to the observer
    var queue = [];               // [{el, rect}] waiting for adoption
    var io = null, mo = null;
    var drainRaf = 0, loopRaf = 0, swapTimer = 0, moverTimer = 0, scanTimer = 0;
    var floats = 0, tipped = 0;
    var arriving = false;         // the toggle moment: on-screen elements animate in
    var unclipRestores = [], unclipVisited = null;
    var escapeeRestores = [];
    var rootOverflowPrev = null;
    var pendingRestore = null;    // { timer, fn } Magneto clean-up

    /* ---------- helpers ---------- */
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function range(min, max) { return min + rng() * (max - min); }
    function px(x, y) { return x.toFixed(2) + 'px ' + y.toFixed(2) + 'px'; }
    function deg(r) { return r.toFixed(2) + 'deg'; }
    function setBase(t) {
        var s = t.el.style;
        s.translate = px(t.tx, t.ty);
        s.rotate = deg(t.rot);
        s.scale = String(+t.sc.toFixed(3));
    }
    function clearBase(el) {
        el.style.removeProperty('translate');
        el.style.removeProperty('rotate');
        el.style.removeProperty('scale');
    }
    function stopAnim(t) {
        if (t.anim) { t.anim.onfinish = null; t.anim.cancel(); t.anim = null; if (t.floating) { t.floating = false; floats--; } }
    }
    function inView(r) { return r.bottom > 0 && r.top < innerHeight; }

    /* ---------- ambient float: a closed loop of sampled sines, zero at t=0 ---------- */
    function floatFrames(t) {
        var g = t.gentle, frames = [], n = 16, i;
        var ax = g ? range(6, 12) : range(3, 7), ax2 = g ? range(2, 4) : range(1.5, 3.5);
        var ay = g ? range(7, 14) : range(4, 9), ar = g ? range(0.25, 0.6) : range(0.6, 1.6);
        var px1 = rng() * TAU, px2 = rng() * TAU, py = rng() * TAU, pr = rng() * TAU;
        for (i = 0; i <= n; i++) {
            var p = i / n * TAU;
            var ox = ax * (Math.sin(p + px1) - Math.sin(px1)) + ax2 * (Math.sin(2 * p + px2) - Math.sin(px2));
            var oy = ay * (Math.sin(p + py) - Math.sin(py));
            var or = ar * (Math.sin(p + pr) - Math.sin(pr));
            frames.push({ translate: px(t.tx + ox, t.ty + oy), rotate: deg(t.rot + or) });
        }
        return frames;
    }
    function startFloat(t, fresh) {
        if (prm || !applied || t.mover || t.busy || !t.onScreen || t.anim || floats >= MAX_FLOATS) return;
        var dur = t.gentle ? range(11000, 18000) : range(7000, 13000);
        t.anim = t.el.animate(floatFrames(t), { duration: dur, iterations: Infinity });
        if (!fresh) t.anim.currentTime = rng() * dur;    // back on screen: pick up anywhere
        t.floating = true;
        floats++;
    }

    /* ---------- discovery: nothing here reads layout ---------- */
    function scan() {
        document.querySelectorAll(SEL + ', ' + GENTLE).forEach(function (el) {
            if (seen.has(el)) return;
            seen.add(el);
            if (!el.matches(GENTLE) && el.closest(EXCLUDE)) return;
            io.observe(el);
        });
    }
    function onIntersect(entries) {
        entries.forEach(function (en) {
            var t = items.get(en.target);
            if (en.isIntersecting) {
                if (t) wake(t);
                else queue.push({ el: en.target, rect: en.boundingClientRect });
            } else if (t) sleep(t);
        });
        if (queue.length && !drainRaf) drainRaf = requestAnimationFrame(drain);
    }
    function sleep(t) {
        t.onScreen = false;
        if (!t.busy) stopAnim(t);
    }
    function wake(t) {
        t.onScreen = true;
        if (t.mover) ensureLoop(); else startFloat(t, false);
    }

    /* ---------- adoption: one chunk per frame, reads then writes ---------- */
    function drain() {
        drainRaf = 0;
        if (!applied) { queue = []; return; }
        var chunk = queue.splice(0, CHUNK), ok = [], unclips = [];
        /* reads */
        chunk.forEach(function (q) {
            var el = q.el, r = q.rect, gentle = el.matches(GENTLE);
            if (items.has(el) || !el.isConnected) return;
            if (r.width < (gentle ? 80 : 24) || r.height < (gentle ? 60 : 14)) return;
            if (gentle && el.style.transform) return;           // a site script owns this one
            if (el.closest('.pe-chaos') || el.querySelector('.pe-chaos')) return;   // no nested chaos
            var cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.position === 'sticky' ||
                cs.display === 'none' || cs.visibility === 'hidden') return;
            q.gentle = gentle;
            ok.push(q);
            scanUnclip(el, unclips);
        });
        /* writes */
        unclips.forEach(applyUnclip);
        ok.forEach(function (q) { adopt(q.el, q.rect, q.gentle); });
        if (queue.length) drainRaf = requestAnimationFrame(drain);
    }
    function adopt(el, r, gentle) {
        var big = r.width > 420, small = r.width < 200 && r.width * r.height < 30000;
        var t = {
            el: el, gentle: gentle, onScreen: true, tx: 0, ty: 0, rot: 0, sc: 1,
            lx: r.left, ly: r.top + window.scrollY, w: r.width, h: r.height, small: small
        };
        if (!gentle) {
            var amp = big ? 22 : (small ? 70 : 42), rotAmp = big ? 2.2 : (small ? 8 : 5);
            t.tx = range(-amp, amp);
            t.ty = range(-amp, amp);
            if (rng() < 0.3) t.ty = Math.abs(t.ty);              // gravity bias: things sag
            t.rot = range(-rotAmp, rotAmp);
            t.sc = big ? 1 : range(0.94, 1.06);
            if (small && tipped < 2 && rng() < 0.08) {           // a couple properly tipped over
                tipped++;
                t.rot += (rng() > 0.5 ? 1 : -1) * range(10, 16);
                t.ty += range(20, 45);
            }
        }
        items.set(el, t);
        el.classList.add('pe-chaos');
        setBase(t);
        if (!gentle && arriving && !prm && inView(r)) {
            t.busy = true;
            t.anim = el.animate([
                { translate: '0px 0px', rotate: '0deg', scale: '1' },
                { translate: px(t.tx, t.ty), rotate: deg(t.rot), scale: String(+t.sc.toFixed(3)) }
            ], { duration: 700 + rng() * 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: rng() * 140, fill: 'backwards' });
            t.anim.onfinish = function () { t.anim = null; t.busy = false; startFloat(t, true); };
        } else startFloat(t, true);
    }

    /* ---------- unclip: chaos must not be cut by container overflow ---------- */
    function scanUnclip(el, out) {
        var node = el.parentElement;
        while (node && node !== document.body) {
            if (!unclipVisited.has(node)) {
                unclipVisited.add(node);
                var cs = getComputedStyle(node);
                if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY) && !node.matches(NAV_GUARD)) {
                    var scroller =
                        (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 4) ||
                        (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 4);
                    if (!scroller) out.push(node);
                }
            }
            node = node.parentElement;
        }
    }
    function applyUnclip(node) {
        unclipRestores.push({ el: node, ovx: node.style.overflowX, ovy: node.style.overflowY });
        if (node.matches(TRACKED) || node.querySelector(TRACKED)) {
            node.style.overflowX = 'clip';
            node.style.overflowY = 'visible';
        } else {
            node.style.overflowX = 'visible';
            node.style.overflowY = 'visible';
        }
    }

    /* ---------- movers: the few that really roam (JS per frame, on screen only) ---------- */
    function wanderMover(b, escapee) {
        return {
            kind: escapee ? 'escapee' : 'wander', b: b,
            txT: range(b.minX, b.maxX), tyT: range(b.minY, b.maxY),
            rotT: range(escapee ? -20 : -8, escapee ? 20 : 8),
            vmax: escapee ? range(35, 80) : range(22, 50),
            k: range(0.5, 0.9), nextT: 0,
            wb: TAU / range(3.5, 7), pb: rng() * TAU, ab: range(2, 4),
            wb2: TAU / range(4.5, 9), pb2: rng() * TAU, ab2: range(2, 4)
        };
    }
    function sectionBounds(t) {
        var sec = t.el.closest('section, header, footer') || document.body;
        var sr = sec.getBoundingClientRect(), y = window.scrollY;
        var b = {
            minX: sr.left - t.lx + 8, maxX: sr.right - (t.lx + t.w) - 8,
            minY: sr.top + y - t.ly + 8, maxY: sr.bottom + y - (t.ly + t.h) - 8
        };
        return b.maxX > b.minX && b.maxY > b.minY ? b : null;
    }
    function escapeBounds(t) {
        var docW = document.documentElement.clientWidth, node = t.el.parentElement;
        while (node && node !== document.body) {                // needs a fully open path
            var cs = getComputedStyle(node);
            if (/(hidden|clip|auto|scroll)/.test(cs.overflowY)) return null;
            if (/(hidden|clip|auto|scroll)/.test(cs.overflowX) && node.getBoundingClientRect().width < docW - 40) return null;
            node = node.parentElement;
        }
        var docH = document.documentElement.scrollHeight, vh = innerHeight;
        var b = {
            minX: -t.lx + 6, maxX: docW - t.w - t.lx - 6,
            minY: Math.max(-0.7 * vh, -t.ly + 6), maxY: Math.min(0.7 * vh, docH - t.ly - t.h - 6)
        };
        return b.maxX > b.minX && b.maxY > b.minY ? b : null;
    }
    function assignMovers() {
        if (!applied || prm) return;
        var have = { escapee: 0, wander: 0, dvd: 0 }, pool = [];
        items.forEach(function (t) {
            if (!t.onScreen) return;
            if (t.mover) have[t.mover.kind]++;
            else if (!t.gentle && !t.busy && t.w * t.h < 45000 && t.w > 40 &&
                !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(t.el.tagName) &&
                !t.el.closest('a, button, form')) pool.push(t);
        });
        pool.sort(function () { return rng() - 0.5; });
        for (var i = 0; i < pool.length; i++) {
            var t = pool[i], kind = null, b = null;
            if (have.escapee < CAPS.escapee) { kind = 'escapee'; b = escapeBounds(t); }
            else if (have.wander < CAPS.wander) { kind = 'wander'; b = sectionBounds(t); }
            else if (have.dvd < CAPS.dvd) { kind = 'dvd'; b = sectionBounds(t); }
            else break;
            if (!b) continue;
            have[kind]++;
            stopAnim(t);
            if (kind === 'escapee') {
                escapeeRestores.push({ el: t.el, pos: t.el.style.position, z: t.el.style.zIndex });
                if (getComputedStyle(t.el).position === 'static') t.el.style.position = 'relative';
                t.el.style.zIndex = '900';
            }
            t.mover = kind === 'dvd'
                ? { kind: 'dvd', b: b, vx: range(18, 36) * (rng() > 0.5 ? 1 : -1), vy: range(14, 30) * (rng() > 0.5 ? 1 : -1), vr: range(-8, 8) }
                : wanderMover(b, kind === 'escapee');
            t.el.style.willChange = 'translate, rotate';
        }
        ensureLoop();
    }
    var lastFrame = 0;
    function ensureLoop() {
        if (!loopRaf && applied && !prm) { lastFrame = performance.now(); loopRaf = requestAnimationFrame(loop); }
    }
    function loop(now) {
        loopRaf = 0;
        if (!applied) return;
        var dt = Math.min(0.05, (now - lastFrame) / 1000), s = now / 1000, any = false;
        lastFrame = now;
        items.forEach(function (t) {
            var m = t.mover;
            if (!m || !t.onScreen) return;
            any = true;
            var ox = 0, oy = 0;
            if (m.kind === 'dvd') {
                t.tx += m.vx * dt; t.ty += m.vy * dt; t.rot += m.vr * dt;
                if (t.tx < m.b.minX) { t.tx = m.b.minX; m.vx = Math.abs(m.vx); }
                if (t.tx > m.b.maxX) { t.tx = m.b.maxX; m.vx = -Math.abs(m.vx); }
                if (t.ty < m.b.minY) { t.ty = m.b.minY; m.vy = Math.abs(m.vy); }
                if (t.ty > m.b.maxY) { t.ty = m.b.maxY; m.vy = -Math.abs(m.vy); }
            } else {
                var esc = m.kind === 'escapee';
                if (s >= m.nextT) {
                    m.txT = range(m.b.minX, m.b.maxX);
                    m.tyT = range(m.b.minY, m.b.maxY);
                    m.rotT = range(esc ? -20 : -8, esc ? 20 : 8);
                    m.vmax = esc ? range(35, 80) : range(22, 50);
                    m.nextT = s + range(5, 10);
                }
                var dx = m.txT - t.tx, dy = m.tyT - t.ty, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0.5) {
                    var move = Math.min(dist * m.k * dt, m.vmax * dt);
                    t.tx += dx / dist * move;
                    t.ty += dy / dist * move;
                }
                t.rot += (m.rotT - t.rot) * Math.min(1, 1.2 * dt);
                ox = Math.sin(s * m.wb + m.pb) * m.ab;
                oy = Math.cos(s * m.wb2 + m.pb2) * m.ab2;
            }
            t.el.style.translate = px(t.tx + ox, t.ty + oy);
            t.el.style.rotate = deg(t.rot);
        });
        if (any) loopRaf = requestAnimationFrame(loop);
    }

    /* ---------- live swaps: look-alike neighbours trade places on screen ---------- */
    function current(t) {
        var cs = getComputedStyle(t.el), p = (cs.translate === 'none' ? '0px 0px' : cs.translate).split(' ');
        return {
            x: parseFloat(p[0]) || 0, y: parseFloat(p[1]) || 0,
            r: cs.rotate === 'none' ? 0 : parseFloat(cs.rotate) || 0
        };
    }
    function glide(t, from, tx, ty, rot, dur) {
        stopAnim(t);
        t.busy = true;
        t.tx = tx; t.ty = ty; t.rot = rot;
        setBase(t);
        t.anim = t.el.animate([
            { translate: px(from.x, from.y), rotate: deg(from.r) },
            { translate: px(tx, ty), rotate: deg(rot) }
        ], { duration: dur, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
        t.anim.onfinish = function () { t.anim = null; t.busy = false; startFloat(t, true); };
    }
    function swapPair(grid) {
        var kids = [].filter.call(grid.children, function (k) {
            var t = items.get(k);
            return t && t.onScreen && !t.mover && !t.gentle && !t.busy;
        });
        if (kids.length < 4) return false;
        var a = kids[Math.floor(rng() * kids.length)], b = kids[Math.floor(rng() * kids.length)];
        if (a === b) return false;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.width - rb.width) > 60 || Math.abs(ra.height - rb.height) > 120) return false;
        var ta = items.get(a), tb = items.get(b), fa = current(ta), fb = current(tb);
        var dx = rb.left - ra.left, dy = rb.top - ra.top;
        var dur = (Math.min(3.5, 0.9 + Math.sqrt(dx * dx + dy * dy) / 900) + range(0, 0.4)) * 1000;
        glide(ta, fa, ta.tx + dx, ta.ty + dy, ta.rot + range(-3, 3), dur);
        glide(tb, fb, tb.tx - dx, tb.ty - dy, tb.rot + range(-3, 3), dur);
        return true;
    }
    function swapTick() {
        if (!applied) return;
        var grids = [];
        document.querySelectorAll(GRIDS).forEach(function (g) {
            if (g.closest(EXCLUDE)) return;
            for (var i = 0; i < g.children.length; i++) {
                var t = items.get(g.children[i]);
                if (t && t.onScreen) { grids.push(g); break; }
            }
        });
        for (var i = 0; i < 4 && grids.length; i++) {
            if (swapPair(grids[Math.floor(rng() * grids.length)])) break;
        }
        items.forEach(function (t, el) { if (!el.isConnected) { stopAnim(t); items.delete(el); } });
        swapTimer = setTimeout(swapTick, range(4200, 7500));
    }
    function moverTick() {
        if (!applied) return;
        assignMovers();
        moverTimer = setTimeout(moverTick, 2500);
    }

    /* ---------- on ---------- */
    function restoreRoot(prev) {
        if (!prev) return;
        if (prev.html) document.documentElement.style.overflowX = prev.html;
        else document.documentElement.style.removeProperty('overflow-x');
        if (prev.body) document.body.style.overflowX = prev.body;
        else document.body.style.removeProperty('overflow-x');
    }
    function apply() {
        if (applied) return;
        applied = true;
        if (pendingRestore) {                // a Magneto return is still landing: finish it now
            clearTimeout(pendingRestore.timer);
            pendingRestore.fn();
            pendingRestore = null;
        }
        rootOverflowPrev = { html: document.documentElement.style.overflowX, body: document.body.style.overflowX };
        document.documentElement.style.overflowX = 'clip';
        document.body.style.overflowX = 'clip';
        document.documentElement.classList.add('modo-entropia');

        rng = mulberry32(Math.floor(Math.random() * 0xffffffff));
        seen = new WeakSet();
        unclipVisited = new Set();
        floats = 0; tipped = 0;
        arriving = true;
        setTimeout(function () { arriving = false; }, 1200);

        io = new IntersectionObserver(onIntersect, { rootMargin: MARGIN });
        scan();
        /* late content (lists, cards, the Explorador) joins by itself */
        mo = new MutationObserver(function () {
            clearTimeout(scanTimer);
            scanTimer = setTimeout(function () { if (applied) scan(); }, 500);
        });
        mo.observe(document.body, { childList: true, subtree: true });
        if (!prm) {
            swapTimer = setTimeout(swapTick, 3000);
            moverTimer = setTimeout(moverTick, 1400);
        }
    }

    /* ---------- off: the Magneto return ---------- */
    function release(t) {
        t.el.classList.remove('pe-chaos');
        t.el.style.removeProperty('will-change');
        clearBase(t.el);
    }
    function magnetoOff() {
        applied = false;
        queue = [];
        if (drainRaf) { cancelAnimationFrame(drainRaf); drainRaf = 0; }
        if (loopRaf) { cancelAnimationFrame(loopRaf); loopRaf = 0; }
        clearTimeout(swapTimer); clearTimeout(moverTimer); clearTimeout(scanTimer);
        if (io) { io.disconnect(); io = null; }
        if (mo) { mo.disconnect(); mo = null; }
        document.documentElement.classList.remove('modo-entropia');

        var work = [], rest = [], maxDist = 1;
        /* reads: where every on-screen element is right now */
        items.forEach(function (t) {
            if (!prm && t.onScreen && t.el.isConnected) {
                var c = current(t);
                t.from = { x: c.x, y: c.y, r: ((c.r % 360) + 540) % 360 - 180 };
                t.dist = Math.sqrt(c.x * c.x + c.y * c.y) + Math.abs(t.from.r) * 4;
                if (t.dist > maxDist) maxDist = t.dist;
                work.push(t);
            } else rest.push(t);
        });
        /* writes */
        rest.forEach(function (t) { stopAnim(t); release(t); });
        var longest = 0, returning = [];
        work.forEach(function (t) {
            stopAnim(t);
            t.mover = null;
            var norm = t.dist / maxDist, f = t.from, sc = String(+t.sc.toFixed(3));
            var jitter = Math.min(4, 1.5 + t.dist * 0.02), n = 4 + Math.round(norm * 2);
            var charge = n * 80, pull = 500 + norm * 550, total = charge + pull, delay = norm * 280;
            var frames = [{ translate: px(f.x, f.y), rotate: deg(f.r), scale: sc }], i;
            for (i = 1; i <= n; i++) {     // charge-up vibration: the magnet locking on
                frames.push({
                    translate: px(f.x + (i % 2 ? jitter : -jitter), f.y + (i % 2 ? -jitter : jitter)),
                    rotate: deg(f.r), scale: sc, offset: i / n * (charge / total)
                });
            }
            frames[frames.length - 1].easing = 'cubic-bezier(0.34, 1.56, 0.64, 1)';   // the pull: overshoot, settle
            frames.push({ translate: '0px 0px', rotate: '0deg', scale: '1' });
            release(t);
            var a = t.el.animate(frames, { duration: total, delay: delay, fill: 'backwards' });
            returning.push(a);
            if (total + delay > longest) longest = total + delay;
        });
        items = new Map();

        var escs = escapeeRestores, unclips = unclipRestores, rootOv = rootOverflowPrev;
        escapeeRestores = []; unclipRestores = []; rootOverflowPrev = null; unclipVisited = null;
        var done = function () {
            returning.forEach(function (a) { a.cancel(); });
            escs.forEach(function (r) {
                if (r.pos) r.el.style.position = r.pos; else r.el.style.removeProperty('position');
                if (r.z) r.el.style.zIndex = r.z; else r.el.style.removeProperty('z-index');
            });
            unclips.forEach(function (r) {
                if (r.ovx) r.el.style.overflowX = r.ovx; else r.el.style.removeProperty('overflow-x');
                if (r.ovy) r.el.style.overflowY = r.ovy; else r.el.style.removeProperty('overflow-y');
            });
            restoreRoot(rootOv);
        };
        pendingRestore = { fn: done, timer: setTimeout(function () { pendingRestore = null; done(); }, longest + 120) };
    }

    /* ---------- api + switches ---------- */
    var api = {
        on: function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} apply(); reflect(); },
        off: function () { try { localStorage.setItem(KEY, '0'); } catch (e) {} magnetoOff(); reflect(); },
        toggle: function () { (applied ? api.off : api.on)(); },
        active: function () { return applied; },
        /* The CAOS voice: idle lines shared by the console's assistant, the
           chat-buddy bubble and the footer bar's chef. Spanish, tuteo, short
           (each fits the console LCD's two lines). Read this array; don't copy it. */
        lines: [
            'Todo plato tiende al desorden.',
            '¿Y si la sal te esperaba?',
            'El universo se quema por abajo.',
            'Nada se pierde, todo se emplata.',
            'Hoy el horno me mira a mí.',
            'Antes de la receta, el ruido.',
            'Polvo de estrellas con hambre.',
            'La entropía no reserva mesa.',
            'El fondo de la olla me miró.',
            'Cortar cebolla abre una galaxia.',
            'La pasta sueña con ser nebulosa.',
            'Remueve. El cosmos también.',
            'Una pizca de azar y sale mejor.',
            'Todo se enfría. Come antes.',
            'El sofrito es un big bang lento.',
            'Ningún plato se repite.',
            'Pregúntale al ajo. Él ya lo sabe.',
            'Cada migaja es una estrella.'
        ]
    };
    window.__peEntropy = api;   // the console calls this
    window.PE_ENTROPY = api;

    function reflect() {
        document.querySelectorAll('[data-entropy-switch]').forEach(function (btn) {
            btn.setAttribute('aria-checked', applied ? 'true' : 'false');
            btn.classList.toggle('is-on', applied);
            // knob carries its own state class: project.css moves it without
            // relational selectors (Webflow styleLess constraint)
            var knob = btn.querySelector('.entropy-switch_knob');
            if (knob) knob.classList.toggle('is-on', applied);
        });
        document.querySelectorAll('.entropy-switch_icon').forEach(function (ic) {
            var isEntropy = ic.classList.contains('is-entropy');
            ic.classList.toggle('is-active', isEntropy === applied);
        });
        // every switch on the site follows this one signal: the ones in the
        // page above, the console's in its shadow root, the footer bar's lever
        document.dispatchEvent(new CustomEvent('pe:entropy', { detail: { on: applied } }));
    }

    function bind() {
        document.querySelectorAll('[data-entropy-switch]').forEach(function (btn) {
            if (btn.__peBound) return;
            btn.__peBound = true;
            btn.addEventListener('click', function () {
                if (btn.getRootNode() === document) api.toggle();
            });
        });
    }

    /* remembered on: start once the preloader has lifted, so the arrival is seen */
    function whenPageShown(fn) {
        var ran = false;
        function go() { if (!ran) { ran = true; setTimeout(fn, 200); } }
        if (document.documentElement.classList.contains('pe-ready') || !document.getElementById('pe-preloader')) go();
        else document.addEventListener('pe:preloader-out', go, { once: true });
        setTimeout(go, 10000);
    }
    function boot() {
        bind();
        var on = false;
        try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
        if (on) whenPageShown(function () { apply(); reflect(); });
        reflect();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

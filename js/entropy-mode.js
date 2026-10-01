/* ============================================================
   PRESUNTA ENTROPÍA — Modo Entropía v3 (2026-07-24, Juan's rules)
   NEVER touches image colors, theme colors or font styles.
   Chaos = geometry only: position, rotation, subtle scale.

   v3 — the disaster is ALIVE:
   · Scatter 2.0 — bigger displacement, gravity bias, a couple of
     "tipped over" elements.
   · Ambient float — every chaotic element drifts on slow layered
     sine waves (nothing ever sits still, but it's smooth).
   · Wanderers — elements glide to random targets inside their
     section: constant cruise, ease-out arrival, linger, retarget.
   · Escapees — a few small elements break OUT of their containers
     (position:relative/z-index while the mode is on, restored
     after the Magneto return) and roam the page around home.
   · DVD floaters — two classic linear bouncers kept as signature.
   · Live swaps — every ~5s another look-alike pair in a visible
     grid trades places with a slow ease-in-out glide.
   · Global unclip — while the mode is on, ALL clipping ancestors
     of chaos elements are opened (marquee/slider tracks keep
     overflow-x containment but free the y axis; nav chrome and
     real scroll areas untouched) so nothing gets cut mid-float.
   · Gentle tier — big interactive components (gameboy console,
     hero/values marquees, swipers) drift on a wide slow float
     with near-zero tilt: alive, still fully usable.

   Toggle OFF = "Magneto" return: charge-up vibration, then every
   element is pulled home with momentum, overshoot and a
   distance-ramped stagger (GSAP when available, CSS fallback).
   Ancestor unclips are restored only after everything is home.

   State: localStorage 'pe-entropy' ('1' on) — html.modo-entropia
   is applied pre-paint by the tiny head snippet on each page.
   API: window.__peEntropy { on, off, toggle, active } (the gameboy
   console's M. ENTROPÍA entry calls __peEntropy.toggle()).
   prefers-reduced-motion: static scatter only, no engine.
   v1 (scheme swaps / font-weight / hue-rotate chaos) is archived —
   do not restore those effects; Juan limited the mode to transforms.
   ============================================================ */
(function () {
    'use strict';

    var KEY = 'pe-entropy';
    var TAU = Math.PI * 2;
    var applied = false;
    var touched = [];            // [{el, tx, ty, rot, sc, o?, mover?, vis}]
    var rafId = 0;
    var swapTimer = 0;
    var engineOn = false;
    var stTweens = [];           // manual tweens on state objects (live swaps)
    var unclipRestores = [];     // [{el, ov, ovx, ovy}] ancestor overflow undo
    var unclipVisited = null;    // Set — ancestors already processed this cycle
    var escapeeRestores = [];    // [{el, pos, z}] position/z-index undo
    var io = null;
    var engineRng = null;        // rng shared with late-adopted elements
    var pendingRestore = null;   // {timer, fn} — deferred style undo after Magneto
    var rootOverflowPrev = null; // html/body overflow-x inline values before clip guard
    var prm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- seeded rng ---------- */
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function range(rng, min, max) { return min + rng() * (max - min); }
    function easeInOutCubic(p) {
        return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    }

    /* ---------- eligibility ---------- */
    var EXCLUDE = '.w-nav, .navbar_fullscreen, .navbar_menu, #modal-1, [data-modal-id], ' +
        '.cart-modal_component, .presunta-game-wrapper, .console, .entropy-switch_wrap, ' +
        '.navbar_fixed-button-container, .w-embed, .pe-preloader-container, .hero_image-marquee_component';
    /* nav chrome — overflow is never touched */
    var NAV_GUARD = '.w-nav, .navbar_fullscreen, .navbar_menu';
    /* containers hosting a horizontal track — keep x containment, free the y axis */
    var TRACKED = '[class*="marquee"], .swiper, .w-slider';
    /* big interactive components that get ONLY a gentle ambient float —
       no scatter, no swaps, no roaming (interactivity stays usable) */
    var GENTLE = '.presunta-game-wrapper, .hero_image-marquee_component, ' +
        '.values-marquee_component, .swiper, .w-slider';

    function eligible(el) {
        if (!el || el.closest(EXCLUDE)) return false;
        var r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 14) return false;
        var cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') return false;
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return true;
    }

    function collectTargets() {
        var sel = [
            '.productos_card', '.espacios_card', '.image_card', '.info_card',
            '.similar-card', '.talleres_event_item', '.eventos_item',
            '.chef-card_box', '.chef-card_portrait',
            '.taller-detail_thumb', '.taller-detail_media-image',
            '.logo3_wrapper', '.tag', '.button_registrate', '.button_similares',
            'main h1', 'main h2', 'main h3', 'main p',
            '.footer15_link', '.hero_image-wrapper', '.button'
        ].join(', ');
        var found = [];
        document.querySelectorAll(sel).forEach(function (el) {
            if (!eligible(el)) return;
            if (el.parentElement && el.parentElement.closest('.pe-chaos')) return; // no nested chaos
            el.classList.add('pe-chaos');
            found.push(el);
        });
        return found;
    }

    /* ---------- transform application (GSAP-compatible) ---------- */
    function setChaos(el, tx, ty, rot, sc, animate) {
        if (window.gsap) {
            window.gsap.to(el, {
                x: tx, y: ty, rotation: rot, scale: sc || 1,
                duration: animate ? 0.7 + Math.random() * 0.6 : 0,
                ease: 'power3.out',
                overwrite: 'auto'
            });
        } else {
            if (animate) el.style.transition = 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
            el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + rot + 'deg)' +
                (sc && sc !== 1 ? ' scale(' + sc + ')' : '');
        }
    }

    function renderT(t, ox, oy, orot) {
        t.el.style.transform = 'translate(' + (t.tx + ox).toFixed(2) + 'px,' +
            (t.ty + oy).toFixed(2) + 'px) rotate(' + (t.rot + orot).toFixed(2) + 'deg)' +
            (t.sc && t.sc !== 1 ? ' scale(' + t.sc.toFixed(3) + ')' : '');
    }

    /* ---------- 1. static scatter (disaster placement) ---------- */
    function scatter(rng, els) {
        var tippables = [];
        els.forEach(function (el) {
            var r = el.getBoundingClientRect();
            var big = r.width > 420;
            var small = r.width < 200 && r.width * r.height < 30000;
            var amp = big ? 22 : (small ? 70 : 42);
            var tx = range(rng, -amp, amp);
            var ty = range(rng, -amp, amp);
            if (rng() < 0.3) ty = Math.abs(ty);                       // gravity bias — things sag
            var rotAmp = big ? 2.2 : (small ? 8 : 5);
            var rot = range(rng, -rotAmp, rotAmp);
            var sc = big ? 1 : range(rng, 0.94, 1.06);
            var t = { el: el, tx: tx, ty: ty, rot: rot, sc: sc };
            touched.push(t);
            if (small) tippables.push(t);
            setChaos(el, tx, ty, rot, sc, true);
        });
        /* a couple of elements properly tipped over */
        tippables.sort(function () { return rng() - 0.5; });
        tippables.slice(0, 2).forEach(function (t) {
            t.rot += (rng() > 0.5 ? 1 : -1) * range(rng, 10, 16);
            t.ty += range(rng, 20, 45);
            setChaos(t.el, t.tx, t.ty, t.rot, t.sc, true);
        });
    }

    /* ---------- 2. position swaps inside look-alike grids ---------- */
    function ambientParams(rng) {
        return {   // ambient float — layered slow sines
            ax: range(rng, 3, 7), wx: TAU / range(rng, 6, 13), px: rng() * TAU,
            ay: range(rng, 4, 9), wy: TAU / range(rng, 5, 11), py: rng() * TAU,
            ax2: range(rng, 1.5, 3.5), wx2: TAU / range(rng, 2.5, 5), px2: rng() * TAU,
            ar: range(rng, 0.6, 1.6), wr: TAU / range(rng, 8, 16), pr: rng() * TAU
        };
    }

    function gentleParams(rng) {
        return {   // big components: wider drift, slower, near-zero tilt
            ax: range(rng, 6, 12), wx: TAU / range(rng, 9, 16), px: rng() * TAU,
            ay: range(rng, 7, 14), wy: TAU / range(rng, 8, 15), py: rng() * TAU,
            ax2: range(rng, 2, 4), wx2: TAU / range(rng, 4, 7), px2: rng() * TAU,
            ar: range(rng, 0.25, 0.6), wr: TAU / range(rng, 12, 20), pr: rng() * TAU
        };
    }

    function collectGentle() {
        var found = [];
        document.querySelectorAll(GENTLE).forEach(function (el) {
            if (el.closest('.pe-chaos')) return;
            if (el.style.transform) return;      // a site script owns this transform
            var r = el.getBoundingClientRect();
            if (r.width < 80 || r.height < 60) return;
            var cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' ||
                cs.position === 'fixed' || cs.position === 'sticky') return;
            for (var i = 0; i < found.length; i++) if (found[i].contains(el)) return;
            el.classList.add('pe-chaos');
            found.push(el);
        });
        return found;
    }

    function findState(el) {
        for (var i = 0; i < touched.length; i++) if (touched[i].el === el) return touched[i];
        var t = { el: el, tx: 0, ty: 0, rot: 0, sc: 1, vis: true };
        el.classList.add('pe-chaos');
        touched.push(t);
        if (engineOn) {           // adopted mid-run (live swap picked a fresh element)
            if (window.gsap) window.gsap.killTweensOf(el);
            el.style.transition = 'none';
            t.o = ambientParams(engineRng);
            el.__peT = t;
            if (io) io.observe(el);
        }
        return t;
    }

    function swapPair(rng, grid, animateNow) {
        var kids = [].filter.call(grid.children, function (k) {
            var kr = k.getBoundingClientRect();
            if (kr.width < 120 || kr.height < 80 || k.closest(EXCLUDE)) return false;
            var t = k.__peT;
            return !(t && (t.mover || t.gentle));   // never swap movers or gentle components
        });
        if (kids.length < 4) return false;
        var a = kids[Math.floor(rng() * kids.length)];
        var b = kids[Math.floor(rng() * kids.length)];
        if (a === b) return false;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.width - rb.width) > 60 || Math.abs(ra.height - rb.height) > 120) return false;
        var ta = findState(a), tb = findState(b);
        var dax = rb.left - ra.left, day = rb.top - ra.top;
        if (animateNow) {
            setChaos(a, ta.tx + dax, ta.ty + day, ta.rot, ta.sc, true);
            setChaos(b, tb.tx - dax, tb.ty - day, tb.rot, tb.sc, true);
            ta.tx += dax; ta.ty += day;
            tb.tx -= dax; tb.ty -= day;
        } else {
            /* engine running — glide the base state, the loop renders it.
               Duration scales with travel distance so long trades stay calm. */
            var dist = Math.sqrt(dax * dax + day * day);
            var dur = Math.min(3.5, 0.9 + dist / 900) + range(rng, 0, 0.4);
            tweenSt(ta, ta.tx + dax, ta.ty + day, ta.rot + range(rng, -3, 3), dur);
            tweenSt(tb, tb.tx - dax, tb.ty - day, tb.rot + range(rng, -3, 3), dur);
        }
        return true;
    }

    function swaps(rng) {
        document.querySelectorAll('.similares_grid, .w-layout-grid').forEach(function (grid) {
            if (grid.closest(EXCLUDE)) return;
            if (rng() < 0.35) return;
            swapPair(rng, grid, true);
        });
    }

    /* ---------- manual state tweens (live swaps while engine runs) ---------- */
    function tweenSt(st, toTx, toTy, toRot, dur) {
        stTweens = stTweens.filter(function (w) { return w.st !== st; });
        stTweens.push({
            st: st, fx: st.tx, fy: st.ty, fr: st.rot,
            tx: toTx, ty: toTy, tr: toRot,
            t0: performance.now(), dur: dur * 1000
        });
    }

    function processStTweens(now) {
        if (!stTweens.length) return;
        stTweens = stTweens.filter(function (w) {
            var p = (now - w.t0) / w.dur;
            if (p >= 1) p = 1;
            var e = easeInOutCubic(p);
            w.st.tx = w.fx + (w.tx - w.fx) * e;
            w.st.ty = w.fy + (w.ty - w.fy) * e;
            w.st.rot = w.fr + (w.tr - w.fr) * e;
            return p < 1;
        });
    }

    /* ---------- 3. THE ENGINE: ambient float + wanderers + escapees + dvd ---------- */

    function isRealScroller(node, cs) {
        return (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 4) ||
               (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 4);
    }

    /* While the mode is on, chaos elements must never be cut by container
       overflow. Containers that host a horizontal track (marquees, sliders)
       keep x containment (overflow-x: clip) but free the y axis so scattered
       children can poke out; everything else goes fully visible. Nav chrome
       and genuine scroll areas are never touched. */
    function unclipAll(list) {
        list.forEach(function (el) {
            var node = el.parentElement;
            while (node && node !== document.body) {
                if (!unclipVisited.has(node)) {
                    unclipVisited.add(node);
                    var cs = getComputedStyle(node);
                    var clips = /(hidden|clip|auto|scroll)/.test(cs.overflow + cs.overflowX + cs.overflowY);
                    if (clips && !node.matches(NAV_GUARD) && !isRealScroller(node, cs)) {
                        unclipRestores.push({
                            el: node,
                            ov: node.style.overflow, ovx: node.style.overflowX, ovy: node.style.overflowY
                        });
                        if (node.matches(TRACKED) || node.querySelector(TRACKED)) {
                            node.style.overflowX = 'clip';
                            node.style.overflowY = 'visible';
                        } else {
                            node.style.overflow = 'visible';
                            node.style.overflowX = 'visible';
                            node.style.overflowY = 'visible';
                        }
                    }
                }
                node = node.parentElement;
            }
        });
    }

    /* An escapee needs a fully open vertical path. Full-page-width x-clippers
       (page wrapper) only cut at the viewport edge — those are fine. */
    function escapeBlocked(el) {
        var docW = document.documentElement.clientWidth;
        var node = el.parentElement;
        while (node && node !== document.body) {
            var cs = getComputedStyle(node);
            if (/(hidden|clip|auto|scroll)/.test(cs.overflowY)) return true;
            if (/(hidden|clip|auto|scroll)/.test(cs.overflowX) &&
                node.getBoundingClientRect().width < docW - 40) return true;
            node = node.parentElement;
        }
        return false;
    }

    function makeEscapee(rng, t) {
        if (escapeBlocked(t.el)) return false;
        var el = t.el;
        var er = el.getBoundingClientRect();
        var baseL = er.left - t.tx;                    // layout position (viewport x, no h-scroll)
        var baseT = er.top - t.ty + window.scrollY;    // layout position (page y)
        var docW = document.documentElement.clientWidth;
        var docH = document.documentElement.scrollHeight;
        var vh = window.innerHeight;
        var b = {
            minX: -baseL + 6,
            maxX: docW - er.width - baseL - 6,
            minY: Math.max(-0.7 * vh, -baseT + 6),
            maxY: Math.min(0.7 * vh, docH - baseT - er.height - 6)
        };
        if (b.maxX <= b.minX || b.maxY <= b.minY) return false;
        escapeeRestores.push({ el: el, pos: el.style.position, z: el.style.zIndex });
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.style.zIndex = '900';
        t.mover = wanderInit(rng, b, true);
        return true;
    }

    function makeSectionWanderer(rng, t) {
        var el = t.el;
        var sec = el.closest('section, header, footer') || document.body;
        var sr = sec.getBoundingClientRect();
        var er = el.getBoundingClientRect();
        var baseL = er.left - t.tx, baseT = er.top - t.ty;
        var b = {
            minX: sr.left - baseL + 8,
            maxX: sr.right - (baseL + er.width) - 8,
            minY: sr.top - baseT + 8,
            maxY: sr.bottom - (baseT + er.height) - 8
        };
        if (b.maxX <= b.minX || b.maxY <= b.minY) return false;
        t.mover = wanderInit(rng, b, false);
        return true;
    }

    function wanderInit(rng, bounds, escapee) {
        return {
            kind: 'wander', b: bounds, escapee: escapee,
            txT: range(rng, bounds.minX, bounds.maxX),
            tyT: range(rng, bounds.minY, bounds.maxY),
            rotT: range(rng, escapee ? -20 : -8, escapee ? 20 : 8),
            vmax: escapee ? range(rng, 35, 80) : range(rng, 22, 50),
            k: range(rng, 0.5, 0.9),
            nextT: 0,
            wb: TAU / range(rng, 3.5, 7), pb: rng() * TAU, ab: range(rng, 2, 4),
            wb2: TAU / range(rng, 4.5, 9), pb2: rng() * TAU, ab2: range(rng, 2, 4)
        };
    }

    function makeDvd(rng, t) {
        var el = t.el;
        var sec = el.closest('section, header, footer') || document.body;
        var sr = sec.getBoundingClientRect();
        var er = el.getBoundingClientRect();
        var baseL = er.left - t.tx, baseT = er.top - t.ty;
        var b = {
            minX: sr.left - baseL + 8,
            maxX: sr.right - (baseL + er.width) - 8,
            minY: sr.top - baseT + 8,
            maxY: sr.bottom - (baseT + er.height) - 8
        };
        if (b.maxX <= b.minX || b.maxY <= b.minY) return false;
        t.mover = {
            kind: 'dvd', b: b,
            vx: range(rng, 18, 36) * (rng() > 0.5 ? 1 : -1),
            vy: range(rng, 14, 30) * (rng() > 0.5 ? 1 : -1),
            vr: range(rng, -8, 8)
        };
        return true;
    }

    function pickMovers(rng, els) {
        var candidates = els.filter(function (el) {
            var r = el.getBoundingClientRect();
            return r.width * r.height < 45000 && r.width > 40 &&
                !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName) &&
                !el.closest('a, button, form');
        });
        candidates.sort(function () { return rng() - 0.5; });
        var esc = 0, wan = 0, dvd = 0;
        for (var i = 0; i < candidates.length; i++) {
            var t = findState(candidates[i]);
            if (t.mover) continue;
            var ok = false;
            if (esc < 5) { ok = makeEscapee(rng, t); if (ok) esc++; }
            else if (wan < 4) { ok = makeSectionWanderer(rng, t); if (ok) wan++; }
            else if (dvd < 2) { ok = makeDvd(rng, t); if (ok) dvd++; }
            else break;
            if (ok) t.el.style.willChange = 'transform';
        }
    }

    function setupIO() {
        io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                var t = en.target.__peT;
                if (t) t.vis = en.isIntersecting;
            });
        }, { rootMargin: '220px' });
        touched.forEach(function (t) {
            t.vis = true;
            t.el.__peT = t;
            io.observe(t.el);
        });
    }

    function startSwapTicker(rng) {
        var vh = window.innerHeight;
        function visibleGrids() {
            var out = [];
            document.querySelectorAll('.similares_grid, .w-layout-grid').forEach(function (g) {
                if (g.closest(EXCLUDE)) return;
                var r = g.getBoundingClientRect();
                if (r.bottom > -vh * 0.4 && r.top < vh * 1.4) out.push(g);
            });
            return out;
        }
        function tick() {
            if (!applied || !engineOn) return;
            vh = window.innerHeight;
            var grids = visibleGrids();
            if (grids.length) {
                /* a few attempts — pair rejection is common */
                for (var i = 0; i < 4; i++) {
                    if (swapPair(rng, grids[Math.floor(rng() * grids.length)], false)) break;
                }
            }
            swapTimer = setTimeout(tick, range(rng, 4200, 7500));
        }
        swapTimer = setTimeout(tick, 3000);
    }

    function startEngine(rng, els) {
        if (prm || engineOn) return;
        engineOn = true;
        engineRng = rng;

        /* take over from the scatter tweens */
        touched.forEach(function (t) {
            if (window.gsap) window.gsap.killTweensOf(t.el);
            t.el.style.transition = 'none';
            t.o = t.gentle ? gentleParams(rng) : ambientParams(rng);
        });

        pickMovers(rng, els);
        setupIO();
        startSwapTicker(rng);

        var last = performance.now();
        var loop = function (now) {
            if (!applied || !engineOn) return;
            var dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            var s = now / 1000;

            processStTweens(now);

            for (var i = 0; i < touched.length; i++) {
                var t = touched[i];
                if (!t.vis) continue;
                var m = t.mover;
                var ox = 0, oy = 0, orot = 0;

                if (m) {
                    if (m.kind === 'wander') {
                        if (s >= m.nextT) {
                            m.txT = range(rng, m.b.minX, m.b.maxX);
                            m.tyT = range(rng, m.b.minY, m.b.maxY);
                            m.rotT = range(rng, m.escapee ? -20 : -8, m.escapee ? 20 : 8);
                            m.vmax = m.escapee ? range(rng, 35, 80) : range(rng, 22, 50);
                            m.nextT = s + range(rng, 5, 10);
                        }
                        var dx = m.txT - t.tx, dy = m.tyT - t.ty;
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0.5) {
                            var move = dist * m.k * dt;
                            var cap = m.vmax * dt;
                            if (move > cap) move = cap;
                            t.tx += dx / dist * move;
                            t.ty += dy / dist * move;
                        }
                        t.rot += (m.rotT - t.rot) * Math.min(1, 1.2 * dt);
                        ox = Math.sin(s * m.wb + m.pb) * m.ab;
                        oy = Math.cos(s * m.wb2 + m.pb2) * m.ab2;
                    } else { /* dvd */
                        t.tx += m.vx * dt; t.ty += m.vy * dt; t.rot += m.vr * dt;
                        if (t.tx < m.b.minX) { t.tx = m.b.minX; m.vx = Math.abs(m.vx); }
                        if (t.tx > m.b.maxX) { t.tx = m.b.maxX; m.vx = -Math.abs(m.vx); }
                        if (t.ty < m.b.minY) { t.ty = m.b.minY; m.vy = Math.abs(m.vy); }
                        if (t.ty > m.b.maxY) { t.ty = m.b.maxY; m.vy = -Math.abs(m.vy); }
                    }
                } else if (t.o) {
                    ox = Math.sin(s * t.o.wx + t.o.px) * t.o.ax +
                         Math.sin(s * t.o.wx2 + t.o.px2) * t.o.ax2;
                    oy = Math.sin(s * t.o.wy + t.o.py) * t.o.ay;
                    orot = Math.sin(s * t.o.wr + t.o.pr) * t.o.ar;
                }
                t.lox = ox; t.loy = oy; t.lor = orot;   // Magneto bakes these in
                renderT(t, ox, oy, orot);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    }

    function stopEngine() {
        engineOn = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        if (swapTimer) { clearTimeout(swapTimer); swapTimer = 0; }
        stTweens = [];
        if (io) { io.disconnect(); io = null; }
        touched.forEach(function (t) {
            delete t.el.__peT;
            t.mover = null;
        });
    }

    /* Captures the current undo lists so a fresh apply() can't be clobbered
       by a stale deferred restore from the previous off-cycle. */
    function captureRestores() {
        var escs = escapeeRestores, unclips = unclipRestores, rootOv = rootOverflowPrev;
        escapeeRestores = []; unclipRestores = []; rootOverflowPrev = null; unclipVisited = null;
        return function () {
            escs.forEach(function (r) {
                if (r.pos) r.el.style.position = r.pos; else r.el.style.removeProperty('position');
                if (r.z) r.el.style.zIndex = r.z; else r.el.style.removeProperty('z-index');
            });
            unclips.forEach(function (r) {
                if (r.ov) r.el.style.overflow = r.ov; else r.el.style.removeProperty('overflow');
                if (r.ovx) r.el.style.overflowX = r.ovx; else r.el.style.removeProperty('overflow-x');
                if (r.ovy) r.el.style.overflowY = r.ovy; else r.el.style.removeProperty('overflow-y');
            });
            if (rootOv) {
                if (rootOv.html) document.documentElement.style.overflowX = rootOv.html;
                else document.documentElement.style.removeProperty('overflow-x');
                if (rootOv.body) document.body.style.overflowX = rootOv.body;
                else document.body.style.removeProperty('overflow-x');
            }
        };
    }

    function scheduleRestore(fn, ms) {
        pendingRestore = {
            fn: fn,
            timer: setTimeout(function () { pendingRestore = null; fn(); }, ms)
        };
    }

    /* ---------- apply ---------- */
    function apply() {
        if (applied) return;
        applied = true;
        /* flush any pending Magneto undo so it can't fire mid-mode */
        if (pendingRestore) {
            clearTimeout(pendingRestore.timer);
            pendingRestore.fn();
            pendingRestore = null;
        }
        /* unclipped containers must not widen the page — clip the root while on */
        rootOverflowPrev = {
            html: document.documentElement.style.overflowX,
            body: document.body.style.overflowX
        };
        document.documentElement.style.overflowX = 'clip';
        document.body.style.overflowX = 'clip';

        var rng = mulberry32(Math.floor(Math.random() * 0xffffffff));
        document.documentElement.classList.add('modo-entropia');
        unclipVisited = new Set();
        var els = collectTargets();
        var gentle = collectGentle();
        unclipAll(els.concat(gentle));
        scatter(rng, els);
        swaps(rng);
        gentle.forEach(function (el) {
            touched.push({ el: el, tx: 0, ty: 0, rot: 0, sc: 1, vis: true, gentle: true });
        });
        setTimeout(function () { if (applied) startEngine(rng, els); }, 1400);
    }

    /* ---------- Magneto return ---------- */
    function releaseEl(t) {
        t.el.classList.remove('pe-chaos');
        t.el.style.removeProperty('transition');
        t.el.style.removeProperty('will-change');
        if (window.gsap) window.gsap.set(t.el, { clearProps: 'transform' });
        else t.el.style.removeProperty('transform');
    }

    function magnetoOff() {
        applied = false;
        stopEngine();
        document.documentElement.classList.remove('modo-entropia');
        var restore = captureRestores();
        if (!touched.length) { restore(); return; }
        var work = touched; touched = [];

        if (window.gsap && !prm) {
            var g = window.gsap;
            var maxDist = 1;
            work.forEach(function (t) {
                /* bake the last ambient offset so the g.set below doesn't snap */
                t.tx += t.lox || 0; t.ty += t.loy || 0; t.rot += t.lor || 0;
                t.lox = t.loy = t.lor = 0;
                /* normalize accumulated spin (dvd floaters) so the return
                   unwinds at most half a turn, not five */
                t.rot = ((t.rot % 360) + 540) % 360 - 180;
                t.dist = Math.sqrt(t.tx * t.tx + t.ty * t.ty) + Math.abs(t.rot) * 4;
                if (t.dist > maxDist) maxDist = t.dist;
            });
            work.forEach(function (t) {
                var el = t.el;
                g.killTweensOf(el);
                g.set(el, { x: t.tx, y: t.ty, rotation: t.rot, scale: t.sc || 1 });
                var norm = t.dist / maxDist;
                var jitter = Math.min(4, 1.5 + t.dist * 0.02);
                var tl = g.timeline({ delay: norm * 0.28 });
                // charge-up vibration — the magnet locking on
                tl.to(el, {
                    x: t.tx + jitter, y: t.ty - jitter,
                    duration: 0.04, repeat: 5 + Math.round(norm * 4), yoyo: true,
                    ease: 'none'
                });
                // the pull — momentum in, overshoot, settle
                tl.to(el, {
                    x: 0, y: 0, rotation: 0, scale: 1,
                    duration: 0.5 + norm * 0.55,
                    ease: 'back.out(1.9)',
                    onComplete: function () { releaseEl(t); }
                });
            });
            /* unclip/z-index undo waits until every escapee is home */
            scheduleRestore(restore, 2100);
        } else {
            work.forEach(function (t) {
                t.el.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)';
                if (window.gsap) window.gsap.set(t.el, { x: 0, y: 0, rotation: 0, scale: 1 });
                else t.el.style.transform = '';
            });
            scheduleRestore(function () {
                work.forEach(releaseEl);
                restore();
            }, 800);
        }
    }

    /* ---------- api + switches ---------- */
    var api = {
        on: function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} apply(); reflect(); },
        off: function () { try { localStorage.setItem(KEY, '0'); } catch (e) {} magnetoOff(); reflect(); },
        toggle: function () { (applied ? api.off : api.on)(); },
        active: function () { return applied; }
    };
    window.__peEntropy = api;   // gameboy console calls this
    window.PE_ENTROPY = api;

    function reflect() {
        document.querySelectorAll('[data-entropy-switch]').forEach(function (btn) {
            btn.setAttribute('aria-checked', applied ? 'true' : 'false');
            btn.classList.toggle('is-on', applied);
            // knob carries its own state class — project.css moves it without
            // relational selectors (Webflow styleLess constraint)
            var knob = btn.querySelector('.entropy-switch_knob');
            if (knob) knob.classList.toggle('is-on', applied);
        });
        document.querySelectorAll('.entropy-switch_icon').forEach(function (ic) {
            var isEntropy = ic.classList.contains('is-entropy');
            ic.classList.toggle('is-active', isEntropy === applied);
        });
    }

    function bind() {
        document.querySelectorAll('[data-entropy-switch]').forEach(function (btn) {
            if (btn.__peBound) return;
            btn.__peBound = true;
            btn.addEventListener('click', function () { api.toggle(); });
        });
        /* #entropy-btn (console menu) is bound by gameboy-embed.js and calls
           __peEntropy.toggle() — do NOT bind it here or it double-toggles. */
    }

    function boot() {
        bind();
        var on = false;
        try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
        if (on) {
            if (document.readyState === 'complete') setTimeout(apply, 400);
            else window.addEventListener('load', function () { setTimeout(apply, 400); });
        }
        reflect();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

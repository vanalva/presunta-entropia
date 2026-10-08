/* =============================================================
   PE MOTION v2 — entrance + scroll motion for every v2 page
   (companion css: css/pe-motion.css, the hero boot state only).

   Calm vocabulary: masks, clip-path wipes, split-line reveals, frame
   wipes with a slight image settle (1.08 -> 1), soft parallax on large
   photos, staggered rows, one scrubbed moment (the talleres timeline).
   No opacity fades, no skew, no velocity, no bounce, no tilt.
   Everything reveals once and is never hidden again.

   HOW IT PICKS TARGETS
   - The hero (first .hero_component) gets a load sequence: logo + dock,
     pills, eyebrow, H1 lines, paragraph lines, CTAs; the image column and
     the right frame (console / photo) wipe up. It runs only when it cannot
     flash: behind the preloader (#pe-preloader) or when the head snippet
     put html.pe-m-boot on the page (see pe-motion.css). Otherwise the
     hero is left static.
   - Everything below the hero is matched by ROLE (table below), in order:
     containers first, text last. An element inside an already-tagged one
     is skipped (the card animates, its heading does not).
   - Anything on screen when tagged is left alone (it was already seen),
     unless the preloader is still covering the page.

   OVERRIDES — put on any element:
     data-pe-motion="none"      never animate this element or its subtree
     data-pe-motion="lines"     split-line mask reveal (headings, leads)
     data-pe-motion="wipe"      block rises out of its own mask
     data-pe-motion="frame"     image frame wipes up, inner <img> settles
     data-pe-motion="parallax"  on an <img> inside an overflow-hidden frame
     (also accepted: "card", "item", "draw")

   NEVER TOUCHED: the PE-83 console, .text-reveal manifesto, the dynamic
   banner, marquees, the Espacios sticky stack, booking modal, hero
   swiper, fixed widgets, fullscreen menu, Webflow embeds (SKIP below).
   The hero dock itself is never clipped (hero-dock.js watches it with an
   IntersectionObserver) — only its buttons are.

   SAFETY
   - Nothing is hidden by CSS unless JS ran (no-JS = static page).
   - prefers-reduced-motion: nothing at all.
   - Libraries: uses window.gsap (injects gsap core if missing), then
     ScrollTrigger + SplitText 3.13 from jsDelivr. No gsap = no motion
     (nothing gets hidden). No SplitText = block wipes instead of lines.
     No ScrollTrigger = no parallax/scrub (reveals still work).
   - Modo Entropía (html.modo-entropia) owns inline transforms: when it
     switches on, every tween/split/ScrollTrigger here is killed and the
     elements are handed back untouched. On at load = no motion.
   - Reveal checks read live DOM positions on scroll (rAF-throttled), so
     lists hydrated or re-rendered after load are handled; tagging runs
     again after `load`. Clones of a waiting element (page scripts copy
     markup) are shown at once.
   - QA: window.PEMotion { pending, check, tag, revealAll, release, ... }
   ============================================================= */
(function () {
  'use strict';

  var html = document.documentElement;
  function unboot() { html.classList.remove('pe-m-boot'); }
  function noop() {}

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    unboot();
    window.PEMotion = { off: 'reduced-motion', pending: function () { return []; }, check: noop, tag: noop };
    return;
  }

  /* ---------- config: role -> move ---------- */
  var CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/';

  var MOVES = {
    //          duration  ease            gap = stagger step when several enter together
    lines: { dur: 1.0,  ease: 'expo.out',   gap: 0.10, each: 0.08 },
    wipe:  { dur: 0.9,  ease: 'power3.out', gap: 0.08, y: 24 },
    draw:  { dur: 0.8,  ease: 'power3.out', gap: 0.06 },
    card:  { dur: 1.0,  ease: 'expo.out',   gap: 0.09, y: 40 },
    frame: { dur: 1.1,  ease: 'expo.out',   gap: 0.10 },
    item:  { dur: 0.7,  ease: 'power3.out', gap: 0.06, y: 20 }
  };
  var HIDE = {              // clip-path while waiting (same shape as SHOW, so it tweens)
    lines: 'inset(0% 0% 100% 0%)',
    wipe:  'inset(0% 0% 100% 0%)',
    draw:  'inset(0% 100% 0% 0%)',
    card:  'inset(100% 0% 0% 0%)',
    frame: 'inset(100% 0% 0% 0%)',
    item:  'inset(0% 0% 100% 0%)'
  };
  var SHOW = 'inset(-12% -12% -12% -12%)';   // a little past the box (button offset shadow), cleared at the end

  function cardFilter(el) {
    var ok = false;
    for (var i = 0; i < el.classList.length; i++) if (/_(card|item)$/.test(el.classList[i])) ok = true;
    return ok && !/(^|\s)(slider_bullet|navbar|cart|booking|hero_image-marquee|w-dyn)/.test(el.className);
  }
  function frameFilter(el) {
    var r = el.getBoundingClientRect();
    return r.width > 160 && r.height > 120 && !!el.querySelector('img');
  }

  var ROLES = [
    // role      move     selector
    { role: 'slide',   move: 'card',  sel: '.swiper-slide, .w-slide', slide: true },
    { role: 'card',    move: 'card',  sel: '[class*="_card"], [class*="_item"]', filter: cardFilter },
    { role: 'row',     move: 'item',  sel: '[class*="_accordion"], .talleres-list_linea-de-tiempo_timeline-step, .form_field-wrapper, .footer15_link-list, .footer15_social-link, .footer15_legal-link, .footer15_credit-text' },
    { role: 'frame',   move: 'frame', sel: '[class*="_image-wrapper"]', filter: frameFilter },
    { role: 'title',   move: 'lines', sel: 'h1, h2, .u-text-style-h1, .u-text-style-h2, .f-text-hero, .f-text-giant, .f-text-h1, .f-text-h2' },
    { role: 'eyebrow', move: 'draw',  sel: '.text-style-tagline, .f-text-eyebrow' },
    { role: 'lead',    move: 'lines', sel: 'p.text-size-huge, p.text-size-large, p.text-size-medium, p.f-text-lead' }
  ];
  var PARALLAX = '.hero_wrapper-right .hero_image-wrapper img, .talleres_caracteristicas-2_image, ' +
    '.contacto_ubicaciones_image-wrapper img, img[data-pe-motion="parallax"]';
  var PARALLAX_SCALE = 1.1;         // headroom for a few % of travel
  var SCRUB_BARS = '.talleres-list_linea-de-tiempo_progress-bar';
  var SKIP = '.pe-con, [data-pe-console], .text-reveal, .section_dynamic-banner, [class*="marquee"], ' +
    '.espacios_card, .booking-modal_component, [class*="booking-modal_"], .hero-swiper, .pe-float, ' +
    '.navbar_fixed-button-container, .navbar_menu, .navbar_fullscreen, .w-nav-overlay, ' +
    '.cart-modal_component, #pe-preloader, .w-embed, [data-pe-motion="none"]';
  var LINE_AT = 0.88;               // reveal when the top crosses 88% of the viewport
  var MAX_DELAY = 0.6;

  /* ---------- state ---------- */
  var g = null, ST = null, Split = null;
  var recs = [], byEl = new WeakMap();
  var heroRoot = null, heroTl = null, heroParts = null, heroSplits = [];
  var triggers = [];
  var raf = 0, listening = false, sweepTimer = 0, released = false, started = false;

  /* ---------- library loading ---------- */
  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
      setTimeout(rej, 6000);
    });
  }
  function settle(p) { return p.then(function () { return true; }, function () { return false; }); }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  var coreReady = window.gsap ? Promise.resolve() : load(CDN + 'gsap.min.js');
  var pluginsReady = settle(coreReady).then(function (ok) {
    if (!ok || !window.gsap) return;
    return Promise.all([
      window.ScrollTrigger ? true : settle(load(CDN + 'ScrollTrigger.min.js')),
      window.SplitText ? true : settle(load(CDN + 'SplitText.min.js'))
    ]).then(function () {
      try { if (window.ScrollTrigger) { window.gsap.registerPlugin(window.ScrollTrigger); ST = window.ScrollTrigger; } } catch (e) { ST = null; }
      try { if (window.SplitText) { window.gsap.registerPlugin(window.SplitText); Split = window.SplitText; } } catch (e) { Split = null; }
    });
  });

  /* ---------- helpers ---------- */
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function arr(list) { return Array.prototype.slice.call(list); }
  function isPar(img) { return img && img.hasAttribute('data-pe-m-par'); }
  function baseScale(img) { return isPar(img) ? PARALLAX_SCALE : 1; }
  function innerImg(el) { return el.tagName === 'IMG' ? null : el.querySelector('img'); }
  function clearEl(el) {
    var chaos = el.classList.contains('pe-chaos');   // Modo Entropía owns its transform
    g.set(el, { clearProps: chaos ? 'clipPath,transition,willChange' : 'clipPath,transform,transition,willChange' });
  }
  function clearImg(img) {
    if (!img) return;
    g.set(img, { clearProps: isPar(img) ? 'transition,willChange' : 'transform,transition,willChange' });
    if (isPar(img)) g.set(img, { scale: PARALLAX_SCALE });
    img.removeAttribute('data-pe-m-img');
  }
  function splitLines(el) {
    if (!Split) return null;
    try {
      var s = Split.create ? Split.create(el, { type: 'lines', mask: 'lines' }) : new Split(el, { type: 'lines', mask: 'lines' });
      if (s && s.lines && s.lines.length) return s;
      if (s) s.revert();
    } catch (e) {}
    return null;
  }

  /* ---------- scroll reveals ---------- */
  function prep(el, move) {
    var m = MOVES[move];
    var s = { clipPath: HIDE[move], transition: 'none' };
    if (m.y) s.y = m.y;
    g.set(el, s);
    var rec = { el: el, move: move, img: null };
    if (move === 'card' || move === 'frame') {
      var img = innerImg(el);
      if (img && !img.closest(SKIP)) {
        rec.img = img;
        img.setAttribute('data-pe-m-img', '');
        g.set(img, { scale: baseScale(img) + 0.08, transition: 'none' });
      }
    }
    el.setAttribute('data-pe-m', 'wait');
    byEl.set(el, rec);
    recs.push(rec);
    return rec;
  }

  function done(rec) {
    if (rec.split) { rec.split.revert(); rec.split = null; }
    clearEl(rec.el);
    clearImg(rec.img);
    rec.el.setAttribute('data-pe-m', 'done');
    rec.tl = null;
  }

  function reveal(rec, delay) {
    var el = rec.el, m = MOVES[rec.move];
    el.setAttribute('data-pe-m', 'in');
    var tl = g.timeline({ delay: delay || 0, onComplete: function () { done(rec); } });
    rec.tl = tl;
    if (rec.move === 'lines') {
      var split = splitLines(el);
      if (split) {
        rec.split = split;
        g.set(el, { clipPath: 'none' });
        g.set(split.lines, { yPercent: 110 });
        tl.to(split.lines, {
          yPercent: 0, duration: m.dur, ease: m.ease,
          stagger: split.lines.length > 1 ? Math.min(m.each, 0.45 / (split.lines.length - 1)) : 0
        });
        return;
      }
    }
    g.set(el, { willChange: 'transform, clip-path' });
    tl.to(el, { clipPath: SHOW, y: 0, duration: m.dur, ease: m.ease }, 0);
    if (rec.img) tl.to(rec.img, { scale: baseScale(rec.img), duration: m.dur + 0.25, ease: 'expo.out' }, 0);
  }

  // a waiting element without a record: a page script copied the markup.
  // Show it as it is, no animation.
  function orphan(el) {
    el.style.clipPath = ''; el.style.transform = ''; el.style.transition = ''; el.style.willChange = '';
    el.removeAttribute('data-pe-m');
    arr(el.querySelectorAll('[data-pe-m-img]')).forEach(function (img) {
      if (!isPar(img)) img.style.transform = '';
      img.style.transition = '';
      img.removeAttribute('data-pe-m-img');
    });
  }

  function check() {
    raf = 0;
    if (released || !g) return;
    var line = innerHeight * LINE_AT;
    var atBottom = scrollY + innerHeight >= html.scrollHeight - 4;   // nothing can rise any further
    var waiting = document.querySelectorAll('[data-pe-m="wait"]');
    var hits = [], left = 0;
    for (var i = 0; i < waiting.length; i++) {
      var el = waiting[i], rec = byEl.get(el);
      if (!rec) { orphan(el); continue; }
      var r = el.getBoundingClientRect();
      if (atBottom || r.top < line) hits.push({ rec: rec, top: r.top, left: r.left, gone: r.bottom <= 0 });
      else left++;
    }
    // reads done — now write
    hits.sort(function (a, b) { return (a.top - b.top) || (a.left - b.left); });
    var d = 0;
    hits.forEach(function (h) {
      // skipped past on a jump (anchor link, fast fling): finish it at once, no stagger slot
      if (h.gone) { reveal(h.rec, 0); return; }
      reveal(h.rec, Math.min(d, MAX_DELAY));
      d += MOVES[h.rec.move].gap;
    });
    if (!left) stopListening();
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(check); }
  function startListening() {
    if (listening || released) return;
    listening = true;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // cheap safety sweep: late layout shifts, re-rendered blocks
    sweepTimer = setInterval(onScroll, 1500);
    onScroll();
  }
  function stopListening() {
    if (!listening) return;
    listening = false;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    clearInterval(sweepTimer);
  }

  function consider(el, move, role, covered) {
    if (el.hasAttribute('data-pe-m')) return;
    if (el.closest(SKIP)) return;
    if (heroRoot && heroRoot.contains(el)) return;
    if (el.parentElement && el.parentElement.closest('[data-pe-m]')) return;   // its container animates
    if (el.querySelector('[data-pe-m]')) return;
    if (!role.slide && el.closest('.swiper, .w-slider')) return;              // slides own their contents
    if (role.filter && !role.filter(el)) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.bottom <= 0) return;                                                 // already scrolled past
    if (!covered && r.top < innerHeight && r.bottom > 0) return;              // already seen
    if (role.slide && (r.left >= innerWidth || r.right <= 0)) return;         // off-screen slide: leave it
    var cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky' || cs.display === 'inline') return;
    prep(el, move);
  }

  function tag(opts) {
    if (!g || released || html.classList.contains('modo-entropia')) return;
    var covered = !!(opts && opts.covered);
    // explicit overrides first
    arr(document.querySelectorAll('[data-pe-motion]')).forEach(function (el) {
      var mv = el.getAttribute('data-pe-motion');
      if (!MOVES[mv]) return;
      consider(el, mv, { role: 'override' }, covered);
    });
    ROLES.forEach(function (role) {
      arr(document.querySelectorAll(role.sel)).forEach(function (el) {
        // Webflow slides carry their own transform: animate the slide's content
        var target = role.slide ? el.firstElementChild : el;
        if (!target || (role.slide && el.closest('.hero-swiper, [class*="marquee"]'))) return;
        if (role.slide) {
          var r = el.getBoundingClientRect();
          if (r.left >= innerWidth || r.right <= 0) return;
        }
        consider(target, role.move, role, covered);
      });
    });
    if (started) startListening();
  }

  /* ---------- parallax + scrub (ScrollTrigger) ---------- */
  function parallax() {
    if (!ST || released) return;
    arr(document.querySelectorAll(PARALLAX)).forEach(function (img) {
      if (img.hasAttribute('data-pe-m-par') || img.closest(SKIP)) return;
      var frame = img.parentElement;
      if (!frame || !visible(img)) return;
      var ov = getComputedStyle(frame);
      if (ov.overflowY === 'visible' && ov.overflowX === 'visible') return;   // would spill out
      var inHero = heroRoot && heroRoot.contains(img);
      img.setAttribute('data-pe-m-par', '');
      // an image still waiting for its reveal settles onto the parallax scale instead of 1
      g.set(img, { scale: PARALLAX_SCALE + (img.hasAttribute('data-pe-m-img') ? 0.08 : 0) });
      var tw = g.fromTo(img, { yPercent: inHero ? 0 : -4 }, {
        yPercent: inHero ? 5 : 4, ease: 'none',
        scrollTrigger: { trigger: frame, start: inHero ? 'top top' : 'top bottom', end: 'bottom top', scrub: true }
      });
      triggers.push({ tw: tw, el: img });
    });
    arr(document.querySelectorAll(SCRUB_BARS)).forEach(function (bar) {
      if (bar.hasAttribute('data-pe-m-scrub') || bar.closest(SKIP)) return;
      var track = bar.parentElement && bar.parentElement.parentElement || bar;
      bar.setAttribute('data-pe-m-scrub', '');
      var tw = g.fromTo(bar, { scaleY: 0 }, {
        scaleY: 1, ease: 'none', transformOrigin: '50% 0%',
        scrollTrigger: { trigger: track, start: 'top 75%', end: 'bottom 55%', scrub: 0.6 }
      });
      triggers.push({ tw: tw, el: bar });
    });
  }

  /* ---------- hero load sequence ---------- */
  function findHero() {
    var comp = document.querySelector('.hero_component');
    if (!comp) return null;
    return comp.closest('header, section') || comp;
  }
  function heroQuery(sel, scope) {
    return arr((scope || heroRoot).querySelectorAll(sel)).filter(function (el) {
      return visible(el) && !el.closest(SKIP);
    });
  }
  // hero CTA = legacy .is-large/.is-xlarge, or migrated (.hero_cta / f-text-ui-lg|xl size class)
  function isHeroCta(b) {
    var c = b.classList;
    return c.contains('is-large') || c.contains('hero_cta') || c.contains('f-text-ui-lg') || c.contains('f-text-ui-xl');
  }
  function collectHero() {
    var left = heroRoot.querySelector('.hero_wrapper-left') || heroRoot;
    var top = left.querySelector('.hero_content-top');
    function notTop(el) { return !top || !top.contains(el); }
    var p = {
      logo: heroQuery('.navbar18_logo-link', left),
      dock: heroQuery('.hero-dock > *', left),
      pills: heroQuery('.button', left).filter(function (b) { return notTop(b) && !isHeroCta(b); }),
      eyebrow: heroQuery('.text-style-tagline, .f-text-eyebrow', left).filter(notTop),
      title: heroQuery('h1', left).slice(0, 1),
      lead: heroQuery('p', left).filter(notTop).slice(0, 1),
      ctas: heroQuery('.button.is-large, .button.hero_cta, .button.f-text-ui-lg, .button.f-text-ui-xl, .entropy-switch_wrap', left).filter(notTop),
      column: heroQuery('.hero_content-middle'),
      right: heroQuery('.hero_wrapper-right'),
      rightImg: heroQuery('.hero_wrapper-right .hero_image-wrapper img')
    };
    return p;
  }
  function heroAll(p) {
    return [].concat(p.logo, p.dock, p.pills, p.eyebrow, p.title, p.lead, p.ctas, p.column, p.right);
  }
  function heroPrep() {
    var p = heroParts = collectHero();
    g.set(p.logo.concat(p.eyebrow), { clipPath: HIDE.draw, transition: 'none' });
    g.set(p.dock.concat(p.ctas), { clipPath: HIDE.item, y: 14, transition: 'none' });
    g.set(p.pills, { clipPath: HIDE.item, yPercent: 70, transition: 'none' });
    g.set(p.title.concat(p.lead), { clipPath: HIDE.lines });
    g.set(p.column.concat(p.right), { clipPath: HIDE.frame });   // clip only: the console can dock position:fixed inside
    p.rightImg.forEach(function (img) { img.setAttribute('data-pe-m-img', ''); g.set(img, { scale: baseScale(img) + 0.08, transition: 'none' }); });
    heroAll(p).forEach(function (el) { el.setAttribute('data-pe-m', 'hero'); });
  }
  function heroLines(tl, els, at, each, dur) {
    els.forEach(function (el) {
      var s = splitLines(el);
      if (s) {
        heroSplits.push(s);
        g.set(el, { clipPath: 'none' });
        g.set(s.lines, { yPercent: 110 });
        tl.to(s.lines, { yPercent: 0, duration: dur, ease: 'expo.out', stagger: each }, at);
      } else {
        g.set(el, { y: 24 });
        tl.to(el, { clipPath: SHOW, y: 0, duration: dur, ease: 'power3.out' }, at);
      }
    });
  }
  function heroDone() {
    heroSplits.forEach(function (s) { s.revert(); });
    heroSplits = [];
    if (!heroParts) return;
    heroAll(heroParts).forEach(function (el) { clearEl(el); el.removeAttribute('data-pe-m'); });
    heroParts.rightImg.forEach(clearImg);
    heroTl = null;
  }
  function heroPlay() {
    if (released || !heroParts) return;
    var p = heroParts;
    var tl = heroTl = g.timeline({ onComplete: heroDone });
    // frames first: the image column and the right frame rise out of their masks
    if (p.column.length) tl.to(p.column, { clipPath: SHOW, duration: 1.1, ease: 'expo.out' }, 0.05);
    if (p.right.length) tl.to(p.right, { clipPath: SHOW, duration: 1.1, ease: 'expo.out' }, 0.15);
    p.rightImg.forEach(function (img) { tl.to(img, { scale: baseScale(img), duration: 1.3, ease: 'expo.out' }, 0.15); });
    // the text cluster, top to bottom
    if (p.logo.length) tl.to(p.logo, { clipPath: SHOW, duration: 0.8, ease: 'power3.out' }, 0.1);
    if (p.dock.length) tl.to(p.dock, { clipPath: SHOW, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, 0.15);
    if (p.pills.length) tl.to(p.pills, { clipPath: SHOW, yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07 }, 0.25);
    if (p.eyebrow.length) tl.to(p.eyebrow, { clipPath: SHOW, duration: 0.7, ease: 'power3.out' }, 0.35);
    heroLines(tl, p.title, 0.4, 0.09, 1.0);
    heroLines(tl, p.lead, 0.62, 0.05, 0.9);
    if (p.ctas.length) tl.to(p.ctas, { clipPath: SHOW, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.8);
  }

  // resolves when the boot preloader starts lifting (or is gone / never ran)
  function preloaderGone(pre) {
    if (!pre) return Promise.resolve();
    return new Promise(function (res) {
      function test() { return !pre.isConnected || pre.classList.contains('pe-preloader-fade-out'); }
      if (test()) return res();
      var mo = new MutationObserver(function () { if (test()) { mo.disconnect(); res(); } });
      mo.observe(pre, { attributes: true, attributeFilter: ['class'] });
      if (pre.parentNode) mo.observe(pre.parentNode, { childList: true });
      setTimeout(function () { mo.disconnect(); res(); }, 4000);
    });
  }

  /* ---------- Modo Entropía hand-back ---------- */
  function release() {
    if (released) return;
    released = true;
    stopListening();
    if (heroTl) heroTl.kill();
    heroDone();
    recs.forEach(function (rec) {
      if (rec.tl) rec.tl.kill();
      if (rec.split) { rec.split.revert(); rec.split = null; }
      clearEl(rec.el);
      if (rec.img) { g.set(rec.img, { clearProps: 'transform,transition,willChange' }); rec.img.removeAttribute('data-pe-m-img'); }
      rec.el.removeAttribute('data-pe-m');
    });
    triggers.forEach(function (t) {
      if (t.tw.scrollTrigger) t.tw.scrollTrigger.kill();
      t.tw.kill();
      g.set(t.el, { clearProps: 'transform' });
      t.el.removeAttribute('data-pe-m-par');
      t.el.removeAttribute('data-pe-m-scrub');
    });
    triggers = [];
    arr(document.querySelectorAll('[data-pe-m]')).forEach(orphan);
  }
  new MutationObserver(function () {
    if (html.classList.contains('modo-entropia') && g) release();
  }).observe(html, { attributes: true, attributeFilter: ['class'] });

  /* ---------- boot ---------- */
  function start() {
    g = window.gsap;
    if (!g || html.classList.contains('modo-entropia')) { unboot(); return; }
    heroRoot = findHero();
    var pre = document.getElementById('pe-preloader');
    var heroVisible = heroRoot && heroRoot.getBoundingClientRect().bottom > 0;
    var intro = !!(heroVisible && (pre || html.classList.contains('pe-m-boot')));
    if (intro) heroPrep();
    unboot();
    tag({ covered: !!pre });

    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var go = Promise.race([Promise.all([preloaderGone(pre), settle(fonts), pluginsReady]), wait(4500)]);
    go.then(function () {
      if (released) return;
      if (intro) heroPlay();
      started = true;
      startListening();
    });
    pluginsReady.then(function () { parallax(); if (ST) ST.refresh(); });
  }

  coreReady.then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }, unboot);

  // lists filled later (CMS hydrators) get tagged too
  window.addEventListener('load', function () {
    setTimeout(function () { tag(); parallax(); if (ST) ST.refresh(); }, 300);
    setTimeout(function () { tag(); if (ST) ST.refresh(); }, 1500);
  });

  /* ---------------------------------------------------------------
     MAIN BUTTON — slide + press (lab 01b). Wraps the label of every
     volume .button in a stack with an inverted "next state" that rises
     from below on hover; the 3px press is project.css's .button:hover.
     Styles: css/pe-motion.css (MAIN BUTTON). Runs on every v2 page.
     --------------------------------------------------------------- */
  var RISE_PAGES = /.*/;   // every page that loads this script (home is index.html since 2026-10-01)
  var RISE_TEXT = {           // label -> what the rising state says
    'talleres': 'Ver talleres',
    'reserva ya': 'Elegir fecha',
    'reservar ahora': 'Elegir fecha',
    'menu': 'Abrir menú',
    'reserva': 'Elegir fecha',
    'saber más': 'Ver detalles'
  };
  var RISE_GLYPH = '<svg class="pe-rise_glyph" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0 L9 5 L2 10 Z" fill="currentColor"/></svg>';
  // the colour of the surface a button sits on: its own background if
  // opaque, else the nearest ancestor's (the inverted state's ink)
  function surfaceBg(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var bg = getComputedStyle(e).backgroundColor;
      var m = bg && bg.match(/rgba?\(([^)]+)\)/);
      if (m) { var p = m[1].split(','); if (p.length < 4 || parseFloat(p[3]) > 0.5) return bg; }
    }
    return 'rgb(13, 22, 29)';
  }
  // the rising text must fit inside the frame: wanted text with the
  // glyph, then without it, then the button's own label with and without
  // the glyph. Hidden buttons (the menu's copies) are fitted on first hover.
  function fitRise(b) {
    var alt = b.querySelector('.pe-rise_alt');
    if (!alt || !b.getClientRects().length || !b.clientWidth) return;
    var room = alt.clientWidth - 16;   // 8px of air each side inside the panel
    var tries = [[alt.__peWant, true], [alt.__peWant, false], [alt.__peLabel, true], [alt.__peLabel, false]];
    for (var i = 0; i < tries.length; i++) {
      // measure an inline wrapper: the flex box itself never reports less
      // than its own width
      alt.innerHTML = '<span class="pe-rise_txt">' + (tries[i][1] ? RISE_GLYPH : '') + '</span>';
      alt.firstChild.appendChild(document.createTextNode(tries[i][0]));
      if (alt.firstChild.getBoundingClientRect().width <= room) break;
    }
    b.__peFit = true;
  }
  function riseButtons(root) {
    if (!RISE_PAGES.test(location.pathname.replace(/\/$/, ''))) return 0;
    var n = 0;
    arr((root || document).querySelectorAll('.button')).forEach(function (b) {
      if (b.classList.contains('pe-rise')) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName)) return;
      if (b.matches('.is-simple, .is-link, .is-tiny, .is-small, .hero_pill, .is-form') || claimed(b)) return;
      if (riseOne(b)) n++;
    });
    return n;
  }
  function riseOne(b) {
    var label = (b.textContent || '').replace(/\s+/g, ' ').trim();
    if (!label) return false;
    var cs = getComputedStyle(b);
    var lab = document.createElement('span');
    lab.className = 'pe-rise_label';
    while (b.firstChild) lab.appendChild(b.firstChild);
    var alt = document.createElement('span');
    alt.className = 'pe-rise_alt';
    alt.setAttribute('aria-hidden', 'true');
    b.appendChild(lab); b.appendChild(alt);
    alt.__peWant = RISE_TEXT[label.toLowerCase()] || label;
    alt.__peLabel = label;
    fitRise(b);
    // the inverted state: the button's text colour fills, the surface it
    // sits on becomes the ink
    b.style.setProperty('--pe-rise-bg', cs.color);
    b.style.setProperty('--pe-rise-ink', surfaceBg(b));
    anchor(b);
    b.classList.add('pe-rise');
    return true;
  }
  /* The other two families (lab 05 and 06). Juan's split, 2026-09-26:
       main volume buttons ........ slide + press  (riseButtons above)
       flat secondary (.is-simple)  power on       (.pe-pwr)
       small buttons, tags, pills . ticker         (.pe-tick)
     Small wins over flat: a small .is-simple chip gets the ticker. */
  var TICK_SEL = '.button.is-small, .button.is-tiny, .hero_pill, .productos_card-tag, a.tag, .tag.is-filter-tag';
  function wrapLabel(b, cls) {
    var lab = document.createElement('span');
    lab.className = cls;
    while (b.firstChild) lab.appendChild(b.firstChild);
    b.appendChild(lab);
    return lab;
  }
  // the effect layers are absolute children, so the button must be a
  // containing block; never override a button that is already positioned
  function anchor(b) {
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  }
  function claimed(b) {
    return b.classList.contains('pe-tick') || b.classList.contains('pe-rise') || b.classList.contains('pe-pwr');
  }
  function tickButtons(root) {
    var n = 0;
    arr((root || document).querySelectorAll(TICK_SEL)).forEach(function (b) {
      if (claimed(b) || /^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName)) return;
      if (tickOne(b)) n++;
    });
    return n;
  }
  function tickOne(b) {
    var label = (b.textContent || '').replace(/\s+/g, ' ').trim();
    if (!label) return false;
    var cs = getComputedStyle(b);
    wrapLabel(b, 'pe-tick_label');
    var track = document.createElement('span');
    track.className = 'pe-tick_track';
    track.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) {
      var item = document.createElement('span');
      item.innerHTML = RISE_GLYPH;
      item.appendChild(document.createTextNode(label));
      track.appendChild(item);
    }
    b.appendChild(track);
    b.style.setProperty('--pe-tick-pad', cs.paddingLeft);
    // the same reading speed for short and long labels
    b.style.setProperty('--pe-tick-dur', Math.max(1.6, label.length * 0.22).toFixed(2) + 's');
    anchor(b);
    b.classList.add('pe-tick');
    return true;
  }
  function powerButtons(root) {
    var n = 0;
    arr((root || document).querySelectorAll('.button.is-simple')).forEach(function (b) {
      if (claimed(b) || b.matches(TICK_SEL) || b.matches('.is-link')) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName)) return;
      if (powerOne(b)) n++;
    });
    return n;
  }
  function powerOne(b) {
    if (!(b.textContent || '').trim()) return false;
    var cs = getComputedStyle(b);
    wrapLabel(b, 'pe-pwr_label');
    b.style.setProperty('--pe-rest-bg', cs.backgroundColor);
    b.style.setProperty('--pe-rest-color', cs.color);
    b.style.setProperty('--pe-fx-bg', cs.color);
    b.style.setProperty('--pe-fx-ink', surfaceBg(b));
    anchor(b);
    b.classList.add('pe-pwr');
    return true;
  }

  /* PLATFORM CONTROLS (Entropical embeds: packs dialogs, cart pack block,
     "También con pack"). They are drawn after this script runs, so they
     are dressed on demand: the first time the pointer or keyboard focus
     reaches one, it gets the family of its role (UI contract:
     data-ep-role). primary / secondary = slide, quiet = power on,
     chip = ticker; link, close and option stay plain. Until the app
     release with roles is live, PLATFORM_FALLBACK maps today's classes.
     A label the platform rewrites later (busy state, price) is picked up
     again on the next hover. Reduced motion is handled by pe-motion.css
     for these classes like for every site button. */
  var ROLE_FX = { primary: riseOne, secondary: riseOne, quiet: powerOne, chip: tickOne };
  var PLATFORM_FALLBACK = [
    ['.ep-btn.ep-secondary', 'secondary'], ['.ep-btn', 'primary'], ['.cart-pack_btn', 'primary'],
    ['.ep-covers-btn', 'chip'], ['.cart-modal_refresh-btn', 'quiet'], ['.cart-modal_clear-btn', 'quiet']
  ];
  var PLATFORM_SEL = '[data-ep-role], ' + PLATFORM_FALLBACK.map(function (p) { return p[0]; }).join(', ');
  function platformRole(b) {
    var r = b.getAttribute('data-ep-role');
    if (r) return r;
    for (var i = 0; i < PLATFORM_FALLBACK.length; i++) if (b.matches(PLATFORM_FALLBACK[i][0])) return PLATFORM_FALLBACK[i][1];
    return null;
  }
  function dressPlatform(e) {
    var b = e.target && e.target.closest && e.target.closest(PLATFORM_SEL);
    if (!b || /^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName) || b.getAttribute('aria-busy') === 'true') return;
    if (claimed(b)) {
      // the platform rewrote the label since: refit the rising copy
      var alt = b.querySelector('.pe-rise_alt');
      var now = (b.querySelector('.pe-rise_label') || b).textContent.replace(/\s+/g, ' ').trim();
      if (alt && now && alt.__peLabel !== now) { alt.__peLabel = alt.__peWant = now; fitRise(b); }
      return;
    }
    var fx = ROLE_FX[platformRole(b)];
    if (fx && RISE_PAGES.test(location.pathname.replace(/\/$/, ''))) fx(b);
  }
  document.addEventListener('pointerover', dressPlatform, true);
  document.addEventListener('focusin', dressPlatform, true);
  // icon-only buttons (the navbar cart): the same slide inside a clipped
  // inner layer, so a badge poking out of the corner is never cut
  var RISE_ICON_SEL = 'button.cart-header_button';
  function riseIcons(root) {
    var n = 0;
    arr((root || document).querySelectorAll(RISE_ICON_SEL)).forEach(function (b) {
      if (claimed(b) || b.classList.contains('pe-rise-icon')) return;
      var icon = b.querySelector('svg, img');
      if (!icon) return;
      var cs = getComputedStyle(b);
      var clip = document.createElement('span');
      clip.className = 'pe-rise_clip';
      clip.setAttribute('aria-hidden', 'true');
      var lab = document.createElement('span');
      lab.className = 'pe-rise_ilabel';
      var alt = document.createElement('span');
      alt.className = 'pe-rise_ialt';
      alt.appendChild(icon.cloneNode(true));
      icon.parentNode.insertBefore(clip, icon);
      lab.appendChild(icon);
      clip.appendChild(lab); clip.appendChild(alt);
      b.style.setProperty('--pe-rest-bg', cs.backgroundColor);
      b.style.setProperty('--pe-rest-color', cs.color);
      b.style.setProperty('--pe-rest-border', cs.borderTopColor);
      b.style.setProperty('--pe-rise-bg', cs.color);
      b.style.setProperty('--pe-rise-ink', surfaceBg(b));
      anchor(b);
      b.classList.add('pe-rise-icon');
      n++;
    });
    return n;
  }
  // cart buttons created after load (the one next to every Reservar, js/pe-booking-flow.js)
  // get the same slide the first time a pointer or focus reaches them
  function dressIcon(e) {
    var b = e.target && e.target.closest && e.target.closest(RISE_ICON_SEL);
    if (!b || b.classList.contains('pe-rise-icon') || !RISE_PAGES.test(location.pathname.replace(/\/$/, ''))) return;
    riseIcons(b.parentNode);
  }
  document.addEventListener('pointerover', dressIcon, true);
  document.addEventListener('focusin', dressIcon, true);
  function buttonFx(root) {
    if (!RISE_PAGES.test(location.pathname.replace(/\/$/, ''))) return {};
    // small first, so a small flat chip is claimed by the ticker
    return { tick: tickButtons(root), rise: riseButtons(root), power: powerButtons(root), icon: riseIcons(root) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { buttonFx(); });
  else buttonFx();
  // colours are read at rest only (a hovered .is-simple already swaps its
  // own colours, and reading those would invert the inversion): at load,
  // and again when Modo Entropia or a theme class repaints the page
  function refreshFx() {
    arr(document.querySelectorAll('.pe-rise, .pe-pwr')).forEach(function (b) {
      if (b.matches(':hover') || !b.getClientRects().length) return;
      var c = getComputedStyle(b).color, ink = surfaceBg(b);
      if (b.classList.contains('pe-rise')) { b.style.setProperty('--pe-rise-bg', c); b.style.setProperty('--pe-rise-ink', ink); }
      else {
        b.style.setProperty('--pe-rest-bg', getComputedStyle(b).backgroundColor);
        b.style.setProperty('--pe-rest-color', c);
        b.style.setProperty('--pe-fx-bg', c); b.style.setProperty('--pe-fx-ink', ink);
      }
      if (b.classList.contains('pe-rise')) fitRise(b);
    });
  }
  // a button that was hidden at load (menu copies) is fitted and coloured
  // the first time the pointer or focus reaches it, before it animates
  function firstTouch(e) {
    var b = e.target && e.target.closest && e.target.closest('.pe-rise');
    if (!b || b.__peFit) return;
    b.classList.add('pe-rise-hold');
    fitRise(b);
    var c = b.style.getPropertyValue('--pe-rise-bg');
    if (!c) { b.style.setProperty('--pe-rise-bg', getComputedStyle(b).color); b.style.setProperty('--pe-rise-ink', surfaceBg(b)); }
    b.classList.remove('pe-rise-hold');
  }
  document.addEventListener('pointerover', firstTouch, true);
  document.addEventListener('focusin', firstTouch, true);
  var fxT = 0;
  if (window.MutationObserver) {
    var fxObs = new MutationObserver(function () { clearTimeout(fxT); fxT = setTimeout(refreshFx, 80); });
    fxObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) fxObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  window.PEMotion = {   // QA hooks
    version: '2.0.0',
    roles: ROLES, moves: MOVES,
    pending: function () { return arr(document.querySelectorAll('[data-pe-m="wait"]')); },
    check: check,
    tag: tag,
    revealAll: function () { arr(document.querySelectorAll('[data-pe-m="wait"]')).forEach(function (el) { var r = byEl.get(el); if (r) reveal(r, 0); else orphan(el); }); },
    release: release,
    hero: function () { return heroTl; },
    // QA: run the hero load sequence again (no-op while it runs or after release)
    replayHero: function () {
      if (!g || released || heroTl || !heroRoot) return null;
      heroPrep(); heroPlay(); return heroTl;
    },
    records: function () { return recs.slice(); },
    rise: riseButtons,
    buttonFx: buttonFx,
    libs: function () { return { gsap: g && g.version, ScrollTrigger: ST && ST.version, SplitText: !!Split }; }
  };
})();

/* =============================================================
   HERO SWIPER — phones only (see css/hero-swiper.css). Loads Swiper 8
   from jsdelivr (the same build the talleres/cenas sliders use) the first
   time the page is at phone width, then runs an infinite autoplay loop.
   ============================================================= */
(function () {
  'use strict';
  var CSS = 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css';
  var JS = 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js';
  var mq = window.matchMedia('(max-width: 767px)');
  var started = false;

  function loadSwiper(done) {
    if (window.Swiper) { done(); return; }
    if (!document.querySelector('link[href="' + CSS + '"]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = CSS;
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = JS;
    s.onload = done;
    document.head.appendChild(s);
  }

  function init() {
    if (started || !mq.matches) return;
    var comp = document.querySelector('[data-hero-swiper]');
    if (!comp) return;
    started = true;
    loadSwiper(function () {
      var el = comp.querySelector('.hero-swiper_element');
      new window.Swiper(el, {
        slidesPerView: 'auto',
        spaceBetween: 12,
        loop: true,
        loopAdditionalSlides: 5,
        speed: 500,
        followFinger: true,
        grabCursor: true,
        autoplay: { delay: 3500, disableOnInteraction: false },
        pagination: {
          el: comp.querySelector('.hero-swiper_bullets'),
          bulletClass: 'hero-swiper_bullet',
          bulletActiveClass: 'is-active',
          bulletElement: 'button',
          clickable: true
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  if (mq.addEventListener) mq.addEventListener('change', init);
})();

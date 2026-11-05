/* =============================================================
   HERO DOCK — cart + MENU in the hero header (home page).
   The dock buttons are proxies: they click the real fixed cluster
   (.navbar_fixed-button-container), so Webflow's nav and the cart keep
   their own wiring. While the dock is on screen the fixed cluster is
   hidden (html.hero-dock-in-view); once the dock scrolls away the
   cluster fades in bottom-right as before. MENU here opens the console's
   NAVEGAR screen (pe-console.js) instead of the fullscreen menu.
   ============================================================= */
(function () {
  'use strict';
  function init() {
    var dock = document.querySelector('[data-hero-dock]');
    var cluster = document.querySelector('.navbar_fixed-button-container');
    if (!dock || !cluster) return;
    var realMenu = cluster.querySelector('.navbar_menu-button');
    var realCart = cluster.querySelector('[data-cart-toggle]');
    var realCount = cluster.querySelector('[data-cart-count]');
    var dockCount = dock.querySelector('[data-hero-cart-count]');

    dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hero-proxy]');
      if (!b) return;
      e.preventDefault();
      var isMenu = b.getAttribute('data-hero-proxy') === 'menu';
      // MENU in the hero: the console is on screen, so it becomes the menu
      // (phones: the console sheet; desktop: the console screen in place)
      if (isMenu && window.PEConsole && window.PEConsole.nav) {
        if (window.innerWidth <= 767) { window.PEConsole.nav('sheet'); return; }
        if (document.documentElement.classList.contains('pe-con-in-view')) { window.PEConsole.nav('inplace'); return; }
      }
      var target = isMenu ? realMenu : realCart;
      if (target) target.click();
    });

    // mirror the cart count (webflow-cart.js only updates the real badge)
    function syncCount() {
      if (!realCount || !dockCount) return;
      dockCount.textContent = realCount.textContent;
      dockCount.setAttribute('data-count', realCount.textContent.trim());
      dockCount.className = realCount.className;
    }
    if (realCount) {
      syncCount();
      new MutationObserver(syncCount).observe(realCount, { childList: true, characterData: true, subtree: true, attributes: true });
    }

    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        document.documentElement.classList.toggle('hero-dock-in-view', en.isIntersecting);
      });
    }, { threshold: 0 }).observe(dock);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

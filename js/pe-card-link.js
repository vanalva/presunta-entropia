/* pe-card-link — a card with exactly one call to action is clickable as a whole.

   Why JS and not a stretched-link ::after: pe-motion.js forces position:relative on every
   .button (anchor()) so the rise / power-on / ticker effect layers can sit inside it, and the
   home CTA also sits in an absolute .layer. A ::after on the CTA is therefore contained by the
   button itself and cannot cover the card.

   The CTA stays the real <a> / <button>: this only forwards a click on dead space to it, so
   right-click, keyboard (Tab + Enter), new-tab and data-modal-open all behave as before.
   Counted live: only VISIBLE controls count, so a CTA hidden at a breakpoint (.hide-tablet on
   the Espacios cards) leaves the card inert there. */
(function () {
  'use strict';
  var FAMILIES = '.productos_card, .espacios_card, .talleres_layout_card';
  var ACT = 'a[href], button, [role="button"], input, select, textarea, summary, [data-modal-open]';

  function shown(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
  function single(card) {
    var list = card.querySelectorAll(ACT), found = null, n = 0;
    for (var i = 0; i < list.length; i++) {
      if (!shown(list[i])) continue;
      n++; found = list[i];
    }
    return n === 1 ? found : null;
  }
  function target(e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    var card = t.closest(FAMILIES);
    if (!card) return null;
    var cta = single(card);
    if (!cta || t.closest(ACT)) return null; // the control itself (or another one) handles it
    return cta;
  }

  // cursor: only cards that really have one visible action show the pointer
  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var card = t.closest(FAMILIES);
    if (!card) return;
    card.classList.toggle('is-card-link', !!single(card));
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var cta = target(e);
    if (!cta) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel)) return; // the visitor is selecting text
    cta.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey
    }));
  });

  // middle-click on dead space opens the CTA's link in a new tab, like the link itself
  document.addEventListener('auxclick', function (e) {
    if (e.button !== 1) return;
    var cta = target(e);
    if (cta && cta.tagName === 'A' && cta.getAttribute('href').charAt(0) !== '#') {
      window.open(cta.href, '_blank', 'noopener');
    }
  });
})();

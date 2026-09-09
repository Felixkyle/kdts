/* ============================================================
   KADIS — Responsive & Mobile Nav Fix
   Drop this ONE file's <script> tag into any page (after the
   page's own inline <style>/<script> tags, same pattern as
   cart.js / Quickview.js) and it:

   1. Adds a working hamburger menu on mobile. The site's own
      CSS hides .nav-links at max-width:900px with no way to
      get them back — this restores access via a slide-down
      panel, built from whatever links already exist in
      .nav-links, so it needs no per-page editing.

   2. Adds real small-phone breakpoints (≤600px / ≤420px).
      The site's smallest existing breakpoint is ~900-980px
      ("tablet"), so actual phones (~360-430px wide) were still
      rendering 2-column grids, 90px section padding, and 32px
      side padding meant for desktop. This tightens things up
      for real phone widths.

   3. Prevents the floating decorative "chip" icons in the hero
      from causing horizontal overflow/scrollbars on narrow
      screens.

   4. Protects the logo and gives the header room on mobile —
      the hamburger + icon buttons + "Request a Solution" pill
      were all competing for space with nothing stopping the
      logo from being squeezed. The pill is hidden under 480px
      (it's duplicated as a full-width CTA further down every
      page) and cloned into the mobile drawer instead, so the
      action isn't lost, just relocated.

   5. Keeps the "All Categories" bar (.search-row) visible on
      mobile instead of scrolling away. Each page's own inline
      CSS sticks it under the nav on desktop but overrides that
      to position:static at max-width:900px, so on phones it
      scrolled off with the rest of the page and users had to
      scroll back to the very top to find it. This re-forces it
      sticky (!important beats that inline override) on mobile too.

   6. Makes the "All Categories" button visibly clickable — a
      soft pulsing amber ring + a gently bouncing chevron, both
      of which stop once the user hovers or opens the menu so
      it doesn't feel distracting after they've noticed it.

   7. Fixes the sticky nav actually losing its "stay pinned"
      behavior on scroll. Every page's own CSS sets
      "body { overflow-x: hidden }" (to stop decorative hero
      icons causing a horizontal scrollbar) — but that specific
      property is a known trigger for a bug (mainly Safari/iOS)
      where "position: sticky" elements stop sticking and just
      scroll away instead of staying pinned. This swaps it for
      "overflow-x: clip", which blocks the scrollbar the same
      way without breaking sticky, so the nav (and the "All
      Categories" bar) now genuinely stay in place on scroll.

   8. Signals that the hamburger button opens a full menu — a
      soft pulsing ring around the button plus a small amber
      notification-style dot in the corner, both of which stop
      once the drawer is open (so it doesn't nag once they've
      found it, or after they've already used it once).
   ============================================================ */

(function () {
  'use strict';

  // ---------- 1. Inject responsive CSS ----------
  const style = document.createElement('style');
  style.textContent = `
    /* ---- Hamburger button ---- */
    .kadis-hamburger {
      display: none;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.13);
      background: transparent;
      color: #EDEEEC;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      order: -1;
      position: relative;
      animation: kadisHamburgerPulse 2.4s ease-in-out infinite;
    }
    .kadis-hamburger.is-open { animation: none; }
    /* small amber "there's more here" dot, like a notification badge */
    .kadis-hamburger::after {
      content: '';
      position: absolute;
      top: -3px;
      right: -3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #D9772E;
      box-shadow: 0 0 0 2px #131519;
      animation: kadisDotPulse 2.4s ease-in-out infinite;
    }
    .kadis-hamburger.is-open::after { display: none; }
    @keyframes kadisHamburgerPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 46, 0.35); }
      50% { box-shadow: 0 0 0 7px rgba(217, 119, 46, 0); }
    }
    @keyframes kadisDotPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.35); opacity: 0.55; }
    }
    .kadis-hamburger .bar {
      display: block;
      width: 18px;
      height: 2px;
      background: currentColor;
      position: relative;
      transition: transform .2s ease, opacity .2s ease;
    }
    .kadis-hamburger .bar::before,
    .kadis-hamburger .bar::after {
      content: '';
      position: absolute;
      left: 0;
      width: 18px;
      height: 2px;
      background: currentColor;
      transition: transform .2s ease, top .2s ease;
    }
    .kadis-hamburger .bar::before { top: -6px; }
    .kadis-hamburger .bar::after { top: 6px; }
    .kadis-hamburger.is-open .bar { background: transparent; }
    .kadis-hamburger.is-open .bar::before { top: 0; transform: rotate(45deg); }
    .kadis-hamburger.is-open .bar::after { top: 0; transform: rotate(-45deg); }

    /* ---- Mobile nav drawer (built from the page's own .nav-links) ---- */
    .kadis-mobile-drawer {
      display: none;
      flex-direction: column;
      background: #131519;
      border-top: 1px solid rgba(255,255,255,0.09);
      border-bottom: 1px solid rgba(255,255,255,0.09);
    }
    .kadis-mobile-drawer.is-open { display: flex; }
    .kadis-mobile-drawer a {
      padding: 15px 20px;
      font-size: 15px;
      font-weight: 600;
      color: #EDEEEC;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .kadis-mobile-drawer a:last-child { border-bottom: none; }
    .kadis-mobile-drawer a:active { background: rgba(217,119,46,0.08); }
    /* the cloned "Request a Solution" entry gets a little visual weight
       so it still reads as the primary action, just inside the drawer */
    .kadis-mobile-drawer a.kadis-drawer-cta {
      color: #D9772E;
    }

    @media (max-width: 900px) {
      .kadis-hamburger { display: inline-flex; }

      /* Give the header room instead of letting flexbox squash the logo:
         hamburger, icon buttons and the logo all keep their natural size,
         nothing shrinks them. */
      .nav-inner { flex-wrap: nowrap; }
      .logo { flex-shrink: 0; min-width: 0; }
      .nav-actions { flex-shrink: 0; gap: 8px; }
    }

    @media (max-width: 480px) {
      /* The header CTA pill is what's actually crowding the logo out —
         it's duplicated as a full-width button in the hero and again
         near the page footer, so it's safe to drop from the cramped
         header row. It's cloned into the mobile drawer below instead,
         so the action itself isn't lost. */
      .nav-actions .btn-primary { display: none; }
    }

    /* ---- Real phone breakpoints (site's own CSS stops at ~900-980px) ----
       IMPORTANT: these are written as separate padding-left/right vs
       padding-top/bottom (never the "padding: a b c" shorthand) on
       purpose. Several elements on this site carry BOTH the .wrap class
       and another class (e.g. <header class="wrap hero">, and multiple
       <section class="... wrap">). Shorthand "padding" rules on two
       classes that land on the same element silently overwrite each
       other's left/right or top/bottom values depending on specificity
       and source order — which is what was pinning hero/section content
       flush against the left edge with no horizontal breathing room,
       and zeroing out vertical section spacing. Longhand properties on
       different axes can never collide like that. */
    @media (max-width: 600px) {
      .wrap { padding-left: 18px !important; padding-right: 18px !important; }
      section { padding-top: 48px !important; padding-bottom: 48px !important; }
      .hero { padding-top: 32px !important; padding-bottom: 36px !important; }
      .cat-grid,
      .prod-grid { grid-template-columns: 1fr !important; }
      .foot-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
      .stats-band { grid-template-columns: 1fr 1fr !important; }
      .serv-grid { grid-template-columns: 1fr !important; }
      .blog-grid { grid-template-columns: 1fr !important; }
      .hero h1 { font-size: 30px !important; }
      .sec-head h2 { font-size: 24px !important; }
      .cta-band { padding-top: 36px !important; padding-bottom: 36px !important; padding-left: 22px !important; padding-right: 22px !important; }
      .foot-promo .wrap,
      .trust .wrap { flex-direction: column; align-items: flex-start !important; }
    }

    @media (max-width: 420px) {
      .hero-stats { gap: 20px !important; }
      .hero-cta { flex-direction: column; align-items: stretch !important; }
      .hero-cta a { justify-content: center; text-align: center; }
    }

    /* ---- Stop hero decoration from causing horizontal overflow (fix 3),
       WITHOUT breaking the sticky nav / search-row (fix 5/7) ----
       Every page's own inline CSS sets "body { overflow-x: hidden; }" to
       stop the decorative hero chips from causing a horizontal scrollbar.
       That property is a well-known trigger for a browser bug (notably
       Safari/iOS) where "position: sticky" elements stop sticking and
       just scroll away with the page instead of staying pinned — which
       is exactly why the whole nav (and the "All Categories" bar) could
       be seen scrolling off instead of staying put. "overflow-x: clip"
       gives the same visual result (no horizontal scrollbar) without
       triggering that bug, so this overrides the page's own rule. */
    body { overflow-x: clip !important; overflow-y: visible !important; }
    @media (max-width: 640px) {
      .hero-visual { transform: scale(0.82); transform-origin: center; }
    }

    /* ---- Keep "All Categories" bar visible on mobile (fix 5) ----
       Beats each page's own "@media (max-width:900px) .search-row
       { position: static; }" override via !important + source order. */
    @media (max-width: 900px) {
      .search-row { position: sticky !important; top: 78px !important; z-index: 45 !important; }
    }

    /* ---- Make "All Categories" obviously clickable (fix 6) ---- */
    .cat-trigger { animation: kadisCatPulse 2.4s ease-in-out infinite; }
    .cat-trigger:hover,
    .cat-trigger.active { animation: none; }
    .cat-trigger .chev { animation: kadisChevNudge 1.6s ease-in-out infinite; }
    .cat-trigger.active .chev { animation: none; }
    @keyframes kadisCatPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 46, 0.35); }
      50% { box-shadow: 0 0 0 7px rgba(217, 119, 46, 0); }
    }
    @keyframes kadisChevNudge {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(3px); }
    }
  `;
  document.head.appendChild(style);

  // ---------- 2. Build the hamburger + drawer from the existing nav ----------
  function init() {
    const navInner = document.querySelector('nav .nav-inner, .nav-inner');
    const navLinksSrc = document.querySelector('.nav-links');
    const navEl = document.querySelector('nav');
    if (!navInner || !navLinksSrc || !navEl) return; // page has no standard nav — skip safely

    // avoid double-injecting if this script somehow runs twice
    if (navEl.dataset.kadisResponsiveBound) return;
    navEl.dataset.kadisResponsiveBound = 'true';

    // hamburger button, placed at the start of nav-actions (or nav-inner as fallback)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kadis-hamburger';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span class="bar"></span>';

    const actions = navInner.querySelector('.nav-actions');
    if (actions) actions.insertBefore(btn, actions.firstChild);
    else navInner.appendChild(btn);

    // drawer with cloned links, inserted right after the whole <nav>
    const drawer = document.createElement('div');
    drawer.className = 'kadis-mobile-drawer';
    Array.from(navLinksSrc.querySelectorAll('a')).forEach(a => {
      const clone = a.cloneNode(true);
      drawer.appendChild(clone);
    });
    // the header's "Request a Solution" pill is hidden under 480px (see CSS
    // above) so it doesn't crowd the logo — clone it into the drawer too,
    // so the action stays reachable on the smallest screens instead of
    // just disappearing.
    const headerCta = actions && actions.querySelector('.btn-primary');
    if (headerCta) {
      const ctaClone = headerCta.cloneNode(true);
      ctaClone.classList.add('kadis-drawer-cta');
      drawer.appendChild(ctaClone);
    }
    navEl.parentNode.insertBefore(drawer, navEl.nextSibling);

    function closeDrawer() {
      drawer.classList.remove('is-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-label', 'Open menu');
    }
    function toggleDrawer() {
      const nowOpen = drawer.classList.toggle('is-open');
      btn.classList.toggle('is-open', nowOpen);
      btn.setAttribute('aria-label', nowOpen ? 'Close menu' : 'Open menu');
    }

    btn.addEventListener('click', toggleDrawer);
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeDrawer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
    'use strict';
    function initLinkBehavior() {
      const WHATSAPP_LINK = 'https://wa.me/2348061379390';
      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        const hrefTrimmed = href ? href.trim() : '';
        const isDeadLink =
          !hrefTrimmed ||
          hrefTrimmed === '#' ||
          hrefTrimmed.toLowerCase().startsWith('javascript:');
        const isSocialOrWhatsApp = hrefTrimmed && (
          /wa\.me|whatsapp\.com/i.test(hrefTrimmed) ||
          /facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|linkedin\.com|t\.me|telegram\.me/i.test(hrefTrimmed)
        );
        if (isDeadLink) {
          a.setAttribute('href', WHATSAPP_LINK);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        } else if (isSocialOrWhatsApp) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initLinkBehavior);
    } else {
      initLinkBehavior();
    }
  })();
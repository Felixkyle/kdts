/* ============================================================
   KADIS Quick View — universal product preview modal
   Drop this ONE file's <script> tag into any page that has
   .prod-card product cards, and it just works — no other
   HTML or CSS needs to be copy-pasted per page.

   Every product only ever had a single short sentence
   (.prod-desc) to work with — there's no separate product
   page to pull more content from. So instead of needing
   530+ products hand-edited, this script AUTO-BUILDS a
   fuller description for every card:
     - keeps the real short sentence you already wrote as
       the opening line
     - reads the card's category text (.prod-cat) and matches
       it to one of the groups below (cameras, cables, solar,
       networking, etc.)
     - appends a "Key Features" list relevant to that group

   New products need nothing extra — as long as they have a
   .prod-cat, they automatically get a fuller write-up.

   Usage: add this before </body>:
     <script src="quickview.js"></script>
   ============================================================ */

(function () {
  'use strict';

  // ---------- 0. Clear out any old/leftover popup markup ----------
  document.querySelectorAll(
    '#quickViewOverlay, #qvOverlay, .qv-overlay, .quick-view-overlay, .product-modal, .product-overlay'
  ).forEach(el => el.remove());

  // ---------- 1. Inject modal CSS once ----------
  const style = document.createElement('style');
  style.textContent = `
    .qv-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .qv-overlay.active { display: flex; }
    .qv-modal {
      background: #131519;
      border: 1px solid rgba(255,255,255,0.1);
      color: #EDEEEC;
      padding: 26px;
      border-radius: 16px;
      max-width: 460px;
      width: 100%;
      position: relative;
      text-align: center;
      max-height: 90vh;
      overflow-y: auto;
      font-family: 'Manrope', sans-serif;
    }
    .qv-close {
      position: absolute;
      top: 12px;
      right: 14px;
      z-index: 10000;
      background: rgba(255,255,255,0.08);
      border: none;
      color: #EDEEEC;
      font-size: 22px;
      font-family: Arial, sans-serif;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      line-height: 1;
      pointer-events: auto;
    }
    .qv-close:hover { background: rgba(255,255,255,0.18); }
    .qv-img-wrap {
      width: 100%;
      height: 220px;
      background: linear-gradient(150deg,#20232A,#1A1D22);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .qv-img-wrap img { width: 100%; height: 100%; object-fit: contain; padding: 16px; }
    .qv-img-wrap svg { width: 90px; height: 90px; }
    .qv-cat {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: #E8A15E;
      text-transform: uppercase;
      letter-spacing: .06em;
      display: block;
      margin-bottom: 8px;
    }
    .qv-name { font-size: 19px; font-weight: 800; margin-bottom: 10px; font-family: 'Sora', sans-serif; }
    .qv-desc {
      font-size: 13.5px;
      color: #9A9FA8;
      line-height: 1.6;
      margin-bottom: 16px;
      text-align: left;
    }
    .qv-desc p { margin: 0 0 10px; }
    .qv-desc p.qv-intro { color: #C7CACF; }
    .qv-desc p.qv-heading { margin: 0 0 6px; font-weight: 700; color: #EDEEEC; font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; }
    .qv-desc ul { margin: 0 0 4px; padding-left: 18px; }
    .qv-desc li { margin-bottom: 6px; }
    .qv-desc strong { color: #EDEEEC; }
    .qv-price-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 18px; }
    .qv-price-row b { font-size: 20px; color: #E8A15E; font-family: 'Sora', sans-serif; }
    .qv-price-row .old { font-size: 13px; color: #5C616A; text-decoration: line-through; }
    .qv-btn-row {
      display: flex;
      gap: 10px;
    }
    .qv-add-btn {
      background: #D9772E;
      color: #0B0C0F;
      border: none;
      font-weight: 700;
      font-size: 14.5px;
      padding: 13px 26px;
      border-radius: 10px;
      cursor: pointer;
      flex: 1;
    }
    .qv-add-btn:hover { background: #E8A15E; }
    .qv-cancel-btn {
      background: transparent;
      color: #EDEEEC;
      border: 1px solid rgba(255,255,255,0.18);
      font-weight: 700;
      font-size: 14.5px;
      padding: 13px 20px;
      border-radius: 10px;
      cursor: pointer;
      flex: 1;
    }
    .qv-cancel-btn:hover { background: rgba(255,255,255,0.08); }
  `;
  document.head.appendChild(style);

  // ---------- 2. Inject modal HTML once ----------
  const overlay = document.createElement('div');
  overlay.id = 'qvOverlay';
  overlay.className = 'qv-overlay';
  overlay.innerHTML = `
    <div class="qv-modal">
      <button class="qv-close" id="qvClose" type="button" aria-label="Close">&times;</button>
      <div class="qv-img-wrap" id="qvImgWrap"></div>
      <span class="qv-cat" id="qvCat"></span>
      <h3 class="qv-name" id="qvName"></h3>
      <div class="qv-desc" id="qvDesc"></div>
      <div class="qv-price-row" id="qvPriceRow"></div>
      <div class="qv-btn-row">
        <button class="qv-cancel-btn" id="qvCancelBtn" type="button">Cancel</button>
        <button class="qv-add-btn" id="qvAddBtn" type="button">Add to Cart</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const els = {
    imgWrap: overlay.querySelector('#qvImgWrap'),
    cat: overlay.querySelector('#qvCat'),
    name: overlay.querySelector('#qvName'),
    desc: overlay.querySelector('#qvDesc'),
    priceRow: overlay.querySelector('#qvPriceRow'),
    addBtn: overlay.querySelector('#qvAddBtn'),
    close: overlay.querySelector('#qvClose'),
    cancel: overlay.querySelector('#qvCancelBtn'),
  };

  let activeCard = null;

  // ---------- 3. Auto-generated "Key Features" content ----------
  // Grouped by product category so every card gets relevant extra detail
  // without anyone writing 530+ individual descriptions by hand.
  const FEATURE_GROUPS = {
    security: [
      'Delivers clear, continuous footage for reliable round-the-clock monitoring.',
      'Supports remote viewing from a phone or tablet, so you can check in from anywhere.',
      'Weatherproof, durable housing built to handle outdoor exposure and everyday wear.',
      'Straightforward installation that fits into most existing camera or NVR setups.',
    ],
    cable: [
      'Manufactured to standard gauge specifications for safe, consistent current flow.',
      'Durable outer sheathing resists heat, abrasion and everyday wear during installation.',
      'Suitable for residential, commercial and industrial wiring projects.',
      'Supplied in practical lengths to reduce waste and speed up installation.',
    ],
    power: [
      'Engineered for stable, efficient power delivery even under heavy daily use.',
      'Built with protection circuitry that guards against overload, overheating and short circuits.',
      'Designed for a long service life, reducing the need for frequent replacement.',
      'Compatible with most standard residential and small commercial power setups.',
    ],
    networking: [
      'Delivers a stable connection for streaming, browsing and everyday online work.',
      'Simple plug-and-play setup that gets you online in minutes.',
      'Supports multiple connected devices without a noticeable drop in speed.',
      'Compact design that fits easily on a desk, shelf or wall mount.',
    ],
    storage: [
      'Offers dependable read/write speeds for everyday file transfers and backups.',
      'Compact and portable, easy to carry between devices or locations.',
      'Compatible with most standard USB ports across laptops and desktops.',
      'Built to withstand regular daily handling without data loss.',
    ],
    peripherals: [
      'Designed for comfortable, everyday use at a desk or workstation.',
      'Plug-and-play compatibility with most standard computers and laptops.',
      'Solidly built to handle daily wear without losing performance.',
      'A practical addition to any home or office computer setup.',
    ],
    audio_video: [
      'Delivers clear audio or video signal transfer with minimal lag or distortion.',
      "Compact, lightweight design that's easy to carry or store.",
      'Simple setup with no complicated configuration required.',
      'Compatible with most common audio, video or Bluetooth-enabled devices.',
    ],
    ringlight: [
      'Provides even, flattering illumination for photos, video calls and content creation.',
      'Adjustable brightness and colour tone to match different lighting conditions.',
      'Sturdy stand or clip mount for a stable, wobble-free setup.',
      "Lightweight and portable, easy to set up wherever you're filming.",
    ],
    smarthome: [
      'Lets you control the device remotely from a smartphone app.',
      'Simple installation that fits standard home wiring and fittings.',
      'Adds convenience and energy efficiency to everyday home routines.',
      'Compatible with most common smart home ecosystems.',
    ],
    satellite: [
      'Delivers a strong, stable signal for clear picture and sound quality.',
      'Built to withstand outdoor exposure to sun, rain and wind.',
      'Straightforward installation and alignment for reliable reception.',
      'Compatible with most standard satellite or terrestrial TV setups.',
    ],
    gaming: [
      'Delivers smooth, responsive performance for an enjoyable gaming session.',
      'Built for durability through extended and repeated use.',
      'Compatible with standard gaming setups and accessories.',
      'A solid pick for casual and dedicated gamers alike.',
    ],
    mobile_accessories: [
      'Adds everyday convenience and functionality to your phone or device.',
      'Compact and portable, easy to carry along wherever you go.',
      'Compatible with most standard phones, tablets and accessories.',
      'Built to handle regular daily use without quick wear.',
    ],
    software: [
      'Provides ongoing protection against viruses, malware and online threats.',
      'Runs quietly in the background without slowing down your device.',
      'Includes regular updates to guard against new and emerging threats.',
      'Straightforward licence activation and installation process.',
    ],
    tools: [
      'Built for accurate, dependable results on the job.',
      'Durable construction designed to withstand regular workshop or field use.',
      "A practical addition to any technician's or installer's toolkit.",
      'Straightforward to use for both professionals and everyday tasks.',
    ],
    telephony: [
      'Supports clear, reliable call handling for an office or business line.',
      'Straightforward setup and configuration for everyday office use.',
      'Built to handle sustained daily call volume.',
      'A practical option for small to mid-size office communication needs.',
    ],
    generic: [
      'Built with dependable materials for consistent everyday performance.',
      'Designed to fit easily into most standard home, office or business setups.',
      "Backed by KADIS's standard quality checks before it reaches you.",
      'A practical, reliable choice within its category.',
    ],
  };

  // Keyword → group lookup, checked in order (first match wins).
  const GROUP_RULES = [
    [['cctv', 'camera', 'security', 'doorbell', 'indoor', 'outdoor'], 'security'],
    [['cable', 'wire', 'conduit', 'fibre', 'fiber', 'fire alarm', 'electric fence', 'flat cable', 'flexible', 'data cable'], 'cable'],
    [['solar', 'battery', 'batteries', 'inverter', 'power converter'], 'power'],
    [['router', 'lte', 'mifi', 'hub', 'wifi', 'wi-fi', 'modem', 'networking'], 'networking'],
    [['flash drive', 'hard drive', 'storage', 'dvd', 'card reader'], 'storage'],
    [['keyboard', 'mouse', 'printer', 'usb hub', 'computer accessor', 'havit'], 'peripherals'],
    [['bluetooth', 'earpiece', 'earbud', 'audio', 'video', 'capture'], 'audio_video'],
    [['ring light'], 'ringlight'],
    [['smart bulb', 'smart lock', 'smart plug', 'smart switch', 'curtain motor', 'remote control'], 'smarthome'],
    [['satellite', 'lnb', 'antenna', 'decoder', 'dish'], 'satellite'],
    [['game', 'console', 'controller', 'ps4', 'ps5'], 'gaming'],
    [['phone accessor', 'otg', 'adapter', 'accessory', 'accessories', 'charger'], 'mobile_accessories'],
    [['antivirus', 'software'], 'software'],
    [['hand tool', 'testing', 'measurement'], 'tools'],
    [['telephone', 'pabx'], 'telephony'],
  ];

  function pickGroup(text) {
    const t = text.toLowerCase();
    for (const [keywords, group] of GROUP_RULES) {
      if (keywords.some(k => t.includes(k))) return group;
    }
    return 'generic';
  }

  // Pulls real spec-looking tokens straight out of the product title itself
  // ("1.5mm", "12V/200AH", "100m", "2-Core", "1-Year") — never invented,
  // only ever text that's already sitting in the product name.
  const SPEC_REGEX = /\b\d+(?:\.\d+)?\s?(?:kwh|kw|mm|cm|mbps|ah|gb|tb|hz|mp|ch|kg|w|v|m)\b|\b\d+[\s-]?(?:core|extension|year|coils?|slot|way)\b/gi;

  function extractSpecs(name) {
    const matches = name.match(SPEC_REGEX) || [];
    const seen = new Set();
    const out = [];
    for (const m of matches) {
      const key = m.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) { seen.add(key); out.push(m.trim()); }
    }
    return out.slice(0, 5);
  }

  function getProductId(card) {
    // DOM ids follow the pattern id="p-<category>-<n>" across the site.
    const raw = card.id || '';
    return raw.startsWith('p-') ? raw.slice(2) : raw || null;
  }

  function buildDescriptionHTML(card, shortDesc, cat, name) {
    // 1. Prefer a real, hand-written override if one's been filled in.
    const id = getProductId(card);
    const override = id && window.KADIS_PRODUCT_DETAILS ? window.KADIS_PRODUCT_DETAILS[id] : null;
    if (override && (override.full || override.brand)) {
      const brandLine = override.brand ? `<p class="qv-intro"><strong>Brand:</strong> ${override.brand}</p>` : '';
      const fullLine = override.full ? `<p class="qv-intro">${override.full}</p>` : '';
      return brandLine + fullLine;
    }

    // 2. Otherwise auto-build from what's already real on the page: the
    // short description, plus any spec-looking tokens found in the title,
    // plus category-relevant Key Features.
    const specs = extractSpecs(name);
    const group = pickGroup(`${cat} ${name}`);
    const features = FEATURE_GROUPS[group] || FEATURE_GROUPS.generic;

    const introHTML = shortDesc ? `<p class="qv-intro">${shortDesc}</p>` : '';
    const specsHTML = specs.length
      ? `<p class="qv-intro"><strong>Specification:</strong> ${specs.join(' &middot; ')}</p>`
      : '';
    const featuresHTML = `
      <p class="qv-heading">Key Features</p>
      <ul>${features.map(f => `<li>${f}</li>`).join('')}</ul>
    `;
    return introHTML + specsHTML + featuresHTML;
  }

  function openQuickView(card) {
    activeCard = card;

    const mediaWrap = card.querySelector('.prod-img, .prod-media, .ql-img');
    els.imgWrap.innerHTML = mediaWrap ? mediaWrap.innerHTML : '';
    els.imgWrap.querySelectorAll(
      '.prod-tag, .fav-btn, [class*="fav"], [class*="close"], [class*="cancel"], .add-btn'
    ).forEach(n => n.remove());

    const cat =
      card.querySelector('.prod-cat')?.textContent.trim() ||
      card.querySelector('.ql-body > span:first-child')?.textContent.trim() ||
      '';
    els.cat.textContent = cat;

    const name = card.querySelector('h5, h6')?.textContent.trim() || 'Product';
    els.name.textContent = name;

    const shortDesc = card.querySelector('.prod-desc')?.textContent.trim() || '';
    els.desc.innerHTML = buildDescriptionHTML(card, shortDesc, cat, name);

    const priceBlock = card.querySelector('.prod-price');
    if (priceBlock) {
      els.priceRow.innerHTML = priceBlock.querySelector('div')?.innerHTML || '';
    } else {
      const oldPrice = card.querySelector('.ql-old');
      const curPrice = card.querySelector('.ql-price');
      els.priceRow.innerHTML = curPrice
        ? `${oldPrice ? `<span class="old">${oldPrice.textContent}</span>` : ''}<b>${curPrice.textContent}</b>`
        : '';
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    activeCard = null;
  }

  els.close.addEventListener('click', closeQuickView);
  els.cancel.addEventListener('click', closeQuickView);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeQuickView(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeQuickView(); });

  els.addBtn.addEventListener('click', () => {
    if (!activeCard) return;
    const realAddBtn = activeCard.querySelector('.add-btn');
    if (realAddBtn) realAddBtn.click();
    closeQuickView();
  });

  // ---------- 4. Wire up every .prod-card on the page ----------
  function attachQuickView(card) {
    if (card.dataset.qvBound) return;
    card.dataset.qvBound = 'true';
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn, .fav-btn')) return;
      openQuickView(card);
    });
  }

  document.querySelectorAll('.prod-card, .ql-card').forEach(attachQuickView);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.prod-card, .ql-card')) attachQuickView(node);
        node.querySelectorAll?.('.prod-card, .ql-card').forEach(attachQuickView);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
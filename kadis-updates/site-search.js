/* ==========================================================
   KADIS — Site-wide product search
   Requires product-index-data.js to be loaded first:

     <script src="product-index-data.js"></script>
     <script src="site-search.js"></script>

   Wires up any input#siteSearch + button#siteSearchBtn on the
   page into a live results dropdown. Selecting a result (or
   pressing Enter with results showing) sends the visitor to
   the exact product's page and scrolls straight to it there.

   Also runs on every page load: if the URL has a #p-<id> hash,
   this scrolls to that product card and briefly highlights it —
   this is what makes the search results actually land ON the
   product instead of just on the right category page.
   ========================================================== */
(function () {
  const INDEX = (typeof KADIS_PRODUCT_INDEX !== "undefined") ? KADIS_PRODUCT_INDEX : [];

  const css = `
  .kss-wrap { position: relative; display: flex; flex: 1; align-items: center; }
  .kss-results {
    position: absolute; top: calc(100% + 8px); left: 0; right: 0;
    background: var(--bg-2, #131519); border: 1px solid var(--line-bright, rgba(255,255,255,0.13));
    border-radius: 12px; max-height: 420px; overflow-y: auto; z-index: 500;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: none;
  }
  .kss-results.open { display: block; }
  .kss-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    text-decoration: none; color: var(--ink, #EDEEEC); border-bottom: 1px solid var(--line, rgba(255,255,255,0.07));
    cursor: pointer;
  }
  .kss-item:last-child { border-bottom: none; }
  .kss-item:hover, .kss-item.active { background: var(--bg-3, #1A1D22); }
  .kss-thumb {
    width: 40px; height: 40px; border-radius: 8px; background: var(--bg-3, #1A1D22);
    object-fit: cover; flex-shrink: 0;
  }
  .kss-thumb-fallback {
    width: 40px; height: 40px; border-radius: 8px; background: var(--bg-3, #1A1D22);
    flex-shrink: 0; display:flex; align-items:center; justify-content:center;
    color: var(--ink-dimmer, #5C616A); font-size: 16px;
  }
  .kss-body { min-width: 0; flex: 1; }
  .kss-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kss-meta { font-size: 11.5px; color: var(--ink-dim, #9A9FA8); margin-top: 2px; }
  .kss-price { font-size: 13px; font-weight: 700; color: var(--amber-soft, #E8A15E); white-space: nowrap; }
  .kss-empty { padding: 16px; font-size: 13px; color: var(--ink-dim, #9A9FA8); text-align: center; }
  .kss-empty a { color: var(--amber-soft, #E8A15E); font-weight: 700; }
  @keyframes kssHighlight {
    0%   { box-shadow: 0 0 0 3px rgba(217,119,46,0.9); }
    100% { box-shadow: 0 0 0 3px rgba(217,119,46,0); }
  }
  .kss-highlight { animation: kssHighlight 1.8s ease-out 2; border-radius: 18px; }
  `;

  function norm(s) { return (s || "").toLowerCase(); }

  // strips a simple trailing plural 's' so "cables" matches "cable"
  function singularize(w) {
    if (w.length > 3 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function wordMatches(hayWords, term) {
    const t = singularize(term);
    return hayWords.some(w => w.startsWith(term) || w.startsWith(t) || singularize(w) === t);
  }

  function search(query) {
    const q = norm(query).trim();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return INDEX
      .map(p => {
        const hay = norm(p.name + " " + p.cat);
        const hayWords = hay.split(/[\s,/&()-]+/).filter(Boolean);
        const matches = terms.every(t => hay.includes(t) || wordMatches(hayWords, t));
        if (!matches) return null;
        // simple relevance: name-start match ranks highest
        let score = 0;
        if (norm(p.name).startsWith(q)) score = 3;
        else if (norm(p.name).includes(q)) score = 2;
        else score = 1;
        return { p, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(x => x.p);
  }

  function initSearchBox(input, btn) {
    const wrap = document.createElement("div");
    wrap.className = "kss-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    if (btn) wrap.appendChild(btn);

    const results = document.createElement("div");
    results.className = "kss-results";
    wrap.appendChild(results);

    let activeIndex = -1;
    let currentMatches = [];

    function render(matches, query) {
      currentMatches = matches;
      activeIndex = -1;
      if (!query.trim()) {
        results.classList.remove("open");
        results.innerHTML = "";
        return;
      }
      if (!matches.length) {
        results.innerHTML = `<div class="kss-empty">No products matched "${escapeHtml(query)}".<br>
          <a href="#" data-open-solution>Can't find it? Request it →</a></div>`;
        results.classList.add("open");
        return;
      }
      results.innerHTML = matches.map((p, i) => `
        <a class="kss-item" data-idx="${i}" href="${p.page}#p-${p.id}">
          ${p.img ? `<img class="kss-thumb" src="${p.img}" alt="" loading="lazy" onerror="this.style.display='none'">`
                  : `<div class="kss-thumb-fallback">▢</div>`}
          <div class="kss-body">
            <div class="kss-name">${escapeHtml(p.name)}</div>
            <div class="kss-meta">${escapeHtml(p.cat || "")}</div>
          </div>
          <div class="kss-price">${escapeHtml(p.price || "")}</div>
        </a>
      `).join("");
      results.classList.add("open");

      // re-wire the freshly created request-solution link, if the widget is present
      const reqLink = results.querySelector("[data-open-solution]");
      if (reqLink && window.openRequestSolution) {
        reqLink.addEventListener("click", (e) => {
          e.preventDefault();
          closeResults();
          openRequestSolution();
        });
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function closeResults() {
      results.classList.remove("open");
    }

    input.addEventListener("input", () => {
      render(search(input.value), input.value);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim()) render(search(input.value), input.value);
    });

    input.addEventListener("keydown", (e) => {
      if (!results.classList.contains("open")) {
        if (e.key === "Enter") goSearch();
        return;
      }
      const items = Array.from(results.querySelectorAll(".kss-item"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle("active", i === activeIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        items.forEach((it, i) => it.classList.toggle("active", i === activeIndex));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          window.location.href = items[activeIndex].getAttribute("href");
        } else {
          goSearch();
        }
      } else if (e.key === "Escape") {
        closeResults();
      }
    });

    function goSearch() {
      const matches = search(input.value);
      if (matches.length) {
        window.location.href = `${matches[0].page}#p-${matches[0].id}`;
      } else if (input.value.trim() && window.openRequestSolution) {
        openRequestSolution();
      }
    }

    if (btn) btn.addEventListener("click", goSearch);

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeResults();
    });
  }

  function highlightFromHash() {
    if (!location.hash || !location.hash.startsWith("#p-")) return;
    // product cards on JS-rendered pages (category.html, security.html) may not
    // exist in the DOM yet on first paint — retry briefly.
    let attempts = 0;
    const tryHighlight = () => {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("kss-highlight");
        setTimeout(() => el.classList.remove("kss-highlight"), 3800);
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryHighlight, 200);
      }
    };
    tryHighlight();
  }

  function init() {
    const styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const input = document.getElementById("siteSearch");
    const btn = document.getElementById("siteSearchBtn");
    if (input) initSearchBox(input, btn);

    highlightFromHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
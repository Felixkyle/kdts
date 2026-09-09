/* =========================================================
   KADIS.COM.NG — shared cart engine
   Include this file (before </body>) on every page that should
   support "add to cart". It is self-wiring: it listens for clicks
   on any ".add-btn" inside a ".prod-card" or ".ql-card", pulls the
   product name / price / image / category straight out of that
   card's markup, and stores everything in localStorage so the cart
   survives across pages (no backend needed).
   ========================================================= */
(function () {
  const STORAGE_KEY = 'kadis_cart';
  const LAST_ORDER_KEY = 'kadis_last_order';

  // ---------- storage helpers ----------
  function getCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateBadges();
    document.dispatchEvent(new CustomEvent('kadis-cart-updated', { detail: { cart } }));
  }

  function money(n) {
    n = Math.round(Number(n) || 0);
    return '₦' + n.toLocaleString('en-NG');
  }

  function parsePrice(text) {
    if (!text) return 0;
    const clean = text.replace(/[^\d.]/g, '');
    return clean ? parseFloat(clean) : 0;
  }

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // ---------- cart operations ----------
  function addItem(product, qty) {
    qty = qty || 1;
    const cart = getCart();
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push(Object.assign({ qty: qty }, product));
    }
    saveCart(cart);
    return cart;
  }

  function removeItem(id) {
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
    return cart;
  }

  function setQty(id, qty) {
    let cart = getCart();
    qty = Math.max(0, Math.floor(Number(qty) || 0));
    if (qty === 0) {
      cart = cart.filter(i => i.id !== id);
    } else {
      const item = cart.find(i => i.id === id);
      if (item) item.qty = qty;
    }
    saveCart(cart);
    return cart;
  }

  function clearCart() {
    saveCart([]);
  }

  function cartCount() {
    return getCart().reduce((sum, i) => sum + i.qty, 0);
  }

  function cartSubtotal() {
    return getCart().reduce((sum, i) => sum + i.qty * i.price, 0);
  }

  // ---------- badge ----------
  function updateBadges() {
    const count = cartCount();
    document.querySelectorAll('.cart-count, .nav-cart-count').forEach(el => {
      el.textContent = String(count);
      el.style.display = count > 0 ? '' : (el.classList.contains('cart-count') ? '' : '');
    });
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(message, opts) {
    opts = opts || {};
    let el = document.getElementById('kadisToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kadisToast';
      el.innerHTML = '<span class="kt-msg"></span><a class="kt-link" href="cart.html">View cart →</a>';
      Object.assign(el.style, {
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: '9999',
        background: '#1A1D22',
        border: '1px solid rgba(255,255,255,0.13)',
        color: '#EDEEEC',
        padding: '13px 16px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontFamily: "'Manrope', sans-serif",
        fontSize: '13.5px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
        transform: 'translateY(20px)',
        opacity: '0',
        transition: 'transform .25s cubic-bezier(.16,.8,.24,1), opacity .25s',
        maxWidth: '320px'
      });
      const link = el.querySelector('.kt-link');
      Object.assign(link.style, { color: '#E8A15E', fontWeight: '700', whiteSpace: 'nowrap' });
      document.body.appendChild(el);
    }
    el.querySelector('.kt-msg').textContent = message;
    el.querySelector('.kt-link').href = opts.href || 'cart.html';
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.transform = 'translateY(20px)';
      el.style.opacity = '0';
    }, 2800);
  }

  // ---------- extract product info straight from a card's DOM ----------
  function extractFromCard(card) {
    const isQl = card.classList.contains('ql-card');
    const name = (card.querySelector('h5, h6') || {}).textContent || 'Product';
    const img = card.querySelector('img');
    const priceEl = isQl
      ? card.querySelector('.ql-price')
      : card.querySelector('.prod-price b');
    const catEl = isQl
      ? card.querySelector('.ql-body > span:first-child')
      : card.querySelector('.prod-cat');

    const cleanName = name.trim();
    const category = catEl ? catEl.textContent.trim() : '';
    const price = parsePrice(priceEl ? priceEl.textContent : '0');
    const image = img ? img.getAttribute('src') : '';

    return {
      id: slugify(category + '-' + cleanName),
      name: cleanName,
      price: price,
      image: image,
      category: category
    };
  }

  // ---------- auto-wire add-to-cart clicks (event delegation) ----------
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.add-btn');
    if (!btn) return;
    const card = btn.closest('.prod-card, .ql-card');
    if (!card) return;
    if (card.classList.contains('is-out')) {
      toast("That item's out of stock right now.");
      return;
    }
    e.preventDefault();
    const product = extractFromCard(card);
    if (!product.price) return; // don't add malformed/zero-price items
    addItem(product, 1);

    // visual confirm: swap "+" to "✓" for a beat, then clear back to "+"
    if (!btn.dataset.busy) {
      btn.dataset.busy = '1';
      const original = btn.textContent;
      btn.textContent = '✓';
      btn.style.transition = 'transform .18s';
      btn.style.transform = 'scale(1.35)';
      setTimeout(() => { btn.style.transform = ''; }, 180);
      setTimeout(() => {
        btn.textContent = original;
        delete btn.dataset.busy;
      }, 900);
    }

    toast('Added "' + product.name + '" to your cart');
  }, true);

  // update badges as soon as the DOM is ready, and again on load in case
  // this script tag sits before other content
  document.addEventListener('DOMContentLoaded', updateBadges);
  if (document.readyState !== 'loading') updateBadges();

  // ---------- public API ----------
  window.KadisCart = {
    getCart,
    addItem,
    removeItem,
    setQty,
    clearCart,
    cartCount,
    cartSubtotal,
    money,
    slugify,
    updateBadges,
    toast,
    STORAGE_KEY,
    LAST_ORDER_KEY
  };
})();
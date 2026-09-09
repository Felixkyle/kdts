/* ==========================================================
   KADIS — Request a Solution widget
   Drop-in lead-capture modal. Include this file on any page:

     <script src="request-solution.js"></script>

   Then open it from anywhere with either:
     <a href="#" data-open-solution>Request a Solution</a>
     <a href="#" data-open-solution="Solar & Power">Request Power Assessment</a>
       (the optional value pre-selects that category)
   or programmatically: openRequestSolution('CCTV & Security')

   Uses the CSS variables already defined in each page's :root
   (--bg, --bg-2, --ink, --amber, --line, etc.) so it matches
   the existing brand automatically. Falls back to sane defaults
   if a page hasn't defined them yet.

   IMPORTANT: set FORM_ENDPOINT below to your real form backend
   (e.g. a Formspree endpoint like https://formspree.io/f/xxxxxxx)
   before going live. Until then submissions are logged to the
   console and shown as "sent" so you can test the UI.
   ========================================================== */
(function () {
  const FORM_ENDPOINT = "https://formspree.io/f/xrpgelak";

  const CATEGORIES = [
    "ICT & Networking",
    "CCTV & Security",
    "Solar & Power",
    "Digital Transformation",
    "Media & Events",
    "Equipment Supply",
    "Equipment Rental",
    "Technical Installation",
    "Maintenance & Support",
    "Other"
  ];

  const css = `
  .rs-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px); z-index: 9998;
    display: none; align-items: center; justify-content: center;
    padding: 24px;
  }
  .rs-backdrop.open { display: flex; }
  .rs-modal {
    width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
    background: var(--bg-2, #131519); color: var(--ink, #EDEEEC);
    border: 1px solid var(--line-bright, rgba(255,255,255,0.13));
    border-radius: 16px; padding: 32px;
    font-family: 'Manrope', sans-serif;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    position: relative;
    animation: rsIn .18s ease-out;
  }
  @keyframes rsIn { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:translateY(0);} }
  .rs-close {
    position: absolute; top: 16px; right: 16px;
    background: var(--bg-3, #1A1D22); border: 1px solid var(--line, rgba(255,255,255,0.07));
    color: var(--ink-dim, #9A9FA8); width: 32px; height: 32px; border-radius: 50%;
    cursor: pointer; font-size: 16px; line-height: 1;
  }
  .rs-close:hover { color: var(--ink, #EDEEEC); }
  .rs-eyebrow {
    font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 0.08em;
    color: var(--amber-soft, #E8A15E); text-transform: uppercase; display:block; margin-bottom: 8px;
  }
  .rs-title { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  .rs-sub { color: var(--ink-dim, #9A9FA8); font-size: 14px; margin: 0 0 20px; }
  .rs-field { margin-bottom: 14px; }
  .rs-field label {
    display: block; font-size: 12px; color: var(--ink-dim, #9A9FA8); margin-bottom: 6px;
    font-weight: 600;
  }
  .rs-field input, .rs-field select, .rs-field textarea {
    width: 100%; background: var(--bg-3, #1A1D22); border: 1px solid var(--line, rgba(255,255,255,0.07));
    color: var(--ink, #EDEEEC); border-radius: 8px; padding: 10px 12px; font-size: 14px;
    font-family: 'Manrope', sans-serif;
  }
  .rs-field input:focus, .rs-field select:focus, .rs-field textarea:focus {
    outline: none; border-color: var(--amber, #D9772E);
  }
  .rs-field textarea { min-height: 80px; resize: vertical; }
  .rs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rs-submit {
    width: 100%; margin-top: 6px; background: var(--amber, #D9772E); color: #12100D;
    border: none; border-radius: 8px; padding: 13px 16px; font-weight: 700; font-size: 14px;
    cursor: pointer; font-family: 'Manrope', sans-serif;
  }
  .rs-submit:hover { background: var(--amber-deep, #B85F22); }
  .rs-submit:disabled { opacity: 0.6; cursor: default; }
  .rs-whatsapp {
    display: block; width: 100%; text-align: center; margin-top: 10px; padding: 12px 16px;
    border-radius: 8px; border: 1px solid var(--line-bright, rgba(255,255,255,0.13));
    color: var(--ink, #EDEEEC); text-decoration: none; font-weight: 700; font-size: 14px;
    background: transparent;
  }
  .rs-whatsapp:hover { border-color: #25D366; color: #25D366; }
  .rs-note { font-size: 12px; color: var(--ink-dimmer, #5C616A); margin-top: 10px; text-align: center; }
  .rs-success { text-align: center; padding: 20px 0; }
  .rs-success .rs-check {
    width: 52px; height: 52px; border-radius: 50%; background: var(--moss, #A9B84C);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;
  }
  @media (max-width: 480px) { .rs-row { grid-template-columns: 1fr; } }
  `;

  const html = `
  <div class="rs-backdrop" id="rsBackdrop">
    <div class="rs-modal" role="dialog" aria-modal="true" aria-labelledby="rsTitle">
      <button class="rs-close" id="rsClose" aria-label="Close">✕</button>
      <div id="rsFormWrap">
        <span class="rs-eyebrow">KADIS ICT &amp; ENGINEERING SOLUTIONS</span>
        <h3 class="rs-title" id="rsTitle">Request a Solution</h3>
        <p class="rs-sub">Tell us what you need — we'll get back to you with the right solution, not just a price list.</p>
        <form id="rsForm">
          <div class="rs-field">
            <label for="rsCategory">What do you need help with?</label>
            <select id="rsCategory" name="category" required></select>
          </div>
          <div class="rs-row">
            <div class="rs-field">
              <label for="rsName">Name</label>
              <input type="text" id="rsName" name="name" required>
            </div>
            <div class="rs-field">
              <label for="rsPhone">Phone</label>
              <input type="tel" id="rsPhone" name="phone" required>
            </div>
          </div>
          <div class="rs-row">
            <div class="rs-field">
              <label for="rsOrg">Organization (optional)</label>
              <input type="text" id="rsOrg" name="organization">
            </div>
            <div class="rs-field">
              <label for="rsLocation">Location</label>
              <input type="text" id="rsLocation" name="location" required>
            </div>
          </div>
          <div class="rs-field">
            <label for="rsRequirement">Tell us about your requirement</label>
            <textarea id="rsRequirement" name="requirement" required></textarea>
          </div>
          <button type="submit" class="rs-submit" id="rsSubmit">Submit Request</button>
          <a href="#" class="rs-whatsapp" id="rsWhatsapp" target="_blank" rel="noopener">Send via WhatsApp instead →</a>
          <p class="rs-note">We typically respond within one business day.</p>
        </form>
      </div>
      <div id="rsSuccessWrap" style="display:none;">
        <div class="rs-success">
          <div class="rs-check">✓</div>
          <h3 class="rs-title">Request received</h3>
          <p class="rs-sub">Thanks — a member of the KADIS team will reach out shortly to discuss your requirement.</p>
        </div>
      </div>
    </div>
  </div>
  `;

  function init() {
    const styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);

    const backdrop = document.getElementById("rsBackdrop");
    const select = document.getElementById("rsCategory");
    const form = document.getElementById("rsForm");
    const submitBtn = document.getElementById("rsSubmit");
    const formWrap = document.getElementById("rsFormWrap");
    const whatsappLink = document.getElementById("rsWhatsapp");
    const WHATSAPP_NUMBER = "2348061379390";

    function updateWhatsappLink() {
      const data = Object.fromEntries(new FormData(form).entries());
      const lines = [
        "Hi KADIS, I'd like to request a solution.",
        data.category ? `Category: ${data.category}` : "",
        data.name ? `Name: ${data.name}` : "",
        data.organization ? `Organization: ${data.organization}` : "",
        data.phone ? `Phone: ${data.phone}` : "",
        data.location ? `Location: ${data.location}` : "",
        data.requirement ? `Requirement: ${data.requirement}` : ""
      ].filter(Boolean);
      whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    }
    form.addEventListener("input", updateWhatsappLink);
    form.addEventListener("change", updateWhatsappLink);
    const successWrap = document.getElementById("rsSuccessWrap");

    select.innerHTML = '<option value="" disabled selected>Select one…</option>' +
      CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

    window.openRequestSolution = function (presetCategory) {
      formWrap.style.display = "block";
      successWrap.style.display = "none";
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
      if (presetCategory && CATEGORIES.includes(presetCategory)) {
        select.value = presetCategory;
      }
      updateWhatsappLink();
      backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    };

    window.closeRequestSolution = function () {
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
    };

    document.getElementById("rsClose").addEventListener("click", closeRequestSolution);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeRequestSolution();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop.classList.contains("open")) closeRequestSolution();
    });

    // Wire up any trigger already on the page
    document.querySelectorAll("[data-open-solution]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openRequestSolution(el.getAttribute("data-open-solution") || undefined);
      });
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      const data = Object.fromEntries(new FormData(form).entries());

      if (!FORM_ENDPOINT || FORM_ENDPOINT === "REPLACE_WITH_YOUR_FORM_ENDPOINT") {
        console.warn("[KADIS Request-a-Solution] No FORM_ENDPOINT configured. Payload was:", data);
      } else {
        try {
          await fetch(FORM_ENDPOINT, {
            method: "POST",
            headers: { "Accept": "application/json" },
            body: new FormData(form)
          });
        } catch (err) {
          console.error("[KADIS Request-a-Solution] Submission failed:", err);
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Request";
          alert("Something went wrong sending your request. Please try again or call us directly.");
          return;
        }
      }

      formWrap.style.display = "none";
      successWrap.style.display = "block";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
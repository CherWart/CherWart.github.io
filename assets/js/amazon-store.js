(function () {
  "use strict";

  const storageKey = "cherWartAmazonStore";
  const stores = [
    { code: "us", name: "United States", domain: "amazon.com" },
    { code: "ca", name: "Canada", domain: "amazon.ca" },
    { code: "uk", name: "United Kingdom", domain: "amazon.co.uk" },
    { code: "au", name: "Australia", domain: "amazon.com.au" },
    { code: "de", name: "Germany", domain: "amazon.de" },
    { code: "fr", name: "France", domain: "amazon.fr" },
    { code: "it", name: "Italy", domain: "amazon.it" },
    { code: "es", name: "Spain", domain: "amazon.es" },
    { code: "nl", name: "Netherlands", domain: "amazon.nl" },
    { code: "jp", name: "Japan", domain: "amazon.co.jp" },
    { code: "br", name: "Brazil", domain: "amazon.com.br" },
    { code: "mx", name: "Mexico", domain: "amazon.com.mx" },
    { code: "in", name: "India", domain: "amazon.in" }
  ];

  let pendingAsin = null;
  let lastFocusedElement = null;
  let modal = null;

  function extractAsin(url) {
    const match = String(url || "").match(/\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/i);
    return match ? match[1].toUpperCase() : null;
  }

  function storeByCode(code) {
    return stores.find((store) => store.code === code) || null;
  }

  function storedStore() {
    try {
      return storeByCode(window.localStorage.getItem(storageKey));
    } catch (error) {
      return null;
    }
  }

  function saveStore(code) {
    try {
      window.localStorage.setItem(storageKey, code);
    } catch (error) {
      // A blocked localStorage must not prevent Amazon links from working.
    }
  }

  function recommendedStore() {
    const languages = window.navigator.languages && window.navigator.languages.length
      ? window.navigator.languages
      : [window.navigator.language || "en-US"];
    const language = String(languages[0]).toLowerCase();
    const region = (language.match(/-([a-z]{2})\b/) || [])[1] || "";
    const regionMap = {
      us: "us", ca: "ca", gb: "uk", au: "au", de: "de", fr: "fr",
      it: "it", es: "es", nl: "nl", jp: "jp", br: "br", mx: "mx", in: "in"
    };
    if (regionMap[region]) return regionMap[region];
    if (language.startsWith("de")) return "de";
    if (language.startsWith("fr")) return "fr";
    if (language.startsWith("it")) return "it";
    if (language.startsWith("es")) return "es";
    if (language.startsWith("nl")) return "nl";
    if (language.startsWith("ja")) return "jp";
    if (language.startsWith("pt")) return "br";
    return "us";
  }

  function buildAmazonUrl(storeCode, asin) {
    const store = storeByCode(storeCode);
    const normalizedAsin = String(asin || "").toUpperCase();
    if (!store || !/^[A-Z0-9]{10}$/.test(normalizedAsin)) return null;
    return `https://www.${store.domain}/dp/${normalizedAsin}`;
  }

  function currentLanguage() {
    return document.documentElement.dataset.lang === "zh" ? "zh" : "en";
  }

  function updateStoreControls() {
    const selected = storedStore();
    document.querySelectorAll("[data-amazon-current-store]").forEach((element) => {
      element.textContent = selected ? selected.name : (currentLanguage() === "zh" ? "尚未选择" : "Not selected");
    });
    if (!modal) return;
    modal.querySelectorAll("[data-amazon-store]").forEach((button) => {
      button.classList.toggle("is-current", Boolean(selected && button.dataset.amazonStore === selected.code));
      button.setAttribute("aria-pressed", String(Boolean(selected && button.dataset.amazonStore === selected.code)));
    });
  }

  function updateAmazonLinks() {
    const selected = storedStore();
    document.querySelectorAll('a[href*="amazon."][href*="/dp/"], a[data-amazon-original-href]').forEach((link) => {
      const originalHref = link.dataset.amazonOriginalHref || link.getAttribute("href");
      const asin = extractAsin(originalHref);
      if (!asin) return;
      if (!link.dataset.amazonOriginalHref) link.dataset.amazonOriginalHref = originalHref;
      link.setAttribute("href", selected ? buildAmazonUrl(selected.code, asin) : originalHref);
    });
  }

  function createModal() {
    const recommended = recommendedStore();
    const overlay = document.createElement("div");
    overlay.className = "amazon-store-modal";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="amazon-store-dialog" role="dialog" aria-modal="true" aria-labelledby="amazon-store-title" aria-describedby="amazon-store-description">
        <div class="amazon-store-dialog-head">
          <div>
            <p class="section-kicker"><span data-i18n="en">Amazon Marketplace</span><span data-i18n="zh">Amazon 商城</span></p>
            <h2 id="amazon-store-title"><span data-i18n="en">Choose your Amazon store</span><span data-i18n="zh">选择你的 Amazon 商城</span></h2>
          </div>
          <button class="amazon-store-close" type="button" data-amazon-store-close aria-label="Close Amazon store selection">×</button>
        </div>
        <p id="amazon-store-description" class="amazon-store-description">
          <span data-i18n="en">Choose the marketplace linked to your Amazon or Kindle account. You can change it at any time.</span>
          <span data-i18n="zh">请选择与你的 Amazon 或 Kindle 账户对应的商城，之后可随时更换。</span>
        </p>
        <div class="amazon-store-grid">
          ${stores.map((store) => `
            <a href="#" role="button" target="_blank" rel="noopener noreferrer" data-amazon-store="${store.code}">
              <span>${store.name}</span>
              ${store.code === recommended ? '<small><span data-i18n="en">Recommended</span><span data-i18n="zh">推荐</span></small>' : ""}
            </a>
          `).join("")}
        </div>
        <p class="amazon-store-footnote">
          <span data-i18n="en">If this title is unavailable in one marketplace, close this window and choose another store.</span>
          <span data-i18n="zh">如果某本书在所选商城不可购买，可返回并选择其他商城。</span>
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("amazon-store-open");
    pendingAsin = null;
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function openModal(asin, trigger) {
    pendingAsin = asin || null;
    lastFocusedElement = trigger || document.activeElement;
    modal.hidden = false;
    document.body.classList.add("amazon-store-open");
    updateStoreControls();
    modal.querySelectorAll("[data-amazon-store]").forEach((storeLink) => {
      storeLink.setAttribute("href", pendingAsin ? buildAmazonUrl(storeLink.dataset.amazonStore, pendingAsin) : "#");
    });
    const selected = storedStore();
    const preferredButton = modal.querySelector(`[data-amazon-store="${selected ? selected.code : recommendedStore()}"]`);
    (preferredButton || modal.querySelector("[data-amazon-store]")).focus();
  }

  function handleStoreSelection(button) {
    const code = button.dataset.amazonStore;
    saveStore(code);
    updateAmazonLinks();
    updateStoreControls();
    closeModal();
  }

  function amazonLinkFromEvent(event) {
    const link = event.target.closest('a[href*="amazon."][href*="/dp/"]');
    if (!link) return null;
    const asin = extractAsin(link.getAttribute("href"));
    return asin ? { link, asin } : null;
  }

  window.CHER_WANG_AMAZON_STORE = { stores, extractAsin, buildAmazonUrl, recommendedStore };

  modal = createModal();
  updateAmazonLinks();
  updateStoreControls();

  document.addEventListener("click", (event) => {
    const amazonLink = amazonLinkFromEvent(event);
    if (amazonLink) {
      const selected = storedStore();
      if (selected) {
        amazonLink.link.dataset.amazonOriginalHref = amazonLink.link.dataset.amazonOriginalHref || amazonLink.link.getAttribute("href");
        amazonLink.link.setAttribute("href", buildAmazonUrl(selected.code, amazonLink.asin));
      } else {
        event.preventDefault();
        openModal(amazonLink.asin, amazonLink.link);
      }
      return;
    }

    const storeButton = event.target.closest("[data-amazon-store]");
    if (storeButton) {
      if (!pendingAsin) event.preventDefault();
      handleStoreSelection(storeButton);
      return;
    }

    const changeButton = event.target.closest("[data-amazon-change-store]");
    if (changeButton) {
      openModal(null, changeButton);
      return;
    }

    if (event.target.closest("[data-amazon-store-close]") || event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!modal.hidden && event.key === "Escape") closeModal();
  });

  document.addEventListener("DOMContentLoaded", updateAmazonLinks);
  window.addEventListener("site-language-change", updateStoreControls);
  window.addEventListener("site-language-change", updateAmazonLinks);
})();

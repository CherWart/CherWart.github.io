(function () {
  const storageKey = "cherWartLanguage";

  function normalizeLanguage(value) {
    return value === "zh" ? "zh" : "en";
  }

  function storedLanguage() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function defaultLanguage() {
    const saved = storedLanguage();
    if (saved === "en" || saved === "zh") {
      return saved;
    }

    return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function updatePageMetadata(language) {
    const title = document.querySelector("title");
    const description = document.querySelector('meta[name="description"]');

    if (title) {
      title.textContent = title.dataset[language === "zh" ? "titleZh" : "titleEn"] || title.textContent;
    }

    if (description) {
      description.content = description.dataset[language === "zh" ? "descriptionZh" : "descriptionEn"] || description.content;
    }
  }

  function languageSpan(language, text) {
    const span = document.createElement("span");
    span.dataset.i18n = language;
    span.textContent = text;
    return span;
  }

  function splitBilingualText(element) {
    const parts = element.textContent.split(" / ");
    if (parts.length < 2) {
      return;
    }

    element.textContent = "";
    element.appendChild(languageSpan("en", parts.shift().trim()));
    element.appendChild(languageSpan("zh", parts.join(" / ").trim()));
  }

  function paragraphLanguage(element) {
    const firstLetter = element.textContent.trim().match(/[A-Za-z\u3400-\u9fff]/);
    if (!firstLetter) {
      return null;
    }

    return /[\u3400-\u9fff]/.test(firstLetter[0]) ? "zh" : "en";
  }

  function isFullyLocalized(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll("[data-i18n]").forEach((localizedContent) => localizedContent.remove());
    return copy.textContent.trim() === "";
  }

  function isolateArtistNames(root) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes("KAIXUAN WANG / 王凯萱")) {
        const fragments = node.nodeValue.split("KAIXUAN WANG / 王凯萱");
        const replacement = document.createDocumentFragment();

        fragments.forEach((fragment, index) => {
          if (index > 0) {
            replacement.appendChild(languageSpan("en", "KAIXUAN WANG"));
            replacement.appendChild(languageSpan("zh", "王凯萱"));
          }
          replacement.appendChild(document.createTextNode(fragment));
        });

        node.replaceWith(replacement);
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE && !node.matches("script, style")) {
        isolateArtistNames(node);
      }
    });
  }

  function prepareLegalFooter() {
    const footer = document.querySelector(".site-footer");
    const copyright = footer && footer.querySelector(".footer-copyright");
    const legalLinks = footer && footer.querySelectorAll(".footer-legal a");

    if (!copyright || copyright.querySelector("[data-i18n]")) {
      return;
    }

    const english = document.createElement("div");
    english.dataset.i18n = "en";
    while (copyright.firstChild) {
      english.appendChild(copyright.firstChild);
    }
    copyright.appendChild(english);

    const chinese = document.createElement("div");
    chinese.dataset.i18n = "zh";
    chinese.innerHTML = "<p>© 2026 王凯萱。保留所有权利。</p><p>所有艺术作品、图像、文字及视觉材料均受版权保护。</p><p>禁止未经授权的复制、再分发、商业使用、人工智能训练、抓取或修改。</p>";
    copyright.appendChild(chinese);

    const chineseLabels = ["隐私政策", "使用条款", "版权声明", "免责声明", "联系"];
    legalLinks.forEach((link, index) => {
      const englishLabel = link.textContent.trim();
      link.textContent = "";
      link.appendChild(languageSpan("en", englishLabel));
      link.appendChild(languageSpan("zh", chineseLabels[index] || englishLabel));
    });
  }

  function prepareLegalDocument() {
    if (!document.body || !document.body.hasAttribute("data-auto-language")) {
      return;
    }

    const brandName = document.querySelector(".brand-name");
    const brandSubname = document.querySelector(".brand-subname");
    const brand = document.querySelector(".brand");
    if (brand) {
      brand.dataset.labelEn = "KAIXUAN WANG home";
      brand.dataset.labelZh = "王凯萱主页";
    }
    if (brandName) {
      brandName.dataset.i18n = "en";
    }
    if (brandSubname) {
      brandSubname.dataset.i18n = "zh";
    }

    const headerInner = document.querySelector(".site-header .header-inner");
    if (headerInner) {
      headerInner.classList.add("legal-header-inner");
      if (!headerInner.querySelector(".language-switch")) {
        const switcher = document.createElement("div");
        switcher.className = "language-switch";
        switcher.setAttribute("aria-label", "Language");
        switcher.innerHTML = '<button type="button" data-lang-button="en">EN</button><span class="language-divider" aria-hidden="true">|</span><button type="button" data-lang-button="zh">中文</button>';
        headerInner.appendChild(switcher);
      }
    }

    const skipLink = document.querySelector(".skip-link");
    if (skipLink) {
      skipLink.textContent = "";
      skipLink.appendChild(languageSpan("en", "Skip to content"));
      skipLink.appendChild(languageSpan("zh", "跳至正文"));
    }

    isolateArtistNames(document.body);

    document.querySelectorAll(".legal-header .section-kicker, .legal-header h1, .legal-header > .shell > p, .legal-section h2, .legal-section li").forEach(splitBilingualText);

    document.querySelectorAll(".legal-section > p").forEach((paragraph) => {
      const text = paragraph.textContent.trim();
      if (paragraph.dataset.i18n || isFullyLocalized(paragraph)) {
        return;
      }

      if (paragraph.querySelector('a[href^="mailto:"]') && text === paragraph.querySelector("a").textContent.trim()) {
        return;
      }

      if (text.length < 100 && text.includes(" / ")) {
        splitBilingualText(paragraph);
        return;
      }

      const language = paragraphLanguage(paragraph);
      if (language) {
        paragraph.dataset.i18n = language;
      }
    });

    prepareLegalFooter();
  }

  function updateLanguageButtons(language) {
    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      const isActive = button.dataset.langButton === language;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateLocalizedAttributes(language) {
    const suffix = language === "zh" ? "Zh" : "En";

    document.querySelectorAll("[data-label-en][data-label-zh]").forEach((element) => {
      element.setAttribute("aria-label", element.dataset[`label${suffix}`]);
    });

    document.querySelectorAll("[data-alt-en][data-alt-zh]").forEach((element) => {
      element.alt = element.dataset[`alt${suffix}`];
    });
  }

  function applyLanguage(value, options) {
    const language = normalizeLanguage(value);
    const settings = options || {};
    const previousLanguage = document.documentElement.dataset.lang;

    document.documentElement.dataset.lang = language;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";

    if (document.body) {
      document.body.dataset.lang = language;
    }

    updatePageMetadata(language);
    updateLanguageButtons(language);
    updateLocalizedAttributes(language);

    if (settings.persist !== false) {
      try {
        window.localStorage.setItem(storageKey, language);
      } catch (error) {
        // Language switching still works when storage is unavailable.
      }
    }

    if (settings.notify !== false && previousLanguage !== language) {
      window.dispatchEvent(new CustomEvent("site-language-change", {
        detail: { language: language }
      }));
    }
  }

  const initialLanguage = defaultLanguage();
  document.documentElement.dataset.lang = initialLanguage;
  document.documentElement.lang = initialLanguage === "zh" ? "zh-CN" : "en";

  window.CHER_WANG_LANGUAGE = {
    get: function () {
      return normalizeLanguage(document.documentElement.dataset.lang);
    },
    set: function (language) {
      applyLanguage(language);
    },
    storageKey: storageKey
  };

  document.addEventListener("DOMContentLoaded", function () {
    prepareLegalDocument();
    applyLanguage(initialLanguage, { persist: false, notify: false });

    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", function () {
        applyLanguage(button.dataset.langButton);
      });
    });
  });

  window.addEventListener("pageshow", function () {
    const saved = storedLanguage();
    applyLanguage(saved || initialLanguage, { persist: false });
  });

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey && (event.newValue === "en" || event.newValue === "zh")) {
      applyLanguage(event.newValue, { persist: false });
    }
  });
})();

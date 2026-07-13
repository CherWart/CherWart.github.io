(function () {
  const body = document.body;
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  const gallery = document.querySelector("[data-gallery]");
  const exhibitionsTarget = document.querySelector("[data-exhibitions]");
  const publicationsTarget = document.querySelector("[data-publications]");
  const filterButtons = document.querySelectorAll("[data-filter]");
  const portfolioFilters = document.querySelector("[data-portfolio-filters]");
  const viewFullPortfolio = document.querySelector("[data-view-full-portfolio]");
  const loadMore = document.querySelector("[data-load-more]");
  const portfolioTitleEn = document.querySelector("[data-portfolio-title-en]");
  const portfolioTitleZh = document.querySelector("[data-portfolio-title-zh]");
  const yearTargets = document.querySelectorAll("[data-year]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  const lightboxCaption = document.querySelector("[data-lightbox-caption]");
  const lightboxRecord = document.querySelector("[data-lightbox-record]");
  const lightboxClose = document.querySelector("[data-lightbox-close]");

  const featuredArtworkIds = [
    "KXW-W-022",
    "KXW-W-006",
    "KXW-W-003",
    "KXW-W-013",
    "KXW-W-033",
    "KXW-P-042",
    "KXW-W-018",
    "KXW-W-004",
    "KXW-G-002"
  ];
  const portfolioBatchSize = 12;

  let portfolioMode = window.location.hash === "#full-portfolio" ? "full" : "featured";
  let currentFilter = "all";
  let visibleArtworkCount = portfolioBatchSize;
  let activeArtwork = null;

  yearTargets.forEach((target) => {
    target.textContent = new Date().getFullYear();
  });

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function protectedHtml(value) {
    return escapeHtml(value)
      .replace(/Cher Wang/g, '<span translate="no" class="notranslate">Cher Wang</span>')
      .replace(/WANG KAIXUAN/g, '<span translate="no" class="notranslate">WANG KAIXUAN</span>')
      .replace(/王凯萱/g, '<span translate="no" class="notranslate">王凯萱</span>');
  }

  function protectNamesInHtml(value) {
    return String(value)
      .replace(/Cher Wang/g, '<span translate="no" class="notranslate">Cher Wang</span>')
      .replace(/WANG KAIXUAN/g, '<span translate="no" class="notranslate">WANG KAIXUAN</span>')
      .replace(/王凯萱/g, '<span translate="no" class="notranslate">王凯萱</span>');
  }

  function categoryLabel(category) {
    const labels = {
      watercolor: "Watercolor / 水彩",
      oil: "Oil Painting / 油画",
      printmaking: "Printmaking / 版画",
      pastel: "Pastel / 色粉",
      other: "Other / 其他"
    };
    return labels[category] || category;
  }

  function bilingualText(en, zh) {
    en = en || "";
    zh = zh || "";
    if (!en && !zh) {
      return "";
    }

    if (en === zh) {
      return `<span>${protectedHtml(en)}</span>`;
    }

    return `
      <span data-i18n="en">${protectedHtml(en)}</span>
      <span data-i18n="zh">${protectedHtml(zh)}</span>
    `;
  }

  function joinParts(parts) {
    return protectNamesInHtml(parts.filter(Boolean).map(escapeHtml).join(" · "));
  }

  function currentLanguage() {
    return window.CHER_WANG_LANGUAGE ? window.CHER_WANG_LANGUAGE.get() : "en";
  }

  function containsChinese(value) {
    return /[\u3400-\u9fff]/.test(String(value || ""));
  }

  function localizedArtworkValue(value) {
    const language = currentLanguage();
    const text = String(value || "").trim();

    if (!text) {
      return "";
    }

    const translations = {
      "Watercolor on Paper": "纸本水彩",
      "Oil on Canvas": "布面油画",
      "Black-and-White Woodcut": "黑白木刻",
      "Black-and-white Woodcut Print": "黑白木刻",
      "Gouache on Paper": "纸本水粉",
      "Pastel on Paper": "纸本色粉",
      "Year": "年代",
      "Medium": "媒介",
      "Series": "系列",
      "Size": "尺寸"
    };

    const parenthetical = text.match(/^(.+?)(?:（([^）]+)）|\(([^)]+)\))$/);
    const parentheticalTranslation = parenthetical && (parenthetical[2] || parenthetical[3]);
    if (parenthetical && containsChinese(parentheticalTranslation)) {
      return language === "zh" ? parentheticalTranslation : parenthetical[1].trim();
    }

    const parts = text.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const matchingPart = parts.find((part) => language === "zh" ? containsChinese(part) : !containsChinese(part));
      if (matchingPart) {
        return matchingPart;
      }
    }

    if (language === "zh" && translations[text]) {
      return translations[text];
    }

    if (language === "en") {
      const english = Object.keys(translations).find((key) => translations[key] === text);
      if (english) {
        return english;
      }
    }

    return text;
  }

  function localizedArtworkTitle(artwork) {
    const title = currentLanguage() === "zh" ? artwork.titleZh : artwork.titleEn;

    if (currentLanguage() === "en") {
      return String(title || "").replace(/（[^）]*[\u3400-\u9fff][^）]*）/g, "").trim();
    }

    return String(title || "");
  }

  function localizedTaggedText(value) {
    const language = currentLanguage();
    const text = String(value || "").trim();

    if (!text) {
      return "";
    }

    const markers = [
      { language: "zh", match: /(?:中文|CN)[：:]\s*/g },
      { language: "en", match: /(?:English|EN)[：:]\s*/g }
    ];
    const positions = [];

    markers.forEach((marker) => {
      marker.match.lastIndex = 0;
      let result = marker.match.exec(text);
      while (result) {
        positions.push({ language: marker.language, start: result.index, contentStart: marker.match.lastIndex });
        result = marker.match.exec(text);
      }
    });

    positions.sort((a, b) => a.start - b.start);
    const selected = positions.find((position) => position.language === language);
    if (selected) {
      const selectedIndex = positions.indexOf(selected);
      const next = positions[selectedIndex + 1];
      return text.slice(selected.contentStart, next ? next.start : text.length).trim();
    }

    if (language === "en" && containsChinese(text)) {
      return "";
    }

    if (language === "zh" && !containsChinese(text)) {
      return "";
    }

    return text;
  }

  function localizedJoinParts(parts) {
    return joinParts(parts.map(localizedArtworkValue));
  }

  const ARTWORK_IMAGE_DIMENSIONS = {
    "assets/images/artworks-web/catalogue-raisonne/KW-O-XXX-1200.jpg": { width: 963, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KW-O-XXX-2000.jpg": { width: 1606, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KW-P-005-1200.jpg": { width: 1200, height: 917 },
    "assets/images/artworks-web/catalogue-raisonne/KW-P-005-2000.jpg": { width: 2000, height: 1529 },
    "assets/images/artworks-web/catalogue-raisonne/KW-W-005-1200.jpg": { width: 1200, height: 817 },
    "assets/images/artworks-web/catalogue-raisonne/KW-W-005-2000.jpg": { width: 2000, height: 1362 },
    "assets/images/artworks-web/catalogue-raisonne/KW-W-006-1200.jpg": { width: 1200, height: 689 },
    "assets/images/artworks-web/catalogue-raisonne/KW-W-006-2000.jpg": { width: 2000, height: 1149 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-001-1200.jpg": { width: 1200, height: 929 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-001-2000.jpg": { width: 2000, height: 1549 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-002-1200.jpg": { width: 1200, height: 839 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-002-2000.jpg": { width: 2000, height: 1399 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-003-1200.jpg": { width: 875, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-003-2000.jpg": { width: 1459, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-007-1200.jpg": { width: 1200, height: 924 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-007-2000.jpg": { width: 2000, height: 1541 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-008-1200.jpg": { width: 885, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-008-2000.jpg": { width: 1476, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-009-1200.jpg": { width: 858, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-009-2000.jpg": { width: 1431, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-010-1200.jpg": { width: 876, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-010-2000.jpg": { width: 1461, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-012-1200.jpg": { width: 1200, height: 831 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-012-2000.jpg": { width: 2000, height: 1386 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-013-1200.jpg": { width: 872, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-013-2000.jpg": { width: 1453, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-014-1200.jpg": { width: 1200, height: 809 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-014-2000.jpg": { width: 2000, height: 1349 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-015-1200.jpg": { width: 884, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-015-2000.jpg": { width: 1474, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-016-1200.jpg": { width: 1200, height: 869 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-016-2000.jpg": { width: 2000, height: 1449 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-017-1200.jpg": { width: 1200, height: 886 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-017-2000.jpg": { width: 2000, height: 1477 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-018-1200.jpg": { width: 1200, height: 704 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-018-2000.jpg": { width: 2000, height: 1174 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-019-1200.jpg": { width: 878, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-019-2000.jpg": { width: 1463, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-020-1200.jpg": { width: 1200, height: 744 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-020-2000.jpg": { width: 2000, height: 1241 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-021-1200.jpg": { width: 1200, height: 528 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-021-2000.jpg": { width: 2000, height: 881 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-022-1200.jpg": { width: 1200, height: 879 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-022-2000.jpg": { width: 2000, height: 1465 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-023-1200.jpg": { width: 1200, height: 808 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-023-2000.jpg": { width: 2000, height: 1347 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-024-1200.jpg": { width: 1179, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-024-2000.jpg": { width: 1965, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-025-1200.jpg": { width: 1200, height: 800 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-025-2000.jpg": { width: 2000, height: 1333 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-026-1200.jpg": { width: 713, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-026-2000.jpg": { width: 1188, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-027-1200.jpg": { width: 800, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-027-2000.jpg": { width: 1333, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-028-1200.jpg": { width: 800, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-028-2000.jpg": { width: 1333, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-030-1200.jpg": { width: 1200, height: 825 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-030-2000.jpg": { width: 2000, height: 1375 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-031-1200.jpg": { width: 948, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-031-2000.jpg": { width: 1581, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-032-1200.jpg": { width: 807, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-032-2000.jpg": { width: 1346, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-033-1200.jpg": { width: 779, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-033-2000.jpg": { width: 1299, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-034-1200.jpg": { width: 1200, height: 917 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-034-2000.jpg": { width: 2000, height: 1528 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-035-1200.jpg": { width: 1200, height: 775 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-035-2000.jpg": { width: 2000, height: 1292 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-036-1200.jpg": { width: 1200, height: 889 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-036-2000.jpg": { width: 2000, height: 1482 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-037-1200.jpg": { width: 1200, height: 844 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-037-2000.jpg": { width: 2000, height: 1407 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-038-1200.jpg": { width: 907, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-038-2000.jpg": { width: 1512, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-039-1200.jpg": { width: 1200, height: 928 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-039-2000.jpg": { width: 2000, height: 1547 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-040-1200.jpg": { width: 1200, height: 852 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-040-2000.jpg": { width: 2000, height: 1420 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-041-1200.jpg": { width: 1200, height: 918 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-041-2000.jpg": { width: 2000, height: 1531 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-042-1200.jpg": { width: 1200, height: 848 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-042-2000.jpg": { width: 2000, height: 1414 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-043-1200.jpg": { width: 774, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-043-2000.jpg": { width: 1290, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-044-1200.jpg": { width: 1200, height: 934 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-044-2000.jpg": { width: 2000, height: 1557 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-045-1200.jpg": { width: 852, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-045-2000.jpg": { width: 1421, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-046-1200.jpg": { width: 1185, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-046-2000.jpg": { width: 1975, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-047-1200.jpg": { width: 902, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-047-2000.jpg": { width: 1504, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-048-1200.jpg": { width: 1034, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-048-2000.jpg": { width: 1723, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-049-1200.jpg": { width: 1200, height: 970 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-049-2000.jpg": { width: 2000, height: 1617 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-050-1200.jpg": { width: 1169, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-050-2000.jpg": { width: 1949, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-051-1200.jpg": { width: 1054, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-051-2000.jpg": { width: 1757, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-053-1200.jpg": { width: 879, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-053-2000.jpg": { width: 1465, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-054-1200.jpg": { width: 949, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-054-2000.jpg": { width: 1582, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-055-1200.jpg": { width: 1200, height: 981 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-055-2000.jpg": { width: 2000, height: 1636 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-056-1200.jpg": { width: 839, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-056-2000.jpg": { width: 1398, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-W-004-1200.jpg": { width: 1200, height: 789 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-W-004-2000.jpg": { width: 2000, height: 1316 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-W-011-1200.jpg": { width: 1200, height: 654 },
    "assets/images/artworks-web/catalogue-raisonne/KXW-W-011-2000.jpg": { width: 2000, height: 1091 },
    "assets/images/artworks-web/catalogue-raisonne/向阳而生-1200.jpg": { width: 1008, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/向阳而生-2000.jpg": { width: 1681, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/外婆家-1200.jpg": { width: 1200, height: 884 },
    "assets/images/artworks-web/catalogue-raisonne/外婆家-2000.jpg": { width: 2000, height: 1474 },
    "assets/images/artworks-web/catalogue-raisonne/拂晓-1200.jpg": { width: 1200, height: 917 },
    "assets/images/artworks-web/catalogue-raisonne/拂晓-2000.jpg": { width: 2000, height: 1529 },
    "assets/images/artworks-web/catalogue-raisonne/曼珠沙华-1200.jpg": { width: 1200, height: 983 },
    "assets/images/artworks-web/catalogue-raisonne/曼珠沙华-2000.jpg": { width: 2000, height: 1639 },
    "assets/images/artworks-web/catalogue-raisonne/百合之歌-1200.jpg": { width: 1024, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/百合之歌-2000.jpg": { width: 1707, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/红裙-1200.jpg": { width: 938, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/红裙-2000.jpg": { width: 1564, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/苗家女-1200.jpg": { width: 939, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/苗家女-2000.jpg": { width: 1565, height: 2000 },
    "assets/images/artworks-web/catalogue-raisonne/采茶去-1200.jpg": { width: 524, height: 1200 },
    "assets/images/artworks-web/catalogue-raisonne/采茶去-2000.jpg": { width: 873, height: 2000 }
  };

  function imageDimensions(path) {
    return ARTWORK_IMAGE_DIMENSIONS[path] || { width: 1200, height: 1200 };
  }

  function responsiveArtworkImage(image) {
    const desktop = image || "";

    if (desktop.includes("/artworks/oil-painting/")) {
      const dimensions = imageDimensions(desktop);
      return {
        src: desktop,
        srcset: desktop,
        fullSrcset: desktop,
        width: dimensions.width,
        height: dimensions.height
      };
    }

    const preview = desktop.replace(/-2000\.jpg$/, "-1200.jpg");
    const dimensions = imageDimensions(preview);

    return {
      src: preview || desktop,
      srcset: preview || desktop,
      fullSrcset: preview === desktop ? desktop : `${preview} 1200w, ${desktop} 2000w`,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  function recordBlock(labelEn, labelZh, value) {
    if (!value) {
      return "";
    }

    const label = currentLanguage() === "zh" ? labelZh : labelEn;

    return `
      <section class="record-section">
        <h4>${escapeHtml(label)}</h4>
        <p>${protectNamesInHtml(escapeHtml(value).replace(/\n/g, "<br>"))}</p>
      </section>
    `;
  }

  function artworkCardMarkup(artwork, artworks, index) {
    const image = responsiveArtworkImage(artwork.image);
    const title = localizedArtworkTitle(artwork);
    const isPriorityImage = portfolioMode === "featured" && index < 3;
    const sizes = portfolioMode === "featured"
      ? "(min-width: 981px) 33vw, (min-width: 681px) 50vw, 100vw"
      : "(min-width: 981px) 25vw, (min-width: 681px) 33vw, 50vw";

    return `
      <button class="art-card" type="button" data-art-index="${artworks.indexOf(artwork)}">
        <img
          src="${escapeHtml(image.src)}"
          srcset="${escapeHtml(image.srcset)}"
          sizes="${sizes}"
          width="${image.width}"
          height="${image.height}"
          alt="${escapeHtml(title)}"
          loading="lazy"
          fetchpriority="${isPriorityImage ? "high" : "low"}"
          decoding="async">
        <div class="art-card-body">
          <h3>${protectedHtml(title)}</h3>
          <p class="meta-line">${localizedJoinParts([artwork.year, artwork.medium])}</p>
          <p class="meta-line">
            ${localizedJoinParts([artwork.dimensions, artwork.series])}
          </p>
        </div>
      </button>
    `;
  }

  function filteredArtworks(artworks) {
    return currentFilter === "all"
      ? artworks
      : artworks.filter((artwork) => artwork.category === currentFilter);
  }

  function featuredArtworks(artworks) {
    const artworksById = new Map(artworks.map((artwork) => [artwork.artworkId, artwork]));
    return featuredArtworkIds.map((id) => artworksById.get(id)).filter(Boolean);
  }

  function renderGallery() {
    const artworks = window.CHER_WANG_ARTWORKS || [];
    const availableArtworks = portfolioMode === "featured"
      ? filteredArtworks(featuredArtworks(artworks))
      : filteredArtworks(artworks);
    const visibleArtworks = portfolioMode === "featured"
      ? availableArtworks
      : availableArtworks.slice(0, visibleArtworkCount);

    gallery.classList.toggle("is-featured", portfolioMode === "featured");
    gallery.innerHTML = visibleArtworks
      .map((artwork, index) => artworkCardMarkup(artwork, artworks, index))
      .join("");

    portfolioFilters.hidden = false;
    viewFullPortfolio.hidden = portfolioMode !== "featured";
    loadMore.hidden = portfolioMode === "featured" || visibleArtworks.length >= availableArtworks.length;
    portfolioTitleEn.textContent = portfolioMode === "featured" ? "Selected Works" : "Full Portfolio";
    portfolioTitleZh.textContent = portfolioMode === "featured" ? "精选作品" : "全部作品";
  }

  function renderExhibitions() {
    const groups = window.CHER_WANG_EXHIBITIONS || [];
    exhibitionsTarget.innerHTML = groups.map((group) => {
      const items = group.items || [];
      const body = items.length ? items.map((item) => `
        <article class="cv-item">
          <div class="cv-year">${escapeHtml(item.year)}</div>
          <div>
            <p class="cv-title">
              <span data-i18n="en">${protectedHtml(item.titleEn)}</span>
              <span data-i18n="zh">${protectedHtml(item.titleZh)}</span>
            </p>
            <p class="cv-location">
              <span data-i18n="en">${protectedHtml(item.locationEn)}</span>
              <span data-i18n="zh">${protectedHtml(item.locationZh)}</span>
            </p>
          </div>
        </article>
      `).join("") : `
        <p class="cv-empty">
          <span data-i18n="en">Information to be added.</span>
          <span data-i18n="zh">资料待补充。</span>
        </p>
      `;

      return `
        <section class="cv-group">
          <h3>
            <span data-i18n="en">${protectedHtml(group.headingEn)}</span>
            <span data-i18n="zh">${protectedHtml(group.headingZh)}</span>
          </h3>
          <div class="cv-list">${body}</div>
        </section>
      `;
    }).join("");
  }

  function renderPublications() {
    const publications = window.CHER_WANG_PUBLICATIONS || [];
    const language = currentLanguage();
    publicationsTarget.innerHTML = publications.map((item) => `
      <article class="publication-card">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(language === "zh" ? item.titleZh : `${item.titleEn} cover`)}">
        <div class="publication-card-body">
          <h3>
            ${bilingualText(item.titleEn, item.titleZh)}
          </h3>
          <p class="meta-line">${escapeHtml(item.year)}</p>
          <p class="meta-line">
            <span data-i18n="en">${protectedHtml(item.typeEn)}</span>
            <span data-i18n="zh">${protectedHtml(item.typeZh)}</span>
          </p>
        </div>
      </article>
    `).join("");
  }

  function localizedRecordText(artwork) {
    const language = currentLanguage();
    const labels = language === "zh"
      ? { heading: "作品档案", id: "作品编号", title: "作品名称", year: "年代", medium: "媒介", dimensions: "尺寸", series: "系列" }
      : { heading: "Artwork Record", id: "Artwork ID", title: "Title", year: "Year", medium: "Medium", dimensions: "Dimensions", series: "Series" };
    const title = localizedArtworkTitle(artwork);

    return [
      labels.heading,
      `${labels.id}: ${artwork.artworkId || ""}`,
      `${labels.title}: ${title || ""}`,
      `${labels.year}: ${localizedArtworkValue(artwork.year)}`,
      `${labels.medium}: ${localizedArtworkValue(artwork.medium)}`,
      `${labels.dimensions}: ${localizedArtworkValue(artwork.dimensions)}`,
      `${labels.series}: ${localizedArtworkValue(artwork.series)}`
    ].join("\n");
  }

  function renderLightboxContent(artwork) {
    const language = currentLanguage();
    const title = localizedArtworkTitle(artwork);
    const meta = localizedJoinParts([artwork.year, artwork.medium]);
    const statement = language === "zh"
      ? String(artwork.statementZh || "")
      : String(artwork.statementEn || "").split(/\n[一二三四五六七八九十]+、/)[0].trim();
    const keywords = localizedTaggedText(artwork.keywords);
    const exhibitionHistory = localizedTaggedText(artwork.exhibitionHistory);
    const awards = localizedTaggedText(artwork.awards);
    const collection = localizedTaggedText(artwork.collection);
    const publication = localizedTaggedText(artwork.publication);

    lightboxImage.alt = title || "";
    lightboxCaption.innerHTML = `
      <span>${protectedHtml(title)}<br>${meta}</span>
    `;
    lightboxRecord.innerHTML = `
      <div class="record-head">
        <p class="record-id">${escapeHtml(artwork.artworkId || "")}</p>
        <h3>${protectedHtml(title)}</h3>
        <p class="meta-line">${localizedJoinParts([artwork.year, artwork.medium, artwork.dimensions, artwork.series])}</p>
      </div>
      ${recordBlock("Keywords", "关键词", keywords)}
      ${recordBlock("Artwork Statement", "作品阐述", statement)}
      ${recordBlock("Exhibition History", "展览经历", exhibitionHistory)}
      ${recordBlock("Awards", "荣誉", awards)}
      ${recordBlock("Collection", "收藏", collection)}
      ${recordBlock("Publication", "出版发表", publication)}
      <section class="record-section">
        <h4>${language === "zh" ? "完整作品档案" : "Complete Artwork Record"}</h4>
        <pre>${protectNamesInHtml(escapeHtml(localizedRecordText(artwork)))}</pre>
      </section>
    `;
  }

  function openLightbox(artwork) {
    activeArtwork = artwork;
    lightboxImage.src = artwork.image;
    lightboxImage.width = imageDimensions(artwork.image).width;
    lightboxImage.height = imageDimensions(artwork.image).height;
    renderLightboxContent(artwork);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.removeAttribute("src");
    lightboxImage.removeAttribute("width");
    lightboxImage.removeAttribute("height");
    lightboxRecord.innerHTML = "";
    activeArtwork = null;
    body.style.overflow = "";
  }

  function resetPortfolioFilter() {
    currentFilter = "all";
    filterButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === "all");
    });
  }

  function setPortfolioMode(mode) {
    portfolioMode = mode;
    visibleArtworkCount = portfolioBatchSize;
    resetPortfolioFilter();
    renderGallery();
  }

  function syncPortfolioModeFromLocation() {
    const nextMode = window.location.hash === "#full-portfolio" ? "full" : "featured";

    if (nextMode === portfolioMode) {
      return;
    }

    if (lightbox.classList.contains("is-open")) {
      closeLightbox();
    }

    setPortfolioMode(nextMode);
  }

  window.addEventListener("site-language-change", () => {
    renderGallery();
    renderExhibitions();
    renderPublications();

    if (activeArtwork && lightbox.classList.contains("is-open")) {
      renderLightboxContent(activeArtwork);
    }
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      visibleArtworkCount = portfolioBatchSize;
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderGallery();
    });
  });

  gallery.addEventListener("click", (event) => {
    const card = event.target.closest("[data-art-index]");

    if (!card || !gallery.contains(card)) {
      return;
    }

    const artworks = window.CHER_WANG_ARTWORKS || [];
    const artwork = artworks[Number(card.dataset.artIndex)];

    if (artwork) {
      openLightbox(artwork);
    }
  });

  viewFullPortfolio.addEventListener("click", () => {
    window.history.pushState({ portfolioMode: "full" }, "", "#full-portfolio");
    setPortfolioMode("full");
    document.querySelector("#portfolio").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  loadMore.addEventListener("click", () => {
    visibleArtworkCount += portfolioBatchSize;
    renderGallery();
  });

  window.addEventListener("popstate", syncPortfolioModeFromLocation);
  window.addEventListener("hashchange", syncPortfolioModeFromLocation);

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const isOpen = body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  if (nav) {
    nav.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  renderGallery();
  renderExhibitions();
  renderPublications();
})();

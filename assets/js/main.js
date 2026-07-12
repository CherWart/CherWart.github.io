(function () {
  const body = document.body;
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  const langButtons = document.querySelectorAll("[data-lang-button]");
  const gallery = document.querySelector("[data-gallery]");
  const exhibitionsTarget = document.querySelector("[data-exhibitions]");
  const publicationsTarget = document.querySelector("[data-publications]");
  const filterButtons = document.querySelectorAll("[data-filter]");
  const yearTarget = document.querySelector("[data-year]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  const lightboxCaption = document.querySelector("[data-lightbox-caption]");
  const lightboxRecord = document.querySelector("[data-lightbox-record]");
  const lightboxClose = document.querySelector("[data-lightbox-close]");

  let currentFilter = "all";

  body.dataset.lang = "both";
  if (yearTarget) {
    yearTarget.textContent = new Date().getFullYear();
  }

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

    return `
      <section class="record-section">
        <h4><span data-i18n="en">${escapeHtml(labelEn)}</span><span data-i18n="zh">${escapeHtml(labelZh)}</span></h4>
        <p>${protectNamesInHtml(escapeHtml(value).replace(/\n/g, "<br>"))}</p>
      </section>
    `;
  }

  function renderGallery() {
    const artworks = window.CHER_WANG_ARTWORKS || [];
    const filtered = currentFilter === "all"
      ? artworks
      : artworks.filter((artwork) => artwork.category === currentFilter);

    gallery.innerHTML = filtered.map((artwork, index) => {
      const image = responsiveArtworkImage(artwork.image);

      return `
      <button class="art-card" type="button" data-art-index="${artworks.indexOf(artwork)}">
        <img
          src="${escapeHtml(image.src)}"
          srcset="${escapeHtml(image.srcset)}"
          sizes="(min-width: 960px) 33vw, (min-width: 640px) 50vw, 100vw"
          width="${image.width}"
          height="${image.height}"
          alt="${escapeHtml(artwork.titleEn)} / ${escapeHtml(artwork.titleZh)}"
          loading="lazy"
          fetchpriority="low"
          decoding="async">
        <div class="art-card-body">
          <h3>
            ${bilingualText(artwork.titleEn, artwork.titleZh)}
          </h3>
          <p class="meta-line">${joinParts([artwork.year, artwork.medium])}</p>
          <p class="meta-line">
            ${joinParts([artwork.dimensions, artwork.series])}
          </p>
        </div>
      </button>
    `;
    }).join("");

    gallery.querySelectorAll("[data-art-index]").forEach((card) => {
      card.addEventListener("click", () => {
        const artwork = artworks[Number(card.dataset.artIndex)];
        openLightbox(artwork);
      });
    });
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
    publicationsTarget.innerHTML = publications.map((item) => `
      <article class="publication-card">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.titleEn)} cover">
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

  function openLightbox(artwork) {
    lightboxImage.src = artwork.image;
    lightboxImage.width = imageDimensions(artwork.image).width;
    lightboxImage.height = imageDimensions(artwork.image).height;
    lightboxImage.alt = `${artwork.titleEn} / ${artwork.titleZh}`;
    const meta = joinParts([artwork.year, artwork.medium]);
    lightboxCaption.innerHTML = `
      <span>${protectedHtml(artwork.titleEn)}<br>${meta}</span>
      <span>${protectedHtml(artwork.titleZh)}<br>${meta}</span>
    `;
    lightboxRecord.innerHTML = `
      <div class="record-head">
        <p class="record-id">${escapeHtml(artwork.artworkId || "")}</p>
        <h3>${bilingualText(artwork.titleEn, artwork.titleZh)}</h3>
        <p class="meta-line">${joinParts([artwork.year, artwork.medium, artwork.dimensions, artwork.series])}</p>
      </div>
      ${recordBlock("Keywords", "关键词", artwork.keywords)}
      ${recordBlock("Artwork Statement (Chinese)", "作品阐述（中文）", artwork.statementZh)}
      ${recordBlock("Artwork Statement (English)", "作品阐述（英文）", artwork.statementEn)}
      ${recordBlock("Exhibition History", "展览经历", artwork.exhibitionHistory)}
      ${recordBlock("Awards", "荣誉", artwork.awards)}
      ${recordBlock("Collection", "收藏", artwork.collection)}
      ${recordBlock("Publication", "出版发表", artwork.publication)}
      <section class="record-section">
        <h4><span data-i18n="en">Complete Artwork Record</span><span data-i18n="zh">完整作品档案</span></h4>
        <pre>${protectNamesInHtml(escapeHtml(artwork.fullRecordText || ""))}</pre>
      </section>
    `;
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
    body.style.overflow = "";
  }

  langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      body.dataset.lang = button.dataset.langButton;
      langButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderGallery();
    });
  });

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

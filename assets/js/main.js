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
      return `<span>${escapeHtml(en)}</span>`;
    }

    return `
      <span data-i18n="en">${escapeHtml(en)}</span>
      <span data-i18n="zh">${escapeHtml(zh)}</span>
    `;
  }

  function joinParts(parts) {
    return parts.filter(Boolean).map(escapeHtml).join(" · ");
  }

  function recordBlock(labelEn, labelZh, value) {
    if (!value) {
      return "";
    }

    return `
      <section class="record-section">
        <h4><span data-i18n="en">${escapeHtml(labelEn)}</span><span data-i18n="zh">${escapeHtml(labelZh)}</span></h4>
        <p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>
      </section>
    `;
  }

  function renderGallery() {
    const artworks = window.CHER_WANG_ARTWORKS || [];
    const filtered = currentFilter === "all"
      ? artworks
      : artworks.filter((artwork) => artwork.category === currentFilter);

    gallery.innerHTML = filtered.map((artwork, index) => `
      <button class="art-card" type="button" data-art-index="${artworks.indexOf(artwork)}">
        <img src="${escapeHtml(artwork.image)}" alt="${escapeHtml(artwork.titleEn)} / ${escapeHtml(artwork.titleZh)}">
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
    `).join("");

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
              <span data-i18n="en">${escapeHtml(item.titleEn)}</span>
              <span data-i18n="zh">${escapeHtml(item.titleZh)}</span>
            </p>
            <p class="cv-location">
              <span data-i18n="en">${escapeHtml(item.locationEn)}</span>
              <span data-i18n="zh">${escapeHtml(item.locationZh)}</span>
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
            <span data-i18n="en">${escapeHtml(group.headingEn)}</span>
            <span data-i18n="zh">${escapeHtml(group.headingZh)}</span>
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
            <span data-i18n="en">${escapeHtml(item.typeEn)}</span>
            <span data-i18n="zh">${escapeHtml(item.typeZh)}</span>
          </p>
        </div>
      </article>
    `).join("");
  }

  function openLightbox(artwork) {
    lightboxImage.src = artwork.image;
    lightboxImage.alt = `${artwork.titleEn} / ${artwork.titleZh}`;
    const title = artwork.titleEn === artwork.titleZh ? artwork.titleEn : `${artwork.titleEn} / ${artwork.titleZh}`;
    lightboxCaption.textContent = joinParts([title, artwork.year, artwork.medium, artwork.dimensions, artwork.series]);
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
        <pre>${escapeHtml(artwork.fullRecordText || "")}</pre>
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

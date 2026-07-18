# KAIXUAN WANG / 王凯萱 Artist Portfolio

Static bilingual artist portfolio website for GitHub Pages.

## Structure

- `index.html` - Main website page
- `assets/css/styles.css` - Site design and responsive layout
- `assets/js/main.js` - Language toggle, gallery filters, and lightbox
- `data/artworks.js` - Editable artwork records
- `data/exhibitions.js` - Editable exhibitions and awards records
- `data/publications.js` - Editable books and publications records
- `assets/images/` - Artwork, portrait, and publication images

Placeholder images are included for now and can be replaced with final artwork files later.

## Analytics and search configuration

### Google Analytics 4

Open `data/analytics-config.js` and enter the real GA4 Measurement ID in
`googleAnalytics4.measurementId`:

```js
measurementId: "G-XXXXXXXXXX"
```

Leave the value empty until a real ID is available. With an empty or invalid
value, no Google Analytics script or request is created. The analytics loader
is deferred, injects Google Tag asynchronously, and prevents duplicate loads.

### Google Search Console

Open `data/site-config.json` and enter only the verification code supplied by
Google in `googleSiteVerification`:

```json
"googleSiteVerification": "verification-code-from-google"
```

Leave the value empty until Google provides a real code. During the Pages
build, `tools/build-seo.mjs` adds the required verification meta tag only when
the value is present. The same build step generates `sitemap.xml` and
`robots.txt` from the centralized site configuration.

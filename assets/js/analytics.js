(function () {
  const config = window.CHER_WANG_ANALYTICS;

  if (!config || config.enabled !== true) {
    return;
  }

  if (config.provider === "google-analytics-4") {
    loadGoogleAnalytics4(config.googleAnalytics4);
    return;
  }

  if (config.provider === "plausible") {
    loadPlausible(config.plausible);
  }

  function loadGoogleAnalytics4(providerConfig) {
    const measurementId = providerConfig && providerConfig.measurementId;

    if (!/^G-[A-Z0-9]+$/i.test(measurementId || "")) {
      return;
    }

    if (window.__CHER_WANG_GA4_LOADED__) {
      return;
    }

    window.__CHER_WANG_GA4_LOADED__ = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId);

    const script = document.createElement("script");
    script.id = "kaixuan-wang-ga4";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  function loadPlausible(providerConfig) {
    const domain = providerConfig && providerConfig.domain;
    const scriptSrc = providerConfig && providerConfig.scriptSrc;

    if (!domain || !scriptSrc) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.domain = domain;
    script.src = scriptSrc;
    document.head.appendChild(script);
  }
})();

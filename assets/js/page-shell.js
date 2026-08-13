(function () {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();

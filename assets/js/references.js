(function () {
  const body = document.body;
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");

  document.querySelectorAll("[data-year]").forEach((target) => {
    target.textContent = new Date().getFullYear();
  });

  if (!navToggle || !nav) {
    return;
  }

  navToggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
})();

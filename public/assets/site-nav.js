(function () {
  function normalizeProjectInput(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function currentSlug() {
    const params = new URLSearchParams(window.location.search);
    return normalizeProjectInput(params.get("slug") || "");
  }

  function currentPage() {
    const path = window.location.pathname;
    if (path.startsWith("/reports")) return "report";
    if (path.startsWith("/trade-plan")) return "trade-plan";
    if (path.startsWith("/bull-radar")) return "bull-radar";
    if (path.startsWith("/strategy")) return "strategy";
    return "home";
  }

  function openTarget(target, inputValue) {
    const slug = normalizeProjectInput(inputValue);

    if (target === "home") {
      window.location.assign("/");
      return;
    }

    if (target === "bull-radar") {
      window.location.assign("/bull-radar/");
      return;
    }

    if (target === "strategy") {
      window.location.assign("/strategy/");
      return;
    }

    if (!slug) {
      const input = document.querySelector("[data-site-nav-input]");
      input?.focus();
      input?.classList.add("is-invalid");
      setTimeout(() => input?.classList.remove("is-invalid"), 900);
      return;
    }

    if (target === "trade-plan") {
      window.location.assign(`/trade-plan/?slug=${encodeURIComponent(slug)}`);
      return;
    }

    window.location.assign(`/reports/?slug=${encodeURIComponent(slug)}`);
  }

  function siteNavHtml() {
    const page = currentPage();
    const slug = currentSlug();
    const inputValue = slug ? slug.toUpperCase() : "";

    return `
      <header class="site-nav" data-site-nav>
        <div class="site-nav-inner">
          <a class="site-nav-brand" href="/">CRYPTO PROJECT REPORTS</a>

          <form class="site-nav-search" data-site-nav-search autocomplete="off">
            <input
              data-site-nav-input
              name="project"
              type="search"
              value="${inputValue}"
              placeholder="Введите тикер"
              aria-label="Введите тикер"
            />

            <button type="submit" data-target="report" class="${page === "report" ? "active" : ""}">
              Отчет
            </button>

            <button type="button" data-target="trade-plan" class="${page === "trade-plan" ? "active" : ""}">
              Торговый план
            </button>

            <button type="button" data-target="bull-radar" class="${page === "bull-radar" ? "active radar" : "radar"}">
              Бычий радар
            </button>

            <button type="button" data-target="strategy" class="${page === "strategy" ? "active" : ""}">
              Стратегия
            </button>

            ${page !== "home" ? `<button type="button" data-target="home" class="ghost">Главная</button>` : ""}
          </form>
        </div>
      </header>
    `;
  }

  function mountSiteNav() {
    if (document.querySelector("[data-site-nav]")) return;

    document.body.insertAdjacentHTML("afterbegin", siteNavHtml());

    const form = document.querySelector("[data-site-nav-search]");
    const input = document.querySelector("[data-site-nav-input]");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      openTarget("report", input?.value || "");
    });

    form?.querySelectorAll("[data-target]").forEach((button) => {
      button.addEventListener("click", () => {
        openTarget(button.dataset.target || "report", input?.value || "");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSiteNav);
  } else {
    mountSiteNav();
  }
})();

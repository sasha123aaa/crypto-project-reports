(function () {
  const POPULAR_SLUGS = new Set(["btc", "eth", "bnb", "sol", "link", "hype", "doge", "pepe"]);
  const warmed = new Set();
  let warmInFlight = false;

  function warmReport(slug) {
    if (!POPULAR_SLUGS.has(slug) || warmed.has(slug) || warmInFlight) return;
    warmed.add(slug);
    warmInFlight = true;
    fetch(`/api/report-shell/${encodeURIComponent(slug)}?warm=1`, { cache:"force-cache", priority:"low" })
      .catch(() => warmed.delete(slug))
      .finally(() => { warmInFlight = false; });
  }

  function normalizeProjectInput(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function setFormState(form, message, type) {
    const status = form?.querySelector("[data-search-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type || "idle";
  }

  function openProject(project, target = "report") {
    const slug = normalizeProjectInput(project);
    if (!slug) return false;

    if (target === "trade-plan") {
      window.location.assign(`/trade-plan/?slug=${encodeURIComponent(slug)}`);
      return true;
    }

    if (target === "bull-radar") {
      window.location.assign(`/bull-radar/`);
      return true;
    }

    window.location.assign(`/reports/?slug=${encodeURIComponent(slug)}`);
    return true;
  }

  document.querySelectorAll("[data-project-search]").forEach((form) => {
    const input = form.querySelector("[name='project']");
    if (!input) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const project = normalizeProjectInput(input.value);
      if (!project) {
        setFormState(form, "Введите тикер или название проекта.", "error");
        input.focus();
        return;
      }

      const submitter = event.submitter;
      const target = submitter?.dataset?.target || "report";

      input.value = project.toUpperCase();
      input.setAttribute("aria-busy", "true");
      form.querySelectorAll("button").forEach((button) => button.setAttribute("disabled", ""));
      setFormState(form, target === "trade-plan"
        ? `Открываем торговый план ${project.toUpperCase()}…`
        : `Собираем отчет по ${project.toUpperCase()}…`, "loading");

      openProject(project, target);
    });

    input.addEventListener("focus", () => warmReport(normalizeProjectInput(input.value) || "eth"), { once:true });
    input.addEventListener("input", () => {
      setFormState(form, "", "idle");
      warmReport(normalizeProjectInput(input.value));
    });
  });

  document.querySelectorAll("[data-project-search] [data-target='trade-plan']").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      const input = form?.querySelector("[name='project']");
      const project = normalizeProjectInput(input?.value);

      if (!project) {
        setFormState(form, "Введите тикер для торгового плана.", "error");
        input?.focus();
        return;
      }

      openProject(project, "trade-plan");
    });
  });

  document.querySelectorAll("[data-home-quick-search]").forEach((form) => {
    const input = form.querySelector("[name='project']");
    if (!input) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const project = normalizeProjectInput(input.value);

      if (!project) {
        input.focus();
        return;
      }

      const target = event.submitter?.dataset?.target || "report";
      openProject(project, target);
    });

    form.querySelector("[data-target='trade-plan']")?.addEventListener("click", () => {
      const project = normalizeProjectInput(input.value);
      if (!project) {
        input.focus();
        return;
      }

      openProject(project, "trade-plan");
    });
  });

  document.querySelectorAll("a[href*='slug=']").forEach((link) => {
    const slug = normalizeProjectInput(new URL(link.href).searchParams.get("slug"));
    link.addEventListener("pointerenter", () => warmReport(slug), { once:true });
    link.addEventListener("focus", () => warmReport(slug), { once:true });
  });

  const warmPopular = () => ["btc", "eth", "bnb"].forEach((slug, index) => setTimeout(() => warmReport(slug), index * 1200));
  if ("requestIdleCallback" in window) window.requestIdleCallback(warmPopular, { timeout:2500 });
  else setTimeout(warmPopular, 1500);
})();

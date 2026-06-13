(function () {
  const POPULAR_SLUGS = new Set(["btc", "eth", "bnb", "sol", "link", "hype", "doge", "pepe"]);
  const warmed = new Set();
  let warmInFlight = false;

  function warmReport(slug) {
    if (!POPULAR_SLUGS.has(slug) || warmed.has(slug) || warmInFlight) return;
    warmed.add(slug);
    warmInFlight = true;
    fetch(`/api/report/${encodeURIComponent(slug)}?warm=1`, { cache:"force-cache", priority:"low" })
      .catch(() => warmed.delete(slug))
      .finally(() => { warmInFlight = false; });
  }

  function normalizeProjectInput(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-");
  }

  function setFormState(form, message, type) {
    const status = form.querySelector("[data-search-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type || "idle";
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

      input.value = project.toUpperCase();
      input.setAttribute("aria-busy", "true");
      form.querySelector("button")?.setAttribute("disabled", "");
      setFormState(form, `Собираем отчет по ${project.toUpperCase()}…`, "loading");
      window.location.assign(`/reports/?slug=${encodeURIComponent(project)}`);
    });

    input.addEventListener("focus", () => warmReport(normalizeProjectInput(input.value) || "eth"), { once:true });
    input.addEventListener("input", () => {
      setFormState(form, "", "idle");
      warmReport(normalizeProjectInput(input.value));
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

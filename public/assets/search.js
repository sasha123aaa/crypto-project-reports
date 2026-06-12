(function () {
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

    input.addEventListener("input", () => setFormState(form, "", "idle"));
  });
})();

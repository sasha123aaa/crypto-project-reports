(function () {
  let activeTimeframe = "4h";

  document.querySelectorAll("[data-radar-tf]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTimeframe = button.dataset.radarTf || "4h";

      document.querySelectorAll("[data-radar-tf]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      const placeholder = document.querySelector(".radar-placeholder span");
      if (placeholder) {
        placeholder.textContent = `Сканер будет искать бычьи диапазоны на таймфрейме ${activeTimeframe}.`;
      }
    });
  });
})();

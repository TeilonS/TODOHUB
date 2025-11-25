/* theme.js — Controle de Tema Dark/Light */

import { Storage } from "./storage.js";

export const Theme = (() => {

  const KEY = "theme";

  const apply = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);

    const icon = document.getElementById("themeIcon");
    if (icon) {
      // Ícone indica para onde vai mudar
      icon.textContent = theme === "dark" ? "☀️" : "🌙";
    }

    Storage.setPref(KEY, theme);
  };

  const toggle = () => {
    const next = get() === "dark" ? "light" : "dark";
    apply(next);
  };

  const get = () => Storage.getPref(KEY) || "dark";

  const init = () => {
    apply(get());
    document.getElementById("themeToggle")?.addEventListener("click", toggle);
  };

  return { init, toggle, get };

})();

/* Inicializa */
document.addEventListener("DOMContentLoaded", Theme.init);

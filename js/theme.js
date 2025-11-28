/* theme.js — Controle de Tema Dark/Light/OLED */

import { Storage } from "./storage.js";

export const Theme = (() => {

  const KEY = "theme";
  const THEMES = ["dark", "light", "oled"];

  const apply = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);

    const icon = document.getElementById("themeIcon");
    if (icon) {
      const idx = THEMES.indexOf(theme);
      const next = THEMES[(idx + 1) % THEMES.length];
      icon.textContent =
        next === "light" ? "☀️" :
        next === "dark"  ? "🌙" :
                           "🖤";
    }

    Storage.setPref(KEY, theme);
  };

  const get = () => Storage.getPref(KEY) || "dark";

  const toggle = () => {
    const current = get();
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    apply(next);
  };

  const init = () => {
    apply(get());
    document.getElementById("themeToggle")?.addEventListener("click", toggle);
  };

  return { init, toggle, get };

})();

document.addEventListener("DOMContentLoaded", Theme.init);

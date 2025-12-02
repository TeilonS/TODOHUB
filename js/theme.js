// js/theme.js
// Controle de tema: dark / light / oled

import { loadTheme, saveTheme } from "./storage.js";

const html = document.documentElement;
const themeToggleBtn = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const metaTheme = document.querySelector('meta[name="theme-color"]');

/**
 * Aplica o tema visual geral
 */
function applyTheme(theme) {
  if (!html) return;

  html.setAttribute("data-theme", theme);

  switch (theme) {
    case "light":
      themeIcon && (themeIcon.textContent = "☀️");
      metaTheme?.setAttribute("content", "#0ea5e9");
      break;

    case "oled":
      themeIcon && (themeIcon.textContent = "🌑");
      metaTheme?.setAttribute("content", "#000000");
      break;

    default: // dark
      themeIcon && (themeIcon.textContent = "🌙");
      metaTheme?.setAttribute("content", "#00bcd4");
  }
}

/**
 * Detecta tema inicial:
 * - Prioriza tema salvo
 * - Depois usa prefers-color-scheme
 */
function detectInitialTheme() {
  const saved = loadTheme();
  if (saved) return saved;

  const prefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

  return prefersLight ? "light" : "dark";
}

let currentTheme = detectInitialTheme();
applyTheme(currentTheme);

/**
 * Alternância de temas: dark → light → oled → dark
 */
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    currentTheme =
      currentTheme === "dark"
        ? "light"
        : currentTheme === "light"
        ? "oled"
        : "dark";

    applyTheme(currentTheme);
    saveTheme(currentTheme);
  });
}

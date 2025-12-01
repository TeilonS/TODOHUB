// js/theme.js
// Controle de tema: dark / light / oled

import { loadTheme, saveTheme } from './storage.js';

const html = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const metaTheme = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);

  if (theme === 'light') {
    if (themeIcon) themeIcon.textContent = '☀️';
    metaTheme?.setAttribute('content', '#0ea5e9');
  } else if (theme === 'oled') {
    if (themeIcon) themeIcon.textContent = '🌑';
    metaTheme?.setAttribute('content', '#000000');
  } else {
    // dark
    if (themeIcon) themeIcon.textContent = '🌙';
    metaTheme?.setAttribute('content', '#00bcd4');
  }
}

function detectInitialTheme() {
  const saved = loadTheme();
  if (saved) return saved;

  const prefersLight =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;

  return prefersLight ? 'light' : 'dark';
}

let currentTheme = detectInitialTheme();
applyTheme(currentTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    // alterna dark -> light -> oled -> dark...
    if (currentTheme === 'dark') currentTheme = 'light';
    else if (currentTheme === 'light') currentTheme = 'oled';
    else currentTheme = 'dark';

    applyTheme(currentTheme);
    saveTheme(currentTheme);
  });
}


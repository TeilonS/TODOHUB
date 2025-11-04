/* theme.js
   Alterna Dark/Light e persiste preferência no LocalStorage.
*/

const Theme = (() => {
  const THEME_KEY = 'theme';

  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    Storage.setPref(THEME_KEY, theme);
  };

  const toggle = () => {
    const current = get();
    apply(current === 'dark' ? 'light' : 'dark');
  };

  const get = () => Storage.getPref(THEME_KEY) || 'dark';

  const init = () => {
    apply(get());
    const btn = document.getElementById('themeToggle');
    btn?.addEventListener('click', toggle);
  };

  return { init, apply, toggle, get };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Theme.init);
} else {
  Theme.init();
}


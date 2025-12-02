// js/ui.js
// Utilitários de interface: loader, toast, ano do rodapé, helpers etc.

// =======================
// ELEMENTOS BASE
// =======================
const loaderEl = document.getElementById("appLoader");
const toastStack = document.getElementById("toastStack");
const yearEl = document.getElementById("year");

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// =======================
// LOADER
// =======================
export function showLoader() {
  try {
    loaderEl?.classList.remove("hidden");
  } catch (err) {
    console.warn("Loader não encontrado:", err);
  }
}

export function hideLoader() {
  try {
    loaderEl?.classList.add("hidden");
  } catch (err) {
    console.warn("Loader não encontrado:", err);
  }
}

// =======================
// TOASTS
// =======================
/**
 * Exibe um toast elegante
 * @param {string} message - Texto do toast
 * @param {"success"|"error"|"warn"|"info"} type
 * @param {number} timeout
 */
export function showToast(message, type = "success", timeout = 2800) {
  if (!toastStack) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastStack.appendChild(toast);

  // Remove suavemente
  const hide = () => {
    toast.style.animation = "toastOut .25s forwards ease-out";
    setTimeout(() => toast.remove(), 250);
  };

  setTimeout(hide, timeout);
}

// =======================
// HELPERS DE DATA
// =======================
export function formatDateLabel(dateStr, timeStr) {
  if (!dateStr) return "Sem prazo";

  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);

  if (isNaN(d.getTime())) return "Data inválida";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  return timeStr ? `${dd}/${mm} ${timeStr}` : `${dd}/${mm}`;
}

export function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

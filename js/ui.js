// js/ui.js
// Utilitários de interface: loader, toast, ano do rodapé etc.

const loaderEl = document.getElementById('appLoader');
const toastStack = document.getElementById('toastStack');
const yearEl = document.getElementById('year');

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

/* ========== LOADER ========== */
export function showLoader() {
  if (loaderEl) {
    loaderEl.classList.remove('hidden');
  }
}

export function hideLoader() {
  if (loaderEl) {
    loaderEl.classList.add('hidden');
  }
}

/* ========== TOASTS ========== */
export function showToast(message, type = 'success', timeout = 2800) {
  if (!toastStack) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastStack.appendChild(toast);

  const hide = () => {
    toast.style.animation = 'toastOut .25s forwards ease-out';
    setTimeout(() => {
      toast.remove();
    }, 250);
  };

  setTimeout(hide, timeout);
}

/* ========== HELPERS GERAIS ========== */
export function formatDateLabel(dateStr, timeStr) {
  if (!dateStr) return 'Sem prazo';

  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');

  if (timeStr) {
    return `${dia}/${mes} ${timeStr}`;
  }
  return `${dia}/${mes}`;
}

export function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// js/sw-register.js
// Registro simples do Service Worker

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => {
        console.error('Falha ao registrar service worker:', err);
      });
  });
}

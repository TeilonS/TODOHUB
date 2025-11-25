/* sw-register.js — registra o Service Worker */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => {
        console.log("SW registrado com sucesso:", reg.scope);
      })
      .catch((err) => {
        console.warn("Erro ao registrar SW:", err);
      });
  });
}
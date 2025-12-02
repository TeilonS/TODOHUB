// js/sw-register.js
// Registro oficial do Service Worker do TodoHub

const SW_PATH = "/sw.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH);

      console.log("✔ Service Worker registrado:", reg.scope);
    } catch (err) {
      console.error("❌ Erro ao registrar o Service Worker:", err);
    }
  });
}

/* sw.js — TodoHub Service Worker */

const CACHE_NAME = "todohub-v1";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",

  "/css/style.css",

  "/js/storage.js",
  "/js/theme.js",
  "/js/auth.js",
  "/js/ui.js",
  "/js/main.js",
  "/js/sw-register.js",

  "/assets/logo/LogoTodoHub.png"
];

/* INSTALAÇÃO */
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cache inicial adicionado!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

/* ATIVAÇÃO */
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker ativo!");

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

/* FETCH — offline first */
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match("/index.html")
        )
      );
    })
  );
});

/* ============================================================
   sw.js — TodoHub Service Worker Oficial
   Cache inteligente + compatível com Supabase + Sync futuro
   ============================================================ */

const CACHE_NAME = "todohub-v1.0";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",

  // CSS
  "/css/style.css",

  // JS
  "/js/storage.js",
  "/js/theme.js",
  "/js/auth.js",
  "/js/ui.js",
  "/js/main.js",
  "/js/sw-register.js",
  "/js/supabase.js",
  "/js/cloud-lists.js",
  "/js/cloud-realtime.js",

  // Assets
  "/assets/logo/LogoTodoHub.png"
];

/* ============================================================
   INSTALL
============================================================ */
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando…");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cache inicial carregado!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

/* ============================================================
   ACTIVATE
============================================================ */
self.addEventListener("activate", (event) => {
  console.log("[SW] Ativo!");

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

/* ============================================================
   FETCH — Cache First (com proteção Supabase)
============================================================ */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  const url = new URL(req.url);

  // 🚫 Nunca cachear requisições da API do Supabase
  if (url.origin.includes("supabase.co")) return;

  // 🚫 Não interceptar POST/PUT/PATCH/DELETE
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).catch(() => {
          if (req.mode === "navigate") return caches.match("/index.html");
        })
      );
    })
  );
});

/* ============================================================
   BACKGROUND SYNC
============================================================ */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    event.waitUntil(syncTasksWithServer());
  }
});

/* ============================================================
   Função futura para sincronização com servidor
============================================================ */
async function syncTasksWithServer() {
  console.log("🔄 Executando sincronização em background…");
  // Aqui conectaremos tasks locais → Supabase
}

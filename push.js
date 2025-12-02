// js/push.js
// Push Notifications – TodoHub

import { Supabase } from "./supabase.js";

export const Push = (() => {

  /* ---------------------------------------------
     Converte chave VAPID base64 → Uint8Array
  ---------------------------------------------- */
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; i++) {
      arr[i] = raw.charCodeAt(i);
    }
    return arr;
  }

  /* ---------------------------------------------
     Pede permissão ao usuário
  ---------------------------------------------- */
  async function askPermission() {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  /* ---------------------------------------------
     Inscreve usuário no Push
  ---------------------------------------------- */
  async function subscribeUser() {
    const allowed = await askPermission();
    if (!allowed) {
      console.warn("🚫 Usuário não permitiu notificações.");
      return;
    }

    const sw = await navigator.serviceWorker.ready;

    const key = urlBase64ToUint8Array(
      "BFDj7Hk4bZHQJ7j-yhQ7wN3mxFDZk-3VtX7E57t2Eet5Y5Wb3w_3j5KFEpliYg6OaToxLDuO8CQcTD_vLCC-7y8"
    );

    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key
    });

    const user = (await Supabase.client.auth.getUser()).data.user;

    await Supabase.client.from("webpush_subscriptions").insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: btoa(
        String.fromCharCode(
          ...new Uint8Array(subscription.getKey("p256dh"))
        )
      ),
      auth: btoa(
        String.fromCharCode(
          ...new Uint8Array(subscription.getKey("auth"))
        )
      )
    });

    console.log("🔔 Usuário inscrito no Push:", subscription);
  }

  return { subscribeUser };
})();


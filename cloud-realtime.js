// js/cloud-realtime.js
// Real-Time das tarefas no Supabase

import { Supabase } from "./supabase.js";

export const CloudRealtime = (() => {

  let channel = null;

  /**
   * Inicia listener p/ uma lista específica
   */
  function subscribe(listId, callback) {
    if (!listId) return;

    // Mata canal anterior (evita duplicações)
    if (channel) {
      Supabase.client.removeChannel(channel);
      channel = null;
    }

    channel = Supabase.client
      .channel(`tasks-list-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users_tasks",
          filter: `list_id=eq.${listId}`
        },
        payload => {
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("📡 Realtime conectado → Lista:", listId);
        }
      });
  }

  return { subscribe };
})();

/* ============================================================
   cloud-lists.js — Sincronização Híbrida (Local + Supabase)
   Mantém lógica original, corrigido e preparado para real-time
=============================================================== */

import { Supabase } from "./supabase.js";
import { UI } from "./ui.js";
import {
  loadLists,
  saveLists,
  loadCurrentListId,
  saveCurrentListId
} from "./storage.js";

export const CloudLists = (() => {

  /* -----------------------------------------------------------
     Busca todas as listas do usuário no Supabase
  ------------------------------------------------------------ */
  const loadFromCloud = async (userId) => {
    try {
      const { data, error } = await Supabase.client
        .from("users_lists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at");

      if (error) {
        console.warn("⚠ Erro ao carregar listas da nuvem:", error);
        UI.toast("Falha ao sincronizar listas. Modo offline!", "error");
        return null;
      }

      return data || [];

    } catch (e) {
      console.warn("⚠ Erro inesperado (cloud-lists load):", e);
      return null;
    }
  };

  /* -----------------------------------------------------------
     Cria nova lista no Supabase
  ------------------------------------------------------------ */
  const createCloudList = async (userId, list) => {
    try {
      const { error } = await Supabase.client
        .from("users_lists")
        .insert({
          id: list.id,
          user_id: userId,
          name: list.name,
          created_at: list.createdAt
        });

      if (error) {
        console.warn("⚠ Erro ao criar lista na nuvem:", error);
        UI.toast("Erro ao salvar lista na nuvem.", "error");
      }

    } catch (e) {
      console.warn("⚠ Erro inesperado ao criar lista:", e);
    }
  };

  /* -----------------------------------------------------------
     Sincronização Híbrida (Local → Nuvem → Local)
  ------------------------------------------------------------ */
  const initialSync = async (userId) => {
    const local = loadLists();
    const cloud = await loadFromCloud(userId);

    // Se nuvem OFFLINE → mantém local
    if (!cloud) {
      console.log("🌐 Supabase offline — usando listas locais");
      return local;
    }

    // 1) Cloud vazio → sobe tudo da máquina do usuário
    if (cloud.length === 0 && local.length > 0) {
      console.log("⬆ Subindo listas locais para a nuvem…");

      for (const list of local) {
        await createCloudList(userId, list);
      }

      return local;
    }

    // 2) Cloud tem dados → substitui o local
    if (cloud.length > 0) {
      console.log("⬇ Baixando listas da nuvem para o dispositivo…");

      const formatted = cloud.map(row => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at
      }));

      saveLists(formatted);

      // Se nenhuma lista ativa foi salva
      if (!loadCurrentListId() && formatted.length > 0) {
        saveCurrentListId(formatted[0].id);
      }

      return formatted;
    }

    // 3) Nenhum dado local + nenhum dado na nuvem
    return local;
  };

  return {
    initialSync,
    createCloudList,
  };

})();

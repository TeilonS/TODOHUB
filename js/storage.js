// storage.js — Versão FINAL (híbrida: Supabase + Offline)

import { Supabase } from "./supabase.js";
import { showToast } from "./ui.js";

/* ===========================================
   CONSTANTES LOCALSTORAGE
=========================================== */
const LS = {
  THEME: "todohub:theme",
  CURRENT_LIST: "todohub:currentList",
  OFFLINE_LISTS: "todohub:offline:lists",
  OFFLINE_TASKS: "todohub:offline:tasks:"
};

/* ===========================================
   HELPERS
=========================================== */
const safeJSON = (value, fallback) => {
  try { return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

const isOnline = () => navigator.onLine;

async function getUserId() {
  const { data } = await Supabase.client.auth.getUser();
  return data?.user?.id || null;
}

/* ===========================================
   EXPORT PRINCIPAL
=========================================== */
export const Storage = {

  /* ====================
       THEME
  ==================== */
  loadTheme() {
    return localStorage.getItem(LS.THEME) || "dark";
  },

  saveTheme(theme) {
    localStorage.setItem(LS.THEME, theme);
  },

  /* ====================
        LISTAS
  ==================== */

  async loadLists() {
    const userId = await getUserId();

    // Offline → usa cache local
    if (!userId || !isOnline()) {
      return safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
    }

    const { data, error } = await Supabase.client
      .from("users_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      showToast("Erro ao carregar listas (modo offline)", "warn");
      return safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
    }

    localStorage.setItem(LS.OFFLINE_LISTS, JSON.stringify(data));
    return data;
  },

  async saveList(name) {
    const userId = await getUserId();
    if (!userId) return null;

    // Se offline → salva local
    if (!isOnline()) {
      showToast("Sem internet — lista salva offline", "warn");

      const offline = safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
      const newList = {
        id: crypto.randomUUID(),
        name,
        user_id: userId,
        created_at: new Date().toISOString()
      };

      offline.push(newList);
      localStorage.setItem(LS.OFFLINE_LISTS, JSON.stringify(offline));

      return newList;
    }

    // Online → Supabase
    const { data, error } = await Supabase.client
      .from("users_lists")
      .insert({ name, user_id: userId })
      .select()
      .single();

    if (error) {
      showToast("Erro ao salvar lista", "error");
      return null;
    }

    return data;
  },

  saveCurrentListId(id) {
    localStorage.setItem(LS.CURRENT_LIST, id);
  },

  loadCurrentListId() {
    return localStorage.getItem(LS.CURRENT_LIST);
  },

  /* ====================
        TAREFAS
  ==================== */

  async loadTasks(listId) {
    if (!listId) return [];

    const userId = await getUserId();

    // Offline
    if (!userId || !isOnline()) {
      return safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
    }

    const { data, error } = await Supabase.client
      .from("users_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("list_id", listId)
      .order("created_at", { ascending: true });

    if (error) {
      showToast("Erro ao carregar tarefas (offline)", "warn");
      return safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
    }

    localStorage.setItem(LS.OFFLINE_TASKS + listId, JSON.stringify(data));
    return data;
  },

  async saveTask(listId, task) {
    const userId = await getUserId();
    if (!userId) return null;

    // Offline
    if (!isOnline()) {
      showToast("Offline — tarefa salva localmente", "warn");
      const offline = safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
      offline.push(task);
      localStorage.setItem(LS.OFFLINE_TASKS + listId, JSON.stringify(offline));
      return task;
    }

    // Online → Supabase
    const { data, error } = await Supabase.client
      .from("users_tasks")
      .insert({
        ...task,
        user_id: userId,
        list_id: listId
      })
      .select()
      .single();

    if (error) {
      showToast("Erro ao salvar tarefa", "error");
      return null;
    }

    return data;
  },

  async updateTask(taskId, patch) {
    if (!isOnline()) {
      showToast("Offline — edição pendente", "warn");
      return;
    }

    const { error } = await Supabase.client
      .from("users_tasks")
      .update(patch)
      .eq("id", taskId);

    if (error) showToast("Erro ao atualizar", "error");
  },

  async deleteTask(taskId) {
    if (!isOnline()) {
      showToast("Offline — exclusão pendente", "warn");
      return;
    }

    const { error } = await Supabase.client
      .from("users_tasks")
      .delete()
      .eq("id", taskId);

    if (error) showToast("Erro ao excluir", "error");
  }
};

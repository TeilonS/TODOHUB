// storage.js — versão híbrida (Supabase + localStorage fallback)

import { Supabase } from "./supabase.js";
import { Auth } from "./auth.js";
import { UI } from "./ui.js";

const LS = {
  THEME: "todohub:theme",
  CURRENT_LIST: "todohub:currentList",
  OFFLINE_LISTS: "todohub:offline:lists",
  OFFLINE_TASKS: "todohub:offline:tasks:"
};

/* ===========================================
   Funções utilitárias
=========================================== */
const safeJSON = (value, fallback) => {
  try { return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

const isOnline = () => navigator.onLine;

/* ===========================================
   TEMA
=========================================== */
export const Storage = {

  /* ---------------- TEMA ---------------- */
  loadTheme() {
    return localStorage.getItem(LS.THEME) || "dark";
  },

  saveTheme(theme) {
    localStorage.setItem(LS.THEME, theme);
  },


  /* ===========================================
      LISTAS — SUPABASE + OFFLINE
  ============================================ */

  async loadLists() {
    const user = await Auth.getUser?.();
    if (!user || !isOnline()) {
      return safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
    }

    const { data, error } = await Supabase.client
      .from("lists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      UI.toast("Erro ao carregar listas (offline mode)", "warn");
      return safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
    }

    // cache local para offline
    localStorage.setItem(LS.OFFLINE_LISTS, JSON.stringify(data));
    return data;
  },

  async saveList(name) {
    const user = await Auth.getUser?.();
    if (!user) return null;

    if (!isOnline()) {
      UI.toast("Sem internet — lista salva offline", "warn");
      const offline = safeJSON(localStorage.getItem(LS.OFFLINE_LISTS), []);
      const newList = { id: crypto.randomUUID(), name, user_id: user.id };
      offline.push(newList);
      localStorage.setItem(LS.OFFLINE_LISTS, JSON.stringify(offline));
      return newList;
    }

    const { data, error } = await Supabase.client
      .from("lists")
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (error) {
      UI.toast("Erro ao salvar lista", "error");
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


  /* ===========================================
      TAREFAS — SUPABASE + OFFLINE
  ============================================ */

  async loadTasks(listId) {
    if (!listId) return [];

    const user = await Auth.getUser?.();
    if (!user || !isOnline()) {
      return safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
    }

    const { data, error } = await Supabase.client
      .from("tasks")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: true });

    if (error) {
      UI.toast("Erro ao carregar tarefas (offline mode)", "warn");
      return safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
    }

    // cache
    localStorage.setItem(LS.OFFLINE_TASKS + listId, JSON.stringify(data));
    return data;
  },

  async saveTask(listId, task) {
    const user = await Auth.getUser?.();
    if (!user) return null;

    if (!isOnline()) {
      UI.toast("Sem internet — tarefa salva offline", "warn");
      const offline = safeJSON(localStorage.getItem(LS.OFFLINE_TASKS + listId), []);
      offline.push(task);
      localStorage.setItem(LS.OFFLINE_TASKS + listId, JSON.stringify(offline));
      return task;
    }

    const { data, error } = await Supabase.client
      .from("tasks")
      .insert({
        ...task,
        list_id: listId,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      UI.toast("Erro ao salvar tarefa", "error");
      return null;
    }

    return data;
  },

  async updateTask(id, patch) {
    if (!isOnline()) {
      UI.toast("Sem internet — edição salva offline", "warn");
      return;
    }

    const { error } = await Supabase.client
      .from("tasks")
      .update(patch)
      .eq("id", id);

    if (error) UI.toast("Erro ao atualizar tarefa", "error");
  },

  async deleteTask(id) {
    if (!isOnline()) {
      UI.toast("Sem conexão — exclusão pendente", "warn");
      return;
    }

    const { error } = await Supabase.client
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) UI.toast("Erro ao excluir", "error");
  }

};


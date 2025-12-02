// js/cloud-tasks.js
// Sincronização de tarefas com Supabase (tabela users_tasks)

import { Supabase } from "./supabase.js";
import { UI } from "./ui.js";

export const CloudTasks = (() => {
  const TABLE = "users_tasks";

  async function getUserId() {
    try {
      const { data } = await Supabase.client.auth.getUser();
      return data?.user?.id || null;
    } catch (e) {
      console.warn("⚠ Erro ao obter usuário logado (CloudTasks):", e);
      return null;
    }
  }

  function mapRowToTask(row) {
    return {
      id: row.id,
      text: row.text,
      done: row.done,
      priority: row.priority || "medium",
      tags: row.tags || [],
      dueDate: row.due_date || null,
      dueTime: row.due_time || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subtasks: row.subtasks || []
    };
  }

  function mapTaskToRow(userId, listId, task) {
    return {
      id: task.id,
      user_id: userId,
      list_id: listId,
      text: task.text,
      done: task.done,
      priority: task.priority || "medium",
      tags: task.tags || [],
      due_date: task.dueDate,
      due_time: task.dueTime,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      subtasks: task.subtasks || []
    };
  }

  // ----- Sync inicial (local + nuvem) -----
  async function initialSyncTasks(listId, localTasks) {
    const userId = await getUserId();
    if (!userId) {
      console.log("🌐 Sem usuário logado — tarefas somente locais.");
      return localTasks; // modo offline/sem login
    }

    try {
      const { data, error } = await Supabase.client
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("⚠ Erro ao buscar tarefas na nuvem:", error);
        UI.toast("Falha ao sincronizar tarefas. Usando dados locais.", "error");
        return localTasks;
      }

      const remoteTasks = (data || []).map(mapRowToTask);

      // Merge simples: id igual → mantém o mais recente; senão, soma.
      const byId = new Map();

      (localTasks || []).forEach(t => {
        byId.set(t.id, t);
      });

      remoteTasks.forEach(rt => {
        const lt = byId.get(rt.id);
        if (!lt) {
          byId.set(rt.id, rt);
        } else {
          const ltTime = new Date(lt.updatedAt || lt.createdAt || 0).getTime();
          const rtTime = new Date(rt.updatedAt || rt.createdAt || 0).getTime();
          byId.set(rt.id, rtTime > ltTime ? rt : lt);
        }
      });

      const merged = Array.from(byId.values()).sort((a, b) =>
        (a.createdAt || "").localeCompare(b.createdAt || "")
      );

      // Sobe tudo que for novo/atualizado pro Supabase (upsert em lote)
      try {
        if (merged.length) {
          const rows = merged.map(t => mapTaskToRow(userId, listId, t));
          const { error: upErr } = await Supabase.client
            .from(TABLE)
            .upsert(rows, { onConflict: "id" });

          if (upErr) {
            console.warn("⚠ Erro ao upsert tarefas na sync inicial:", upErr);
          }
        }
      } catch (e) {
        console.warn("⚠ Erro inesperado na sync inicial de tarefas:", e);
      }

      return merged;
    } catch (e) {
      console.warn("⚠ Erro geral em initialSyncTasks:", e);
      return localTasks;
    }
  }

  // ----- Upsert (1 ou muitas tarefas) -----
  async function upsertTasks(listId, tasks) {
    const userId = await getUserId();
    if (!userId) return;

    if (!tasks || !tasks.length) return;

    try {
      const rows = tasks.map(t => mapTaskToRow(userId, listId, t));

      const { error } = await Supabase.client
        .from(TABLE)
        .upsert(rows, { onConflict: "id" });

      if (error) {
        console.warn("⚠ Erro ao salvar tarefas na nuvem:", error);
        UI.toast("Erro ao salvar tarefas na nuvem.", "error");
      }
    } catch (e) {
      console.warn("⚠ Erro inesperado em upsertTasks:", e);
    }
  }

  // ----- Delete por IDs -----
  async function deleteTasks(listId, ids) {
    const userId = await getUserId();
    if (!userId || !ids || !ids.length) return;

    try {
      const { error } = await Supabase.client
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("list_id", listId)
        .in("id", ids);

      if (error) {
        console.warn("⚠ Erro ao deletar tarefas na nuvem:", error);
        UI.toast("Erro ao excluir tarefas na nuvem.", "error");
      }
    } catch (e) {
      console.warn("⚠ Erro inesperado em deleteTasks:", e);
    }
  }

  return {
    initialSyncTasks,
    upsertTasks,
    deleteTasks
  };
})();

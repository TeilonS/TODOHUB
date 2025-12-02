// js/main.js
// Core do TodoHub: listas, tarefas, filtros, bulk actions, exportação etc.

import {
  loadLists,
  saveLists,
  loadCurrentListId,
  saveCurrentListId,
  loadTasks,
  saveTasks
} from "./storage.js";

import {
  showToast,
  formatDateLabel,
  todayISODate
} from "./ui.js";

import { CloudLists } from "./cloud-lists.js";
import { CloudTasks } from "./cloud-tasks.js";
import { Supabase } from "./supabase.js";
import { CloudRealtime } from "./cloud-realtime.js";

/* ========== ESTADO GLOBAL ========== */
let lists = [];
let currentListId = null;
let tasks = [];

let stateFilter = "all";
let priorityFilter = "all";
let tagFilter = null;
let searchQuery = "";
let selectionMode = false;
let selectedIds = new Set();

/* ========== ELEMENTOS DOM ========== */

// Sidebar
const sidebarEl = document.getElementById("sidebar");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const listContainerEl = document.getElementById("listContainer");
const newListBtn = document.getElementById("newListBtn");

// Stats
const totalCountEl = document.getElementById("totalCount");
const activeCountEl = document.getElementById("activeCount");
const doneCountEl = document.getElementById("doneCount");
const donePercentBarEl = document.getElementById("donePercentBar");
const donePercentLabelEl = document.getElementById("donePercentLabel");
const overdueCountEl = document.getElementById("overdueCount");
const todayCountEl = document.getElementById("todayCount");

// Add task
const taskInputEl = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const priorityPickerEl = document.getElementById("priorityPicker");

// Filters / Search
const filtersContainerEl = document.querySelector(".filters");
const searchInputEl = document.getElementById("searchInput");

// Extra actions
const clearDoneBtn = document.getElementById("clearDoneBtn");
const selectionModeBtn = document.getElementById("selectionModeBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const importJsonInput = document.getElementById("importJsonInput");

// Bulk bar
const bulkBarEl = document.getElementById("bulkBar");
const bulkCountEl = document.getElementById("bulkCount");
const bulkExitBtn = document.getElementById("bulkExitBtn");
const bulkDoneBtn = document.getElementById("bulkDoneBtn");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const bulkPrioButtons = document.querySelectorAll(".bulk-prio");

// Task list
const taskListEl = document.getElementById("taskList");
const emptyStateEl = document.getElementById("emptyState");

// Edit modal
const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editTextEl = document.getElementById("editText");
const editPriorityPicker = document.getElementById("editPriorityPicker");
const editTagsEl = document.getElementById("editTags");
const editDueDateEl = document.getElementById("editDueDate");
const editDueTimeEl = document.getElementById("editDueTime");
const subtasksListEl = document.getElementById("subtasksList");
const newSubtaskTextEl = document.getElementById("newSubtaskText");
const addSubtaskBtn = document.getElementById("addSubtaskBtn");

let newTaskPriority = "medium";
let editTaskPriority = "medium";
let editSubtasks = [];
let currentEditTaskId = null;

/* ========== HELPERS ========== */

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function findCurrentList() {
  return lists.find((l) => l.id === currentListId) || null;
}

/**
 * Reage às mudanças Realtime (INSERT / UPDATE / DELETE)
 * vindo da tabela users_tasks (Supabase Realtime)
 */
function applyRealtimeChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (!currentListId || (newRow && newRow.list_id !== currentListId)) {
    // evento de outra lista → ignora
    return;
  }

  if (eventType === "INSERT") {
    const exists = tasks.some((t) => t.id === newRow.id);
    if (!exists) {
      const t = {
        id: newRow.id,
        text: newRow.text,
        done: newRow.done,
        priority: newRow.priority || "medium",
        tags: newRow.tags || [],
        dueDate: newRow.due_date || null,
        dueTime: newRow.due_time || null,
        createdAt: newRow.created_at,
        updatedAt: newRow.updated_at,
        subtasks: newRow.subtasks || []
      };
      tasks.push(t);
      saveTasks(currentListId, tasks);
      renderTasks();
      updateStats();
    }
  }

  if (eventType === "UPDATE") {
    tasks = tasks.map((t) =>
      t.id === newRow.id
        ? {
            id: newRow.id,
            text: newRow.text,
            done: newRow.done,
            priority: newRow.priority || "medium",
            tags: newRow.tags || [],
            dueDate: newRow.due_date || null,
            dueTime: newRow.due_time || null,
            createdAt: newRow.created_at,
            updatedAt: newRow.updated_at,
            subtasks: newRow.subtasks || []
          }
        : t
    );
    saveTasks(currentListId, tasks);
    renderTasks();
    updateStats();
  }

  if (eventType === "DELETE") {
    tasks = tasks.filter((t) => t.id !== oldRow.id);
    saveTasks(currentListId, tasks);
    renderTasks();
    updateStats();
  }
}

/* ========== LISTAS + TAREFAS (SYNC INICIAL) ========== */

async function ensureListsAndTasks() {
  const session = await Supabase.client.auth.getUser();
  const user = session?.data?.user;

  // Modo totalmente offline (sem usuário)
  if (!user) {
    lists = loadLists() || [];

    if (!Array.isArray(lists) || lists.length === 0) {
      const defaultList = {
        id: uuid(),
        name: "Minha lista",
        createdAt: new Date().toISOString()
      };
      lists = [defaultList];
      saveLists(lists);
      saveCurrentListId(defaultList.id);
      currentListId = defaultList.id;
    } else {
      currentListId = loadCurrentListId() || lists[0].id;
      saveCurrentListId(currentListId);
    }

    tasks = loadTasks(currentListId) || [];
    return;
  }

  // Usuário logado → sincroniza listas com Supabase
  lists = await CloudLists.initialSync(user.id);

  if (!Array.isArray(lists) || lists.length === 0) {
    const defaultList = {
      id: uuid(),
      name: "Minha lista",
      createdAt: new Date().toISOString()
    };
    lists = [defaultList];
    saveLists(lists);
    await CloudLists.createCloudList(user.id, defaultList);
  }

  currentListId = loadCurrentListId() || lists[0].id;
  saveCurrentListId(currentListId);

  // Tarefas: merge local + nuvem
  const localTasks = loadTasks(currentListId) || [];
  tasks = await CloudTasks.initialSyncTasks(currentListId, localTasks);
  saveTasks(currentListId, tasks);

  // Realtime para essa lista
  CloudRealtime.subscribe(currentListId, applyRealtimeChange);
}

/* ========== SIDEBAR / LISTAS ========== */

async function initSidebar() {
  await ensureListsAndTasks();
  renderSidebar();

  if (openSidebarBtn) {
    openSidebarBtn.addEventListener("click", () => {
      sidebarEl.classList.add("open");
    });
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
      sidebarEl.classList.remove("open");
    });
  }

  if (listContainerEl) {
    listContainerEl.addEventListener("click", async (e) => {
      const item = e.target.closest(".sidebar-item");
      if (!item) return;

      const id = item.dataset.id;
      if (!id || id === currentListId) return;

      currentListId = id;
      saveCurrentListId(id);
      selectedIds.clear();

      // Carrega tarefas dessa lista (local + nuvem)
      const localTasks = loadTasks(currentListId) || [];
      tasks = await CloudTasks.initialSyncTasks(currentListId, localTasks);
      saveTasks(currentListId, tasks);

      // Troca assinatura realtime para nova lista
      CloudRealtime.subscribe(currentListId, applyRealtimeChange);

      renderSidebar();
      renderTasks();
      updateStats();
      showToast("Lista alterada.", "success");

      sidebarEl.classList.remove("open");
    });
  }

  if (newListBtn) {
    newListBtn.addEventListener("click", async () => {
      const name = prompt("Nome da nova lista:");
      if (!name) return;

      const newList = {
        id: uuid(),
        name: name.trim(),
        createdAt: new Date().toISOString()
      };

      lists.push(newList);
      saveLists(lists);

      const session = await Supabase.client.auth.getUser();
      const user = session?.data?.user;
      if (user) {
        await CloudLists.createCloudList(user.id, newList);
      }

      currentListId = newList.id;
      saveCurrentListId(currentListId);

      tasks = [];
      saveTasks(currentListId, tasks);

      CloudRealtime.subscribe(currentListId, applyRealtimeChange);

      renderSidebar();
      renderTasks();
      updateStats();

      showToast("Lista criada com sucesso!", "success");
    });
  }
}

function renderSidebar() {
  if (!listContainerEl) return;

  listContainerEl.innerHTML = "";

  lists.forEach((list) => {
    const li = document.createElement("li");
    li.className =
      "sidebar-item" + (list.id === currentListId ? " active" : "");
    li.dataset.id = list.id;
    li.textContent = list.name;
    listContainerEl.appendChild(li);
  });
}

/* ========== PRIORITY PICKER ========== */

function setPriorityActive(container, value) {
  if (!container) return;
  container.querySelectorAll(".prio-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.priority === value);
  });
}

function initPriorityPicker() {
  if (!priorityPickerEl) return;

  setPriorityActive(priorityPickerEl, newTaskPriority);

  priorityPickerEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".prio-btn");
    if (!btn) return;

    newTaskPriority = btn.dataset.priority;
    setPriorityActive(priorityPickerEl, newTaskPriority);
  });

  if (editPriorityPicker) {
    editPriorityPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".prio-btn");
      if (!btn) return;

      editTaskPriority = btn.dataset.priority;
      setPriorityActive(editPriorityPicker, editTaskPriority);
    });
  }
}

/* ========== TAREFAS: ADIÇÃO ========== */

async function addTask() {
  const text = taskInputEl?.value.trim();
  if (!text) return showToast("Digite uma tarefa.", "warn");

  const now = new Date().toISOString();

  const task = {
    id: uuid(),
    text,
    done: false,
    priority: newTaskPriority,
    createdAt: now,
    updatedAt: now,
    dueDate: null,
    dueTime: null,
    tags: [],
    subtasks: []
  };

  tasks.push(task);
  saveTasks(currentListId, tasks);

  // Sincroniza com Supabase (quando logado)
  await CloudTasks.upsertTasks(currentListId, [task]);

  taskInputEl.value = "";

  renderTasks();
  updateStats();
  showToast("Tarefa adicionada!", "success");
}

function initTaskForm() {
  addTaskBtn?.addEventListener("click", () => {
    addTask();
  });

  taskInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });
}

/* ========== FILTROS / BUSCA ========== */

function initFilters() {
  filtersContainerEl?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;

    if (chip.dataset.filterState) {
      stateFilter = chip.dataset.filterState;

      filtersContainerEl.querySelectorAll(".chip").forEach((c) => {
        if (c.dataset.filterState) {
          c.classList.toggle("active", c === chip);
        }
      });
    }

    if (chip.dataset.filterPriority) {
      const prio = chip.dataset.filterPriority;

      if (priorityFilter === prio) {
        priorityFilter = "all";
        chip.classList.remove("active");
      } else {
        priorityFilter = prio;

        filtersContainerEl
          .querySelectorAll(".chip.prio-chip")
          .forEach((c) => c.classList.toggle("active", c === chip));
      }
    }

    renderTasks();
  });

  searchInputEl?.addEventListener("input", () => {
    searchQuery = searchInputEl.value.trim().toLowerCase();
    renderTasks();
  });
}

/* ========== BULK MODE ========== */

function updateBulkBar() {
  if (!bulkBarEl) return;

  if (!selectionMode) {
    bulkBarEl.classList.add("hidden");
    bulkCountEl.textContent = "0 tarefas selecionadas";
    return;
  }

  bulkBarEl.classList.remove("hidden");

  const count = selectedIds.size;
  bulkCountEl.textContent = `${count} tarefa${
    count === 1 ? "" : "s"
  } selecionada${count === 1 ? "" : "s"}`;
}

function toggleSelectionMode(forceValue) {
  selectionMode =
    typeof forceValue === "boolean" ? forceValue : !selectionMode;

  if (!selectionMode) selectedIds.clear();

  updateBulkBar();
  renderTasks();
}

function initBulkActions() {
  selectionModeBtn?.addEventListener("click", () => toggleSelectionMode());

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "s" && e.shiftKey) {
      e.preventDefault();
      toggleSelectionMode();
      showToast(
        `Modo seleção: ${selectionMode ? "ativado" : "desativado"}`,
        "success"
      );
    }
  });

  bulkExitBtn?.addEventListener("click", () => toggleSelectionMode(false));

  bulkDoneBtn?.addEventListener("click", async () => {
    if (!selectedIds.size) return;

    const now = new Date().toISOString();
    const changed = [];

    tasks = tasks.map((t) => {
      if (selectedIds.has(t.id)) {
        const nt = { ...t, done: true, updatedAt: now };
        changed.push(nt);
        return nt;
      }
      return t;
    });

    saveTasks(currentListId, tasks);
    await CloudTasks.upsertTasks(currentListId, changed);

    selectedIds.clear();
    updateBulkBar();
    renderTasks();
    updateStats();
  });

  bulkDeleteBtn?.addEventListener("click", async () => {
    if (!selectedIds.size) return;
    if (!confirm("Excluir todas as tarefas selecionadas?")) return;

    const idsToDelete = Array.from(selectedIds);

    tasks = tasks.filter((t) => !selectedIds.has(t.id));
    saveTasks(currentListId, tasks);
    await CloudTasks.deleteTasks(currentListId, idsToDelete);

    selectedIds.clear();
    updateBulkBar();
    renderTasks();
    updateStats();
  });

  bulkPrioButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const prio = btn.dataset.bulkPriority;
      if (!prio || !selectedIds.size) return;

      const now = new Date().toISOString();
      const changed = [];

      tasks = tasks.map((t) => {
        if (selectedIds.has(t.id)) {
          const nt = { ...t, priority: prio, updatedAt: now };
          changed.push(nt);
          return nt;
        }
        return t;
      });

      saveTasks(currentListId, tasks);
      await CloudTasks.upsertTasks(currentListId, changed);

      renderTasks();
      updateStats();
    });
  });
}

/* ========== EDIÇÃO DE TAREFA / SUBTAREFAS ========== */

function renderSubtasks() {
  subtasksListEl.innerHTML = "";

  if (!editSubtasks.length) return;

  editSubtasks.forEach((st) => {
    const li = document.createElement("li");
    li.className = "subtask-item" + (st.done ? " done" : "");
    li.dataset.id = st.id;

    li.innerHTML = `
      <input type="checkbox" ${
        st.done ? "checked" : ""
      } data-action="toggle-subtask">
      <span>${st.text}</span>
      <button type="button" data-action="remove-subtask">✖</button>
    `;

    subtasksListEl.appendChild(li);
  });
}

function openEditModal(task) {
  if (!editDialog) return;

  currentEditTaskId = task.id;
  editTextEl.value = task.text;
  editTagsEl.value = (task.tags || []).join(", ");
  editDueDateEl.value = task.dueDate || "";
  editDueTimeEl.value = task.dueTime || "";
  editTaskPriority = task.priority || "medium";
  setPriorityActive(editPriorityPicker, editTaskPriority);

  editSubtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
  renderSubtasks();
  editDialog.showModal();
}

function initEditModal() {
  if (!editDialog || !editForm) return;

  addSubtaskBtn?.addEventListener("click", () => {
    const text = newSubtaskTextEl.value.trim();
    if (!text) return;

    editSubtasks.push({
      id: uuid(),
      text,
      done: false
    });

    newSubtaskTextEl.value = "";
    renderSubtasks();
  });

  subtasksListEl?.addEventListener("click", (e) => {
    const li = e.target.closest(".subtask-item");
    if (!li) return;

    const id = li.dataset.id;
    if (!id) return;

    if (e.target.dataset.action === "remove-subtask") {
      editSubtasks = editSubtasks.filter((st) => st.id !== id);
      renderSubtasks();
    }
  });

  subtasksListEl?.addEventListener("change", (e) => {
    const li = e.target.closest(".subtask-item");
    if (!li) return;

    const id = li.dataset.id;

    if (e.target.dataset.action === "toggle-subtask") {
      editSubtasks = editSubtasks.map((st) =>
        st.id === id ? { ...st, done: e.target.checked } : st
      );
      renderSubtasks();
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditTaskId) return;

    const text = editTextEl.value.trim();
    if (!text) return showToast("A tarefa precisa de um texto.", "warn");

    const tags = editTagsEl.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const dueDate = editDueDateEl.value || null;
    const dueTime = editDueTimeEl.value || null;
    const now = new Date().toISOString();

    let updatedTask = null;

    tasks = tasks.map((t) => {
      if (t.id === currentEditTaskId) {
        const nt = {
          ...t,
          text,
          priority: editTaskPriority,
          tags,
          dueDate,
          dueTime,
          subtasks: editSubtasks,
          updatedAt: now
        };
        updatedTask = nt;
        return nt;
      }
      return t;
    });

    saveTasks(currentListId, tasks);
    if (updatedTask) {
      await CloudTasks.upsertTasks(currentListId, [updatedTask]);
    }

    editDialog.close();
    currentEditTaskId = null;
    renderTasks();
    updateStats();
  });

  editDialog.addEventListener("close", () => {
    currentEditTaskId = null;
  });
}

/* ========== RENDERIZAÇÃO DAS TAREFAS ========== */

function getFilteredTasks() {
  let filtered = [...tasks];

  if (stateFilter === "active") filtered = filtered.filter((t) => !t.done);
  if (stateFilter === "done") filtered = filtered.filter((t) => t.done);

  if (priorityFilter !== "all") {
    filtered = filtered.filter((t) => t.priority === priorityFilter);
  }

  if (tagFilter) {
    filtered = filtered.filter((t) => (t.tags || []).includes(tagFilter));
  }

  if (searchQuery) {
    filtered = filtered.filter(
      (t) =>
        t.text.toLowerCase().includes(searchQuery) ||
        (t.tags || []).some((tag) =>
          tag.toLowerCase().includes(searchQuery)
        )
    );
  }

  return filtered;
}

function renderTasks() {
  if (!taskListEl || !emptyStateEl) return;

  const filtered = getFilteredTasks();

  if (!filtered.length) {
    taskListEl.innerHTML = "";
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";

  const today = todayISODate();

  taskListEl.innerHTML = filtered
    .map((task) => {
      const prioClass =
        task.priority === "high"
          ? "priority-high"
          : task.priority === "low"
          ? "priority-low"
          : "priority-medium";

      const doneClass = task.done ? "done" : "";

      const overdue =
        !task.done && task.dueDate && task.dueDate < today;

      const tagsHtml = (task.tags || [])
        .map(
          (tag) => `<span class="tag-chip" data-tag="${tag}">${tag}</span>`
        )
        .join("");

      const subtasks = task.subtasks || [];
      const subtasksInfo = subtasks.length
        ? `<span>📌 ${
            subtasks.filter((s) => s.done).length
          }/${subtasks.length} subtarefas</span>`
        : "";

      const dueLabel = formatDateLabel(task.dueDate, task.dueTime);

      const selectedClass =
        selectionMode && selectedIds.has(task.id) ? "selected" : "";

      return `
        <li class="item ${prioClass} ${doneClass} ${selectedClass}" data-id="${task.id}">
          <input type="checkbox" class="task-toggle" ${
            task.done ? "checked" : ""
          }>
          
          <div class="item-main">
            <div class="item-text">${task.text}</div>

            <div class="item-meta">
              <span>
                <span class="priority-badge ${task.priority}"></span>
                ${
                  task.priority === "high"
                    ? "Alta"
                    : task.priority === "low"
                    ? "Baixa"
                    : "Média"
                }
              </span>

              <span>📅 ${dueLabel}</span>

              ${overdue ? `<span>⚠️ Atrasada</span>` : ""}
              ${subtasksInfo}
            </div>

            ${tagsHtml ? `<div class="tag-list">${tagsHtml}</div>` : ""}
          </div>

          <div class="item-actions">
            ${
              selectionMode
                ? `<button class="icon" data-action="select">☑</button>`
                : ""
            }
            <button class="icon" data-action="edit">✏️</button>
            <button class="icon danger" data-action="delete">🗑</button>
          </div>
        </li>
      `;
    })
    .join("");
}

/* ========== EVENTOS NA LISTA ========== */

function initTaskListEvents() {
  if (!taskListEl) return;

  taskListEl.addEventListener("change", async (e) => {
    const checkbox = e.target.closest(".task-toggle");
    if (!checkbox) return;

    const item = checkbox.closest(".item");
    const id = item.dataset.id;
    const now = new Date().toISOString();
    let updatedTask = null;

    tasks = tasks.map((t) => {
      if (t.id === id) {
        const nt = { ...t, done: checkbox.checked, updatedAt: now };
        updatedTask = nt;
        return nt;
      }
      return t;
    });

    saveTasks(currentListId, tasks);
    if (updatedTask) {
      await CloudTasks.upsertTasks(currentListId, [updatedTask]);
    }

    renderTasks();
    updateStats();
  });

  taskListEl.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    const item = button.closest(".item");
    const id = item.dataset.id;
    const action = button.dataset.action;

    if (!id || !action) return;

    if (action === "delete") {
      if (!confirm("Excluir esta tarefa?")) return;

      tasks = tasks.filter((t) => t.id !== id);
      saveTasks(currentListId, tasks);
      await CloudTasks.deleteTasks(currentListId, [id]);

      selectedIds.delete(id);

      renderTasks();
      updateStats();
      showToast("Tarefa excluída.", "success");
      return;
    }

    if (action === "edit") {
      const task = tasks.find((t) => t.id === id);
      if (task) openEditModal(task);
      return;
    }

    if (action === "select") {
      if (!selectionMode) return;

      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);

      updateBulkBar();
      renderTasks();
    }
  });

  // Filtro por tag
  taskListEl.addEventListener("click", (e) => {
    const tagChip = e.target.closest(".tag-chip");
    if (!tagChip) return;

    const tag = tagChip.dataset.tag;

    if (tagFilter === tag) {
      tagFilter = null;
      showToast("Filtro de tag removido.");
    } else {
      tagFilter = tag;
      showToast(`Filtrando pela tag: ${tag}`);
    }

    renderTasks();
  });
}

/* ========== STATS ========== */

function updateStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const active = total - done;
  const today = todayISODate();

  const todayCount = tasks.filter(
    (t) => (t.createdAt || "").slice(0, 10) === today
  ).length;

  const overdueCount = tasks.filter(
    (t) => !t.done && t.dueDate && t.dueDate < today
  ).length;

  totalCountEl.textContent = total;
  doneCountEl.textContent = done;
  activeCountEl.textContent = active;
  overdueCountEl.textContent = overdueCount;
  todayCountEl.textContent = todayCount;

  const percent = total ? Math.round((done / total) * 100) : 0;

  donePercentLabelEl.textContent = percent + "%";
  donePercentBarEl.style.width = percent + "%";
}

/* ========== CLEAR DONE ========== */

function initClearDone() {
  clearDoneBtn?.addEventListener("click", async () => {
    if (!tasks.some((t) => t.done)) {
      showToast("Não há tarefas concluídas para limpar.");
      return;
    }

    if (!confirm("Remover todas as tarefas concluídas?")) return;

    const idsDone = tasks.filter((t) => t.done).map((t) => t.id);

    tasks = tasks.filter((t) => !t.done);
    saveTasks(currentListId, tasks);
    await CloudTasks.deleteTasks(currentListId, idsDone);

    renderTasks();
    updateStats();
  });
}

/* ========== EXPORTAÇÃO / IMPORTAÇÃO ========== */

function tasksToPlainObjects() {
  return tasks.map((t) => ({
    id: t.id,
    text: t.text,
    done: t.done,
    priority: t.priority,
    tags: (t.tags || []).join(", "),
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }));
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function initExportImport() {
  exportJsonBtn?.addEventListener("click", () => {
    const data = { listId: currentListId, tasks };
    const str = JSON.stringify(data, null, 2);
    downloadFile(`todohub-${todayISODate()}.json`, str);
  });

  exportCsvBtn?.addEventListener("click", () => {
    const plain = tasksToPlainObjects();
    if (!plain.length) return showToast("Nenhuma tarefa para exportar.");

    const headers = Object.keys(plain[0]);
    const rows = plain.map((obj) =>
      headers
        .map(
          (h) => `"${String(obj[h] ?? "").replace(/"/g, '""')}"`
        )
        .join(";")
    );

    const csv = [headers.join(";"), ...rows].join("\n");
    downloadFile(
      `todohub-${todayISODate()}.csv`,
      csv,
      "text/csv"
    );
  });

  exportExcelBtn?.addEventListener("click", () => {
    if (typeof XLSX === "undefined")
      return showToast("Biblioteca XLSX não carregada.");

    const plain = tasksToPlainObjects();
    const ws = XLSX.utils.json_to_sheet(plain);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
    XLSX.writeFile(wb, `todohub-${todayISODate()}.xlsx`);
  });

  importJsonInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        let importedTasks = Array.isArray(parsed)
          ? parsed
          : parsed.tasks;

        importedTasks = importedTasks.map((t) => ({
          id: t.id || uuid(),
          text: t.text || "",
          done: !!t.done,
          priority: t.priority || "medium",
          tags: Array.isArray(t.tags)
            ? t.tags
            : typeof t.tags === "string"
            ? t.tags.split(",").map((v) => v.trim())
            : [],
          dueDate: t.dueDate || null,
          dueTime: t.dueTime || null,
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || new Date().toISOString(),
          subtasks: Array.isArray(t.subtasks) ? t.subtasks : []
        }));

        tasks = importedTasks;
        saveTasks(currentListId, tasks);

        await CloudTasks.upsertTasks(currentListId, tasks);

        renderTasks();
        updateStats();
        showToast("Tarefas importadas com sucesso.");
      } catch {
        showToast("Erro ao importar JSON.");
      } finally {
        e.target.value = "";
      }
    };

    reader.readAsText(file);
  });
}

/* ========== INICIALIZAÇÃO GERAL ========== */

async function initApp() {
  await initSidebar();
  initPriorityPicker();
  initTaskForm();
  initFilters();
  initBulkActions();
  initEditModal();
  initTaskListEvents();
  initClearDone();
  initExportImport();

  renderTasks();
  updateStats();
}

/* ========== API PARA O AUTH.JS ========== */

export const Main = {
  reloadForUser() {
    window.location.reload();
  }
};

initApp();


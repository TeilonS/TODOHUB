// main.js — CRUD, filtros, busca, prioridades, datas, tags, subtarefas,
// drag & drop, export, seleção múltipla, notificações locais, multiusuário

import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Theme } from "./theme.js";
import { Auth } from "./auth.js";

let currentPriority = "medium"; // prioridade padrão

/* ------------------ LOADER ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("appLoader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 250);
});

export const Main = (() => {

  let tasks = [];

  let filterState = "all";      // all | active | done
  let filterPriority = null;    // high | medium | low | null
  let activeTag = null;         // string ou null
  let search = "";

  // seleção múltipla
  let selectionMode = false;
  let selectedIds = new Set();

  // edição
  let draggedId = null;
  let editingTaskId = null;

  // notificações
  const notificationTimers = {};

  const toast = (msg, type = "success") => UI.toast(msg, type);

  /* ------------------ HELPERS ------------------ */

  const normalize = (s) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const formatDate = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const isSameDay = (ts, ref = Date.now()) => {
    if (!ts) return false;
    const d1 = new Date(ts);
    const d2 = new Date(ref);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isOverdue = (t) => {
    if (!t.dueDate || t.done) return false;
    return t.dueDate < Date.now();
  };

  const getGroup = (t) => {
    // 0 = ativa atrasada, 1 = ativa com data, 2 = ativa sem data, 3 = concluída
    if (t.done) return 3;
    if (isOverdue(t)) return 0;
    if (t.dueDate) return 1;
    return 2;
  };

  const ensureTaskShape = (rawTask, idx) => {
    const t = { ...rawTask };

    if (!t.id) t.id = crypto.randomUUID();
    if (typeof t.text !== "string") t.text = "";
    if (typeof t.done !== "boolean") t.done = false;
    if (!t.priority) t.priority = "medium";
    if (!t.createdAt) t.createdAt = Date.now();
    if (typeof t.completedAt !== "number") t.completedAt = null;
    if (!Array.isArray(t.tags)) t.tags = [];
    if (typeof t.dueDate !== "number") t.dueDate = null;
    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    if (typeof t.order !== "number") t.order = idx + 1;

    // garante shape das subtarefas
    t.subtasks = t.subtasks.map((st, i) => ({
      id: st.id || crypto.randomUUID(),
      text: typeof st.text === "string" ? st.text : "",
      done: !!st.done,
      order: typeof st.order === "number" ? st.order : i + 1,
    }));

    return t;
  };

  /* ------------------ SORT (Ordenação por grupo + ordem manual) ------------------ */
  const sortTasks = () => {
    tasks.sort((a, b) => {
      const ga = getGroup(a);
      const gb = getGroup(b);
      if (ga !== gb) return ga - gb;

      const oa = typeof a.order === "number" ? a.order : 0;
      const ob = typeof b.order === "number" ? b.order : 0;
      return oa - ob;
    });
  };

  /* ------------------ NOTIFICAÇÕES ------------------ */

  const canNotify = () => "Notification" in window;

  const clearNotificationTimer = (taskId) => {
    const tId = notificationTimers[taskId];
    if (tId) {
      clearTimeout(tId);
      delete notificationTimers[taskId];
    }
  };

  const scheduleNotification = (task) => {
    if (!canNotify()) return;
    if (Notification.permission !== "granted") return;
    if (!task.dueDate || task.done) return;

    const delay = task.dueDate - Date.now();
    if (delay <= 0) return;

    clearNotificationTimer(task.id);

    const safeDelay = Math.min(delay, 2147483647); // ~24 dias, limite do setTimeout

    notificationTimers[task.id] = setTimeout(() => {
      try {
        new Notification("TodoHub — lembrete", {
          body: `Tarefa: ${task.text}`,
        });
      } catch {
        // se der erro, apenas mostra toast
      }
      toast(`🔔 Lembrete: ${task.text}`);
      clearNotificationTimer(task.id);
    }, safeDelay);
  };

  const rescheduleAllNotifications = () => {
    Object.keys(notificationTimers).forEach(clearNotificationTimer);
    tasks.forEach(scheduleNotification);
  };

  const setupNotificationPermissionTrigger = () => {
    if (!canNotify()) return;
    if (Notification.permission !== "default") return;

    const handler = () => {
      Notification.requestPermission().finally(() => {
        document.removeEventListener("click", handler);
      });
    };
    document.addEventListener("click", handler, { once: true });
  };

  /* ------------------ RENDER ------------------ */
  const render = () => {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");

    if (!list || !empty) return;

    list.innerHTML = "";

    const filtered = tasks.filter((t) => {
      // estado
      let okState =
        filterState === "all"
          ? true
          : filterState === "active"
          ? !t.done
          : t.done;

      if (!okState) return false;

      // prioridade
      if (filterPriority && t.priority !== filterPriority) return false;

      // tag
      if (activeTag) {
        const normTags = (t.tags || []).map((tag) => normalize(tag));
        if (!normTags.includes(normalize(activeTag))) return false;
      }

      // busca
      const okSearch =
        !search || normalize(t.text).includes(normalize(search));

      return okSearch;
    });

    empty.style.display = filtered.length === 0 ? "block" : "none";

    filtered.forEach((t) => {
      const li = document.createElement("li");
      li.className = `item priority-${t.priority}` + (t.done ? " done" : "");
      li.dataset.id = t.id;

      // drag apenas fora do modo seleção
      if (!selectionMode) {
        li.draggable = true;

        li.addEventListener("dragstart", () => {
          draggedId = t.id;
        });

        li.addEventListener("dragover", (e) => {
          e.preventDefault();
          li.classList.add("drag-over");
        });

        li.addEventListener("dragleave", () => {
          li.classList.remove("drag-over");
        });

        li.addEventListener("drop", (e) => {
          e.preventDefault();
          li.classList.remove("drag-over");
          if (!draggedId || draggedId === t.id) return;
          reorderTasks(draggedId, t.id);
          draggedId = null;
        });
      }

      /* Badge colorido / checkbox seleção/conclusão */
      const badgeWrapper = document.createElement("div");
      badgeWrapper.style.display = "flex";
      badgeWrapper.style.flexDirection = "column";
      badgeWrapper.style.alignItems = "center";
      badgeWrapper.style.gap = "4px";

      const badge = document.createElement("span");
      badge.className = `priority-badge ${t.priority}`;
      badge.title = "Prioridade";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "check";

      if (selectionMode) {
        cb.checked = selectedIds.has(t.id);
        cb.title = "Selecionar tarefa";
      } else {
        cb.checked = t.done;
        cb.title = "Concluir tarefa";
      }

      badgeWrapper.append(badge, cb);

      const main = document.createElement("div");
      main.className = "item-main";

      const textSpan = document.createElement("span");
      textSpan.className = "item-text";
      textSpan.textContent = t.text;

      const meta = document.createElement("div");
      meta.className = "item-meta";

      // criada em
      const createdSpan = document.createElement("span");
      createdSpan.innerHTML = `📅 Criada: <strong>${formatDate(
        t.createdAt
      )}</strong>`;
      meta.appendChild(createdSpan);

      // data limite
      if (t.dueDate) {
        const dueSpan = document.createElement("span");
        const overdue = isOverdue(t);
        const label = overdue ? "Atrasada" : "Limite";
        const icon = overdue ? "⚠️" : "⏰";
        const timeText = formatTime(t.dueDate);
        dueSpan.innerHTML = `${icon} ${label}: <strong>${formatDate(
          t.dueDate
        )}${timeText ? " " + timeText : ""}</strong>`;
        meta.appendChild(dueSpan);
      }

      // tags
      if (t.tags && t.tags.length > 0) {
        const tagContainer = document.createElement("div");
        tagContainer.className = "tag-list";

        t.tags.forEach((tag) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className =
            "tag-chip" +
            (activeTag && normalize(activeTag) === normalize(tag)
              ? " active-tag"
              : "");
          chip.textContent = `#${tag}`;
          chip.addEventListener("click", () => {
            if (activeTag && normalize(activeTag) === normalize(tag)) {
              activeTag = null;
            } else {
              activeTag = tag;
            }
            render();
          });
          tagContainer.appendChild(chip);
        });

        meta.appendChild(tagContainer);
      }

      main.append(textSpan, meta);

      // SUBTAREFAS inline
      if (t.subtasks && t.subtasks.length > 0) {
        const subList = document.createElement("ul");
        subList.className = "subtask-list";

        // ordena subtarefas pela ordem interna
        const sortedSubs = [...t.subtasks].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );

        sortedSubs.forEach((st) => {
          const stLi = document.createElement("li");
          stLi.className = "subtask-item" + (st.done ? " done" : "");

          const stCb = document.createElement("input");
          stCb.type = "checkbox";
          stCb.checked = st.done;

          const stText = document.createElement("span");
          stText.textContent = st.text;

          const stDel = document.createElement("button");
          stDel.type = "button";
          stDel.textContent = "✕";
          stDel.title = "Excluir subtarefa";

          stCb.addEventListener("change", () =>
            toggleSubtaskDone(t.id, st.id, stCb.checked)
          );
          stText.addEventListener("click", () => {
            stCb.checked = !stCb.checked;
            stCb.dispatchEvent(new Event("change"));
          });
          stDel.addEventListener("click", () =>
            removeSubtask(t.id, st.id)
          );

          stLi.append(stCb, stText, stDel);
          subList.appendChild(stLi);
        });

        // linha para adicionar subtarefa inline
        const addRow = document.createElement("div");
        addRow.className = "subtask-add";

        const addInput = document.createElement("input");
        addInput.type = "text";
        addInput.placeholder = "Nova subtarefa";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+";

        addBtn.addEventListener("click", () => {
          if (!addInput.value.trim()) return;
          addSubtask(t.id, addInput.value.trim());
          addInput.value = "";
        });

        addInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!addInput.value.trim()) return;
            addSubtask(t.id, addInput.value.trim());
            addInput.value = "";
          }
        });

        addRow.append(addInput, addBtn);
        subList.appendChild(addRow);

        main.appendChild(subList);
      }

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon";
      editBtn.textContent = "✏️";

      const delBtn = document.createElement("button");
      delBtn.className = "icon danger";
      delBtn.textContent = "🗑️";

      actions.append(editBtn, delBtn);
      li.append(badgeWrapper, main, actions);
      list.append(li);

      // eventos checkbox principal
      cb.addEventListener("change", () => {
        if (selectionMode) {
          if (cb.checked) selectedIds.add(t.id);
          else selectedIds.delete(t.id);
          updateBulkBar();
        } else {
          toggleDone(t.id, cb.checked);
        }
      });

      // clique no texto
      textSpan.addEventListener("click", () => {
        if (selectionMode) {
          const isSelected = selectedIds.has(t.id);
          if (isSelected) selectedIds.delete(t.id);
          else selectedIds.add(t.id);
          render(); // re-render para refletir estado
          updateBulkBar();
        } else {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        }
      });

      // editar / remover
      delBtn.addEventListener("click", () => removeTask(t.id));
      editBtn.addEventListener("click", () => openEditModal(t.id));
    });

    updateCounters();
    updateAnalytics();
    updateBulkBar();
  };

  /* ------------------ REORDENAR (drag & drop) ------------------ */
  const reorderTasks = (fromId, toId) => {
    const fromIndex = tasks.findIndex((t) => t.id === fromId);
    const toIndex = tasks.findIndex((t) => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = tasks.splice(fromIndex, 1);
    tasks.splice(toIndex, 0, moved);

    // recalcula ordem
    tasks = tasks.map((t, idx) => ({ ...t, order: idx + 1 }));
    sortTasks();
    save();
    render();
  };

  /* ------------------ ADD TASK ------------------ */
  const addTask = (text) => {
    const val = text.trim();
    if (!val) return toast("⚠ Digite algo.", "warn");

    const maxOrder = tasks.reduce(
      (acc, t) => (typeof t.order === "number" ? Math.max(acc, t.order) : acc),
      0
    );

    const task = {
      id: crypto.randomUUID(),
      text: val,
      done: false,
      createdAt: Date.now(),
      completedAt: null,
      priority: currentPriority,
      tags: [],
      dueDate: null,
      subtasks: [],
      order: maxOrder + 1,
    };

    tasks.push(task);
    sortTasks();
    save();
    render();
    scheduleNotification(task);
    toast("✨ Tarefa adicionada!");
  };

  /* ------------------ SUBTAREFAS ------------------ */

  const addSubtask = (taskId, text) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (!Array.isArray(t.subtasks)) t.subtasks = [];

    const maxOrder = t.subtasks.reduce(
      (acc, st) => (typeof st.order === "number" ? Math.max(acc, st.order) : acc),
      0
    );

    const sub = {
      id: crypto.randomUUID(),
      text,
      done: false,
      order: maxOrder + 1,
    };

    t.subtasks.push(sub);
    save();
    render();
    if (editingTaskId === taskId) refreshModalSubtasks();
  };

  const toggleSubtaskDone = (taskId, subId, done) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !Array.isArray(t.subtasks)) return;
    const st = t.subtasks.find((s) => s.id === subId);
    if (!st) return;
    st.done = done;
    save();
    render();
    if (editingTaskId === taskId) refreshModalSubtasks();
  };

  const removeSubtask = (taskId, subId) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !Array.isArray(t.subtasks)) return;
    t.subtasks = t.subtasks.filter((s) => s.id !== subId);
    save();
    render();
    if (editingTaskId === taskId) refreshModalSubtasks();
  };

  const refreshModalSubtasks = () => {
    const listEl = document.getElementById("subtasksList");
    const inputEl = document.getElementById("newSubtaskText");
    if (!listEl || editingTaskId == null) return;
    listEl.innerHTML = "";

    const t = tasks.find((x) => x.id === editingTaskId);
    if (!t) return;

    const sortedSubs = [...(t.subtasks || [])].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    sortedSubs.forEach((st) => {
      const li = document.createElement("li");
      li.className = "subtask-item" + (st.done ? " done" : "");

      const label = document.createElement("span");
      label.textContent = st.text;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "✕";
      btn.title = "Excluir subtarefa";

      btn.addEventListener("click", () => removeSubtask(t.id, st.id));

      li.append(label, btn);
      listEl.appendChild(li);
    });

    if (inputEl) inputEl.value = "";
  };

  /* ------------------ EDIT TASK ------------------ */
  const openEditModal = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    editingTaskId = id;

    const textInput = document.getElementById("editText");
    const tagsInput = document.getElementById("editTags");
    const dueDateInput = document.getElementById("editDueDate");
    const dueTimeInput = document.getElementById("editDueTime");

    if (textInput) textInput.value = t.text || "";
    if (tagsInput)
      tagsInput.value = (t.tags || []).join(", ");

    if (dueDateInput && dueTimeInput) {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dueDateInput.value = `${yyyy}-${mm}-${dd}`;

        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        dueTimeInput.value = `${hh}:${min}`;
      } else {
        dueDateInput.value = "";
        dueTimeInput.value = "";
      }
    }

    const prioButtons = document.querySelectorAll(
      "#editPriorityPicker .prio-btn"
    );
    prioButtons.forEach((b) => b.classList.remove("active"));
    const current = document.querySelector(
      `#editPriorityPicker .prio-btn[data-priority="${t.priority}"]`
    );
    if (current) current.classList.add("active");

    refreshModalSubtasks();
    document.getElementById("editDialog")?.showModal();
  };

  /* ------------------ TOGGLE DONE ------------------ */
  const toggleDone = (id, done) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    t.done = done;
    t.completedAt = done ? Date.now() : null;

    if (done) {
      clearNotificationTimer(id);
    } else {
      scheduleNotification(t);
    }

    sortTasks();
    save();
    render();
  };

  /* ------------------ REMOVE TASK ------------------ */
  const removeTask = (id) => {
    const idx = tasks.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const li = document.querySelector(`li[data-id="${id}"]`);
    clearNotificationTimer(id);

    if (li) {
      li.style.animation = "fadeOut .18s forwards";
      setTimeout(() => {
        tasks.splice(idx, 1);
        sortTasks();
        save();
        render();
        toast("🗑️ Removida.");
      }, 180);
    } else {
      tasks.splice(idx, 1);
      sortTasks();
      save();
      render();
      toast("🗑️ Removida.");
    }
  };

  /* ------------------ LIMPAR CONCLUÍDAS ------------------ */
  const clearDone = () => {
    const doneTasks = tasks.filter((t) => t.done);
    const doneCount = doneTasks.length;
    if (!doneCount) {
      toast("Nenhuma tarefa concluída para limpar.", "warn");
      return;
    }

    doneTasks.forEach((t) => clearNotificationTimer(t.id));

    tasks = tasks.filter((t) => !t.done);
    // reajusta ordem
    tasks = tasks.map((t, idx) => ({ ...t, order: idx + 1 }));
    sortTasks();
    save();
    render();
    toast(`🧹 ${doneCount} tarefa(s) concluída(s) removida(s).`);
  };

  /* ------------------ COUNTERS ------------------ */
  const updateCounters = () => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const active = total - done;

    const totalEl = document.getElementById("totalCount");
    const doneEl = document.getElementById("doneCount");
    const activeEl = document.getElementById("activeCount");

    if (totalEl) totalEl.textContent = total;
    if (doneEl) doneEl.textContent = done;
    if (activeEl) activeEl.textContent = active;
  };

  /* ------------------ ANALYTICS ------------------ */
  const updateAnalytics = () => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const overdue = tasks.filter((t) => isOverdue(t)).length;
    const todayCreated = tasks.filter((t) => isSameDay(t.createdAt)).length;

    const percent = total ? Math.round((done / total) * 100) : 0;

    const bar = document.getElementById("donePercentBar");
    const percentLabel = document.getElementById("donePercentLabel");
    const overdueEl = document.getElementById("overdueCount");
    const todayEl = document.getElementById("todayCount");

    if (bar) bar.style.width = `${percent}%`;
    if (percentLabel) percentLabel.textContent = `${percent}%`;
    if (overdueEl) overdueEl.textContent = overdue;
    if (todayEl) todayEl.textContent = todayCreated;
  };

  /* ------------------ STORAGE (usando Storage.js multiusuário) ------------------ */
  const save = () => {
    Storage.setTasks(tasks);
  };

  const load = () => {
    const raw = Storage.getTasks();
    if (!Array.isArray(raw)) {
      tasks = [];
      return;
    }
    tasks = raw.map((t, idx) => ensureTaskShape(t, idx));
  };

  /* ------------------ EXPORTS ------------------ */
  const downloadFile = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: Auth.getUser() || null,
      tasks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    downloadFile("todohub_backup.json", blob);
    toast("📦 Backup JSON exportado.");
  };

  const exportCSV = () => {
    const header = [
      "id",
      "texto",
      "done",
      "prioridade",
      "tags",
      "createdAt",
      "dueDate",
      "completedAt",
      "order",
    ];

    const lines = [header.join(";")];

    tasks.forEach((t) => {
      const row = [
        t.id,
        `"${(t.text || "").replace(/"/g, '""')}"`,
        t.done ? "1" : "0",
        t.priority || "",
        (t.tags || []).join(", "),
        t.createdAt ? new Date(t.createdAt).toISOString() : "",
        t.dueDate ? new Date(t.dueDate).toISOString() : "",
        t.completedAt ? new Date(t.completedAt).toISOString() : "",
        typeof t.order === "number" ? t.order : "",
      ];
      lines.push(row.join(";"));
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    downloadFile("todohub_export.csv", blob);
    toast("📊 CSV exportado (compatível com Excel/Sheets).");
  };

  const exportExcel = () => {
    if (typeof XLSX === "undefined") {
      toast("⚠ Biblioteca XLSX não encontrada.", "warn");
      return;
    }

    const data = [
      [
        "ID",
        "Texto",
        "Concluída",
        "Prioridade",
        "Tags",
        "Criada em",
        "Data limite",
        "Concluída em",
        "Ordem",
      ],
    ];

    tasks.forEach((t) => {
      data.push([
        t.id,
        t.text || "",
        t.done ? "Sim" : "Não",
        t.priority || "",
        (t.tags || []).join(", "),
        t.createdAt ? new Date(t.createdAt).toISOString() : "",
        t.dueDate ? new Date(t.dueDate).toISOString() : "",
        t.completedAt ? new Date(t.completedAt).toISOString() : "",
        typeof t.order === "number" ? t.order : "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TodoHub");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const blob = new Blob([wbout], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    downloadFile("todohub_export.xlsx", blob);
    toast("📑 Excel exportado.");
  };

  const importJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.tasks)) {
          toast("⚠ Arquivo inválido.", "warn");
          return;
        }
        const imported = parsed.tasks.map((t, idx) =>
          ensureTaskShape(t, idx)
        );
        tasks = imported;
        sortTasks();
        save();
        render();
        rescheduleAllNotifications();
        toast("✅ Backup importado com sucesso.");
      } catch (err) {
        console.error(err);
        toast("⚠ Erro ao importar JSON.", "error");
      }
    };
    reader.readAsText(file);
  };

  /* ------------------ SELEÇÃO MÚLTIPLA ------------------ */

  const enterSelectionMode = () => {
    selectionMode = true;
    selectedIds = new Set();
    document.body.classList.add("selection-mode");
    toast("✅ Modo seleção ativado. Use os checkboxes ou Shift+S para sair.");
    render();
  };

  const exitSelectionMode = () => {
    selectionMode = false;
    selectedIds.clear();
    document.body.classList.remove("selection-mode");
    render();
  };

  const updateBulkBar = () => {
    const bar = document.getElementById("bulkBar");
    const countEl = document.getElementById("bulkCount");
    const count = selectedIds.size;

    if (!bar || !countEl) return;

    if (!selectionMode || count === 0) {
      bar.classList.add("hidden");
    } else {
      bar.classList.remove("hidden");
      countEl.textContent =
        count === 1
          ? "1 tarefa selecionada"
          : `${count} tarefas selecionadas`;
    }
  };

  const bulkSetPriority = (priority) => {
    if (!selectedIds.size) return;
    tasks.forEach((t) => {
      if (selectedIds.has(t.id)) t.priority = priority;
    });
    sortTasks();
    save();
    render();
    toast("✨ Prioridade atualizada em lote.");
  };

  const bulkMarkDone = () => {
    if (!selectedIds.size) return;
    tasks.forEach((t) => {
      if (selectedIds.has(t.id)) {
        t.done = true;
        t.completedAt = Date.now();
        clearNotificationTimer(t.id);
      }
    });
    sortTasks();
    save();
    render();
    toast("✅ Tarefas marcadas como concluídas.");
  };

  const bulkDelete = () => {
    if (!selectedIds.size) return;
    const toDelete = tasks.filter((t) => selectedIds.has(t.id));
    toDelete.forEach((t) => clearNotificationTimer(t.id));

    tasks = tasks.filter((t) => !selectedIds.has(t.id));
    tasks = tasks.map((t, idx) => ({ ...t, order: idx + 1 }));
    sortTasks();
    save();
    render();
    toast("🗑️ Tarefas selecionadas removidas.");
  };

  /* ------------------ UI BIND ------------------ */
  const bindUI = () => {
    const input = document.getElementById("taskInput");
    const btnAdd = document.getElementById("addTaskBtn");
    const searchInput = document.getElementById("searchInput");
    const clearDoneBtn = document.getElementById("clearDoneBtn");
    const exportJsonBtn = document.getElementById("exportJsonBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    const importJsonInput = document.getElementById("importJsonInput");
    const selectionModeBtn = document.getElementById("selectionModeBtn");
    const bulkExitBtn = document.getElementById("bulkExitBtn");
    const bulkDoneBtn = document.getElementById("bulkDoneBtn");
    const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
    const bulkPrioButtons = document.querySelectorAll(".bulk-prio");
    const addSubtaskBtn = document.getElementById("addSubtaskBtn");
    const newSubtaskInput = document.getElementById("newSubtaskText");

    /* Priority picker (nova tarefa) */
    const prioButtons = document.querySelectorAll("#priorityPicker .prio-btn");
    prioButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        prioButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentPriority = btn.dataset.priority;
      });
    });

    if (btnAdd && input) {
      btnAdd.addEventListener("click", () => {
        addTask(input.value);
        input.value = "";
        input.focus();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addTask(input.value);
          input.value = "";
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        search = e.target.value;
        render();
      });
    }

    // filtros (estado + prioridade)
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const state = chip.dataset.filterState || null;
        const prio = chip.dataset.filterPriority || null;

        if (state) {
          document
            .querySelectorAll("[data-filter-state]")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          filterState = state;
        }

        if (prio) {
          const isActive = chip.classList.contains("active");
          document
            .querySelectorAll("[data-filter-priority]")
            .forEach((c) => c.classList.remove("active"));
          if (!isActive) {
            chip.classList.add("active");
            filterPriority = prio;
          } else {
            filterPriority = null;
          }
        }

        render();
      });
    });

    if (clearDoneBtn) {
      clearDoneBtn.addEventListener("click", clearDone);
    }

    if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportJSON);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);
    if (exportExcelBtn) exportExcelBtn.addEventListener("click", exportExcel);

    if (importJsonInput) {
      importJsonInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          importJSON(file);
          importJsonInput.value = "";
        }
      });
    }

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* Edit form */
    const editForm = document.getElementById("editForm");
    if (editForm) {
      editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!editingTaskId) return;
        const t = tasks.find((x) => x.id === editingTaskId);
        if (!t) return;

        const textInput = document.getElementById("editText");
        const tagsInput = document.getElementById("editTags");
        const dueDateInput = document.getElementById("editDueDate");
        const dueTimeInput = document.getElementById("editDueTime");

        const newText = textInput?.value.trim() || "";
        if (!newText) {
          toast("⚠ Texto não pode ser vazio.", "warn");
          return;
        }

        let newPriority =
          document.querySelector("#editPriorityPicker .prio-btn.active")
            ?.dataset.priority || t.priority;

        if (!["high", "medium", "low"].includes(newPriority)) {
          newPriority = "medium";
        }

        let newTags = [];
        if (tagsInput && tagsInput.value.trim()) {
          newTags = tagsInput.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }

        let newDueDate = null;
        if (dueDateInput && dueDateInput.value) {
          const [yyyy, mm, dd] = dueDateInput.value.split("-");
          const d = new Date();
          d.setFullYear(Number(yyyy), Number(mm) - 1, Number(dd));

          if (dueTimeInput && dueTimeInput.value) {
            const [hh, min] = dueTimeInput.value.split(":");
            d.setHours(Number(hh), Number(min), 0, 0);
          } else {
            d.setHours(23, 59, 59, 999);
          }
          newDueDate = d.getTime();
        }

        t.text = newText;
        t.priority = newPriority;
        t.tags = newTags;
        t.dueDate = newDueDate;

        if (t.done && t.dueDate) {
          // se estiver concluída, não notificar
          clearNotificationTimer(t.id);
        } else {
          scheduleNotification(t);
        }

        sortTasks();
        save();
        render();
        UI.toast("✏️ Tarefa atualizada!");

        const dlg = document.getElementById("editDialog");
        dlg?.close();
        editingTaskId = null;
      });
    }

    const prioButtonsEdit = document.querySelectorAll(
      "#editPriorityPicker .prio-btn"
    );
    prioButtonsEdit.forEach((btn) => {
      btn.addEventListener("click", () => {
        prioButtonsEdit.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // botão de adicionar subtarefa no modal
    if (addSubtaskBtn && newSubtaskInput) {
      addSubtaskBtn.addEventListener("click", () => {
        if (!editingTaskId) return;
        if (!newSubtaskInput.value.trim()) return;
        addSubtask(editingTaskId, newSubtaskInput.value.trim());
        newSubtaskInput.value = "";
        refreshModalSubtasks();
      });

      newSubtaskInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!editingTaskId) return;
          if (!newSubtaskInput.value.trim()) return;
          addSubtask(editingTaskId, newSubtaskInput.value.trim());
          newSubtaskInput.value = "";
          refreshModalSubtasks();
        }
      });
    }

    // seleção múltipla
    if (selectionModeBtn) {
      selectionModeBtn.addEventListener("click", () => {
        if (selectionMode) exitSelectionMode();
        else enterSelectionMode();
      });
    }

    if (bulkExitBtn) {
      bulkExitBtn.addEventListener("click", () => {
        exitSelectionMode();
      });
    }

    if (bulkDoneBtn) {
      bulkDoneBtn.addEventListener("click", () => {
        bulkMarkDone();
        selectedIds.clear();
        updateBulkBar();
      });
    }

    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener("click", () => {
        bulkDelete();
        selectedIds.clear();
        updateBulkBar();
      });
    }

    bulkPrioButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const prio = btn.dataset.bulkPriority;
        if (!prio) return;
        bulkSetPriority(prio);
      });
    });
  };

  /* ------------------ USER SWITCH ------------------ */
  const reloadForUser = () => {
    load();
    tasks = tasks.map((t, idx) => ensureTaskShape(t, idx));
    sortTasks();
    render();
    rescheduleAllNotifications();
    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : "TodoHub";
  };

  /* ------------------ INIT ------------------ */
  const init = () => {
    bindUI();
    reloadForUser();
    setupNotificationPermissionTrigger();
  };

  return {
    init,
    reloadForUser,
  };
})();

document.addEventListener("DOMContentLoaded", Main.init);

/* ------------------ SHORTCUTS GERAIS ------------------ */
document.addEventListener("keydown", (e) => {
  // Buscar (Ctrl+Shift+F)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    document.querySelector("[data-search]")?.focus();
  }

  // Alternar tema (tecla D)
  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "d") {
    const tag = document.activeElement.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      Theme.toggle();
    }
  }

  // Modo seleção (Shift + S)
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    const btn = document.getElementById("selectionModeBtn");
    btn?.click();
  }
});


// main.js — CRUD, filtros, busca, prioridades, datas, tags, drag & drop, export, multiusuário

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

  let draggedId = null;
  let editingTaskId = null;

  const toast = (msg) => UI.toast(msg);

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
    if (!Array.isArray(t.tags)) t.tags = [];
    if (typeof t.dueDate !== "number") t.dueDate = null;
    if (typeof t.completedAt !== "number") t.completedAt = null;
    if (typeof t.order !== "number") t.order = idx + 1;

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
      li.draggable = true;

      /* Badge colorido */
      const badge = document.createElement("span");
      badge.className = `priority-badge ${t.priority}`;
      badge.title = "Prioridade";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "check";
      cb.checked = t.done;

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

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon";
      editBtn.textContent = "✏️";

      const delBtn = document.createElement("button");
      delBtn.className = "icon danger";
      delBtn.textContent = "🗑️";

      actions.append(editBtn, delBtn);
      li.append(badge, cb, main, actions);
      list.append(li);

      // eventos
      cb.addEventListener("change", () => toggleDone(t.id, cb.checked));
      delBtn.addEventListener("click", () => removeTask(t.id));
      editBtn.addEventListener("click", () => openEditModal(t.id));

      textSpan.addEventListener("click", () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });

      // drag & drop
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
    });

    updateCounters();
    updateAnalytics();
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
    if (!val) return toast("⚠ Digite algo.");

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
      order: maxOrder + 1,
    };

    tasks.push(task);
    sortTasks();
    save();
    render();
    toast("✨ Tarefa adicionada!");
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

    document.getElementById("editDialog")?.showModal();
  };

  /* ------------------ TOGGLE DONE ------------------ */
  const toggleDone = (id, done) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    t.done = done;
    t.completedAt = done ? Date.now() : null;

    sortTasks();
    save();
    render();
  };

  /* ------------------ REMOVE TASK ------------------ */
  const removeTask = (id) => {
    const idx = tasks.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const li = document.querySelector(`li[data-id="${id}"]`);
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
    const doneCount = tasks.filter((t) => t.done).length;
    if (!doneCount) {
      toast("Nenhuma tarefa concluída para limpar.");
      return;
    }
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
      toast("⚠ Biblioteca XLSX não encontrada.");
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
          toast("⚠ Arquivo inválido.");
          return;
        }
        const imported = parsed.tasks.map((t, idx) =>
          ensureTaskShape(t, idx)
        );
        tasks = imported;
        sortTasks();
        save();
        render();
        toast("✅ Backup importado com sucesso.");
      } catch (err) {
        console.error(err);
        toast("⚠ Erro ao importar JSON.");
      }
    };
    reader.readAsText(file);
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

    /* Priority picker */
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

        // limpa seleção anterior
        if (state) {
          document
            .querySelectorAll("[data-filter-state]")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          filterState = state;
        }

        if (prio) {
          // prioridade pode ser desligada clicando de novo
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
          toast("⚠ Texto não pode ser vazio.");
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
  };

  /* ------------------ USER SWITCH ------------------ */
  const reloadForUser = () => {
    load();
    tasks = tasks.map((t, idx) => ensureTaskShape(t, idx));
    sortTasks();
    render();
    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : "TodoHub";
  };

  /* ------------------ INIT ------------------ */
  const init = () => {
    bindUI();
    reloadForUser();
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
    if (document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA") {
      Theme.toggle();
    }
  }
});




//* main.js — CRUD, filtros, busca, atalhos, prioridades e ordenação */

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
  let filter = "all";
  let search = "";

  const toast = (msg) => UI.toast(msg);

  /* ------------------ SORT (Ordenação automática) ------------------ */
  const sortTasks = () => {
    const priorityOrder = {
      high: 1,
      medium: 2,
      low: 3
    };

    tasks.sort((a, b) => {
      // concluídas vão para o final
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;

      // ordena por prioridade
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  /* ------------------ RENDER ------------------ */
  const render = () => {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");

    list.innerHTML = "";

    const normalize = (s) =>
      s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

    const filtered = tasks.filter((t) => {
      const okFilter =
        filter === "all"
          ? true
          : filter === "active"
          ? !t.done
          : t.done;

      const okSearch =
        !search || normalize(t.text).includes(normalize(search));

      return okFilter && okSearch;
    });

    empty.style.display = filtered.length === 0 ? "block" : "none";

    filtered.forEach((t) => {
      const li = document.createElement("li");
      li.className = `item priority-${t.priority}` + (t.done ? " done" : "");
      li.dataset.id = t.id;

      /* Badge colorido */
      const badge = document.createElement("span");
      badge.className = `priority-badge ${t.priority}`;
      badge.title = "Prioridade";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "check";
      cb.checked = t.done;

      const span = document.createElement("span");
      span.className = "item-text";
      span.textContent = t.text;

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon";
      editBtn.textContent = "✏️";

      const delBtn = document.createElement("button");
      delBtn.className = "icon danger";
      delBtn.textContent = "🗑️";

      actions.append(editBtn, delBtn);
      li.append(badge, cb, span, actions);
      list.append(li);

      cb.addEventListener("change", () => toggleDone(t.id, cb.checked));
      delBtn.addEventListener("click", () => removeTask(t.id));
      editBtn.addEventListener("click", () => editTask(t.id));

      span.addEventListener("click", () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });
    });

    updateCounters();
  };

  /* ------------------ ADD TASK ------------------ */
  const addTask = (text) => {
    const val = text.trim();
    if (!val) return toast("⚠ Digite algo.");

    const task = {
      id: crypto.randomUUID(),
      text: val,
      done: false,
      createdAt: Date.now(),
      priority: currentPriority
    };

    tasks.push(task);
    sortTasks();
    save();
    render();
    toast("✨ Tarefa adicionada!");
  };

  /* ------------------ EDIT TASK (AGORA COM PRIORIDADE) ------------------ */
let editingTaskId = null;

const editTask = (id) => {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;

  editingTaskId = id;

  // preencher o modal
  document.getElementById("editText").value = t.text;

  const prioButtons = document.querySelectorAll("#editPriorityPicker .prio-btn");
  prioButtons.forEach(b => b.classList.remove("active"));

  document
    .querySelector(`#editPriorityPicker .prio-btn[data-priority="${t.priority}"]`)
    .classList.add("active");

  // abrir modal
  document.getElementById("editDialog").showModal();
};

  /* ------------------ TOGGLE DONE ------------------ */
  const toggleDone = (id, done) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    t.done = done;

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
    }
  };

  /* ------------------ COUNTERS ------------------ */
  const updateCounters = () => {
    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("doneCount").textContent = tasks.filter(t => t.done).length;
    document.getElementById("activeCount").textContent = tasks.filter(t => !t.done).length;
  };

  /* ------------------ STORAGE ------------------ */
  const save = () => Storage.setTasks(tasks);
  const load = () => { tasks = Storage.getTasks(); };

  /* ------------------ UI BIND ------------------ */
  const bindUI = () => {
    const input = document.getElementById("taskInput");
    const btn = document.getElementById("addTaskBtn");
    const searchInput = document.getElementById("searchInput");

    /* Priority picker */
    const prioButtons = document.querySelectorAll(".prio-btn");

    prioButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        prioButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentPriority = btn.dataset.priority;
      });
    });

    btn.addEventListener("click", () => {
      addTask(input.value);
      input.value = "";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addTask(input.value);
        input.value = "";
      }
    });

    searchInput.addEventListener("input", (e) => {
      search = e.target.value;
      render();
    });

    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach((c) =>
          c.classList.remove("active")
        );
        chip.classList.add("active");
        filter = chip.dataset.filter;
        render();
      });
    });

    document.getElementById("year").textContent = new Date().getFullYear();
  };

  /* ------------------ USER SWITCH ------------------ */
  const reloadForUser = () => {
    load();
    sortTasks();
    render();
    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : "TodoHub";
  };

  /* ------------------ EDIT FORM EVENTS ------------------ */
document.getElementById("editForm").addEventListener("submit", () => {
  const t = tasks.find(x => x.id === editingTaskId);
  if (!t) return;

  const newText = document.getElementById("editText").value.trim();
  if (!newText) return;

  const newPriority = document.querySelector("#editPriorityPicker .prio-btn.active")?.dataset.priority;

  t.text = newText;
  t.priority = newPriority;

  sortTasks();
  save();
  render();
  UI.toast("✏️ Tarefa atualizada!");
});

document.querySelectorAll("#editPriorityPicker .prio-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#editPriorityPicker .prio-btn")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
  });
});

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

/* ------------------ SHORTCUTS ------------------ */
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    document.querySelector("[data-search]")?.focus();
  }

  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "d") {
    if (document.activeElement.tagName !== "INPUT") Theme.toggle();
  }
});



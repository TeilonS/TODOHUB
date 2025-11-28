/* main.js — CRUD, filtros, busca, atalhos, prioridade e integração total */

import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Theme } from "./theme.js";
import { Auth } from "./auth.js";

/* ------------------ LOADER ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("appLoader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 200);
});

/* ======================================================
   ESTADO PRINCIPAL
====================================================== */
export const Main = (() => {

  let tasks = [];
  let filter = "all";          // all | active | done
  let search = "";
  let currentPriority = "medium";
  let priorityFilter = "all";  // all | high | medium | low

  /* ------------------ TOAST ------------------ */
  const toast = (msg) => UI.toast(msg);

  /* ======================================================
     RENDERIZAÇÃO
  ====================================================== */
  const render = () => {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");
    list.innerHTML = "";

    const normalize = (s) =>
      s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

    /* ------------------ APLICA FILTROS ------------------ */
    const filtered = tasks.filter((t) => {
      const matchState =
        filter === "all"
          ? true
          : filter === "active"
          ? !t.done
          : t.done;

      const matchSearch =
        !search || normalize(t.text).includes(normalize(search));

      const matchPriority =
        priorityFilter === "all" ? true : t.priority === priorityFilter;

      return matchState && matchSearch && matchPriority;
    });

    empty.style.display = filtered.length === 0 ? "block" : "none";

    /* ------------------ RENDERIZA TAREFAS ------------------ */
    filtered.forEach((t) => {
      const li = document.createElement("li");
      li.className = `item priority-${t.priority}` + (t.done ? " done" : "");
      li.dataset.id = t.id;

      /* Checkbox */
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "check";
      cb.checked = t.done;

      /* Texto */
      const span = document.createElement("span");
      span.className = "item-text";
      span.textContent = t.text;

      /* Botões */
      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon";
      editBtn.textContent = "✏️";

      const delBtn = document.createElement("button");
      delBtn.className = "icon danger";
      delBtn.textContent = "🗑️";

      actions.append(editBtn, delBtn);

      /* Monta o item */
      li.append(cb, span, actions);
      list.append(li);

      /* Eventos */
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

  /* ======================================================
     CRUD
  ====================================================== */
  const addTask = (text) => {
    const val = text.trim();
    if (!val) return toast("⚠ Digite algo.");

    const task = {
      id: crypto.randomUUID(),
      text: val,
      done: false,
      createdAt: Date.now(),
      priority: currentPriority,
    };

    tasks.unshift(task);
    save();
    render();
    toast("✨ Tarefa adicionada!");
  };

  const editTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    const novo = prompt("Editar tarefa:", t.text);
    if (novo === null) return;

    const val = novo.trim();
    if (!val) return toast("⚠ O texto não pode ficar vazio.");

    t.text = val;
    save();
    render();
    toast("✏️ Atualizada!");
  };

  const toggleDone = (id, done) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = done;
    save();
    render();
  };

  const removeTask = (id) => {
    const idx = tasks.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const li = document.querySelector(`li[data-id="${id}"]`);
    if (li) {
      li.style.animation = "fadeOut .18s forwards";
      setTimeout(() => {
        tasks.splice(idx, 1);
        save();
        render();
        toast("🗑️ Removida.");
      }, 180);
    }
  };

  /* ======================================================
     CONTADORES
  ====================================================== */
  const updateCounters = () => {
    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("doneCount").textContent = tasks.filter((t) => t.done).length;
    document.getElementById("activeCount").textContent = tasks.filter((t) => !t.done).length;
  };

  /* ======================================================
     STORAGE
  ====================================================== */
  const save = () => Storage.setTasks(tasks);
  const load = () => { tasks = Storage.getTasks(); };

  /* ======================================================
     UI BIND
  ====================================================== */
  const bindUI = () => {
    const input = document.getElementById("taskInput");
    const btn = document.getElementById("addTaskBtn");

    /* ----- Priority Picker (Alta / Média / Baixa) ----- */
    document.querySelectorAll(".prio-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".prio-btn").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
        currentPriority = btn.dataset.priority;
      });
    });

    /* Adicionar tarefa */
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

    /* Campo de busca */
    document.getElementById("searchInput").addEventListener("input", (e) => {
      search = e.target.value;
      render();
    });

    /* Chips de filtro (todos / ativos / concluídos) */
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

  /* ======================================================
     USUÁRIO
  ====================================================== */
  const reloadForUser = () => {
    load();
    render();
    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : "TodoHub";
  };

  /* ======================================================
     INIT
  ====================================================== */
  const init = () => {
    bindUI();
    reloadForUser();
  };

  return { init, reloadForUser };
})();

/* ------------------ INIT MAIN ------------------ */
document.addEventListener("DOMContentLoaded", Main.init);

/* ======================================================
   ATALHOS DE TECLADO
====================================================== */
document.addEventListener("keydown", (e) => {
  // Ctrl+Shift+F → busca
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    document.querySelector("[data-search]")?.focus();
  }

  // D → alternar tema
  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "d") {
    if (document.activeElement.tagName !== "INPUT") {
      Theme.toggle();
    }
  }
});


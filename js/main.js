/* main.js — CRUD, filtros, busca, atalhos e integração total */

import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Theme } from "./theme.js";
import { Auth } from "./auth.js";

export const Main = (() => {

  let tasks = [];
  let filter = "all";
  let search = "";

  /* ---------- LOADER ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      document.getElementById("appLoader")?.classList.add("hidden");
    }, 250);
  });

  /* ---------- Toast local ---------- */
  const toast = (msg) => UI.toast(msg);

  /* ---------- Renderização ---------- */
  const render = () => {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");

    list.innerHTML = "";

    const norm = (s) =>
      s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

    const filtered = tasks.filter(t => {
      const okFilter =
        filter === "all"
          ? true
          : filter === "active"
          ? !t.done
          : t.done;

      const okSearch = !search || norm(t.text).includes(norm(search));

      return okFilter && okSearch;
    });

    empty.style.display = filtered.length === 0 ? "block" : "none";

    filtered.forEach(t => {
      const li = document.createElement("li");
      li.className = "item" + (t.done ? " done" : "");
      li.dataset.id = t.id;

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
      li.append(cb, span, actions);
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

  /* ---------- CRUD ---------- */

  const addTask = (text) => {
    const val = text.trim();
    if (!val) return toast("⚠ Digite algo.");

    const task = {
      id: crypto.randomUUID(),
      text: val,
      done: false,
      createdAt: Date.now()
    };

    tasks.unshift(task);
    save();
    render();
    toast("✨ Tarefa adicionada!");
  };

  const editTask = (id) => {
    const t = tasks.find(x => x.id === id);
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
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = done;
    save();
    render();
  };

  const removeTask = (id) => {
    const i = tasks.findIndex(x => x.id === id);
    if (i < 0) return;

    const li = document.querySelector(`li[data-id="${id}"]`);
    if (li) {
      li.style.animation = "fadeOut .18s forwards";
      setTimeout(() => {
        tasks.splice(i, 1);
        save();
        render();
        toast("🗑️ Removida.");
      }, 180);
    }
  };

  /* ---------- Contadores ---------- */
  const updateCounters = () => {
    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("doneCount").textContent = tasks.filter(t => t.done).length;
    document.getElementById("activeCount").textContent = tasks.filter(t => !t.done).length;
  };

  /* ---------- Persistência ---------- */
  const load = () => {
    tasks = Storage.getTasks();
  };

  const save = () => {
    Storage.setTasks(tasks);
  };

  /* ---------- UI ---------- */
  const bindUI = () => {
    const input = document.getElementById("taskInput");
    const btn = document.getElementById("addTaskBtn");
    const searchInput = document.getElementById("searchInput");

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

    document.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        filter = chip.dataset.filter;
        render();
      });
    });

    document.getElementById("year").textContent = new Date().getFullYear();
  };

  /* ---------- Recarga por usuário ---------- */
  const reloadForUser = () => {
    load();
    render();

    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : "TodoHub";
  };

  /* ---------- Init ---------- */
  const init = () => {
    bindUI();
    reloadForUser();
  };

  return {
    init,
    reloadForUser
  };

})();

/* Inicializa Main */
document.addEventListener("DOMContentLoaded", Main.init);

/* ---------- Atalhos ---------- */
document.addEventListener("keydown", (e) => {

  /* Ctrl+Shift+F — foco na busca */
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    document.querySelector("[data-search]")?.focus();
  }

  /* D — alternar tema */
  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "d") {
    if (document.activeElement.tagName !== "INPUT") {
      Theme.toggle();
    }
  }

});

/* main.js
   Regras do To-Do: CRUD, filtros, busca, contadores, toasts, acessibilidade.
*/

const Main = (() => {
  // Estado em memória (renderização rápida)
  let tasks = [];
  let filter = 'all'; // all | active | done
  let search = '';

  // Elementos
  const els = {};
  const q = (sel) => document.querySelector(sel);

  const toast = (msg) => {
    const el = q('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  };

  const updateCounters = () => {
    const total = tasks.length;
    const done  = tasks.filter(t => t.done).length;
    const active = total - done;
    q('#totalCount').textContent  = total;
    q('#doneCount').textContent   = done;
    q('#activeCount').textContent = active;
  };

  const save = () => Storage.setTasks(tasks);

  const render = () => {
    const list = q('#taskList');
    const empty = q('#emptyState');
    list.innerHTML = '';

    // Aplica filtro e busca
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const match = (t) => {
      const okFilter =
        filter === 'all' ? true :
        filter === 'active' ? !t.done :
        t.done;
      const okSearch = !search || norm(t.text).includes(norm(search));
      return okFilter && okSearch;
    };

    const filtered = tasks.filter(match);
    if (filtered.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
    }

    filtered.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'item' + (t.done ? ' done' : '');
      li.dataset.id = t.id;

      // Checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'check';
      cb.checked = t.done;
      cb.setAttribute('aria-label', 'Marcar tarefa como concluída');

      // Texto
      const span = document.createElement('span');
      span.className = 'item-text';
      span.textContent = t.text;

      // Ações
      const actions = document.createElement('div');
      actions.className = 'item-actions';

      // Editar (opcional)
      const btnEdit = document.createElement('button');
      btnEdit.className = 'icon';
      btnEdit.title = 'Editar';
      btnEdit.setAttribute('aria-label', 'Editar tarefa');
      btnEdit.textContent = '✏️';

      // Remover
      const btnDel = document.createElement('button');
      btnDel.className = 'icon danger';
      btnDel.title = 'Excluir';
      btnDel.setAttribute('aria-label', 'Excluir tarefa');
      btnDel.textContent = '🗑️';

      actions.append(btnEdit, btnDel);
      li.append(cb, span, actions);
      list.append(li);

      // Eventos
      cb.addEventListener('change', () => toggleDone(t.id, cb.checked));
      btnDel.addEventListener('click', () => removeTask(t.id));
      btnEdit.addEventListener('click', () => editTask(t.id));
      // Permitir marcar clicando no texto
      span.addEventListener('click', () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); });
    });

    updateCounters();
  };

  const addTask = (text) => {
    const value = text.trim();
    if (!value) return toast('⚠️ Digite uma tarefa.');

    const task = {
      id: crypto.randomUUID(),
      text: value,
      done: false,
      createdAt: Date.now()
    };
    tasks.unshift(task);
    save();
    render();
    toast('✅ Tarefa adicionada!');
  };

  const editTask = (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const novo = prompt('Editar tarefa:', t.text);
    if (novo === null) return; // cancelado
    const val = novo.trim();
    if (!val) return toast('⚠️ O texto não pode ficar vazio.');
    t.text = val;
    save(); render(); toast('✏️ Tarefa atualizada.');
  };

  const toggleDone = (id, done) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !!done;
    save(); render();
  };

  const removeTask = (id) => {
    const idx = tasks.findIndex(x => x.id === id);
    if (idx < 0) return;
    // Anima fadeOut
    const li = q(`li.item[data-id="${id}"]`);
    if (li) {
      li.style.animation = 'fadeOut .18s forwards';
      setTimeout(() => {
        tasks.splice(idx, 1);
        save(); render();
        toast('🗑️ Tarefa removida.');
      }, 180);
    } else {
      tasks.splice(idx, 1);
      save(); render();
      toast('🗑️ Tarefa removida.');
    }
  };

  const bindUI = () => {
    els.input = q('#taskInput');
    els.addBtn = q('#addTaskBtn');
    els.list = q('#taskList');
    els.search = q('#searchInput');

    // Adicionar
    els.addBtn.addEventListener('click', () => addTask(els.input.value));
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask(els.input.value);
    });

    // Filtros
    document.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        render();
      });
    });

    // Busca
    els.search.addEventListener('input', (e) => {
      search = e.target.value;
      render();
    });

    // Ano no rodapé
    const year = document.getElementById('year');
    year.textContent = new Date().getFullYear();
  };

  const load = () => {
    tasks = Storage.getTasks();
  };

  // Quando trocar de usuário, recarrega dados/estado
  const reloadForUser = () => {
    load(); render();
    const u = Auth.getUser();
    document.title = u ? `TodoHub — ${u.name}` : 'TodoHub';
  };

  const init = () => {
    bindUI();
    reloadForUser();
  };

  return { init, reloadForUser, toast };
})();

document.addEventListener('DOMContentLoaded', Main.init);

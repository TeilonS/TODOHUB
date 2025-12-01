// js/main.js
// Core do TodoHub: tarefas, listas, filtros, bulk actions, exportação etc.

import {
  loadLists,
  saveLists,
  loadCurrentListId,
  saveCurrentListId,
  loadTasks,
  saveTasks
} from './storage.js';

import {
  showToast,
  formatDateLabel,
  todayISODate
} from './ui.js';

/* ========== ESTADO GLOBAL ========== */
let lists = [];
let currentListId = null;
let tasks = [];

let stateFilter = 'all';      // all | active | done
let priorityFilter = 'all';   // all | high | medium | low
let tagFilter = null;
let searchQuery = '';
let selectionMode = false;
let selectedIds = new Set();

/* ========== ELEMENTOS DOM ========== */

// Sidebar
const sidebarEl = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const listContainerEl = document.getElementById('listContainer');
const newListBtn = document.getElementById('newListBtn');

// Stats
const totalCountEl = document.getElementById('totalCount');
const activeCountEl = document.getElementById('activeCount');
const doneCountEl = document.getElementById('doneCount');
const donePercentBarEl = document.getElementById('donePercentBar');
const donePercentLabelEl = document.getElementById('donePercentLabel');
const overdueCountEl = document.getElementById('overdueCount');
const todayCountEl = document.getElementById('todayCount');

// Add task
const taskInputEl = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const priorityPickerEl = document.getElementById('priorityPicker');

// Filters / Search
const filtersContainerEl = document.querySelector('.filters');
const searchInputEl = document.getElementById('searchInput');

// Extra actions
const clearDoneBtn = document.getElementById('clearDoneBtn');
const selectionModeBtn = document.getElementById('selectionModeBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const importJsonInput = document.getElementById('importJsonInput');

// Bulk bar
const bulkBarEl = document.getElementById('bulkBar');
const bulkCountEl = document.getElementById('bulkCount');
const bulkExitBtn = document.getElementById('bulkExitBtn');
const bulkDoneBtn = document.getElementById('bulkDoneBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const bulkPrioButtons = document.querySelectorAll('.bulk-prio');

// Task list
const taskListEl = document.getElementById('taskList');
const emptyStateEl = document.getElementById('emptyState');

// Edit modal
const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
const editTextEl = document.getElementById('editText');
const editPriorityPicker = document.getElementById('editPriorityPicker');
const editTagsEl = document.getElementById('editTags');
const editDueDateEl = document.getElementById('editDueDate');
const editDueTimeEl = document.getElementById('editDueTime');
const subtasksListEl = document.getElementById('subtasksList');
const newSubtaskTextEl = document.getElementById('newSubtaskText');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');

let newTaskPriority = 'medium';
let editTaskPriority = 'medium';
let editSubtasks = [];
let currentEditTaskId = null;

/* ========== HELPERS ========== */

function uuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function findCurrentList() {
  return lists.find(l => l.id === currentListId) || null;
}

/* ========== LISTAS / SIDEBAR ========== */

function ensureLists() {
  lists = loadLists();

  if (!lists || !Array.isArray(lists) || lists.length === 0) {
    const defaultList = {
      id: uuid(),
      name: 'Minha lista',
      createdAt: new Date().toISOString()
    };
    lists = [defaultList];
    saveLists(lists);
    currentListId = defaultList.id;
    saveCurrentListId(currentListId);
  } else {
    currentListId = loadCurrentListId() || lists[0].id;
    saveCurrentListId(currentListId);
  }

  tasks = loadTasks(currentListId);
}

function renderSidebar() {
  if (!listContainerEl) return;

  listContainerEl.innerHTML = '';

  lists.forEach(list => {
    const li = document.createElement('li');
    li.className = 'sidebar-item' + (list.id === currentListId ? ' active' : '');
    li.dataset.id = list.id;
    li.textContent = list.name;
    listContainerEl.appendChild(li);
  });
}

function initSidebar() {
  ensureLists();
  renderSidebar();

  if (openSidebarBtn && sidebarEl) {
    openSidebarBtn.addEventListener('click', () => {
      sidebarEl.classList.add('open');
    });
  }

  if (closeSidebarBtn && sidebarEl) {
    closeSidebarBtn.addEventListener('click', () => {
      sidebarEl.classList.remove('open');
    });
  }

  if (listContainerEl) {
    listContainerEl.addEventListener('click', (e) => {
      const item = e.target.closest('.sidebar-item');
      if (!item) return;

      const id = item.dataset.id;
      if (!id || id === currentListId) return;

      currentListId = id;
      saveCurrentListId(id);
      tasks = loadTasks(currentListId);
      selectedIds.clear();
      renderSidebar();
      renderTasks();
      updateStats();
      showToast('Lista alterada.', 'success');
      if (sidebarEl) sidebarEl.classList.remove('open');
    });
  }

  if (newListBtn) {
    newListBtn.addEventListener('click', () => {
      const name = prompt('Nome da nova lista:');
      if (!name) return;

      const newList = {
        id: uuid(),
        name: name.trim(),
        createdAt: new Date().toISOString()
      };
      lists.push(newList);
      saveLists(lists);

      currentListId = newList.id;
      saveCurrentListId(currentListId);
      tasks = [];
      saveTasks(currentListId, tasks);

      renderSidebar();
      renderTasks();
      updateStats();

      showToast('Lista criada com sucesso!', 'success');
    });
  }
}

/* ========== PRIORITY PICKERS (criar / editar) ========== */

function setPriorityActive(container, value) {
  if (!container) return;
  container.querySelectorAll('.prio-btn').forEach(btn => {
    const p = btn.dataset.priority;
    btn.classList.toggle('active', p === value);
  });
}

function initPriorityPicker() {
  if (!priorityPickerEl) return;

  setPriorityActive(priorityPickerEl, newTaskPriority);

  priorityPickerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.prio-btn');
    if (!btn) return;

    const prio = btn.dataset.priority;
    if (!prio) return;

    newTaskPriority = prio;
    setPriorityActive(priorityPickerEl, prio);
  });

  if (editPriorityPicker) {
    editPriorityPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.prio-btn');
      if (!btn) return;

      const prio = btn.dataset.priority;
      if (!prio) return;

      editTaskPriority = prio;
      setPriorityActive(editPriorityPicker, prio);
    });
  }
}

/* ========== TAREFAS: ADIÇÃO ========== */

function addTask() {
  const text = taskInputEl?.value.trim();
  if (!text) {
    showToast('Digite uma tarefa.', 'warn');
    return;
  }

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
  taskInputEl.value = '';

  renderTasks();
  updateStats();
  showToast('Tarefa adicionada!', 'success');
}

function initTaskForm() {
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => addTask());
  }

  if (taskInputEl) {
    taskInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTask();
      }
    });
  }
}

/* ========== FILTROS / BUSCA ========== */

function initFilters() {
  if (filtersContainerEl) {
    filtersContainerEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      if (chip.dataset.filterState) {
        stateFilter = chip.dataset.filterState;
        filtersContainerEl.querySelectorAll('.chip').forEach(c => {
          if (c.dataset.filterState) {
            c.classList.toggle('active', c === chip);
          }
        });
      }

      if (chip.dataset.filterPriority) {
        const prio = chip.dataset.filterPriority;
        if (priorityFilter === prio) {
          priorityFilter = 'all';
          chip.classList.remove('active');
        } else {
          priorityFilter = prio;
          filtersContainerEl
            .querySelectorAll('.chip.prio-chip')
            .forEach(c => c.classList.toggle('active', c === chip));
        }
      }

      renderTasks();
    });
  }

  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      searchQuery = searchInputEl.value.trim().toLowerCase();
      renderTasks();
    });
  }
}

/* ========== BULK MODE ========== */

function updateBulkBar() {
  if (!bulkBarEl || !bulkCountEl) return;

  if (!selectionMode) {
    bulkBarEl.classList.add('hidden');
    bulkCountEl.textContent = '0 tarefas selecionadas';
    return;
  }

  bulkBarEl.classList.remove('hidden');
  const count = selectedIds.size;
  bulkCountEl.textContent = `${count} tarefa${count === 1 ? '' : 's'} selecionada${count === 1 ? '' : 's'}`;
}

function toggleSelectionMode(forceValue) {
  selectionMode = typeof forceValue === 'boolean' ? forceValue : !selectionMode;
  if (!selectionMode) selectedIds.clear();
  updateBulkBar();
  renderTasks();
}

function initBulkActions() {
  if (selectionModeBtn) {
    selectionModeBtn.addEventListener('click', () => {
      toggleSelectionMode();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's' && e.shiftKey) {
      e.preventDefault();
      toggleSelectionMode();
      showToast(`Modo seleção: ${selectionMode ? 'ativado' : 'desativado'}`, 'success');
    }
  });

  if (bulkExitBtn) {
    bulkExitBtn.addEventListener('click', () => {
      toggleSelectionMode(false);
    });
  }

  if (bulkDoneBtn) {
    bulkDoneBtn.addEventListener('click', () => {
      if (!selectedIds.size) return;
      tasks = tasks.map(t =>
        selectedIds.has(t.id) ? { ...t, done: true, updatedAt: new Date().toISOString() } : t
      );
      saveTasks(currentListId, tasks);
      selectedIds.clear();
      updateBulkBar();
      renderTasks();
      updateStats();
      showToast('Tarefas marcadas como concluídas.', 'success');
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      if (!selectedIds.size) return;
      if (!confirm('Excluir todas as tarefas selecionadas?')) return;

      tasks = tasks.filter(t => !selectedIds.has(t.id));
      saveTasks(currentListId, tasks);
      selectedIds.clear();
      updateBulkBar();
      renderTasks();
      updateStats();
      showToast('Tarefas excluídas.', 'success');
    });
  }

  bulkPrioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const prio = btn.dataset.bulkPriority;
      if (!prio || !selectedIds.size) return;

      const now = new Date().toISOString();

      tasks = tasks.map(t =>
        selectedIds.has(t.id)
          ? { ...t, priority: prio, updatedAt: now }
          : t
      );

      saveTasks(currentListId, tasks);
      renderTasks();
      updateStats();
      showToast(`Prioridade atualizada para ${prio}.`, 'success');
    });
  });
}

/* ========== EDIÇÃO DE TAREFA / SUBTAREFAS ========== */

function openEditModal(task) {
  if (!editDialog) return;

  currentEditTaskId = task.id;
  editTextEl.value = task.text;
  editTagsEl.value = (task.tags || []).join(', ');
  editDueDateEl.value = task.dueDate || '';
  editDueTimeEl.value = task.dueTime || '';
  editTaskPriority = task.priority || 'medium';
  setPriorityActive(editPriorityPicker, editTaskPriority);

  editSubtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
  renderSubtasks();
  editDialog.showModal();
}

function renderSubtasks() {
  if (!subtasksListEl) return;

  subtasksListEl.innerHTML = '';

  if (!editSubtasks.length) return;

  editSubtasks.forEach(st => {
    const li = document.createElement('li');
    li.className = 'subtask-item' + (st.done ? ' done' : '');
    li.dataset.id = st.id;
    li.innerHTML = `
      <input type="checkbox" ${st.done ? 'checked' : ''} data-action="toggle-subtask">
      <span>${st.text}</span>
      <button type="button" data-action="remove-subtask">✖</button>
    `;
    subtasksListEl.appendChild(li);
  });
}

function initEditModal() {
  if (!editDialog || !editForm) return;

  if (addSubtaskBtn && newSubtaskTextEl && subtasksListEl) {
    addSubtaskBtn.addEventListener('click', () => {
      const text = newSubtaskTextEl.value.trim();
      if (!text) return;

      editSubtasks.push({
        id: uuid(),
        text,
        done: false
      });

      newSubtaskTextEl.value = '';
      renderSubtasks();
    });

    subtasksListEl.addEventListener('click', (e) => {
      const li = e.target.closest('.subtask-item');
      if (!li) return;
      const id = li.dataset.id;
      if (!id) return;

      const action = e.target.dataset.action;
      if (action === 'remove-subtask') {
        editSubtasks = editSubtasks.filter(st => st.id !== id);
        renderSubtasks();
      }
    });

    subtasksListEl.addEventListener('change', (e) => {
      const li = e.target.closest('.subtask-item');
      if (!li) return;
      const id = li.dataset.id;
      if (!id) return;

      if (e.target.dataset.action === 'toggle-subtask') {
        editSubtasks = editSubtasks.map(st =>
          st.id === id ? { ...st, done: e.target.checked } : st
        );
        renderSubtasks();
      }
    });
  }

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentEditTaskId) return;

    const text = editTextEl.value.trim();
    if (!text) {
      showToast('A tarefa precisa de um texto.', 'warn');
      return;
    }

    const tags = editTagsEl.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const dueDate = editDueDateEl.value || null;
    const dueTime = editDueTimeEl.value || null;

    const now = new Date().toISOString();

    tasks = tasks.map(t =>
      t.id === currentEditTaskId
        ? {
            ...t,
            text,
            priority: editTaskPriority,
            tags,
            dueDate,
            dueTime,
            subtasks: editSubtasks,
            updatedAt: now
          }
        : t
    );

    saveTasks(currentListId, tasks);
    editDialog.close();
    currentEditTaskId = null;
    renderTasks();
    updateStats();
    showToast('Tarefa atualizada.', 'success');
  });

  editDialog.addEventListener('close', () => {
    currentEditTaskId = null;
  });
}

/* ========== RENDERIZAÇÃO DAS TAREFAS ========== */

function getFilteredTasks() {
  let filtered = [...tasks];

  // estado
  if (stateFilter === 'active') {
    filtered = filtered.filter(t => !t.done);
  } else if (stateFilter === 'done') {
    filtered = filtered.filter(t => t.done);
  }

  // prioridade
  if (priorityFilter !== 'all') {
    filtered = filtered.filter(t => t.priority === priorityFilter);
  }

  // tag
  if (tagFilter) {
    filtered = filtered.filter(t => (t.tags || []).includes(tagFilter));
  }

  // busca
  if (searchQuery) {
    filtered = filtered.filter(t =>
      t.text.toLowerCase().includes(searchQuery) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(searchQuery))
    );
  }

  return filtered;
}

function renderTasks() {
  if (!taskListEl || !emptyStateEl) return;

  const filtered = getFilteredTasks();

  if (!filtered.length) {
    taskListEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';

  const today = todayISODate();

  const itemsHtml = filtered
    .map(task => {
      const prioClass =
        task.priority === 'high'
          ? 'priority-high'
          : task.priority === 'low'
          ? 'priority-low'
          : 'priority-medium';

      const doneClass = task.done ? 'done' : '';

      const isOverdue =
        !task.done &&
        task.dueDate &&
        task.dueDate < today;

      const overdueMark = isOverdue ? '⚠️ Atrasada' : '';
      const tags = task.tags || [];
      const subtasks = task.subtasks || [];

      const selectedClass =
        selectionMode && selectedIds.has(task.id) ? ' selected' : '';

      const tagsHtml = tags
        .map(
          tag =>
            `<span class="tag-chip" data-tag="${tag}">${tag}</span>`
        )
        .join('');

      const subtasksInfo =
        subtasks.length > 0
          ? `<span>📌 ${subtasks.filter(s => s.done).length}/${subtasks.length} subtarefas</span>`
          : '';

      const dueLabel = formatDateLabel(task.dueDate, task.dueTime);

      return `
        <li class="item ${prioClass} ${doneClass} ${selectedClass}" data-id="${task.id}">
          <input type="checkbox" class="task-toggle" ${task.done ? 'checked' : ''} aria-label="Concluir tarefa">
          <div class="item-main">
            <div class="item-text">${task.text}</div>
            <div class="item-meta">
              <span><span class="priority-badge ${task.priority}"></span> ${
        task.priority === 'high'
          ? 'Alta'
          : task.priority === 'low'
          ? 'Baixa'
          : 'Média'
      }</span>
              <span>📅 ${dueLabel}</span>
              ${overdueMark ? `<span>${overdueMark}</span>` : ''}
              ${subtasksInfo}
            </div>
            ${
              tagsHtml
                ? `<div class="tag-list">${tagsHtml}</div>`
                : ''
            }
          </div>
          <div class="item-actions">
            ${
              selectionMode
                ? `<button class="icon" data-action="select" title="Selecionar">☑</button>`
                : ''
            }
            <button class="icon" data-action="edit" title="Editar">✏️</button>
            <button class="icon danger" data-action="delete" title="Excluir">🗑</button>
          </div>
        </li>
      `;
    })
    .join('');

  taskListEl.innerHTML = itemsHtml;
}

/* ========== EVENTOS NA LISTA (delegate) ========== */

function initTaskListEvents() {
  if (!taskListEl) return;

  // Toggle done
  taskListEl.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.task-toggle');
    if (!checkbox) return;

    const item = checkbox.closest('.item');
    if (!item) return;

    const id = item.dataset.id;
    const done = checkbox.checked;
    const now = new Date().toISOString();

    tasks = tasks.map(t =>
      t.id === id ? { ...t, done, updatedAt: now } : t
    );
    saveTasks(currentListId, tasks);

    renderTasks();
    updateStats();
  });

  // Ações: editar / excluir / selecionar
  taskListEl.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const item = button.closest('.item');
    if (!item) return;

    const id = item.dataset.id;
    const action = button.dataset.action;
    if (!id || !action) return;

    if (action === 'delete') {
      if (!confirm('Excluir esta tarefa?')) return;
      tasks = tasks.filter(t => t.id !== id);
      saveTasks(currentListId, tasks);
      selectedIds.delete(id);
      renderTasks();
      updateStats();
      showToast('Tarefa excluída.', 'success');
      return;
    }

    if (action === 'edit') {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      openEditModal(task);
      return;
    }

    if (action === 'select') {
      if (!selectionMode) return;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      updateBulkBar();
      renderTasks();
      return;
    }
  });

  // Clique em tags
  taskListEl.addEventListener('click', (e) => {
    const tagChip = e.target.closest('.tag-chip');
    if (!tagChip) return;

    const tag = tagChip.dataset.tag;
    if (!tag) return;

    if (tagFilter === tag) {
      tagFilter = null;
      showToast('Filtro de tag removido.', 'success');
    } else {
      tagFilter = tag;
      showToast(`Filtrando pela tag: ${tag}`, 'success');
    }
    renderTasks();
  });
}

/* ========== STATS / ANALYTICS ========== */

function updateStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const active = total - done;
  const today = todayISODate();

  const todayCount = tasks.filter(t =>
    (t.createdAt || '').slice(0, 10) === today
  ).length;

  const overdueCount = tasks.filter(t =>
    !t.done &&
    t.dueDate &&
    t.dueDate < today
  ).length;

  if (totalCountEl) totalCountEl.textContent = total;
  if (doneCountEl) doneCountEl.textContent = done;
  if (activeCountEl) activeCountEl.textContent = active;
  if (overdueCountEl) overdueCountEl.textContent = overdueCount;
  if (todayCountEl) todayCountEl.textContent = todayCount;

  const percent = total ? Math.round((done / total) * 100) : 0;

  if (donePercentLabelEl) donePercentLabelEl.textContent = percent + '%';
  if (donePercentBarEl) donePercentBarEl.style.width = percent + '%';
}

/* ========== CLEAR DONE ========== */

function initClearDone() {
  if (!clearDoneBtn) return;

  clearDoneBtn.addEventListener('click', () => {
    if (!tasks.some(t => t.done)) {
      showToast('Não há tarefas concluídas para limpar.', 'warn');
      return;
    }

    if (!confirm('Remover todas as tarefas concluídas?')) return;

    tasks = tasks.filter(t => !t.done);
    saveTasks(currentListId, tasks);
    renderTasks();
    updateStats();
    showToast('Tarefas concluídas removidas.', 'success');
  });
}

/* ========== EXPORTAÇÃO / IMPORTAÇÃO ========== */

function tasksToPlainObjects() {
  return tasks.map(t => ({
    id: t.id,
    text: t.text,
    done: t.done,
    priority: t.priority,
    tags: (t.tags || []).join(', '),
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }));
}

function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initExportImport() {
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const data = {
        listId: currentListId,
        tasks
      };
      const str = JSON.stringify(data, null, 2);
      const fileName = `todohub-tarefas-${todayISODate()}.json`;
      downloadFile(fileName, str, 'application/json');
      showToast('JSON exportado.', 'success');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const plain = tasksToPlainObjects();
      if (!plain.length) {
        showToast('Nenhuma tarefa para exportar.', 'warn');
        return;
      }

      const headers = Object.keys(plain[0]);
      const rows = plain.map(obj =>
        headers.map(h => `"${String(obj[h] ?? '').replace(/"/g, '""')}"`).join(';')
      );
      const csv = [headers.join(';'), ...rows].join('\n');
      const fileName = `todohub-tarefas-${todayISODate()}.csv`;
      downloadFile(fileName, csv, 'text/csv');
      showToast('CSV exportado.', 'success');
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') {
        showToast('Biblioteca XLSX não carregada.', 'error');
        return;
      }

      const plain = tasksToPlainObjects();
      if (!plain.length) {
        showToast('Nenhuma tarefa para exportar.', 'warn');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(plain);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tarefas');
      const fileName = `todohub-tarefas-${todayISODate()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Excel exportado.', 'success');
    });
  }

  if (importJsonInput) {
    importJsonInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const parsed = JSON.parse(content);

          let importedTasks = [];
          if (Array.isArray(parsed)) {
            importedTasks = parsed;
          } else if (Array.isArray(parsed.tasks)) {
            importedTasks = parsed.tasks;
          } else {
            throw new Error('Formato inválido');
          }

          // tentativa de normalizar
          importedTasks = importedTasks.map(t => ({
            id: t.id || uuid(),
            text: t.text || '',
            done: !!t.done,
            priority: t.priority || 'medium',
            tags: Array.isArray(t.tags)
              ? t.tags
              : typeof t.tags === 'string'
              ? t.tags.split(',').map(v => v.trim()).filter(Boolean)
              : [],
            dueDate: t.dueDate || null,
            dueTime: t.dueTime || null,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
            subtasks: Array.isArray(t.subtasks) ? t.subtasks : []
          }));

          tasks = importedTasks;
          saveTasks(currentListId, tasks);
          renderTasks();
          updateStats();
          showToast('Tarefas importadas com sucesso.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Erro ao importar JSON.', 'error');
        } finally {
          e.target.value = '';
        }
      };

      reader.readAsText(file);
    });
  }
}

/* ========== INICIALIZAÇÃO GERAL ========== */

function initApp() {
  initSidebar();
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

/* ========== EXPORT PARA O AUTH.JS USAR ========== */
// Agora o auth.js consegue chamar Main.reloadForUser()
export const Main = {
  reloadForUser() {
    // No futuro podemos recarregar dados do Supabase aqui.
    // Por enquanto, recarrega a página inteira.
    window.location.reload();
  }
};

// DOM já está pronto porque os scripts estão no final do <body>
initApp();

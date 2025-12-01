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

import { Supabase } from './supabase.js';

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

let currentUserId = null; // usuário logado no Supabase (ou null se offline/local)

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

async function getCurrentUserId() {
  try {
    const { data, error } = await Supabase.client.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    console.warn('Erro ao obter usuário atual do Supabase:', err);
    return null;
  }
}

/* ========== SUPABASE: LISTAS ========== */

async function fetchListsFromDB(userId) {
  try {
    const { data, error } = await Supabase.client
      .from('users_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar listas no Supabase:', error);
      return null;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at
    }));
  } catch (err) {
    console.warn('Erro de rede ao buscar listas:', err);
    return null;
  }
}

async function createListInDB(userId, name) {
  try {
    const { data, error } = await Supabase.client
      .from('users_lists')
      .insert({
        user_id: userId,
        name
      })
      .select()
      .single();

    if (error) {
      console.warn('Erro ao criar lista no Supabase:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at
    };
  } catch (err) {
    console.warn('Erro de rede ao criar lista:', err);
    return null;
  }
}

/* ========== SUPABASE: TAREFAS ========== */

async function loadTasksForList(userId, listId) {
  if (!listId) return [];

  // Sem usuário → usa apenas localStorage
  if (!userId) {
    return loadTasks(listId);
  }

  try {
    const { data, error } = await Supabase.client
      .from('users_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar tarefas no Supabase:', error);
      return loadTasks(listId);
    }

    const mapped = (data || []).map(row => ({
      id: row.id,
      text: row.text,
      done: row.done,
      priority: row.priority || 'medium',
      tags: row.tags || [],
      dueDate: row.due_date,
      dueTime: row.due_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subtasks: row.subtasks || []
    }));

    // espelho local
    saveTasks(listId, mapped);
    return mapped;
  } catch (err) {
    console.warn('Erro de rede ao buscar tarefas:', err);
    return loadTasks(listId);
  }
}

async function createTaskInDB(task) {
  if (!currentUserId || !currentListId) return;

  try {
    const { error } = await Supabase.client
      .from('users_tasks')
      .insert({
        id: task.id,          // usamos o mesmo id do app
        user_id: currentUserId,
        list_id: currentListId,
        text: task.text,
        done: task.done,
        priority: task.priority,
        tags: task.tags,
        due_date: task.dueDate,
        due_time: task.dueTime,
        subtasks: task.subtasks,
        created_at: task.createdAt,
        updated_at: task.updatedAt
      });

    if (error) {
      console.warn('Erro ao criar tarefa no Supabase:', error);
    }
  } catch (err) {
    console.warn('Erro de rede ao criar tarefa:', err);
  }
}

async function updateTaskInDB(task) {
  if (!currentUserId || !currentListId) return;

  try {
    const { error } = await Supabase.client
      .from('users_tasks')
      .update({
        text: task.text,
        done: task.done,
        priority: task.priority,
        tags: task.tags,
        due_date: task.dueDate,
        due_time: task.dueTime,
        subtasks: task.subtasks,
        updated_at: task.updatedAt
      })
      .eq('id', task.id)
      .eq('user_id', currentUserId)
      .eq('list_id', currentListId);

    if (error) {
      console.warn('Erro ao atualizar tarefa no Supabase:', error);
    }
  } catch (err) {
    console.warn('Erro de rede ao atualizar tarefa:', err);
  }
}

async function deleteTaskInDB(taskId) {
  if (!currentUserId || !currentListId) return;

  try {
    const { error } = await Supabase.client
      .from('users_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', currentUserId)
      .eq('list_id', currentListId);

    if (error) {
      console.warn('Erro ao deletar tarefa no Supabase:', error);
    }
  } catch (err) {
    console.warn('Erro de rede ao deletar tarefa:', err);
  }
}

async function deleteDoneTasksInDB() {
  if (!currentUserId || !currentListId) return;

  try {
    const { error } = await Supabase.client
      .from('users_tasks')
      .delete()
      .eq('user_id', currentUserId)
      .eq('list_id', currentListId)
      .eq('done', true);

    if (error) {
      console.warn('Erro ao deletar tarefas concluídas no Supabase:', error);
    }
  } catch (err) {
    console.warn('Erro de rede ao deletar concluídas:', err);
  }
}

/* ========== LISTAS / SIDEBAR ========== */

async function ensureLists() {
  // Se não tiver user logado, mantém comportamento local anterior
  if (!currentUserId) {
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
    return;
  }

  // Com user logado → busca listas do Supabase
  const remoteLists = await fetchListsFromDB(currentUserId);

  if (!remoteLists || remoteLists.length === 0) {
    // Cria lista padrão no Supabase
    const created = await createListInDB(currentUserId, 'Minha lista');
    const defaultList = created || {
      id: uuid(),
      name: 'Minha lista',
      createdAt: new Date().toISOString()
    };
    lists = [defaultList];
  } else {
    lists = remoteLists;
  }

  saveLists(lists);

  currentListId = loadCurrentListId() || (lists[0] && lists[0].id);
  if (!currentListId && lists[0]) {
    currentListId = lists[0].id;
    saveCurrentListId(currentListId);
  }

  tasks = await loadTasksForList(currentUserId, currentListId);
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

async function initSidebar() {
  await ensureLists();
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
    listContainerEl.addEventListener('click', async (e) => {
      const item = e.target.closest('.sidebar-item');
      if (!item) return;

      const id = item.dataset.id;
      if (!id || id === currentListId) return;

      currentListId = id;
      saveCurrentListId(id);

      // Carrega tarefas da lista selecionada (Supabase ou local)
      tasks = await loadTasksForList(currentUserId, currentListId);

      selectedIds.clear();
      renderSidebar();
      renderTasks();
      updateStats();
      showToast('Lista alterada.', 'success');
      if (sidebarEl) sidebarEl.classList.remove('open');
    });
  }

  if (newListBtn) {
    newListBtn.addEventListener('click', async () => {
      const name = prompt('Nome da nova lista:');
      if (!name) return;

      const trimmed = name.trim();
      if (!trimmed) return;

      let newList;

      if (currentUserId) {
        const created = await createListInDB(currentUserId, trimmed);
        newList = created || {
          id: uuid(),
          name: trimmed,
          createdAt: new Date().toISOString()
        };
      } else {
        newList = {
          id: uuid(),
          name: trimmed,
          createdAt: new Date().toISOString()
        };
      }

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

async function addTask() {
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

  // Envia para Supabase (se usuário logado)
  await createTaskInDB(task);

  taskInputEl.value = '';

  renderTasks();
  updateStats();
  showToast('Tarefa adicionada!', 'success');
}

function initTaskForm() {
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => { addTask(); });
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
    bulkDoneBtn.addEventListener('click', async () => {
      if (!selectedIds.size) return;
      const now = new Date().toISOString();

      tasks = tasks.map(t =>
        selectedIds.has(t.id) ? { ...t, done: true, updatedAt: now } : t
      );
      saveTasks(currentListId, tasks);

      // Atualiza no Supabase
      const toUpdate = tasks.filter(t => selectedIds.has(t.id));
      for (const t of toUpdate) {
        await updateTaskInDB(t);
      }

      selectedIds.clear();
      updateBulkBar();
      renderTasks();
      updateStats();
      showToast('Tarefas marcadas como concluídas.', 'success');
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async () => {
      if (!selectedIds.size) return;
      if (!confirm('Excluir todas as tarefas selecionadas?')) return;

      const idsToDelete = Array.from(selectedIds);

      tasks = tasks.filter(t => !selectedIds.has(t.id));
      saveTasks(currentListId, tasks);

      // Supabase
      for (const id of idsToDelete) {
        await deleteTaskInDB(id);
      }

      selectedIds.clear();
      updateBulkBar();
      renderTasks();
      updateStats();
      showToast('Tarefas excluídas.', 'success');
    });
  }

  bulkPrioButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const prio = btn.dataset.bulkPriority;
      if (!prio || !selectedIds.size) return;

      const now = new Date().toISOString();

      tasks = tasks.map(t =>
        selectedIds.has(t.id)
          ? { ...t, priority: prio, updatedAt: now }
          : t
      );

      saveTasks(currentListId, tasks);

      const toUpdate = tasks.filter(t => selectedIds.has(t.id));
      for (const t of toUpdate) {
        await updateTaskInDB(t);
      }

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

  editForm.addEventListener('submit', async (e) => {
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

    let updatedTask = null;

    tasks = tasks.map(t => {
      if (t.id === currentEditTaskId) {
        const newT = {
          ...t,
          text,
          priority: editTaskPriority,
          tags,
          dueDate,
          dueTime,
          subtasks: editSubtasks,
          updatedAt: now
        };
        updatedTask = newT;
        return newT;
      }
      return t;
    });

    saveTasks(currentListId, tasks);

    if (updatedTask) {
      await updateTaskInDB(updatedTask);
    }

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
  taskListEl.addEventListener('change', async (e) => {
    const checkbox = e.target.closest('.task-toggle');
    if (!checkbox) return;

    const item = checkbox.closest('.item');
    if (!item) return;

    const id = item.dataset.id;
    const done = checkbox.checked;
    const now = new Date().toISOString();

    let updatedTask = null;

    tasks = tasks.map(t => {
      if (t.id === id) {
        const newT = { ...t, done, updatedAt: now };
        updatedTask = newT;
        return newT;
      }
      return t;
    });

    saveTasks(currentListId, tasks);

    if (updatedTask) {
      await updateTaskInDB(updatedTask);
    }

    renderTasks();
    updateStats();
  });

  // Ações: editar / excluir / selecionar / tags
  taskListEl.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    const tagChip = e.target.closest('.tag-chip');

    // Clique em tag
    if (tagChip) {
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
      return;
    }

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

      await deleteTaskInDB(id);

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

  clearDoneBtn.addEventListener('click', async () => {
    if (!tasks.some(t => t.done)) {
      showToast('Não há tarefas concluídas para limpar.', 'warn');
      return;
    }

    if (!confirm('Remover todas as tarefas concluídas?')) return;

    tasks = tasks.filter(t => !t.done);
    saveTasks(currentListId, tasks);

    await deleteDoneTasksInDB();

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
    importJsonInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
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

          // Sobe pro Supabase (se logado)
          if (currentUserId && currentListId) {
            // apaga tarefas existentes dessa lista no Supabase e reimporta
            try {
              await Supabase.client
                .from('users_tasks')
                .delete()
                .eq('user_id', currentUserId)
                .eq('list_id', currentListId);

              const payload = importedTasks.map(t => ({
                id: t.id,
                user_id: currentUserId,
                list_id: currentListId,
                text: t.text,
                done: t.done,
                priority: t.priority,
                tags: t.tags,
                due_date: t.dueDate,
                due_time: t.dueTime,
                subtasks: t.subtasks,
                created_at: t.createdAt,
                updated_at: t.updatedAt
              }));

              if (payload.length) {
                await Supabase.client.from('users_tasks').insert(payload);
              }
            } catch (err) {
              console.warn('Erro ao sincronizar importação com Supabase:', err);
            }
          }

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

async function initApp() {
  currentUserId = await getCurrentUserId();

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

// Função para o auth.js chamar depois de login/signup
async function reloadForUser() {
  currentUserId = await getCurrentUserId();
  await ensureLists();
  renderSidebar();
  tasks = await loadTasksForList(currentUserId, currentListId);
  renderTasks();
  updateStats();
  showToast('Dados sincronizados para o seu usuário.', 'success');
}

// Exporta para o auth.js
export const Main = {
  reloadForUser
};

// DOM já está pronto porque os scripts estão no final do <body>
initApp();


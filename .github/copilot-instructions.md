# Instruções para Agentes de IA - TodoHub

## Arquitetura e Organização

O TodoHub é um aplicativo web PWA de lista de tarefas que implementa um gerenciador de tarefas com autenticação local e armazenamento por usuário. Construído com foco em performance, acessibilidade e experiência do usuário.

### Estrutura de Arquivos
```
/
├── index.html           # Interface principal
├── main.js             # Core da aplicação (CRUD)
├── auth.js             # Sistema de autenticação local
├── storage.js          # Persistência de dados
├── theme.js            # Gerenciamento de tema
├── service-worker.js   # Cache e instalação PWA
├── sw-register.js      # Registro do service worker
├── manifest.json       # Configuração PWA
└── style.css          # Estilos globais e temas
```

## Iniciando o Projeto

### Ambiente de Desenvolvimento
```bash
# Iniciar servidor local (necessário para PWA)
python -m http.server 8080

# Ou usando PHP
php -S localhost:8080

# Ou usando Node.js
npx serve .
```

## Padrões de Código

### 1. Module Pattern
```javascript
const ModuleName = (() => {
  // Estado privado
  let privateState = [];
  
  // Métodos privados
  const privateMethod = () => {};
  
  // Interface pública
  return { 
    publicMethod: () => {} 
  };
})();
```

### 2. Manipulação de Eventos e Feedback

#### Delegação de Eventos
```javascript
parentElement.addEventListener('click', (e) => {
  if (e.target.matches('.item-action')) {
    handleAction(e.target.dataset.id);
  }
});
```

#### Sistema de Notificações
```javascript
const notify = (message) => {
  const element = document.getElementById('notification');
  if (element) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 1800);
  }
};
```

### 3. Convenções HTML/CSS
- IDs: camelCase para JavaScript (`taskList`, `userDropdown`)
- Classes: kebab-case para CSS (`item-actions`, `user-avatar`)
- Data attributes para metadados: `data-id`, `data-filter`
- ARIA labels obrigatórios para acessibilidade

## Fluxos de Desenvolvimento

### 1. Ciclo de Vida dos Dados
```javascript
// 1. Carregar dados do Storage
const tasks = Storage.getTasks();

// 2. Modificar estado local
tasks.push({
  id: crypto.randomUUID(),
  text: 'Nova tarefa',
  done: false
});

// 3. Persistir mudanças
Storage.setTasks(tasks);

// 4. Atualizar interface
render();

// 5. Feedback ao usuário
showToast('✅ Ação concluída!');
```

### 2. Autenticação e Namespace
```javascript
// Formato de chaves no localStorage
todohub_tasks_user@email.com  // Dados do usuário
todohub_theme                 // Preferências globais

// Fluxo de autenticação completo
Auth.login(name, email, allowCollab);  // Login com opção de colaboração
Auth.logout();                         // Cleanup e redireção
Auth.getUser();                        // Obtém dados do usuário atual

// Exemplo de uso
Auth.login('João', 'joao@email.com', true);  // Login com colaboração
const tasks = Storage.getTasks();            // Obtém tarefas do usuário atual
```

### 3. Sistema PWA e Service Worker

#### Configuração PWA (manifest.json)
```json
{
  "name": "TodoHub",
  "display": "standalone",
  "start_url": "./index.html",
  "background_color": "rgb(13, 17, 23)",
  "theme_color": "rgb(0, 188, 212)",
  "icons": [
    {
      "src": "assets/icons/icon-192.png",
      "sizes": "192x192"
    }
  ]
}
```

#### Service Worker (service-worker.js)
```javascript
const CACHE = 'todohub-v1';
const ASSETS = ['./', './index.html', './css/style.css'];

// Instalação e cache
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

// Network falling back to cache
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
```

## Pontos de Integração

### 1. Sistema de Temas
```javascript
// Alternar tema
Theme.toggle();               // Alterna claro/escuro
Theme.set('dark');           // Define tema específico
Theme.current();             // Obtém tema atual
```

### 2. Service Worker
```javascript
// Registro do Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      console.log('Service worker registrado:', reg.scope);
    } catch (err) {
      console.error('Falha ao registrar service worker:', err);
    }
  });
}
```

## Interações e UI

### 1. Animações e Transições
```css
/* Transições suaves */
.item { 
  transition: transform 0.2s, opacity 0.2s; 
}

/* Feedback hover */
.btn:hover { 
  transform: translateY(-1px); 
}

/* Animação de remoção */
@keyframes fadeOut {
  to { 
    opacity: 0; 
    transform: translateY(-10px); 
  }
}
```

### 2. Normalização e Validação de Texto
```javascript
/**
 * Normaliza texto para busca:
 * - Remove acentos e diacríticos
 * - Converte para minúsculas
 * - Remove espaços extras
 */
const normalizeText = (text) => text
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim();

// Exemplo de validação de input
function validateTaskText(text) {
  const normalized = text.trim();
  if (!normalized) {
    showToast('⚠️ Digite uma tarefa.');
    return false;
  }
  return normalized;
}
```

### 3. Sistema de Colaboração
```javascript
// Login com opção de colaboração
const login = (name, email, allowCollab = false) => {
  const user = { 
    name, 
    email: email.toLowerCase().trim(), 
    allowCollab: !!allowCollab 
  };
  Storage.setPref('current_user', user);
};

// Verificação de permissões
const canCollaborate = () => Auth.getUser()?.allowCollab || false;
```

## Solução de Problemas

### 1. Dados Corrompidos
```javascript
// Validação defensiva
try {
  const data = JSON.parse(localStorage.getItem(key));
  if (!Array.isArray(data)) throw new Error();
  return data;
} catch {
  return []; // Estado inicial seguro
}
```

### 2. Conflitos de Estado
```javascript
// Sincronização de estado
const save = () => {
  Storage.setTasks(tasks);  // Persistir
  render();                 // Atualizar UI
  updateCounters();         // Atualizar métricas
};

// Validação antes de salvar
const addTask = (text) => {
  const value = text.trim();
  if (!value) return toast('⚠️ Digite uma tarefa.');
  // ... resto do código
};
```

## Convenções de Acessibilidade
```html
<!-- Uso correto de ARIA -->
<button 
  class="icon" 
  aria-label="Excluir tarefa"
  title="Excluir">🗑️</button>

<!-- Estados interativos -->
<div 
  role="dialog"
  aria-labelledby="dialogTitle"
  aria-modal="true">
  <!-- conteúdo -->
</div>
```

## Dicas de Performance
```javascript
// Debounce em operações frequentes
searchInput.addEventListener('input', debounce(function(e) {
  updateSearch(e.target.value);
}, 300));

// Delegação de eventos para eficiência
taskList.addEventListener('click', function(e) {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  
  handleTaskAction(action.dataset.action);
});
```

---
Nota: Este documento é mantido junto com o código. Atualize-o quando adicionar novos padrões ou convenções.
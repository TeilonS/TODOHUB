# 📝 TodoHub — Gerenciador de Tarefas (HTML, CSS, JS)

**TodoHub** é um aplicativo web moderno de lista de tarefas, feito com **HTML5, CSS3 e JavaScript puro**, com **tema Dark/Light**, **login local** (simulado) e **persistência via LocalStorage**. Preparado para **PWA** (instalação no celular/desktop) e expansão futura (colaboração e sincronização).

## 🚀 Funcionalidades
- Adicionar, concluir, editar e remover tarefas
- Filtros (Todos | Ativo | Concluído) + **busca instantânea**
- Contadores: total, ativo, concluído
- **Dark/Light Mode** com persistência
- **Login local** (nome/e-mail) — dados isolados por usuário (`tasks_<email>`)
- **Toasts** de feedback
- PWA básico (manifest + service worker)

## 🧱 Estrutura
todo-hub/
├── index.html
├── css/style.css
├── js/main.js
├── js/storage.js
├── js/theme.js
├── js/auth.js
├── js/sw-register.js
├── manifest.json
├── service-worker.js
└── assets/
├── icons/
└── screenshots/
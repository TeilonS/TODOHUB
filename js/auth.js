/* auth.js
   "Login" local sem backend: nome + e-mail. Usado apenas para
   separar os dados no LocalStorage por usuário.
*/
const Auth = (() => {
  const KEY = 'current_user';

  const getUser  = () => Storage.getPref(KEY) || null;
  const getEmail = () => (getUser()?.email || null);
  const getName  = () => (getUser()?.name  || null);

  const login = (name, email, allowCollab = false) => {
    const user = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      allowCollab: !!allowCollab
    };
    Storage.setPref(KEY, user);
    return user;
  };

  const logout = () => {
    const email = getEmail();
    Storage.setPref(KEY, null); // mantém tasks; apenas sai
    return email;
  };

  // Atualiza elementos do cabeçalho e o dropdown
  const paintHeader = () => {
    const user = getUser();
    const name = user?.name || 'Convidado';
    const email = user?.email || '-';

    const avatar   = document.getElementById('userAvatar');
    const avatarLg = document.getElementById('userAvatarLg');
    const userName = document.getElementById('userName');
    const ddName   = document.getElementById('userDropdownName');
    const ddEmail  = document.getElementById('userDropdownEmail');

    const initial = (name?.[0] || '?').toUpperCase();
    [avatar, avatarLg].forEach(el => { if (el) el.textContent = initial; });
    if (userName) userName.textContent = name;
    if (ddName)   ddName.textContent = name;
    if (ddEmail)  ddEmail.textContent = email;
  };

  const initUI = () => {
    paintHeader();

    // Menu do usuário (abre/fecha)
    const userBtn  = document.getElementById('userButton');
    const dropdown = document.getElementById('userDropdown');
    if (userBtn && dropdown) {
      let open = false;
      const setOpen = (v) => {
        open = v;
        userBtn.setAttribute('aria-expanded', String(v));
        dropdown.setAttribute('aria-hidden', String(!v));
        dropdown.classList.toggle('open', v);
      };
      userBtn.addEventListener('click', () => setOpen(!open));
      window.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) setOpen(false);
      });
    }

    // Botões do dropdown
    document.getElementById('openLogin')?.addEventListener('click', () => {
      document.getElementById('loginDialog').showModal();
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      logout();
      paintHeader();
      document.getElementById('loginDialog').showModal();
    });

    // Exige login se não houver usuário
    if (!getUser()) {
      document.getElementById('loginDialog').showModal();
    }

    // Formulário de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name  = document.getElementById('loginName').value.trim();
        const email = document.getElementById('loginEmail').value.trim();
        const allow = document.getElementById('allowCollab').checked;
        if (!name || !email) return;

        login(name, email, allow);
        document.getElementById('loginDialog').close();

        // Atualiza cabeçalho + recarrega dados do usuário nas tasks
        paintHeader();
        if (typeof Main?.reloadForUser === 'function') {
          Main.reloadForUser();
        }
        if (typeof Main?.toast === 'function') {
          Main.toast(`👋 Bem-vindo, ${name}!`);
        }
      });
    }
  };

  return { getUser, getEmail, getName, login, logout, initUI, paintHeader };
})();

// Inicializa UI de autenticação quando o DOM estiver pronto

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.initUI());
} else {
  Auth.initUI();
}


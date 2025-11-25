/* auth.js — sistema de login local sem backend */

import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Main } from "./main.js";

export const Auth = (() => {

  const USER_KEY = "current_user";

  const getUser = () => Storage.getPref(USER_KEY);
  const getEmail = () => getUser()?.email || null;
  const getName = () => getUser()?.name || null;

  const login = (name, email, collab = false) => {
    const user = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      allowCollab: !!collab
    };
    Storage.setPref(USER_KEY, user);
    return user;
  };

  const logout = () => {
    Storage.setPref(USER_KEY, null);
  };

  const paintHeader = () => {
    const user = getUser();
    const name = user?.name || "Convidado";
    const email = user?.email || "-";

    const initial = name[0].toUpperCase();

    const a = document.getElementById("userAvatar");
    const b = document.getElementById("userAvatarLg");

    a.textContent = initial;
    b.textContent = initial;

    document.getElementById("userDropdownName").textContent = name;
    document.getElementById("userDropdownEmail").textContent = email;
  };

  const initUI = () => {
    paintHeader();

    const dialog = document.getElementById("loginDialog");

    /* abrir menu */
    const btn = document.getElementById("userButton");
    const drop = document.getElementById("userDropdown");

    if (btn && drop) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        drop.classList.toggle("open");
      });

      document.addEventListener("click", () => drop.classList.remove("open"));
    }

    /* trocar usuário */
    document.getElementById("openLogin")?.addEventListener("click", () => dialog.showModal());

    /* sair */
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      logout();
      paintHeader();
      dialog.showModal();
    });

    /* exigir login na 1ª vez */
    if (!getUser()) dialog.showModal();

    /* form login */
    document.getElementById("loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const name  = document.getElementById("loginName").value.trim();
      const email = document.getElementById("loginEmail").value.trim();
      const collab = document.getElementById("allowCollab").checked;

      if (!name || !email) return;

      login(name, email, collab);

      dialog.close();
      paintHeader();
      Main.reloadForUser();
      UI.toast(`👋 Olá, ${name}!`);
    });
  };

  return { getUser, getEmail, getName, login, logout, paintHeader, initUI };

})();

document.addEventListener("DOMContentLoaded", Auth.initUI);

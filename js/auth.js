/* auth.js — Login real usando Supabase + criação automática de perfil + UI do usuário */

import { Supabase } from "./supabase.js";
import { UI } from "./ui.js";
import { Main } from "./main.js";

export const Auth = (() => {

  // =============================================================
  // SESSION — pega usuário autenticado
  // =============================================================
  const getSessionUser = async () => {
    const { data } = await Supabase.client.auth.getUser();
    return data?.user || null;
  };

  // =============================================================
  // Banco: cria perfil na tabela users_profiles
  // =============================================================
  const createUserProfile = async (id, name, email) => {
    const { error } = await Supabase.client
      .from("users_profiles")
      .insert({
        id,
        name,
        email
      });

    if (error) {
      console.warn("⚠ Erro ao criar perfil:", error);
    }
  };

  // =============================================================
  // LOGIN
  // =============================================================
  const login = async (email, password) => {
    return await Supabase.client.auth.signInWithPassword({
      email,
      password
    });
  };

  // =============================================================
  // SIGNUP — cria user e registra no banco
  // =============================================================
  const signup = async (name, email, password) => {
    const { data, error } = await Supabase.client.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) return { error };

    const user = data.user;

    await createUserProfile(user.id, name, email);

    return { data };
  };

  // =============================================================
  // LOGOUT
  // =============================================================
  const logout = async () => {
    await Supabase.client.auth.signOut();
    updateUserUI(null);
    UI.toast("Sessão encerrada.");
  };

  // =============================================================
  // UI — atualiza avatar, nome e email do usuário
  // =============================================================
  const updateUserUI = (user) => {
    const avatar = document.getElementById("userAvatar");
    const avatarLg = document.getElementById("userAvatarLg");
    const nameEl = document.getElementById("userDropdownName");
    const emailEl = document.getElementById("userDropdownEmail");

    if (!user) {
      if (avatar) avatar.textContent = "?";
      if (avatarLg) avatarLg.textContent = "?";
      if (nameEl) nameEl.textContent = "Convidado";
      if (emailEl) emailEl.textContent = "-";
      return;
    }

    const name = user.user_metadata?.name || "Usuário";
    const email = user.email || "-";
    const letter = name.charAt(0).toUpperCase();

    if (avatar) avatar.textContent = letter;
    if (avatarLg) avatarLg.textContent = letter;
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
  };

  // =============================================================
  // FLUXO DE LOGIN / SIGNUP
  // =============================================================
  const initUI = async () => {
    const dialog = document.getElementById("loginDialog");
    const form = document.getElementById("loginForm");

    // Verifica session ativa
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      dialog.showModal();
    } else {
      updateUserUI(sessionUser);
    }

    // ---------------------------
    // SUBMIT LOGIN / SIGNUP
    // ---------------------------
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name  = document.getElementById("loginName").value.trim();
      const email = document.getElementById("loginEmail").value.trim();
      const pass  = document.getElementById("loginPassword").value.trim();

      if (pass.length < 6) {
        UI.toast("A senha deve ter ao menos 6 caracteres.", "error");
        return;
      }

      // 1) Tenta login
      let { data, error } = await login(email, pass);

      // Se login falhar → cria conta automaticamente
      if (error && error.message.includes("Invalid login credentials")) {
        const res = await signup(name, email, pass);

        if (res.error) {
          UI.toast("Erro ao criar conta.", "error");
          return;
        }

        UI.toast("Conta criada! Bem-vindo(a)!");
        const newUser = res.data.user;
        updateUserUI(newUser);

        dialog.close();
        Main.reloadForUser();
        return;
      }

      // Qualquer outro erro
      if (error) {
        UI.toast("Erro ao fazer login.", "error");
        return;
      }

      UI.toast("Bem-vindo de volta!");

      updateUserUI(data.user);
      dialog.close();
      Main.reloadForUser();
    });

    // ---------------------------
    // BOTÃO: SAIR
    // ---------------------------
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await logout();
      dialog.showModal();
    });

    // ---------------------------
    // BOTÃO: TROCAR USUÁRIO
    // ---------------------------
    document.getElementById("openLogin")?.addEventListener("click", () => {
      dialog.showModal();
    });
  };

  return {
    initUI,
    logout,
    updateUserUI
  };

})();

// Inicializa
document.addEventListener("DOMContentLoaded", Auth.initUI);


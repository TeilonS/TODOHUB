/* ============================================================
   auth.js — Autenticação completa do TodoHub
   Login + Signup automático
   Lembrar sessão
   Login Social (Google / GitHub / Apple)
   Avatar automático
   Integração total com users_profiles, users_lists, users_tasks
   Remoção completa da conta (modo seguro)
============================================================ */

import { Supabase } from "./supabase.js";
import { showToast } from "./ui.js";
import { Main } from "./main.js";

export const Auth = (() => {

  /* ============================================================
     Usuário da sessão
  ============================================================= */
  const getSessionUser = async () => {
    const { data } = await Supabase.client.auth.getUser();
    return data?.user || null;
  };

  /* ============================================================
     Criação automática de perfil
  ============================================================= */
  const createUserProfile = async (id, name, email, avatar = null) => {
    await Supabase.client
      .from("users_profiles")
      .upsert({ id, name, email, avatar });
  };

  /* ============================================================
     Avatar Automático
  ============================================================= */
  const generateAvatarLetter = (name) =>
    (name ? name.charAt(0).toUpperCase() : "?");

  const getProfileAvatar = async (user) => {
    const { data } = await Supabase.client
      .from("users_profiles")
      .select("avatar")
      .eq("id", user.id)
      .single();

    return data?.avatar || null;
  };

  /* ============================================================
     LOGIN & SIGNUP
  ============================================================= */
  const login = (email, password) => {
    return Supabase.client.auth.signInWithPassword({ email, password });
  };

  const signup = async (name, email, password) => {
    const { data, error } = await Supabase.client.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) return { error };

    await createUserProfile(data.user.id, name, email);
    return { data };
  };

  /* ============================================================
     LOGIN SOCIAL
  ============================================================= */
  const loginWithGoogle = () =>
    Supabase.client.auth.signInWithOAuth({ provider: "google" });

  const loginWithGithub = () =>
    Supabase.client.auth.signInWithOAuth({ provider: "github" });

  const loginWithApple = () =>
    Supabase.client.auth.signInWithOAuth({ provider: "apple" });

  /* ============================================================
     LOGOUT
  ============================================================= */
  const logout = async () => {
    await Supabase.client.auth.signOut();
    updateUserUI(null);
    Main.clearAll();
    showToast("Sessão encerrada.");
  };

  /* ============================================================
     EXCLUSÃO DE CONTA
  ============================================================= */
  const deleteAccount = async () => {
    const user = await getSessionUser();
    if (!user) return;

    // Apaga dados específicos
    await Supabase.client.from("users_tasks").delete().eq("user_id", user.id);
    await Supabase.client.from("users_lists").delete().eq("user_id", user.id);
    await Supabase.client.from("users_profiles").delete().eq("id", user.id);

    // 🔥 IMPORTANTE:
    // Para excluir o AuthUser, é necessário uma Edge Function com chave service_role.
    // Isso não pode ser executado pelo browser (anon key).
    //
    // await Supabase.client.rpc("delete_user", { uid: user.id });

    await logout();
    showToast("Conta removida com sucesso.");
  };

  /* ============================================================
     Atualiza UI do Usuário
  ============================================================= */
  const updateUserUI = async (user) => {
    const avatar = document.getElementById("userAvatar");
    const avatarLg = document.getElementById("userAvatarLg");
    const nameEl = document.getElementById("userDropdownName");
    const emailEl = document.getElementById("userDropdownEmail");

    if (!avatar || !avatarLg || !nameEl || !emailEl) return;

    if (!user) {
      avatar.textContent = "?";
      avatar.style.backgroundImage = "";
      avatarLg.textContent = "?";
      avatarLg.style.backgroundImage = "";
      nameEl.textContent = "Convidado";
      emailEl.textContent = "-";
      return;
    }

    const name = user.user_metadata?.name || "Usuário";
    const email = user.email || "-";

    // Foto do Google/GitHub
    let photo = user.user_metadata?.avatar_url || null;

    if (!photo) photo = await getProfileAvatar(user);

    if (photo) {
      avatar.style.backgroundImage = `url(${photo})`;
      avatar.style.backgroundSize = "cover";
      avatar.textContent = "";

      avatarLg.style.backgroundImage = `url(${photo})`;
      avatarLg.style.backgroundSize = "cover";
      avatarLg.textContent = "";
    } else {
      const letter = generateAvatarLetter(name);
      avatar.style.backgroundImage = "";
      avatar.textContent = letter;

      avatarLg.style.backgroundImage = "";
      avatarLg.textContent = letter;
    }

    nameEl.textContent = name;
    emailEl.textContent = email;
  };

  /* ============================================================
     Inicialização do fluxo
  ============================================================= */
  const initUI = async () => {
    const dialog = document.getElementById("loginDialog");
    const form   = document.getElementById("loginForm");

    const user = await getSessionUser();

    if (!user) dialog.showModal();
    else {
      await updateUserUI(user);
      Main.reloadForUser();
    }

    /* ----- LOGIN / SIGNUP ----- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name  = document.getElementById("loginName").value.trim();
      const email = document.getElementById("loginEmail").value.trim();
      const pass  = document.getElementById("loginPassword").value.trim();

      if (pass.length < 6)
        return showToast("A senha deve ter pelo menos 6 caracteres.", "error");

      let { data, error } = await login(email, pass);

      if (error && error.message.includes("Invalid login credentials")) {
        const res = await signup(name, email, pass);

        if (res.error) return showToast("Erro ao criar conta.", "error");

        showToast("Conta criada!");
        await updateUserUI(res.data.user);

        dialog.close();
        Main.reloadForUser();
        return;
      }

      if (error) return showToast("Erro ao entrar.", "error");

      showToast("Bem-vindo(a) de volta!");

      await updateUserUI(data.user);
      dialog.close();
      Main.reloadForUser();
    });

    /* ----- BOTÕES ----- */
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("openLogin")?.addEventListener("click", () => dialog.showModal());
    document.getElementById("deleteAccountBtn")?.addEventListener("click", deleteAccount);
  };

  return {
    initUI,
    logout,
    loginWithGoogle,
    loginWithGithub,
    loginWithApple,
    deleteAccount,
    getSessionUser
  };

})();

/* Inicializa */
document.addEventListener("DOMContentLoaded", Auth.initUI);

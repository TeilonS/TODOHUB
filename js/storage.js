/* storage.js
   Persistência no LocalStorage com namespace por usuário + prefs por usuário.
*/

export const Storage = (() => {

  const PREFIX = "todohub_";

  // Sanitiza email para virar chave segura
  const safeEmail = (email) =>
    (email || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

  // Descobre usuário atual salvo no storage
  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + "current_user"));
    } catch {
      return null;
    }
  };

  // Cria chave com namespace por usuário
  const makeKey = (name, email = null) => {
    const user = getCurrentUser();
    const finalEmail = email || user?.email || "guest";
    return `${PREFIX}${name}_${safeEmail(finalEmail)}`;
  };

  /* ---------------- FLAGS / PREFS por usuário ---------------- */
  const setPref = (key, value) => {
    const user = getCurrentUser();
    const email = user?.email || "guest";
    const fullKey = `${PREFIX}pref_${key}_${safeEmail(email)}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  };

  const getPref = (key) => {
    const user = getCurrentUser();
    const email = user?.email || "guest";
    const fullKey = `${PREFIX}pref_${key}_${safeEmail(email)}`;
    try {
      return JSON.parse(localStorage.getItem(fullKey));
    } catch {
      return null;
    }
  };

  /* ---------------- TASKS ---------------- */
  const getTasks = (email = null) => {
    try {
      return JSON.parse(localStorage.getItem(makeKey("tasks", email))) || [];
    } catch {
      return [];
    }
  };

  const setTasks = (tasks, email = null) => {
    localStorage.setItem(makeKey("tasks", email), JSON.stringify(tasks));
  };

  return {
    getTasks,
    setTasks,
    getPref,
    setPref,
    getCurrentUser,
  };

})();


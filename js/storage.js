/* storage.js
   Camada de persistência no LocalStorage, com namespace por usuário.
   Estrutura: tasks_<email> -> [{ id, text, done, createdAt }]
   Preferências: theme, allowCollab etc.
*/

const Storage = (() => {
  const KEY_PREFIX = 'todohub_';

  const _key = (suffix, email = null) => {
    const user = email || Auth.getEmail();
    return user ? `${KEY_PREFIX}${suffix}_${user}` : `${KEY_PREFIX}${suffix}`;
  };

  const getTasks = (email = null) => {
    try {
      return JSON.parse(localStorage.getItem(_key('tasks', email))) || [];
    } catch {
      return [];
    }
  };

  const setTasks = (tasks, email = null) => {
    localStorage.setItem(_key('tasks', email), JSON.stringify(tasks));
  };

  const getPref = (name) => {
    try { return JSON.parse(localStorage.getItem(_key(name))); }
    catch { return null; }
  };

  const setPref = (name, value) => {
    localStorage.setItem(_key(name), JSON.stringify(value));
  };

  const clearUserData = (email) => {
    localStorage.removeItem(_key('tasks', email));
  };

  return { getTasks, setTasks, getPref, setPref, clearUserData };
})();

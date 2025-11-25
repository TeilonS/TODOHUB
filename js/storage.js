/* storage.js
   Persistência no LocalStorage com namespace por usuário.
*/

export const Storage = (() => {

  const PREFIX = "todohub_";

  const makeKey = (name, email = null) => {
    const userEmail = email || JSON.parse(localStorage.getItem(PREFIX + "current_user"))?.email;
    return userEmail ? `${PREFIX}${name}_${userEmail}` : `${PREFIX}${name}`;
  };

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

  const getPref = (key) => {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key));
    } catch {
      return null;
    }
  };

  const setPref = (key, value) => {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  };

  return {
    getTasks,
    setTasks,
    getPref,
    setPref
  };

})();

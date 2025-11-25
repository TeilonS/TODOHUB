/* ui.js — Toasters, alerts e microinterações */

export const UI = (() => {

  const stack = () => {
    let el = document.getElementById("toastStack");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastStack";
      document.body.appendChild(el);
    }
    return el;
  };

  const toast = (msg, type = "success", ttl = 2500) => {
    const container = stack();
    const el = document.createElement("div");

    el.className = `toast ${type}`;
    el.textContent = msg;

    container.appendChild(el);

    const t = setTimeout(() => {
      el.style.animation = "toastOut .25s forwards ease-in";
      setTimeout(() => el.remove(), 220);
    }, ttl);

    el.addEventListener("click", () => {
      clearTimeout(t);
      el.style.animation = "toastOut .25s forwards ease-in";
      setTimeout(() => el.remove(), 180);
    });
  };

  return { toast };

})();

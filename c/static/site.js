// Бургер-меню в шапке: показывает и прячет навигацию под ней
document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-menu]");
  const nav = document.getElementById("nav");
  if (!button || !nav) return;
  button.addEventListener("click", () => {
    const open = nav.hidden;
    nav.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
});

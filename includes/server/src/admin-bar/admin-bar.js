// Pixellize admin toolbar runtime — loaded on the public site only for logged-in users.
// The bar markup is injected server-side; this wires the user dropdown and refreshes
// the Edit link after client-side navigation.
(function () {
  function wireMenu() {
    var btn = document.getElementById("pcms-admin-bar-user");
    var menu = document.getElementById("pcms-admin-bar-menu");
    if (!btn || !menu || btn.dataset.pcmsWired) return;
    btn.dataset.pcmsWired = "1";

    function close() {
      menu.classList.remove("pcms-ab__menu--open");
      btn.setAttribute("aria-expanded", "false");
    }
    function toggle(e) {
      e.preventDefault();
      e.stopPropagation();
      var open = menu.classList.toggle("pcms-ab__menu--open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", toggle);
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireMenu);
  } else {
    wireMenu();
  }

  // Refresh the bar after client-side navigation (SPA-style page swaps).
  window.pcmsUpdateAdminBar = function (bar) {
    var el = document.getElementById("pcms-admin-bar");
    if (!el) return;
    if (!bar) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    var edit = document.getElementById("pcms-admin-bar-edit");
    if (edit) {
      if (bar.editUrl) {
        edit.setAttribute("href", bar.editUrl);
        edit.style.display = "";
      } else {
        edit.style.display = "none";
      }
    }
    wireMenu();
  };
})();

// Pixellize admin toolbar runtime — loaded on the public site only for logged-in users.
// The bar markup is injected server-side; this only refreshes it after client-side navigation.
(function () {
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
  };
})();

/* Shared helpers: API calls, toasts, escaping, mobile nav. */
(function () {
  const TF = (window.TF = {});

  TF.escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  TF.api = async (path, options = {}) => {
    const opts = { headers: {}, ...options };
    if (opts.json !== undefined) {
      opts.body = JSON.stringify(opts.json);
      opts.headers["Content-Type"] = "application/json";
      opts.method = opts.method || "POST";
      delete opts.json;
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (e) {
      throw new Error("Cannot reach the server. Check your connection and try again.");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status}).`);
      err.payload = data;
      err.status = res.status;
      throw err;
    }
    return data;
  };

  TF.toast = (message, kind = "") => {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4800);
  };

  TF.initials = (name) =>
    name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  const AVATAR = ["#2f5bff", "#0c8f6f", "#a8700f", "#7a3fd1", "#c0352b", "#0f7a99", "#14213d"];
  TF.avatarColor = (id) => AVATAR[Math.abs(Number(id) || 0) % AVATAR.length];

  TF.fmtDate = (utc) => {
    const d = new Date(utc.replace(" ", "T") + "Z");
    return isNaN(d) ? utc : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  };

  const btn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");
  if (btn && nav) {
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
  }
  /* ---------- theme switcher ---------- */

  const themeBtn = document.getElementById("themeToggle");
  const themeMeta = document.getElementById("themeColor");
  const THEME_KEY = "tf-theme";

  const applyTheme = (theme) => {
    const selectedTheme = theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = selectedTheme;

    const isDark = selectedTheme === "dark";

    if (themeBtn) {
    themeBtn.textContent = isDark ? "☀️" : "🌙";
    themeBtn.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
    );
}

    if (themeMeta) {
      themeMeta.setAttribute(
        "content",
        isDark ? "#081521" : "#f2f7f8"
      );
    }
  };

  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  } catch (error) {
    savedTheme = "dark";
  }

  applyTheme(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const nextTheme =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(nextTheme);

      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (error) {
        // Theme still works for the current page.
      }
    });
  }})();

(function () {
  const list = document.getElementById("list");
  const search = document.getElementById("search");
  const dlg = document.getElementById("confirm");
  let users = [], pending = null;

  const EMPTY = `
    <div class="sheet empty-state">
      <svg viewBox="0 0 150 170" aria-hidden="true"><ellipse cx="75" cy="80" rx="52" ry="68" fill="none" stroke="#14213d" stroke-width="3" stroke-dasharray="9 8"/><path d="M75 4v14M75 142v14M6 80h14M130 80h14" stroke="#2f5bff" stroke-width="3" stroke-linecap="round"/></svg>
      <div>
        <h2 style="font-size:1.5rem">No one is registered yet</h2>
        <p class="muted">Register a person with three or more photos and they will show up here, ready to be recognised.</p>
        <a class="btn btn-primary" href="/register">Register the first person</a>
      </div>
    </div>`;

  function render() {
    const q = search.value.trim().toLowerCase();
    if (!users.length) { list.innerHTML = EMPTY; return; }
    const shown = users.filter((u) => [u.name, u.email, u.department].join(" ").toLowerCase().includes(q));
    if (!shown.length) { list.innerHTML = `<p class="empty-note">No users match “${TF.escape(q)}”. Try a different search.</p>`; return; }
    list.innerHTML = `<div class="people">${shown.map((u) => `
      <article class="person">
        <div class="avatar" style="background:${TF.avatarColor(u.id)}" aria-hidden="true">${TF.escape(TF.initials(u.name))}</div>
        <div>
          <h3>${TF.escape(u.name)}</h3>
          <div class="sub">${TF.escape(u.department || "No department")}</div>
          <div class="sub">${TF.escape(u.email || "No email")}</div>
        </div>
        <div class="foot">
          <span>${u.samples} sample${u.samples === 1 ? "" : "s"} · added ${TF.escape(TF.fmtDate(u.created_at))}</span>
          <button class="link-danger" data-id="${u.id}" data-name="${TF.escape(u.name)}">Remove</button>
        </div>
      </article>`).join("")}</div>`;
  }

  async function load() {
    try { users = (await TF.api("/api/users")).users; render(); }
    catch (e) { list.innerHTML = `<div class="verdict bad"><h3>Could not load users</h3><p>${TF.escape(e.message)}</p></div>`; }
  }

  list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    pending = Number(b.dataset.id);
    document.getElementById("confirmText").textContent =
      `${b.dataset.name} will no longer be recognised and their face samples will be deleted. This cannot be undone.`;
    dlg.showModal();
  });
  document.getElementById("confirmNo").addEventListener("click", () => dlg.close());
  document.getElementById("confirmYes").addEventListener("click", async () => {
    dlg.close();
    try {
      await TF.api(`/api/users/${pending}`, { method: "DELETE" });
      users = users.filter((u) => u.id !== pending);
      render();
      TF.toast("User removed.", "ok");
    } catch (e) { TF.toast(e.message, "bad"); }
  });
  search.addEventListener("input", render);
  load();
})();

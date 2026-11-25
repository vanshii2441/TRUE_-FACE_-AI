(function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 8, MIN = window.MIN_PHOTOS || 3;
  const cam = new TFCamera($("video"));
  const el = {
    stage: $("stage"), video: $("video"), placeholder: $("placeholder"), pill: $("statusPill"),
    start: $("startBtn"), capture: $("captureBtn"), stop: $("stopBtn"), flip: $("switchBtn"),
    file: $("fileInput"), thumbs: $("thumbs"), count: $("count"), submit: $("submitBtn"),
    form: $("form"), problems: $("problems"),
  };
  const photos = [];

  function setLive(live) {
    el.video.hidden = !live;
    el.placeholder.hidden = live;
    el.start.hidden = live;
    el.capture.hidden = !live;
    el.stop.hidden = !live;
    el.flip.hidden = !live;
    el.pill.hidden = !live;
    el.pill.textContent = "Centre your face in the oval";
  }

  function renderThumbs() {
    const cells = photos.map((src, i) => `
      <div class="thumb"><img src="${src}" alt="Photo ${i + 1}">
      <button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`);
    for (let i = photos.length; i < MIN; i++) cells.push(`<div class="thumb empty" aria-hidden="true">${i + 1}</div>`);
    el.thumbs.innerHTML = cells.join("");
    const n = photos.length;
    el.count.textContent = n >= MIN ? `${n} photo${n === 1 ? "" : "s"} added. You can add up to ${MAX}.` : `${n} of ${MIN} photos added.`;
    el.submit.disabled = n < MIN;
  }

  function add(dataUrl) {
    if (photos.length >= MAX) { TF.toast(`You can add up to ${MAX} photos.`, "bad"); return; }
    photos.push(dataUrl);
    renderThumbs();
  }

  el.thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    photos.splice(Number(b.dataset.i), 1);
    renderThumbs();
  });

  el.start.addEventListener("click", async () => {
    el.start.disabled = true;
    try { await cam.start(); setLive(true); } catch (e) { TF.toast(e.message, "bad"); }
    el.start.disabled = false;
  });
  el.stop.addEventListener("click", () => { cam.stop(); setLive(false); });
  el.flip.addEventListener("click", () => cam.flip().catch((e) => TF.toast(e.message, "bad")));
  el.capture.addEventListener("click", () => {
    try { add(cam.capture()); } catch (e) { TF.toast(e.message, "bad"); }
  });
  el.file.addEventListener("change", async () => {
    const files = Array.from(el.file.files).slice(0, MAX - photos.length);
    el.file.value = "";
    for (const f of files) {
      try { add(await TFCamera.fromFile(f)); } catch (e) { TF.toast(e.message, "bad"); }
    }
  });

  el.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    el.problems.textContent = "";
    const name = $("name").value.trim();
    if (name.length < 2) { TF.toast("Enter the person's full name.", "bad"); $("name").focus(); return; }
    el.submit.disabled = true;
    el.submit.textContent = "Registering…";
    el.stage.classList.add("is-busy");
    try {
      const res = await TF.api("/api/enroll", {
        json: { name, email: $("email").value.trim(), department: $("department").value.trim(), images: photos },
      });
      TF.toast(`${res.user.name} is registered.`, "ok");
      setTimeout(() => { window.location.href = "/users"; }, 700);
    } catch (e) {
      TF.toast(e.message, "bad");
      const list = (e.payload && e.payload.problems) || [];
      el.problems.innerHTML = list.map((p) => `<div>${TF.escape(p)}</div>`).join("");
      el.submit.disabled = photos.length < MIN;
      el.submit.textContent = "Register person";
    } finally {
      el.stage.classList.remove("is-busy");
    }
  });

  window.addEventListener("pagehide", () => cam.stop());
  setLive(false);
  renderThumbs();
})();


(function () {
  const $ = (id) => document.getElementById(id);
  const cam = new TFCamera($("video"));

  const el = {
    stage: $("stage"),
    still: $("still"),
    preview: $("capturedPreview"),
    video: $("video"),
    placeholder: $("placeholder"),
    pill: $("statusPill"),
    start: $("startBtn"),
    capture: $("captureBtn"),
    verify: $("verifyBtn"),
    retake: $("retakeBtn"),
    flip: $("switchBtn"),
    file: $("fileInput"),
    dropzone: $("uploadDropzone"),
    removeUpload: $("removeUploadBtn"),
    result: $("result"),
  };

  let photo = null;
  let photoSource = null;

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const EMPTY_RESULT =
    '<p class="empty-note">No check yet. Capture or upload a photo to see each step here.</p>';

  const VERDICTS = {
    verified: (r) => ["ok", `Verified: ${r.identity.name}`, `Matched at ${r.identity.match_percent}% in ${r.latency_ms} ms.`],
    rejected_spoof: () => ["bad", "Rejected: possible spoof", "The photo looks like a print or a screen. Use your live face in good light."],
    rejected_deepfake: () => ["bad", "Rejected: possible manipulation", "The face shows signs of being altered."],
    unknown: (r) => ["warn", "Not recognised", r.identity === null && r.steps.some((s) => s.id === "identity" && /enrolled/.test(s.detail))
      ? "No one is registered yet. Register a person first." : "This face does not match anyone registered."],
    no_face: () => ["warn", "No face found", "Centre your face in the oval, move closer and add light."],
  };

  const ICON = { pass: "✓", fail: "✕", warn: "!", skip: "–" };

  function setPill(text) {
    el.pill.hidden = !text;
    el.pill.textContent = text || "";
  }

  function resetResult() {
    el.result.innerHTML = EMPTY_RESULT;
  }

  function updateUploadControls() {
    if (el.removeUpload) {
      el.removeUpload.hidden = photoSource !== "upload";
    }
  }

  function show(mode) {
    const live = mode === "live";
    const still = mode === "captured";
    const reviewLive = mode === "review-live";
    const off = mode === "off";

    el.video.hidden = !(live || reviewLive);
    el.still.hidden = !still;
    el.preview.hidden = !reviewLive;

    el.placeholder.hidden = !off;

    el.start.hidden = !off;
    el.capture.hidden = !live;
    el.flip.hidden = !live;

    el.verify.hidden = !(still || reviewLive);
    el.retake.hidden = !(still || reviewLive);

    updateUploadControls();
  }

  function showPhoto(dataUrl, cameraCapture = false) {
    photo = dataUrl;
    photoSource = cameraCapture ? "camera" : "upload";

    resetResult();

    if (cameraCapture && cam.active) {
      // Keep live camera running
      el.preview.src = dataUrl;
      show("review-live");
    } else {
      // Uploaded photo: retain existing full preview
      el.still.src = dataUrl;
      el.preview.hidden = true;

      cam.stop();
      show("captured");
    }

    updateUploadControls();
    setPill("Review the photo, then verify");
  }

  async function startCamera() {
    el.start.disabled = true;

    try {
      await cam.start();
      show("live");
      setPill("Centre your face in the oval");
    } catch (e) {
      TF.toast(e.message, "bad");
    } finally {
      el.start.disabled = false;
    }
  }

  function validateFile(file) {
    if (!file) {
      throw new Error("Please select an image.");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload a valid image file.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Image size must be 10 MB or less.");
    }
  }

  async function handleFile(file) {
    if (!file) return;

    try {
      validateFile(file);

      const dataUrl = await TFCamera.fromFile(file);
      showPhoto(dataUrl);
    } catch (e) {
      TF.toast(e.message, "bad");
    } finally {
      // Allows selecting the same file again
      el.file.value = "";
    }
  }

  function removeUploadedPhoto() {
    if (photoSource !== "upload") return;

    photo = null;
    photoSource = null;

    el.still.removeAttribute("src");
    el.preview.removeAttribute("src");

    el.file.value = "";

    show("off");
    setPill("");
    resetResult();
    updateUploadControls();
  }

  function renderResult(r) {
    const [kind, title, text] =
      (VERDICTS[r.decision] || VERDICTS.no_face)(r);

    const steps = r.steps.map((s) => `
      <li class="check ${TF.escape(s.status)}">
        <span class="dot" aria-hidden="true">${ICON[s.status] || ""}</span>
        <div><b>${TF.escape(s.label)}</b><span class="d">${TF.escape(s.detail)}</span></div>
        <span class="score">${s.score === null ? "" : Math.round(s.score * 100) + "%"}</span>
      </li>`).join("");

    el.result.innerHTML = `
      <div class="verdict ${kind}"><h3>${TF.escape(title)}</h3><p>${TF.escape(text)}</p></div>
      <ul class="checks">${steps}</ul>
      <p class="meta-line">Scores show how genuine each check found the face. Checked in ${r.latency_ms} ms.</p>`;
  }

  async function runVerify() {
    if (!photo) return;

    el.verify.disabled = true;
    el.stage.classList.add("is-busy");
    setPill("Checking");
    el.result.innerHTML = '<p class="empty-note">Checking the photo…</p>';

    try {
      // Existing backend request is unchanged
      renderResult(await TF.api("/api/verify", { json: { image: photo } }));
      setPill("");
    } catch (e) {
      el.result.innerHTML = `<div class="verdict bad"><h3>The check failed</h3><p>${TF.escape(e.message)}</p></div>`;
      setPill("");
    } finally {
      el.verify.disabled = false;
      el.stage.classList.remove("is-busy");
    }
  }

  el.start.addEventListener("click", startCamera);

  el.flip.addEventListener("click", () =>
    cam.flip().catch((e) => TF.toast(e.message, "bad"))
  );

  el.capture.addEventListener("click", () => {
    try {
      showPhoto(cam.capture(), true);
    } catch (e) {
      TF.toast(e.message, "bad");
    }
  });

  el.retake.addEventListener("click", () => {
    photo = null;
    photoSource = null;

    el.preview.removeAttribute("src");
    el.still.removeAttribute("src");

    resetResult();
    updateUploadControls();

    if (cam.active) {
      show("live");
      setPill("Centre your face in the oval");
    } else {
      setPill("");
      startCamera();
    }
  });

  el.verify.addEventListener("click", runVerify);

  // Normal file selection
  el.file.addEventListener("change", () => {
    handleFile(el.file.files[0]);
  });

  // Drag and drop
  if (el.dropzone) {
    el.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.dropzone.classList.add("is-dragging");
    });

    el.dropzone.addEventListener("dragleave", (e) => {
      if (!el.dropzone.contains(e.relatedTarget)) {
        el.dropzone.classList.remove("is-dragging");
      }
    });

    el.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      el.dropzone.classList.remove("is-dragging");

      const file = e.dataTransfer.files[0];
      handleFile(file);
    });
  }

  // Remove uploaded image
  if (el.removeUpload) {
    el.removeUpload.addEventListener("click", removeUploadedPhoto);
  }

  window.addEventListener("pagehide", () => cam.stop());

  show("off");
})();

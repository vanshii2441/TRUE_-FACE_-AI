/* Webcam wrapper used by the verify and register pages. */
(function () {
  class Camera {
    constructor(video) {
      this.video = video;
      this.stream = null;
      this.facing = "user";
    }

    get active() { return !!this.stream; }

    async start(facing = this.facing) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("This browser cannot open the camera. Use https:// or localhost, or upload a photo instead.");
      }
      this.stop();
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
      } catch (e) {
        const map = {
          NotAllowedError: "Camera access was blocked. Allow the camera in your browser settings, or upload a photo.",
          NotFoundError: "No camera was found on this device. Upload a photo instead.",
          NotReadableError: "The camera is in use by another app. Close it and try again.",
        };
        throw new Error(map[e.name] || "The camera could not start. Upload a photo instead.");
      }
      this.facing = facing;
      this.video.srcObject = this.stream;
      this.video.classList.toggle("mirror", facing === "user");
      await this.video.play();
    }

    stop() {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.video.srcObject = null;
    }

    async flip() { await this.start(this.facing === "user" ? "environment" : "user"); }

    /** Returns a JPEG data URL of the current frame (unmirrored, longest side <= maxSide). */
    capture(maxSide = 960) {
      const vw = this.video.videoWidth, vh = this.video.videoHeight;
      if (!vw || !vh) throw new Error("The camera is still starting. Try again in a moment.");
      const scale = Math.min(1, maxSide / Math.max(vw, vh));
      const c = document.createElement("canvas");
      c.width = Math.round(vw * scale);
      c.height = Math.round(vh * scale);
      c.getContext("2d").drawImage(this.video, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.9);
    }
  }

  /** Reads an uploaded image file and returns a downscaled JPEG data URL. */
  Camera.fromFile = (file, maxSide = 960) =>
    new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) return reject(new Error("Choose an image file (JPEG, PNG or WebP)."));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as an image.")); };
      img.src = url;
    });

  window.TFCamera = Camera;
})();

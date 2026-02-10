let video = null;
let stream = null;
let animationId = null;

/**
 * Infer a human-friendly camera type from the device label
 */
function getCameraType(label = "") {
  const lower = label.toLowerCase();

  if (lower.includes("usb")) return "USB camera";
  if (lower.includes("integrated") || lower.includes("built-in"))
    return "Built-in camera";
  if (lower.includes("webcam")) return "Webcam";
  if (lower.includes("virtual")) return "Virtual camera";

  return label || "Camera";
}

async function startScan(previewContainerId) {
  return new Promise(async (resolve, reject) => {
    try {
      const container = document.getElementById(previewContainerId);
      if (!container) throw new Error("Preview container not found");

      // Ensure clean start
      stopScan();

      // Create video element
      video = document.createElement("video");
      video.setAttribute("playsinline", true);
      video.autoplay = true;
      video.muted = true;
      video.style.width = "100%";
      video.style.height = "100%";

      container.innerHTML = "";
      container.appendChild(video);

      // Request camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      // 🔍 Camera info (after permission)
      const videoTrack = stream.getVideoTracks()[0];
      const cameraLabel = videoTrack?.label || "";
      const cameraType = getCameraType(cameraLabel);

      const labelEl = document.getElementById("cameraLabel");
      if (labelEl) {
        labelEl.textContent = `${cameraType}`;
      }

      video.srcObject = stream;
      await video.play();

      // Canvas for QR scanning
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      const scanLoop = () => {
        if (!video || !stream) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const code = window.jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
          );

          if (code?.data) {
            stopScan();
            resolve(code.data);
            return;
          }
        }

        animationId = requestAnimationFrame(scanLoop);
      };

      scanLoop();
    } catch (err) {
      stopScan();
      reject(err);
    }
  });
}

function stopScan() {
  // Stop animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Stop camera tracks
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  // Cleanup video
  if (video) {
    video.pause();
    video.srcObject = null;
    video.remove();
    video = null;
  }
}

window.qrScanner = {
  startScan,
  stopScan,
};

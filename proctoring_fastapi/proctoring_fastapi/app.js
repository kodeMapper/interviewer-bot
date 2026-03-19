// ============================================================================
// DOM ELEMENTS
// ============================================================================
const statusDiv = document.getElementById("status");
const logList = document.getElementById("log");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraFeed = document.getElementById("cameraFeed");
const cameraSelect = document.getElementById("cameraSelect");
const themeToggle = document.getElementById("themeToggle");
const emptyLog = document.getElementById("emptyLog");
const clearLogBtn = document.getElementById("clearLog");
const sessionTimeEl = document.getElementById("sessionTime");
const durationEl = document.getElementById("duration");
const violationCountEl = document.getElementById("violationCount");
const connectionStatusEl = document.getElementById("connectionStatus");
const toastContainer = document.getElementById("toastContainer");
const runPrecheckBtn = document.getElementById("runPrecheckBtn");
const darkCheck = document.getElementById("darkCheck");
const faceCheck = document.getElementById("faceCheck");
const gazeCheck = document.getElementById("gazeCheck");
const multiCheck = document.getElementById("multiCheck");
const candidateNameInput = document.getElementById("candidateName");
const rollNumberInput = document.getElementById("rollNumber");
const subjectNameInput = document.getElementById("subjectName");
const examIdInput = document.getElementById("examId");
const saveMetaBtn = document.getElementById("saveMetaBtn");
const downloadPackageBtn = document.getElementById("downloadPackageBtn");
const snapshotGallery = document.getElementById("snapshotGallery");
const emptySnapshots = document.getElementById("emptySnapshots");

// ============================================================================
// STATE VARIABLES
// ============================================================================
const STREAM_RETRY_LIMIT = 8;
const POLL_INTERVAL_MS = 1500;
const CHART_MAX_POINTS = 40;

let sessionStartTime = null;
let violationCount = 0;
let isProctoring = false;
let logEntries = [];
let streamRetryCount = 0;
let streamRetryTimer = null;
let streamProbeTimer = null;
let framePollingTimer = null;
let frameFetchInProgress = false;
let precheckPassed = false;
let settingsLoaded = false;
let lastAlertReason = null;
let activityChart = null;
let settingsApiAvailable = true;
let latestSnapshotUrls = [];

function getMetaPayload() {
  return {
    candidate_name: candidateNameInput?.value?.trim() || "",
    roll_number: rollNumberInput?.value?.trim() || "",
    subject: subjectNameInput?.value?.trim() || "",
    exam_id: examIdInput?.value?.trim() || "",
  };
}

function applyMetaToUI(meta) {
  if (!meta) {
    return;
  }
  if (candidateNameInput) {
    candidateNameInput.value = meta.candidate_name || "";
  }
  if (rollNumberInput) {
    rollNumberInput.value = meta.roll_number || "";
  }
  if (subjectNameInput) {
    subjectNameInput.value = meta.subject || "";
  }
  if (examIdInput) {
    examIdInput.value = meta.exam_id || "";
  }
}

function renderSnapshotGallery(urls) {
  if (!snapshotGallery || !emptySnapshots) {
    return;
  }

  snapshotGallery.innerHTML = "";
  const list = Array.isArray(urls) ? urls : [];
  latestSnapshotUrls = list;

  if (list.length === 0) {
    emptySnapshots.style.display = "flex";
    return;
  }

  emptySnapshots.style.display = "none";

  list.forEach((url) => {
    const filename = url.split("/").pop() || "snapshot.jpg";
    const item = document.createElement("a");
    item.className = "snapshot-item";
    item.href = url;
    item.target = "_blank";
    item.rel = "noopener noreferrer";
    item.innerHTML = `
      <img src="${url}" alt="Alert snapshot">
      <div class="snapshot-meta">
        <span>${filename}</span>
        <span>Open</span>
      </div>
    `;
    snapshotGallery.appendChild(item);
  });
}

// ============================================================================
// THEME TOGGLE
// ============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const currentTheme = localStorage.getItem("theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  document.documentElement.setAttribute("data-theme", newTheme);

  themeToggle.innerHTML =
    newTheme === "light"
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
});

// ============================================================================
// HELPERS
// ============================================================================
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
    secs
  ).padStart(2, "0")}`;
}

function updateSessionTime() {
  if (!isProctoring || !sessionStartTime) {
    return;
  }

  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  if (sessionTimeEl) {
    sessionTimeEl.textContent = formatTime(elapsed);
  }
  if (durationEl) {
    durationEl.textContent = formatTime(elapsed);
  }
}

function updateConnectionStatus(status) {
  if (connectionStatusEl) {
    connectionStatusEl.textContent = status;
  }
}

function showNotification(message, type = "info") {
  if (!toastContainer) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${
      type === "success"
        ? "fa-check-circle"
        : type === "warning"
        ? "fa-exclamation-triangle"
        : type === "error"
        ? "fa-times-circle"
        : "fa-info-circle"
    }"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function triggerDownload(url) {
  const link = document.createElement("a");
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

// ============================================================================
// CHART
// ============================================================================
function initActivityChart() {
  const canvas = document.getElementById("activityChart");
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const context = canvas.getContext("2d");
  activityChart = new Chart(context, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Risk Level",
          data: [],
          borderColor: "#2ecc71",
          backgroundColor: "rgba(46, 204, 113, 0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: "rgba(255,255,255,0.7)" },
          grid: { color: "rgba(255,255,255,0.1)" },
        },
        x: {
          ticks: { display: false },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function pushActivityPoint(status, reason) {
  if (!activityChart) {
    return;
  }

  const riskMap = {
    SAFE: 0,
    "NO FACE": 70,
    "MULTIPLE FACES": 85,
    "LOOKING AWAY": 60,
    "HEAD LEFT": 55,
    "HEAD RIGHT": 55,
    "HEAD UP": 65,
    "HEAD DOWN": 75,
    "DARK ENVIRONMENT": 65,
  };

  const value = status === "SAFE" ? 0 : riskMap[reason] || 50;
  const color = status === "SAFE" ? "#2ecc71" : "#e74c3c";

  activityChart.data.labels.push(new Date().toLocaleTimeString());
  activityChart.data.datasets[0].data.push(value);
  activityChart.data.datasets[0].borderColor = color;
  activityChart.data.datasets[0].backgroundColor =
    status === "SAFE" ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)";

  if (activityChart.data.labels.length > CHART_MAX_POINTS) {
    activityChart.data.labels.shift();
    activityChart.data.datasets[0].data.shift();
  }

  activityChart.update("none");
}

// ============================================================================
// PRE-CHECK
// ============================================================================
function setCheckStatus(id, state, label) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  const iconClass =
    state === "pass"
      ? "fa-check-circle"
      : state === "fail"
      ? "fa-times-circle"
      : "fa-circle-notch fa-spin";

  element.className = `check-item ${state}`;
  element.innerHTML = `<i class="fas ${iconClass}"></i> ${label}`;
}

function updateStartGate() {
  if (!startBtn) {
    return;
  }

  startBtn.disabled = false;
  startBtn.title = precheckPassed
    ? "Ready to start"
    : "Pre-check not fully passed; start will still be attempted";
}

async function runPrecheck() {
  precheckPassed = false;
  updateStartGate();

  setCheckStatus("checkBackend", "pending", "Backend reachability");
  setCheckStatus("checkCamera", "pending", "Camera availability");
  setCheckStatus("checkSettings", "pending", "Detection settings sync");
  setCheckStatus("checkStream", "pending", "Stream readiness");

  let backendOk = false;
  let cameraOk = false;
  let settingsOk = false;
  let streamOk = false;

  try {
    const data = await apiJson("/status");
    backendOk = Boolean(data.status);
  } catch {
    backendOk = false;
  }
  setCheckStatus("checkBackend", backendOk ? "pass" : "fail", "Backend reachability");

  try {
    cameraOk = await loadCameras();
  } catch {
    cameraOk = false;
  }
  setCheckStatus("checkCamera", cameraOk ? "pass" : "fail", "Camera availability");

  try {
    await loadSettings();
    settingsOk = settingsLoaded;
  } catch {
    settingsOk = false;
  }
  setCheckStatus(
    "checkSettings",
    settingsOk ? "pass" : "fail",
    settingsApiAvailable ? "Detection settings sync" : "Detection settings sync (local mode)"
  );

  try {
    const frameResponse = await fetch("/frame", { method: "GET" });
    streamOk = frameResponse.status === 200 || frameResponse.status === 204;
  } catch {
    streamOk = false;
  }
  setCheckStatus("checkStream", streamOk ? "pass" : "fail", "Stream readiness");

  precheckPassed = backendOk && cameraOk && settingsOk && streamOk;
  updateStartGate();

  if (precheckPassed) {
    showNotification("Pre-check passed. Ready to start.", "success");
  } else {
    showNotification("Pre-check failed. Fix checks and retry.", "warning");
  }

  return precheckPassed;
}

// ============================================================================
// SETTINGS SYNC
// ============================================================================
function getSettingsPayload() {
  return {
    dark_environment: Boolean(darkCheck?.checked),
    face_detection: Boolean(faceCheck?.checked),
    gaze_tracking: Boolean(gazeCheck?.checked),
    multiple_people: Boolean(multiCheck?.checked),
  };
}

function getLocalSettings() {
  const saved = localStorage.getItem("proctorSettings");
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function saveLocalSettings(settings) {
  localStorage.setItem("proctorSettings", JSON.stringify(settings));
}

function applySettingsToUI(settings) {
  if (!settings) {
    return;
  }
  if (darkCheck) {
    darkCheck.checked = Boolean(settings.dark_environment);
  }
  if (faceCheck) {
    faceCheck.checked = Boolean(settings.face_detection);
  }
  if (gazeCheck) {
    gazeCheck.checked = Boolean(settings.gaze_tracking);
  }
  if (multiCheck) {
    multiCheck.checked = Boolean(settings.multiple_people);
  }
}

async function loadSettings() {
  try {
    const settings = await apiJson("/settings");
    settingsApiAvailable = true;
    applySettingsToUI(settings);
    saveLocalSettings(settings);
    settingsLoaded = true;
    return settings;
  } catch (error) {
    settingsApiAvailable = false;
    const localSettings = getLocalSettings();
    if (localSettings) {
      applySettingsToUI(localSettings);
      settingsLoaded = true;
      showNotification("Using local detection settings (backend settings API unavailable)", "warning");
      return localSettings;
    }

    settingsLoaded = true;
    showNotification("Settings API unavailable. Continuing with current toggles.", "warning");
    return getSettingsPayload();
  }
}

async function saveSettings() {
  const payload = getSettingsPayload();
  saveLocalSettings(payload);

  if (!settingsApiAvailable) {
    showNotification("Saved locally. Restart backend to sync settings.", "info");
    return;
  }

  try {
    const updated = await apiJson("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    settingsApiAvailable = true;
    applySettingsToUI(updated);
    saveLocalSettings(updated);
    settingsLoaded = true;
    showNotification("Detection settings updated", "success");
  } catch (error) {
    console.error("Settings update failed:", error);
    settingsApiAvailable = false;
    settingsLoaded = true;
    showNotification("Backend settings sync failed. Saved locally.", "warning");
  }
}

async function loadSessionMetadata() {
  try {
    const data = await apiJson("/session/meta");
    applyMetaToUI(data);
    localStorage.setItem("sessionMeta", JSON.stringify(data));
    return data;
  } catch (error) {
    const fallbackRaw = localStorage.getItem("sessionMeta");
    if (fallbackRaw) {
      try {
        const fallback = JSON.parse(fallbackRaw);
        applyMetaToUI(fallback);
      } catch {
        applyMetaToUI(getMetaPayload());
      }
    }
    return getMetaPayload();
  }
}

async function saveSessionMetadata(showToast = true) {
  const payload = getMetaPayload();
  localStorage.setItem("sessionMeta", JSON.stringify(payload));

  try {
    await apiJson("/session/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (showToast) {
      showNotification("Session details saved", "success");
    }
  } catch (error) {
    if (showToast) {
      showNotification("Saved locally. Backend sync failed.", "warning");
    }
  }
}

// ============================================================================
// CAMERA + STREAM
// ============================================================================
async function loadCameras() {
  const data = await apiJson("/cameras");
  cameraSelect.innerHTML = "";

  if (!Array.isArray(data.cameras) || data.cameras.length === 0) {
    cameraSelect.innerHTML = "<option>No cameras found</option>";
    return false;
  }

  data.cameras.forEach((idx) => {
    const option = document.createElement("option");
    option.value = idx;
    option.text = `Camera ${idx}`;
    cameraSelect.appendChild(option);
  });

  return true;
}

async function switchCamera(index) {
  try {
    const data = await apiJson(`/set_camera/${index}`);
    showNotification(data.message || "Camera switched", "info");
  } catch (error) {
    console.error("Camera switch error:", error);
    showNotification("Failed to switch camera", "error");
  }
}

function clearStreamRetryTimer() {
  if (streamRetryTimer) {
    clearTimeout(streamRetryTimer);
    streamRetryTimer = null;
  }
}

function clearStreamProbeTimer() {
  if (streamProbeTimer) {
    clearTimeout(streamProbeTimer);
    streamProbeTimer = null;
  }
}

function clearFramePolling() {
  if (framePollingTimer) {
    clearInterval(framePollingTimer);
    framePollingTimer = null;
  }
}

function scheduleStreamReconnect() {
  if (!isProctoring || streamRetryCount >= STREAM_RETRY_LIMIT) {
    if (streamRetryCount >= STREAM_RETRY_LIMIT) {
      showNotification("Stream reconnect limit reached", "error");
    }
    return;
  }

  streamRetryCount += 1;
  const delay = Math.min(1000 * 2 ** (streamRetryCount - 1), 10000);
  showNotification(`Reconnecting stream (${streamRetryCount}/${STREAM_RETRY_LIMIT})...`, "warning");

  clearStreamRetryTimer();
  streamRetryTimer = setTimeout(() => {
    startStream();
  }, delay);
}

async function fetchSingleFrame() {
  if (frameFetchInProgress || !isProctoring) {
    return;
  }

  frameFetchInProgress = true;
  try {
    const response = await fetch(`/frame?ts=${Date.now()}`, { cache: "no-store" });
    if (response.status !== 200) {
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    cameraFeed.src = objectUrl;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    updateConnectionStatus("Connected");
  } catch (error) {
    console.error("Frame polling error:", error);
    updateConnectionStatus("Stream Error");
  } finally {
    frameFetchInProgress = false;
  }
}

function startFramePollingMode() {
  clearStreamRetryTimer();
  clearStreamProbeTimer();
  clearFramePolling();

  showNotification("Using frame polling mode", "info");
  fetchSingleFrame();
  framePollingTimer = setInterval(fetchSingleFrame, 120);
}

function startStream() {
  clearFramePolling();
  clearStreamRetryTimer();
  clearStreamProbeTimer();

  cameraFeed.onerror = () => {
    updateConnectionStatus("Stream Error");
    if (streamRetryCount >= 5) {
      startFramePollingMode();
    } else {
      scheduleStreamReconnect();
    }
  };

  cameraFeed.onload = () => {
    streamRetryCount = 0;
    updateConnectionStatus("Connected");
    clearStreamProbeTimer();
  };

  cameraFeed.src = `/video_feed?ts=${Date.now()}`;

  streamProbeTimer = setTimeout(() => {
    if (!isProctoring) {
      return;
    }

    const streamVisible = cameraFeed.naturalWidth > 0 && cameraFeed.naturalHeight > 0;
    if (!streamVisible) {
      if (streamRetryCount >= 3) {
        startFramePollingMode();
      } else {
        scheduleStreamReconnect();
      }
    }
  }, 10000);
}

function stopStream() {
  clearStreamRetryTimer();
  clearStreamProbeTimer();
  clearFramePolling();
  streamRetryCount = 0;
  cameraFeed.onload = null;
  cameraFeed.onerror = null;
  cameraFeed.src = "";
}

// ============================================================================
// STATUS + LOGS
// ============================================================================
function appendViolation(reason) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `${timestamp} - ${reason}`;

  if (logEntries.includes(logMessage)) {
    return;
  }

  logEntries.push(logMessage);
  violationCount += 1;
  violationCountEl.textContent = String(violationCount);

  const li = document.createElement("li");
  li.innerText = logMessage;
  logList.prepend(li);

  if (emptyLog) {
    emptyLog.style.display = "none";
  }
}

async function updateStatus() {
  try {
    const data = await apiJson("/status");
    const statusText = data.status || "SAFE";
    const reason = data.reason || "SAFE";

    statusDiv.querySelector(".status-label").innerText = statusText;

    if (statusText === "SAFE") {
      statusDiv.className = "status safe";
      updateConnectionStatus("Connected");
      lastAlertReason = null;
    } else {
      statusDiv.className = "status alert";
      updateConnectionStatus("Alert");

      if (lastAlertReason !== reason) {
        appendViolation(reason);
        showNotification(reason, "warning");
        lastAlertReason = reason;
      }
    }

    pushActivityPoint(statusText, reason);
  } catch (error) {
    console.error("Status error:", error);
    updateConnectionStatus("Disconnected");
    pushActivityPoint("ALERT", "NETWORK");
  }
}

// ============================================================================
// EVENT BINDINGS
// ============================================================================
cameraSelect?.addEventListener("change", () => {
  const idx = cameraSelect.value;
  if (idx !== "") {
    switchCamera(idx);
  }
});

[darkCheck, faceCheck, gazeCheck, multiCheck].forEach((checkbox) => {
  checkbox?.addEventListener("change", saveSettings);
});

runPrecheckBtn?.addEventListener("click", runPrecheck);
saveMetaBtn?.addEventListener("click", () => {
  saveSessionMetadata(true);
});
downloadPackageBtn?.addEventListener("click", () => {
  triggerDownload("/report/download/package");
  showNotification("Downloading report package...", "info");
});

startBtn?.addEventListener("click", async () => {
  if (!precheckPassed) {
    await runPrecheck();
    if (!precheckPassed) {
      showNotification("Pre-check incomplete. Attempting start anyway.", "warning");
    }
  }

  try {
    await saveSessionMetadata(false);

    if (cameraSelect && cameraSelect.value !== "") {
      await switchCamera(cameraSelect.value);
    }

    const data = await apiJson("/start");
    isProctoring = true;
    sessionStartTime = Date.now();
    violationCount = 0;
    violationCountEl.textContent = "0";
    logEntries = [];
    logList.innerHTML = "";
    if (emptyLog) {
      emptyLog.style.display = "flex";
    }

    showNotification(data.message || "Proctoring started", "success");
    startStream();
    setTimeout(updateStatus, 800);
  } catch (error) {
    console.error("Start error:", error);
    showNotification("Failed to start proctoring", "error");
  }
});

stopBtn?.addEventListener("click", async () => {
  try {
    const data = await apiJson("/stop");
    isProctoring = false;
    sessionStartTime = null;
    stopStream();
    showNotification(data.message || "Proctoring stopped", "info");

    if (data.report_ready) {
      if (data.reports?.json) {
        triggerDownload("/report/download/json");
        showNotification(`Report downloaded: ${data.reports.json}`, "success");
      } else if (data.reports?.csv) {
        triggerDownload("/report/download/csv");
        showNotification(`Report downloaded: ${data.reports.csv}`, "success");
      }

      if (data.reports?.video) {
        showNotification(`Recorded video ready: ${data.reports.video}`, "info");
      }

      if (Array.isArray(data.reports?.snapshots) && data.reports.snapshots.length > 0) {
        showNotification(`Snapshots captured: ${data.reports.snapshots.length}`, "info");
      }

      if (Array.isArray(data.reports?.snapshot_urls)) {
        renderSnapshotGallery(data.reports.snapshot_urls);
      }

      if (data.reports?.package) {
        showNotification("Report package is ready for download", "success");
      }
    } else {
      showNotification("No report generated for this session", "warning");
      renderSnapshotGallery([]);
    }
  } catch (error) {
    console.error("Stop error:", error);
    showNotification("Failed to stop proctoring", "error");
  }
});

clearLogBtn?.addEventListener("click", () => {
  if (logList.children.length === 0) {
    return;
  }

  if (!confirm("Are you sure you want to clear all violation logs?")) {
    return;
  }

  logList.innerHTML = "";
  logEntries = [];
  if (emptyLog) {
    emptyLog.style.display = "flex";
  }
  showNotification("Logs cleared", "info");
});

// ============================================================================
// INITIALIZE
// ============================================================================
window.addEventListener("load", async () => {
  initTheme();
  initActivityChart();
  updateStartGate();
  renderSnapshotGallery([]);

  try {
    await Promise.all([loadCameras(), loadSettings(), loadSessionMetadata()]);
  } catch (error) {
    console.error("Initial setup error:", error);
    showNotification("Initial setup partially failed", "warning");
  }

  try {
    const latest = await apiJson("/report/latest");
    if (Array.isArray(latest.download?.snapshots)) {
      renderSnapshotGallery(latest.download.snapshots);
    }
  } catch {
    renderSnapshotGallery(latestSnapshotUrls);
  }

  await runPrecheck();
  await updateStatus();

  setInterval(updateSessionTime, 1000);
  setInterval(updateStatus, POLL_INTERVAL_MS);

  if (logList.children.length === 0 && emptyLog) {
    emptyLog.style.display = "flex";
  }
});
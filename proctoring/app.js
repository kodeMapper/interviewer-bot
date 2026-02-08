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

// ============================================================================
// STATE VARIABLES
// ============================================================================
let sessionStartTime = null;
let violationCount = 0;
let isProctoring = false;
let logEntries = [];

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
  
  themeToggle.innerHTML = newTheme === "light" ? 
    '<i class="fas fa-sun"></i>' : 
    '<i class="fas fa-moon"></i>';
});

// ============================================================================
// SESSION TIMER
// ============================================================================
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateSessionTime() {
  if (isProctoring && sessionStartTime) {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (sessionTimeEl) sessionTimeEl.textContent = formatTime(elapsed);
    if (durationEl) durationEl.textContent = formatTime(elapsed);
  }
}

// Update every second
setInterval(updateSessionTime, 1000);

// ============================================================================
// LOAD AVAILABLE CAMERAS
// ============================================================================
function loadCameras() {
  fetch("/cameras")
    .then(res => res.json())
    .then(data => {
      cameraSelect.innerHTML = "";
      if (data.cameras.length === 0) {
        cameraSelect.innerHTML = '<option>No cameras found</option>';
        return;
      }
      
      data.cameras.forEach(idx => {
        const option = document.createElement("option");
        option.value = idx;
        option.text = `Camera ${idx}`;
        if (idx === 1) option.selected = true;
        cameraSelect.appendChild(option);
      });
    })
    .catch(err => {
      console.error("Failed to load cameras:", err);
      updateConnectionStatus("Disconnected");
    });
}

// ============================================================================
// SWITCH CAMERA
// ============================================================================
cameraSelect.onchange = () => {
  const idx = cameraSelect.value;
  if (idx) {
    fetch(`/set_camera/${idx}`)
      .then(res => res.json())
      .then(data => console.log(data.message))
      .catch(err => console.error("Camera switch error:", err));
  }
};

// ============================================================================
// CONTINUOUSLY REFRESH CAMERA FEED
// ============================================================================
function refreshFrame() {
  cameraFeed.src = "/frame?t=" + Date.now();
}

// Refresh every 33ms (~30 FPS)
setInterval(refreshFrame, 33);

// ============================================================================
// START & STOP BUTTONS
// ============================================================================
startBtn.onclick = () => {
  isProctoring = true;
  sessionStartTime = Date.now();
  violationCount = 0;
  violationCountEl.textContent = "0";
  logEntries = [];
  logList.innerHTML = "";
  emptyLog.style.display = "flex";
  
  fetch("/start")
    .then(res => res.json())
    .then(data => {
      console.log(data.message);
      showNotification("Proctoring Started", "success");
    })
    .catch(err => {
      console.error("Start error:", err);
      showNotification("Failed to start proctoring", "error");
    });
};

stopBtn.onclick = () => {
  isProctoring = false;
  sessionStartTime = null;
  
  fetch("/stop")
    .then(res => res.json())
    .then(data => {
      console.log(data.message);
      showNotification("Proctoring Stopped", "info");
    })
    .catch(err => {
      console.error("Stop error:", err);
      showNotification("Failed to stop proctoring", "error");
    });
};

// ============================================================================
// CLEAR LOG
// ============================================================================
if (clearLogBtn) {
  clearLogBtn.addEventListener("click", () => {
    if (logList.children.length > 0) {
      if (confirm("Are you sure you want to clear all violation logs?")) {
        logList.innerHTML = "";
        logEntries = [];
        emptyLog.style.display = "flex";
        showNotification("Logs cleared", "info");
      }
    }
  });
}

// ============================================================================
// STATUS UPDATES
// ============================================================================
function updateConnectionStatus(status) {
  if (connectionStatusEl) {
    connectionStatusEl.textContent = status;
  }
}

function updateStatus() {
  fetch("/status")
    .then(res => res.json())
    .then(data => {
      const statusBox = document.getElementById("status");
      
      statusBox.querySelector(".status-label").innerText = data.status;

      if (data.status === "SAFE") {
        statusBox.className = "status safe";
        updateConnectionStatus("Connected");
      } else {
        statusBox.className = "status alert";
        
        // Add violation to log
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `${timestamp} - ${data.reason}`;
        
        if (!logEntries.includes(logMessage)) {
          logEntries.push(logMessage);
          violationCount++;
          violationCountEl.textContent = violationCount;
          
          const li = document.createElement("li");
          li.innerText = logMessage;
          logList.prepend(li);
          
          if (emptyLog) emptyLog.style.display = "none";
          
          showNotification(data.reason, "warning");
        }
      }
    })
    .catch(err => {
      console.error("Status error:", err);
      updateConnectionStatus("Disconnected");
    });
}

// Poll status every 800ms
setInterval(updateStatus, 800);

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================
function showNotification(message, type = "info") {
  // Optional: You can implement a toast notification here
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================================================
// INITIALIZE
// ============================================================================
window.addEventListener("load", () => {
  initTheme();
  loadCameras();
  updateStatus();
  
  // Hide empty log initially
  if (logList.children.length === 0 && emptyLog) {
    emptyLog.style.display = "flex";
  } else if (emptyLog) {
    emptyLog.style.display = "none";
  }
});

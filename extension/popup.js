const DEFAULT_BASE_URL = "http://localhost:3000";

const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const sessionIdEl = document.getElementById("sessionId");
const timerEl = document.getElementById("timerEl");
const baseUrlInput = document.getElementById("baseUrlInput");
const saveBaseUrlBtn = document.getElementById("saveBaseUrlBtn");
const intentInput = document.getElementById("intentInput");
const saveIntentBtn = document.getElementById("saveIntentBtn");
const resumePrompt = document.getElementById("resumePrompt");
const startFreshBtn = document.getElementById("startFreshBtn");
const continueLastBtn = document.getElementById("continueLastBtn");

let timerInterval = null;

async function getState() {
  return await chrome.storage.local.get([
    "sessionId",
    "status",
    "paused",
    "baseUrl",
    "autoEndedSessionId",
    "intent",
    "startedAt",
    "pausedAt",
    "totalPausedMs",
  ]);
}

async function setState(update) {
  await chrome.storage.local.set(update);
}

async function apiPost(path, body) {
  const { baseUrl } = await getState();
  const url = `${baseUrl || DEFAULT_BASE_URL}${path}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

function formatElapsed(ms) {
  if (ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getElapsedMs(state) {
  if (!state.startedAt || state.startedAt === 0) return null;
  if (state.status !== "running" && state.status !== "paused") return null;
  const total = state.totalPausedMs || 0;
  if (state.paused && state.pausedAt) return state.pausedAt - state.startedAt - total;
  return Date.now() - state.startedAt - total;
}

function render(state) {
  const status = state.status || "stopped";
  const paused = Boolean(state.paused);
  const running = status === "running";
  const statusLabel = running
    ? paused
      ? "Paused"
      : "Running"
    : status === "auto_ended"
      ? "Away"
      : "Stopped";
  const statusClass = running ? (paused ? "paused" : "running") : (status === "auto_ended" ? "away" : "stopped");
  statusText.textContent = statusLabel;
  statusText.className = "status-badge " + statusClass;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  sessionIdEl.textContent = state.sessionId || "—";
  baseUrlInput.value = state.baseUrl || DEFAULT_BASE_URL;
  if (intentInput && document.activeElement !== intentInput) {
    intentInput.value = state.intent || "";
  }

  const hasIntent = Boolean((intentInput?.value || state.intent || "").trim());
  startBtn.disabled = running || !hasIntent;
  pauseBtn.disabled = !running;
  stopBtn.disabled = !running;

  if (resumePrompt) {
    resumePrompt.style.display = state.autoEndedSessionId ? "block" : "none";
  }

  if (timerEl) {
    const showTimer = (state.status === "running" || state.status === "paused") && state.startedAt && state.startedAt > 0;
    if (showTimer) {
      const ms = getElapsedMs(state);
      timerEl.textContent = ms != null ? formatElapsed(ms) : "—";
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        getState().then((s) => {
          if (s.status === "running" || s.status === "paused") {
            const m = getElapsedMs(s);
            timerEl.textContent = m != null ? formatElapsed(m) : "—";
          } else {
            timerEl.textContent = "—";
            clearInterval(timerInterval);
            timerInterval = null;
          }
        });
      }, 1000);
    } else {
      timerEl.textContent = "—";
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
}

async function handleStart() {
  const intent = intentInput?.value?.trim() || "";
  if (!intent) {
    statusText.textContent = "Add an intent to start";
    statusText.className = "status status--error";
    return;
  }
  const response = await apiPost("/api/session/start", {
    intent,
  });
  if (!response.ok) {
    const message = await response.text();
    statusText.textContent = "Error starting session (" + response.status + ")";
    statusText.className = "status status--error";
    console.error("Start session failed", message);
    return;
  }
  const data = await response.json();
  await setState({
    sessionId: data.sessionId,
    status: "running",
    paused: false,
    autoEndedSessionId: undefined,
    intent,
    startedAt: Date.now(),
    totalPausedMs: 0,
    pausedAt: null,
  });
  render(await getState());
}

async function handlePauseToggle() {
  const state = await getState();
  if (!state.sessionId) {
    statusText.textContent = "Start a session first";
    statusText.className = "status status--error";
    return;
  }
  if (state.status !== "running") {
    statusText.textContent = "Session is not running";
    statusText.className = "status status--error";
    return;
  }

  if (state.paused) {
    const response = await apiPost("/api/session/resume", {
      sessionId: state.sessionId,
      url: "",
      title: "",
    });
    if (!response.ok) {
      statusText.textContent = "Error resuming";
      statusText.className = "status status--error";
      return;
    }
    await setState({ paused: false, status: "running" });
  } else {
    const response = await apiPost("/api/session/pause", {
      sessionId: state.sessionId,
      url: "",
      title: "",
    });
    if (!response.ok) {
      statusText.textContent = "Error pausing";
      statusText.className = "status status--error";
      return;
    }
    await setState({ paused: true, status: "paused" });
  }
  render(await getState());
}

async function handleStop() {
  const state = await getState();
  if (!state.sessionId) {
    statusText.textContent = "Start a session first";
    statusText.className = "status status--error";
    return;
  }

  const response = await apiPost("/api/session/end", {
    sessionId: state.sessionId,
    url: "",
    title: "",
  });
  if (!response.ok) {
    statusText.textContent = "Error stopping session";
    statusText.className = "status status--error";
    return;
  }
  await setState({ status: "ended", paused: false, autoEndedSessionId: undefined, startedAt: 0, pausedAt: null, totalPausedMs: 0 });
  render(await getState());
}

async function handleStartFresh() {
  const intent = intentInput?.value?.trim() || "";
  if (!intent) {
    statusText.textContent = "Add an intent to start";
    statusText.className = "status status--error";
    return;
  }
  const response = await apiPost("/api/session/start", { intent });
  if (!response.ok) {
    statusText.textContent = "Error starting session";
    statusText.className = "status status--error";
    return;
  }
  const data = await response.json();
  await setState({
    sessionId: data.sessionId,
    status: "running",
    paused: false,
    autoEndedSessionId: undefined,
    intent,
  });
  render(await getState());
}

async function handleContinueLast() {
  const state = await getState();
  const sessionId = state.autoEndedSessionId;
  if (!sessionId) {
    statusText.textContent = "No previous session found";
    statusText.className = "status status--error";
    return;
  }
  const response = await apiPost("/api/session/resume", {
    sessionId,
    url: "",
    title: "",
  });
  if (!response.ok) {
    statusText.textContent = "Error resuming session";
    statusText.className = "status status--error";
    return;
  }
  await setState({
    sessionId,
    status: "running",
    paused: false,
    autoEndedSessionId: undefined,
    startedAt: Date.now(),
    totalPausedMs: 0,
    pausedAt: null,
  });
  render(await getState());
}

async function handleSaveBaseUrl() {
  const value = baseUrlInput.value.trim() || DEFAULT_BASE_URL;
  await setState({ baseUrl: value });
  render(await getState());
}

async function handleSaveIntent() {
  const intent = intentInput?.value?.trim() || "";
  const state = await getState();
  await setState({ intent });

  if (!state.sessionId) {
    render(await getState());
    return;
  }

  const response = await apiPost("/api/session/intent", {
    sessionId: state.sessionId,
    intent,
  });
  if (!response.ok) {
    statusText.textContent = "Error saving intent";
    statusText.className = "status status--error";
    return;
  }
  render(await getState());
}

startBtn.addEventListener("click", handleStart);
intentInput?.addEventListener("input", async () => render(await getState()));
pauseBtn.addEventListener("click", handlePauseToggle);
stopBtn.addEventListener("click", handleStop);
saveBaseUrlBtn.addEventListener("click", handleSaveBaseUrl);
startFreshBtn?.addEventListener("click", handleStartFresh);
continueLastBtn?.addEventListener("click", handleContinueLast);
saveIntentBtn?.addEventListener("click", handleSaveIntent);

getState().then(render);

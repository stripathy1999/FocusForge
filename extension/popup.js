const DEFAULT_BASE_URL = "http://localhost:3000";

const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const sessionIdEl = document.getElementById("sessionId");
const baseUrlInput = document.getElementById("baseUrlInput");
const saveBaseUrlBtn = document.getElementById("saveBaseUrlBtn");

async function getState() {
  return await chrome.storage.local.get([
    "sessionId",
    "status",
    "paused",
    "baseUrl",
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

function render(state) {
  const status = state.status || "stopped";
  const paused = Boolean(state.paused);
  const running = status === "running";
  statusText.textContent = `Status: ${
    running ? (paused ? "Paused" : "Running") : "Stopped"
  }`;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  sessionIdEl.textContent = state.sessionId || "—";
  baseUrlInput.value = state.baseUrl || DEFAULT_BASE_URL;

  startBtn.disabled = running;
  pauseBtn.disabled = !running;
  stopBtn.disabled = !running;
  startBtn.style.opacity = running ? "0.6" : "1";
  pauseBtn.style.opacity = running ? "1" : "0.6";
  stopBtn.style.opacity = running ? "1" : "0.6";
}

async function handleStart() {
  const response = await apiPost("/api/session/start", {});
  if (!response.ok) {
    statusText.textContent = "Status: Error starting session";
    return;
  }
  const data = await response.json();
  await setState({ sessionId: data.sessionId, status: "running", paused: false });
  render(await getState());
}

async function handlePauseToggle() {
  const state = await getState();
  if (!state.sessionId) {
    statusText.textContent = "Status: Start a session first";
    return;
  }
  if (state.status !== "running") {
    statusText.textContent = "Status: Session is not running";
    return;
  }

  if (state.paused) {
    const response = await apiPost("/api/session/resume", {
      sessionId: state.sessionId,
      url: "",
      title: "",
    });
    if (!response.ok) {
      statusText.textContent = "Status: Error resuming";
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
      statusText.textContent = "Status: Error pausing";
      return;
    }
    await setState({ paused: true, status: "paused" });
  }
  render(await getState());
}

async function handleStop() {
  const state = await getState();
  if (!state.sessionId) {
    statusText.textContent = "Status: Start a session first";
    return;
  }

  const response = await apiPost("/api/session/end", {
    sessionId: state.sessionId,
    url: "",
    title: "",
  });
  if (!response.ok) {
    statusText.textContent = "Status: Error stopping session";
    return;
  }
  await setState({ status: "ended", paused: false });
  render(await getState());
}

async function handleSaveBaseUrl() {
  const value = baseUrlInput.value.trim() || DEFAULT_BASE_URL;
  await setState({ baseUrl: value });
  render(await getState());
}

startBtn.addEventListener("click", handleStart);
pauseBtn.addEventListener("click", handlePauseToggle);
stopBtn.addEventListener("click", handleStop);
saveBaseUrlBtn.addEventListener("click", handleSaveBaseUrl);

getState().then(render);

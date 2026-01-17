const DEFAULT_BASE_URL = "http://localhost:3000";

const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const sessionIdEl = document.getElementById("sessionId");
const baseUrlInput = document.getElementById("baseUrlInput");
const saveBaseUrlBtn = document.getElementById("saveBaseUrlBtn");
const intentInput = document.getElementById("intentInput");
const saveIntentBtn = document.getElementById("saveIntentBtn");
const resumePrompt = document.getElementById("resumePrompt");
const startFreshBtn = document.getElementById("startFreshBtn");
const continueLastBtn = document.getElementById("continueLastBtn");

async function getState() {
  return await chrome.storage.local.get([
    "sessionId",
    "status",
    "paused",
    "baseUrl",
    "autoEndedSessionId",
    "intent",
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
  const statusLabel = running
    ? paused
      ? "Paused"
      : "Running"
    : status === "auto_ended"
      ? "Away"
      : "Stopped";
  statusText.textContent = `Status: ${statusLabel}`;
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
  startBtn.style.opacity = startBtn.disabled ? "0.6" : "1";
  pauseBtn.style.opacity = running ? "1" : "0.6";
  stopBtn.style.opacity = running ? "1" : "0.6";

  if (resumePrompt) {
    resumePrompt.style.display = state.autoEndedSessionId ? "block" : "none";
  }
}

async function handleStart() {
  const intent = intentInput?.value?.trim() || "";
  if (!intent) {
    statusText.textContent = "Status: Add an intent to start";
    return;
  }
  const response = await apiPost("/api/session/start", {
    intent,
  });
  if (!response.ok) {
    statusText.textContent = "Status: Error starting session";
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
  await setState({ status: "ended", paused: false, autoEndedSessionId: undefined });
  render(await getState());
}

async function handleStartFresh() {
  const intent = intentInput?.value?.trim() || "";
  if (!intent) {
    statusText.textContent = "Status: Add an intent to start";
    return;
  }
  const response = await apiPost("/api/session/start", { intent });
  if (!response.ok) {
    statusText.textContent = "Status: Error starting session";
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
    statusText.textContent = "Status: No previous session found";
    return;
  }
  const response = await apiPost("/api/session/resume", {
    sessionId,
    url: "",
    title: "",
  });
  if (!response.ok) {
    statusText.textContent = "Status: Error resuming session";
    return;
  }
  await setState({
    sessionId,
    status: "running",
    paused: false,
    autoEndedSessionId: undefined,
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
    statusText.textContent = "Status: Error saving intent";
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

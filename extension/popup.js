const DEFAULT_BASE_URL = "http://localhost:3000";

const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const sessionIdEl = document.getElementById("sessionId");
const copySessionIdBtn = document.getElementById("copySessionIdBtn");
const timerEl = document.getElementById("timerEl");
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

async function getBaseUrl() {
  await chrome.storage.local.set({ baseUrl: DEFAULT_BASE_URL });
  return DEFAULT_BASE_URL;
}

function isLocalhostOrigin(origin) {
  return (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

async function detectBaseUrl() {
  const detectedFromTabs = await detectBaseUrlFromKnownTabs();
  if (detectedFromTabs) return detectedFromTabs;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith("http")) return null;
    const url = new URL(tab.url);
    const host = url.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isVercel = host.endsWith("vercel.app");
    const isFocusforge = host.endsWith("focusforge.app");
    if (isLocalhost || isVercel || isFocusforge) {
      return url.origin;
    }
    return null;
  } catch {
    return null;
  }
}

async function detectBaseUrlFromKnownTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "http://localhost:3000/*",
        "http://127.0.0.1:3000/*",
        "https://*.vercel.app/*",
        "https://*.focusforge.app/*",
      ],
    });
    if (!tabs.length) return null;
    const localhostTab = tabs.find((tab) =>
      tab.url?.startsWith("http://localhost:3000"),
    );
    const localIpTab = tabs.find((tab) =>
      tab.url?.startsWith("http://127.0.0.1:3000"),
    );
    const preferredTab = localhostTab || localIpTab || tabs[0];
    if (!preferredTab?.url) return null;
    return new URL(preferredTab.url).origin;
  } catch {
    return null;
  }
}

async function apiPost(path, body) {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

async function apiGet(path) {
  const url = `${DEFAULT_BASE_URL}${path}`;
  return fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyIntentSaved(sessionId, expectedIntent) {
  try {
    const response = await apiGet(`/api/session/${sessionId}`);
    if (!response.ok) {
      console.warn("Could not verify intent - session fetch failed:", response.status);
      return false;
    }
    const data = await response.json();
    const savedIntent = data.session?.intent_text || data.session?.intent_raw || "";
    const matches = savedIntent.trim() === expectedIntent.trim();
    if (matches) {
      console.log("✓ Intent verified in session:", savedIntent);
    } else {
      console.warn("⚠ Intent mismatch. Expected:", expectedIntent, "Got:", savedIntent);
    }
    return matches;
  } catch (error) {
    console.error("Error verifying intent:", error);
    return false;
  }
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
  const statusLabel = status === "paused"
    ? "Paused"
    : running
      ? "Running"
      : status === "auto_ended"
        ? "Away"
        : "Stopped";
  const statusClass = status === "paused"
    ? "paused"
    : running
      ? "running"
      : status === "auto_ended"
        ? "away"
        : "stopped";
  statusText.textContent = statusLabel;
  statusText.className = "status-badge " + statusClass;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  sessionIdEl.textContent = state.sessionId || "—";
  if (intentInput && document.activeElement !== intentInput) {
    intentInput.value = state.intent || "";
  }

  const hasIntent = Boolean((intentInput?.value || state.intent || "").trim());
  const sessionActive = status === "running" || status === "paused";
  startBtn.disabled = sessionActive || !hasIntent;
  pauseBtn.disabled = !sessionActive;
  stopBtn.disabled = !sessionActive;

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
  const baseUrl = await getBaseUrl();
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
    baseUrl,
  });
  
  // Auto-save intent after starting session
  console.log("Auto-saving intent:", intent);
  const intentResponse = await apiPost("/api/session/intent", {
    sessionId: data.sessionId,
    intent,
  });
  if (!intentResponse.ok) {
    const errorText = await intentResponse.text();
    console.error("Failed to save intent:", intentResponse.status, errorText);
    statusText.textContent = "Session started, but intent save failed";
    statusText.className = "status status--error";
  } else {
    console.log("Intent saved successfully");
  }
  
  render(await getState());
}

async function handlePauseToggle() {
  const state = await getState();
  if (!state.sessionId) {
    statusText.textContent = "Start a session first";
    statusText.className = "status status--error";
    return;
  }
  if (state.status !== "running" && state.status !== "paused") {
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
    const totalPausedMs = (state.totalPausedMs || 0) + (Date.now() - (state.pausedAt || 0));
    await setState({ paused: false, status: "running", totalPausedMs, pausedAt: null });
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
    await setState({ paused: true, status: "paused", pausedAt: Date.now() });
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
  const baseUrl = await getBaseUrl();
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
    baseUrl,
  });
  
  // Auto-save intent after starting session
  console.log("Auto-saving intent:", intent);
  const intentResponse = await apiPost("/api/session/intent", {
    sessionId: data.sessionId,
    intent,
  });
  if (!intentResponse.ok) {
    const errorText = await intentResponse.text();
    console.error("Failed to save intent:", intentResponse.status, errorText);
    statusText.textContent = "Session started, but intent save failed";
    statusText.className = "status status--error";
  } else {
    console.log("✓ Intent save API call successful");
    // Verify the intent was actually saved
    await verifyIntentSaved(data.sessionId, intent);
  }
  
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
startFreshBtn?.addEventListener("click", handleStartFresh);
continueLastBtn?.addEventListener("click", handleContinueLast);
saveIntentBtn?.addEventListener("click", handleSaveIntent);

copySessionIdBtn?.addEventListener("click", async () => {
  const state = await getState();
  const sessionId = state.sessionId;
  if (sessionId && sessionId !== "—") {
    try {
      await navigator.clipboard.writeText(sessionId);
      const originalTitle = copySessionIdBtn.title;
      copySessionIdBtn.title = "Copied!";
      
      // Replace copy icon with checkmark
      const svg = copySessionIdBtn.querySelector("svg");
      if (svg) {
        const originalSVG = svg.outerHTML;
        svg.outerHTML = `
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #22c55e">
            <path
              d="M3 8L6 11L13 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        `;
        
        setTimeout(() => {
          copySessionIdBtn.title = originalTitle;
          const currentSvg = copySessionIdBtn.querySelector("svg");
          if (currentSvg) {
            currentSvg.outerHTML = originalSVG;
          }
        }, 2000);
      } else {
        setTimeout(() => {
          copySessionIdBtn.title = originalTitle;
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy session ID:", err);
    }
  }
});

getState().then(render);
getBaseUrl().then(() => {});

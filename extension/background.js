const DEFAULT_BASE_URL = "http://localhost:3000";

async function getState() {
  return await chrome.storage.local.get([
    "sessionId",
    "status",
    "paused",
    "baseUrl",
  ]);
}

async function shouldTrack() {
  const state = await getState();
  return Boolean(
    state.sessionId && state.status === "running" && !state.paused,
  );
}

async function sendTabActive(tab) {
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    return;
  }

  if (!(await shouldTrack())) {
    return;
  }

  const state = await getState();
  const baseUrl = state.baseUrl || DEFAULT_BASE_URL;

  try {
    const response = await fetch(`${baseUrl}/api/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        ts: Date.now(),
        type: "TAB_ACTIVE",
        url: tab.url,
        title: tab.title || "",
      }),
    });
    
    if (response.status === 409) {
      await chrome.storage.local.set({
        status: "auto_ended",
        paused: false,
        autoEndedSessionId: state.sessionId,
      });
      return;
    }

    if (!response.ok) {
      console.warn(`FocusForge API error: ${response.status} ${response.statusText}`);
      return;
    }

    await chrome.storage.local.set({
      lastActiveTs: Date.now(),
      lastTabId: tab.id,
      lastUrl: tab.url,
      lastTitle: tab.title || "",
    });
  } catch (error) {
    // Silently handle network errors - the server might be offline or unreachable
    // Only log if it's not a network error to avoid console spam
    if (error.name !== "TypeError" || !error.message.includes("fetch")) {
      console.error("FocusForge sendTabActive error", error);
    }
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await sendTabActive(tab);
  } catch (error) {
    // Only log errors that aren't network-related (sendTabActive handles those)
    if (error.name !== "TypeError" || !error.message.includes("fetch")) {
      console.error("FocusForge tab activation error", error);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    await sendTabActive(tab);
  } catch (error) {
    // Only log errors that aren't network-related (sendTabActive handles those)
    if (error.name !== "TypeError" || !error.message.includes("fetch")) {
      console.error("FocusForge window focus error", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "OPEN_URLS") {
    return;
  }

  const urls = Array.isArray(message.urls) ? message.urls : [];
  urls.forEach((url) => {
    if (typeof url === "string" && url.startsWith("http")) {
      chrome.tabs.create({ url });
    }
  });
});

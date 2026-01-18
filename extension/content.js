window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const { data } = event;
  if (!data || data.type !== "FOCUSFORGE_REOPEN") {
    return;
  }

  chrome.runtime.sendMessage({
    type: "OPEN_URLS",
    urls: data.urls || [],
  });
});

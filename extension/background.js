const HOST_NAME = "com.profile_router.host";
const STORAGE_KEY = "domainMappings";

let cachedProfiles = null;

// --- Native Messaging ---

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST_NAME, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

async function getProfiles() {
  if (cachedProfiles) return cachedProfiles;
  const response = await sendNativeMessage({ action: "list_profiles" });
  cachedProfiles = response.profiles;
  return cachedProfiles;
}

async function openInProfile(url, profileDirectory) {
  return sendNativeMessage({
    action: "open",
    url: url,
    profile: profileDirectory,
  });
}

// --- Domain Memory ---

async function getDomainMappings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function setDomainMapping(domain, profileDirectory) {
  const mappings = await getDomainMappings();
  mappings[domain] = profileDirectory;
  await chrome.storage.local.set({ [STORAGE_KEY]: mappings });
  updateBadge();
}

async function removeDomainMapping(domain) {
  const mappings = await getDomainMappings();
  delete mappings[domain];
  await chrome.storage.local.set({ [STORAGE_KEY]: mappings });
  updateBadge();
}

async function clearAllMappings() {
  await chrome.storage.local.set({ [STORAGE_KEY]: {} });
  updateBadge();
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// --- Badge ---

async function updateBadge() {
  const mappings = await getDomainMappings();
  const count = Object.keys(mappings).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
}

// --- External Navigation Detection ---

chrome.tabs.onCreated.addListener(async (tab) => {
  // Tabs created by external apps have no openerTabId and usually have a pendingUrl
  if (tab.openerTabId !== undefined) return;

  const url = tab.pendingUrl || tab.url;
  if (!url || url === "chrome://newtab/" || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    return;
  }

  const domain = getDomain(url);
  if (!domain) return;

  // Check domain memory
  const mappings = await getDomainMappings();
  if (mappings[domain]) {
    // Auto-route to remembered profile
    try {
      await openInProfile(url, mappings[domain]);
    } catch (err) {
      console.error("Profile Router: failed to auto-route", err);
      return; // Don't close tab if open failed
    }
    chrome.tabs.remove(tab.id);
    return;
  }

  // Redirect to confirmation page
  const confirmUrl = chrome.runtime.getURL(
    `confirmation.html?url=${encodeURIComponent(url)}`
  );
  chrome.tabs.update(tab.id, { url: confirmUrl });
});

// --- Message Handling (from confirmation/settings pages) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getProfiles") {
    getProfiles().then(sendResponse).catch((err) =>
      sendResponse({ error: err.message })
    );
    return true; // async
  }

  if (message.type === "openInProfile") {
    openInProfile(message.url, message.profile)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "saveDomainMapping") {
    setDomainMapping(message.domain, message.profile)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "getDomainMappings") {
    getDomainMappings().then(sendResponse);
    return true;
  }

  if (message.type === "removeDomainMapping") {
    removeDomainMapping(message.domain)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "clearAllMappings") {
    clearAllMappings()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

// --- Init ---

// Cache profiles on startup
getProfiles().catch((err) =>
  console.error("Profile Router: failed to load profiles", err)
);

updateBadge();

const HOST_NAME = "com.profile_router.host";
const STORAGE_KEY = "domainMappings";
const URL_STORAGE_KEY = "urlMappings";
const ROUTE_MARKER = "__prouted";

let cachedProfiles = null;
let currentProfileDir = null;

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
    url: markUrl(url),
    profile: profileDirectory,
  });
}

// --- Route Marker (double-prompt prevention) ---

function markUrl(url) {
  try {
    const u = new URL(url);
    if (u.hash) {
      u.hash = ROUTE_MARKER + ":" + u.hash.slice(1);
    } else {
      u.hash = ROUTE_MARKER;
    }
    return u.toString();
  } catch {
    return url;
  }
}

function isMarkedUrl(url) {
  try {
    const hash = new URL(url).hash.slice(1);
    return hash === ROUTE_MARKER || hash.startsWith(ROUTE_MARKER + ":");
  } catch {
    return false;
  }
}

function stripMarker(url) {
  try {
    const u = new URL(url);
    const hash = u.hash.slice(1);
    if (hash === ROUTE_MARKER) {
      u.hash = "";
    } else if (hash.startsWith(ROUTE_MARKER + ":")) {
      u.hash = hash.slice(ROUTE_MARKER.length + 1);
    }
    return u.toString();
  } catch {
    return url;
  }
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

// --- URL Memory ---

async function getUrlMappings() {
  const result = await chrome.storage.local.get(URL_STORAGE_KEY);
  return result[URL_STORAGE_KEY] || {};
}

async function setUrlMapping(urlPath, profileDirectory) {
  const mappings = await getUrlMappings();
  mappings[urlPath] = profileDirectory;
  await chrome.storage.local.set({ [URL_STORAGE_KEY]: mappings });
  updateBadge();
}

async function removeUrlMapping(urlPath) {
  const mappings = await getUrlMappings();
  delete mappings[urlPath];
  await chrome.storage.local.set({ [URL_STORAGE_KEY]: mappings });
  updateBadge();
}

async function clearAllMappings() {
  await chrome.storage.local.set({ [STORAGE_KEY]: {}, [URL_STORAGE_KEY]: {} });
  updateBadge();
}

// --- URL Helpers ---

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function getUrlPath(url) {
  try {
    const u = new URL(url);
    let path = u.hostname + u.pathname;
    if (path.endsWith("/")) path = path.slice(0, -1);
    return path;
  } catch {
    return null;
  }
}

async function findMatchingMapping(url) {
  const urlPath = getUrlPath(url);

  // Check URL prefix mappings (longest match first)
  if (urlPath) {
    const urlMappings = await getUrlMappings();
    const prefixes = Object.keys(urlMappings).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
      if (urlPath === prefix || urlPath.startsWith(prefix + "/")) {
        return urlMappings[prefix];
      }
    }
  }

  // Fall back to domain mapping
  const domain = getDomain(url);
  if (domain) {
    const domainMappings = await getDomainMappings();
    if (domainMappings[domain]) {
      return domainMappings[domain];
    }
  }

  return null;
}

// --- Current Profile Detection ---

async function detectCurrentProfile() {
  try {
    const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
    if (!userInfo || !userInfo.id) return;

    const profiles = await getProfiles();
    const match = profiles.find(p => p.gaia_id === userInfo.id);
    if (match) {
      currentProfileDir = match.directory;
    }
  } catch (err) {
    console.error("Profile Router: failed to detect current profile", err);
  }
}

// --- Badge ---

async function updateBadge() {
  const domainMappings = await getDomainMappings();
  const urlMappings = await getUrlMappings();
  const count = Object.keys(domainMappings).length + Object.keys(urlMappings).length;
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

  // Check for route marker (double-prompt prevention)
  if (isMarkedUrl(url)) {
    chrome.tabs.update(tab.id, { url: stripMarker(url) });
    return;
  }

  const domain = getDomain(url);
  if (!domain) return;

  // Check URL prefix and domain memory
  const matchedProfile = await findMatchingMapping(url);
  if (matchedProfile) {
    try {
      await openInProfile(url, matchedProfile);
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

  if (message.type === "getCurrentProfile") {
    sendResponse(currentProfileDir);
    return false;
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

  if (message.type === "saveUrlMapping") {
    setUrlMapping(message.urlPath, message.profile)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "getUrlMappings") {
    getUrlMappings().then(sendResponse);
    return true;
  }

  if (message.type === "removeUrlMapping") {
    removeUrlMapping(message.urlPath)
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

detectCurrentProfile();

updateBadge();

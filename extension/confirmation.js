const params = new URLSearchParams(window.location.search);
const targetUrl = params.get("url");

const urlText = document.getElementById("url-text");
const favicon = document.getElementById("favicon");
const profilesContainer = document.getElementById("profiles");
const rememberCheckbox = document.getElementById("remember");
const cancelBtn = document.getElementById("cancel");
const settingsLink = document.getElementById("settings-link");
const errorEl = document.getElementById("error");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Display the target URL
if (targetUrl) {
  urlText.textContent = targetUrl;

  // Show favicon
  const domain = getDomain(targetUrl);
  if (domain) {
    favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    favicon.style.display = "block";
    favicon.onerror = () => { favicon.style.display = "none"; };
  }
} else {
  urlText.textContent = "No URL provided";
}

// Load profiles
chrome.runtime.sendMessage({ type: "getProfiles" }, (profiles) => {
  if (!profiles || profiles.error) {
    profilesContainer.innerHTML = "";
    showError(profiles?.error || "Failed to load profiles. Is the native host installed?");
    return;
  }

  profilesContainer.innerHTML = "";

  profiles.forEach((profile, index) => {
    const btn = document.createElement("button");
    btn.className = "profile-btn";
    btn.innerHTML = `
      <span class="shortcut">${index + 1}</span>
      <span class="profile-name">${escapeHtml(profile.name)}</span>
    `;
    btn.addEventListener("click", () => selectProfile(profile.directory));
    profilesContainer.appendChild(btn);
  });
});

async function selectProfile(profileDirectory) {
  if (!targetUrl) return;

  const domain = getDomain(targetUrl);

  // Save domain mapping if checkbox is checked
  if (rememberCheckbox.checked && domain) {
    chrome.runtime.sendMessage({
      type: "saveDomainMapping",
      domain: domain,
      profile: profileDirectory,
    });
  }

  // Open URL in selected profile
  chrome.runtime.sendMessage(
    { type: "openInProfile", url: targetUrl, profile: profileDirectory },
    (response) => {
      if (response && response.error) {
        showError(`Failed to open: ${response.error}`);
        return;
      }
      // Close this tab
      window.close();
    }
  );
}

// Keyboard shortcuts (1-9 for profiles)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
    return;
  }

  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    const buttons = profilesContainer.querySelectorAll(".profile-btn");
    if (buttons[num - 1]) {
      buttons[num - 1].click();
    }
  }
});

// Cancel
cancelBtn.addEventListener("click", () => window.close());

// Settings link
settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

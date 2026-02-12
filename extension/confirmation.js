const params = new URLSearchParams(window.location.search);
const targetUrl = params.get("url");

const urlText = document.getElementById("url-text");
const favicon = document.getElementById("favicon");
const profilesContainer = document.getElementById("profiles");
const rememberCheckbox = document.getElementById("remember");
const rememberOptions = document.getElementById("remember-options");
const urlPathInput = document.getElementById("url-path");
const urlPathContainer = document.getElementById("url-path-container");
const cancelBtn = document.getElementById("cancel");
const settingsLink = document.getElementById("settings-link");
const errorEl = document.getElementById("error");

// Chrome profile avatar colors
const PROFILE_COLORS = [
  "#1a73e8", "#188038", "#a142f4", "#e8710a",
  "#d93025", "#129eaf", "#ee675c", "#9334e6",
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 1).toUpperCase() || "?";
}

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

// Display the target URL
if (targetUrl) {
  urlText.textContent = targetUrl;

  const domain = getDomain(targetUrl);
  if (domain) {
    favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    favicon.style.display = "block";
    favicon.onerror = () => { favicon.style.display = "none"; };

    // Set domain display in remember options
    document.getElementById("remember-domain").textContent = domain;
  }

  // Pre-populate URL path
  const urlPath = getUrlPath(targetUrl);
  if (urlPath) {
    urlPathInput.value = urlPath;
  }
} else {
  urlText.textContent = "No URL provided";
}

// Remember options toggle
rememberCheckbox.addEventListener("change", () => {
  rememberOptions.style.display = rememberCheckbox.checked ? "block" : "none";
});

document.querySelectorAll('input[name="remember-type"]').forEach(radio => {
  radio.addEventListener("change", () => {
    urlPathContainer.style.display = radio.value === "url" && radio.checked ? "block" : "none";
  });
});

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
    const color = PROFILE_COLORS[index % PROFILE_COLORS.length];
    btn.innerHTML = `
      <div class="profile-avatar" style="background-color: ${color}">${escapeHtml(getInitials(profile.name))}</div>
      <span class="profile-name">${escapeHtml(profile.name)}</span>
      <span class="shortcut">${index + 1}</span>
    `;
    btn.addEventListener("click", () => selectProfile(profile.directory));
    profilesContainer.appendChild(btn);
  });

  // Detect current profile and add badge
  chrome.runtime.sendMessage({ type: "getCurrentProfile" }, (currentDir) => {
    if (!currentDir) return;
    profiles.forEach((profile, index) => {
      if (profile.directory === currentDir) {
        const buttons = profilesContainer.querySelectorAll(".profile-btn");
        if (buttons[index]) {
          buttons[index].classList.add("current-profile");
          const badge = document.createElement("span");
          badge.className = "current-badge";
          badge.textContent = "Current";
          buttons[index].appendChild(badge);
        }
      }
    });
  });
});

async function selectProfile(profileDirectory) {
  if (!targetUrl) return;

  const domain = getDomain(targetUrl);

  // Save mapping if remember is checked
  if (rememberCheckbox.checked) {
    const rememberType = document.querySelector('input[name="remember-type"]:checked').value;

    if (rememberType === "url") {
      const urlPath = urlPathInput.value.trim();
      if (urlPath) {
        chrome.runtime.sendMessage({
          type: "saveUrlMapping",
          urlPath: urlPath,
          profile: profileDirectory,
        });
      }
    } else if (domain) {
      chrome.runtime.sendMessage({
        type: "saveDomainMapping",
        domain: domain,
        profile: profileDirectory,
      });
    }
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

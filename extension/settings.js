const mappingsContainer = document.getElementById("mappings");
const actionsEl = document.getElementById("actions");
const clearAllBtn = document.getElementById("clear-all");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadMappings() {
  chrome.runtime.sendMessage({ type: "getDomainMappings" }, (domainMappings) => {
    chrome.runtime.sendMessage({ type: "getUrlMappings" }, (urlMappings) => {
      const domainEntries = Object.entries(domainMappings || {}).map(([key, profile]) => ({
        key,
        profile,
        type: "domain",
        display: key,
      }));

      const urlEntries = Object.entries(urlMappings || {}).map(([key, profile]) => ({
        key,
        profile,
        type: "url",
        display: key,
      }));

      const allEntries = [...domainEntries, ...urlEntries];

      if (allEntries.length === 0) {
        mappingsContainer.innerHTML = '<div class="empty-state">No saved mappings yet.</div>';
        actionsEl.style.display = "none";
        return;
      }

      // Resolve profile names
      chrome.runtime.sendMessage({ type: "getProfiles" }, (profiles) => {
        const profileMap = {};
        if (profiles && !profiles.error) {
          profiles.forEach((p) => { profileMap[p.directory] = p.name; });
        }

        mappingsContainer.innerHTML = "";
        allEntries.sort((a, b) => a.display.localeCompare(b.display));

        for (const entry of allEntries) {
          const profileName = profileMap[entry.profile] || entry.profile;

          const item = document.createElement("div");
          item.className = "mapping-item";
          item.innerHTML = `
            <div class="mapping-info">
              <div class="mapping-header">
                <span class="mapping-type mapping-type-${entry.type}">${entry.type === "domain" ? "Domain" : "URL"}</span>
                <span class="mapping-domain">${escapeHtml(entry.display)}</span>
              </div>
              <span class="mapping-profile">${escapeHtml(profileName)}</span>
            </div>
          `;

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "btn-delete";
          deleteBtn.textContent = "Remove";
          deleteBtn.addEventListener("click", () => {
            const msgType = entry.type === "domain" ? "removeDomainMapping" : "removeUrlMapping";
            const msgKey = entry.type === "domain" ? "domain" : "urlPath";
            chrome.runtime.sendMessage(
              { type: msgType, [msgKey]: entry.key },
              () => loadMappings()
            );
          });

          item.appendChild(deleteBtn);
          mappingsContainer.appendChild(item);
        }

        actionsEl.style.display = "flex";
      });
    });
  });
}

clearAllBtn.addEventListener("click", () => {
  if (confirm("Remove all saved mappings?")) {
    chrome.runtime.sendMessage({ type: "clearAllMappings" }, () => loadMappings());
  }
});

loadMappings();

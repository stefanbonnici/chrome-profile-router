const mappingsContainer = document.getElementById("mappings");
const actionsEl = document.getElementById("actions");
const clearAllBtn = document.getElementById("clear-all");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadMappings() {
  chrome.runtime.sendMessage({ type: "getDomainMappings" }, (mappings) => {
    const entries = Object.entries(mappings || {});

    if (entries.length === 0) {
      mappingsContainer.innerHTML = '<div class="empty-state">No saved domain mappings yet.</div>';
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
      entries.sort(([a], [b]) => a.localeCompare(b));

      for (const [domain, profileDir] of entries) {
        const profileName = profileMap[profileDir] || profileDir;

        const item = document.createElement("div");
        item.className = "mapping-item";
        item.innerHTML = `
          <div class="mapping-info">
            <span class="mapping-domain">${escapeHtml(domain)}</span>
            <span class="mapping-profile">${escapeHtml(profileName)}</span>
          </div>
        `;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-delete";
        deleteBtn.textContent = "Remove";
        deleteBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage(
            { type: "removeDomainMapping", domain: domain },
            () => loadMappings()
          );
        });

        item.appendChild(deleteBtn);
        mappingsContainer.appendChild(item);
      }

      actionsEl.style.display = "flex";
    });
  });
}

clearAllBtn.addEventListener("click", () => {
  if (confirm("Remove all saved domain mappings?")) {
    chrome.runtime.sendMessage({ type: "clearAllMappings" }, () => loadMappings());
  }
});

loadMappings();

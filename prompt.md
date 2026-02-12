# Chrome Extension: Profile-Aware Link Router (macOS)

## Problem
When clicking links in external apps (Mail, Slack, etc.), Chrome opens them in whatever profile happens to be active. I want to intercept these external navigations, show a confirmation modal letting me choose which Chrome profile to open the link in, and optionally remember my choice per domain.

## What to Build

### 1. Chrome Extension (Manifest V3)

**Detection of external navigations:**
- Listen for new tabs created by external apps (not by clicks within Chrome itself)
- Use `chrome.tabs.onCreated` — tabs without an `openerTabId` are likely external
- Also consider `chrome.webNavigation.onBeforeNavigate` for additional signal
- When an external navigation is detected, immediately redirect to the extension's confirmation page before the target URL loads

**Confirmation Page (extension HTML page):**
- Clean, modern UI (dark mode preferred)
- Display: "Opening: https://full-url-here.com"
- Show buttons for each Chrome profile (profile list comes from the native messaging host on first load and is cached)
- A "Remember for this domain" checkbox — if checked, future links from that domain automatically open in the chosen profile without asking
- A "Cancel" button that just closes the tab
- A small settings icon/link to manage remembered domains (view list, delete entries)

**Domain Memory:**
- Store domain → profile mappings in `chrome.storage.local`
- When an external link is detected, check if the domain has a remembered profile
- If yes, skip the confirmation modal and send directly to the native host to open in that profile, then close the intercepted tab
- Settings page to view and manage all saved domain mappings

**Communication with Native Host:**
- Use `chrome.runtime.sendNativeMessage()` to talk to the native messaging host
- On extension install/load, request the list of available profiles from the native host
- When user picks a profile, send `{ "action": "open", "url": "https://...", "profile": "Profile 1" }` to the native host
- After sending to native host, close the intercepted tab

### 2. Native Messaging Host (Python 3 — available by default on macOS)

**Profile Discovery:**
- Read `~/Library/Application Support/Google/Chrome/Local State` JSON file
- Parse the `profile.info_cache` object to get all profiles
- Return a list of profiles with their display names and directory names (e.g., `{ "directory": "Profile 1", "name": "Work" }`)

**Opening URLs in a specific profile:**
- When receiving an `open` action, run:
  ```
  open -na "Google Chrome" --args --profile-directory="<ProfileDir>" <URL>
  ```
- Use subprocess to execute this

**Native Messaging Protocol:**
- Follow Chrome's native messaging protocol (length-prefixed JSON on stdin/stdout)
- Handle messages: `{ "action": "list_profiles" }` and `{ "action": "open", "url": "...", "profile": "..." }`

**Installation:**
- The host manifest JSON goes in `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- The Python script should be standalone with no pip dependencies
- Include a simple `install.sh` script that:
  - Makes the Python script executable
  - Generates the native messaging host manifest JSON with the correct absolute path to the Python script
  - Places the manifest in the correct Chrome directory
  - Prints instructions for loading the unpacked extension in Chrome

### 3. Project Structure

```
profile-router/
├── extension/
│   ├── manifest.json
│   ├── background.js          (service worker — detection + native messaging)
│   ├── confirmation.html      (the profile picker UI)
│   ├── confirmation.js
│   ├── settings.html          (manage remembered domains)
│   ├── settings.js
│   ├── styles.css
│   └── icons/                 (16, 48, 128px icons)
├── native-host/
│   ├── profile_router_host.py
│   └── com.profile_router.host.json  (template manifest)
├── install.sh
└── README.md
```

## Important Details

- macOS only — no need for Windows/Linux support
- Manifest V3 only
- Python 3 only, no external dependencies
- The extension should be installable as an unpacked extension (no Chrome Web Store)
- The native messaging host name should be `com.profile_router.host`
- Test thoroughly with the full flow: external link → intercept → pick profile → opens correctly
- Handle edge cases: Chrome not having the profile anymore, native host not installed, etc.
- The confirmation page should auto-close after dispatching to the native host
- Include a clear README with installation and usage instructions

## Nice to Have (if straightforward)

- Show the favicon of the URL being opened on the confirmation page
- Keyboard shortcuts on the confirmation page (1, 2, 3 for profiles)
- A small badge on the extension icon showing the count of remembered domains
- Subtle animation on the confirmation page so it doesn't feel jarring

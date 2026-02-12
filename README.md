# Chrome Profile Router

A Chrome extension + native messaging host for macOS that intercepts links opened from external apps (Mail, Slack, etc.) and lets you choose which Chrome profile to open them in.

## Features

- **Profile picker** — When a link is opened from an external app, a clean confirmation page lets you choose which Chrome profile to use
- **Current profile indicator** — The profile picker highlights which profile you're currently in with a "Current" badge
- **Smart routing** — Automatically prevents double-prompts when routing links to another profile
- **Domain memory** — Remember your choice for an entire domain (e.g., all `slack.com` links → Work profile)
- **URL path memory** — Remember your choice for specific URL paths with prefix matching (e.g., `github.com/org-a` → Work profile, while `github.com/personal` → Personal profile)
- **Settings page** — View and manage all saved domain and URL path mappings, with type badges to distinguish them
- **Keyboard shortcuts** — Press 1-9 to quickly select a profile, Escape to cancel
- **Dark mode UI** — Modern, minimal interface

## Requirements

- macOS
- Google Chrome
- Python 3 (included with macOS)

## Installation

1. **Clone or download** this repository:

   ```bash
   git clone https://github.com/your-username/chrome-profile-router.git
   cd chrome-profile-router
   ```

2. **Load the extension in every Chrome profile.** External links can land in whichever profile was last active, so the extension must be present in all of them. For each profile:
   - Switch to that profile in Chrome
   - Open `chrome://extensions`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked** and select the `extension/` folder from this repo
   - Note the **extension ID** shown under the extension name (it's the same across all profiles when loaded from the same path)

3. **Install the native messaging host** with your extension ID:

   ```bash
   ./install.sh <extension-id>
   ```

   Or run `./install.sh` without arguments and enter the ID interactively.

4. **Restart Chrome** to activate the native messaging connection.

## Usage

1. Click a link in any external app (Mail, Slack, Notes, etc.)
2. Chrome opens and the Profile Router confirmation page appears
3. The current profile is highlighted with a **"Current"** badge
4. Click a profile (or press its number key) to open the link in that profile
5. Optionally check **"Remember this choice"** to auto-route future links:
   - **For this domain** — all links from the domain go to the chosen profile
   - **For this URL path** — only links matching the URL path prefix are auto-routed (you can edit the path to make it more or less specific)

When a link is routed to another profile, the extension automatically prevents the target profile from re-prompting — the URL opens cleanly with no double-prompt.

### Managing Saved Mappings

Click the **Settings** link on the confirmation page (or navigate to the extension's settings page) to view and manage all saved mappings. Each mapping shows a **Domain** or **URL** type badge so you can tell them apart. URL path mappings take priority over domain mappings when both match.

## How It Works

1. The Chrome extension listens for new tabs created without an `openerTabId` — these are tabs opened by external apps
2. When detected, the extension checks for a matching URL path prefix mapping first, then falls back to a domain mapping
3. If a match is found: the link opens automatically in the saved profile (via the native host) and the tab closes
4. If no match: the confirmation page appears with a list of available Chrome profiles
5. The native messaging host (Python script) reads Chrome's `Local State` file to discover profiles, and uses the macOS `open` command to launch URLs in specific profiles
6. To prevent double-prompts, a `#__prouted` fragment marker is appended to the URL before sending it to the target profile; the extension in that profile detects and strips the marker

## Project Structure

```
chrome-profile-router/
├── extension/
│   ├── manifest.json          # Manifest V3 extension config
│   ├── background.js          # Service worker — detection + native messaging
│   ├── confirmation.html/js   # Profile picker UI
│   ├── settings.html/js       # Manage remembered domains and URL paths
│   ├── styles.css             # Shared dark mode styles
│   └── icons/                 # Extension icons
├── native-host/
│   ├── profile_router_host.py          # Native messaging host (Python 3)
│   └── com.profile_router.host.json    # Manifest template
├── install.sh                 # Installation script
└── README.md
```

## Troubleshooting

- **"Failed to load profiles"** — Run `install.sh` again and make sure you used the correct extension ID. Restart Chrome after installing.
- **Links not being intercepted** — Make sure Chrome is set as your default browser. The extension only intercepts tabs without an `openerTabId`.
- **Native host errors** — Check Chrome's extension error log at `chrome://extensions` (click "Errors" on the extension card).
- **Current profile not showing** — The "Current" badge requires the profile to be signed into a Google account. Profiles not signed in will not show the indicator.

## License

MIT

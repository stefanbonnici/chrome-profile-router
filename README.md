# Chrome Profile Router

A Chrome extension + native messaging host for macOS that intercepts links opened from external apps (Mail, Slack, etc.) and lets you choose which Chrome profile to open them in.

## Features

- **Profile picker** — When a link is opened from an external app, a clean confirmation page lets you choose which Chrome profile to use
- **Domain memory** — Check "Remember for this domain" to automatically route future links from that domain to your chosen profile
- **Settings page** — View and manage all saved domain-to-profile mappings
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

2. **Load the extension** in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `extension/` folder from this repo
   - Copy the **extension ID** shown under the extension name

3. **Install the native messaging host:**

   ```bash
   ./install.sh <extension-id>
   ```

   Or run `./install.sh` without arguments and paste the extension ID when prompted.

4. **Restart Chrome** to activate the native messaging connection.

## Usage

1. Click a link in any external app (Mail, Slack, Notes, etc.)
2. Chrome opens and the Profile Router confirmation page appears
3. Click a profile (or press its number key) to open the link in that profile
4. Optionally check **"Remember for this domain"** to auto-route future links

### Managing Saved Domains

Click the **Settings** link on the confirmation page (or navigate to the extension's settings page) to view, remove, or clear all saved domain mappings.

## How It Works

1. The Chrome extension listens for new tabs created without an `openerTabId` — these are tabs opened by external apps
2. When detected, the extension checks if the domain has a saved profile mapping
3. If saved: the link opens automatically in the saved profile (via the native host) and the tab closes
4. If not saved: the confirmation page appears with a list of available Chrome profiles
5. The native messaging host (Python script) reads Chrome's `Local State` file to discover profiles, and uses the macOS `open` command to launch URLs in specific profiles

## Project Structure

```
chrome-profile-router/
├── extension/
│   ├── manifest.json          # Manifest V3 extension config
│   ├── background.js          # Service worker — detection + native messaging
│   ├── confirmation.html/js   # Profile picker UI
│   ├── settings.html/js       # Manage remembered domains
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

## License

MIT

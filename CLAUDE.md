# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) + Python 3 native messaging host for macOS. Intercepts links opened from external apps (Mail, Slack, etc.), shows a profile picker, and opens the URL in the chosen Chrome profile. Supports remembering domain-to-profile mappings.

## Architecture

**Extension (`extension/`)** — Manifest V3 Chrome extension (unpacked, no build step):
- `background.js` — Service worker. Detects external navigations via `chrome.tabs.onCreated` (tabs without `openerTabId`). Communicates with native host via `chrome.runtime.sendNativeMessage()`. Checks domain memory and either auto-routes or redirects to confirmation page.
- `confirmation.html/js` — Profile picker UI. Shows URL, profile buttons, "Remember for this domain" checkbox, cancel. Auto-closes after dispatching to native host.
- `settings.html/js` — Manage saved domain→profile mappings stored in `chrome.storage.local`.
- `styles.css` — Shared styles (dark mode preferred).

**Native Host (`native-host/`)** — Standalone Python 3 script (no pip dependencies):
- `profile_router_host.py` — Chrome native messaging protocol (length-prefixed JSON on stdin/stdout). Two actions: `list_profiles` (reads `~/Library/Application Support/Google/Chrome/Local State` → `profile.info_cache`) and `open` (runs `open -na "Google Chrome" --args --profile-directory="<dir>" <url>`).
- `com.profile_router.host.json` — Native messaging host manifest template.

**Native messaging host name:** `com.profile_router.host`

**Install (`install.sh`)** — Makes Python script executable, generates host manifest with absolute path, places it in `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`.

## Key Constraints

- macOS only
- Manifest V3 only
- Python 3 only, zero external dependencies
- Installed as unpacked extension (no Chrome Web Store)
- The full spec is in `prompt.md`

## Workflow Rules

- **Always keep `README.md` up to date.** This is an MIT-licensed open source project. Any change that affects usage, installation, features, or configuration must be reflected in the README.

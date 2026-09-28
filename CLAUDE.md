# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A macOS AppleScript app that registers as the default web browser. Links opened from external apps (Mail, Slack, etc.) arrive at the app first; it shows a Chrome profile picker and opens the URL in the chosen profile. Supports remembering domain and URL-path → profile rules. No Chrome profile sees a link until the user picks one, so nothing leaks into another profile's history.

## Architecture

**App (`app/ProfileRouter.applescript`)**: the whole app, AppleScript + AppleScriptObjC (Foundation/AppKit):
- `on open location`: entry point for every http/https link → `routeURL`.
- `on run`: launched directly → home screen (default-browser status, manage rules).
- `chromeProfiles()`: parses `~/Library/Application Support/Google/Chrome/Local State` → `profile.info_cache`, sorted by name.
- `showPicker()`: `NSAlert` with one button per profile (key equivalents 1–9, Escape = Cancel) and an `NSPopUpButton` accessory for "Always for <host>" / "Always for <host/path>/…".
- Rules: JSON at `~/Library/Application Support/Chrome Profile Router/rules.json` with `domains` (exact host) and `paths` (prefix, longest match wins, beats domains).
- Opening: `open -na "Google Chrome" --args --profile-directory=<dir> <url>`.

**Install (`install.sh`)**: `osacompile` → patch `Info.plist` via PlistBuddy (`CFBundleIdentifier` `com.profilerouter.app`, `CFBundleURLTypes` http/https, `LSUIElement`) → icon → ad-hoc `codesign` → `~/Applications/Profile Router.app` → `lsregister`.

**Uninstall (`uninstall.sh`)**: removes the app; `--purge` also removes rules.

## Key Constraints

- macOS only; zero dependencies beyond what ships with macOS
- Do not use AppleScript reserved words / scripting-addition terms as variable names (e.g. `handler`, `kind`, `label`), because `osacompile` fails or behaves oddly
- Launch Services ignores apps in temp dirs (`in-temp-dir`), so test builds must live outside `/tmp` (use the gitignored `build/`)

## Testing

- Compile check: `osacompile -o build/Test.app app/ProfileRouter.applescript`
- Handlers can be exercised headlessly: `load script` the compiled `Contents/Resources/Scripts/main.scpt` from an `osascript` harness and call `chromeProfiles()`, `urlParts()`, `matchingRule()`, etc.
- Send a link without changing the default browser: `open -a "<path>/Test.app" "https://example.com"`
- Unregister test builds afterwards (`lsregister -u`) so they don't linger in the Default web browser list

## Workflow Rules

- **Always keep `README.md` up to date.** This is an MIT-licensed open source project. Any change that affects usage, installation, features, or configuration must be reflected in the README.

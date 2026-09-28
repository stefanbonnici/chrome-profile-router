# Chrome Profile Router

A tiny macOS app that asks which Chrome profile to use **before** a link from an external app (Mail, Slack, Notes, Terminal, …) opens.

Profile Router registers itself as your default web browser. Every link you click outside Chrome arrives at Profile Router first, which shows a profile picker and then opens the link in the Chrome profile you choose. Because no Chrome profile touches the link until you pick one, it never shows up in the history, "Recently Closed" list, or cookies of the wrong profile.

It's a single AppleScript app with no dependencies: everything it needs ships with macOS.

## Features

- **Profile picker**: one button per Chrome profile, shown before any profile loads the link
- **Keyboard shortcuts**: press 1–9 to pick a profile, Escape to cancel
- **Complete isolation**: the link only reaches the profile you chose, with no history, recently closed tab, or cookie trail in any other profile
- **Remember your choice**: the picker's dropdown can save a rule so future links skip the picker:
  - **Always for `slack.com`**: every link on that domain goes to the chosen profile
  - **Always for `github.com/org-a/…`**: only links under that path prefix (up to 3 levels deep are offered)
- **Rule management**: open the app directly to see and remove saved rules
- **Plain-text rules**: rules live in a readable JSON file you can edit by hand

## Requirements

- macOS 13 (Ventura) or later
- Google Chrome

## Installation

```bash
git clone https://github.com/stefanbonnici/chrome-profile-router.git
cd chrome-profile-router
./install.sh
```

The installer compiles `Profile Router.app` into `~/Applications` and then opens it. Click **Set Default Browser…** and choose **Profile Router** under **Default web browser** in System Settings.

That's it. Click a link in any other app to see the picker.

> Chrome will probably show a "Chrome isn't your default browser" bar now and then. Dismiss it (or click the ✕); Chrome is still the browser that actually opens your pages.

### Updating

Pull the latest code and run `./install.sh` again. Saved rules are kept.

### Uninstalling

```bash
./uninstall.sh           # keeps saved rules
./uninstall.sh --purge   # also deletes saved rules
```

Then choose a new default web browser (e.g. Google Chrome) in System Settings. The uninstaller opens the right page.

## Usage

1. Click a link in any app outside Chrome.
2. The picker appears, showing the link.
3. Click a profile or press its number (1–9). Press Escape to cancel; the link then goes nowhere.
4. Optionally choose an **Always for …** option in the dropdown first to remember the choice.

Links inside Chrome are not affected: Chrome handles those itself as usual.

### Managing Saved Rules

Open **Profile Router** from `~/Applications` (or Spotlight). It shows whether it is your default browser, and **Manage Rules…** lists every rule. Select rules and click **Remove** to delete them.

Rules are stored in `~/Library/Application Support/Chrome Profile Router/rules.json`:

```json
{
  "domains" : {
    "slack.com" : "Profile 1"
  },
  "paths" : {
    "github.com/org-a" : "Default"
  }
}
```

- Values are Chrome profile **directory** names (`Default`, `Profile 1`, …), not display names.
- Domain rules match the exact host (`slack.com` does not match `app.slack.com`).
- Path rules match the prefix itself and anything below it (`github.com/org-a` matches `github.com/org-a/repo`, but not `github.com/org-ab`). Matching is case-sensitive.
- The longest matching path rule wins; path rules take priority over domain rules.
- If a rule points to a profile that no longer exists, the picker is shown instead.

## How It Works

1. `install.sh` compiles `app/ProfileRouter.applescript` with `osacompile`, declares the `http`/`https` URL schemes in the app's `Info.plist` (which is what makes macOS offer it as a default browser), hides its Dock icon (`LSUIElement`), re-signs it ad hoc, and registers it with Launch Services.
2. With Profile Router as the default browser, macOS delivers each clicked link to the app's `open location` handler.
3. The app reads Chrome's profile list from `~/Library/Application Support/Google/Chrome/Local State` (`profile.info_cache`).
4. If a saved rule matches, the link opens straight away; otherwise a macOS picker (`NSAlert`) is shown.
5. The link is opened with `open -na "Google Chrome" --args --profile-directory="<dir>" <url>`.

## Project Structure

```
chrome-profile-router/
├── app/
│   ├── ProfileRouter.applescript   # The whole app: routing, picker, rules
│   └── icon.png                    # App icon (converted to .icns at install)
├── install.sh                      # Build + install into ~/Applications
├── uninstall.sh                    # Remove the app (and optionally rules)
└── README.md
```

## Troubleshooting

- **Links still open straight in Chrome**: Profile Router isn't the default browser. Open the app and click **Set Default Browser…**.
- **Profile Router is missing from the Default web browser list**: run `./install.sh` again. It must live outside temporary folders (the installer uses `~/Applications`).
- **"Couldn't read your Chrome profiles"**: Chrome hasn't been run on this Mac yet, or it's installed under a different name. Launch Chrome once and retry.
- **A link keeps going to the wrong profile**: a saved rule matches it. Open the app → **Manage Rules…** and remove it.

## License

MIT

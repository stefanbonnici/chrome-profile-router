#!/bin/bash
# Removes "Profile Router.app". Saved rules are kept unless --purge is given.
set -euo pipefail

APP_NAME="Profile Router"
BUNDLE_ID="com.profilerouter.app"
APP_PATH="$HOME/Applications/$APP_NAME.app"
RULES_DIR="$HOME/Library/Application Support/Chrome Profile Router"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

osascript -e "if application id \"$BUNDLE_ID\" is running then tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true

if [ -d "$APP_PATH" ]; then
    "$LSREGISTER" -u "$APP_PATH" || true
    rm -rf "$APP_PATH"
    echo "[OK] Removed $APP_PATH"
else
    echo "[OK] App not installed"
fi

if [ "${1:-}" = "--purge" ]; then
    rm -rf "$RULES_DIR"
    echo "[OK] Removed saved rules"
else
    echo "     Saved rules kept in: $RULES_DIR (run with --purge to delete)"
fi

echo ""
echo "Now pick a new default web browser (e.g. Google Chrome) in System Settings."
open "x-apple.systempreferences:com.apple.Desktop-Settings.extension"

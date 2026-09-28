#!/bin/bash
# Builds "Profile Router.app" from app/ProfileRouter.applescript and installs
# it into ~/Applications, registered as a handler for http/https links.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Profile Router"
BUNDLE_ID="com.profilerouter.app"
VERSION="2.0.0"
INSTALL_DIR="$HOME/Applications"
APP_PATH="$INSTALL_DIR/$APP_NAME.app"
PLISTBUDDY="/usr/libexec/PlistBuddy"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

echo "Chrome Profile Router — Installer"
echo "==================================="
echo ""

if [ "$(uname)" != "Darwin" ]; then
    echo "[ERROR] Profile Router only runs on macOS"
    exit 1
fi

if ! open -Ra "Google Chrome" 2>/dev/null; then
    echo "[WARN] Google Chrome was not found. Install it before using Profile Router."
fi

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
BUILD_APP="$BUILD_DIR/$APP_NAME.app"
PLIST="$BUILD_APP/Contents/Info.plist"

osacompile -o "$BUILD_APP" "$SCRIPT_DIR/app/ProfileRouter.applescript"
echo "[OK] Compiled app"

"$PLISTBUDDY" -c "Set :CFBundleIdentifier $BUNDLE_ID" "$PLIST" 2>/dev/null \
    || "$PLISTBUDDY" -c "Add :CFBundleIdentifier string $BUNDLE_ID" "$PLIST"
"$PLISTBUDDY" -c "Set :CFBundleName $APP_NAME" "$PLIST" 2>/dev/null \
    || "$PLISTBUDDY" -c "Add :CFBundleName string $APP_NAME" "$PLIST"
"$PLISTBUDDY" -c "Delete :CFBundleShortVersionString" "$PLIST" 2>/dev/null || true
"$PLISTBUDDY" -c "Add :CFBundleShortVersionString string $VERSION" "$PLIST"
# Background app: no Dock icon, only the picker window.
"$PLISTBUDDY" -c "Delete :LSUIElement" "$PLIST" 2>/dev/null || true
"$PLISTBUDDY" -c "Add :LSUIElement bool true" "$PLIST"
# Declaring http/https is what makes macOS offer it as a default web browser.
"$PLISTBUDDY" -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
"$PLISTBUDDY" -c "Add :CFBundleURLTypes array" "$PLIST"
"$PLISTBUDDY" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
"$PLISTBUDDY" -c "Add :CFBundleURLTypes:0:CFBundleURLName string Web URL" "$PLIST"
"$PLISTBUDDY" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
"$PLISTBUDDY" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string http" "$PLIST"
"$PLISTBUDDY" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:1 string https" "$PLIST"

ICON_SRC="$SCRIPT_DIR/app/icon.png"
if [ -f "$ICON_SRC" ]; then
    sips -s format icns "$ICON_SRC" --out "$BUILD_APP/Contents/Resources/applet.icns" >/dev/null
    # The compiled asset catalog would otherwise override applet.icns.
    rm -f "$BUILD_APP/Contents/Resources/Assets.car"
    "$PLISTBUDDY" -c "Delete :CFBundleIconName" "$PLIST" 2>/dev/null || true
fi

# Editing Info.plist invalidates osacompile's signature; re-sign ad hoc.
codesign --force --deep --sign - "$BUILD_APP" 2>/dev/null
echo "[OK] Configured as http/https handler ($BUNDLE_ID)"

# Quit a running copy before replacing it.
osascript -e "if application id \"$BUNDLE_ID\" is running then tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true

mkdir -p "$INSTALL_DIR"
rm -rf "$APP_PATH"
ditto "$BUILD_APP" "$APP_PATH"
"$LSREGISTER" -f "$APP_PATH"
echo "[OK] Installed $APP_PATH"

echo ""
echo "==================================="
echo "Installation complete!"
echo ""
echo "Last step: make Profile Router your default web browser."
echo "Opening it now — click “Set Default Browser…” and pick “Profile Router”."
open "$APP_PATH"

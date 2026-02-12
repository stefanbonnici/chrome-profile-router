#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.profile_router.host"
HOST_SCRIPT="$SCRIPT_DIR/native-host/profile_router_host.py"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"

echo "Chrome Profile Router — Installer"
echo "==================================="
echo ""

# Make the Python script executable
chmod +x "$HOST_SCRIPT"
echo "[OK] Made native host script executable"

# Create the NativeMessagingHosts directory if it doesn't exist
mkdir -p "$MANIFEST_DIR"

# Get extension ID from argument or prompt
EXTENSION_ID="$1"

if [ -z "$EXTENSION_ID" ]; then
    echo ""
    echo "To find your extension ID:"
    echo "  1. Open chrome://extensions in any profile"
    echo "  2. Enable 'Developer mode' (top right)"
    echo "  3. Click 'Load unpacked' and select: $SCRIPT_DIR/extension"
    echo "  4. Copy the extension ID shown under the extension name"
    echo ""
    echo "Note: The ID is the same across all profiles when loaded from the same path."
    echo ""
    read -p "  Extension ID: " EXTENSION_ID
fi

if [ -z "$EXTENSION_ID" ]; then
    echo "[ERROR] Extension ID is required"
    exit 1
fi

# Generate manifest with correct paths
cat > "$MANIFEST_PATH" << EOF
{
  "name": "$HOST_NAME",
  "description": "Chrome Profile Router - opens URLs in specific Chrome profiles",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo ""
echo "[OK] Installed native messaging host manifest"
echo "     Extension ID: $EXTENSION_ID"
echo "     Manifest: $MANIFEST_PATH"
echo ""
echo "==================================="
echo "Installation complete!"
echo ""
echo "Load the extension in every Chrome profile (same ID, same folder),"
echo "then restart Chrome to activate the native messaging host."

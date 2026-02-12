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

# Collect extension IDs from arguments or prompt
EXTENSION_IDS=("$@")

if [ ${#EXTENSION_IDS[@]} -eq 0 ]; then
    echo ""
    echo "The extension must be installed in EVERY Chrome profile."
    echo "For each profile:"
    echo "  1. Switch to that profile in Chrome"
    echo "  2. Open chrome://extensions"
    echo "  3. Enable 'Developer mode' (top right)"
    echo "  4. Click 'Load unpacked' and select: $SCRIPT_DIR/extension"
    echo "  5. Copy the extension ID shown under the extension name"
    echo ""
    echo "Enter each extension ID (one per line). Press Enter on a blank line when done:"

    while true; do
        read -p "  Extension ID: " EXT_ID
        if [ -z "$EXT_ID" ]; then
            break
        fi
        EXTENSION_IDS+=("$EXT_ID")
    done
fi

if [ ${#EXTENSION_IDS[@]} -eq 0 ]; then
    echo "[ERROR] At least one extension ID is required"
    exit 1
fi

# Build allowed_origins array
ORIGINS=""
for i in "${!EXTENSION_IDS[@]}"; do
    if [ "$i" -gt 0 ]; then
        ORIGINS="$ORIGINS,"
    fi
    ORIGINS="$ORIGINS
    \"chrome-extension://${EXTENSION_IDS[$i]}/\""
done

# Generate manifest with correct paths
cat > "$MANIFEST_PATH" << EOF
{
  "name": "$HOST_NAME",
  "description": "Chrome Profile Router - opens URLs in specific Chrome profiles",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [$ORIGINS
  ]
}
EOF

echo ""
echo "[OK] Installed native messaging host manifest with ${#EXTENSION_IDS[@]} extension ID(s):"
for EXT_ID in "${EXTENSION_IDS[@]}"; do
    echo "     - $EXT_ID"
done
echo ""
echo "     Manifest: $MANIFEST_PATH"
echo ""
echo "==================================="
echo "Installation complete!"
echo ""
echo "Restart Chrome to activate the native messaging host."
echo ""
echo "To add more profiles later, re-run this script with all extension IDs:"
echo "  ./install.sh <id1> <id2> <id3> ..."

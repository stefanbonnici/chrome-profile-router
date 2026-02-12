#!/usr/bin/env python3
"""Chrome native messaging host for Profile Router.

Handles two actions:
  - list_profiles: reads Chrome's Local State to discover profiles
  - open: opens a URL in a specific Chrome profile via `open` command
"""

import json
import os
import struct
import subprocess
import sys


def read_message():
    """Read a native messaging message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    length = struct.unpack("=I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def send_message(message):
    """Send a native messaging message to stdout."""
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def list_profiles():
    """Read Chrome's Local State and return profile info."""
    local_state_path = os.path.expanduser(
        "~/Library/Application Support/Google/Chrome/Local State"
    )

    if not os.path.exists(local_state_path):
        return {"error": "Chrome Local State file not found"}

    try:
        with open(local_state_path, "r") as f:
            local_state = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        return {"error": f"Failed to read Local State: {e}"}

    info_cache = local_state.get("profile", {}).get("info_cache", {})
    if not info_cache:
        return {"error": "No profiles found in Local State"}

    profiles = []
    for directory, info in info_cache.items():
        profiles.append({
            "directory": directory,
            "name": info.get("name", directory),
        })

    profiles.sort(key=lambda p: p["directory"])
    return {"profiles": profiles}


def open_url(url, profile_directory):
    """Open a URL in Chrome with a specific profile."""
    if not url:
        return {"error": "No URL provided"}
    if not profile_directory:
        return {"error": "No profile directory provided"}

    try:
        subprocess.Popen([
            "open", "-na", "Google Chrome", "--args",
            f"--profile-directory={profile_directory}",
            url,
        ])
        return {"success": True}
    except Exception as e:
        return {"error": f"Failed to open URL: {e}"}


def main():
    message = read_message()
    action = message.get("action")

    if action == "list_profiles":
        response = list_profiles()
    elif action == "open":
        response = open_url(message.get("url"), message.get("profile"))
    else:
        response = {"error": f"Unknown action: {action}"}

    send_message(response)


if __name__ == "__main__":
    main()

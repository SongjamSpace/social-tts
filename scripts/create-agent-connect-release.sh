#!/usr/bin/env bash
# Create a GitHub release for Agent Connect and upload the Mac .dmg and Android APK.
# Usage: ./scripts/create-agent-connect-release.sh <path-to-dmg> <path-to-apk>
# Example: ./scripts/create-agent-connect-release.sh packages/agent-connect/release/Agent\ Connect-0.1.0-arm64.dmg packages/agent-connect-android/app/build/outputs/apk/debug/app-debug.apk
# Requires: gh (GitHub CLI) installed and authenticated, and repo https://github.com/SongjamSpace/agent-connect

set -e
REPO="SongjamSpace/agent-connect"
TAG="v0.1.0"
DMG_ASSET_NAME="Agent-Connect-0.1.0.dmg"
APK_ASSET_NAME="app-debug.apk"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <path-to-dmg> <path-to-apk>"
  echo "Example: $0 packages/agent-connect/release/Agent\\ Connect-0.1.0-arm64.dmg packages/agent-connect-android/app/build/outputs/apk/debug/app-debug.apk"
  exit 1
fi

DMG_PATH="$1"
APK_PATH="$2"

if [ ! -f "$DMG_PATH" ]; then
  echo "DMG not found: $DMG_PATH"
  exit 1
fi
if [ ! -f "$APK_PATH" ]; then
  echo "APK not found: $APK_PATH"
  exit 1
fi

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT
cp "$DMG_PATH" "$TMP/$DMG_ASSET_NAME"
cp "$APK_PATH" "$TMP/$APK_ASSET_NAME"

echo "Creating release $TAG in $REPO and uploading $DMG_ASSET_NAME and $APK_ASSET_NAME..."
gh release create "$TAG" \
  "$TMP/$DMG_ASSET_NAME" \
  "$TMP/$APK_ASSET_NAME" \
  --repo "$REPO" \
  --title "$TAG"

echo "Done. Downloads:"
echo "  Mac:    https://github.com/$REPO/releases/download/$TAG/$DMG_ASSET_NAME"
echo "  Android: https://github.com/$REPO/releases/download/$TAG/$APK_ASSET_NAME"

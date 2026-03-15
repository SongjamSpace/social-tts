
#!/bin/bash

APP_PATH="$1"

if [[ -z "$APP_PATH" ]]; then

  echo "Usage: $0 <app_path>"

  exit 1

fi

echo "Checking if $APP_PATH is quarantined or gatekeeper blocked..."

xattr -l "$APP_PATH" | grep -i com.apple.quarantine && echo "QUARANTINED - Run: xattr -r -d com.apple.quarantine \"$APP_PATH\""

codesign --verify --verbose "$APP_PATH" 2>&1 | grep -v "valid on disk" && echo "CODESIGN ISSUE - Re-sign or clear quarantine"

spctl --assess --verbose "$APP_PATH" && echo "Gatekeeper OK" || echo "GATEKEEPER BLOCKED"


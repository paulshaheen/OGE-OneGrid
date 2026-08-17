#!/usr/bin/env bash
# ============================================================================
#  OneGrid Deployment Wizard - ONE-FILE launcher for macOS.
#
#  The macOS counterpart to OneGrid-Wizard.cmd. Download this one file and
#  double-click it (first time: right-click -> Open, to get past Gatekeeper on
#  an unsigned download). It fetches the wizard from the public repo, installs
#  Node.js + Azure CLI + PowerShell 7 with Homebrew if you don't have them,
#  opens your browser, and starts the wizard.
#
#  No git, no clone, no npm, nothing to type. Azure sign-in is a button in the
#  wizard itself.
# ============================================================================
set -uo pipefail
BOOT="https://raw.githubusercontent.com/paulshaheen/OGE-OneGrid/main/deploy-ui/bootstrap-mac.sh"
TMP="$(mktemp -t onegrid-bootstrap-mac).sh"

echo "Fetching the OneGrid wizard launcher..."
if ! curl -fsSL "$BOOT" -o "$TMP"; then
  echo ""
  echo "  Could not reach GitHub to download the launcher."
  echo "  Check your internet connection and try again."
  read -r -p "  Press Enter to close" _ || true
  exit 1
fi

bash "$TMP"
code=$?
rm -f "$TMP" 2>/dev/null || true
if [ "$code" -ne 0 ]; then
  echo ""
  echo "  Launch failed - see the messages above."
  read -r -p "  Press Enter to close" _ || true
fi
exit "$code"

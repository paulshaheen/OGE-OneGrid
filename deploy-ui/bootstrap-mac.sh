#!/usr/bin/env bash
# ============================================================================
#  bootstrap-mac.sh - fetched and run by the one-file OneGrid-Wizard.command.
#
#  The macOS counterpart to deploy-ui/bootstrap-online.ps1 + bootstrap.ps1.
#  It is intentionally self-contained: one script downloads the lightweight
#  wizard, installs the three prerequisites (Node.js, Azure CLI, PowerShell 7)
#  with Homebrew if missing, opens the browser, and starts the local wizard.
#
#  No git, no clone, no npm. Azure sign-in is a button inside the wizard UI.
#
#  Overrides (optional env vars):
#    ONEGRID_WIZARD_URL  - full URL to OneGrid-Wizard.zip
#    ONEGRID_HOME        - install directory
#    ONEGRID_FORCE       - '1' to force a fresh re-download
#    DEPLOY_UI_PORT      - wizard port (default 7333)
# ============================================================================
set -uo pipefail

ZIP_URL="${ONEGRID_WIZARD_URL:-https://github.com/paulshaheen/OGE-OneGrid/releases/latest/download/OneGrid-Wizard.zip}"
HOME_DIR="${ONEGRID_HOME:-$HOME/Library/Application Support/OneGrid-Wizard}"
PORT="${DEPLOY_UI_PORT:-7333}"
FORCE="${ONEGRID_FORCE:-0}"

# ---------- pretty console helpers -------------------------------------------
c_blue='\033[1;34m'; c_white='\033[1;37m'; c_gray='\033[0;90m'
c_green='\033[0;32m'; c_yellow='\033[0;33m'; c_red='\033[0;31m'; c_cyan='\033[0;36m'; c_off='\033[0m'
info(){ printf "      ${c_gray}..  %s${c_off}\n" "$1"; }
ok(){   printf "      ${c_green}OK  %s${c_off}\n" "$1"; }
warn(){ printf "      ${c_yellow}!!  %s${c_off}\n" "$1"; }
step(){ printf "\n  ${c_cyan}[%s] %s${c_off}\n" "$1" "$2"; }
die(){  printf "\n  ${c_red}ERROR  %s${c_off}\n\n" "$1"; read -r -p "  Press Enter to close" _ || true; exit 1; }

clear 2>/dev/null || true
printf "\n"
printf "   ${c_blue}###########################################################${c_off}\n"
printf "   ${c_blue}#        ${c_white}O N E G R I D   Deployment  Wizard${c_blue}               #${c_off}\n"
printf "   ${c_blue}#        ${c_gray}Microsoft Fabric solution accelerator${c_blue}            #${c_off}\n"
printf "   ${c_blue}###########################################################${c_off}\n"
printf "\n"
info "install folder : $HOME_DIR"
info "wizard port    : $PORT"

EXTRACT_ROOT="$HOME_DIR/OneGrid-Wizard"

is_complete(){
  [ -f "$1/deploy-ui/server.js" ] && \
  [ -f "$1/deploy.ps1" ] && \
  [ -d "$1/fabric/notebooks" ] && \
  [ -d "$1/fabric/semanticmodel" ] && \
  [ -d "$1/fabric/digitaltwinbuilder" ]
}

# ---------- 0. Homebrew (package manager) ------------------------------------
step 0 "Checking Homebrew (installs the prerequisites)"
if ! command -v brew >/dev/null 2>&1; then
  # Load brew into PATH in case it is installed but not on this shell's PATH.
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
  done
fi
if ! command -v brew >/dev/null 2>&1; then
  warn "Homebrew not found - installing it (you may be prompted for your Mac password)"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    || die "Homebrew install failed. Install it from https://brew.sh then re-run this launcher."
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
  done
fi
command -v brew >/dev/null 2>&1 || die "Homebrew is required. Install it from https://brew.sh then re-run this launcher."
ok "Homebrew found ($(command -v brew))"

ensure_tool(){ # cmd  friendly  brew-args...
  local cmd="$1" friendly="$2"; shift 2
  if command -v "$cmd" >/dev/null 2>&1; then ok "$friendly found ($(command -v "$cmd"))"; return 0; fi
  info "$friendly not found - installing with Homebrew..."
  brew install "$@" >/dev/null 2>&1 || brew install "$@" \
    || die "$friendly could not be installed. Run 'brew install $*' manually, then re-run this launcher."
  command -v "$cmd" >/dev/null 2>&1 || die "$friendly installed but '$cmd' is not on PATH. Open a new terminal and re-run this launcher."
  ok "$friendly installed"
}

step 1 "Checking Node.js (runs the wizard)"
ensure_tool node "Node.js" node

step 2 "Checking Azure CLI (talks to Azure + Fabric)"
ensure_tool az "Azure CLI" azure-cli

step 3 "Checking PowerShell 7 (runs the deploy engine)"
ensure_tool pwsh "PowerShell 7" --cask powershell

# ---------- 4. download + extract the wizard ---------------------------------
step 4 "Getting the latest wizard"
mkdir -p "$HOME_DIR"
ZIP="$HOME_DIR/OneGrid-Wizard.zip"
downloaded=0
info "downloading from $ZIP_URL"
if curl -fL --progress-bar -o "$ZIP" "$ZIP_URL"; then
  downloaded=1
  ok "downloaded $(du -m "$ZIP" 2>/dev/null | cut -f1) MB"
else
  if is_complete "$EXTRACT_ROOT"; then
    info "could not download; using the complete copy already on disk"
  else
    die "could not download the wizard and no complete copy is on disk. Check your connection and try again."
  fi
fi

if [ "$downloaded" = "1" ]; then
  step 5 "Extracting (clean)"
  rm -rf "$EXTRACT_ROOT" 2>/dev/null || true
  if [ -d "$EXTRACT_ROOT" ]; then
    HOME_DIR="$HOME_DIR/v$(date +%Y%m%d%H%M%S)"
    mkdir -p "$HOME_DIR"
    EXTRACT_ROOT="$HOME_DIR/OneGrid-Wizard"
    info "previous copy was locked; installing a fresh copy in $HOME_DIR"
  fi
  unzip -q -o "$ZIP" -d "$HOME_DIR" || die "could not extract the wizard zip."
  rm -f "$ZIP" 2>/dev/null || true
  is_complete "$EXTRACT_ROOT" || die "extraction was incomplete under $EXTRACT_ROOT. Delete $HOME_DIR and run this again."
  ok "extracted to $EXTRACT_ROOT"
fi

SERVER="$EXTRACT_ROOT/deploy-ui/server.js"
[ -f "$SERVER" ] || die "server.js not found at $SERVER. Re-run this launcher."

# ---------- 6. launch --------------------------------------------------------
step 6 "Starting the wizard and opening your browser"
info "the wizard will handle Azure sign-in for you (a button on the first screen)"
printf "\n"
printf "   ${c_green}>> Opening http://localhost:%s${c_off}\n" "$PORT"
printf "   ${c_gray}>> Keep this window open while you use the wizard. Close it to stop.${c_off}\n\n"

# already running on this port? just open it.
if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
  printf "   ${c_yellow}The wizard is already running on port %s - opening it in your browser.${c_off}\n" "$PORT"
  open "http://localhost:$PORT" >/dev/null 2>&1 || true
  exit 0
fi

# open the browser once the server is actually accepting connections
( for _ in $(seq 1 120); do
    if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then open "http://localhost:$PORT" >/dev/null 2>&1; break; fi
    sleep 0.5
  done ) &

# run the server in THIS window so its verbose log streams live to the console
export DEPLOY_UI_PORT="$PORT"
cd "$EXTRACT_ROOT/deploy-ui"
exec node server.js

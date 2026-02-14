#!/usr/bin/env bash
# Upgrade Cursor editor on Ubuntu/Debian.
# Usage: ./upgrade-cursor-ubuntu.sh [version]
#   No version: try apt upgrade, then fallback to latest .deb download.
#   Version (e.g. 2.4): download and install that specific .deb.

set -e

ARCH="${ARCH:-x64}"   # or arm64
DEB_DIR="${DEB_DIR:-/tmp/cursor-upgrade}"
PACKAGE_NAME="cursor"

# Official download base (version in path, e.g. .../cursor/2.4)
DOWNLOAD_BASE="https://api2.cursor.sh/updates/download/golden/linux-${ARCH}-deb/cursor"

# --- helpers ---
log() { echo "[cursor-upgrade] $*"; }
err() { echo "[cursor-upgrade] ERROR: $*" >&2; }

# Detect architecture for deb
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "x64" ;;
  esac
}

# Fetch latest version number from official download page (fragile but no API)
get_latest_version() {
  local page
  page=$(curl -sL "https://cursor.com/en/downloads" 2>/dev/null || true)
  if [[ -z "$page" ]]; then
    echo ""
    return 1
  fi
  # Match first linux-x64-deb (or arm64) link with version: .../cursor/VERSION
  if echo "$page" | grep -oP "linux-${ARCH}-deb/cursor/\K[0-9]+\.[0-9]+" | head -1; then
    return 0
  fi
  echo ""
  return 1
}

# Upgrade via apt if Cursor repo is configured
apt_upgrade() {
  if ! command -v apt-get &>/dev/null; then
    return 1
  fi
  # Check if cursor is installed from a repo (cursor.com or similar)
  if ! dpkg -l "$PACKAGE_NAME" &>/dev/null; then
    return 1
  fi
  log "Upgrading Cursor via apt..."
  sudo apt-get update -qq
  sudo apt-get install -y --only-upgrade "$PACKAGE_NAME"
  log "Apt upgrade finished."
  return 0
}

# Download .deb and install
deb_install() {
  local version="$1"
  if [[ -z "$version" ]]; then
    err "Version is required for .deb install."
    return 1
  fi

  ARCH="$(detect_arch)"
  DOWNLOAD_BASE="https://api2.cursor.sh/updates/download/golden/linux-${ARCH}-deb/cursor"
  local url="${DOWNLOAD_BASE}/${version}"
  local deb_file="${DEB_DIR}/cursor_${version}_${ARCH}.deb"

  log "Downloading Cursor ${version} (${ARCH})..."
  mkdir -p "$DEB_DIR"
  if ! curl -sSLf -o "$deb_file" "$url"; then
    err "Download failed. Check version (e.g. 2.4) and network."
    return 1
  fi

  log "Installing .deb..."
  sudo dpkg -i "$deb_file"
  log "Done. You can remove the installer: rm -f $deb_file"
  return 0
}

# --- main ---
main() {
  local version="${1:-}"

  ARCH="$(detect_arch)"
  DOWNLOAD_BASE="https://api2.cursor.sh/updates/download/golden/linux-${ARCH}-deb/cursor"

  if [[ -n "$version" ]]; then
    deb_install "$version"
    return $?
  fi

  # No version: try apt upgrade first
  if apt_upgrade; then
    return 0
  fi

  # Fallback: fetch latest and install .deb
  log "Apt upgrade not available (package not installed or no repo). Downloading latest .deb..."
  version=$(get_latest_version) || true
  if [[ -z "$version" ]]; then
    # Hardcode a known recent version as fallback
    version="2.4"
    log "Could not detect latest version; using ${version}. Pass a version as first argument to override."
  else
    log "Detected latest version: ${version}"
  fi
  deb_install "$version"
}

main "$@"

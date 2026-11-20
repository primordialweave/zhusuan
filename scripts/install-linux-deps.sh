#!/usr/bin/env bash
set -euo pipefail

# Ubuntu 24.04 GitHub runners can lose connectivity to a particular official mirror.
# Use command-local sources, preserving signature checks and the runner's /etc/apt files.
keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg
if [[ ! -f "$keyring" ]]; then
  printf 'Ubuntu archive keyring is missing: %s\n' "$keyring" >&2
  exit 1
fi
work_dir=$(mktemp -d -t zhusuan-apt.XXXXXX)
trap 'rm -rf "$work_dir"' EXIT
sources_file="$work_dir/ubuntu.sources"
apt_options=(-o "Dir::Etc::sourcelist=$sources_file" -o Dir::Etc::sourceparts=-
  -o Acquire::Retries=1 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15
  -o APT::Update::Error-Mode=any)
# Wails 3.1 defaults to GTK4 and WebKitGTK 6.0 on Linux.
packages=(libgtk-4-dev libwebkitgtk-6.0-dev build-essential "$@")
downloaded=false
for mirror in https://azure.archive.ubuntu.com/ubuntu/ https://archive.ubuntu.com/ubuntu/; do
  cat > "$sources_file" <<EOF
Types: deb
URIs: $mirror
Suites: noble noble-updates noble-backports noble-security
Components: main restricted universe multiverse
Signed-By: $keyring
EOF
  printf 'Preparing Linux dependencies using %s\n' "$mirror"
  # Download before invoking dpkg, so a network timeout cannot interrupt installation.
  if sudo timeout --kill-after=5s 50s apt-get "${apt_options[@]}" update &&
    sudo timeout --kill-after=5s 130s apt-get "${apt_options[@]}" install \
      --download-only --no-install-recommends -y "${packages[@]}"; then
    downloaded=true
    break
  fi
  printf 'Mirror failed or timed out: %s\n' "$mirror" >&2
done
if [[ "$downloaded" != true ]]; then
  printf 'Unable to download Linux dependencies from either official Ubuntu mirror.\n' >&2
  exit 1
fi
# The complete worst-case budget is 540s plus at most 25s of termination grace.
sudo timeout --kill-after=5s 180s apt-get "${apt_options[@]}" install \
  --no-download --no-install-recommends -y "${packages[@]}"

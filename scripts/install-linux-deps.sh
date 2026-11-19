#!/usr/bin/env bash
set -euo pipefail

# Ubuntu 24.04 GitHub runners may select a slow regional HTTP mirror.
# Only change the ephemeral runner's mirror lists; APT still verifies package signatures.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
fi
if [[ -f /etc/apt/apt-security-mirrors.txt ]]; then
  printf '%s\n' 'https://security.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-security-mirrors.txt >/dev/null
fi
apt_options=(-o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)
sudo apt-get "${apt_options[@]}" update
sudo apt-get "${apt_options[@]}" install --no-install-recommends -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev build-essential "$@"

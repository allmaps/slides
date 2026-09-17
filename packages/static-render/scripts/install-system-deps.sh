#!/bin/sh
set -eu

# Shared by native CI builds and Docker build stages. Run as root on Ubuntu 24.04.
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this script as root (for example: sudo sh packages/static-render/scripts/install-system-deps.sh).' >&2
  exit 1
fi
. /etc/os-release
if [ "$ID" != ubuntu ] || [ "$VERSION_ID" != 24.04 ]; then
  echo 'The native renderer dependency setup supports Ubuntu 24.04.' >&2
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates tini xvfb xauth libopengl0 libglx0 libcurl4t64 \
  libjpeg-turbo8 libuv1t64 libx11-6 libxext6 libwebp7 libicu74 libpng16-16t64
rm -rf /var/lib/apt/lists/*

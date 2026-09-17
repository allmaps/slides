#!/bin/sh
set -eu
# MapLibre Native's Linux build uses GLX. Start its virtual display once per batch.
exec xvfb-run -a "$@"

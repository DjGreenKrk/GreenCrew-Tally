#!/usr/bin/env bash
# Builds luac.cross from the exact nodemcu-firmware commit of the base image
# flashed onto tallies (nodemcu-3.0-master_20200610 float, see D1-MINI-4X4.md).
# Bytecode must match the firmware's Lua build, so never use another version.
# Usage: scripts/build-luac-cross.sh [work-dir]   -> prints the luac.cross path
set -euo pipefail

NODEMCU_COMMIT=8d091c476edf6ae2977a5f2a74bf5824d07d6183
WORK_DIR="${1:-${XDG_CACHE_HOME:-$HOME/.cache}/vtally-nodemcu-firmware-$NODEMCU_COMMIT}"

if [ ! -x "$WORK_DIR/luac.cross" ]; then
  mkdir -p "$WORK_DIR"
  cd "$WORK_DIR"
  [ -d .git ] || git init -q
  git fetch -q --depth 1 https://github.com/nodemcu/nodemcu-firmware.git "$NODEMCU_COMMIT"
  git checkout -q FETCH_HEAD
  make -s -C app/lua/luac_cross >&2
fi
echo "$WORK_DIR/luac.cross"

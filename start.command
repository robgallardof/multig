#!/bin/bash
set -e
cd "$(dirname "$0")"
if command -v pnpm >/dev/null 2>&1; then
  echo "[start] pnpm detected. Using pnpm..."
  exec ./start-pnpm.sh
else
  echo "[start] pnpm not found. Falling back to npm..."
  exec ./start-npm.sh
fi

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

pnpm install

if [ ! -d ".next" ]; then
  pnpm run build
fi

URL="http://localhost:6969"
(
  sleep 4
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  fi
) &

pnpm start

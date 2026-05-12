#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo "MultiGlacer - Prepare environment (macOS/Linux)"
echo "=============================================="

echo "[check] Python is required: https://www.python.org/downloads/"
if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "[error] Python not found in PATH. Install Python 3.10+ and retry."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

"$PY" --version

echo "[check] Node.js is required: https://nodejs.org/en/download"
if ! command -v node >/dev/null 2>&1; then
  echo "[error] Node.js not found in PATH. Install Node.js 20+ and retry."
  exit 1
fi
node --version

if command -v pnpm >/dev/null 2>&1; then
  PM=pnpm
else
  PM=npm
fi

echo "[info] Package manager: $PM"
echo "[step] Installing Node dependencies..."
$PM install

echo "[step] Upgrading pip..."
"$PY" -m pip install --upgrade pip

echo "[step] Installing Python requirements..."
"$PY" -m pip install -r python/requirements.txt

echo "[step] Fetching Camoufox browser assets..."
"$PY" -m camoufox fetch

echo "[done] Environment prepared successfully."
echo "You can now run ./start.command"

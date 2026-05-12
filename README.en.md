# MultiGlacer

Platform to manage multiple persistent browser profiles with Camoufox + Next.js + Python.

## Features

- Isolated persistent profiles (cookies, localStorage, fingerprint, session state).
- Wplace mode with Tampermonkey and JShelter preinstalled.
- `.kgm` (recommended) and `.wbot` bundle upload support.
- Proxy assignment per profile.

## Requirements

- Node.js 20+
- Python 3.10+
- Python download: https://www.python.org/downloads/
- Node.js download: https://nodejs.org/en/download

## Local setup (step by step)

1. Install Node dependencies:

```bash
npm install
```

2. Start app:

```bash
npm run dev
```

3. Open `http://localhost:6969`.

4. Click **Prepare environment** in UI (installs Python deps and fetches Camoufox).

### One-click environment scripts

- Windows: run `prepare-environment.bat`
- macOS/Linux: run `./prepare-environment.command`

These scripts:
- detect Python/Node and print versions,
- install dependencies with `pnpm` (if available) or `npm`,
- install Python requirements from `python/requirements.txt`,
- run `python -m camoufox fetch`.

## Create profiles

### Normal profile

1. Click **New profile**.
2. Fill name, URL and OS.
3. Enable/disable proxy.
4. Click **Save**.

### Wplace profile

1. Click **New profile**.
2. Enable **Wplace mode**.
3. Paste tokens (one per line / comma separated).
4. Optionally select base profile.
5. Save.

## Addons

Every new instance includes:
- Tampermonkey (private-window access disabled by default)

Optional addons:
- JShelter (`javascript-restrictor`) only if `WPLACE_ENABLE_JSHELTER=true`
- extra addon URLs via `WPLACE_EXTRA_ADDON_URLS`

If JShelter is enabled, it is also kept disabled for private windows by default.

## Docker

```bash
docker compose up --build
```

## Start scripts (auto npm/pnpm)

- Windows: `start.bat` (auto-detects pnpm, fallback to npm)
- macOS/Linux: `./start.command` (auto-detects pnpm, fallback to npm)

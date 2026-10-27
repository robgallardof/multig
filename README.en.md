<a id="top"></a>

<h1 align="center">MultiGlacer</h1>

<p align="center">Manage independent browser profiles from one panel. Prepare the environment, create a profile and open it when you need it.</p>

Platform to manage multiple persistent browser profiles with Camoufox + Next.js + Python.

## Features

- Isolated persistent profiles (cookies, localStorage, fingerprint, session state).
- Wplace mode with Tampermonkey and JShelter preinstalled.
- `.kgm` (recommended) and `.wbot` bundle upload support.
- Proxy assignment per profile.
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


## Requirements

- Node.js 20+
- Python 3.10+
- Python download: https://www.python.org/downloads/
- Node.js download: https://nodejs.org/en/download
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


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
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


## Docker

```bash
docker compose up --build
```
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


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
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


## Addons

Every new instance includes:
- Tampermonkey Beta (`firefox-current-beta.xpi`, private-window access enabled by default)

Optional addons:
- JShelter (`javascript-restrictor`) only if `WPLACE_ENABLE_JSHELTER=true`
- extra addon URLs via `WPLACE_EXTRA_ADDON_URLS`

If JShelter is enabled, it is also kept enabled for private windows by default.
<p align="center"><img src="assets/readme-builder/kit/wave.svg" alt="" width="100%" /></p>


## Start scripts (auto npm/pnpm)

- Windows: `start.bat` (auto-detects pnpm, fallback to npm)
- macOS/Linux: `./start.command` (auto-detects pnpm, fallback to npm)

<p align="center"><a href="#top"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/readme-builder/kit/btn-back-to-top-outline-sm-dark.svg" /><img src="assets/readme-builder/kit/btn-back-to-top-outline-sm-light.svg" alt="Back to top" height="34" /></picture></a></p>

<!-- readme-builder:signature:start -->
<p align="center"><a href="https://github.com/robgallardof"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/readme/brand/signature-en-dark.svg" /><img src="assets/readme/brand/signature-en-light.svg" alt="MultiGlacer / Roberto Gallardo" width="100%" /></picture></a></p>
<!-- readme-builder:signature:end -->

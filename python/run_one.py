#!/usr/bin/env python3
"""
Single session runner for Camoufox (persistent profile).

SRP: open one persistent window bound to a profile directory and keep it alive.

@author  Roberto Gallardo
@since   2026-01-23
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import zipfile
import hashlib
from pathlib import Path
from shutil import copyfile
from camoufox.sync_api import Camoufox

TAMPERMONKEY_ADDON_URL = "https://addons.mozilla.org/firefox/downloads/latest/tampermonkey/latest.xpi"


def _parse_args() -> argparse.Namespace:
    """
    Parses CLI arguments.

    @return Parsed args.
    """
    p = argparse.ArgumentParser(description="Open one persistent Camoufox window using a profile directory.")
    p.add_argument("--profile", required=True, help="Profile directory path (persistent user data).")
    p.add_argument("--url", required=True, help="URL to open in the window.")
    p.add_argument("--proxy-server", required=False, help="Proxy server URL, e.g. http://ip:port")
    p.add_argument("--proxy-username", required=False, help="Proxy username")
    p.add_argument("--proxy-password", required=False, help="Proxy password")
    p.add_argument("--config-json", required=False, help="JSON config for Camoufox fingerprint spoofing")
    p.add_argument("--addon-url", required=False, help="Addon URL (XPI) to preload in the profile")
    return p.parse_args()


def _data_dir() -> Path:
    data_root = os.getenv("DATA_DIR", "data")
    return Path(data_root).resolve()


def _addon_cache_path(addon_url: str) -> Path:
    digest = hashlib.sha256(addon_url.encode("utf-8")).hexdigest()[:12]
    return _data_dir() / "addons" / f"addon-{digest}.xpi"


def _download_addon(path: Path, url: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    tmp_path = path.with_suffix(".tmp")
    with urllib.request.urlopen(url) as response:
        tmp_path.write_bytes(response.read())
    tmp_path.replace(path)


def _addon_id_from_xpi(path: Path) -> str:
    with zipfile.ZipFile(path, "r") as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
    gecko = (
        manifest.get("browser_specific_settings", {})
        .get("gecko", {})
        .get("id")
    )
    if gecko:
        return gecko
    legacy = manifest.get("applications", {}).get("gecko", {}).get("id")
    if legacy:
        return legacy
    raise ValueError("Addon manifest missing Gecko ID.")


def _ensure_addon(profile_dir: Path, addon_url: str) -> None:
    addon_path = _addon_cache_path(addon_url)
    _download_addon(addon_path, addon_url)
    addon_id = _addon_id_from_xpi(addon_path)
    extensions_dir = profile_dir / "extensions"
    extensions_dir.mkdir(parents=True, exist_ok=True)
    target = extensions_dir / f"{addon_id}.xpi"
    if not target.exists():
        copyfile(addon_path, target)


def main() -> None:
    """
    Launches one persistent session window.
    """
    a = _parse_args()

    proxy = None
    if a.proxy_server:
        proxy = {"server": a.proxy_server}
        if a.proxy_username:
            proxy["username"] = a.proxy_username
        if a.proxy_password:
            proxy["password"] = a.proxy_password

    config = json.loads(a.config_json) if a.config_json else {}
    if not isinstance(config, dict):
        raise ValueError("config-json must be a JSON object.")

    headless_env = os.getenv("CAMOUFOX_HEADLESS", "").strip().lower()
    headless: object
    if headless_env in {"1", "true", "yes"}:
        headless = True
    elif headless_env == "virtual":
        headless = "virtual"
    else:
        headless = False

    if sys.platform.startswith("linux") and not os.getenv("DISPLAY"):
        headless = "virtual"

    profile_dir = Path(a.profile)
    addon_url = (a.addon_url or "").strip() or TAMPERMONKEY_ADDON_URL
    _ensure_addon(profile_dir, addon_url)

    with Camoufox(
        persistent_context=True,
        user_data_dir=str(profile_dir),
        headless=headless,
        proxy=proxy,
        **config,
    ) as ctx:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(a.url)
        page.wait_for_timeout(24 * 60 * 60 * 1000)


if __name__ == "__main__":
    main()

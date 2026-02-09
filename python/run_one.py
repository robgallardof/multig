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
from camoufox.sync_api import Camoufox


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
    return p.parse_args()


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

    with Camoufox(
        persistent_context=True,
        user_data_dir=a.profile,
        headless=headless,
        proxy=proxy,
        **config,
    ) as ctx:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(a.url)
        page.wait_for_timeout(24 * 60 * 60 * 1000)


if __name__ == "__main__":
    main()

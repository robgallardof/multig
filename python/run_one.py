#!/usr/bin/env python3
"""
Single session runner for Camoufox (persistent profile).

SRP: open one persistent window bound to a profile directory and keep it alive.

@author  Roberto Gallardo
@since   2026-01-23
"""

from __future__ import annotations

import argparse
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

    with Camoufox(
        persistent_context=True,
        user_data_dir=a.profile,
        headless=False,
        proxy=proxy,
    ) as ctx:
        page = ctx.new_page()
        page.goto(a.url)
        page.wait_for_timeout(24 * 60 * 60 * 1000)


if __name__ == "__main__":
    main()

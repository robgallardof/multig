#!/usr/bin/env python3
"""
Import/export cookies for a Camoufox persistent profile.

SRP: read cookies JSON and write into profile, or export cookies to JSON.

@author  Roberto Gallardo
@since   2026-01-23
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from camoufox.sync_api import Camoufox


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import/export cookies for a Camoufox profile directory.")
    p.add_argument("--profile", required=True, help="Profile directory path (persistent user data).")
    p.add_argument("--action", required=True, choices=["import", "export"], help="Action to perform.")
    return p.parse_args()


def _normalize_same_site(value: Any) -> str | None:
    if not value:
        return None
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    if key in {"lax", "strict", "none"}:
        return key.capitalize()
    if key in {"unspecified", "no_restriction"}:
        return None
    return None


def _normalize_cookie(raw: dict[str, Any]) -> dict[str, Any]:
    if "name" not in raw:
        raise ValueError("Cookie missing name")
    if "value" not in raw:
        raise ValueError(f"Cookie {raw.get('name')} missing value")

    cookie: dict[str, Any] = {
        "name": str(raw.get("name")),
        "value": str(raw.get("value")),
        "path": raw.get("path") or "/",
    }

    if raw.get("domain"):
        cookie["domain"] = raw.get("domain")

    if raw.get("secure") is not None:
        cookie["secure"] = bool(raw.get("secure"))

    if raw.get("httpOnly") is not None:
        cookie["httpOnly"] = bool(raw.get("httpOnly"))

    same_site = _normalize_same_site(raw.get("sameSite"))
    if same_site:
        cookie["sameSite"] = same_site

    expires_raw = raw.get("expirationDate", raw.get("expires"))
    if expires_raw:
        try:
            expires = float(expires_raw)
        except (TypeError, ValueError):
            expires = None
        if expires and expires > 0:
            cookie["expires"] = expires

    return cookie


def _load_input_json() -> Any:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Missing cookies JSON on stdin.")
    return json.loads(raw)


def _configure_headless() -> object:
    headless_env = os.getenv("CAMOUFOX_HEADLESS", "").strip().lower()
    if headless_env in {"1", "true", "yes"}:
        return True
    if headless_env == "virtual":
        return "virtual"
    if sys.platform.startswith("linux") and not os.getenv("DISPLAY"):
        return "virtual"
    return False


def _with_context(profile_dir: str, fn) -> Any:
    with Camoufox(
        persistent_context=True,
        user_data_dir=profile_dir,
        headless=_configure_headless(),
    ) as ctx:
        return fn(ctx)


def _import_cookies(profile_dir: str) -> None:
    payload = _load_input_json()
    if not isinstance(payload, list):
        raise ValueError("Cookies JSON must be an array.")
    cookies = [_normalize_cookie(item) for item in payload]
    if not cookies:
        raise ValueError("No cookies to import.")

    def run(ctx) -> None:
        ctx.add_cookies(cookies)

    _with_context(profile_dir, run)


def _export_cookies(profile_dir: str) -> None:
    def run(ctx):
        return ctx.cookies()

    cookies = _with_context(profile_dir, run)
    json.dump(cookies, sys.stdout, ensure_ascii=False, indent=2)


def main() -> None:
    args = _parse_args()

    if args.action == "import":
        _import_cookies(args.profile)
        return
    if args.action == "export":
        _export_cookies(args.profile)
        return

    raise ValueError("Unsupported action")


if __name__ == "__main__":
    main()

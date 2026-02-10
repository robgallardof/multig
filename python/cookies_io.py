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
    p.add_argument("--profile", help="Profile directory path (persistent user data).")
    p.add_argument("--action", required=True, choices=["import", "export", "import-batch"], help="Action to perform.")
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

    domain = raw.get("domain")
    if domain:
        domain = str(domain)
        host_only = raw.get("hostOnly")
        if isinstance(host_only, str):
            host_only = host_only.strip().lower() in {"1", "true", "yes"}
        if host_only and domain.startswith("."):
            domain = domain.lstrip(".")
        cookie["domain"] = domain

    secure = raw.get("secure")
    if secure is not None:
        if isinstance(secure, str):
            secure = secure.strip().lower() in {"1", "true", "yes"}
        cookie["secure"] = bool(secure)

    http_only = raw.get("httpOnly")
    if http_only is not None:
        if isinstance(http_only, str):
            http_only = http_only.strip().lower() in {"1", "true", "yes"}
        cookie["httpOnly"] = bool(http_only)

    same_site = _normalize_same_site(raw.get("sameSite"))
    if same_site:
        cookie["sameSite"] = same_site

    session_flag = raw.get("session")
    if isinstance(session_flag, str):
        session_flag = session_flag.strip().lower() in {"1", "true", "yes"}
    expires_raw = raw.get("expirationDate", raw.get("expires"))
    if expires_raw and not session_flag:
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


def _import_cookies_batch() -> None:
    payload = _load_input_json()
    if not isinstance(payload, list):
        raise ValueError("Batch payload must be an array.")

    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Each batch item must be an object.")
        profile_dir = item.get("profile")
        raw_cookies = item.get("cookies")
        if not profile_dir or not isinstance(profile_dir, str):
            raise ValueError("Each batch item requires a valid profile path.")
        if not isinstance(raw_cookies, list):
            raise ValueError("Each batch item requires a cookies array.")
        cookies = [_normalize_cookie(cookie) for cookie in raw_cookies]
        if not cookies:
            continue

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
    if args.action != "import-batch" and not args.profile:
        raise ValueError("--profile is required for this action")

    if args.action == "import":
        _import_cookies(args.profile)
        return
    if args.action == "export":
        _export_cookies(args.profile)
        return
    if args.action == "import-batch":
        _import_cookies_batch()
        return

    raise ValueError("Unsupported action")


if __name__ == "__main__":
    main()

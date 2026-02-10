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
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
import hashlib
from pathlib import Path
from shutil import copyfile
from camoufox.sync_api import Camoufox

TAMPERMONKEY_ADDON_URL = "https://addons.mozilla.org/firefox/downloads/latest/tampermonkey/latest.xpi"
WPLACE_SCRIPT_DEFAULT = (
    "https://github.com/SoundOfTheSky/wplace-bot/raw/refs/heads/main/dist.user.js"
)


def _normalize_github_raw_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    parsed = urllib.parse.urlsplit(value)
    host = parsed.netloc.lower()
    path = parsed.path.strip("/")

    # GitHub ".../raw/..." links redirect and in some Camoufox profiles
    # that redirect chain does not trigger Tampermonkey install detection reliably.
    # We normalize to raw.githubusercontent.com to avoid relying on that redirect.
    if host in {"github.com", "www.github.com"}:
        parts = path.split("/")
        if len(parts) >= 6 and parts[2] == "raw":
            owner = parts[0]
            repo = parts[1]
            remainder = "/".join(parts[3:])
            if owner and repo and remainder:
                return f"https://raw.githubusercontent.com/{owner}/{repo}/{remainder}"

    return value


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
    p.add_argument(
        "--prepare-only",
        action="store_true",
        help="Install addon/userscript if needed and exit without leaving the browser running.",
    )
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


def _ensure_addon(profile_dir: Path, addon_url: str) -> bool:
    addon_path = _addon_cache_path(addon_url)
    _download_addon(addon_path, addon_url)
    addon_id = _addon_id_from_xpi(addon_path)
    extensions_dir = profile_dir / "extensions"
    extensions_dir.mkdir(parents=True, exist_ok=True)
    target = extensions_dir / f"{addon_id}.xpi"
    if target.exists():
        return False
    copyfile(addon_path, target)
    return True


def _ensure_firefox_prefs(profile_dir: Path) -> None:
    prefs_path = profile_dir / "user.js"
    prefs = {
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
        "extensions.ui.notifyUnsigned": False,
        "xpinstall.signatures.required": False,
        "xpinstall.enabled": True,
        "extensions.langpacks.signatures.required": False,
        "extensions.webextensions.restrictedDomains": "",
        "extensions.install.requireSecureOrigin": False,
        "extensions.allowPrivateBrowsingByDefault": True,
        "extensions.privatebrowsing.notification": False,
    }
    lines = []
    for key, value in prefs.items():
        if isinstance(value, bool):
            value_str = "true" if value else "false"
        elif isinstance(value, int):
            value_str = str(value)
        else:
            value_str = f"\"{value}\""
        lines.append(f"user_pref(\"{key}\", {value_str});\n")
    existing = ""
    if prefs_path.exists():
        existing = prefs_path.read_text(encoding="utf-8", errors="ignore")
    with prefs_path.open("a", encoding="utf-8") as handle:
        for line in lines:
            if line.strip() not in existing:
                handle.write(line)


def _normalize_userscript_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""

    # Allow values copied from Tampermonkey install pages.
    # Keep unwrapping until we reach the real userscript URL.
    for _ in range(5):
        if "tampermonkey.net/script_installation.php" not in value:
            break
        parsed = urllib.parse.urlsplit(value)
        encoded = ""
        if parsed.fragment.startswith("url="):
            encoded = parsed.fragment[len("url=") :].strip()
        if not encoded:
            query_url = urllib.parse.parse_qs(parsed.query).get("url")
            if query_url:
                encoded = query_url[0].strip()
        if not encoded:
            return ""
        decoded = urllib.parse.unquote(encoded).strip()
        if not decoded or decoded == value:
            break
        value = decoded

    if "tampermonkey.net/script_installation.php" in value:
        return ""

    return _normalize_github_raw_url(value)


def _tampermonkey_install_url(raw_script_url: str) -> str:
    target = _normalize_userscript_url(raw_script_url)
    if not target:
        return ""
    encoded = urllib.parse.quote(target, safe=":/%")
    return f"https://www.tampermonkey.net/script_installation.php#url={encoded}"


def _wplace_script_url() -> str:
    configured = os.getenv("WPLACE_TAMPERMONKEY_SCRIPT_URL", "").strip()
    if configured:
        normalized = _normalize_userscript_url(configured)
        if normalized:
            return normalized
    return _normalize_userscript_url(WPLACE_SCRIPT_DEFAULT)


def _wplace_marker(profile_dir: Path) -> Path:
    return profile_dir / ".wplace_userscript_installed"


def _read_env_flag(value: str) -> bool:
    if not value:
        return False
    return value.strip().lower() in {"1", "true", "yes"}


def _wplace_storage_payload() -> str | None:
    if not _read_env_flag(os.getenv("WPLACE_ENABLED", "")):
        return None
    raw = os.getenv("WPLACE_WBOT_STORAGE", "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return json.dumps(parsed)


def _inject_wplace_storage(ctx: Camoufox, page) -> None:
    payload = _wplace_storage_payload()
    if not payload:
        return
    try:
        page.goto("https://wplace.live", wait_until="domcontentloaded")
        page.evaluate("value => localStorage.setItem('wbot', value)", payload)
    except Exception:
        pass


def _close_tampermonkey_welcome(ctx: Camoufox) -> None:
    for page in list(ctx.pages):
        try:
            url = page.url or ""
            if "tampermonkey.net" in url:
                page.close()
        except Exception:
            continue


def _download_userscript(profile_dir: Path) -> Path | None:
    url = _wplace_script_url()
    if not url or not url.startswith(("http://", "https://")):
        return None
    target = profile_dir / "wplace-bot.user.js"
    try:
        with urllib.request.urlopen(url) as response:
            content = response.read()
        if not content:
            return None
        target.write_bytes(content)
        return target
    except Exception:
        return None


def _get_webext_uuid(profile_dir: Path, addon_id: str) -> str | None:
    prefs_path = profile_dir / "prefs.js"
    if not prefs_path.exists():
        return None

    text = prefs_path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r'user_pref\("extensions\.webextensions\.uuids",\s*"(.+)"\);\s*', text)
    if not match:
        return None

    raw = match.group(1)
    raw = raw.replace(r'\"', '"').replace(r"\\", "\\")
    try:
        mapping = json.loads(raw)
    except Exception:
        return None
    if not isinstance(mapping, dict):
        return None
    value = mapping.get(addon_id)
    if not isinstance(value, str) or not value:
        return None
    return value


def _install_userscript_via_dashboard(ctx: Camoufox, profile_dir: Path, script_path: Path) -> bool:
    addon_id = "firefox@tampermonkey.net"
    uuid = _get_webext_uuid(profile_dir, addon_id)
    if not uuid:
        return False

    dash_url = f"moz-extension://{uuid}/options.html"
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        page.goto(dash_url, wait_until="domcontentloaded")
    except Exception:
        return False
    page.wait_for_timeout(1200)

    try:
        page.get_by_role(
            "button",
            name=re.compile(r"(Add a new script|Add new script|Añadir un nuevo script|Nuevo script)", re.I),
        ).click(timeout=4000)
    except Exception:
        try:
            page.get_by_text(
                re.compile(r"(Add a new script|Add new script|Añadir un nuevo script|Nuevo script)", re.I)
            ).click(timeout=4000)
        except Exception:
            return False

    page.wait_for_timeout(800)
    code = script_path.read_text(encoding="utf-8", errors="ignore")

    pasted = False
    try:
        textarea = page.locator("textarea").first
        textarea.wait_for(state="visible", timeout=3000)
        textarea.fill(code)
        pasted = True
    except Exception:
        pass

    if not pasted:
        try:
            pasted = bool(
                page.evaluate(
                    """(code) => {
                        const cmEl = document.querySelector('.CodeMirror');
                        if (!cmEl || !cmEl.CodeMirror) return false;
                        cmEl.CodeMirror.setValue(code);
                        return true;
                    }""",
                    code,
                )
            )
        except Exception:
            pasted = False

    if not pasted:
        return False

    try:
        page.keyboard.press("Control+S")
    except Exception:
        pass

    try:
        page.get_by_role("button", name=re.compile(r"(Save|Guardar)", re.I)).click(timeout=2000)
    except Exception:
        pass

    page.wait_for_timeout(1200)
    return True


def _click_install_button(page, timeout_ms: int = 8000) -> bool:
    try:
        button = page.get_by_role(
            "button",
            name=re.compile(r"^(Install|Reinstall|Confirm|Confirm installation|Instalar|Reinstalar|Confirmar)$", re.I),
        )
        button.first.wait_for(state="visible", timeout=timeout_ms)
        button.first.click()
        return True
    except Exception:
        pass
    try:
        candidates = page.locator("input[type='submit'], button, a")
        count = candidates.count()
        for idx in range(count):
            el = candidates.nth(idx)
            label = (el.inner_text() or "").strip().lower()
            if not label:
                label = (el.get_attribute("value") or "").strip().lower()
            if label and any(word in label for word in ("install", "reinstall", "confirm", "instalar", "confirmar")):
                el.click()
                return True
    except Exception:
        return False
    return False


def _wait_install_success(page, timeout_ms: int = 6000) -> bool:
    try:
        page.get_by_text(re.compile(r"(installed|reinstall|instalado|reinstalar)", re.I)).wait_for(
            state="visible",
            timeout=timeout_ms,
        )
        return True
    except Exception:
        return False


def _attempt_install(ctx: Camoufox, page, install_url: str) -> bool:
    try:
        page.goto(install_url, wait_until="domcontentloaded")
        if not _click_install_button(page):
            return False
        confirmed = False
        try:
            new_page = ctx.wait_for_event("page", timeout=4000)
        except Exception:
            new_page = None
        if new_page:
            confirmed = _click_install_button(new_page, timeout_ms=10000)
            new_page.wait_for_timeout(1000)
            success_new_page = _wait_install_success(new_page, timeout_ms=4000)
            if success_new_page:
                confirmed = True
            try:
                new_page.close()
            except Exception:
                pass
        if _wait_install_success(page, timeout_ms=4000):
            return True
        return confirmed
    except Exception:
        return False


def _attempt_install_with_retries(ctx: Camoufox, page, install_url: str, retries: int = 3) -> bool:
    if not install_url:
        return False
    for _ in range(max(1, retries)):
        if _attempt_install(ctx, page, install_url):
            return True
        page.wait_for_timeout(1200)
    return False


def _candidate_install_urls(script_url: str, local_script: Path | None) -> list[str]:
    urls: list[str] = []

    # 1) Direct userscript URL (en Camoufox esto puede disparar Tampermonkey mejor que
    # la landing de script_installation.php en algunos entornos).
    normalized_script = _normalize_userscript_url(script_url)
    if normalized_script:
        urls.append(normalized_script)

    # 2) URL oficial de instalación de Tampermonkey.
    wrapped_url = _tampermonkey_install_url(script_url)
    if wrapped_url:
        urls.append(wrapped_url)

    # 3) Fallback local al archivo .user.js descargado en el perfil.
    if local_script:
        urls.append(local_script.as_uri())
        local_wrapped = _tampermonkey_install_url(local_script.as_uri())
        if local_wrapped:
            urls.append(local_wrapped)

    seen = set()
    deduped: list[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped


def _close_secondary_pages(ctx: Camoufox, keep_page) -> None:
    for page in list(ctx.pages):
        if page == keep_page:
            continue
        try:
            page.close()
        except Exception:
            continue


def _install_wplace_script(ctx: Camoufox, profile_dir: Path, page) -> None:
    marker = _wplace_marker(profile_dir)
    if marker.exists():
        return
    script_url = _wplace_script_url()
    _close_tampermonkey_welcome(ctx)
    page.wait_for_timeout(1500)

    # Preferred deterministic path: download script content and paste it
    # directly in Tampermonkey dashboard (no user interaction required).
    local_script = _download_userscript(profile_dir)
    success = bool(local_script and local_script.exists()) and _install_userscript_via_dashboard(
        ctx,
        profile_dir,
        local_script,
    )

    # Keep URL-based install as fallback only.
    if not success:
        for install_url in _candidate_install_urls(script_url, local_script):
            success = _attempt_install_with_retries(ctx, page, install_url)
            if success:
                break

    page.wait_for_timeout(1500)
    if success:
        marker.write_text("installed")


def _run_context(
    profile_dir: Path,
    proxy,
    config: dict,
    target_url: str,
    headless,
    prepare_only: bool,
    install_userscript: bool,
) -> None:
    with Camoufox(
        persistent_context=True,
        user_data_dir=str(profile_dir),
        headless=headless,
        proxy=proxy,
        no_viewport=True,
        **config,
    ) as ctx:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        if prepare_only:
            if install_userscript:
                _install_wplace_script(ctx, profile_dir, page)
            _close_tampermonkey_welcome(ctx)
            _close_secondary_pages(ctx, page)
            _inject_wplace_storage(ctx, page)
            return
        _close_tampermonkey_welcome(ctx)
        _close_secondary_pages(ctx, page)
        _inject_wplace_storage(ctx, page)
        page.goto(target_url)
        try:
            page.evaluate(
                "(() => { window.moveTo(0, 0); window.resizeTo(screen.availWidth, screen.availHeight); })()"
            )
        except Exception:
            pass
        try:
            ctx.wait_for_event("close")
        except Exception:
            while True:
                time.sleep(3600)


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
    _ensure_firefox_prefs(profile_dir)
    addon_installed_now = _ensure_addon(profile_dir, addon_url)

    if a.prepare_only and addon_installed_now:
        # Firefox/Camoufox can require one startup cycle after copying the XPI
        # before Tampermonkey starts intercepting .user.js installs.
        _run_context(
            profile_dir,
            proxy,
            config,
            a.url,
            headless,
            prepare_only=True,
            install_userscript=False,
        )

    _run_context(
        profile_dir,
        proxy,
        config,
        a.url,
        headless,
        prepare_only=bool(a.prepare_only),
        install_userscript=True,
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Single session runner for Camoufox (persistent profile).

SRP: open one persistent window bound to a profile directory and keep it alive.

@author  King Gallardo
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
from camoufox import DefaultAddons
from camoufox.sync_api import Camoufox

TAMPERMONKEY_ADDON_URL = "https://addons.mozilla.org/firefox/downloads/latest/tampermonkey/latest.xpi"
JSHELTER_ADDON_URL = "https://addons.mozilla.org/firefox/downloads/latest/javascript-restrictor/latest.xpi"
WPLACE_SCRIPT_DEFAULT = (
    "https://github.com/robgallardof/kglacer-macro/raw/refs/heads/main/dist.user.js"
)


TAMPERMONKEY_EDITOR_ANCHORS = (
    "userscript.html",
    "options.html#nav=new-user-script+editor",
    "options.html#nav=new-user-script%2Beditor",
)
TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR = "#td_bmV3LXVzZXItc2NyaXB0X2VkaXQ"


TAMPERMONKEY_ADDON_ID = "firefox@tampermonkey.net"


def _tampermonkey_dashboard_url(profile_dir: Path) -> str:
    uuid = _get_webext_uuid(profile_dir, TAMPERMONKEY_ADDON_ID)
    if uuid:
        return f"moz-extension://{uuid}/options.html#nav=dashboard"
    return "about:addons"


def _log(level: str, message: str, **context: object) -> None:
    payload = {
        "level": (level or "INFO").upper(),
        "message": message,
        "context": context,
    }
    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr, flush=True)


def _log_exception(message: str, exc: Exception, **context: object) -> None:
    _log("ERROR", message, error=str(exc), **context)


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
    if path.exists() and not _should_refresh_cached_addon(path, url):
        return
    tmp_path = path.with_suffix(".tmp")
    with urllib.request.urlopen(url) as response:
        tmp_path.write_bytes(response.read())
    tmp_path.replace(path)


def _should_refresh_cached_addon(path: Path, url: str) -> bool:
    if not path.exists():
        return True
    if "/latest/" not in url:
        return False
    max_age_seconds = 60 * 60 * 24
    age_seconds = time.time() - path.stat().st_mtime
    return age_seconds >= max_age_seconds


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


def _ensure_addon(profile_dir: Path, addon_url: str) -> tuple[bool, str]:
    addon_path = _addon_cache_path(addon_url)
    _download_addon(addon_path, addon_url)
    addon_id = _addon_id_from_xpi(addon_path)
    extensions_dir = profile_dir / "extensions"
    extensions_dir.mkdir(parents=True, exist_ok=True)
    target = extensions_dir / f"{addon_id}.xpi"
    if target.exists():
        return (False, addon_id)
    copyfile(addon_path, target)
    return (True, addon_id)


def _fallback_addon_id(addon_url: str) -> str | None:
    normalized = (addon_url or "").strip().lower()
    if "tampermonkey" in normalized:
        return "firefox@tampermonkey.net"
    if "javascript-restrictor" in normalized or "jshelter" in normalized:
        return "jshelter@jshelter.org"
    return None




def _pin_addons_in_nav(profile_dir: Path, addon_ids: list[str]) -> None:
    if not addon_ids:
        return

    widget_ids: list[str] = []
    for addon_id in addon_ids:
        if not addon_id:
            continue
        # Firefox has used different widget-id encodings depending on addon/runtime
        # (raw id vs normalized id). We persist both candidates to maximize pinning.
        # Only use Firefox's canonical browser-action widget id format.
        # Injecting guessed/normalized ids can create non-functional toolbar
        # buttons that appear pinned but do not open the extension popup.
        candidates = [
            f"{addon_id}-browser-action",
        ]
        for candidate in candidates:
            if candidate and candidate not in widget_ids:
                widget_ids.append(candidate)
    if not widget_ids:
        return

    prefs_path = profile_dir / "user.js"
    existing_text = ""
    if prefs_path.exists():
        existing_text = prefs_path.read_text(encoding="utf-8", errors="ignore")

    state: dict[str, object] = {}
    m = re.search(r'user_pref\("browser\.uiCustomization\.state",\s*"((?:\\.|[^"\\])*)"\s*\);', existing_text)
    if m:
        try:
            encoded = bytes(m.group(1), "utf-8").decode("unicode_escape")
            loaded = json.loads(encoded)
            if isinstance(loaded, dict):
                state = loaded
        except Exception:
            state = {}

    placements = state.get("placements") if isinstance(state.get("placements"), dict) else {}
    nav_bar = placements.get("nav-bar") if isinstance(placements.get("nav-bar"), list) else []

    defaults = [
        "back-button",
        "forward-button",
        "stop-reload-button",
        "urlbar-container",
        "downloads-button",
        "unified-extensions-button",
    ]

    merged_nav: list[str] = []
    for item in [*defaults, *nav_bar, *widget_ids]:
        if isinstance(item, str) and item and item not in merged_nav:
            merged_nav.append(item)

    placements["nav-bar"] = merged_nav
    state["placements"] = placements

    seen = state.get("seen") if isinstance(state.get("seen"), list) else []
    merged_seen: list[str] = [x for x in seen if isinstance(x, str) and x]
    for widget_id in widget_ids:
        if widget_id not in merged_seen:
            merged_seen.append(widget_id)
    state["seen"] = merged_seen

    line = f'user_pref("browser.uiCustomization.state", {json.dumps(json.dumps(state, separators=(",", ":")))});\n'
    existing_lines = existing_text.splitlines(keepends=True)
    filtered = [ln for ln in existing_lines if 'user_pref("browser.uiCustomization.state",' not in ln]
    filtered.append(line)
    prefs_path.parent.mkdir(parents=True, exist_ok=True)
    prefs_path.write_text("".join(filtered), encoding="utf-8")


def _set_addons_private_mode(profile_dir: Path, addon_ids: list[str], allowed: bool) -> None:
    if not addon_ids:
        return
    settings_path = profile_dir / "extension-settings.json"
    payload: dict[str, object] = {}
    if settings_path.exists():
        try:
            loaded = json.loads(settings_path.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(loaded, dict):
                payload = loaded
        except Exception:
            payload = {}

    updated = False
    for addon_id in addon_ids:
        if not addon_id:
            continue
        current = payload.get(addon_id)
        if not isinstance(current, dict):
            current = {}
        if current.get("privateBrowsingAllowed") is allowed:
            payload[addon_id] = current
            continue
        current["privateBrowsingAllowed"] = allowed
        payload[addon_id] = current
        updated = True

    if updated:
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")





def _purge_ublock_addons(profile_dir: Path) -> None:
    known_ids = {
        "uBlock0@raymondhill.net",
        "uBlock0@raymondhill.net.xpi",
    }
    extensions_dir = profile_dir / "extensions"
    if not extensions_dir.exists():
        return

    removed: list[str] = []
    for item in extensions_dir.iterdir():
        name = item.name
        lower = name.lower()
        should_remove = name in known_ids or "ublock" in lower or "u-block" in lower
        if not should_remove:
            continue
        try:
            if item.is_file() or item.is_symlink():
                item.unlink(missing_ok=True)
            elif item.is_dir():
                for child in item.iterdir():
                    if child.is_file() or child.is_symlink():
                        child.unlink(missing_ok=True)
                item.rmdir()
            removed.append(name)
        except Exception as exc:
            _log_exception("Failed to remove uBlock addon artifact", exc, path=str(item))

    if removed:
        _log("INFO", "Removed uBlock addon artifacts from profile", removed=removed, profile=str(profile_dir))

def _is_ublock_url(url: str) -> bool:
    value = (url or "").lower()
    return "ublock" in value or "u-block" in value
def _addon_urls(addon_url: str | None) -> list[str]:
    urls: list[str] = [TAMPERMONKEY_ADDON_URL]
    if _read_env_flag(os.getenv("WPLACE_ENABLE_JSHELTER", "")):
        urls.append(JSHELTER_ADDON_URL)
    extra = os.getenv("WPLACE_EXTRA_ADDON_URLS", "").strip()
    if extra:
        urls.extend([item.strip() for item in extra.split(",") if item.strip()])
    if addon_url and addon_url.strip():
        urls.append(addon_url.strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for item in urls:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        if _is_ublock_url(normalized):
            _log("INFO", "Skipping uBlock addon preload (default disabled)", addon_url=normalized)
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _ensure_firefox_prefs(profile_dir: Path) -> None:
    """
    Ensures only the minimum extension-related Firefox prefs required for addon loading.

    @since 2026-02-11
    """
    prefs_path = profile_dir / "user.js"
    prefs = {
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
        "xpinstall.enabled": True,
        "extensions.allowPrivateBrowsingByDefault": True,
        "extensions.unifiedExtensions.enabled": False,
        "browser.privatebrowsing.autostart": False,
        "browser.startup.page": 1,
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
    return _normalize_github_raw_url(value)


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


def _wplace_storage_entries() -> dict[str, str]:
    if not _read_env_flag(os.getenv("WPLACE_ENABLED", "")):
        return {}
    raw_map = os.getenv("WPLACE_LOCALSTORAGE_JSON", "").strip()
    if raw_map:
        try:
            parsed_map = json.loads(raw_map)
            if isinstance(parsed_map, dict):
                entries: dict[str, str] = {}
                for key, value in parsed_map.items():
                    if not isinstance(key, str) or not key.strip():
                        continue
                    if isinstance(value, str):
                        entries[key.strip()] = value
                    else:
                        entries[key.strip()] = json.dumps(value, ensure_ascii=False)
                return entries
        except json.JSONDecodeError:
            pass
    payload = _wplace_storage_payload()
    if not payload:
        return {}
    return {"wbot": payload}


def _inject_wplace_storage(ctx: Camoufox, page) -> None:
    entries = _wplace_storage_entries()
    if not entries:
        return
    language = os.getenv("WPLACE_APP_LANGUAGE", "").strip().lower()
    serial_activated = _read_env_flag(os.getenv("WPLACE_SERIAL_ACTIVATED", ""))
    try:
        page.goto("https://wplace.live", wait_until="domcontentloaded")
        page.evaluate(
            """([pairs, lang, serialActivated]) => {
                if (Array.isArray(pairs)) {
                    for (const [key, value] of pairs) {
                        if (!key || typeof value !== "string") continue;
                        localStorage.setItem(key, value);
                    }
                }
                if (lang === "es" || lang === "en") {
                    localStorage.setItem("multig.language", lang);
                }
                if (serialActivated) {
                    localStorage.setItem("multig.serialActivated", "1");
                }
            }""",
            [list(entries.items()), language, serial_activated],
        )
    except Exception:
        pass


def _auto_paint_if_enabled(page, target_url: str) -> None:
    if not _read_env_flag(os.getenv("WPLACE_AUTO_PAINT", "")):
        return
    if "wplace.live" not in (target_url or ""):
        return
    try:
        page.wait_for_load_state("domcontentloaded", timeout=12000)
        page.wait_for_load_state("networkidle", timeout=12000)
        page.wait_for_timeout(800)
        page.keyboard.down("Shift")
        page.keyboard.press("KeyR")
        page.keyboard.up("Shift")
        _log("INFO", "Auto paint hotkey sent (Shift+R)")
    except Exception as exc:
        _log_exception("Failed to send auto paint hotkey", exc)


def _pawtect_context_profile() -> dict:
    raw = os.getenv("WPLACE_PAWTECT_CONTEXT_PROFILE_JSON", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        _log("WARN", "Invalid WPLACE_PAWTECT_CONTEXT_PROFILE_JSON")
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def _build_pawtect_init_script(profile: dict) -> str:
    nav = {
        "language": profile.get("navigator.language"),
        "languages": profile.get("navigator.languages"),
        "platform": profile.get("navigator.platform"),
        "hardwareConcurrency": profile.get("navigator.hardwareConcurrency"),
        "maxTouchPoints": profile.get("navigator.maxTouchPoints"),
        "doNotTrack": profile.get("navigator.doNotTrack"),
    }
    webgl_vendor = profile.get("webGl:vendor")
    webgl_renderer = profile.get("webGl:renderer")
    serialized_profile = json.dumps(profile, ensure_ascii=False)

    return f"""
(() => {{
  try {{
    const nav = {json.dumps(nav, ensure_ascii=False)};
    const setNav = (k, v) => {{
      if (v === undefined || v === null) return;
      try {{ Object.defineProperty(navigator, k, {{ get: () => v, configurable: true }}); }} catch (_) {{}}
    }};
    Object.keys(nav).forEach((k) => setNav(k, nav[k]));

    const spoofVendor = {json.dumps(webgl_vendor, ensure_ascii=False)};
    const spoofRenderer = {json.dumps(webgl_renderer, ensure_ascii=False)};
    if (spoofVendor || spoofRenderer) {{
      const patch = (proto) => {{
        if (!proto || !proto.getParameter) return;
        const orig = proto.getParameter;
        proto.getParameter = function(param) {{
          if (param === 0x9245 && spoofVendor) return spoofVendor;
          if (param === 0x9246 && spoofRenderer) return spoofRenderer;
          return orig.call(this, param);
        }};
      }};
      patch(typeof WebGLRenderingContext !== 'undefined' ? WebGLRenderingContext.prototype : null);
      patch(typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext.prototype : null);
    }}

    window.__WPLACE_PAWTECT_CONTEXT__ = {serialized_profile};
  }} catch (_) {{}}
}})();
"""


def _inject_pawtect_context(page) -> None:
    profile = _pawtect_context_profile()
    if not profile:
        return
    script = _build_pawtect_init_script(profile)
    try:
        page.add_init_script(script)
    except Exception:
        pass
    try:
        page.evaluate("value => localStorage.setItem('pawtect_context', value)", json.dumps(profile, ensure_ascii=False))
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


def _open_tampermonkey_editor(page, uuid: str) -> bool:
    editor_ready_script = """(selector) => {
        const container = document.querySelector(selector);
        if (!container) return false;
        return Boolean(
            container.querySelector('.ace_editor') ||
            container.querySelector('.ace_text-input') ||
            container.querySelector('.CodeMirror') ||
            container.querySelector('.CodeMirror textarea') ||
            container.querySelector('textarea')
        );
    }"""

    for route in TAMPERMONKEY_EDITOR_ANCHORS:
        for _ in range(3):
            try:
                page.goto(f"moz-extension://{uuid}/{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(700)
                if bool(page.evaluate(editor_ready_script, TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR)):
                    _log("INFO", "Tampermonkey editor opened", route=route)
                    return True
            except Exception as exc:
                _log_exception("Tampermonkey editor route failed", exc, route=route)
                continue
            page.wait_for_timeout(400)
    _log("ERROR", "Tampermonkey editor not available", uuid=uuid)
    return False


def _dismiss_tampermonkey_banners(page) -> None:
    script = """() => {
        const docs = [document, ...Array.from(document.querySelectorAll('iframe')).map((x) => x.contentDocument)].filter(Boolean);

        const clickIfPresent = (doc, selectors) => {
            for (const sel of selectors) {
                const el = doc.querySelector(sel);
                if (!el) continue;
                try {
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
                    if (typeof el.click === 'function') el.click();
                    return true;
                } catch (_) {
                    continue;
                }
            }
            return false;
        };

        for (const doc of docs) {
            clickIfPresent(doc, [
                '#button_Z2xvYmFsaGludF9iX2Rpc2FibGVfc3RhdHM',
                '#span_Z2hfY2xvc2Vfc3RhdHM',
                '#button_Z2xvYmFsaGludF9iX2VuYWJsZV9zdGF0cw',
            ]);

            clickIfPresent(doc, [
                '.header + button.close[title*="Close" i]',
                '.tampermonkeyBot button.close',
                'button.close[title*="Close" i]',
                '.clickable.disable',
            ]);
        }
    }"""

    for _ in range(3):
        try:
            page.evaluate(script)
            page.wait_for_timeout(150)
        except Exception:
            return

def _editor_content_matches(page, expected: str) -> bool:
    check_script = """([selector, expected]) => {
        const collectDocs = (rootDoc) => {
            const docs = [];
            const queue = [rootDoc];
            while (queue.length) {
                const doc = queue.shift();
                if (!doc || docs.includes(doc)) continue;
                docs.push(doc);
                for (const iframe of Array.from(doc.querySelectorAll('iframe'))) {
                    try {
                        if (iframe.contentDocument) queue.push(iframe.contentDocument);
                    } catch (_) {
                        continue;
                    }
                }
            }
            return docs;
        };

        const docs = collectDocs(document);
        for (const doc of docs) {
            const container = doc.querySelector(selector) || doc;

            const aceEditor = container.querySelector('.ace_editor') || doc.querySelector('.ace_editor');
            const ace = aceEditor?.env?.editor || null;
            if (ace && typeof ace.getValue === 'function') {
                const value = String(ace.getValue()).replace(/\r\n/g, '\n');
                if (value === expected) {
                    return true;
                }
            }

            const cmEl = container.querySelector('.CodeMirror') || doc.querySelector('.CodeMirror');
            const cm = cmEl?.CodeMirror || null;
            if (cm && typeof cm.getValue === 'function') {
                const value = String(cm.getValue()).replace(/\r\n/g, '\n');
                if (value === expected) {
                    return true;
                }
            }
            const ta =
                container.querySelector('.CodeMirror textarea') ||
                container.querySelector('textarea') ||
                doc.querySelector('.CodeMirror textarea') ||
                doc.querySelector('textarea');
            if (ta && String(ta.value || '').replace(/\r\n/g, '\n') === expected) {
                return true;
            }
        }
        return false;
    }"""
    try:
        return bool(page.evaluate(check_script, [TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR, expected]))
    except Exception:
        return False


def _focus_editor_with_tab_navigation(page, max_tabs: int = 12) -> bool:
    """Fallback for Tampermonkey screens where tabbing reaches CodeMirror reliably."""
    check_focus_script = """() => {
        const active = document.activeElement;
        if (!active) return false;

        const isAceInput =
            active.tagName === 'TEXTAREA' &&
            (active.className.includes('ace_text-input') || Boolean(active.closest && active.closest('.ace_editor')));

        const isCodeMirrorTextarea =
            active.tagName === 'TEXTAREA' &&
            (active.closest('.CodeMirror') || active.className.includes('CodeMirror'));

        const isInsideAce = Boolean(active.closest && active.closest('.ace_editor'));
        const isInsideCodeMirror = Boolean(active.closest && active.closest('.CodeMirror'));
        return Boolean(isAceInput || isInsideAce || isCodeMirrorTextarea || isInsideCodeMirror);
    }"""

    for _ in range(max_tabs):
        try:
            page.keyboard.press('Tab')
            page.wait_for_timeout(120)
            if bool(page.evaluate(check_focus_script)):
                _log("INFO", "Editor focused via tab navigation")
                return True
        except Exception as exc:
            _log_exception("Tab navigation failed while trying to focus editor", exc)
            return False

    _log("WARN", "Editor focus via tab navigation failed", max_tabs=max_tabs)
    return False


def _wait_tampermonkey_editor_ready(page) -> bool:
    ready_script = """(selector) => {
        const collectDocs = (rootDoc) => {
            const docs = [];
            const queue = [rootDoc];
            while (queue.length) {
                const doc = queue.shift();
                if (!doc || docs.includes(doc)) continue;
                docs.push(doc);
                for (const iframe of Array.from(doc.querySelectorAll('iframe'))) {
                    try {
                        if (iframe.contentDocument) queue.push(iframe.contentDocument);
                    } catch (_) {
                        continue;
                    }
                }
            }
            return docs;
        };

        const docs = collectDocs(document);
        for (const doc of docs) {
            const container = doc.querySelector(selector) || doc;
            const aceEl = container.querySelector('.ace_editor') || doc.querySelector('.ace_editor');
            if (aceEl && (aceEl.env?.editor || aceEl.querySelector('textarea'))) {
                return true;
            }
            const cmEl = container.querySelector('.CodeMirror') || doc.querySelector('.CodeMirror');
            if (cmEl && (cmEl.CodeMirror || cmEl.querySelector('textarea'))) {
                return true;
            }
            if (container.querySelector('textarea') || doc.querySelector('textarea')) {
                return true;
            }
        }
        return false;
    }"""

    for _ in range(20):
        try:
            if bool(page.evaluate(ready_script, TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR)):
                return True
        except Exception:
            pass
        page.wait_for_timeout(250)
    return False


def _set_tampermonkey_editor_code(page, code: str) -> bool:
    normalized = code.replace("\r\n", "\n")

    script = """([selector, code]) => {
        const collectDocs = (rootDoc) => {
            const docs = [];
            const queue = [rootDoc];
            while (queue.length) {
                const doc = queue.shift();
                if (!doc || docs.includes(doc)) continue;
                docs.push(doc);
                for (const iframe of Array.from(doc.querySelectorAll('iframe'))) {
                    try {
                        if (iframe.contentDocument) queue.push(iframe.contentDocument);
                    } catch (_) {
                        continue;
                    }
                }
            }
            return docs;
        };

        const setCodeMirrorValue = (cm, value) => {
            if (!cm || typeof cm.getValue !== 'function') return false;
            const docRef = typeof cm.getDoc === 'function' ? cm.getDoc() : null;
            if (docRef && typeof docRef.setValue === 'function') {
                docRef.setValue(value);
            } else if (typeof cm.setValue === 'function') {
                cm.setValue(value);
            } else {
                return false;
            }
            cm.focus?.();
            cm.refresh?.();
            cm.save?.();
            return true;
        };

        const setAceValue = (ace, value) => {
            if (!ace || typeof ace.getValue !== 'function') return false;
            if (typeof ace.setValue === 'function') {
                ace.setValue(value, -1);
            } else if (ace.session && typeof ace.session.setValue === 'function') {
                ace.session.setValue(value);
            } else {
                return false;
            }
            ace.focus?.();
            ace.renderer?.updateFull?.();
            return true;
        };

        const docs = collectDocs(document);

        for (const doc of docs) {
            const container = doc.querySelector(selector) || doc;

            const aceElements = [
                ...Array.from(container.querySelectorAll('.ace_editor')),
                ...Array.from(doc.querySelectorAll('.ace_editor')),
            ];
            for (const aceEl of aceElements) {
                if (setAceValue(aceEl?.env?.editor, code)) {
                    return true;
                }
            }

            const cmElements = [
                ...Array.from(container.querySelectorAll('.CodeMirror, .CodeMirror-wrap, .CodeMirror-focused')),
                ...Array.from(doc.querySelectorAll('.CodeMirror')),
            ];

            for (const cmEl of cmElements) {
                if (cmEl?.CodeMirror && setCodeMirrorValue(cmEl.CodeMirror, code)) {
                    return true;
                }
            }

            const win = doc.defaultView;
            const aceCandidates = [win?.editor, win?.Editor, win?.tmEditor, win?.aceEditor];
            for (const candidate of aceCandidates) {
                if (setAceValue(candidate, code)) {
                    return true;
                }
            }

            const editorCandidates = [win?.editor, win?.Editor, win?.tmEditor, win?.codemirror, win?.CodeMirrorEditor];
            for (const candidate of editorCandidates) {
                if (candidate && typeof candidate.getValue === 'function' && setCodeMirrorValue(candidate, code)) {
                    return true;
                }
            }

            const ta =
                container.querySelector('.ace_text-input') ||
                container.querySelector('.CodeMirror textarea') ||
                container.querySelector('textarea') ||
                doc.querySelector('.ace_text-input') ||
                doc.querySelector('.CodeMirror textarea') ||
                doc.querySelector('textarea');

            if (ta) {
                ta.focus();
                ta.value = code;
                try {
                    ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }));
                } catch (_) {
                    ta.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
                }
                try {
                    ta.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: code, inputType: 'insertFromPaste' }));
                    ta.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: code, inputType: 'insertFromPaste' }));
                } catch (_) {
                    ta.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                }
                ta.dispatchEvent(new Event('change', { bubbles: true }));

                const ace = ta.closest('.ace_editor')?.env?.editor;
                if (ace && typeof ace.setValue === 'function') {
                    ace.setValue(code, -1);
                    ace.focus?.();
                }

                const cm = ta.closest('.CodeMirror')?.CodeMirror;
                if (cm && typeof cm.getDoc === 'function') {
                    const cmDoc = cm.getDoc();
                    if (cmDoc && typeof cmDoc.setValue === 'function') {
                        cmDoc.setValue(code);
                    }
                    cm.save?.();
                    cm.focus?.();
                }
                return true;
            }
        }

        return false;
    }"""

    if _wait_tampermonkey_editor_ready(page):
        try:
            pasted = bool(page.evaluate(script, [TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR, normalized]))
            if pasted:
                page.wait_for_timeout(250)
                if _editor_content_matches(page, normalized):
                    _log("INFO", "Userscript injected through direct editor API")
                    return True
        except Exception as exc:
            _log_exception("Direct editor injection failed", exc)
            pasted = False
    else:
        _log("WARN", "Tampermonkey editor never became ready")
        pasted = False

    try:
        page.locator('.ace_editor, .ace_text-input, .CodeMirror, .CodeMirror-scroll, .CodeMirror textarea, textarea').first.click(timeout=2500)
        for shortcut in ('Control+A', 'Meta+A'):
            try:
                page.keyboard.press(shortcut)
            except Exception:
                continue
        page.keyboard.insert_text(normalized)
        page.wait_for_timeout(350)
        if _editor_content_matches(page, normalized):
            _log("INFO", "Userscript injected via keyboard insert_text")
            return True
    except Exception as exc:
        _log_exception("Keyboard injection strategy failed", exc)
        pass

    try:
        if _focus_editor_with_tab_navigation(page, max_tabs=16):
            for shortcut in ('Control+A', 'Meta+A'):
                try:
                    page.keyboard.press(shortcut)
                except Exception:
                    continue
            page.keyboard.insert_text(normalized)
            page.wait_for_timeout(350)
            if _editor_content_matches(page, normalized):
                _log("INFO", "Userscript injected after tab focus fallback")
                return True
    except Exception as exc:
        _log_exception("Tab-focus fallback injection failed", exc)
        pass

    _log("ERROR", "Unable to inject userscript into Tampermonkey editor")
    return pasted


def _save_tampermonkey_editor(page) -> None:
    save_script = """() => {
        const collectDocs = (rootDoc) => {
            const docs = [];
            const queue = [rootDoc];
            while (queue.length) {
                const doc = queue.shift();
                if (!doc || docs.includes(doc)) continue;
                docs.push(doc);
                for (const iframe of Array.from(doc.querySelectorAll('iframe'))) {
                    try {
                        if (iframe.contentDocument) queue.push(iframe.contentDocument);
                    } catch (_) {
                        continue;
                    }
                }
            }
            return docs;
        };

        const docs = collectDocs(document);
        for (const doc of docs) {
            const selectors = [
                'button[id*=save i]',
                'input[type="button"][id*=save i]',
                'input[type="submit"][id*=save i]',
                'button[class*=save i]',
                'a[class*=save i]',
                '.save',
                '[data-command="save"]',
                '[title*="Save" i]',
                '[title*="Guardar" i]',
            ];

            for (const sel of selectors) {
                const el = doc.querySelector(sel);
                if (!el) continue;
                try {
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
                    if (typeof el.click === 'function') el.click();
                    return true;
                } catch (_) {
                    continue;
                }
            }

            const cmEl = doc.querySelector('.CodeMirror');
            const cm = cmEl?.CodeMirror;
            if (cm && typeof cm.save === 'function') {
                cm.save();
                return true;
            }

            try {
                const win = doc.defaultView;
                const editorCandidates = [win?.editor, win?.Editor, win?.tmEditor];
                for (const ed of editorCandidates) {
                    if (ed && typeof ed.save === 'function') {
                        ed.save();
                        return true;
                    }
                }
            } catch (_) {
                continue;
            }
        }
        return false;
    }"""

    for shortcut in ("Control+S", "Meta+S"):
        try:
            page.keyboard.press(shortcut)
            page.wait_for_timeout(250)
        except Exception:
            continue

    try:
        page.evaluate(save_script)
    except Exception:
        pass


def _install_userscript_via_dashboard(ctx: Camoufox, profile_dir: Path, script_path: Path) -> bool:
    uuid = _get_webext_uuid(profile_dir, TAMPERMONKEY_ADDON_ID)
    if not uuid:
        _log("ERROR", "Tampermonkey UUID not found in profile", profile=str(profile_dir))
        return False

    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    if not _open_tampermonkey_editor(page, uuid):
        return False

    _dismiss_tampermonkey_banners(page)

    code = script_path.read_text(encoding="utf-8", errors="ignore")

    pasted = False
    for _ in range(3):
        _dismiss_tampermonkey_banners(page)
        pasted = _set_tampermonkey_editor_code(page, code)
        if pasted:
            break
        page.wait_for_timeout(500)

    if not pasted:
        _log("ERROR", "Userscript not pasted after retries", retries=3)
        return False

    try:
        page.locator(".CodeMirror, .CodeMirror textarea, textarea").first.click(timeout=1500)
    except Exception:
        pass

    _dismiss_tampermonkey_banners(page)

    _save_tampermonkey_editor(page)

    try:
        page.get_by_role("button", name=re.compile(r"(Save|Guardar)", re.I)).click(timeout=2000)
    except Exception:
        pass

    page.wait_for_timeout(1200)
    _log("INFO", "Userscript saved in Tampermonkey")
    return True


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
        _log("INFO", "Userscript marker already present, skipping install", marker=str(marker))
        return
    _close_tampermonkey_welcome(ctx)
    page.wait_for_timeout(1500)

    # Deterministic path: download script content and paste it
    # directly in Tampermonkey editor.
    local_script = _download_userscript(profile_dir)
    success = bool(local_script and local_script.exists()) and _install_userscript_via_dashboard(
        ctx,
        profile_dir,
        local_script,
    )

    page.wait_for_timeout(1500)
    if success:
        marker.write_text("installed")
        _log("INFO", "Userscript installation completed", marker=str(marker))
    else:
        _log("ERROR", "Userscript installation failed", profile=str(profile_dir))




def _ensure_window_ready(page) -> None:
    """Bring the browser page to front and try to maximize reliably."""
    try:
        page.bring_to_front()
    except Exception:
        pass

    script = """
    (() => {
      try {
        if (document.visibilityState === 'hidden') {
          window.focus();
        }
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
        if (typeof window.outerWidth === 'number' && window.outerWidth < screen.availWidth * 0.8) {
          window.resizeTo(screen.availWidth, screen.availHeight);
        }
      } catch (e) {}
    })()
    """

    for _ in range(3):
        try:
            page.wait_for_timeout(250)
            page.evaluate(script)
        except Exception:
            continue


def _enforce_tampermonkey_instance_policies(page) -> None:
    """Best-effort runtime enforcement for Tampermonkey in each Firefox instance.

    Ensures the per-extension "Run in Private Windows" setting is "Allow" and
    attempts to pin Tampermonkey from about:addons when the action exists.
    """
    try:
        page.goto("about:addons", wait_until="domcontentloaded", timeout=30000)
    except Exception as exc:
        _log_exception("Failed to open about:addons", exc)
        return

    scripts = [
        """
        () => {
          const card = document.querySelector('addon-card[addon-id="firefox@tampermonkey.net"]');
          if (!card) return { found: false };
          const root = card.shadowRoot || card;
          const radios = root.querySelectorAll('input[type="radio"][name*="private"], input[type="radio"][name*="incognito"]');
          for (const radio of radios) {
            const value = String(radio.value || '').toLowerCase();
            if (value.includes('allow') || value === '1' || value === 'true') {
              if (!radio.checked) {
                radio.click();
                radio.dispatchEvent(new Event('change', { bubbles: true }));
              }
              return { found: true, privateAllowed: true };
            }
          }
          return { found: true, privateAllowed: false };
        }
        """,
        """
        () => {
          const card = document.querySelector('addon-card[addon-id="firefox@tampermonkey.net"]');
          if (!card) return { found: false };
          const root = card.shadowRoot || card;
          const menuBtn = root.querySelector('panel-item[action="pin-to-toolbar"], button[action="pin-to-toolbar"]');
          if (!menuBtn) return { found: true, pinned: null };
          menuBtn.click();
          return { found: true, pinned: true };
        }
        """,
    ]

    try:
        private_state = page.evaluate(scripts[0])
        pin_state = page.evaluate(scripts[1])
        _log("INFO", "Tampermonkey instance policy enforced", private_state=private_state, pin_state=pin_state)
    except Exception as exc:
        _log_exception("Tampermonkey instance policy enforcement failed", exc)




def _force_wplace_navigation(page, target_url: str) -> None:
    expected_host = "wplace.live"
    current = (page.url or "").strip().lower()
    if current.startswith("https://wplace.live") or current.startswith("http://wplace.live"):
        return
    try:
        page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
    except Exception as exc:
        _log_exception("Forced wplace navigation failed", exc, current_url=current, target_url=target_url)

def _effective_target_url(requested_url: str) -> str:
    value = (requested_url or "").strip()
    if not value:
        return "https://wplace.live"
    if "wplace.live" in value.lower():
        return value
    _log("INFO", "Overriding non-wplace URL with wplace.live", requested_url=value)
    return "https://wplace.live"
def _force_non_private_mode(config: dict) -> dict:
    merged = dict(config or {})
    prefs = merged.get("firefox_user_prefs")
    if not isinstance(prefs, dict):
        prefs = {}
    prefs["browser.privatebrowsing.autostart"] = False
    prefs["browser.startup.page"] = 1
    merged["firefox_user_prefs"] = prefs
    return merged


def _run_context(
    profile_dir: Path,
    proxy,
    config: dict,
    target_url: str,
    headless,
    prepare_only: bool,
    install_userscript: bool,
) -> None:
    runtime_config = _force_non_private_mode(config)
    _log("INFO", "Launching Camoufox context", prepare_only=prepare_only, private_autostart=runtime_config.get("firefox_user_prefs", {}).get("browser.privatebrowsing.autostart"))
    with Camoufox(
        persistent_context=True,
        user_data_dir=str(profile_dir),
        headless=headless,
        proxy=proxy,
        no_viewport=True,
        exclude_addons=[DefaultAddons.UBO],
        **runtime_config,
    ) as ctx:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        if prepare_only:
            _ensure_window_ready(page)
            _enforce_tampermonkey_instance_policies(page)
            if install_userscript:
                _install_wplace_script(ctx, profile_dir, page)
                try:
                    dashboard_url = _tampermonkey_dashboard_url(profile_dir)
                    page.goto(dashboard_url, wait_until="domcontentloaded")
                    _log("INFO", "Opened Tampermonkey dashboard for manual review", url=dashboard_url)
                except Exception as exc:
                    _log_exception("Failed to open Tampermonkey dashboard", exc)
            _close_tampermonkey_welcome(ctx)
            _close_secondary_pages(ctx, page)
            _inject_wplace_storage(ctx, page)
            try:
                page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
            except Exception as exc:
                _log_exception("Prepare-only navigation failed; retrying with commit state", exc)
                page.goto(target_url, wait_until="commit", timeout=45000)
            _force_wplace_navigation(page, target_url)
            _log("INFO", "Prepare-only cycle finished", profile=str(profile_dir))
            return
        _close_tampermonkey_welcome(ctx)
        _close_secondary_pages(ctx, page)
        _ensure_window_ready(page)
        if install_userscript:
            _install_wplace_script(ctx, profile_dir, page)
        _inject_wplace_storage(ctx, page)
        _inject_pawtect_context(page)
        try:
            page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
        except Exception as exc:
            _log_exception("Initial navigation failed; retrying with commit state", exc)
            page.goto(target_url, wait_until="commit", timeout=45000)
        _auto_paint_if_enabled(page, target_url)
        _ensure_window_ready(page)
        _force_wplace_navigation(page, target_url)
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

    try:
        config = json.loads(a.config_json) if a.config_json else {}
    except Exception as exc:
        _log_exception("Failed to parse config JSON", exc)
        raise
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
    addon_urls = _addon_urls(addon_url)
    target_url = _effective_target_url(a.url)
    _log("INFO", "Starting Camoufox runner", profile=str(profile_dir), prepare_only=bool(a.prepare_only), url=target_url)
    _ensure_firefox_prefs(profile_dir)
    _purge_ublock_addons(profile_dir)
    addon_installed_now = False
    installed_addon_ids: list[str] = []
    for addon_item in addon_urls:
        try:
            installed, addon_id = _ensure_addon(profile_dir, addon_item)
            addon_installed_now = addon_installed_now or installed
            if addon_id:
                installed_addon_ids.append(addon_id)
        except Exception as exc:
            _log_exception("Addon installation failed", exc, addon_url=addon_item, profile=str(profile_dir))
            fallback_id = _fallback_addon_id(addon_item)
            if fallback_id:
                installed_addon_ids.append(fallback_id)

    # Hard requirement: every launched instance must keep Tampermonkey
    # pinned and keep addons enabled for private windows by default.
    # Use Firefox addon IDs here (not Chromium extension IDs) so toolbar
    # pinning and private-browsing policy writes map to real addon entries.
    if TAMPERMONKEY_ADDON_ID not in installed_addon_ids:
        installed_addon_ids.append(TAMPERMONKEY_ADDON_ID)
    installed_addon_ids = list(dict.fromkeys([item for item in installed_addon_ids if item]))

    _pin_addons_in_nav(profile_dir, installed_addon_ids)
    _set_addons_private_mode(profile_dir, installed_addon_ids, allowed=True)

    if a.prepare_only and addon_installed_now:
        # Firefox/Camoufox can require one startup cycle after copying the XPI
        # before Tampermonkey starts intercepting .user.js installs.
        _run_context(
            profile_dir,
            proxy,
            config,
            target_url,
            headless,
            prepare_only=True,
            install_userscript=True,
        )

    _run_context(
        profile_dir,
        proxy,
        config,
        target_url,
        headless,
        prepare_only=bool(a.prepare_only),
        install_userscript=True,
    )
    _log("INFO", "Camoufox runner finished", profile=str(profile_dir))


if __name__ == "__main__":
    main()

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


TAMPERMONKEY_EDITOR_ANCHORS = (
    "options.html#nav=new-user-script+editor",
    "options.html#nav=new-user-script%2Beditor",
)
TAMPERMONKEY_EDITOR_CONTAINER_SELECTOR = "#td_bmV3LXVzZXItc2NyaXB0X2VkaXQ"


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
    """
    Ensures only the minimum extension-related Firefox prefs required for addon loading.

    @since 2026-02-11
    """
    prefs_path = profile_dir / "user.js"
    prefs = {
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
        "xpinstall.enabled": True,
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


def _inject_wplace_storage(ctx: Camoufox, page) -> None:
    payload = _wplace_storage_payload()
    if not payload:
        return
    try:
        page.goto("https://wplace.live", wait_until="domcontentloaded")
        page.evaluate("value => localStorage.setItem('wbot', value)", payload)
    except Exception:
        pass


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
    addon_id = "firefox@tampermonkey.net"
    uuid = _get_webext_uuid(profile_dir, addon_id)
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
            return
        _close_tampermonkey_welcome(ctx)
        _close_secondary_pages(ctx, page)
        _inject_wplace_storage(ctx, page)
        _inject_pawtect_context(page)
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
    _log("INFO", "Starting Camoufox runner", profile=str(profile_dir), prepare_only=bool(a.prepare_only), url=a.url)
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
        install_userscript=False,
    )
    _log("INFO", "Camoufox runner finished", profile=str(profile_dir))


if __name__ == "__main__":
    main()

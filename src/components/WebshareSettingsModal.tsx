"use client";

import React from "react";
import type { Translations } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";

/**
 * Webshare public status returned by API.
 *
 * @since 2026-01-23
 */
export type WebsharePublicStatus = {
  configured: boolean;
  hasToken: boolean;
  maskedToken: string;
  hasCreds: boolean;
  username: string;
  password: string;
  token: string;
};

/**
 * Modal props.
 *
 * @since 2026-01-23
 */
export type WebshareSettingsModalProps = {
  isOpen: boolean;
  status: WebsharePublicStatus | null;
  onClose: () => void;
  onSaved: (status: WebsharePublicStatus) => void;
  onSynced?: () => void;
  t: Translations;
};

/**
 * Webshare settings modal.
 *
 * Security:
 * - Inputs are sent ONLY to server API.
 * - Server stores encrypted at rest (database).
 * - UI can display saved values on demand.
 *
 * @since 2026-01-23
 */
export function WebshareSettingsModal(props: WebshareSettingsModalProps) {
  const t = props.t;
  const [token, setToken] = React.useState("");
  const [username, setUsername] = React.useState(props.status?.username || "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [pool, setPool] = React.useState<{ total: number; available: number } | null>(null);
  const [showToken, setShowToken] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    setUsername(props.status?.username || "");
    setToken(props.status?.token || "");
    setPassword(props.status?.password || "");
    setMsg("");
    setShowToken(false);
    setShowPassword(false);
    if (props.isOpen) {
      void loadPool();
    }
  }, [props.isOpen, props.status?.username, props.status?.token, props.status?.password]);

  if (!props.isOpen) return null;

  async function loadPool() {
    try {
      const r = await fetch("/api/proxies/status", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { total: number; available: number };
      setPool(j);
    } catch {
      setPool(null);
    }
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/settings/webshare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim() || undefined,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as WebsharePublicStatus;
      props.onSaved(j);
      setToken("");
      setPassword("");
      await loadPool();
      props.onSynced?.();
      setMsg(t.messages.webshareSaved);
    } catch (e: any) {
      setMsg(t.messages.webshareSaveError);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm(t.confirm.clearWebshare)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/settings/webshare", { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as WebsharePublicStatus;
      props.onSaved(j);
      setToken("");
      setPassword("");
      await loadPool();
      props.onSynced?.();
      setMsg(t.messages.webshareCleared);
    } catch (e: any) {
      setMsg(t.messages.webshareDeleteError);
    } finally {
      setBusy(false);
    }
  }

  async function syncProxies() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/proxies/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error(await r.text());
      await loadPool();
      props.onSynced?.();
      setMsg(t.messages.webshareSyncOk);
    } catch (e: any) {
      setMsg(t.messages.webshareSyncError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalBg" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <p className="modalTitle">
            <span className="row">
              <EmojiIcon symbol="🛡️" label="webshare" size={16} /> {t.actions.webshare}
            </span>
          </p>
          <button className="btn secondary" onClick={props.onClose} title={t.actions.cancel}>
            <EmojiIcon symbol="✖️" label="close" size={16} />
          </button>
        </div>

        <div className="hr" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="badge">
            {props.status?.configured ? `🟢 ${t.status.webshareConfigured}` : `🟠 ${t.status.webshareNotConfigured}`}
          </span>
          <span className="badge">
            {t.ui.tokenLabel}: {props.status?.hasToken ? props.status.maskedToken : "—"}
          </span>
        </div>

        <p className="small" style={{ marginTop: 10 }}>
          {t.ui.webshareSecurityNote}
        </p>

        <label className="label">
          <span className="row"><EmojiIcon symbol="🔑" label="token" size={14} /> {t.fields.webshareToken}</span>
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t.fields.webshareTokenPlaceholder}
          />
          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowToken((prev) => !prev)}
            aria-label={showToken ? t.actions.hide : t.actions.show}
          >
            {showToken ? t.actions.hide : t.actions.show}
          </button>
        </div>

        <label className="label">
          <span className="row"><EmojiIcon symbol="👤" label="username" size={14} /> {t.fields.webshareUsername}</span>
        </label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.fields.webshareUsernamePlaceholder} />

        <label className="label">
          <span className="row"><EmojiIcon symbol="🔒" label="password" size={14} /> {t.fields.websharePassword}</span>
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.fields.websharePasswordPlaceholder}
          />
          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? t.actions.hide : t.actions.show}
          >
            {showPassword ? t.actions.hide : t.actions.show}
          </button>
        </div>

        <div className="hr" />

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="modalTitle" style={{ margin: 0 }}>{t.status.proxyPool}</p>
            <p className="small" style={{ margin: "6px 0 0 0" }}>
              {t.ui.proxiesAvailableFormat
                .replace("{available}", String(pool?.available ?? "—"))
                .replace("{total}", String(pool?.total ?? "—"))}
              {" • "}
              {t.ui.sourceWebshare}
            </p>
          </div>
          <button className="btn secondary" onClick={syncProxies} disabled={busy || !props.status?.hasToken}>
            {t.actions.sync}
          </button>
        </div>
        {!props.status?.hasToken && (
          <p className="small" style={{ marginTop: 8 }}>
            {t.messages.webshareSyncNeedsToken}
          </p>
        )}

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <button className="btn danger" onClick={clear} disabled={busy}>
            <span className="row"><EmojiIcon symbol="🗑️" label="delete" size={16} /> {t.actions.delete}</span>
          </button>

          <div className="row">
            <button className="btn secondary" onClick={props.onClose} disabled={busy}>{t.actions.cancel}</button>
            <button className="btn" onClick={save} disabled={busy}>{t.actions.save}</button>
          </div>
        </div>

        {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}

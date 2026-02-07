"use client";

import React from "react";
import { X, Shield, KeyRound, User, Lock, Trash2 } from "lucide-react";

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
};

/**
 * Webshare settings modal.
 *
 * Security:
 * - Inputs are sent ONLY to server API.
 * - Server stores encrypted at rest.
 * - UI never receives secrets back.
 *
 * @since 2026-01-23
 */
export function WebshareSettingsModal(props: WebshareSettingsModalProps) {
  const [token, setToken] = React.useState("");
  const [username, setUsername] = React.useState(props.status?.username || "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    setUsername(props.status?.username || "");
    setToken("");
    setPassword("");
    setMsg("");
  }, [props.isOpen, props.status?.username]);

  if (!props.isOpen) return null;

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
      setMsg("✅ Guardado");
    } catch (e: any) {
      setMsg("❌ Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm("¿Borrar la configuración de Webshare?")) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/settings/webshare", { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as WebsharePublicStatus;
      props.onSaved(j);
      setToken("");
      setPassword("");
      setMsg("🗑️ Borrado");
    } catch (e: any) {
      setMsg("❌ Error al borrar");
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
              <Shield size={16} /> Webshare
            </span>
          </p>
          <button className="btn secondary" onClick={props.onClose} title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="hr" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="badge">
            {props.status?.configured ? "🟢 Configurado" : "🟠 No configurado"}
          </span>
          <span className="badge">
            Token: {props.status?.hasToken ? props.status.maskedToken : "—"}
          </span>
        </div>

        <p className="small" style={{ marginTop: 10 }}>
          Tu token/credenciales se guardan <b>solo en el servidor</b> y encriptados en disco. La UI no vuelve a recibirlos.
        </p>

        <label className="label">
          <span className="row"><KeyRound size={14} /> Token (opcional)</span>
        </label>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de Webshare" />

        <label className="label">
          <span className="row"><User size={14} /> Usuario (opcional)</span>
        </label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario proxy" />

        <label className="label">
          <span className="row"><Lock size={14} /> Password (opcional)</span>
        </label>
        <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password proxy" />

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <button className="btn danger" onClick={clear} disabled={busy}>
            <span className="row"><Trash2 size={16} /> Borrar</span>
          </button>

          <div className="row">
            <button className="btn secondary" onClick={props.onClose} disabled={busy}>Cerrar</button>
            <button className="btn" onClick={save} disabled={busy}>Guardar</button>
          </div>
        </div>

        {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}

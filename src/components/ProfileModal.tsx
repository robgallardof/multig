"use client";

import React from "react";
import { X } from "lucide-react";
import { profileIcons } from "./icons";

/**
 * Modal mode.
 *
 * @since 2026-01-23
 */
export type ProfileModalMode = "create" | "edit";

/**
 * Modal initial values.
 *
 * @since 2026-01-23
 */
export type ProfileModalValues = {
  proxyId?: string;
  name: string;
  icon: string;
  url?: string;
  proxyServer?: string;
  proxyUsername?: string;
  proxyPassword?: string;
};

/**
 * Profile modal props.
 *
 * @since 2026-01-23
 */
export type ProfileModalProps = {
  mode: ProfileModalMode;
  isOpen: boolean;
  title: string;
  initial: ProfileModalValues;
  onClose: () => void;
  onSubmit: (values: ProfileModalValues) => void;
};

/**
 * Profile create/edit modal.
 *
 * SRP: gather form inputs only.
 *
 * @since 2026-01-23
 */
export function ProfileModal(props: ProfileModalProps) {
  const [name, setName] = React.useState(props.initial.name);
  const [icon, setIcon] = React.useState(props.initial.icon);
  const [url, setUrl] = React.useState(props.initial.url || "");
  const [proxyServer, setProxyServer] = React.useState((props.initial as any).proxyServer || "");
  const [proxyUsername, setProxyUsername] = React.useState((props.initial as any).proxyUsername || "");
  const [proxyPassword, setProxyPassword] = React.useState("");
  const [availableProxies, setAvailableProxies] = React.useState<{id:string,label:string}[]>([]);
  const [selectedProxyId, setSelectedProxyId] = React.useState("");

  React.useEffect(() => {
    setName(props.initial.name);
    setIcon(props.initial.icon);
    setUrl(props.initial.url || "");
    setProxyServer((props.initial as any).proxyServer || "");
    setProxyUsername((props.initial as any).proxyUsername || "");
    setProxyPassword("");
    setAvailableProxies([]);
    setSelectedProxyId("");
  }, [props.initial.name, props.initial.icon, props.initial.url, props.isOpen]);

  if (!props.isOpen) return null;

  const canSave = name.trim().length > 0;

  return (
    <div className="modalBg" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <p className="modalTitle">{props.title}</p>
          <button className="btn secondary" onClick={props.onClose} title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="hr" />

        <label className="label">Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Trabajo" />

        <label className="label">Icono</label>
        <div className="iconGrid">
          {profileIcons.map((i) => (
            <button
              key={i}
              className={"iconBtn" + (i === icon ? " active" : "")}
              onClick={() => setIcon(i)}
              type="button"
            >
              {i}
            </button>
          ))}
        </div>

        <label className="label">URL (opcional)</label>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />


<label className="label">Proxy server (opcional)</label>
<input className="input" value={proxyServer} onChange={(e) => setProxyServer(e.target.value)} placeholder="http://ip:port" />

<label className="label">Proxy usuario (override opcional)</label>
<input className="input" value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} placeholder="usuario" />

<label className="label">Proxy password (override opcional)</label>
<input className="input" value={proxyPassword} onChange={(e) => setProxyPassword(e.target.value)} placeholder="(deja vacío para no cambiar)" />

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn secondary" onClick={props.onClose}>
            Cancelar
          </button>
          <button
            className="btn"
            onClick={() => props.onSubmit({ name: name.trim(), icon, url: url.trim() || undefined, proxyServer: proxyServer.trim() || undefined, proxyUsername: proxyUsername.trim() || undefined, proxyPassword: proxyPassword || undefined,
            proxyId: selectedProxyId || undefined })}
            disabled={!canSave}
            style={{ opacity: canSave ? 1 : 0.6 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

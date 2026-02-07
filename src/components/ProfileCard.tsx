"use client";

import { Play, Pencil, Trash2, Clock } from "lucide-react";

/**
 * Profile card view model.
 *
 * @since 2026-01-23
 */
export type ProfileVm = {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  lastOpenedAt?: string;
  hasProxy?: boolean;
  proxyServer?: string;
};

/**
 * Profile card props.
 *
 * @since 2026-01-23
 */
export type ProfileCardProps = {
  onRelease: (id: string) => void;
  profile: ProfileVm;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Renders a single profile card.
 *
 * SRP: rendering only.
 *
 * @since 2026-01-23
 */
export function ProfileCard(props: ProfileCardProps) {
  const p = props.profile;

  const last = p.lastOpenedAt ? new Date(p.lastOpenedAt).toLocaleString() : null;

  return (
    <div className="card">
      <div className="cardTop">
        <div className="pTitle">
          <div className="pIcon">{p.icon}</div>
          <div>
            <p className="pName">{p.name}</p>
            <div className="pMeta">
              <span className="badge">
                <Clock size={14} />
                {last ? last : "Nunca abierto"}
              </span>
              <span className="badge" style={{marginLeft:8}}>
                {(p.hasProxy || (p.proxyServer && p.proxyServer.length>0)) ? "🛡️ Proxy configurado" : "🌐 Sin proxy"}
              </span>
            </div>
          </div>
        </div>

        <div className="row">
          <button className="btn secondary" onClick={() => props.onEdit(p.id)} title="Editar">
            <Pencil size={16} />
          </button>
          <button className="btn secondary" onClick={() => props.onRelease(p.id)} title="Liberar proxy">🔓</button>
          <button className="btn danger" onClick={() => props.onDelete(p.id)} title="Eliminar">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="spacer" />

      <button className="btn secondary" onClick={() => props.onOpen(p.id)} style={{ width: "100%" }}>
        <span className="row" style={{ justifyContent: "center" }}>
          <Play size={16} />
          Abrir
        </span>
      </button>
    </div>
  );
}

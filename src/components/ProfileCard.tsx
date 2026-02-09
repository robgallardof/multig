"use client";

import type { Translations } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";

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
  proxyLabel?: string;
};

/**
 * Profile card props.
 *
 * @since 2026-01-23
 */
export type ProfileCardProps = {
  onRotate: (id: string) => void;
  profile: ProfileVm;
  onOpen: (id: string) => void;
  isActive: boolean;
  disabled?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onImportCookies: (id: string) => void;
  onExportCookies: (id: string) => void;
  t: Translations;
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
  const t = props.t;

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
                <EmojiIcon symbol="🕒" label="clock" size={14} />
                {last ? last : t.status.neverOpened}
              </span>
              <span className="badge" style={{marginLeft:8}}>
                {p.hasProxy
                  ? `🛡️ ${p.proxyLabel || p.proxyServer || t.status.proxyAssigned}`
                  : `🌐 ${t.status.proxyPending}`}
              </span>
            </div>
          </div>
        </div>

        <div className="row cardActions">
          <button className="btn secondary" onClick={() => props.onEdit(p.id)} title={t.actions.edit}>
            <EmojiIcon symbol="✏️" label="edit" size={16} />
          </button>
          <button className="btn secondary" onClick={() => props.onRotate(p.id)} title={t.actions.rotateIp}>
            <EmojiIcon symbol="🔀" label="rotate" size={16} />
          </button>
          <button className="btn danger" onClick={() => props.onDelete(p.id)} title={t.actions.delete}>
            <EmojiIcon symbol="🗑️" label="delete" size={16} />
          </button>
        </div>
      </div>

      <div className="spacer" />

      <div className="row cardCookieActions">
        <button className="btn secondary" onClick={() => props.onImportCookies(p.id)} title={t.actions.importCookies}>
          <span className="row"><EmojiIcon symbol="📥" label="import cookies" size={16} />{t.actions.importCookies}</span>
        </button>
        <button className="btn secondary" onClick={() => props.onExportCookies(p.id)} title={t.actions.exportCookies}>
          <span className="row"><EmojiIcon symbol="📤" label="export cookies" size={16} />{t.actions.exportCookies}</span>
        </button>
      </div>

      <div className="toggleRow">
        <span className="toggleLabelText">
          <EmojiIcon symbol="▶️" label="open" size={16} />
          {t.actions.open}
        </span>
        <div className="row" style={{ justifyContent: "flex-end", flex: 1 }}>
          <button className="btn" onClick={() => props.onOpen(p.id)} disabled={props.disabled}>
            {t.actions.open}
          </button>
          <span className="toggleState">{props.isActive ? t.status.active : t.status.inactive}</span>
        </div>
      </div>
    </div>
  );
}

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
  url?: string;
  osType?: "windows" | "mac" | "linux";
  useProxy?: boolean;
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
  onStop: (id: string) => void;
  isActive: boolean;
  disabled?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onImportCookies: (id: string) => void;
  onExportCookies: (id: string) => void;
  view: "grid" | "list" | "details";
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
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
  const created = p.createdAt ? new Date(p.createdAt).toLocaleString() : "—";
  const osLabel = p.osType === "mac" ? t.fields.osMac : p.osType === "linux" ? t.fields.osLinux : t.fields.osWindows;
  const initials = p.name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "MG";
  const hue = Array.from(p.name || "MultiG")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div className={`card ${props.view !== "grid" ? "cardList" : ""} ${props.view === "details" ? "cardDetails" : ""} ${props.isActive ? "cardActive" : ""}`}>
      <div className="cardTop">
        <div className="pTitle">
          <div className="pAvatar" style={{ background: `hsl(${hue} 70% 35% / 0.9)` }} aria-hidden="true">
            <span>{initials}</span>
          </div>
          <div>
            <p className="pName">{p.name}</p>
            <div className="pMeta">
              <span className="badge">
                <EmojiIcon symbol="🕒" label="clock" size={14} />
                {last ? last : t.status.neverOpened}
              </span>
              <span className="badge" style={{marginLeft:8}}>
                {p.useProxy === false
                  ? `🚫 ${t.status.proxyDisabled}`
                  : p.hasProxy
                    ? `🛡️ ${p.proxyLabel || p.proxyServer || t.status.proxyAssigned}`
                    : `🌐 ${t.status.proxyPending}`}
              </span>
              {props.isActive && (
                <span className="badge activeBadge">
                  🟢 {t.status.active}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="row cardActions">
          {props.onSelect && (
            <label className="selectBox" title={t.actions.select}>
              <input
                type="checkbox"
                checked={Boolean(props.selected)}
                onChange={(e) => props.onSelect?.(p.id, e.target.checked)}
                aria-label={t.actions.select}
              />
              <span className="selectMark" />
            </label>
          )}
          <button className="btn secondary" onClick={() => props.onEdit(p.id)} title={t.actions.edit}>
            <EmojiIcon symbol="✏️" label="edit" size={16} />
          </button>
          <button
            className="btn secondary"
            onClick={() => props.onRotate(p.id)}
            title={t.actions.rotateIp}
            disabled={p.useProxy === false}
          >
            <EmojiIcon symbol="🔀" label="rotate" size={16} />
          </button>
          <button className="btn danger" onClick={() => props.onDelete(p.id)} title={t.actions.delete}>
            <EmojiIcon symbol="🗑️" label="delete" size={16} />
          </button>
        </div>
      </div>

      <div className="spacer" />

      {props.view === "details" && (
        <div className="cardDetailsGrid">
          <div className="detailItem">
            <span className="detailLabel">{t.ui.profileDetailCreated}</span>
            <span className="detailValue">{created}</span>
          </div>
          <div className="detailItem">
            <span className="detailLabel">{t.status.lastOpened}</span>
            <span className="detailValue">{last ? last : t.status.neverOpened}</span>
          </div>
          <div className="detailItem">
            <span className="detailLabel">{t.fields.url}</span>
            <span className="detailValue">{p.url ? p.url : "—"}</span>
          </div>
          <div className="detailItem">
            <span className="detailLabel">{t.fields.osType}</span>
            <span className="detailValue">{osLabel}</span>
          </div>
        </div>
      )}

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
          {props.isActive && (
            <button className="btn danger" onClick={() => props.onStop(p.id)} disabled={props.disabled}>
              {t.actions.stop}
            </button>
          )}
          <span className="toggleState">{props.isActive ? t.status.active : t.status.inactive}</span>
        </div>
      </div>
    </div>
  );
}

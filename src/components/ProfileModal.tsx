"use client";

import React from "react";
import { profileIcons } from "./icons";
import type { Translations } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";

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
  name: string;
  icon: string;
  url?: string;
  osType: "windows" | "mac" | "linux";
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
  t: Translations;
};

/**
 * Profile create/edit modal.
 *
 * SRP: gather form inputs only.
 *
 * @since 2026-01-23
 */
export function ProfileModal(props: ProfileModalProps) {
  const t = props.t;
  const [name, setName] = React.useState(props.initial.name);
  const [icon, setIcon] = React.useState(props.initial.icon);
  const [url, setUrl] = React.useState(props.initial.url || "");
  const [osType, setOsType] = React.useState(props.initial.osType);

  React.useEffect(() => {
    setName(props.initial.name);
    setIcon(props.initial.icon);
    setUrl(props.initial.url || "");
    setOsType(props.initial.osType);
  }, [props.initial.name, props.initial.icon, props.initial.url, props.initial.osType, props.isOpen]);

  if (!props.isOpen) return null;

  const canSave = name.trim().length > 0;

  return (
    <div className="modalBg" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <p className="modalTitle">{props.title}</p>
          <button className="btn secondary" onClick={props.onClose} title={t.actions.cancel}>
            <EmojiIcon symbol="✖️" label="close" size={16} />
          </button>
        </div>

        <div className="hr" />

        <label className="label">{t.fields.name}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fields.namePlaceholder} />

        <label className="label">{t.fields.icon}</label>
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

        <label className="label">{t.fields.url}</label>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />

        <label className="label">{t.fields.osType}</label>
        <select className="input" value={osType} onChange={(e) => setOsType(e.target.value as ProfileModalValues["osType"])}>
          <option value="windows">{t.fields.osWindows}</option>
          <option value="mac">{t.fields.osMac}</option>
          <option value="linux">{t.fields.osLinux}</option>
        </select>
        <div className="card" style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            {t.ui.autoProxyNote}
          </p>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn secondary" onClick={props.onClose}>
            {t.actions.cancel}
          </button>
          <button
            className="btn"
            onClick={() => props.onSubmit({ name: name.trim(), icon, url: url.trim() || undefined, osType })}
            disabled={!canSave}
            style={{ opacity: canSave ? 1 : 0.6 }}
          >
            {t.actions.save}
          </button>
        </div>
      </div>
    </div>
  );
}

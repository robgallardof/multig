"use client";

import React from "react";
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
  useProxy: boolean;
  wplace?: {
    enabled: boolean;
    tokens: string[];
    cookies?: unknown[];
    referenceProfileId?: string;
  };
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
  allowWplace: boolean;
  referenceProfiles: Array<{ id: string; name: string }>;
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
  const [useProxy, setUseProxy] = React.useState(props.initial.useProxy);
  const [wplaceEnabled, setWplaceEnabled] = React.useState(false);
  const [wplaceTokens, setWplaceTokens] = React.useState("");
  const [wplaceCookiesRaw, setWplaceCookiesRaw] = React.useState("");
  const [referenceProfileId, setReferenceProfileId] = React.useState("");

  React.useEffect(() => {
    setName(props.initial.name);
    setIcon(props.initial.icon);
    setUrl(props.initial.url || "");
    setOsType(props.initial.osType);
    setUseProxy(props.initial.useProxy);
    setWplaceEnabled(false);
    setWplaceTokens("");
    setWplaceCookiesRaw("");
    setReferenceProfileId("");
  }, [props.initial.name, props.initial.icon, props.initial.url, props.initial.osType, props.initial.useProxy, props.isOpen]);

  const tokenList = wplaceTokens
    .split(/[,\r\n]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  const parsedWplaceCookies = React.useMemo(() => {
    const source = wplaceCookiesRaw.trim();
    if (!source) return { cookies: [] as unknown[], error: "" };
    try {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) return { cookies: [] as unknown[], error: t.messages.cookiesInvalid };
      return { cookies: parsed, error: "" };
    } catch {
      return { cookies: [] as unknown[], error: t.messages.cookiesInvalid };
    }
  }, [wplaceCookiesRaw, t.messages.cookiesInvalid]);
  const canSave = props.mode === "create" && wplaceEnabled
    ? tokenList.length > 0 || parsedWplaceCookies.cookies.length > 0
    : name.trim().length > 0;

  if (!props.isOpen) return null;

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

        {props.mode === "create" && props.allowWplace && (
          <div className="toggleRow" style={{ marginBottom: 12 }}>
            <span className="toggleLabelText">{t.fields.wplaceMode}</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={wplaceEnabled}
                onChange={(e) => setWplaceEnabled(e.target.checked)}
                aria-label={t.fields.wplaceMode}
              />
              <span className="toggleTrack">
                <span className="toggleThumb" />
              </span>
            </label>
          </div>
        )}

        {props.mode === "create" && props.allowWplace && wplaceEnabled ? (
          <>
            <label className="label">{t.fields.wplaceTokens}</label>
            <textarea
              className="input"
              rows={6}
              value={wplaceTokens}
              onChange={(e) => setWplaceTokens(e.target.value)}
              placeholder={t.fields.wplaceTokensPlaceholder}
            />
            <label className="label" style={{ marginTop: 12 }}>{t.fields.wplaceCookies}</label>
            <textarea
              className="input"
              rows={6}
              value={wplaceCookiesRaw}
              onChange={(e) => setWplaceCookiesRaw(e.target.value)}
              placeholder={t.fields.wplaceCookiesPlaceholder}
            />
            {parsedWplaceCookies.error && (
              <p className="small" style={{ marginTop: 8, color: "#ff6b6b" }}>{parsedWplaceCookies.error}</p>
            )}
            <div className="card" style={{ marginTop: 8 }}>
              <p className="small" style={{ margin: 0 }}>
                {t.ui.wplaceTokenNote}
              </p>
              <p className="small" style={{ margin: "6px 0 0" }}>
                {t.ui.wplaceCookiesNote}
              </p>
              <p className="small" style={{ margin: "6px 0 0" }}>
                {t.ui.wplaceTokensCount.replace("{count}", String(tokenList.length))}
              </p>
              <p className="small" style={{ margin: "6px 0 0" }}>
                {t.ui.wplaceCookiesCount.replace("{count}", String(parsedWplaceCookies.cookies.length))}
              </p>
            </div>

            <label className="label">{t.fields.referenceProfile}</label>
            <select
              className="input"
              value={referenceProfileId}
              onChange={(e) => setReferenceProfileId(e.target.value)}
            >
              <option value="">{t.fields.referenceProfilePlaceholder}</option>
              {props.referenceProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
            <div className="card" style={{ marginTop: 8 }}>
              <p className="small" style={{ margin: 0 }}>{t.ui.wplaceReferenceNote}</p>
            </div>
          </>
        ) : (
          <>
            <label className="label">{t.fields.name}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fields.namePlaceholder} />

            <label className="label">{t.fields.icon}</label>
            <div className="card" style={{ marginTop: 4 }}>
              <p className="small" style={{ margin: 0 }}>
                {t.ui.avatarNote}
              </p>
            </div>

            <label className="label">{t.fields.url}</label>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </>
        )}

        <label className="label">{t.fields.osType}</label>
        <select className="input" value={osType} onChange={(e) => setOsType(e.target.value as ProfileModalValues["osType"])}>
          <option value="windows">{t.fields.osWindows}</option>
          <option value="mac">{t.fields.osMac}</option>
          <option value="linux">{t.fields.osLinux}</option>
        </select>
        <div className="toggleRow" style={{ marginTop: 12 }}>
          <span className="toggleLabelText">{t.fields.useProxy}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(e) => setUseProxy(e.target.checked)}
              aria-label={t.fields.useProxy}
            />
            <span className="toggleTrack">
              <span className="toggleThumb" />
            </span>
          </label>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            {useProxy ? t.ui.autoProxyNote : t.ui.noProxyNote}
          </p>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn secondary" onClick={props.onClose}>
            {t.actions.cancel}
          </button>
            <button
              className="btn"
              onClick={() => props.onSubmit({
                name: name.trim(),
                icon,
                url: url.trim() || undefined,
                osType,
                useProxy,
                wplace: props.mode === "create" && wplaceEnabled
                  ? {
                    enabled: true,
                    tokens: tokenList,
                    cookies: parsedWplaceCookies.cookies,
                    referenceProfileId: referenceProfileId || undefined,
                  }
                  : undefined,
              })}
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

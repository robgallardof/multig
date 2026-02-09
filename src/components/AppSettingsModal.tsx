"use client";

import React from "react";
import type { Translations } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";

export type AppSettingsModalProps = {
  isOpen: boolean;
  addonUrl: string;
  onClose: () => void;
  onSaved: (addonUrl: string) => void;
  t: Translations;
};

export function AppSettingsModal(props: AppSettingsModalProps) {
  const t = props.t;
  const [addonUrl, setAddonUrl] = React.useState(props.addonUrl);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    setAddonUrl(props.addonUrl);
    setMsg("");
  }, [props.isOpen, props.addonUrl]);

  if (!props.isOpen) return null;

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/settings/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonUrl: addonUrl.trim() || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { addonUrl: string };
      props.onSaved(j.addonUrl);
      setMsg(t.messages.settingsSaved);
    } catch {
      setMsg(t.messages.settingsSaveError);
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
              <EmojiIcon symbol="🧩" label="addons" size={16} /> {t.actions.addons}
            </span>
          </p>
          <button className="btn secondary" onClick={props.onClose} title={t.actions.cancel}>
            <EmojiIcon symbol="✖️" label="close" size={16} />
          </button>
        </div>

        <div className="hr" />

        <p className="small">{t.ui.addonHelper}</p>

        <label className="label">
          <span className="row">
            <EmojiIcon symbol="🔗" label="addon url" size={14} /> {t.fields.addonUrl}
          </span>
        </label>
        <input
          className="input"
          type="url"
          value={addonUrl}
          onChange={(e) => setAddonUrl(e.target.value)}
          placeholder={t.fields.addonUrlPlaceholder}
        />

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn secondary" onClick={props.onClose} disabled={busy}>
            {t.actions.cancel}
          </button>
          <button className="btn" onClick={save} disabled={busy}>
            {t.actions.save}
          </button>
        </div>

        {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}

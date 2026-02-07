"use client";

import { useEffect, useMemo, useState } from "react";
import { es as t } from "../src/i18n/es";
import { Plus, RefreshCw, Wrench, Play, Settings } from "lucide-react";
import { WebshareSettingsModal, type WebsharePublicStatus } from "../src/components/WebshareSettingsModal";
import { ProfileCard, type ProfileVm } from "../src/components/ProfileCard";
import { ProfileModal, type ProfileModalValues } from "../src/components/ProfileModal";

/**
 * API profile model.
 *
 * @since 2026-01-23
 */
type ApiProfile = {
  id: string;
  name: string;
  icon: string;
  url?: string;
  proxyServer?: string;
  proxyLabel?: string;
  proxyId?: string;
  hasProxy?: boolean;
  createdAt: string;
  lastOpenedAt?: string;
};

type ApiProfilesResponse = { profiles: ApiProfile[]; createdId?: string };
type ApiSystemStatus = { venvExists: boolean };
type ApiProxyStatus = { total: number; available: number };

/**
 * Home page.
 *
 * @since 2026-01-23
 */
export default function HomePage() {
  const [defaultUrl, setDefaultUrl] = useState("https://www.robertogallardo.dev");
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [system, setSystem] = useState<ApiSystemStatus | null>(null);
  const [webshare, setWebshare] = useState<WebsharePublicStatus | null>(null);
  const [webshareOpen, setWebshareOpen] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<ApiProxyStatus | null>(null);
  const [toast, setToast] = useState<string>("");

  const vms: ProfileVm[] = useMemo(
    () => profiles.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      createdAt: p.createdAt,
      lastOpenedAt: p.lastOpenedAt,
      hasProxy: p.hasProxy,
      proxyServer: p.proxyServer,
      proxyLabel: p.proxyLabel,
    })),
    [profiles]
  );

  async function safeJson<T>(r: Response): Promise<T> {
    const text = await r.text();
    if (!text) throw new Error("Empty response body");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text);
    }
  }

  async function loadProxyStatus() {
    try {
      const p = await fetch("/api/proxies/status", { cache: "no-store" });
      setProxyStatus(await safeJson<ApiProxyStatus>(p));
    } catch {
      setProxyStatus(null);
    }
  }

  async function loadAll() {
    const r = await fetch("/api/profiles", { cache: "no-store" });
    const j = await safeJson<ApiProfilesResponse>(r);
    setProfiles(j.profiles || []);

    const s = await fetch("/api/system/status", { cache: "no-store" });
    setSystem(await safeJson<ApiSystemStatus>(s));

    const w = await fetch("/api/settings/webshare", { cache: "no-store" });
    setWebshare(await safeJson<WebsharePublicStatus>(w));
    await loadProxyStatus();
  }

  useEffect(() => { void loadAll(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }

  function formatProxiesAvailable(available: number | string, total: number | string) {
    return t.ui.proxiesAvailableFormat
      .replace("{available}", String(available))
      .replace("{total}", String(total));
  }

  async function createProfile(values: ProfileModalValues) {
    setBusy(true);
    try {
      const r = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);

      showToast(t.messages.profileCreated);
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(id: string, values: ProfileModalValues) {
    setBusy(true);
    try {
      const r = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);

      showToast(t.messages.profileUpdated);
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm(`${t.confirm.deleteTitle}\n\n${t.confirm.deleteBody}`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);
      showToast(t.messages.profileDeleted);
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function openProfile(id: string) {
    const p = profiles.find(x => x.id === id);
    const url = (p?.url && p.url.trim()) ? p.url.trim() : defaultUrl.trim();

    if (!system?.venvExists) {
      showToast(t.messages.setupRequired);
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, url }),
      });
      if (!r.ok) throw new Error(await r.text());
      showToast(t.messages.windowOpened);
      await loadAll();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function rotateProxy(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/profiles/${encodeURIComponent(id)}/assign-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "random" }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);
      showToast(t.messages.rotateSuccess);
      await loadProxyStatus();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function openAll() {
    for (const p of profiles) {
      await openProfile(p.id);
    }
  }

  async function setup() {
    setBusy(true);
    try {
      const r = await fetch("/api/system/setup", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      showToast(t.messages.setupReady);
      await loadAll();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  const editing = editId ? profiles.find(x => x.id === editId) : null;

  return (
    <main className="container">
      <div className="topbar">
        <div className="brand">
          <div className="logo">🦊</div>
          <div>
            <h1 className="h1">{t.app.title}</h1>
            <div className="sub">{t.app.subtitle}</div>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="input"
            value={defaultUrl}
            onChange={(e) => setDefaultUrl(e.target.value)}
            placeholder="https://..."
            aria-label={t.fields.defaultUrl}
            title={t.fields.defaultUrl}
          />

          <button className="btn secondary" onClick={() => loadAll()} disabled={busy} title={t.actions.refresh}>
            <span className="row"><RefreshCw size={16} />{t.actions.refresh}</span>
          </button>

          <button className="btn secondary" onClick={() => setWebshareOpen(true)} disabled={busy} title={t.actions.webshare}>
            <span className="row"><Settings size={16} />{t.actions.webshare}</span>
          </button>

          <button className="btn secondary" onClick={() => setup()} disabled={busy} title={t.actions.setup}>
            <span className="row"><Wrench size={16} />{t.actions.setup}</span>
          </button>

          <button className="btn secondary" onClick={() => openAll()} disabled={busy || profiles.length === 0} title={t.actions.openAll}>
            <span className="row"><Play size={16} />{t.actions.openAll}</span>
          </button>

          <button className="btn" onClick={() => { setEditId(null); setModalOpen(true); }} disabled={busy}>
            <span className="row"><Plus size={16} />{t.actions.create}</span>
          </button>
        </div>
      </div>

      <div className="hr" />

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="badge">
          {system?.venvExists ? "🟢 " + t.status.ready : "🟠 " + t.status.notReady}
        </span>
        <span className="badge">
          {t.ui.webshareBadge}: {webshare?.configured ? "🟢" : "🟠"}
        </span>
        <span className="badge">
          {proxyStatus
            ? `${t.status.proxiesAvailable}: ${formatProxiesAvailable(proxyStatus.available, proxyStatus.total)}`
            : `${t.status.proxiesAvailable}: —`}
        </span>
        <span className="badge">{profiles.length} {t.ui.profilesCount}</span>
      </div>

      <div className="grid">
        {vms.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onOpen={(id) => openProfile(id)}
            onEdit={(id) => { setEditId(id); setModalOpen(true); }}
            onDelete={(id) => deleteProfile(id)}
            onRotate={(id) => rotateProxy(id)}
          />
        ))}
      </div>

      <div className="footer">
        {t.footer.copyright} • {t.footer.by}
      </div>

      {toast && (
        <div style={{
          position:"fixed", right:16, bottom:16, padding:"10px 12px",
          border:"1px solid var(--border)", borderRadius:12, background:"rgba(17,27,46,.95)",
          boxShadow:"var(--shadow)", color:"var(--text)", maxWidth:420
        }}>
          <div style={{ fontWeight:800, marginBottom:4 }}>{t.ui.statusTitle}</div>
          <div className="small">{toast}</div>
        </div>
      )}

      <ProfileModal
        mode={editId ? "edit" : "create"}
        isOpen={modalOpen}
        title={editId ? t.ui.editProfileTitle : t.ui.createProfileTitle}
        initial={{
          name: editing?.name || "",
          icon: editing?.icon || "👤",
          url: editing?.url || "",
        }}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => {
          setModalOpen(false);
          if (editId) void updateProfile(editId, values);
          else void createProfile(values);
        }}
      />
    
<WebshareSettingsModal
  isOpen={webshareOpen}
  status={webshare}
  onClose={() => setWebshareOpen(false)}
  onSaved={(s) => { setWebshare(s); void loadAll(); }}
  onSynced={() => { void loadProxyStatus(); }}
/>

</main>
  );
}

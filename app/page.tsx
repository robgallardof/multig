"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { en, es } from "../src/i18n";
import type { Translations } from "../src/i18n";
import { WebshareSettingsModal, type WebsharePublicStatus } from "../src/components/WebshareSettingsModal";
import { ProfileCard, type ProfileVm } from "../src/components/ProfileCard";
import { ProfileModal, type ProfileModalValues } from "../src/components/ProfileModal";
import { EmojiIcon } from "../src/components/EmojiIcon";

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
  osType?: "windows" | "mac" | "linux";
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
type ApiLogEntry = {
  id: number;
  level: "info" | "warn" | "error";
  message: string;
  detail?: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

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
  const [activeProfiles, setActiveProfiles] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [cookieImportProfileId, setCookieImportProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "logs">("profiles");
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [logLevel, setLogLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [logSearch, setLogSearch] = useState("");
  const [logAutoRefresh, setLogAutoRefresh] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [logUpdatedAt, setLogUpdatedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t: Translations = useMemo(() => (language === "es" ? es : en), [language]);

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
  useEffect(() => {
    setActiveProfiles((prev) => {
      const next: Record<string, boolean> = {};
      for (const p of profiles) {
        if (prev[p.id]) next[p.id] = true;
      }
      return next;
    });
  }, [profiles]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }

  async function logClient(level: "info" | "warn" | "error", message: string, detail?: string, context?: Record<string, unknown>) {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, message, detail, context }),
      });
    } catch {
      // ignore logging failures on client
    }
  }

  function formatProxiesAvailable(available: number | string, total: number | string) {
    return t.ui.proxiesAvailableFormat
      .replace("{available}", String(available))
      .replace("{total}", String(total));
  }

  async function loadLogs(silent = false) {
    if (!silent) setLogLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (logLevel !== "all") params.set("level", logLevel);
      if (logSearch.trim()) params.set("search", logSearch.trim());
      const r = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<{ logs: ApiLogEntry[] }>(r);
      setLogs(j.logs || []);
      setLogUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      if (!silent) {
        showToast(`❌ ${String(e?.message || e)}`);
        void logClient("error", "Logs load failed", String(e?.message || e));
      }
    } finally {
      if (!silent) setLogLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "logs") return;
    void loadLogs();
    if (!logAutoRefresh) return;
    const id = window.setInterval(() => void loadLogs(true), 5000);
    return () => window.clearInterval(id);
  }, [activeTab, logAutoRefresh, logLevel, logSearch]);

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
      void logClient("error", "Profile create failed", String(e?.message || e), { name: values.name });
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
      void logClient("error", "Profile update failed", String(e?.message || e), { id });
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
      void logClient("error", "Profile delete failed", String(e?.message || e), { id });
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
        body: JSON.stringify({ id, url, proxyId: p?.proxyId }),
      });
      if (!r.ok) throw new Error(await r.text());
      showToast(t.messages.windowOpened);
      setActiveProfiles((prev) => ({ ...prev, [id]: true }));
      await loadAll();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Profile launch failed", String(e?.message || e), { id, url });
    } finally {
      setBusy(false);
    }
  }

  function requestImportCookies(id: string) {
    if (!system?.venvExists) {
      showToast(t.messages.setupRequired);
      return;
    }
    setCookieImportProfileId(id);
    fileInputRef.current?.click();
  }

  async function handleCookieFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const profileId = cookieImportProfileId;
    if (!file || !profileId) return;

    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(t.messages.cookiesInvalid);
      }
      if (!Array.isArray(parsed)) throw new Error(t.messages.cookiesInvalid);

      const r = await fetch(`/api/profiles/${encodeURIComponent(profileId)}/cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: parsed }),
      });
      if (!r.ok) throw new Error(await r.text());
      showToast(t.messages.cookiesImported);
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Cookies import failed", String(e?.message || e), { profileId });
    } finally {
      setBusy(false);
      setCookieImportProfileId(null);
    }
  }

  async function exportCookies(id: string) {
    if (!system?.venvExists) {
      showToast(t.messages.setupRequired);
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(`/api/profiles/${encodeURIComponent(id)}/cookies`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<{ cookies: unknown[] }>(r);
      const profile = profiles.find(p => p.id === id);
      const name = (profile?.name || id).replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      const blob = new Blob([JSON.stringify(j.cookies || [], null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "profile"}-cookies.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(t.messages.cookiesExported);
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Cookies export failed", String(e?.message || e), { id });
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
      void logClient("error", "Proxy rotate failed", String(e?.message || e), { id });
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
      void logClient("error", "Python setup failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function copyLog(entry: ApiLogEntry) {
    const payload = [
      `[${entry.createdAt}] ${entry.level.toUpperCase()} - ${entry.message}`,
      entry.detail ? `Detail: ${entry.detail}` : "",
      entry.context ? `Context: ${JSON.stringify(entry.context, null, 2)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      showToast(t.messages.logCopied);
    } catch (e: any) {
      showToast(t.messages.logCopyFailed);
      void logClient("error", "Log copy failed", String(e?.message || e), { logId: entry.id });
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
            <span className="row"><EmojiIcon symbol="🔄" label="refresh" size={16} />{t.actions.refresh}</span>
          </button>

          <button className="btn secondary" onClick={() => setWebshareOpen(true)} disabled={busy} title={t.actions.webshare}>
            <span className="row"><EmojiIcon symbol="⚙️" label="settings" size={16} />{t.actions.webshare}</span>
          </button>

          <button className="btn secondary" onClick={() => setup()} disabled={busy} title={t.actions.setup}>
            <span className="row"><EmojiIcon symbol="🛠️" label="setup" size={16} />{t.actions.setup}</span>
          </button>

          <button className="btn secondary" onClick={() => openAll()} disabled={busy || profiles.length === 0} title={t.actions.openAll}>
            <span className="row"><EmojiIcon symbol="▶️" label="open all" size={16} />{t.actions.openAll}</span>
          </button>

          <button className="btn" onClick={() => { setEditId(null); setModalOpen(true); }} disabled={busy}>
            <span className="row"><EmojiIcon symbol="➕" label="create" size={16} />{t.actions.create}</span>
          </button>

          <div className="langToggle" aria-label={t.ui.languageToggle}>
            <span className="toggleLabelText">ES</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={language === "en"}
                onChange={(e) => setLanguage(e.target.checked ? "en" : "es")}
                aria-label={t.ui.languageToggle}
              />
              <span className="toggleTrack">
                <span className="toggleThumb" />
              </span>
            </label>
            <span className="toggleLabelText">EN</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "profiles" ? "active" : ""}`}
          onClick={() => setActiveTab("profiles")}
        >
          {t.ui.tabProfiles}
        </button>
        <button
          className={`tab ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          {t.ui.tabLogs}
        </button>
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
        {activeTab === "logs" && (
          <span className="badge">
            {t.ui.logsCount.replace("{count}", String(logs.length))}
          </span>
        )}
      </div>

      {activeTab === "profiles" ? (
        <div className="grid">
          {vms.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onOpen={(id) => void openProfile(id)}
              isActive={Boolean(activeProfiles[p.id])}
              disabled={busy || !system?.venvExists}
              onEdit={(id) => { setEditId(id); setModalOpen(true); }}
              onDelete={(id) => deleteProfile(id)}
              onRotate={(id) => rotateProxy(id)}
              onImportCookies={(id) => requestImportCookies(id)}
              onExportCookies={(id) => exportCookies(id)}
              t={t}
            />
          ))}
        </div>
      ) : (
        <section className="logsPanel">
          <header className="logsHeader">
            <div>
              <h2 className="h2">{t.ui.logsTitle}</h2>
              <div className="small">{t.ui.logsSubtitle}</div>
            </div>
            <div className="row">
              <button className="btn secondary" onClick={() => void loadLogs()} disabled={logLoading}>
                <span className="row"><EmojiIcon symbol="🧭" label="refresh" size={16} />{t.actions.refresh}</span>
              </button>
              <button className="btn secondary" onClick={() => { setLogSearch(""); setLogLevel("all"); }} disabled={logLoading}>
                {t.actions.clearFilters}
              </button>
              <div className="toggleRow">
                <span className="toggleLabelText">{t.ui.logsAutoRefresh}</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={logAutoRefresh}
                    onChange={(e) => setLogAutoRefresh(e.target.checked)}
                  />
                  <span className="toggleTrack">
                    <span className="toggleThumb" />
                  </span>
                </label>
              </div>
            </div>
          </header>

          <div className="logsFilters">
            <input
              className="input"
              placeholder={t.ui.logsSearchPlaceholder}
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
            />
            <select
              className="select"
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as typeof logLevel)}
            >
              <option value="all">{t.ui.logsLevelAll}</option>
              <option value="info">{t.ui.logsLevelInfo}</option>
              <option value="warn">{t.ui.logsLevelWarn}</option>
              <option value="error">{t.ui.logsLevelError}</option>
            </select>
            <span className="small">
              {logUpdatedAt ? t.ui.logsUpdated.replace("{time}", new Date(logUpdatedAt).toLocaleTimeString()) : "—"}
            </span>
          </div>

          <div className="logsList">
            {logs.length === 0 ? (
              <div className="logEmpty">{t.ui.logsEmpty}</div>
            ) : (
              logs.map((entry) => (
                <article key={entry.id} className="logItem">
                  <div className="logMeta">
                    <span className={`logBadge ${entry.level}`}>{entry.level.toUpperCase()}</span>
                    <span className="logTime">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="logMessage">{entry.message}</div>
                  {entry.detail && <div className="logDetail">{entry.detail}</div>}
                  {entry.context && (
                    <pre className="logContext">{JSON.stringify(entry.context, null, 2)}</pre>
                  )}
                  <div className="logActions">
                    <button className="btn secondary small" onClick={() => void copyLog(entry)}>
                      {t.actions.copy}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

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
          osType: editing?.osType || "windows",
        }}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => {
          setModalOpen(false);
          if (editId) void updateProfile(editId, values);
          else void createProfile(values);
        }}
        t={t}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleCookieFileChange}
      />
    
<WebshareSettingsModal
  isOpen={webshareOpen}
  status={webshare}
  onClose={() => setWebshareOpen(false)}
  onSaved={(s) => { setWebshare(s); void loadAll(); }}
  onSynced={() => { void loadProxyStatus(); }}
  t={t}
/>

</main>
  );
}

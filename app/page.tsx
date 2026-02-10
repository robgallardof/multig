"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { en, es } from "../src/i18n";
import type { Translations } from "../src/i18n";
import { WebshareSettingsModal, type WebsharePublicStatus } from "../src/components/WebshareSettingsModal";
import { AppSettingsModal } from "../src/components/AppSettingsModal";
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
  useProxy?: boolean;
  proxyServer?: string;
  proxyLabel?: string;
  proxyId?: string;
  hasProxy?: boolean;
  createdAt: string;
  lastOpenedAt?: string;
};

type ApiProfilesResponse = { profiles: ApiProfile[]; createdId?: string; createdIds?: string[] };
  type ApiSystemStatus = { venvExists: boolean; wplaceEnabled?: boolean };
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
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [addonUrl, setAddonUrl] = useState("");
  const [proxyStatus, setProxyStatus] = useState<ApiProxyStatus | null>(null);
  const [toast, setToast] = useState<string>("");
  const [activeProfiles, setActiveProfiles] = useState<Record<string, boolean>>({});
  const [operationStatus, setOperationStatus] = useState<string>("");
  const [busyByProfile, setBusyByProfile] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [appSettingsLoaded, setAppSettingsLoaded] = useState(false);
  const [wplaceBotConfigured, setWplaceBotConfigured] = useState(false);
  const [wplaceBotUploading, setWplaceBotUploading] = useState(false);
  const [cookieImportProfileId, setCookieImportProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "logs">("profiles");
  const [profileSearch, setProfileSearch] = useState("");
  const [profileView, setProfileView] = useState<"grid" | "list" | "details">("grid");
  const [profileStatusFilter, setProfileStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [profileProxyFilter, setProfileProxyFilter] = useState<"all" | "assigned" | "pending" | "disabled">("all");
  const [profilePrefsLoaded, setProfilePrefsLoaded] = useState(false);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [logLevel, setLogLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [logSearch, setLogSearch] = useState("");
  const [logAutoRefresh, setLogAutoRefresh] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [logUpdatedAt, setLogUpdatedAt] = useState<string | null>(null);
  const [logView, setLogView] = useState<"cards" | "list">("cards");
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, boolean>>({});
  const [importingCookies, setImportingCookies] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wplaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const t: Translations = useMemo(() => (language === "es" ? es : en), [language]);

  const vms: ProfileVm[] = useMemo(
    () => profiles.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      createdAt: p.createdAt,
      lastOpenedAt: p.lastOpenedAt,
      useProxy: p.useProxy,
      hasProxy: p.hasProxy,
      proxyServer: p.proxyServer,
      proxyLabel: p.proxyLabel,
      url: p.url,
      osType: p.osType,
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


  /**
   * Marks one profile action as busy or idle.
   *
   * @since 2026-02-10
   */
  function setProfileBusy(id: string, isBusy: boolean) {
    setBusyByProfile((prev) => {
      if (isBusy) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /**
   * Updates active profile badges from server runtime status.
   *
   * @since 2026-02-10
   */
  async function refreshRuntimeStatus() {
    try {
      const r = await fetch("/api/runtime-status", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<{ activeProfileIds: string[] }>(r);
      const next: Record<string, boolean> = {};
      for (const id of j.activeProfileIds || []) next[id] = true;
      setActiveProfiles(next);
    } catch (e: any) {
      void logClient("warn", "Runtime status load failed", String(e?.message || e));
    }
  }

  async function loadProxyStatus() {
    try {
      const p = await fetch("/api/proxies/status", { cache: "no-store" });
      if (!p.ok) throw new Error(await p.text());
      setProxyStatus(await safeJson<ApiProxyStatus>(p));
    } catch (e: any) {
      setProxyStatus(null);
      void logClient("error", "Proxy status load failed", String(e?.message || e));
    }
  }

  async function loadAppSettings() {
    try {
      const r = await fetch("/api/settings/app", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<{
        language: "es" | "en";
        addonUrl?: string;
        defaultUrl?: string;
        wplaceBotConfigured?: boolean;
      }>(r);
      setLanguage(j.language === "en" ? "en" : "es");
      setAddonUrl(j.addonUrl || "");
      setDefaultUrl(j.defaultUrl || "https://www.robertogallardo.dev");
      setWplaceBotConfigured(Boolean(j.wplaceBotConfigured));
      setAppSettingsLoaded(true);
    } catch (e: any) {
      void logClient("error", "App settings load failed", String(e?.message || e));
    }
  }

  async function loadAll() {
    try {
      const r = await fetch("/api/profiles", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);
    } catch (e: any) {
      void logClient("error", "Profiles load failed", String(e?.message || e));
    }

    try {
      const s = await fetch("/api/system/status", { cache: "no-store" });
      if (!s.ok) throw new Error(await s.text());
      setSystem(await safeJson<ApiSystemStatus>(s));
    } catch (e: any) {
      void logClient("error", "System status load failed", String(e?.message || e));
    }

    try {
      const w = await fetch("/api/settings/webshare", { cache: "no-store" });
      if (!w.ok) throw new Error(await w.text());
      setWebshare(await safeJson<WebsharePublicStatus>(w));
    } catch (e: any) {
      void logClient("error", "Webshare settings load failed", String(e?.message || e));
    }

    await loadAppSettings();
    await loadProxyStatus();
    await refreshRuntimeStatus();
  }

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => {
    void refreshRuntimeStatus();
    const intervalId = window.setInterval(() => { void refreshRuntimeStatus(); }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("multig.profilePrefs");
    if (!raw) {
      setProfilePrefsLoaded(true);
      return;
    }
    try {
      const prefs = JSON.parse(raw) as Partial<{
        profileView: "grid" | "list" | "details";
        profileSearch: string;
        profileStatusFilter: "all" | "active" | "inactive";
        profileProxyFilter: "all" | "assigned" | "pending" | "disabled";
      }>;
      if (prefs.profileView) setProfileView(prefs.profileView);
      if (prefs.profileSearch) setProfileSearch(prefs.profileSearch);
      if (prefs.profileStatusFilter) setProfileStatusFilter(prefs.profileStatusFilter);
      if (prefs.profileProxyFilter) setProfileProxyFilter(prefs.profileProxyFilter);
    } catch {
      // ignore invalid stored preferences
    } finally {
      setProfilePrefsLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!profilePrefsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(
      "multig.profilePrefs",
      JSON.stringify({
        profileView,
        profileSearch,
        profileStatusFilter,
        profileProxyFilter,
      })
    );
  }, [profileView, profileSearch, profileStatusFilter, profileProxyFilter, profilePrefsLoaded]);
  useEffect(() => {
    if (!appSettingsLoaded) return;
    void (async () => {
      try {
        await fetch("/api/settings/app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, addonUrl, defaultUrl }),
        });
      } catch (e: any) {
        void logClient("error", "App settings save failed", String(e?.message || e));
      }
    })();
  }, [language, addonUrl, defaultUrl, appSettingsLoaded]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    setActiveProfiles((prev) => {
      const next: Record<string, boolean> = {};
      for (const p of profiles) {
        if (prev[p.id]) next[p.id] = true;
      }
      return next;
    });
  }, [profiles]);
  useEffect(() => {
    setSelectedProfiles((prev) => {
      const next: Record<string, boolean> = {};
      for (const p of profiles) {
        if (prev[p.id]) next[p.id] = true;
      }
      return next;
    });
  }, [profiles]);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 3500);
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

  /**
   * Creates a new profile.
   *
   * @since 2026-02-10
   */
  async function createProfile(values: ProfileModalValues) {
    setBusy(true);
    setOperationStatus(t.ui.statusCreatingProfile);
    try {
      if (values.wplace?.enabled) {
        if (!system?.venvExists) {
          showToast(t.messages.setupRequired);
          return;
        }
        const r = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "wplace",
            tokens: values.wplace.tokens,
            osType: values.osType,
            useProxy: values.useProxy,
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await safeJson<ApiProfilesResponse>(r);
        setProfiles(j.profiles || []);
        showToast(t.messages.profileCreated);
        return;
      }
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
      setOperationStatus("");
    }
  }

  async function updateProfile(id: string, values: ProfileModalValues) {
    setBusy(true);
    setOperationStatus(t.ui.statusUpdatingProfile);
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
      setOperationStatus("");
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm(`${t.confirm.deleteTitle}\n\n${t.confirm.deleteBody}`)) return;
    setBusy(true);
    setOperationStatus(t.ui.statusDeletingProfile);
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
      setOperationStatus("");
    }
  }

  /**
   * Launches one profile instance.
   *
   * @since 2026-02-10
   */
  async function openProfile(id: string) {
    if (importingCookies) {
      showToast(t.messages.cookiesImporting);
      return;
    }
    const p = profiles.find(x => x.id === id);
    const normalizedDefaultUrl = defaultUrl.trim();
    const url = normalizedDefaultUrl || (p?.url?.trim() ?? "");

    if (!system?.venvExists) {
      showToast(t.messages.setupRequired);
      return;
    }

    setBusy(true);
    setProfileBusy(id, true);
    setOperationStatus(t.ui.statusOpeningProfile);
    try {
      const r = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, url, proxyId: p?.proxyId }),
      });
      if (!r.ok) throw new Error(await r.text());
      showToast(t.messages.windowOpened);
      await refreshRuntimeStatus();
      await loadAll();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Profile launch failed", String(e?.message || e), { id, url });
    } finally {
      setBusy(false);
      setProfileBusy(id, false);
      setOperationStatus("");
    }
  }

  /**
   * Stops one running profile instance and releases its proxy assignment.
   *
   * @since 2026-02-10
   */
  async function stopProfile(id: string) {
    setBusy(true);
    setProfileBusy(id, true);
    setOperationStatus(t.ui.statusStoppingProfile);
    try {
      const r = await fetch(`/api/profiles/${encodeURIComponent(id)}/release-proxy`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<ApiProfilesResponse>(r);
      setProfiles(j.profiles || []);
      setActiveProfiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showToast(t.messages.profileStopped);
      await loadProxyStatus();
      await refreshRuntimeStatus();
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Profile stop failed", String(e?.message || e), { id });
    } finally {
      setBusy(false);
      setProfileBusy(id, false);
      setOperationStatus("");
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
    setImportingCookies(true);
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
      setImportingCookies(false);
      setCookieImportProfileId(null);
    }
  }

  async function buildWplaceStoragePayload(dataUrl: string) {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(t.messages.wplaceImageInvalid));
      img.src = dataUrl;
    });

    return JSON.stringify({
      version: 2,
      strategy: "SEQUENTIAL",
      images: [
        {
          pixels: {
            url: dataUrl,
            width: image.naturalWidth || 1000,
            brightness: 0,
            exactColor: false,
          },
          position: [0, 0],
          strategy: "SPIRAL_FROM_CENTER",
          opacity: 50,
          drawTransparentPixels: false,
          drawColorsInOrder: false,
          colors: [],
          lock: false,
        },
      ],
    });
  }

  function normalizeWplaceStoragePayload(raw: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(t.messages.wplaceFileInvalid);
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error(t.messages.wplaceFileInvalid);
    }
    if (Array.isArray(parsed.images)) {
      return JSON.stringify({
        version: typeof parsed.version === "number" ? parsed.version : 2,
        strategy: typeof parsed.strategy === "string" ? parsed.strategy : "SEQUENTIAL",
        images: parsed.images,
      });
    }
    if (parsed.pixels) {
      return JSON.stringify({
        version: 2,
        strategy: "SEQUENTIAL",
        images: [parsed],
      });
    }
    throw new Error(t.messages.wplaceFileInvalid);
  }

  async function handleWplaceImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setWplaceBotUploading(true);
    try {
      const isWbot = file.name.toLowerCase().endsWith(".wbot");
      let storagePayload: string;
      if (isWbot) {
        const text = await file.text();
        storagePayload = normalizeWplaceStoragePayload(text);
      } else {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
        if (!dataUrl.startsWith("data:image/")) {
          throw new Error(t.messages.wplaceImageInvalid);
        }
        storagePayload = await buildWplaceStoragePayload(dataUrl);
      }
      const r = await fetch("/api/settings/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wplaceBotStorage: storagePayload }),
      });
      if (!r.ok) throw new Error(await r.text());
      setWplaceBotConfigured(true);
      showToast(t.messages.wplaceImageSaved);
    } catch (err: any) {
      showToast(`❌ ${String(err?.message || err)}`);
      void logClient("error", "Wplace bot image upload failed", String(err?.message || err));
    } finally {
      setWplaceBotUploading(false);
    }
  }

  async function clearWplaceImage() {
    setWplaceBotUploading(true);
    try {
      const r = await fetch("/api/settings/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wplaceBotStorage: null }),
      });
      if (!r.ok) throw new Error(await r.text());
      setWplaceBotConfigured(false);
      showToast(t.messages.wplaceImageCleared);
    } catch (err: any) {
      showToast(`❌ ${String(err?.message || err)}`);
      void logClient("error", "Wplace bot image clear failed", String(err?.message || err));
    } finally {
      setWplaceBotUploading(false);
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
      setOperationStatus("");
    }
  }

  async function rotateProxy(id: string) {
    const profile = profiles.find(p => p.id === id);
    if (profile?.useProxy === false) {
      showToast(t.messages.proxyDisabled);
      return;
    }
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
    if (importingCookies) {
      showToast(t.messages.cookiesImporting);
      return;
    }
    for (const p of profiles) {
      await openProfile(p.id);
    }
  }

  /**
   * Installs/updates Python dependencies for Camoufox execution.
   *
   * @since 2026-02-10
   */
  async function setup() {
    setBusy(true);
    setOperationStatus(t.ui.statusRunningSetup);
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
      setOperationStatus("");
    }
  }

  /**
   * Copies one log entry to clipboard.
   *
   * @since 2026-02-10
   */
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

  async function exportProfiles() {
    const payload = JSON.stringify(profiles, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "multig-profiles.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportLogs() {
    const payload = JSON.stringify(logs, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "multig-logs.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toggleProfileSelection(id: string, selected: boolean) {
    setSelectedProfiles((prev) => ({ ...prev, [id]: selected }));
  }

  function selectAllFiltered() {
    setSelectedProfiles((prev) => {
      const next = { ...prev };
      for (const p of filteredProfiles) {
        next[p.id] = true;
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedProfiles({});
  }

  async function deleteSelectedProfiles() {
    const ids = Object.keys(selectedProfiles).filter((id) => selectedProfiles[id]);
    if (ids.length === 0) return;
    const confirmMessage = t.confirm.deleteSelectedBody.replace("{count}", String(ids.length));
    if (!confirm(`${t.confirm.deleteSelectedTitle}\n\n${confirmMessage}`)) return;
    setBusy(true);
    try {
      const results = await Promise.all(ids.map(async (id) => {
        const r = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) throw new Error(await r.text());
        return r;
      }));
      if (results.length > 0) {
        await loadAll();
      }
      clearSelection();
      showToast(t.messages.profilesDeleted.replace("{count}", String(ids.length)));
    } catch (e: any) {
      showToast(`❌ ${String(e?.message || e)}`);
      void logClient("error", "Batch profile delete failed", String(e?.message || e), { ids });
    } finally {
      setBusy(false);
    }
  }

  const editing = editId ? profiles.find(x => x.id === editId) : null;
  const profileSearchLower = profileSearch.trim().toLowerCase();
  const sortedProfiles = useMemo(() => (
    [...vms].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [vms]);
  const filteredProfiles = useMemo(() => {
    let next = sortedProfiles;
    if (profileSearchLower) {
      next = next.filter((p) => p.name.toLowerCase().includes(profileSearchLower));
    }
    if (profileStatusFilter !== "all") {
      next = next.filter((p) => profileStatusFilter === "active"
        ? Boolean(activeProfiles[p.id])
        : !activeProfiles[p.id]);
    }
    if (profileProxyFilter !== "all") {
      next = next.filter((p) => {
        if (profileProxyFilter === "disabled") return p.useProxy === false;
        if (profileProxyFilter === "assigned") return p.useProxy !== false && p.hasProxy;
        return p.useProxy !== false && !p.hasProxy;
      });
    }
    return next;
  }, [sortedProfiles, profileSearchLower, profileStatusFilter, profileProxyFilter, activeProfiles]);
  const selectedCount = Object.keys(selectedProfiles).filter((id) => selectedProfiles[id]).length;

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

          <button className="btn secondary" onClick={() => setAppSettingsOpen(true)} disabled={busy} title={t.actions.addons}>
            <span className="row"><EmojiIcon symbol="🧩" label="addons" size={16} />{t.actions.addons}</span>
          </button>

          <button className="btn secondary" onClick={() => setup()} disabled={busy} title={t.actions.setup}>
            <span className="row"><EmojiIcon symbol="🛠️" label="setup" size={16} />{t.actions.setup}</span>
          </button>

          <button
            className="btn secondary"
            onClick={() => openAll()}
            disabled={busy || importingCookies || profiles.length === 0}
            title={t.actions.openAll}
          >
            <span className="row"><EmojiIcon symbol="▶️" label="open all" size={16} />{t.actions.openAll}</span>
          </button>

          {system?.wplaceEnabled && (
            <div className="row">
              <button
                className="btn secondary"
                onClick={() => wplaceFileInputRef.current?.click()}
                disabled={wplaceBotUploading}
                title={t.actions.uploadWplaceImage}
              >
                <span className="row">
                  <EmojiIcon symbol="🖼️" label="upload" size={16} />
                  {wplaceBotConfigured ? t.actions.replaceWplaceImage : t.actions.uploadWplaceImage}
                </span>
              </button>
              {wplaceBotConfigured && (
                <button
                  className="btn secondary"
                  onClick={() => void clearWplaceImage()}
                  disabled={wplaceBotUploading}
                  title={t.actions.clearWplaceImage}
                >
                  <span className="row"><EmojiIcon symbol="🧹" label="clear" size={16} />{t.actions.clearWplaceImage}</span>
                </button>
              )}
            </div>
          )}

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
        {operationStatus && <span className="badge">⏳ {operationStatus}</span>}
      </div>

      {activeTab === "profiles" ? (
        <section className="profilesPanel">
          <div className="profilesHeader">
            <div className="row">
              <input
                className="input"
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                placeholder={t.ui.profileSearchPlaceholder}
                style={{ minWidth: 240 }}
              />
              <select
                className="select"
                value={profileStatusFilter}
                onChange={(e) => setProfileStatusFilter(e.target.value as typeof profileStatusFilter)}
                aria-label={t.ui.profileStatusFilterLabel}
              >
                <option value="all">{t.ui.profileStatusAll}</option>
                <option value="active">{t.ui.profileStatusActive}</option>
                <option value="inactive">{t.ui.profileStatusInactive}</option>
              </select>
              <select
                className="select"
                value={profileProxyFilter}
                onChange={(e) => setProfileProxyFilter(e.target.value as typeof profileProxyFilter)}
                aria-label={t.ui.profileProxyFilterLabel}
              >
                <option value="all">{t.ui.profileProxyAll}</option>
                <option value="assigned">{t.ui.profileProxyAssigned}</option>
                <option value="pending">{t.ui.profileProxyPending}</option>
                <option value="disabled">{t.ui.profileProxyDisabled}</option>
              </select>
              <button
                className="btn secondary"
                onClick={() => {
                  setProfileSearch("");
                  setProfileStatusFilter("all");
                  setProfileProxyFilter("all");
                }}
                disabled={!profileSearch && profileStatusFilter === "all" && profileProxyFilter === "all"}
              >
                {t.actions.clearFilters}
              </button>
            </div>
            <div className="row">
              <button
                className={`btn secondary ${profileView === "grid" ? "activeBtn" : ""}`}
                onClick={() => setProfileView("grid")}
              >
                {t.actions.viewGrid}
              </button>
              <button
                className={`btn secondary ${profileView === "list" ? "activeBtn" : ""}`}
                onClick={() => setProfileView("list")}
              >
                {t.actions.viewList}
              </button>
              <button
                className={`btn secondary ${profileView === "details" ? "activeBtn" : ""}`}
                onClick={() => setProfileView("details")}
              >
                {t.actions.viewDetails}
              </button>
              <button className="btn secondary" onClick={() => void exportProfiles()} disabled={profiles.length === 0}>
                {t.actions.exportProfiles}
              </button>
              <button className="btn secondary" onClick={() => selectAllFiltered()} disabled={filteredProfiles.length === 0}>
                {t.actions.selectAll}
              </button>
              <button className="btn secondary" onClick={() => clearSelection()} disabled={selectedCount === 0}>
                {t.actions.clearSelection}
              </button>
              <button className="btn danger" onClick={() => deleteSelectedProfiles()} disabled={selectedCount === 0}>
                {t.actions.deleteSelected}
              </button>
              <span className="badge">
                {t.ui.selectedCount.replace("{count}", String(selectedCount))}
              </span>
            </div>
          </div>
          <div className={`grid profilesGrid ${profileView === "list" ? "list" : ""} ${profileView === "details" ? "details" : ""}`}>
            {filteredProfiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onOpen={(id) => void openProfile(id)}
                onStop={(id) => void stopProfile(id)}
                isActive={Boolean(activeProfiles[p.id])}
                disabled={busy || importingCookies || !system?.venvExists || Boolean(busyByProfile[p.id])}
                onEdit={(id) => { setEditId(id); setModalOpen(true); }}
                onDelete={(id) => deleteProfile(id)}
                onRotate={(id) => rotateProxy(id)}
                onImportCookies={(id) => requestImportCookies(id)}
                onExportCookies={(id) => exportCookies(id)}
                view={profileView}
                selected={Boolean(selectedProfiles[p.id])}
                onSelect={(id, selected) => toggleProfileSelection(id, selected)}
                t={t}
              />
            ))}
          </div>
        </section>
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
              <button className="btn secondary" onClick={() => void exportLogs()} disabled={logs.length === 0}>
                {t.actions.exportLogs}
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
            <div className="row">
              <button
                className={`btn secondary small ${logView === "cards" ? "activeBtn" : ""}`}
                onClick={() => setLogView("cards")}
              >
                {t.actions.viewGrid}
              </button>
              <button
                className={`btn secondary small ${logView === "list" ? "activeBtn" : ""}`}
                onClick={() => setLogView("list")}
              >
                {t.actions.viewList}
              </button>
            </div>
            <span className="small">
              {logUpdatedAt ? t.ui.logsUpdated.replace("{time}", new Date(logUpdatedAt).toLocaleTimeString()) : "—"}
            </span>
          </div>

          <div className={`logsList ${logView === "list" ? "list" : ""}`}>
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
          useProxy: editing?.useProxy ?? true,
        }}
        allowWplace={Boolean(system?.wplaceEnabled)}
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
      <input
        ref={wplaceFileInputRef}
        type="file"
        accept="image/*,.wbot"
        style={{ display: "none" }}
        onChange={handleWplaceImageChange}
      />

      <WebshareSettingsModal
        isOpen={webshareOpen}
        status={webshare}
        onClose={() => setWebshareOpen(false)}
        onSaved={(s) => { setWebshare(s); void loadAll(); }}
        onSynced={() => { void loadProxyStatus(); }}
        t={t}
      />

      <AppSettingsModal
        isOpen={appSettingsOpen}
        addonUrl={addonUrl}
        onClose={() => setAppSettingsOpen(false)}
        onSaved={(url) => { setAddonUrl(url); }}
        t={t}
      />

    </main>
  );
}

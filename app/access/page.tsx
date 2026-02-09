"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { en, es } from "../../src/i18n";
import type { Translations } from "../../src/i18n";

export default function AccessPage() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState<"es" | "en">("es");

  const t: Translations = useMemo(() => (language === "es" ? es : en), [language]);

  async function safeJson<T>(r: Response): Promise<T> {
    const text = await r.text();
    if (!text) throw new Error("Empty response body");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text);
    }
  }

  async function loadLanguage() {
    try {
      const r = await fetch("/api/settings/app", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await safeJson<{ language: "es" | "en" }>(r);
      setLanguage(j.language === "en" ? "en" : "es");
    } catch {
      setLanguage("es");
    }
  }

  async function saveLanguage(nextLanguage: "es" | "en") {
    setLanguage(nextLanguage);
    try {
      await fetch("/api/settings/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLanguage }),
      });
    } catch {
      // Ignore language save errors on access screen.
    }
  }

  useEffect(() => {
    void loadLanguage();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  async function submit() {
    setStatus("loading");
    setMessage("");

    try {
      const r = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || t.access.invalidToken);
      }
      window.location.href = nextPath;
    } catch (e: any) {
      setStatus("error");
      setMessage(String(e?.message || t.access.invalidToken));
    }
  }

  return (
    <main className="container accessPage">
      <div className="accessCard">
        <div className="accessHeader">
          <div className="logo">🦊</div>
          <div>
            <h1 className="h1">{t.access.title}</h1>
            <p className="sub">{t.access.subtitle}</p>
          </div>
          <div className="langToggle" aria-label={t.ui.languageToggle}>
            <span className="toggleLabelText">ES</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={language === "en"}
                onChange={(e) => saveLanguage(e.target.checked ? "en" : "es")}
                aria-label={t.ui.languageToggle}
              />
              <span className="toggleTrack">
                <span className="toggleThumb" />
              </span>
            </label>
            <span className="toggleLabelText">EN</span>
          </div>
        </div>
        <label className="label" htmlFor="token">{t.access.tokenLabel}</label>
        <input
          id="token"
          className="input"
          placeholder={t.access.tokenPlaceholder}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        {status === "error" && (
          <div className="accessError">{message}</div>
        )}
        <button className="btn" onClick={() => void submit()} disabled={!token.trim() || status === "loading"}>
          {status === "loading" ? t.access.validating : t.access.submit}
        </button>
        <p className="small">{t.access.helper}</p>
      </div>
    </main>
  );
}

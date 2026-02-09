"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AccessPage() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

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
        throw new Error(text || "Token inválido");
      }
      window.location.href = nextPath;
    } catch (e: any) {
      setStatus("error");
      setMessage(String(e?.message || "Token inválido"));
    }
  }

  return (
    <main className="container accessPage">
      <div className="accessCard">
        <div className="accessHeader">
          <div className="logo">🦊</div>
          <div>
            <h1 className="h1">Acceso requerido</h1>
            <p className="sub">Ingresa tu token para habilitar la app en este dispositivo.</p>
          </div>
        </div>
        <label className="label" htmlFor="token">Token de acceso</label>
        <input
          id="token"
          className="input"
          placeholder="multig-..."
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
          {status === "loading" ? "Validando..." : "Entrar"}
        </button>
        <p className="small">Solo hay 1 token válido por dispositivo.</p>
      </div>
    </main>
  );
}

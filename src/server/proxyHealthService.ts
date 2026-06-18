import http from "node:http";

export type ProxyEndpoint = {
  host: string;
  port: number;
};

export type ProxyHealthResult = {
  ok: boolean;
  statusCode?: number;
  error?: string;
};

/**
 * Verifies that an HTTP proxy accepts the configured credentials and can open
 * a tunnel to the requested destination before Camoufox is spawned.
 */
export class ProxyHealthService {
  public static testTunnel(
    proxy: ProxyEndpoint,
    targetUrl: string,
    credentials?: { username?: string; password?: string },
    timeoutMs = 8_000,
  ): Promise<ProxyHealthResult> {
    let targetHost = "wplace.live";
    let targetPort = 443;
    try {
      const parsed = new URL(targetUrl);
      targetHost = parsed.hostname || targetHost;
      targetPort = parsed.port ? Number(parsed.port) : parsed.protocol === "http:" ? 80 : 443;
    } catch {
      // The launch route normalizes URLs; keep a safe Wplace fallback here.
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: ProxyHealthResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const headers: Record<string, string> = {
        Host: `${targetHost}:${targetPort}`,
      };
      if (credentials?.username || credentials?.password) {
        const value = `${credentials.username || ""}:${credentials.password || ""}`;
        headers["Proxy-Authorization"] = `Basic ${Buffer.from(value).toString("base64")}`;
      }

      const request = http.request({
        host: proxy.host,
        port: proxy.port,
        method: "CONNECT",
        path: `${targetHost}:${targetPort}`,
        headers,
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Proxy CONNECT timed out after ${timeoutMs}ms`));
      });
      request.on("connect", (response, socket) => {
        socket.destroy();
        const statusCode = response.statusCode || 0;
        finish({
          ok: statusCode === 200,
          statusCode,
          error: statusCode === 200 ? undefined : `Proxy CONNECT returned HTTP ${statusCode}`,
        });
      });
      request.on("response", (response) => {
        response.resume();
        const statusCode = response.statusCode || 0;
        finish({
          ok: false,
          statusCode,
          error: `Proxy CONNECT returned HTTP ${statusCode}`,
        });
      });
      request.on("error", (error) => {
        finish({ ok: false, error: error.message });
      });
      request.end();
    });
  }
}

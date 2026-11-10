/**
 * Cloudflare Worker: Organizer-protected proxy for Project Grace shared answers.
 *
 * Environment variables (set in Cloudflare dashboard or wrangler.toml [vars]):
 * - UPSTREAM_BIN_URL: e.g. "https://dontlosedata.site/api/v1/9dc450ce-03a3-4c84-b91f-b7ad27cd2f39"
 * - BIN_API_KEY: Secret key configured on the bin to restrict write/delete access.
 * - ORGANIZER_PASSPHRASE: Secret passphrase required to DELETE an answer.
 */

export interface Env {
  UPSTREAM_BIN_URL: string;
  BIN_API_KEY?: string;
  ORGANIZER_PASSPHRASE?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Organizer-Passphrase",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const upstreamBase = (env.UPSTREAM_BIN_URL || "https://dontlosedata.site/api/v1/9dc450ce-03a3-4c84-b91f-b7ad27cd2f39").replace(/\/$/, "");

    // Path forwarding:
    // e.g. worker.domain/id/xyz -> upstreamBase/id/xyz
    const targetUrl = `${upstreamBase}${url.pathname === "/" ? "" : url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");

    // If an API key is configured for the bin, attach it to all upstream requests
    if (env.BIN_API_KEY) {
      headers.set("X-Master-Key", env.BIN_API_KEY);
      headers.set("Authorization", `Bearer ${env.BIN_API_KEY}`);
    }

    // Protect DELETE operations with organizer passphrase
    if (request.method === "DELETE") {
      const authHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const passphraseHeader = request.headers.get("X-Organizer-Passphrase") ?? "";
      const provided = passphraseHeader || authHeader;

      if (!env.ORGANIZER_PASSPHRASE || provided !== env.ORGANIZER_PASSPHRASE) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Valid organizer passphrase required to delete." }),
          {
            status: 401,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    try {
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
      });

      const responseHeaders = new Headers(upstreamResponse.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(key, value);
      }

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Upstream bin unreachable" }),
        {
          status: 502,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};

/**
 * OAuth redirect_uri allowlist.
 *
 * MCP clients split into two families for their OAuth callback:
 *
 *   1. Native/CLI clients (Claude Code, Cursor, Windsurf, etc.) bind an
 *      ephemeral HTTP server to a random loopback port each auth request.
 *      RFC 8252 §7.3 requires authorization servers to accept ANY port on
 *      a loopback redirect URI — the port isn't known ahead of time.
 *
 *   2. Hosted web clients (Claude.ai, Claude Desktop) use a fixed HTTPS
 *      origin for their callback.
 *
 * A previous hardcoded allowlist pinned Claude Code to localhost:6274 —
 * that's actually the MCP Inspector's port, not Claude Code's, so every
 * Claude Code user's OAuth flow was being rejected at the authorize step.
 */

const HOSTED_ORIGINS = [
  "https://claude.ai",
  "https://claude.com",
  // Smithery's OAuth callback for hosted introspection / install flows
  // (https://smithery.run/oauth/callback). Without this, every Smithery
  // install — and the registry's tool-discovery bot — dead-ends at the
  // /oauth/authorize allowlist check.
  "https://smithery.run",
];

// WHATWG URL parser returns IPv6 hostnames wrapped in brackets (e.g. "[::1]"),
// so the set matches that exact form — not the bare "::1" literal.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isRedirectUriAllowed(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }

  // RFC 8252: http + loopback with any port is the standard native-app flow.
  // Hostname comparison is strict — "localhost.evil.com" must NOT match.
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) {
    return true;
  }

  if (HOSTED_ORIGINS.includes(url.origin)) return true;

  const extra = process.env.EXTRA_REDIRECT_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
  if (extra.includes(url.origin)) return true;

  return false;
}

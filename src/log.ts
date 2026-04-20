/**
 * Structured JSON logger for Vercel Functions.
 *
 * Vercel's log pipeline auto-parses JSON lines, so a single-line JSON
 * payload becomes a queryable event in the dashboard (filter by
 * `event:oauth_authorize_failed`, etc.).
 *
 * **Never pass secrets** to this function: API keys, code_verifier,
 * authorization codes, full redirect URIs with query params. Callers are
 * responsible for redaction; the logger trusts what it's given.
 */

type LogLevel = "info" | "warn" | "error";

export interface LogEvent {
  event: string;
  level?: LogLevel;
  // Arbitrary event-specific fields. Must be JSON-serializable.
  [key: string]: unknown;
}

export function logEvent(event: LogEvent): void {
  const { level = "info", ...rest } = event;
  const payload = { ts: new Date().toISOString(), ...rest };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Extract the subset of request headers we log everywhere — host for
 * multi-tenant telemetry, user-agent to identify the MCP client.
 * We never log cookies or the Authorization header.
 */
export function requestContext(
  req: { headers: Record<string, string | string[] | undefined> },
): { host: string | undefined; ua: string | undefined } {
  const host = req.headers.host;
  const ua = req.headers["user-agent"];
  return {
    host: Array.isArray(host) ? host[0] : host,
    ua: Array.isArray(ua) ? ua[0] : ua,
  };
}

/**
 * Reduce a redirect_uri to just its origin for logging — query strings
 * and paths can leak PKCE challenges, state tokens, or user identifiers.
 * Returns "<unparseable>" for malformed inputs so logs stay useful.
 */
export function redirectOrigin(uri: unknown): string {
  if (typeof uri !== "string" || !uri) return "<missing>";
  try {
    return new URL(uri).origin;
  } catch {
    return "<unparseable>";
  }
}

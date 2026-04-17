/**
 * Minimal OAuth 2.1 implementation for MCP authentication.
 *
 * This wraps SciWeave's API key auth in an OAuth flow so that MCP clients
 * (Claude Code, claude.ai) can authenticate using the standard protocol.
 *
 * Flow:
 * 1. Client discovers OAuth metadata via /.well-known/oauth-authorization-server
 * 2. Client does dynamic registration → gets client_id
 * 3. Client opens browser to /oauth/authorize
 * 4. User enters their SciWeave API key
 * 5. Server redirects back with an authorization code (encrypted API key)
 * 6. Client exchanges code for access_token via /oauth/token
 * 7. Client uses access_token (= the API key) for MCP requests
 */

import { createHmac, randomBytes } from "node:crypto";

const SIGNING_SECRET =
  process.env.OAUTH_SIGNING_SECRET || "sciweave-mcp-oauth-default-secret";

/**
 * Encode an API key as an authorization code.
 * Format: base64(apiKey).hmac
 */
export function encodeAuthCode(apiKey: string, expiresInMs = 5 * 60 * 1000): string {
  const payload = JSON.stringify({
    key: apiKey,
    exp: Date.now() + expiresInMs,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SIGNING_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Decode and verify an authorization code, returning the API key.
 */
export function decodeAuthCode(code: string): string | null {
  const [encoded, sig] = code.split(".");
  if (!encoded || !sig) return null;

  const expectedSig = createHmac("sha256", SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.key || null;
  } catch {
    return null;
  }
}

/**
 * Generate a random client ID for dynamic registration.
 */
export function generateClientId(): string {
  return `sciweave_${randomBytes(16).toString("hex")}`;
}

/**
 * Get the base URL from a request.
 */
export function getBaseUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "mcp.sciweave.com";
  const p = Array.isArray(proto) ? proto[0] : proto;
  const h = Array.isArray(host) ? host[0] : host;
  return `${p}://${h}`;
}

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 */
export function getOAuthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["sciweave"],
  };
}

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 */
export function getResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ["sciweave"],
    bearer_methods_supported: ["header"],
  };
}

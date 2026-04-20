/**
 * Minimal OAuth 2.1 implementation for MCP authentication.
 *
 * This wraps SciWeave's API key auth in an OAuth flow so that MCP clients
 * (Claude Code, claude.ai) can authenticate using the standard protocol.
 *
 * Flow:
 * 1. Client discovers OAuth metadata via /.well-known/oauth-authorization-server
 * 2. Client does dynamic registration → gets client_id
 * 3. Client opens browser to /oauth/authorize with a PKCE code_challenge
 * 4. User enters their SciWeave API key
 * 5. Server redirects back with an authorization code (HMAC-signed payload
 *    containing the API key + PKCE challenge)
 * 6. Client exchanges code for access_token via /oauth/token, sending its
 *    code_verifier. Server verifies SHA256(code_verifier) == stored challenge.
 * 7. Client uses access_token (= the API key) for MCP requests
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_SIGNING_SECRET = "sciweave-mcp-oauth-default-secret";

/**
 * Refuse to boot in production with the hardcoded default — anyone who
 * reads the source can forge auth codes otherwise. Preview/dev environments
 * (VERCEL_ENV=preview|development, or unset locally) can run without it.
 *
 * Exported so tests can exercise the check with a mocked env without
 * needing to re-import the module.
 */
export function assertSigningSecretIsSet(env: NodeJS.ProcessEnv = process.env): void {
  const secret = env.OAUTH_SIGNING_SECRET || DEFAULT_SIGNING_SECRET;
  if (env.VERCEL_ENV === "production" && secret === DEFAULT_SIGNING_SECRET) {
    throw new Error(
      "OAUTH_SIGNING_SECRET must be set in production. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
}

assertSigningSecretIsSet();

const SIGNING_SECRET =
  process.env.OAUTH_SIGNING_SECRET || DEFAULT_SIGNING_SECRET;

export type CodeChallengeMethod = "S256";

export interface DecodedAuthCode {
  apiKey: string;
  codeChallenge: string;
  codeChallengeMethod: CodeChallengeMethod;
}

/**
 * Encode an API key + PKCE challenge as an authorization code.
 * Format: base64url(payload).hmac
 * Payload: { key, cc (code_challenge), ccm (code_challenge_method), exp }
 */
export function encodeAuthCode(
  apiKey: string,
  codeChallenge: string,
  codeChallengeMethod: CodeChallengeMethod,
  expiresInMs = 5 * 60 * 1000,
): string {
  const payload = JSON.stringify({
    key: apiKey,
    cc: codeChallenge,
    ccm: codeChallengeMethod,
    exp: Date.now() + expiresInMs,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Decode and verify an authorization code, returning the embedded API key
 * and PKCE challenge. Returns null on any failure (bad signature, expired,
 * malformed payload, missing fields).
 */
export function decodeAuthCode(code: string): DecodedAuthCode | null {
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = createHmac("sha256", SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");

  // Constant-time compare so attackers can't probe the signature byte-by-byte.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    if (typeof payload.key !== "string" || !payload.key) return null;
    if (typeof payload.cc !== "string" || !payload.cc) return null;
    if (payload.ccm !== "S256") return null;
    return {
      apiKey: payload.key,
      codeChallenge: payload.cc,
      codeChallengeMethod: payload.ccm,
    };
  } catch {
    return null;
  }
}

/**
 * Verify a PKCE code_verifier against a stored code_challenge per RFC 7636.
 * For S256: base64url(sha256(verifier)) must equal the stored challenge.
 */
export function verifyPkce(
  codeVerifier: string,
  storedChallenge: string,
  storedMethod: CodeChallengeMethod,
): boolean {
  if (storedMethod !== "S256") return false;
  if (!codeVerifier || typeof codeVerifier !== "string") return false;

  // RFC 7636 §4.1: verifier is 43–128 chars of unreserved URL-safe chars.
  // We don't strictly enforce the charset (the hash compare will fail anyway),
  // but we reject obviously-wrong lengths up front.
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;

  const computed = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const computedBuf = Buffer.from(computed);
  const storedBuf = Buffer.from(storedChallenge);
  if (computedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(computedBuf, storedBuf);
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

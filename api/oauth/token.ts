/**
 * OAuth Token Endpoint
 *
 * Exchanges an authorization code for an access token.
 * The code contains the API key + PKCE challenge (HMAC-signed). We decode
 * it, verify the client's code_verifier against the stored challenge per
 * RFC 7636, and return the API key as the access_token.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { decodeAuthCode, verifyPkce } from "../../src/oauth.js";
import { logEvent, requestContext } from "../../src/log.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { grant_type, code, code_verifier } = req.body || {};

  if (grant_type !== "authorization_code") {
    logEvent({
      event: "oauth_token_bad_grant_type",
      level: "warn",
      grant_type: typeof grant_type === "string" ? grant_type : null,
      ...requestContext(req),
    });
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only authorization_code grant is supported",
    });
    return;
  }

  if (!code) {
    logEvent({
      event: "oauth_token_missing_code",
      level: "warn",
      ...requestContext(req),
    });
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing authorization code",
    });
    return;
  }

  if (!code_verifier) {
    logEvent({
      event: "oauth_token_missing_verifier",
      level: "warn",
      ...requestContext(req),
    });
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing code_verifier. PKCE is required (RFC 7636).",
    });
    return;
  }

  // Decode the authorization code to extract the API key + stored challenge.
  const decoded = decodeAuthCode(code);
  if (!decoded) {
    logEvent({
      event: "oauth_token_invalid_code",
      level: "warn",
      ...requestContext(req),
    });
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Invalid or expired authorization code",
    });
    return;
  }

  // PKCE: hash the client's verifier and compare (constant-time) to the
  // challenge we stored when we issued the code. If they don't match, the
  // caller didn't originate this flow and can't have the access token.
  if (
    !verifyPkce(code_verifier, decoded.codeChallenge, decoded.codeChallengeMethod)
  ) {
    logEvent({
      event: "oauth_token_pkce_failed",
      level: "warn",
      ...requestContext(req),
    });
    res.status(400).json({
      error: "invalid_grant",
      error_description: "PKCE verification failed",
    });
    return;
  }

  res.json({
    access_token: decoded.apiKey,
    token_type: "Bearer",
    scope: "sciweave",
  });
}

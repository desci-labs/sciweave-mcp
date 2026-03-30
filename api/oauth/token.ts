/**
 * OAuth Token Endpoint
 *
 * Exchanges an authorization code for an access token.
 * The code contains an encrypted API key — we decode it and return
 * the API key as the access_token.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { decodeAuthCode } from "../../src/oauth.js";

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

  const { grant_type, code } = req.body || {};

  if (grant_type !== "authorization_code") {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only authorization_code grant is supported",
    });
    return;
  }

  if (!code) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing authorization code",
    });
    return;
  }

  // Decode the authorization code to extract the API key
  const apiKey = decodeAuthCode(code);
  if (!apiKey) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Invalid or expired authorization code",
    });
    return;
  }

  // Return the API key as the access token
  res.json({
    access_token: apiKey,
    token_type: "Bearer",
    scope: "sciweave",
  });
}

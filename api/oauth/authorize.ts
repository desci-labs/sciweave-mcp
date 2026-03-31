/**
 * OAuth Authorization Endpoint
 *
 * GET  → Shows a form where the user enters their SciWeave API key
 * POST → Validates the key, redirects back with an authorization code
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { encodeAuthCode } from "../../src/oauth.js";
import { validateApiKey } from "../../src/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return showAuthForm(req, res);
  }
  if (req.method === "POST") {
    return handleAuthorize(req, res);
  }
  res.status(405).json({ error: "method_not_allowed" });
}

function showAuthForm(req: VercelRequest, res: VercelResponse) {
  const { redirect_uri, state, code_challenge, code_challenge_method, client_id } =
    req.query as Record<string, string>;

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect SciWeave to Claude</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      padding: 40px 32px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      animation: spin 20s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .logo:hover { animation-duration: 2s; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
    p { font-size: 14px; color: #a3a3a3; margin-bottom: 24px; line-height: 1.5; }
    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #d4d4d4; text-align: left; }
    input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-family: ui-monospace, monospace;
      outline: none;
    }
    input[type="text"]:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    button {
      width: 100%;
      margin-top: 16px;
      padding: 10px;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #2563eb; }
    .error { color: #ef4444; font-size: 13px; margin-top: 8px; display: none; }
    .help { font-size: 12px; color: #737373; margin-top: 16px; }
    .help a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="https://sciweave.com/assets/logo-light.svg" alt="SciWeave" width="64" height="64">
    <h1>Connect SciWeave</h1>
    <p>Enter your SciWeave API key to give Claude access to your research papers, collections, and AI-powered answers.</p>
    <form method="POST" action="/oauth/authorize" id="form" style="text-align:left">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || "")}">
      <input type="hidden" name="state" value="${escapeHtml(state || "")}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || "")}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || "")}">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id || "")}">
      <label for="api_key">API Key</label>
      <input type="text" id="api_key" name="api_key" placeholder="sciweave_live_..." required autocomplete="off">
      <div class="error" id="error"></div>
      <button type="submit">Connect to Claude</button>
    </form>
    <p class="help">Generate an API key at <a href="https://sciweave.com/settings?tab=api-access" target="_blank">sciweave.com/settings</a></p>
  </div>
</body>
</html>`);
}

async function handleAuthorize(req: VercelRequest, res: VercelResponse) {
  const { api_key, redirect_uri, state } = req.body || {};

  if (!api_key || !redirect_uri) {
    res.status(400).json({ error: "invalid_request", error_description: "Missing api_key or redirect_uri" });
    return;
  }

  // Validate the API key against the real SciWeave backend
  const auth = await validateApiKey(api_key);
  if (!auth.valid) {
    // Show the form again with error
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Error</title>
<style>body{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;}
.card{background:#171717;border:1px solid #262626;border-radius:12px;padding:32px;max-width:420px;}
h1{font-size:18px;color:#ef4444;margin-bottom:12px;}p{font-size:14px;color:#a3a3a3;}
a{color:#3b82f6;text-decoration:none;}</style></head>
<body><div class="card"><h1>Invalid API Key</h1><p>${escapeHtml(auth.error || "The API key could not be verified.")}</p>
<p style="margin-top:16px"><a href="javascript:history.back()">Try again</a></p></div></body></html>`);
    return;
  }

  // Encode the API key as an authorization code
  const code = encodeAuthCode(api_key);

  // Redirect back to the client with the code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(302, redirectUrl.toString());
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

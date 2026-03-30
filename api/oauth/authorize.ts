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
    <svg class="logo" width="64" height="64" viewBox="0 0 486 486" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c)"><path d="M253 347.8v41.3c0 15.1-12.4 27.5-27.6 27.5v-69.7c5.8 1 11.6 1.5 17.6 1.5 3.4 0 6.7-.2 10-.4v-.1Z" fill="#E8EEF1"/><path d="M225.3 416.5v69.6a243 243 0 0 1-27.5-3.5V444c0-15.2 12.4-27.5 27.5-27.5Z" fill="#E8EEF1"/><path d="m212.1 343.7-15.8 38a131 131 0 0 1-36-51.5l26.7-64.3a131 131 0 0 0 25.1 77.8Z" fill="#E8EEF1"/><path d="m160.4 396.5-26.8 64.3a243 243 0 0 1-24.1-17.9l14.9-35.5c5.8-14 21.9-20.7 35.9-14.9Z" fill="#E8EEF1"/><path d="m176 324.1-29.2 29.1c-10.7 10.7-28.2 10.7-38.9 0l49.4-49.3a131 131 0 0 0 18.7 20.2Z" fill="#E8EEF1"/><path d="M107.9 353.2 58.6 402.4a243 243 0 0 1-16.9-22l27.3-27.3c10.7-10.7 28.2-10.7 38.9 0Z" fill="#E8EEF1"/><path d="m150 292.4-38 15.7c-14 5.8-30.1-.9-35.9-15l64.4-26.6a131 131 0 0 0 9.5 25.9Z" fill="#E8EEF1"/><path d="m76.1 293.1-64.4 26.6a243 243 0 0 1-7.3-26.9l35.7-14.7c14-5.8 30.1.9 35.9 15Z" fill="#E8EEF1"/><path d="M137.8 243c0 3.4.2 6.7.5 10h-41.2c-15.2-.1-27.5-12.4-27.5-27.7h69.7c-1 5.8-1.5 11.6-1.5 17.6Z" fill="#E8EEF1"/><path d="M69.6 225.4H0c.6-9.5 1.7-18.7 3.6-27.6h38.5c15.1 0 27.5 12.3 27.5 27.6Z" fill="#E8EEF1"/><path d="M153.9 187.1a131 131 0 0 0-11.5 25.1l-38-15.8c-14-5.9-20.7-22-14.9-36.1l64.4 26.8Z" fill="#E8EEF1"/><path d="m89.6 160.3-64.3-26.7a243 243 0 0 1 13.8-24l35.6 14.8c14 5.9 20.7 22 14.9 36Z" fill="#E8EEF1"/><path d="M182 157.2a131 131 0 0 0-20.2 18.8l-29.1-29.2c-10.7-10.7-10.7-28.2 0-38.9l49.3 49.3Z" fill="#E8EEF1"/><path d="M132.8 107.9 83.7 58.5a243 243 0 0 1 22-16.9l27.3 27.3c10.7 10.7 10.7 28.1 0 38.9Z" fill="#E8EEF1"/><path d="M219.5 140.4a131 131 0 0 0-25.8 9.5L177.9 112c-5.8-14 .9-30.1 15-36l26.6 64.4Z" fill="#E8EEF1"/><path d="m192.8 76-26.5-64.4a243 243 0 0 1 26.8-7.2l14.7 35.7c5.8 14-.9 30.1-15 35.9Z" fill="#E8EEF1"/><path d="M260.7 69.5v69.7c-5.8-1-11.7-1.5-17.7-1.5-3.4 0-6.7.2-9.9.5V97c0-15.1 12.4-27.5 27.6-27.5Z" fill="#E8EEF1"/><path d="M288.2 3.6V42c0 15.2-12.4 27.5-27.5 27.5V0c9.4.5 18.5 1.7 27.5 3.6Z" fill="#E8EEF1"/><path d="m325.6 89.5-26.7 64.3a131 131 0 0 0-25.1-11.4l15.8-38c5.8-14 22-20.7 36-14.9Z" fill="#E8EEF1"/><path d="m376.4 39.1-14.8 35.5c-5.8 14-22 20.7-36 14.9l26.8-64.3a243 243 0 0 1 24 13.9Z" fill="#E8EEF1"/><path d="m378.1 132.8-49.4 49.3a131 131 0 0 0-18.7-20.2l29.2-29.1c10.7-10.7 28.1-10.7 38.9 0Z" fill="#E8EEF1"/><path d="m444.3 105.6-27.3 27.3c-10.7 10.7-28.2 10.6-38.9 0l49.2-49.1a243 243 0 0 1 17 21.8Z" fill="#E8EEF1"/><path d="m409.9 192.9-64.4-26.6a131 131 0 0 0-9.5-26l38-15.6c14-5.8 30.1.9 35.9 15l.1.1Z" fill="#E8EEF1"/><path d="m481.6 193.2-35.7 14.6c-14 5.8-30.1-.9-35.9-14.9l64.4-26.7a243 243 0 0 1 7.2 27Z" fill="#E8EEF1"/><path d="M346.7 260.6c1-5.7 1.5-11.6 1.5-17.5 0-3.4-.2-6.7-.5-10H389c15.2.1 27.5 12.4 27.5 27.6h-69.7Z" fill="#E8EEF1"/><path d="M486 260.8a243 243 0 0 1-3.6 27.5h-38.5c-15.1-.1-27.5-12.4-27.5-27.6h69.5Z" fill="#E8EEF1"/><path d="M396.4 325.7 332 299a131 131 0 0 0 11.6-25.1l38 15.9c14 5.8 20.7 21.9 14.9 35.9Z" fill="#E8EEF1"/><path d="m460.7 352.4a243 243 0 0 1-13.8 24l-35.6-14.8c-14-5.8-20.7-21.9-14.9-36l64.3 26.8Z" fill="#E8EEF1"/><path d="m353.2 378.1-49.2-49.3a131 131 0 0 0 20.1-18.8l29.1 29.2c10.7 11 10.7 28.2 0 38.9Z" fill="#E8EEF1"/><path d="m402.3 427.5a243 243 0 0 1-22 16.9l-27.1-27.3c-10.7-10.8-10.7-28.2 0-38.9l49.2 49.3Z" fill="#E8EEF1"/><path d="m293 410-26.5-64.4a131 131 0 0 0 25.8-9.5l15.7 38c5.8 14-.9 30.2-15 36Z" fill="#E8EEF1"/><path d="m319.6 474.4a243 243 0 0 1-26.8 7.2l-14.6-35.6c-5.8-14 .9-30.1 15-36l26.5 64.3Z" fill="#E8EEF1"/></g><defs><clipPath id="c"><rect width="486" height="486" fill="#fff"/></clipPath></defs></svg>
    <h1>Connect SciWeave</h1>
    <p>Enter your SciWeave API key to give Claude access to your research papers, collections, and AI-powered answers.</p>
    <form method="POST" action="/oauth/authorize" id="form" style="text-align:left">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || "")}">
      <input type="hidden" name="state" value="${escapeHtml(state || "")}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || "")}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || "")}">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id || "")}">
      <label for="api_key">API Key</label>
      <input type="text" id="api_key" name="api_key" placeholder="sk-live_..." required autocomplete="off">
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

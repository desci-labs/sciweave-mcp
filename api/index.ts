import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE_URL = "https://mcp.sciweave.com";

const jsonPayload = {
  name: "SciWeave MCP Server",
  description:
    "Claude connector for AI-powered research paper search and answers with citations",
  mcp_endpoint: "/mcp",
  docs: "https://github.com/desci-labs/sciweave-mcp",
  setup: {
    step1: "Generate an API key at sciweave.com/settings",
    step2: "In Claude.ai, go to Settings → Connectors",
    step3: `Add connector URL: ${BASE_URL}/mcp`,
    step4: "Paste your API key as the authorization token",
  },
  tools: [
    "ask_research_question",
    "list_collections",
    "get_collection_papers",
    "get_research_thread",
  ],
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  const accept = (req.headers.accept || "").toLowerCase();

  // Serve HTML with OG metadata for browsers / link previews
  if (accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SciWeave MCP Server</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="SciWeave MCP Server">
  <meta property="og:description" content="Search research papers and get AI-powered answers with citations — right inside Claude.">
  <meta property="og:image" content="${BASE_URL}/public/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${BASE_URL}">
  <meta property="og:site_name" content="SciWeave">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SciWeave MCP Server">
  <meta name="twitter:description" content="Search research papers and get AI-powered answers with citations — right inside Claude.">
  <meta name="twitter:image" content="${BASE_URL}/public/og.jpg">

  <meta name="description" content="SciWeave MCP Server — Claude connector for AI-powered research paper search and answers with citations.">

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
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 560px;
      width: 100%;
      text-align: center;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      animation: spin 20s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .logo:hover { animation-duration: 2s; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #fff; letter-spacing: -0.5px; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #3b82f6;
      background: rgba(59,130,246,0.1);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: 6px;
      padding: 4px 12px;
      margin-bottom: 20px;
    }
    .desc { font-size: 15px; color: #a3a3a3; margin-bottom: 32px; line-height: 1.6; }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 32px;
    }
    .tool {
      font-family: ui-monospace, 'SF Mono', monospace;
      font-size: 12px;
      color: #60a5fa;
      background: rgba(59,130,246,0.08);
      border: 1px solid rgba(59,130,246,0.15);
      border-radius: 6px;
      padding: 6px 12px;
    }
    .setup {
      text-align: left;
      background: #0a0a0a;
      border: 1px solid #262626;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .setup h2 { font-size: 13px; font-weight: 600; color: #d4d4d4; margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .step {
      font-size: 13px;
      color: #a3a3a3;
      margin-bottom: 8px;
      line-height: 1.5;
      display: flex;
      gap: 8px;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num { color: #3b82f6; font-weight: 600; flex-shrink: 0; }
    code {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      background: #262626;
      padding: 2px 6px;
      border-radius: 4px;
      color: #e5e5e5;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      background: #3b82f6;
      border: none;
      border-radius: 10px;
      padding: 14px 28px;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 24px;
      transition: background 0.15s;
    }
    .cta:hover { background: #2563eb; }
    .cta svg { flex-shrink: 0; }
    .divider { font-size: 12px; color: #525252; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #525252; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="https://sciweave.com/assets/logo-light.svg" alt="SciWeave" width="80" height="80">
    <h1>SciWeave</h1>
    <div class="badge">MCP Server</div>
    <p class="desc">Search research papers and get AI-powered answers with citations — right inside Claude.</p>
    <div class="tools">
      <span class="tool">ask_research_question</span>
      <span class="tool">list_collections</span>
      <span class="tool">get_collection_papers</span>
      <span class="tool">get_research_thread</span>
    </div>
    <a class="cta" href="https://sciweave.com/login?redirect=/settings?tab=api-access">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
      Get Your API Key
    </a>
    <p class="divider">Already have a key? Follow the steps below.</p>
    <div class="setup">
      <h2>Quick Setup</h2>
      <div class="step"><span class="step-num">1.</span> <a href="https://sciweave.com/login?redirect=/settings?tab=api-access" style="color:#3b82f6;text-decoration:none">Log in</a> and copy your API key</div>
      <div class="step"><span class="step-num">2.</span> In Claude.ai → Settings → Connectors</div>
      <div class="step"><span class="step-num">3.</span> Add URL: <code>${BASE_URL}/mcp</code></div>
      <div class="step"><span class="step-num">4.</span> Paste your API key as the token</div>
    </div>
    <p class="footer">Built by <a href="https://sciweave.com">SciWeave</a></p>
  </div>
</body>
</html>`);
    return;
  }

  // JSON for programmatic access
  res.json(jsonPayload);
}

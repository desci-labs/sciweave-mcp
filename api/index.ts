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
  <meta property="og:image" content="${BASE_URL}/public/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${BASE_URL}">
  <meta property="og:site_name" content="SciWeave">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SciWeave MCP Server">
  <meta name="twitter:description" content="Search research papers and get AI-powered answers with citations — right inside Claude.">
  <meta name="twitter:image" content="${BASE_URL}/public/og.png">

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
    .footer { font-size: 12px; color: #525252; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="logo" width="80" height="80" viewBox="0 0 486 486" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c)"><path d="M253 347.8v41.3c0 15.1-12.4 27.5-27.6 27.5v-69.7c5.8 1 11.6 1.5 17.6 1.5 3.4 0 6.7-.2 10-.4v-.1Z" fill="#E8EEF1"/><path d="M225.3 416.5v69.6a243 243 0 0 1-27.5-3.5V444c0-15.2 12.4-27.5 27.5-27.5Z" fill="#E8EEF1"/><path d="m212.1 343.7-15.8 38a131 131 0 0 1-36-51.5l26.7-64.3a131 131 0 0 0 25.1 77.8Z" fill="#E8EEF1"/><path d="m160.4 396.5-26.8 64.3a243 243 0 0 1-24.1-17.9l14.9-35.5c5.8-14 21.9-20.7 35.9-14.9Z" fill="#E8EEF1"/><path d="m176 324.1-29.2 29.1c-10.7 10.7-28.2 10.7-38.9 0l49.4-49.3a131 131 0 0 0 18.7 20.2Z" fill="#E8EEF1"/><path d="M107.9 353.2 58.6 402.4a243 243 0 0 1-16.9-22l27.3-27.3c10.7-10.7 28.2-10.7 38.9 0Z" fill="#E8EEF1"/><path d="m150 292.4-38 15.7c-14 5.8-30.1-.9-35.9-15l64.4-26.6a131 131 0 0 0 9.5 25.9Z" fill="#E8EEF1"/><path d="m76.1 293.1-64.4 26.6a243 243 0 0 1-7.3-26.9l35.7-14.7c14-5.8 30.1.9 35.9 15Z" fill="#E8EEF1"/><path d="M137.8 243c0 3.4.2 6.7.5 10h-41.2c-15.2-.1-27.5-12.4-27.5-27.7h69.7c-1 5.8-1.5 11.6-1.5 17.6Z" fill="#E8EEF1"/><path d="M69.6 225.4H0c.6-9.5 1.7-18.7 3.6-27.6h38.5c15.1 0 27.5 12.3 27.5 27.6Z" fill="#E8EEF1"/><path d="M153.9 187.1a131 131 0 0 0-11.5 25.1l-38-15.8c-14-5.9-20.7-22-14.9-36.1l64.4 26.8Z" fill="#E8EEF1"/><path d="m89.6 160.3-64.3-26.7a243 243 0 0 1 13.8-24l35.6 14.8c14 5.9 20.7 22 14.9 36Z" fill="#E8EEF1"/><path d="M182 157.2a131 131 0 0 0-20.2 18.8l-29.1-29.2c-10.7-10.7-10.7-28.2 0-38.9l49.3 49.3Z" fill="#E8EEF1"/><path d="M132.8 107.9 83.7 58.5a243 243 0 0 1 22-16.9l27.3 27.3c10.7 10.7 10.7 28.1 0 38.9Z" fill="#E8EEF1"/><path d="M219.5 140.4a131 131 0 0 0-25.8 9.5L177.9 112c-5.8-14 .9-30.1 15-36l26.6 64.4Z" fill="#E8EEF1"/><path d="m192.8 76-26.5-64.4a243 243 0 0 1 26.8-7.2l14.7 35.7c5.8 14-.9 30.1-15 35.9Z" fill="#E8EEF1"/><path d="M260.7 69.5v69.7c-5.8-1-11.7-1.5-17.7-1.5-3.4 0-6.7.2-9.9.5V97c0-15.1 12.4-27.5 27.6-27.5Z" fill="#E8EEF1"/><path d="M288.2 3.6V42c0 15.2-12.4 27.5-27.5 27.5V0c9.4.5 18.5 1.7 27.5 3.6Z" fill="#E8EEF1"/><path d="m325.6 89.5-26.7 64.3a131 131 0 0 0-25.1-11.4l15.8-38c5.8-14 22-20.7 36-14.9Z" fill="#E8EEF1"/><path d="m376.4 39.1-14.8 35.5c-5.8 14-22 20.7-36 14.9l26.8-64.3a243 243 0 0 1 24 13.9Z" fill="#E8EEF1"/><path d="m378.1 132.8-49.4 49.3a131 131 0 0 0-18.7-20.2l29.2-29.1c10.7-10.7 28.1-10.7 38.9 0Z" fill="#E8EEF1"/><path d="m444.3 105.6-27.3 27.3c-10.7 10.7-28.2 10.6-38.9 0l49.2-49.1a243 243 0 0 1 17 21.8Z" fill="#E8EEF1"/><path d="m409.9 192.9-64.4-26.6a131 131 0 0 0-9.5-26l38-15.6c14-5.8 30.1.9 35.9 15l.1.1Z" fill="#E8EEF1"/><path d="m481.6 193.2-35.7 14.6c-14 5.8-30.1-.9-35.9-14.9l64.4-26.7a243 243 0 0 1 7.2 27Z" fill="#E8EEF1"/><path d="M346.7 260.6c1-5.7 1.5-11.6 1.5-17.5 0-3.4-.2-6.7-.5-10H389c15.2.1 27.5 12.4 27.5 27.6h-69.7Z" fill="#E8EEF1"/><path d="M486 260.8a243 243 0 0 1-3.6 27.5h-38.5c-15.1-.1-27.5-12.4-27.5-27.6h69.5Z" fill="#E8EEF1"/><path d="M396.4 325.7 332 299a131 131 0 0 0 11.6-25.1l38 15.9c14 5.8 20.7 21.9 14.9 35.9Z" fill="#E8EEF1"/><path d="m460.7 352.4a243 243 0 0 1-13.8 24l-35.6-14.8c-14-5.8-20.7-21.9-14.9-36l64.3 26.8Z" fill="#E8EEF1"/><path d="m353.2 378.1-49.2-49.3a131 131 0 0 0 20.1-18.8l29.1 29.2c10.7 11 10.7 28.2 0 38.9Z" fill="#E8EEF1"/><path d="m402.3 427.5a243 243 0 0 1-22 16.9l-27.1-27.3c-10.7-10.8-10.7-28.2 0-38.9l49.2 49.3Z" fill="#E8EEF1"/><path d="m293 410-26.5-64.4a131 131 0 0 0 25.8-9.5l15.7 38c5.8 14-.9 30.2-15 36Z" fill="#E8EEF1"/><path d="m319.6 474.4a243 243 0 0 1-26.8 7.2l-14.6-35.6c-5.8-14 .9-30.1 15-36l26.5 64.3Z" fill="#E8EEF1"/></g><defs><clipPath id="c"><rect width="486" height="486" fill="#fff"/></clipPath></defs></svg>
    <h1>SciWeave</h1>
    <div class="badge">MCP Server</div>
    <p class="desc">Search research papers and get AI-powered answers with citations — right inside Claude.</p>
    <div class="tools">
      <span class="tool">ask_research_question</span>
      <span class="tool">list_collections</span>
      <span class="tool">get_collection_papers</span>
      <span class="tool">get_research_thread</span>
    </div>
    <div class="setup">
      <h2>Quick Setup</h2>
      <div class="step"><span class="step-num">1.</span> Generate an API key at <a href="https://sciweave.com/settings?tab=api-access" style="color:#3b82f6;text-decoration:none">sciweave.com/settings</a></div>
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

/**
 * Local development server for testing the MCP server.
 *
 * Usage:
 *   SCIWEAVE_API_KEY=your_key pnpm dev
 *
 * Then test with MCP Inspector:
 *   npx @modelcontextprotocol/inspector
 *   Then in the Inspector UI, choose Streamable HTTP and enter:
 *   http://localhost:3100/mcp
 */

import { createServer as createHttpServer } from "node:http";
import process from "node:process";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Local .env loading is best-effort for dev only.
}

const [{ createServer }, { validateApiKey }] = await Promise.all([
  import("./server.js"),
  import("./auth.js"),
]);

const PORT = parseInt(process.env.PORT || "3100", 10);
const DEV_API_KEY = process.env.SCIWEAVE_API_KEY;
const ML_BACKEND_URL =
  process.env.SCIWEAVE_ML_BACKEND_URL || "https://nodes-api.desci.com";
const WEB_API_URL =
  process.env.SCIWEAVE_WEB_API_URL || "https://sciweave.com";
const DEBUG_HTTP = process.env.SCIWEAVE_MCP_DEBUG_HTTP === "true";

const httpServer = createHttpServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only handle /mcp path
  if (req.url !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. Use /mcp" }));
    return;
  }

  // Extract API key from header or use dev key
  let apiKey: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;
  }
  apiKey = apiKey || DEV_API_KEY || null;

  if (!apiKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Set SCIWEAVE_API_KEY env var or pass Authorization header",
      })
    );
    return;
  }

  // Validate API key
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: auth.error }));
    return;
  }

  console.log(`[MCP] Authenticated as ${auth.userId ?? "user"}`);

  // Parse body for POST requests
  let body: unknown = undefined;
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
  }

  // Create fresh server + transport per request (stateless)
  const mcpServer = createServer(apiKey);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(transport);

  try {
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("[MCP] Error handling request:", err);
    if (!res.writableEnded) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        })
      );
    }
  } finally {
    await mcpServer.close();
  }
});

httpServer.listen(PORT, () => {
  console.log(`SciWeave MCP server running at http://localhost:${PORT}/mcp`);
  console.log("Inspector: start with `npx @modelcontextprotocol/inspector`, then choose Streamable HTTP and enter the MCP URL.");
  console.log(`[MCP] ML backend: ${ML_BACKEND_URL}`);
  console.log(`[MCP] Web API: ${WEB_API_URL}`);
  console.log(`[MCP] HTTP debug logging: ${DEBUG_HTTP ? "enabled" : "disabled"}`);
  console.log(`[MCP] Dev API key loaded: ${DEV_API_KEY ? "yes" : "no"}`);
});

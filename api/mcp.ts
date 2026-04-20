/**
 * Vercel Serverless Function — MCP Endpoint
 *
 * Handles Streamable HTTP transport for the MCP protocol.
 * Each request creates a fresh server instance (stateless mode).
 *
 * Claude.ai sends the API key as: Authorization: Bearer <api_key>
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";
import { validateApiKey } from "../src/auth.js";
import { logEvent, requestContext } from "../src/log.js";

function getResourceMetadataUrl(req: VercelRequest): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "mcp.sciweave.com";
  // Point at the well-known URL that matches the MCP endpoint the client
  // is using. Strict clients (Claude Code) compare the `resource` field
  // in the metadata against the URL they connected to and reject on
  // mismatch per RFC 9728 §3.3. Two variants are served at:
  //   /.well-known/oauth-protected-resource       → resource: <host>
  //   /mcp/.well-known/oauth-protected-resource   → resource: <host>/mcp
  const urlPath = (req.url || "/").split("?")[0];
  const isMcpPath = urlPath === "/mcp" || urlPath.startsWith("/mcp/");
  const wellKnownPath = isMcpPath
    ? "/mcp/.well-known/oauth-protected-resource"
    : "/.well-known/oauth-protected-resource";
  return `${proto}://${host}${wellKnownPath}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS — allow Claude.ai and other MCP clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // -- Auth: extract and validate API key --
  const authHeader = req.headers.authorization;
  let apiKey: string | null = null;
  if (authHeader) {
    apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;
  }

  if (!apiKey) {
    // An unauthenticated hit on /mcp is how OAuth discovery starts, so
    // this is expected in high volume. Log at info, not warn — it only
    // becomes a symptom when a specific client loops on 401s.
    logEvent({
      event: "mcp_auth_missing_key",
      path: (req.url || "").split("?")[0],
      ...requestContext(req),
    });
    // WWW-Authenticate header triggers OAuth flow in MCP clients
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${getResourceMetadataUrl(req)}"`
    );
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          'Missing API key. Pass your SciWeave API key as "Authorization: Bearer <key>". Per-client setup guide: https://sciweave.com/web/mcp',
      },
      id: null,
    });
    return;
  }

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    logEvent({
      event: "mcp_auth_invalid_key",
      level: "warn",
      reason: auth.error,
      path: (req.url || "").split("?")[0],
      ...requestContext(req),
    });
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: auth.error ?? "Invalid API key",
      },
      id: null,
    });
    return;
  }

  // -- Create a fresh server + transport per request (stateless) --
  const server = createServer(apiKey);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless — no session persistence
    enableJsonResponse: true, // Return single JSON response & end the connection
    // (default SSE mode keeps the stream open, which hangs serverless clients)
  });

  await server.connect(transport);

  try {
    // The MCP SDK's handleRequest accepts Node.js IncomingMessage + ServerResponse.
    // Vercel's req/res extend these, so they work directly.
    // Third arg is the pre-parsed body (Vercel already parses JSON for us).
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[MCP] Error handling request:", err);
    if (!res.writableEnded) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    await server.close();
  }
}

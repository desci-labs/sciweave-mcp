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

function getResourceMetadataUrl(req: VercelRequest): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "sciweave-mcp.vercel.app";
  return `${proto}://${host}/.well-known/oauth-protected-resource`;
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
          "Missing API key. Add your SciWeave API key as the authorization token in your Claude connector settings.",
      },
      id: null,
    });
    return;
  }

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
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

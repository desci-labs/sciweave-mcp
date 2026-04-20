/** OAuth Protected Resource Metadata (RFC 9728) */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBaseUrl, getResourceMetadata } from "../src/oauth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=3600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const baseUrl = getBaseUrl(req);

  // Two well-known paths route to this handler with different `scope`
  // query params (see vercel.json):
  //   /.well-known/oauth-protected-resource       → scope=root
  //   /mcp/.well-known/oauth-protected-resource   → scope=mcp
  // Each variant declares the matching `resource` URL so strict clients
  // don't reject us for RFC 9728 mismatch.
  const scope = req.query.scope;
  const resourceUrl = scope === "mcp" ? `${baseUrl}/mcp` : baseUrl;

  res.json(getResourceMetadata(baseUrl, resourceUrl));
}

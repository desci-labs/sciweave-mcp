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
  res.json(getResourceMetadata(baseUrl));
}

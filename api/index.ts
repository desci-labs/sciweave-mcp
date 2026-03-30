import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    name: "SciWeave MCP Server",
    description:
      "Claude connector for AI-powered research paper search and answers with citations",
    mcp_endpoint: "/mcp",
    docs: "https://github.com/desci-labs/sciweave-mcp",
    setup: {
      step1: "Generate an API key at sciweave.com/settings",
      step2: "In Claude.ai, go to Settings → Connectors",
      step3: "Add connector URL: https://sciweave-mcp.vercel.app/mcp",
      step4: "Paste your API key as the authorization token",
    },
    tools: [
      "ask_research_question",
      "list_collections",
      "get_collection_papers",
      "get_research_thread",
    ],
  });
}

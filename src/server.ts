/**
 * SciWeave MCP Server
 *
 * Thin proxy over the existing SciWeave API. All business logic lives in
 * sciweave-web (Next.js) and ml-sciweave-backend (FastAPI). This server
 * just translates MCP tool calls into HTTP requests to those services.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InsufficientCreditsError } from "./api-client.js";
import {
  askResearchQuestionSchema,
  askResearchQuestion,
} from "./tools/ask.js";
import {
  listCollectionsSchema,
  listCollections,
  getCollectionPapersSchema,
  getCollectionPapers,
} from "./tools/collections.js";
import {
  getResearchThreadSchema,
  getResearchThread,
} from "./tools/threads.js";
import {
  findReferencesSchema,
  findReferencesTool,
} from "./tools/references.js";
import {
  getAccountStatusSchema,
  getAccountStatus,
} from "./tools/account.js";

/** Wrap a tool handler to catch InsufficientCreditsError and return a friendly message */
function withCreditGuard<T>(
  fn: (apiKey: string, input: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>
): (apiKey: string, input: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  return async (apiKey, input) => {
    try {
      return await fn(apiKey, input);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  };
}

export function createServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "SciWeave",
    version: "1.0.0",
  });

  const guard = <T>(fn: (apiKey: string, input: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>) =>
    withCreditGuard(fn);

  // -- Account status: check credits, get pricing/upgrade links --
  server.tool(
    "get_account_status",
    "Check the user's SciWeave account status — remaining API credits, and links for pricing and top-up. Call this when the user asks about their usage, credits, billing, or how to upgrade.",
    getAccountStatusSchema.shape,
    { readOnlyHint: true, title: "Account Status" },
    async () => {
      return getAccountStatus(apiKey);
    }
  );

  // -- Core tool: Ask a research question and get an answer with citations --
  server.tool(
    "ask_research_question",
    "Ask a research question and get an AI-powered answer backed by citations from scientific literature and the user's own paper collections. Supports filtering by year, difficulty level, and collection scope.",
    askResearchQuestionSchema.shape,
    { readOnlyHint: true, title: "Ask Research Question" },
    async (input) => {
      return guard(askResearchQuestion)(apiKey, askResearchQuestionSchema.parse(input));
    }
  );

  // -- List user's research collections --
  server.tool(
    "list_collections",
    "List all of the user's research paper collections (lists) on SciWeave. Returns collection names, IDs, descriptions, and paper counts. Use the IDs to scope research questions to specific collections.",
    listCollectionsSchema.shape,
    { readOnlyHint: true, title: "List Collections" },
    async () => {
      try {
        return await listCollections(apiKey);
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return { content: [{ type: "text" as const, text: err.message }], isError: true };
        }
        throw err;
      }
    }
  );

  // -- Get papers in a collection --
  server.tool(
    "get_collection_papers",
    "Get all papers in a specific research collection. Returns titles, authors, years, journals, DOIs, and abstracts. Use list_collections first to find collection IDs.",
    getCollectionPapersSchema.shape,
    { readOnlyHint: true, title: "Get Collection Papers" },
    async (input) => {
      return guard(getCollectionPapers)(apiKey, getCollectionPapersSchema.parse(input));
    }
  );

  // -- Retrieve a previous research thread --
  server.tool(
    "get_research_thread",
    "Retrieve a previous research conversation thread by its ID. Shows the original question, AI answer, citations, and any follow-up exchanges. Thread IDs are returned by ask_research_question.",
    getResearchThreadSchema.shape,
    { readOnlyHint: true, title: "Get Research Thread" },
    async (input) => {
      return guard(getResearchThread)(apiKey, getResearchThreadSchema.parse(input));
    }
  );

  // -- Fast reference lookup (no LLM answer generation) --
  server.tool(
    "find_references",
    "Fast reference lookup — returns relevant papers with titles, authors, years, DOIs, and abstract snippets. Much faster than ask_research_question because it skips AI answer generation. Use this when you just need to find papers on a topic, not a synthesized answer.",
    findReferencesSchema.shape,
    { readOnlyHint: true, title: "Find References" },
    async (input) => {
      return guard(findReferencesTool)(apiKey, findReferencesSchema.parse(input));
    }
  );

  return server;
}

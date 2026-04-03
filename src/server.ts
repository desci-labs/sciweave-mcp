/**
 * SciWeave MCP Server
 *
 * Thin proxy over the existing SciWeave API. All business logic lives in
 * sciweave-web (Next.js) and ml-sciweave-backend (FastAPI). This server
 * just translates MCP tool calls into HTTP requests to those services.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

export function createServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "SciWeave",
    version: "1.0.0",
  });

  // -- Core tool: Ask a research question and get an answer with citations --
  server.tool(
    "ask_research_question",
    "Ask a research question and get an AI-powered answer backed by citations from scientific literature and the user's own paper collections. Supports filtering by year, difficulty level, and collection scope.",
    askResearchQuestionSchema.shape,
    async (input) => {
      return askResearchQuestion(apiKey, askResearchQuestionSchema.parse(input));
    }
  );

  // -- List user's research collections --
  server.tool(
    "list_collections",
    "List all of the user's research paper collections (lists) on SciWeave. Returns collection names, IDs, descriptions, and paper counts. Use the IDs to scope research questions to specific collections.",
    listCollectionsSchema.shape,
    async () => {
      return listCollections(apiKey);
    }
  );

  // -- Get papers in a collection --
  server.tool(
    "get_collection_papers",
    "Get all papers in a specific research collection. Returns titles, authors, years, journals, DOIs, and abstracts. Use list_collections first to find collection IDs.",
    getCollectionPapersSchema.shape,
    async (input) => {
      return getCollectionPapers(
        apiKey,
        getCollectionPapersSchema.parse(input)
      );
    }
  );

  // -- Retrieve a previous research thread --
  server.tool(
    "get_research_thread",
    "Retrieve a previous research conversation thread by its ID. Shows the original question, AI answer, citations, and any follow-up exchanges. Thread IDs are returned by ask_research_question.",
    getResearchThreadSchema.shape,
    async (input) => {
      return getResearchThread(
        apiKey,
        getResearchThreadSchema.parse(input)
      );
    }
  );

  // -- Fast reference lookup (no LLM answer generation) --
  server.tool(
    "find_references",
    "Fast reference lookup — returns relevant papers with titles, authors, years, DOIs, and abstract snippets. Much faster than ask_research_question because it skips AI answer generation. Use this when you just need to find papers on a topic, not a synthesized answer.",
    findReferencesSchema.shape,
    async (input) => {
      return findReferencesTool(apiKey, findReferencesSchema.parse(input));
    }
  );

  return server;
}

import { z } from "zod";
import { listCollections as fetchCollections, getCollectionPapers as fetchPapers } from "../api-client.js";

export const listCollectionsSchema = z.object({});

export async function listCollections(apiKey: string) {
  const lists = await fetchCollections(apiKey);

  if (lists.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No research collections found. Create collections at sciweave.com to organize your papers.",
        },
      ],
    };
  }

  const formatted = lists
    .map(
      (l) =>
        `- **${l.name}** (ID: ${l.id})\n  ${l.description || "No description"}\n  Papers: ${l.paper_count} | Created: ${l.created_at?.split("T")[0] ?? "unknown"}`
    )
    .join("\n\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${lists.length} research collection(s):\n\n${formatted}`,
      },
    ],
  };
}

export const getCollectionPapersSchema = z.object({
  list_id: z
    .string()
    .describe(
      "The ID of the research collection. Use list_collections first to find IDs."
    ),
});

export type GetCollectionPapersInput = z.infer<typeof getCollectionPapersSchema>;

export async function getCollectionPapers(
  apiKey: string,
  input: GetCollectionPapersInput
) {
  const papers = await fetchPapers(apiKey, input.list_id);

  if (papers.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No papers found in this collection.",
        },
      ],
    };
  }

  const formatted = papers
    .map((p, i) => {
      const parts = [`${i + 1}. **${p.title || "Untitled"}**`];
      if (p.authors) {
        const authorStr = Array.isArray(p.authors)
          ? p.authors.map((a: unknown) => (typeof a === "string" ? a : (a as Record<string, string>)?.name ?? String(a))).join(", ")
          : String(p.authors);
        if (authorStr) parts.push(`   Authors: ${authorStr}`);
      }
      if (p.year) parts.push(`   Year: ${p.year}`);
      if (p.journal) parts.push(`   Journal: ${p.journal}`);
      if (p.doi) parts.push(`   DOI: ${p.doi}`);
      if (p.abstract) parts.push(`   Abstract: ${p.abstract.slice(0, 200)}...`);
      return parts.join("\n");
    })
    .join("\n\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `${papers.length} paper(s) in this collection:\n\n${formatted}`,
      },
    ],
  };
}

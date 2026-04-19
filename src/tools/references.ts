import { z } from "zod";
import { findReferences, trackUsage } from "../api-client.js";

export const findReferencesSchema = z.object({
  query: z
    .string()
    .describe(
      "The research topic or question to find references for. Be specific — e.g., 'CRISPR-Cas9 off-target effects in mammalian cells'"
    ),
  top_k: z
    .number()
    .min(2)
    .max(10)
    .default(5)
    .describe("Number of papers to return (2-10, default 5)"),
});

export type FindReferencesInput = z.infer<typeof findReferencesSchema>;

export async function findReferencesTool(
  apiKey: string,
  input: FindReferencesInput
) {
  // Deduct + log usage BEFORE doing work (so broke users can't extract results)
  const tracked = await trackUsage(apiKey, "find_references");
  if (!tracked.ok) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${tracked.error ?? "Usage tracking failed"}`,
        },
      ],
      isError: true,
    };
  }

  const result = await findReferences(apiKey, {
    query: input.query,
    top_k: input.top_k,
  });

  if (result.error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${result.error}`,
        },
      ],
      isError: true,
    };
  }

  if (!result.citations.length) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No relevant papers found for this query.",
        },
      ],
    };
  }

  const citationList = result.citations
    .map((c, i) => {
      const parts = [`[${i + 1}] ${c.title}`];
      if (c.authors_short) parts.push(`   Authors: ${c.authors_short}`);
      if (c.year) parts.push(`   Year: ${c.year}`);
      if (c.doi) parts.push(`   DOI: ${c.doi}`);
      if (c.url) parts.push(`   URL: ${c.url}`);
      if (c.snippet) parts.push(`   Snippet: ${c.snippet}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const timing = result.metrics?.total_s
    ? ` in ${(result.metrics.total_s * 1000).toFixed(0)}ms`
    : "";

  return {
    content: [
      {
        type: "text" as const,
        text: `${result.summary_hint}\n\nReferences (${result.citations.length} papers${timing}):\n\n${citationList}`,
      },
    ],
  };
}

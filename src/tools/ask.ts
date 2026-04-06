import { z } from "zod";
import { askWithCitations } from "../api-client.js";

export const askResearchQuestionSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "The research question to answer. Be specific — e.g., 'What are the mechanisms of CRISPR-Cas9 off-target effects?'"
    ),
  question: z
    .string()
    .optional()
    .describe(
      "Alias for query — either works."
    ),
  difficulty: z
    .enum(["simple", "intermediate", "expert"])
    .default("intermediate")
    .describe(
      "Response complexity: 'simple' for general audience, 'intermediate' for educated readers, 'expert' for domain specialists"
    ),
  list_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Restrict search to specific research collections by their IDs. Use list_collections tool first to find IDs."
    ),
  include_literature: z
    .boolean()
    .default(true)
    .describe(
      "When searching within collections, also include broader scientific literature (default: true)"
    ),
  min_year: z.number().optional().describe("Filter papers published after this year"),
  max_year: z.number().optional().describe("Filter papers published before this year"),
});

export type AskResearchQuestionInput = z.infer<typeof askResearchQuestionSchema>;

export async function askResearchQuestion(
  apiKey: string,
  input: AskResearchQuestionInput
) {
  const queryText = input.query || input.question;
  if (!queryText) {
    return {
      content: [{ type: "text" as const, text: "Error: provide either `query` or `question`" }],
      isError: true,
    };
  }

  const filter: Record<string, unknown> = {};

  if (input.min_year || input.max_year) {
    filter.pub_year = {
      range: {
        ...(input.min_year && { min: input.min_year }),
        ...(input.max_year && { max: input.max_year }),
      },
    };
  }

  const result = await askWithCitations(apiKey, {
    query: queryText,
    difficulty: input.difficulty,
    listIds: input.list_ids,
    includeLiterature: input.include_literature,
    filter,
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

  // Format citations into a readable reference list
  const citationList = result.citations
    .map((c, i) => {
      const parts = [`[${i + 1}] ${c.title}`];
      if (c.authors) {
        const authorStr = Array.isArray(c.authors)
          ? c.authors.map((a: unknown) => (typeof a === "string" ? a : (a as Record<string, string>)?.name ?? String(a))).join(", ")
          : String(c.authors);
        if (authorStr) parts.push(`   Authors: ${authorStr}`);
      }
      if (c.year) parts.push(`   Year: ${c.year}`);
      if (c.journal) parts.push(`   Journal: ${c.journal}`);
      if (c.doi) parts.push(`   DOI: ${c.doi}`);
      if (c.fromList) parts.push(`   Source: User's research collection`);
      return parts.join("\n");
    })
    .join("\n\n");

  const followUps = result.followUpQuestions?.length
    ? `\n\n---\nSuggested follow-up questions:\n${result.followUpQuestions.map((q) => `- ${q.question}`).join("\n")}`
    : "";

  const threadInfo = result.threadId
    ? `\n\n[Thread ID: ${result.threadId} — use get_research_thread to retrieve this conversation later]`
    : "";

  return {
    content: [
      {
        type: "text" as const,
        text: `${result.answer}\n\n---\nReferences (${result.citations.length} sources${result.totalResults ? `, ${result.totalResults} total found` : ""}):\n\n${citationList}${followUps}${threadInfo}`,
      },
    ],
  };
}

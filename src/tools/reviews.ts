import { z } from "zod";
import { askWithCitations } from "../api-client.js";

export const generateLiteratureReviewInputSchema = z.object({
  query: z
    .string()
    .min(5)
    .describe("Research topic or review question"),
  difficulty: z
    .enum(["simple", "intermediate", "expert"])
    .default("intermediate")
    .describe("Response complexity for the literature review"),
  list_ids_csv: z
    .string()
    .optional()
    .describe("Optional comma-separated collection IDs to scope the review"),
  include_literature: z
    .boolean()
    .default(true)
    .describe("When list_ids are provided, also include broader literature"),
  min_year: z.number().int().optional().describe("Filter papers published after this year"),
  max_year: z.number().int().optional().describe("Filter papers published before this year"),
  format: z
    .enum(["narrative", "bullets"])
    .default("narrative")
    .describe("Preferred review format"),
});

export const generateLiteratureReviewSchema = z.object({
  query: z
    .string()
    .min(5)
    .describe("Research topic or review question"),
  difficulty: z
    .enum(["simple", "intermediate", "expert"])
    .default("intermediate")
    .describe("Response complexity for the literature review"),
  list_ids: z
    .array(z.string())
    .optional()
    .describe("Restrict review to specific collection IDs"),
  include_literature: z
    .boolean()
    .default(true)
    .describe("When list_ids are provided, also include broader literature"),
  min_year: z.number().int().optional().describe("Filter papers published after this year"),
  max_year: z.number().int().optional().describe("Filter papers published before this year"),
  format: z
    .enum(["narrative", "bullets"])
    .default("narrative")
    .describe("Preferred review format"),
});

export type GenerateLiteratureReviewInput = z.infer<typeof generateLiteratureReviewSchema>;

type GenerateLiteratureReviewRawInput = z.infer<typeof generateLiteratureReviewInputSchema>;

export function normalizeGenerateLiteratureReviewInput(
  input: GenerateLiteratureReviewRawInput
): GenerateLiteratureReviewInput {
  return generateLiteratureReviewSchema.parse({
    query: input.query,
    difficulty: input.difficulty,
    list_ids: input.list_ids_csv
      ? input.list_ids_csv
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
    include_literature: input.include_literature,
    min_year: input.min_year,
    max_year: input.max_year,
    format: input.format,
  });
}

export async function generateLiteratureReviewTool(
  apiKey: string,
  input: GenerateLiteratureReviewInput
) {
  const filter: Record<string, unknown> = {};
  if (input.min_year || input.max_year) {
    filter.pub_year = {
      range: {
        ...(input.min_year && { min: input.min_year }),
        ...(input.max_year && { max: input.max_year }),
      },
    };
  }

  const reviewPrompt =
    input.format === "bullets"
      ? `Produce a literature review in bullets on this topic: ${input.query}. Cover major themes, points of agreement, disagreements, notable methods, and open gaps.`
      : `Produce a concise literature review on this topic: ${input.query}. Cover major themes, points of agreement, disagreements, notable methods, and open gaps.`;

  try {
    const result = await askWithCitations(apiKey, {
      query: reviewPrompt,
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

    const citationList = result.citations
      .map((citation, index) => {
        const parts = [`[${index + 1}] ${citation.title}`];
        if (citation.authors?.length) parts.push(`   Authors: ${citation.authors.join(", ")}`);
        if (citation.year) parts.push(`   Year: ${citation.year}`);
        if (citation.journal) parts.push(`   Journal: ${citation.journal}`);
        if (citation.doi) parts.push(`   DOI: ${citation.doi}`);
        return parts.join("\n");
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text:
            `${result.answer}\n\n---\nReferences (${result.citations.length} sources` +
            `${result.totalResults ? `, ${result.totalResults} total found` : ""}):\n\n${citationList}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

import { z } from "zod";
import { getWorksByAuthor, searchAuthors } from "../api-client.js";

export const searchAuthorsInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Author name to search for, e.g. 'Geoffrey Hinton'"),
  orcid: z
    .string()
    .optional()
    .describe("ORCID identifier, bare or URL form"),
  openalex_id: z
    .string()
    .optional()
    .describe("OpenAlex author ID, bare or full URL form"),
  top_k: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .describe("Maximum author matches to return (1-5)"),
});

export const searchAuthorsSchema = searchAuthorsInputSchema.refine(
  (value) => Boolean(value.query || value.orcid || value.openalex_id),
  {
  message: "Provide at least one of query, orcid, or openalex_id",
  }
);

export type SearchAuthorsInput = z.infer<typeof searchAuthorsSchema>;

export async function searchAuthorsTool(apiKey: string, input: SearchAuthorsInput) {
  try {
    const result = await searchAuthors(apiKey, input);

    if (!result.authors.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No matching authors found.",
          },
        ],
      };
    }

    const formatted = result.authors
      .map((author, index) => {
        const parts = [`${index + 1}. **${author.display_name || "Unknown author"}**`];
        if (author.id) parts.push(`   ID: ${author.id}`);
        if (author.orcid) parts.push(`   ORCID: ${author.orcid}`);
        if (author.works_count !== undefined) parts.push(`   Works: ${author.works_count}`);
        if (author.cited_by_count !== undefined) parts.push(`   Citations: ${author.cited_by_count}`);
        const institution = author.last_known_institution as Record<string, unknown> | undefined;
        if (institution?.display_name) parts.push(`   Institution: ${String(institution.display_name)}`);
        return parts.join("\n");
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${result.total} author match(es):\n\n${formatted}`,
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

export const getWorksByAuthorSchema = z.object({
  author_id: z
    .string()
    .describe("OpenAlex author ID, bare or full URL"),
  size: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(10)
    .describe("Maximum number of works to return"),
  min_year: z.number().int().optional().describe("Filter works published after this year"),
  max_year: z.number().int().optional().describe("Filter works published before this year"),
  min_citations: z.number().int().optional().describe("Minimum citation count"),
  must_have_abstract: z.boolean().default(false).describe("Only return works with abstracts"),
  has_oa: z.boolean().optional().describe("Require open-access PDF availability"),
  novelty_field: z
    .enum(["content_novelty_percentile", "context_novelty_percentile"])
    .optional()
    .describe("Novelty field to filter/sort by"),
  min_novelty: z.number().int().min(0).max(100).optional(),
  max_novelty: z.number().int().min(0).max(100).optional(),
});

export type GetWorksByAuthorInput = z.infer<typeof getWorksByAuthorSchema>;

export async function getWorksByAuthorTool(apiKey: string, input: GetWorksByAuthorInput) {
  try {
    const result = await getWorksByAuthor(apiKey, input);

    if (!result.works.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No works found for this author and filter set.",
          },
        ],
      };
    }

    const formatted = result.works
      .map((work, index) => {
        const parts = [`${index + 1}. **${work.title || "Untitled"}**`];
        if (work.publication_year) parts.push(`   Year: ${work.publication_year}`);
        if (work.cited_by_count !== undefined) parts.push(`   Citations: ${work.cited_by_count}`);
        if (work.doi) parts.push(`   DOI: ${work.doi}`);
        if (work.pdf_url) parts.push(`   PDF: ${work.pdf_url}`);
        if (work.journal) parts.push(`   Journal: ${work.journal}`);
        if (work.content_novelty_percentile !== undefined) {
          parts.push(`   Content novelty: ${work.content_novelty_percentile}`);
        }
        if (work.context_novelty_percentile !== undefined) {
          parts.push(`   Context novelty: ${work.context_novelty_percentile}`);
        }
        return parts.join("\n");
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${result.total} work(s) found for author ${result.author_id}:\n\n${formatted}`,
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

import { z } from "zod";
import { lookupNoveltyScore } from "../api-client.js";

export const lookupNoveltyScoreInputSchema = z.object({
  doi: z
    .string()
    .optional()
    .describe("DOI of the publication"),
  work_id: z
    .string()
    .optional()
    .describe("OpenAlex work ID, bare or full URL"),
  include_work_metadata: z
    .boolean()
    .default(true)
    .describe("Include title and year in the response"),
});

export const lookupNoveltyScoreSchema = lookupNoveltyScoreInputSchema.refine(
  (value) => Boolean(value.doi || value.work_id),
  {
  message: "Provide at least one of doi or work_id",
  }
);

export type LookupNoveltyScoreInput = z.infer<typeof lookupNoveltyScoreSchema>;

export async function lookupNoveltyScoreTool(
  apiKey: string,
  input: LookupNoveltyScoreInput
) {
  try {
    const result = await lookupNoveltyScore(apiKey, input);
    const lines: string[] = [];

    if (result.title) lines.push(`**${result.title}**`);
    if (result.work_id) lines.push(`Work ID: ${result.work_id}`);
    if (result.doi) lines.push(`DOI: ${result.doi}`);
    if (result.publication_year) lines.push(`Year: ${result.publication_year}`);

    lines.push(
      `Content novelty percentile: ${result.content_novelty_percentile ?? "not available"}`
    );
    lines.push(
      `Context novelty percentile: ${result.context_novelty_percentile ?? "not available"}`
    );

    if (result.content_novelty_last_updated) {
      lines.push(`Content novelty updated: ${result.content_novelty_last_updated}`);
    }
    if (result.context_novelty_last_updated) {
      lines.push(`Context novelty updated: ${result.context_novelty_last_updated}`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: lines.join("\n"),
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

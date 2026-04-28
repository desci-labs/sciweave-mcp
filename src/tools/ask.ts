import { z } from "zod";
import { askWithCitations, type ProgressEvent } from "../api-client.js";

/**
 * Optional MCP progress relay. The MCP SDK gives tool handlers a
 * `sendNotification` function and may include a `progressToken` in `_meta`.
 * When both are present we forward upstream stream events as
 * `notifications/progress` messages so (a) the SSE response stream sees
 * regular traffic and stays alive past intermediary idle timeouts and
 * (b) the client can render progress to the user instead of a silent hang.
 */
export type ProgressRelay = {
  progressToken?: string | number;
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total?: number;
      message?: string;
    };
  }) => Promise<void>;
};

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
  input: AskResearchQuestionInput,
  relay?: ProgressRelay
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

  // Build the progress callback that forwards upstream stream events to the
  // MCP client. We always run a heartbeat (below) regardless of whether the
  // client provided a progressToken — the heartbeat keeps the SSE stream
  // active even when the client doesn't render the progress messages.
  const onProgress = makeProgressForwarder(relay);

  const result = await withHeartbeat(relay, () =>
    askWithCitations(apiKey, {
      query: queryText,
      difficulty: input.difficulty,
      listIds: input.list_ids,
      includeLiterature: input.include_literature,
      filter,
      onProgress,
    })
  );

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

function makeProgressForwarder(
  relay: ProgressRelay | undefined
): ((event: ProgressEvent) => void) | undefined {
  if (!relay?.sendNotification || relay.progressToken === undefined) {
    return undefined;
  }
  const token = relay.progressToken;
  const send = relay.sendNotification;
  let progress = 0;
  return (event) => {
    progress += 1;
    let message: string | undefined;
    switch (event.kind) {
      case "init":
        message = "Starting research…";
        break;
      case "citations":
        message = `Found ${event.count} citation${event.count === 1 ? "" : "s"}`;
        break;
      case "content":
        message = `Synthesising answer (${event.chars.toLocaleString()} chars)`;
        break;
      case "done":
        message = "Finalising…";
        break;
    }
    // Notifications failures must not abort the tool — swallow errors.
    void send({
      method: "notifications/progress",
      params: { progressToken: token, progress, message },
    }).catch(() => {});
  };
}

/**
 * Run `work` and emit a heartbeat notification every 10s until it settles.
 * Even when the client did not provide a progressToken the helper is a no-op,
 * so callers don't need to branch on relay presence.
 */
async function withHeartbeat<T>(
  relay: ProgressRelay | undefined,
  work: () => Promise<T>
): Promise<T> {
  if (!relay?.sendNotification || relay.progressToken === undefined) {
    return work();
  }
  const token = relay.progressToken;
  const send = relay.sendNotification;
  let beat = 0;
  const timer = setInterval(() => {
    beat += 1;
    void send({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress: beat,
        message: `Still working… (${beat * 10}s)`,
      },
    }).catch(() => {});
  }, 10_000);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

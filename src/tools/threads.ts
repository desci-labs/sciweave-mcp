import { z } from "zod";
import { getThread, trackUsage } from "../api-client.js";

export const getResearchThreadSchema = z.object({
  thread_id: z
    .string()
    .describe(
      "The UUID of a previous research thread. Returned by ask_research_question as Thread ID."
    ),
});

export type GetResearchThreadInput = z.infer<typeof getResearchThreadSchema>;

export async function getResearchThread(
  apiKey: string,
  input: GetResearchThreadInput
) {
  const tracked = await trackUsage(apiKey, "get_research_thread");
  if (!tracked.ok) {
    return {
      content: [
        { type: "text" as const, text: `Error: ${tracked.error ?? "Usage tracking failed"}` },
      ],
      isError: true,
    };
  }

  const thread = await getThread(apiKey, input.thread_id);

  const messages: string[] = [];

  // Format the root message
  if (thread.query && thread.response_data?.length) {
    messages.push(`**Q: ${thread.query}**`);
    for (const resp of thread.response_data) {
      messages.push(resp.answer);
      if (resp.citations?.length) {
        messages.push(
          `\n_${resp.citations.length} citation(s) — ${resp.citations.map((c) => c.title).join("; ")}_`
        );
      }
    }
  }

  // Format thread messages (follow-ups)
  if (thread.thread_messages?.length) {
    for (const msg of thread.thread_messages) {
      messages.push(`\n---\n**Q: ${msg.query}**`);
      for (const resp of msg.response_data) {
        messages.push(resp.answer);
        if (resp.citations?.length) {
          messages.push(
            `\n_${resp.citations.length} citation(s) — ${resp.citations.map((c) => c.title).join("; ")}_`
          );
        }
      }
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text:
          messages.length > 0
            ? `Research thread ${input.thread_id}:\n\n${messages.join("\n\n")}`
            : "Thread not found or empty.",
      },
    ],
  };
}

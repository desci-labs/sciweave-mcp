/**
 * Coverage for ask_research_question's SSE aggregation and progress relay.
 *
 * Added when the heartbeat/relay helpers moved out of tools/ask.ts into
 * progress.ts — this pins the behaviour that refactor had to preserve.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { askResearchQuestion, askResearchQuestionSchema } from "./tools/ask.js";

/** Build a Response that streams the given SSE lines, as the ML backend does. */
function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const STREAM = [
  `event: init\ndata: {"threadId":"thread-123","searchId":"search-9"}\n\n`,
  `event: citations\ndata: [{"id":"c1","title":"A Cited Paper","authors":["R. Franklin"],"year":2021,"doi":"10.1234/abc"}]\n\n`,
  `event: content\ndata: "Gene editing "\n\n`,
  `event: content\ndata: "works as follows."\n\n`,
  `event: followUpQuestions\ndata: [{"label":"more","question":"What about delivery?"}]\n\n`,
];

describe("askResearchQuestion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aggregates the SSE stream into an answer with citations", async () => {
    vi.stubGlobal("fetch", vi.fn(async (..._args: any[]) => sseResponse(STREAM)));

    const res: any = await askResearchQuestion(
      "key",
      askResearchQuestionSchema.parse({ query: "How does gene editing work?" })
    );

    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("Gene editing works as follows.");
    expect(text).toContain("[1] A Cited Paper");
    expect(text).toContain("DOI: 10.1234/abc");
    expect(text).toContain("What about delivery?");
    expect(text).toContain("Thread ID: thread-123");
  });

  it("forwards stream events as progress notifications", async () => {
    vi.stubGlobal("fetch", vi.fn(async (..._args: any[]) => sseResponse(STREAM)));

    const sent: string[] = [];
    await askResearchQuestion(
      "key",
      askResearchQuestionSchema.parse({ query: "test" }),
      {
        progressToken: "tok",
        sendNotification: async (n) => {
          sent.push(n.params.message ?? "");
        },
      }
    );

    expect(sent.some((m) => m.includes("Starting research"))).toBe(true);
    expect(sent.some((m) => m.includes("Found 1 citation"))).toBe(true);
  });

  it("works without a progress relay", async () => {
    vi.stubGlobal("fetch", vi.fn(async (..._args: any[]) => sseResponse(STREAM)));

    const res: any = await askResearchQuestion(
      "key",
      askResearchQuestionSchema.parse({ query: "test" })
    );
    expect(res.content[0].text).toContain("Gene editing works as follows.");
  });

  it("requires a question", async () => {
    const res: any = await askResearchQuestion("key", askResearchQuestionSchema.parse({}));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("provide either `query` or `question`");
  });
});

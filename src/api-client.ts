/**
 * SciWeave API Client
 *
 * Thin proxy layer — all business logic stays in the existing SciWeave APIs.
 * This client just forwards requests with the user's API key.
 */

import type {
  AnswerResult,
  ResearchList,
  Paper,
  ThreadResult,
  Citation,
  FollowUpQuestion,
} from "./types.js";

/** Base URLs configured via environment variables */
const ML_BACKEND_URL =
  process.env.SCIWEAVE_ML_BACKEND_URL || "https://nodes-api.desci.com";
const WEB_API_URL =
  process.env.SCIWEAVE_WEB_API_URL || "https://sciweave.com";

/** Auth headers for sciweave-web API (sk-live_ keys via Bearer token) */
function webAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/** Auth headers for ML backend (api-key header) */
function mlAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Research Lists (proxied through sciweave-web Next.js API)
// ---------------------------------------------------------------------------

export async function listCollections(
  apiKey: string
): Promise<ResearchList[]> {
  const res = await fetch(`${WEB_API_URL}/api/lists`, {
    headers: webAuthHeaders(apiKey),
  });
  if (!res.ok) {
    throw new Error(`Failed to list collections: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? [];
}

export async function getCollectionPapers(
  apiKey: string,
  listId: string
): Promise<Paper[]> {
  const res = await fetch(`${WEB_API_URL}/api/lists/${listId}/papers`, {
    headers: webAuthHeaders(apiKey),
  });
  if (!res.ok) {
    throw new Error(`Failed to get papers: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Research Thread History (proxied through ML backend)
// ---------------------------------------------------------------------------

export async function getThread(
  apiKey: string,
  threadId: string
): Promise<ThreadResult> {
  const res = await fetch(
    `${ML_BACKEND_URL}/api/semantic-result/${threadId}`,
    { headers: mlAuthHeaders(apiKey) }
  );
  if (!res.ok) {
    throw new Error(`Failed to get thread: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Answer with Citations (ML backend, SSE stream → aggregated result)
// ---------------------------------------------------------------------------

export async function askWithCitations(
  apiKey: string,
  opts: {
    query: string;
    difficulty?: string;
    listIds?: string[];
    includeLiterature?: boolean;
    filter?: Record<string, unknown>;
  }
): Promise<AnswerResult> {
  const body: Record<string, unknown> = {
    query: opts.query,
    difficulty: opts.difficulty ?? "intermediate",
    modelPreference: "openai",
    forceUnlimited: false,
    device_id: "mcp_connector",
    device_info: { source: "claude_mcp_connector", platform: "mcp" },
    app_version: { version: "1.0.0", platform: "mcp" },
  };

  if (opts.listIds?.length) {
    body.list_scope = {
      list_ids: opts.listIds,
      include_literature: opts.includeLiterature ?? true,
    };
  }

  if (opts.filter && Object.keys(opts.filter).length > 0) {
    body.filter = opts.filter;
  }

  const res = await fetch(`${ML_BACKEND_URL}/api/answer-with-citations`, {
    method: "POST",
    headers: mlAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Answer request failed: ${res.status} ${res.statusText} — ${text}`
    );
  }

  return consumeSSEStream(res);
}

// ---------------------------------------------------------------------------
// SSE Stream Consumer
// ---------------------------------------------------------------------------

/**
 * Consumes the SSE stream from the ML backend and aggregates into a single
 * AnswerResult. This is the key translation layer — the ML backend streams
 * events, but MCP tools return a single result.
 */
async function consumeSSEStream(response: Response): Promise<AnswerResult> {
  const result: AnswerResult = {
    answer: "",
    citations: [],
    followUpQuestions: [],
  };

  const body = response.body;
  if (!body) {
    return result;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      let currentEvent = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            switch (currentEvent) {
              case "content":
                result.answer += parsed.content ?? parsed ?? "";
                break;
              case "citations":
                if (Array.isArray(parsed)) {
                  result.citations = parsed as Citation[];
                }
                break;
              case "totalResults":
                result.totalResults = parsed as number;
                break;
              case "followUpQuestions":
                if (Array.isArray(parsed)) {
                  result.followUpQuestions = parsed as FollowUpQuestion[];
                }
                break;
              case "init":
                result.threadId = parsed.threadId;
                result.searchId = parsed.searchId;
                break;
              case "error":
                result.error = parsed.message ?? String(parsed);
                break;
              default:
                // For events without explicit type, check if it's a stream_event
                if (parsed.content) {
                  result.answer += parsed.content;
                }
                if (parsed.citations) {
                  result.citations = parsed.citations;
                }
                if (parsed.threadId) {
                  result.threadId = parsed.threadId;
                }
                if (parsed.followUpQuestions) {
                  result.followUpQuestions = parsed.followUpQuestions;
                }
                break;
            }
          } catch {
            // Non-JSON data line — might be a raw content chunk
            if (currentEvent === "content" || currentEvent === "answer") {
              result.answer += data;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

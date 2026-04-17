/**
 * SciWeave API Client
 *
 * Thin proxy layer — all business logic stays in the existing SciWeave APIs.
 * This client just forwards requests with the user's API key.
 */

import type {
  AccountStatus,
  AnswerResult,
  ResearchList,
  Paper,
  ThreadResult,
  Citation,
  FollowUpQuestion,
  FindReferencesResult,
} from "./types.js";

/**
 * Base URL for the sciweave-web API. This is the *only* backend the MCP talks to —
 * sciweave-web proxies through to ml-sciweave-backend internally with server-side
 * credentials. The MCP must not call ml-sciweave-backend directly because the ML
 * backend doesn't recognize `sciweave_live_` API keys (only sciweave-web does).
 */
const WEB_API_URL =
  process.env.SCIWEAVE_WEB_API_URL || "https://sciweave.com";

/** Auth headers for sciweave-web API (sciweave_live_ keys via Bearer token) */
function webAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

const PRICING_URL = "https://sciweave.com/pricing";
const TOP_UP_URL = "https://sciweave.com/settings?tab=api-access";

/**
 * Error thrown when API returns 402 — insufficient credits.
 * Tools catch this to return a friendly upgrade message instead of a raw error.
 */
export class InsufficientCreditsError extends Error {
  constructor(balance: number = 0) {
    super(
      `You're out of SciWeave credits (balance: ${balance}). ` +
      `Purchase more at ${TOP_UP_URL} — view pricing at ${PRICING_URL}`
    );
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Check a fetch response for 402 and throw InsufficientCreditsError.
 * Call this before other status checks in API functions.
 */
function check402(res: Response): void {
  if (res.status === 402) {
    throw new InsufficientCreditsError();
  }
}

// ---------------------------------------------------------------------------
// Account Status
// ---------------------------------------------------------------------------

export async function getAccountStatus(
  apiKey: string
): Promise<AccountStatus> {
  try {
    const res = await fetch(`${WEB_API_URL}/api/v1/validate-key`, {
      method: "POST",
      headers: webAuthHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) {
      return { balance: 0, error: "Invalid API key.", pricingUrl: PRICING_URL, topUpUrl: TOP_UP_URL };
    }

    const body = await res.json().catch(() => ({}));

    return {
      balance: body.balance ?? 0,
      userId: body.userId,
      pricingUrl: PRICING_URL,
      topUpUrl: TOP_UP_URL,
    };
  } catch (err) {
    return {
      balance: 0,
      error: `Could not fetch account status: ${err instanceof Error ? err.message : String(err)}`,
      pricingUrl: PRICING_URL,
      topUpUrl: TOP_UP_URL,
    };
  }
}

// ---------------------------------------------------------------------------
// Research Lists (proxied through sciweave-web Next.js API)
// ---------------------------------------------------------------------------

export async function listCollections(
  apiKey: string
): Promise<ResearchList[]> {
  const res = await fetch(`${WEB_API_URL}/api/lists`, {
    headers: webAuthHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  });
  check402(res);
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
  const res = await fetch(
    `${WEB_API_URL}/api/lists/${encodeURIComponent(listId)}/papers`,
    {
      headers: webAuthHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    }
  );
  check402(res);
  if (!res.ok) {
    throw new Error(`Failed to get papers: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Research Thread History (proxied through sciweave-web → ml-backend)
// ---------------------------------------------------------------------------

export async function getThread(
  apiKey: string,
  threadId: string
): Promise<ThreadResult> {
  const res = await fetch(
    `${WEB_API_URL}/api/semantic-result/${encodeURIComponent(threadId)}`,
    {
      headers: webAuthHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    }
  );
  check402(res);
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

  const res = await fetch(`${WEB_API_URL}/api/answer-with-citations`, {
    method: "POST",
    headers: webAuthHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000), // 2 min cap for SSE streams
  });

  check402(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Answer request failed: ${res.status} ${res.statusText} — ${text}`
    );
  }

  return consumeSSEStream(res);
}

// ---------------------------------------------------------------------------
// Find References (fast citations-only, no LLM answer generation)
// ---------------------------------------------------------------------------

export async function findReferences(
  apiKey: string,
  opts: {
    query: string;
    top_k?: number;
  }
): Promise<FindReferencesResult> {
  // Routed through sciweave-web; the proxy adds the api_key and forwards to
  // ml-sciweave-backend with server-side credentials.
  const body = {
    query: opts.query,
    top_k: opts.top_k ?? 5,
    device_id: "mcp_connector",
  };

  const res = await fetch(`${WEB_API_URL}/api/answer-citations-only`, {
    method: "POST",
    headers: webAuthHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  check402(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      citations: [],
      summary_hint: "",
      query_en: opts.query,
      metrics: {},
      search_id: "",
      error: `Request failed: ${res.status} ${res.statusText} — ${text}`,
    };
  }

  return res.json();
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
                if (typeof parsed === "string") {
                  result.answer += parsed;
                } else if (parsed?.content && typeof parsed.content === "string") {
                  result.answer += parsed.content;
                }
                // Skip non-string content events (e.g., metadata objects)
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
                if (parsed.content && typeof parsed.content === "string") {
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

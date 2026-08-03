/**
 * Tests for trackUsage() + tool wrappers calling it.
 *
 * trackUsage is what unifies MCP metering: every tool wrapper calls it
 * before doing the actual work, so every MCP tool invocation lands in
 * credit_transactions with endpoint label `mcp:<tool>`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { trackUsage } from "./api-client.js";

const WEB_API_URL = "https://sciweave.com";
const TRACK_URL = `${WEB_API_URL}/api/v1/track-usage`;

describe("trackUsage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /api/v1/track-usage with Bearer auth + tool name", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await trackUsage("sciweave_live_abc", "find_references");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(TRACK_URL);
    expect(init.method).toBe("POST");

    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sciweave_live_abc");
    expect(headers.get("content-type")).toBe("application/json");

    expect(JSON.parse(init.body)).toEqual({ tool: "find_references" });
  });

  it("passes an AbortSignal timeout so the call can't hang forever", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await trackUsage("key", "find_references");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns { ok: true } on 200", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, userId: "u@e.com" }), {
        status: 200,
      })
    );

    const result = await trackUsage("key", "list_collections");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns { ok: false, error } on 402 insufficient credits", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error:
            "Insufficient credits. Top up at https://sciweave.com/settings?tab=api-access",
        }),
        { status: 402 }
      )
    );

    const result = await trackUsage("key", "get_thread");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/insufficient credits/i);
  });

  it("returns { ok: false, error } on 401", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Invalid API key" }), {
        status: 401,
      })
    );

    const result = await trackUsage("bad_key", "find_references");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });

  it("returns { ok: false, error } on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const result = await trackUsage("key", "find_references");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/track/i);
  });
});

describe("tool wrappers call trackUsage before doing work", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("findReferencesTool: short-circuits with error when trackUsage returns 402", async () => {
    const { findReferencesTool } = await import("./tools/references.js");

    // trackUsage call → 402, never reach the actual ML backend
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, error: "Insufficient credits" }),
        { status: 402 }
      )
    );

    const result = await findReferencesTool("key", {
      query: "quantum computing",
      top_k: 3,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/insufficient credits/i);

    // trackUsage was the ONLY call — we never hit the ML backend
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/track-usage");
  });

  it("findReferencesTool: calls trackUsage BEFORE ML backend", async () => {
    const { findReferencesTool } = await import("./tools/references.js");

    // First call = trackUsage (ok), second = ML backend
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            citations: [],
            summary_hint: "",
            query_en: "q",
            metrics: {},
            search_id: "s1",
          }),
          { status: 200 }
        )
      );

    await findReferencesTool("key", { query: "q", top_k: 3 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call MUST be track-usage
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/track-usage");
  });
});

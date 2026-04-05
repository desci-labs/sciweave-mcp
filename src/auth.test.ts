/**
 * Tests for API key validation.
 *
 * The MCP server USED to validate keys by POSTing to /api/v1/search with a
 * dummy query — but that endpoint deducts a credit, so every MCP tool call
 * was burning credits just for auth.
 *
 * These tests pin the new behavior: validateApiKey hits a dedicated
 * /api/v1/validate-key endpoint that does NOT deduct credits.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateApiKey } from "./auth.js";

const WEB_API_URL = "https://sciweave.com";
const VALIDATE_URL = `${WEB_API_URL}/api/v1/validate-key`;
const SEARCH_URL = `${WEB_API_URL}/api/v1/search`;

describe("validateApiKey", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hits /api/v1/validate-key (NOT /api/v1/search) — no credit burn", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true, balance: 50 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await validateApiKey("sciweave_live_abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(VALIDATE_URL);
    expect(url).not.toBe(SEARCH_URL);
  });

  it("passes an AbortSignal timeout so the call can't hang forever", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true, balance: 10 }), { status: 200 })
    );

    await validateApiKey("sciweave_live_xyz");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the key as Bearer in the Authorization header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true, balance: 10 }), { status: 200 })
    );

    await validateApiKey("sciweave_live_xyz");

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sciweave_live_xyz");
    expect(init.method).toBe("POST");
  });

  it("returns { valid: true } on 200", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true, balance: 25 }), { status: 200 })
    );

    const result = await validateApiKey("sciweave_live_good");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns { valid: false, error } on 401", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: false, error: "Invalid API key" }), {
        status: 401,
      })
    );

    const result = await validateApiKey("sciweave_live_bad");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });

  it("returns { valid: false } with top-up error on 402 (zero balance)", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          valid: false,
          balance: 0,
          error: "Insufficient credits. Top up at https://sciweave.com/settings?tab=api-access",
        }),
        { status: 402 }
      )
    );

    const result = await validateApiKey("sciweave_live_broke");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/insufficient credits/i);
    expect(result.error).toMatch(/sciweave\.com/i);
  });

  it("returns { valid: false } on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await validateApiKey("sciweave_live_anything");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/auth service/i);
  });
});

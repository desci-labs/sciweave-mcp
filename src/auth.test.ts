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
      new Response(
        JSON.stringify({ valid: true, userId: "alice@example.com", balance: 25 }),
        { status: 200 }
      )
    );

    const result = await validateApiKey("sciweave_live_good");
    expect(result.valid).toBe(true);
    expect(result.userId).toBe("alice@example.com");
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

  it("fails closed when 200 body has valid:true but no userId", async () => {
    // A malformed success payload (e.g. partial deploy, middleware
    // rewrite) must not let an unidentified caller through the auth gate.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true }), { status: 200 })
    );

    const result = await validateApiKey("sciweave_live_x");
    expect(result.valid).toBe(false);
  });

  it("fails closed when 200 body has valid:true but empty userId", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: true, userId: "   " }), { status: 200 })
    );

    const result = await validateApiKey("sciweave_live_x");
    expect(result.valid).toBe(false);
  });

  it("fails closed when 200 body has valid:'true' (string, not boolean)", async () => {
    // Truthy !== literal true. Strict check prevents type-coercion slip-ups.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ valid: "true", userId: "a@b.com" }), {
        status: 200,
      })
    );

    const result = await validateApiKey("sciweave_live_x");
    expect(result.valid).toBe(false);
  });

  it("does NOT leak raw backend error strings on 5xx", async () => {
    // Backend returns an internal error message that could leak infra details.
    // MCP clients should see a generic "Auth service unavailable" instead.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          valid: false,
          error: "Postgres connection pool exhausted: db-primary-1.internal:5432",
        }),
        { status: 500 }
      )
    );

    const result = await validateApiKey("sciweave_live_anything");
    expect(result.valid).toBe(false);
    expect(result.error).not.toContain("Postgres");
    expect(result.error).not.toContain("internal");
    expect(result.error).toMatch(/auth service unavailable/i);
  });

  it("returns { valid: false } on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await validateApiKey("sciweave_live_anything");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/auth service/i);
  });
});

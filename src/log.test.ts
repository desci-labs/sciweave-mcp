/**
 * Tests for the structured logger.
 *
 * Two things matter here:
 *  1. Output is single-line JSON so Vercel ingests it as a queryable event.
 *  2. The redaction helpers (requestContext, redirectOrigin) never leak
 *     secrets even when fed attacker-shaped inputs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logEvent, requestContext, redirectOrigin } from "./log.js";

describe("logEvent", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("writes a single JSON line to console.log by default", () => {
    logEvent({ event: "test_event", foo: 1 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("test_event");
    expect(parsed.foo).toBe(1);
    expect(typeof parsed.ts).toBe("string");
  });

  it("routes warn level to console.warn", () => {
    logEvent({ event: "maybe_bad", level: "warn" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("routes error level to console.error", () => {
    logEvent({ event: "bad", level: "error" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("does not emit the `level` field in the payload (it's routing metadata)", () => {
    logEvent({ event: "x", level: "warn", foo: "bar" });
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBeUndefined();
    expect(parsed.foo).toBe("bar");
  });

  it("emits exactly one line per call (no newlines in the payload)", () => {
    logEvent({ event: "x", note: "multi\nline" });
    const line = logSpy.mock.calls[0][0] as string;
    // JSON.stringify escapes newlines inside strings, so the wire format
    // is guaranteed single-line even when data contains newlines.
    expect(line.split("\n")).toHaveLength(1);
  });
});

describe("requestContext", () => {
  it("extracts host and user-agent", () => {
    expect(
      requestContext({ headers: { host: "mcp.sciweave.com", "user-agent": "claude-code/1.0" } }),
    ).toEqual({ host: "mcp.sciweave.com", ua: "claude-code/1.0" });
  });

  it("handles missing headers", () => {
    expect(requestContext({ headers: {} })).toEqual({ host: undefined, ua: undefined });
  });

  it("flattens array-valued headers to the first entry", () => {
    expect(
      requestContext({
        headers: { host: ["a", "b"], "user-agent": ["ua-a", "ua-b"] },
      }),
    ).toEqual({ host: "a", ua: "ua-a" });
  });

  it("never picks up the authorization header (not in the returned keys)", () => {
    const ctx = requestContext({
      headers: {
        host: "x",
        authorization: "Bearer secret",
      },
    });
    // Spread test: serializing ctx must not contain "secret".
    expect(JSON.stringify(ctx)).not.toContain("secret");
    expect(JSON.stringify(ctx)).not.toContain("Bearer");
  });
});

describe("redirectOrigin", () => {
  it("returns just the origin for well-formed URIs (no path, no query)", () => {
    expect(redirectOrigin("http://localhost:46335/callback?code=abc&state=xyz"))
      .toBe("http://localhost:46335");
    expect(redirectOrigin("https://claude.ai/api/callback?secret=sekrit"))
      .toBe("https://claude.ai");
  });

  it("returns <missing> for missing / empty inputs", () => {
    expect(redirectOrigin(undefined)).toBe("<missing>");
    expect(redirectOrigin("")).toBe("<missing>");
    expect(redirectOrigin(null)).toBe("<missing>");
  });

  it("returns <unparseable> for malformed URIs (no throw)", () => {
    expect(redirectOrigin("not a url")).toBe("<unparseable>");
    expect(redirectOrigin("http://")).toBe("<unparseable>");
  });

  it("never includes query strings or paths in output (secret redaction)", () => {
    const origin = redirectOrigin("http://localhost:1/callback?code_verifier=supersecret");
    expect(origin).not.toContain("code_verifier");
    expect(origin).not.toContain("supersecret");
    expect(origin).not.toContain("/callback");
  });
});

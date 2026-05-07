/**
 * Tests for the OAuth redirect_uri allowlist.
 *
 * Prior bug: a hardcoded "http://localhost:6274" allowlist rejected every
 * Claude Code user because Claude Code binds to an ephemeral loopback port
 * per auth request (46335, 53076, etc. — not 6274, which is MCP Inspector).
 * These tests pin the current behavior: accept loopback with ANY port
 * (RFC 8252 §7.3), plus the known hosted client origins.
 */
import { describe, it, expect, afterEach } from "vitest";
import { isRedirectUriAllowed } from "./redirect-uri.js";

describe("isRedirectUriAllowed", () => {
  afterEach(() => {
    delete process.env.EXTRA_REDIRECT_ORIGINS;
  });

  describe("loopback (RFC 8252)", () => {
    it("accepts any port on http://localhost", () => {
      expect(isRedirectUriAllowed("http://localhost:46335/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:53076/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:6274/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:1/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:65535/callback")).toBe(true);
    });

    it("accepts any port on http://127.0.0.1", () => {
      expect(isRedirectUriAllowed("http://127.0.0.1:5678/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://127.0.0.1:8080/oauth/callback")).toBe(true);
    });

    it("accepts http://[::1] (IPv6 loopback)", () => {
      expect(isRedirectUriAllowed("http://[::1]:3000/callback")).toBe(true);
    });

    it("accepts loopback with any path (clients vary)", () => {
      expect(isRedirectUriAllowed("http://localhost:8080/")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:8080/oauth/callback")).toBe(true);
      expect(isRedirectUriAllowed("http://localhost:8080/cb")).toBe(true);
    });

    it("rejects https on loopback (the spec mandates http for native apps)", () => {
      // Not strictly wrong — but our current scope is http-loopback.
      // If a client uses https-loopback we can revisit.
      expect(isRedirectUriAllowed("https://localhost:3000/callback")).toBe(false);
    });

    it("rejects hostnames that merely START with 'localhost'", () => {
      // Subdomain-takeover style attack: DNS-resolving an attacker-controlled
      // host to a name that begins with "localhost" must not be accepted.
      expect(isRedirectUriAllowed("http://localhost.evil.com/callback")).toBe(false);
      expect(isRedirectUriAllowed("http://127.0.0.1.evil.com/callback")).toBe(false);
    });
  });

  describe("hosted clients", () => {
    it("accepts https://claude.ai", () => {
      expect(isRedirectUriAllowed("https://claude.ai/api/mcp/callback")).toBe(true);
    });

    it("accepts https://claude.com", () => {
      expect(isRedirectUriAllowed("https://claude.com/api/callback")).toBe(true);
    });

    it("accepts https://smithery.run (Smithery introspector + install flow)", () => {
      expect(isRedirectUriAllowed("https://smithery.run/oauth/callback")).toBe(true);
    });

    it("rejects http (unencrypted) for hosted origins", () => {
      expect(isRedirectUriAllowed("http://claude.ai/callback")).toBe(false);
      expect(isRedirectUriAllowed("http://smithery.run/oauth/callback")).toBe(false);
    });

    it("rejects subdomain spoofing of hosted origins", () => {
      expect(isRedirectUriAllowed("https://claude.ai.evil.com/callback")).toBe(false);
      expect(isRedirectUriAllowed("https://evil.claude.ai/callback")).toBe(false);
      expect(isRedirectUriAllowed("https://smithery.run.evil.com/cb")).toBe(false);
      expect(isRedirectUriAllowed("https://evil.smithery.run/cb")).toBe(false);
    });
  });

  describe("rejections", () => {
    it("rejects unknown origins", () => {
      expect(isRedirectUriAllowed("http://evil.com/callback")).toBe(false);
      expect(isRedirectUriAllowed("https://attacker.example/cb")).toBe(false);
    });

    it("rejects non-http schemes", () => {
      expect(isRedirectUriAllowed("javascript:alert(1)")).toBe(false);
      expect(isRedirectUriAllowed("file:///etc/passwd")).toBe(false);
      expect(isRedirectUriAllowed("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(isRedirectUriAllowed("not-a-url")).toBe(false);
      expect(isRedirectUriAllowed("")).toBe(false);
      expect(isRedirectUriAllowed("http://")).toBe(false);
    });
  });

  describe("EXTRA_REDIRECT_ORIGINS", () => {
    it("accepts a single origin from env", () => {
      process.env.EXTRA_REDIRECT_ORIGINS = "https://staging.example.com";
      expect(
        isRedirectUriAllowed("https://staging.example.com/callback"),
      ).toBe(true);
    });

    it("accepts multiple comma-separated origins", () => {
      process.env.EXTRA_REDIRECT_ORIGINS =
        "https://staging.example.com,https://preview.example.com";
      expect(
        isRedirectUriAllowed("https://staging.example.com/cb"),
      ).toBe(true);
      expect(
        isRedirectUriAllowed("https://preview.example.com/cb"),
      ).toBe(true);
    });

    it("trims whitespace in env values", () => {
      process.env.EXTRA_REDIRECT_ORIGINS =
        "  https://staging.example.com  ,  https://preview.example.com  ";
      expect(
        isRedirectUriAllowed("https://staging.example.com/cb"),
      ).toBe(true);
    });

    it("still rejects origins not listed in env", () => {
      process.env.EXTRA_REDIRECT_ORIGINS = "https://staging.example.com";
      expect(isRedirectUriAllowed("https://evil.com/cb")).toBe(false);
    });
  });
});

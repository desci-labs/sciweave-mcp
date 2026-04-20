/**
 * Tests for OAuth auth-code encoding, decoding, and PKCE verification.
 *
 * Prior behavior: the server advertised code_challenge_methods_supported:
 * ["S256"] in OAuth metadata but never actually verified code_verifier at
 * the token endpoint. That's both a spec violation (MCP mandates PKCE)
 * and a real hole — any process that intercepts the loopback redirect
 * can exchange the auth code without the originating verifier.
 *
 * These tests pin the current behavior: PKCE S256 is enforced end-to-end.
 */
import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import {
  encodeAuthCode,
  decodeAuthCode,
  verifyPkce,
  generateClientId,
  assertSigningSecretIsSet,
} from "./oauth.js";

function makeVerifier(): string {
  // 43-char minimum per RFC 7636
  return "a".repeat(43);
}

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

describe("encodeAuthCode / decodeAuthCode", () => {
  it("round-trips the API key and PKCE challenge", () => {
    const key = "sciweave_live_abc123";
    const challenge = challengeFor(makeVerifier());
    const code = encodeAuthCode(key, challenge, "S256");

    const decoded = decodeAuthCode(code);
    expect(decoded).not.toBeNull();
    expect(decoded!.apiKey).toBe(key);
    expect(decoded!.codeChallenge).toBe(challenge);
    expect(decoded!.codeChallengeMethod).toBe("S256");
  });

  it("rejects a tampered payload", () => {
    const code = encodeAuthCode("k", challengeFor(makeVerifier()), "S256");
    const [encoded, sig] = code.split(".");
    // Flip a bit in the payload — signature should no longer match.
    const tamperedEncoded = encoded.slice(0, -1) + (encoded.slice(-1) === "A" ? "B" : "A");
    expect(decodeAuthCode(`${tamperedEncoded}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const code = encodeAuthCode("k", challengeFor(makeVerifier()), "S256");
    const [encoded, sig] = code.split(".");
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
    expect(decodeAuthCode(`${encoded}.${tamperedSig}`)).toBeNull();
  });

  it("rejects a code with missing dot separator", () => {
    expect(decodeAuthCode("no-dot-here")).toBeNull();
    expect(decodeAuthCode("")).toBeNull();
  });

  it("rejects an expired code", () => {
    const code = encodeAuthCode(
      "k",
      challengeFor(makeVerifier()),
      "S256",
      -1000, // already expired
    );
    expect(decodeAuthCode(code)).toBeNull();
  });

  it("rejects a code whose payload lacks PKCE fields (spec drift)", () => {
    // Build a legacy-shaped payload by hand — this is what pre-PKCE codes
    // look like. Even with a valid HMAC, the decoder must refuse codes
    // missing cc/ccm because we can't PKCE-verify them.
    const secret = process.env.OAUTH_SIGNING_SECRET || "sciweave-mcp-oauth-default-secret";
    const legacyPayload = JSON.stringify({ key: "k", exp: Date.now() + 60_000 });
    const encoded = Buffer.from(legacyPayload).toString("base64url");
    const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
    expect(decodeAuthCode(`${encoded}.${sig}`)).toBeNull();
  });
});

describe("verifyPkce", () => {
  it("accepts a matching verifier (S256)", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // RFC 7636 example
    const challenge = challengeFor(verifier);
    expect(verifyPkce(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects a non-matching verifier", () => {
    const verifier = makeVerifier();
    const wrongChallenge = challengeFor("b".repeat(43));
    expect(verifyPkce(verifier, wrongChallenge, "S256")).toBe(false);
  });

  it("rejects an empty or missing verifier", () => {
    const challenge = challengeFor(makeVerifier());
    expect(verifyPkce("", challenge, "S256")).toBe(false);
    // @ts-expect-error — deliberately passing a non-string
    expect(verifyPkce(undefined, challenge, "S256")).toBe(false);
  });

  it("rejects verifiers shorter than RFC 7636's 43-char minimum", () => {
    const tooShort = "a".repeat(42);
    const challenge = challengeFor(tooShort);
    // Even though the challenge was derived correctly, the verifier is
    // below the RFC floor — fail up-front.
    expect(verifyPkce(tooShort, challenge, "S256")).toBe(false);
  });

  it("rejects verifiers longer than RFC 7636's 128-char maximum", () => {
    const tooLong = "a".repeat(129);
    const challenge = challengeFor(tooLong);
    expect(verifyPkce(tooLong, challenge, "S256")).toBe(false);
  });

  it("refuses plain method (MCP mandates S256)", () => {
    const verifier = makeVerifier();
    // @ts-expect-error — "plain" isn't in the CodeChallengeMethod type
    expect(verifyPkce(verifier, verifier, "plain")).toBe(false);
  });
});

describe("end-to-end authorize→token PKCE", () => {
  it("valid verifier unlocks the stored API key", () => {
    const key = "sciweave_live_e2e";
    const verifier = "verifier-" + "x".repeat(34);
    const challenge = challengeFor(verifier);

    const code = encodeAuthCode(key, challenge, "S256");
    const decoded = decodeAuthCode(code);
    expect(decoded).not.toBeNull();
    expect(verifyPkce(verifier, decoded!.codeChallenge, decoded!.codeChallengeMethod)).toBe(true);
    expect(decoded!.apiKey).toBe(key);
  });

  it("wrong verifier does NOT unlock the API key", () => {
    const key = "sciweave_live_secret";
    const verifier = "right-verifier-" + "x".repeat(28);
    const challenge = challengeFor(verifier);

    const code = encodeAuthCode(key, challenge, "S256");
    const decoded = decodeAuthCode(code);
    expect(decoded).not.toBeNull();

    // Attacker intercepted the code but doesn't have the verifier.
    const attackerGuess = "wrong-verifier-" + "y".repeat(28);
    expect(
      verifyPkce(attackerGuess, decoded!.codeChallenge, decoded!.codeChallengeMethod),
    ).toBe(false);
  });
});

describe("assertSigningSecretIsSet", () => {
  it("throws when VERCEL_ENV=production and OAUTH_SIGNING_SECRET is unset", () => {
    expect(() =>
      assertSigningSecretIsSet({ VERCEL_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow(/OAUTH_SIGNING_SECRET must be set in production/);
  });

  it("throws when VERCEL_ENV=production and secret equals the hardcoded default", () => {
    expect(() =>
      assertSigningSecretIsSet({
        VERCEL_ENV: "production",
        OAUTH_SIGNING_SECRET: "sciweave-mcp-oauth-default-secret",
      } as NodeJS.ProcessEnv),
    ).toThrow(/OAUTH_SIGNING_SECRET must be set/);
  });

  it("does NOT throw in production when a real secret is set", () => {
    expect(() =>
      assertSigningSecretIsSet({
        VERCEL_ENV: "production",
        OAUTH_SIGNING_SECRET: "b".repeat(64),
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("does NOT throw in preview even with default secret", () => {
    expect(() =>
      assertSigningSecretIsSet({ VERCEL_ENV: "preview" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("does NOT throw in development (VERCEL_ENV unset, local dev)", () => {
    expect(() => assertSigningSecretIsSet({} as NodeJS.ProcessEnv)).not.toThrow();
  });
});

describe("generateClientId", () => {
  it("returns a sciweave_ prefixed hex token", () => {
    const id = generateClientId();
    expect(id).toMatch(/^sciweave_[0-9a-f]{32}$/);
  });

  it("returns a fresh id on each call", () => {
    const a = generateClientId();
    const b = generateClientId();
    expect(a).not.toBe(b);
  });
});

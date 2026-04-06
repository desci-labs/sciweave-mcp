/**
 * API Key Authentication
 *
 * Validates sciweave_live_ API keys by calling the dedicated
 * /api/v1/validate-key endpoint — a no-deduct validation path.
 *
 * Previously this hit /api/v1/search with a dummy query, which went
 * through authorizeApiRequest → deductCredit, burning a credit on every
 * single MCP tool call just for auth.
 */

const WEB_API_URL =
  process.env.SCIWEAVE_WEB_API_URL || "https://sciweave.com";

/** Auth validation should be fast. 5s cap prevents the MCP request from
 *  hanging indefinitely if sciweave-web is degraded. */
const AUTH_TIMEOUT_MS = 5000;

export interface AuthResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * Extract API key from the request's Authorization header.
 * Claude.ai / Claude Code sends it as: Authorization: Bearer <api_key>
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const key = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return key.trim() || null;
}

/**
 * Validate an sciweave_live_ API key against sciweave-web's Supabase.
 * Does NOT deduct a credit.
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${WEB_API_URL}/api/v1/validate-key`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });

    // Try to parse the response body — validate-key always returns JSON.
    let body: { valid?: boolean; userId?: string; error?: string } = {};
    try {
      body = await res.json();
    } catch {
      // Non-JSON response — fall through to status-based error handling.
    }

    // Fail closed on malformed 200s — require strict `valid === true`
    // AND a non-empty string userId. A partial deploy, CDN rewrite, or
    // mock middleware could otherwise let an unidentified caller
    // through the auth gate.
    if (res.status === 200) {
      if (
        body.valid === true &&
        typeof body.userId === "string" &&
        body.userId.trim().length > 0
      ) {
        return { valid: true, userId: body.userId };
      }
      return { valid: false, error: "Auth service returned malformed response" };
    }

    if (res.status === 401) {
      return { valid: false, error: body.error ?? "Invalid API key" };
    }

    if (res.status === 402) {
      return {
        valid: false,
        error:
          body.error ??
          "Insufficient credits. Top up at https://sciweave.com/settings?tab=api-access",
      };
    }

    // Unexpected status — do NOT forward body.error, which may contain
    // internal/infra details (DB hostnames, stack traces, etc.) that
    // MCP clients shouldn't see.
    if (res.status >= 500) {
      return { valid: false, error: "Auth service unavailable" };
    }
    return {
      valid: false,
      error: `Validation failed: ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Auth service unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

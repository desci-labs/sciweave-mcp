/**
 * API Key Authentication
 *
 * Validates sciweave_live_ API keys by calling a sciweave-web API endpoint
 * that checks the key against Supabase. This is the same validation
 * the public API (v1/search, v1/chat) uses.
 */

const WEB_API_URL =
  process.env.SCIWEAVE_WEB_API_URL || "https://sciweave.com";

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
 * Validate an sciweave_live_ API key by calling a sciweave-web API endpoint.
 * The v1/search endpoint uses authorizeApiRequest which validates
 * against Supabase's api_keys table.
 *
 * We make a lightweight HEAD-style request to test the key.
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
  try {
    // Call the v1/search endpoint with a minimal query to validate the key.
    // The authorizeApiRequest middleware validates before any work is done.
    const res = await fetch(`${WEB_API_URL}/api/v1/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "__auth_check__", limit: 1 }),
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }

    if (res.status === 402) {
      return {
        valid: false,
        error: "Insufficient credits. Top up at https://sciweave.com/settings?tab=api-access",
      };
    }

    if (res.ok || res.status < 500) {
      // Key is valid (even if the search returned no results)
      return { valid: true };
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

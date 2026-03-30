/**
 * API Key Authentication
 *
 * Validates API keys by calling the same nodes API endpoint that the
 * ML backend and sciweave-web use. No separate auth logic — we reuse
 * the existing infrastructure.
 */

const NODES_API_URL =
  process.env.SCIWEAVE_NODES_API_URL || "https://nodes-api.desci.com";

export interface AuthResult {
  valid: boolean;
  email?: string;
  userId?: number;
  error?: string;
}

/**
 * Extract API key from the request's Authorization header.
 * Claude.ai sends it as: Authorization: Bearer <api_key>
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  // Support both "Bearer <key>" and raw "<key>"
  const key = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return key.trim() || null;
}

/**
 * Validate an API key against the nodes API /v1/auth/profile endpoint.
 * This is the same validation the ML backend does.
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${NODES_API_URL}/v1/auth/profile`, {
      headers: { "api-key": apiKey },
    });

    if (!res.ok) {
      return {
        valid: false,
        error:
          res.status === 401
            ? "Invalid API key"
            : `Auth check failed: ${res.status}`,
      };
    }

    const profile = await res.json();

    if (!profile.userId) {
      return { valid: false, error: "No user found for this API key" };
    }

    return {
      valid: true,
      email: profile.email,
      userId: profile.userId,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Auth service unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

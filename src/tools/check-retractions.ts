import { z } from "zod";
import { normalizeDoi } from "../open-access.js";

const CHECK_LIST_URL = "https://sanecite.com/api/check-list";
const USER_AGENT = "SciWeaveMCP/1.0 (+https://sciweave.com)";
const FETCH_TIMEOUT_MS = 15_000;
/** The API accepts up to 300 IDs in one request. */
const MAX_DOIS = 300;

export const checkRetractionsSchema = z.object({
  dois: z
    .array(z.string())
    .min(1)
    .max(MAX_DOIS)
    .describe(
      "DOIs to check, up to 300 — e.g. the DOIs returned by find_references or a paper's reference list."
    ),
});

export type CheckRetractionsInput = z.infer<typeof checkRetractionsSchema>;

type Notice = {
  doi?: string | null;
  label?: string | null;
  status?: string | null;
  notice_date?: string | null;
  notice_doi?: string | null;
  reasons?: string[] | null;
  reinstated_on?: string | null;
};

type CheckListResponse = {
  ok?: boolean;
  flagged?: Notice[];
  data?: { notices_snapshot?: string; source?: string };
};

const STATUS_LABELS: Record<string, string> = {
  retracted: "Retracted",
  concern: "Expression of concern",
  reinstated: "Reinstated",
};

/**
 * Check a list of DOIs for retraction notices and expressions of concern.
 *
 * Only the DOIs leave this server, and no API key or credit is involved. A
 * failed lookup always comes back as an error, because saying "no notice" when
 * the check never ran is the one wrong answer this tool must not give.
 */
export async function checkRetractions(input: CheckRetractionsInput) {
  const seen = new Set<string>();
  const dois: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.dois) {
    const doi = normalizeDoi(raw);
    if (!doi) {
      invalid.push(raw);
    } else if (!seen.has(doi.toLowerCase())) {
      seen.add(doi.toLowerCase());
      dois.push(doi);
    }
  }

  if (!dois.length) {
    return errorResult(
      "None of those look like DOIs — expected something like '10.1038/s41586-023-06792-0'."
    );
  }

  let body: CheckListResponse;
  try {
    const res = await fetch(CHECK_LIST_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ids: dois }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 429) {
      return errorResult(
        "The retraction check is rate limited right now, so nothing was checked. Try again in a minute."
      );
    }
    if (!res.ok) {
      return errorResult(`The retraction check failed (HTTP ${res.status}), so nothing was checked.`);
    }
    body = (await res.json()) as CheckListResponse;
  } catch {
    return errorResult("The retraction check could not be reached, so nothing was checked.");
  }

  if (body?.ok !== true || !Array.isArray(body.flagged)) {
    return errorResult("The retraction check returned an unexpected answer, so nothing was checked.");
  }

  const flagged = body.flagged;
  const lines = [`Checked ${dois.length} DOI${dois.length === 1 ? "" : "s"}.`];
  if (flagged.length) {
    lines.push("", `${flagged.length} with a notice:`, ...flagged.map(formatNotice));
  }
  const rest = dois.length - flagged.length;
  if (rest > 0) {
    lines.push(
      "",
      `No notice found for ${flagged.length ? `the other ${rest}` : rest === 1 ? "it" : `any of the ${rest}`}. That means none is on record, not that a paper is sound or that the DOI exists.`
    );
  }
  if (invalid.length) {
    lines.push("", `Not checked, not recognisable as DOIs: ${invalid.join(", ")}`);
  }
  const snapshot = body.data?.notices_snapshot ? ` Data as of ${body.data.notices_snapshot}.` : "";
  lines.push(
    "",
    `Source: ${body.data?.source ?? "Retraction Watch database, via Crossref"}, through the SaneCite API (https://sanecite.com/data).${snapshot}`
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function formatNotice(notice: Notice): string {
  const status = notice.status ?? "unknown";
  const parts = [`- ${notice.doi ?? notice.label ?? "unknown DOI"}: ${STATUS_LABELS[status] ?? status}`];
  if (notice.notice_date) parts[0] += ` (${notice.notice_date})`;
  if (notice.reinstated_on) parts.push(`  Reinstated on ${notice.reinstated_on}`);
  if (notice.notice_doi) parts.push(`  Notice: https://doi.org/${notice.notice_doi}`);
  if (notice.reasons?.length) parts.push(`  Reasons: ${notice.reasons.join("; ")}`);
  return parts.join("\n");
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

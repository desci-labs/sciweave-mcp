import { z } from "zod";
import {
  candidatesFromUrl,
  dedupe,
  discoverDoi,
  doiFromUrl,
  isDoiLink,
  normalizeDoi,
  resolveOpenAccess,
  type Candidate,
  type PaperMeta,
} from "../open-access.js";

export const findOpenAccessLinkSchema = z.object({
  doi: z
    .string()
    .optional()
    .describe(
      "DOI of the paper (e.g. '10.1038/s41586-023-06792-0'). The open-access copy is looked up via OpenAlex, which often finds a repository or preprint version of a paper whose publisher copy is paywalled."
    ),
  url: z
    .string()
    .optional()
    .describe(
      "Link to the paper, if a DOI isn't known. arXiv, bioRxiv/medRxiv and PubMed Central links are mapped to their full-text source directly; other links are resolved through their DOI when one is present."
    ),
});

export type FindOpenAccessLinkInput = z.infer<typeof findOpenAccessLinkSchema>;

/**
 * Resolve where a paper's open-access copy lives, without downloading it.
 *
 * Returns links only, so retrieving the paper stays with the client: this
 * server never pulls a multi-megabyte PDF on someone's behalf.
 */
export async function findOpenAccessLink(input: FindOpenAccessLinkInput) {
  const explicitDoi = input.doi
    ? normalizeDoi(input.doi)
    : input.url && isDoiLink(input.url)
      ? normalizeDoi(input.url)
      : null;

  if (input.doi && !explicitDoi && !input.url) {
    return errorResult(
      `\`${input.doi}\` is not a recognisable DOI — expected something like '10.1038/s41586-023-06792-0'.`
    );
  }

  if (!input.url && !explicitDoi) {
    return errorResult(
      "Provide `doi` or `url`. If neither is known, use find_references to locate the paper first."
    );
  }

  const direct: Candidate[] = [];
  if (input.url && !isDoiLink(input.url)) {
    direct.push(...candidatesFromUrl(input.url));
    if (!direct.length) {
      return errorResult(`\`${input.url}\` is not a valid http(s) URL.`);
    }
  }

  // Look up the DOI when we have one — given, embedded in the URL, or (last
  // resort) advertised in the landing page's own metadata.
  let lookupDoi = explicitDoi ?? (input.url ? doiFromUrl(input.url) : null);
  if (!lookupDoi && input.url && !hasKnownFullTextSource(input.url)) {
    lookupDoi = await discoverDoi(input.url);
  }

  let meta: PaperMeta | undefined;
  let resolved: Candidate[] = [];
  if (lookupDoi) {
    const result = await resolveOpenAccess(lookupDoi);
    meta = result.meta;
    resolved = result.candidates;
  }

  // A link we rewrote (arXiv → PDF, PMC → XML) is already the best source. A
  // plain pass-through of whatever the user pasted is not: when OpenAlex knows
  // an open-access copy, that outranks a publisher page that may be paywalled.
  const directIsRewritten = !!input.url && hasKnownFullTextSource(input.url);
  const links = dedupe(
    directIsRewritten || !resolved.length ? [...direct, ...resolved] : [...resolved, ...direct]
  );

  if (!links.length) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `No open-access copy found${lookupDoi ? ` for DOI ${lookupDoi}` : ""}.`,
            meta?.title ? `Paper: ${meta.title}` : null,
            meta?.isOpenAccess === false
              ? "OpenAlex reports this work as closed access — the full text is behind a paywall."
              : "OpenAlex has no open-access location on record for this paper.",
            lookupDoi ? `Publisher page: https://doi.org/${lookupDoi}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }

  const header: string[] = [];
  if (meta?.title) header.push(`**${meta.title}**`);
  if (meta?.authors?.length) {
    header.push(
      `Authors: ${meta.authors.slice(0, 12).join(", ")}${meta.authors.length > 12 ? ", et al." : ""}`
    );
  }
  if (meta?.year) header.push(`Year: ${meta.year}`);
  if (meta?.journal) header.push(`Journal: ${meta.journal}`);
  if (lookupDoi) header.push(`DOI: ${lookupDoi}`);
  if (meta?.oaStatus) header.push(`Open access: ${meta.oaStatus}${meta.license ? ` (${meta.license})` : ""}`);

  const [best, ...rest] = links;
  const body = [
    `Best link: ${best.url}`,
    `  (${best.label}${guessFormat(best.url) ? `, likely ${guessFormat(best.url)}` : ""})`,
  ];
  if (rest.length) {
    body.push(
      "",
      "Alternatives:",
      ...rest.slice(0, 5).map((c) => `- ${c.url}\n  (${c.label})`)
    );
  }

  const sections = [
    header.join("\n"),
    body.join("\n"),
    "Links are resolved, not verified — nothing was downloaded. Fetch the best link to read the paper. PDF links need a client that can read PDFs; where a landing-page or XML alternative is listed, that one is easier to read as text.",
  ].filter((section) => section.length > 0);

  return {
    content: [{ type: "text" as const, text: sections.join("\n\n") }],
  };
}

/**
 * True when the link already points at a source we can map to full text
 * without any lookup (arXiv, PMC, bioRxiv) — no reason to spend a request
 * discovering a DOI we won't use.
 */
function hasKnownFullTextSource(url: string): boolean {
  const [first] = candidatesFromUrl(url);
  return !!first && first.url !== url.trim();
}

function guessFormat(url: string): string | null {
  if (/\.pdf($|\?)/i.test(url) || /\/pdf\//i.test(url) || /arxiv\.org\/pdf\//i.test(url)) {
    return "PDF";
  }
  if (/fullTextXML|\.xml($|\?)/i.test(url)) return "XML";
  return null;
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

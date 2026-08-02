/**
 * Open-access location resolution.
 *
 * Answers "where can this paper be read?" — it never downloads the paper
 * itself. The only network calls are a metadata lookup against OpenAlex and,
 * when a publisher URL carries no DOI, a bounded read of that page's <head>
 * to find the DOI it advertises.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Cap on the metadata peek. Enough for any document head, and never more. */
const DOI_PEEK_BYTES = 96 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

/** Polite-pool identification for OpenAlex and publisher hosts. */
const CONTACT_EMAIL = process.env.SCIWEAVE_CONTACT_EMAIL || "support@sciweave.com";
const USER_AGENT = `SciWeaveMCP/1.0 (+https://sciweave.com; mailto:${CONTACT_EMAIL})`;

/** A place the paper can be read, with a human-readable provenance label. */
export interface Candidate {
  url: string;
  label: string;
}

/** Bibliographic metadata, as returned by the resolver. */
export interface PaperMeta {
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  isOpenAccess?: boolean;
  license?: string;
  oaStatus?: string;
}

// ---------------------------------------------------------------------------
// Input normalisation
// ---------------------------------------------------------------------------

/**
 * Pull a bare DOI out of whatever the caller passed — a raw DOI, a `doi:`
 * prefixed string, or a doi.org / dx.doi.org URL. Returns null when the input
 * doesn't contain a DOI.
 */
export function normalizeDoi(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/10\.\d{4,9}\/[^\s"'<>]+/);
  if (!match) return null;
  // Strip punctuation that commonly trails a DOI in prose.
  return match[0].replace(/[.,;)\]]+$/, "");
}

/** True when the URL is a DOI resolver link, which carries no content itself. */
export function isDoiLink(raw: string): boolean {
  try {
    return /(^|\.)(dx\.)?doi\.org$/.test(new URL(raw.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * Pull a DOI out of a publisher URL. Preprint servers append a version suffix
 * to the DOI in their paths (`…/10.1101/2020.03.30.015008v1`) which is not
 * part of the DOI itself.
 */
export function doiFromUrl(raw: string): string | null {
  const doi = normalizeDoi(raw);
  if (!doi) return null;
  return doi.replace(/v\d+(?:\.(?:full|abstract|supplementary))?$/i, "").replace(/[./]+$/, "");
}

/** Extract an arXiv ID (new `2401.12345` or legacy `math.GT/0309136` form). */
function arxivIdFrom(url: URL): string | null {
  if (!/(^|\.)arxiv\.org$/.test(url.hostname)) return null;
  const path = url.pathname.replace(/^\/+/, "");
  const match = path.match(/^(?:abs|pdf|html|format)\/(.+?)(?:\.pdf)?$/i);
  return match ? match[1] : null;
}

/** Extract a PubMed Central ID from an NCBI or Europe PMC URL. */
function pmcIdFrom(url: URL): string | null {
  if (!/(ncbi\.nlm\.nih\.gov|europepmc\.org)$/.test(url.hostname)) return null;
  const target = `${url.pathname}${url.search}`;
  const prefixed = target.match(/PMC\d+/i);
  if (prefixed) return prefixed[0].toUpperCase();
  // OpenAlex hands back bare numeric IDs (…/pmc/articles/7102627), which are
  // the same identifier without the prefix.
  const bare = target.match(/\/pmc\/articles\/(\d+)/i);
  return bare ? `PMC${bare[1]}` : null;
}

/**
 * Turn a link into an ordered list of places the full text can be read,
 * preferring machine-readable sources over the human-facing landing page.
 * Host-specific knowledge only — no network calls.
 */
export function candidatesFromUrl(raw: string): Candidate[] {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return [];
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return [];

  const candidates: Candidate[] = [];
  const host = url.hostname.replace(/^www\./, "");

  const arxivId = arxivIdFrom(url);
  if (arxivId) {
    // arXiv's PDF is the canonical full text; /abs is only the abstract page.
    candidates.push({ url: `https://arxiv.org/pdf/${arxivId}`, label: "arXiv PDF" });
    return candidates;
  }

  const pmcId = pmcIdFrom(url);
  if (pmcId) {
    // Europe PMC serves clean JATS XML for anything in the OA subset.
    candidates.push({
      url: `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcId}/fullTextXML`,
      label: "Europe PMC full-text XML",
    });
    candidates.push({ url: url.toString(), label: "original link" });
    return candidates;
  }

  if (host === "biorxiv.org" || host === "medrxiv.org") {
    // /content/10.1101/xxx v1 → the same path with .full.pdf appended.
    if (!/\.(full|full\.pdf|full-text)$/.test(url.pathname) && !url.pathname.endsWith(".pdf")) {
      candidates.push({
        url: `${url.origin}${url.pathname.replace(/\/$/, "")}.full.pdf`,
        label: `${host} PDF`,
      });
    }
    candidates.push({ url: url.toString(), label: "original link" });
    return candidates;
  }

  candidates.push({ url: url.toString(), label: "provided link" });
  return candidates;
}

// ---------------------------------------------------------------------------
// DOI → open-access location (OpenAlex)
// ---------------------------------------------------------------------------

/**
 * Ask OpenAlex where the open-access copy of a DOI lives. OpenAlex mirrors
 * Unpaywall's OA index, so this covers repositories, preprint servers and
 * publisher-hosted OA alike. Returns an empty candidate list (not an error)
 * when the work is closed access or unknown.
 */
export async function resolveOpenAccess(
  doi: string
): Promise<{ candidates: Candidate[]; meta?: PaperMeta }> {
  const endpoint = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CONTACT_EMAIL)}`;

  let work: Record<string, any>;
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { candidates: [] };
    work = (await res.json()) as Record<string, any>;
  } catch {
    return { candidates: [] };
  }

  const openAccess = work.open_access ?? {};
  const meta: PaperMeta = {
    title: work.display_name ?? work.title ?? undefined,
    authors: Array.isArray(work.authorships)
      ? work.authorships
          .map((a: any) => a?.author?.display_name)
          .filter((n: unknown): n is string => typeof n === "string")
      : undefined,
    year: typeof work.publication_year === "number" ? work.publication_year : undefined,
    journal: work.primary_location?.source?.display_name ?? undefined,
    isOpenAccess: openAccess.is_oa === true,
    oaStatus: openAccess.oa_status ?? undefined,
    license: work.best_oa_location?.license ?? undefined,
  };

  // Prefer direct PDFs, then landing pages, in OpenAlex's own ranking order.
  const locations: any[] = [
    work.best_oa_location,
    ...(Array.isArray(work.locations) ? work.locations : []),
  ].filter(Boolean);

  const seen = new Set<string>();
  const pdfs: Candidate[] = [];
  const pages: Candidate[] = [];

  for (const loc of locations) {
    if (loc.is_oa === false) continue;
    const source = loc.source?.display_name ?? "open-access location";
    if (typeof loc.pdf_url === "string" && !seen.has(loc.pdf_url)) {
      seen.add(loc.pdf_url);
      pdfs.push({ url: loc.pdf_url, label: `OA PDF (${source})` });
    }
    if (typeof loc.landing_page_url === "string" && !seen.has(loc.landing_page_url)) {
      seen.add(loc.landing_page_url);
      pages.push({ url: loc.landing_page_url, label: `OA landing page (${source})` });
    }
  }

  if (typeof openAccess.oa_url === "string" && !seen.has(openAccess.oa_url)) {
    seen.add(openAccess.oa_url);
    pdfs.push({ url: openAccess.oa_url, label: "OA URL (OpenAlex)" });
  }

  // Expand each location through the host-specific rules (an arXiv landing
  // page becomes an arXiv PDF, a PMC page becomes Europe PMC XML, …).
  const expanded: Candidate[] = [];
  for (const c of [...pdfs, ...pages]) {
    const rewritten = candidatesFromUrl(c.url);
    if (rewritten.length && rewritten[0].url !== c.url) {
      expanded.push({ url: rewritten[0].url, label: `${c.label} → ${rewritten[0].label}` });
    }
    expanded.push(c);
  }

  return { candidates: dedupe(expanded), meta };
}

export function dedupe(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

// ---------------------------------------------------------------------------
// DOI discovery from a landing page
// ---------------------------------------------------------------------------

/** Reject loopback / link-local / private-network targets (SSRF guard). */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const v6 = address.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Refusing to fetch a non-public host");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Refusing to fetch a private address");
    return;
  }
  try {
    const resolved = await dnsLookup(host, { all: true });
    if (resolved.some((r) => isPrivateAddress(r.address))) {
      throw new Error("Refusing to fetch a host that resolves to a private address");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Refusing")) throw err;
    throw new Error(`Could not resolve host: ${host}`);
  }
}

/**
 * Fetch the head of a document, following redirects manually so every hop is
 * checked against the SSRF guard, and never reading past DOI_PEEK_BYTES.
 */
async function fetchHead(rawUrl: string): Promise<{ contentType: string; body: Uint8Array }> {
  let current = new URL(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);

    const res = await fetch(current, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, application/xml;q=0.9, */*;q=0.5",
        // Servers may ignore Range — readCapped enforces the ceiling anyway.
        Range: `bytes=0-${DOI_PEEK_BYTES - 1}`,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect with no Location header (${res.status})`);
      current = new URL(location, current);
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    return {
      contentType: (res.headers.get("content-type") || "").toLowerCase(),
      body: await readCapped(res),
    };
  }

  throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
}

async function readCapped(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < DOI_PEEK_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
    await res.body.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function firstGroup(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1];
}

/**
 * The DOI a page advertises about itself. Publisher landing pages carry
 * `citation_doi` (Google Scholar's convention) even when the article body is
 * behind a paywall — which is exactly when we need it to find an OA copy.
 */
export function htmlDoi(html: string): string | undefined {
  const head = html.slice(0, DOI_PEEK_BYTES);
  const raw =
    firstGroup(head, /<meta[^>]+name=["'](?:citation_doi|dc\.identifier|DC\.identifier)["'][^>]+content=["']([^"']+)["']/i) ??
    firstGroup(head, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:citation_doi|dc\.identifier|DC\.identifier)["']/i);
  return raw ? normalizeDoi(raw) ?? undefined : undefined;
}

/**
 * Read just the head of a landing page to learn the DOI it advertises.
 *
 * Publisher URLs frequently carry no DOI in the path (nature.com/articles/
 * nature12373), so without this a link-only resolve has nothing to look up.
 */
export async function discoverDoi(url: string): Promise<string | null> {
  try {
    const { contentType, body } = await fetchHead(url);
    if (contentType.includes("pdf")) return null;
    return htmlDoi(new TextDecoder("utf-8").decode(body)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tests for open-access location resolution.
 *
 * Everything here is pure except discoverDoi, which is exercised against a
 * stubbed global fetch. Note the public IP literals in the network tests:
 * sandboxed resolvers may map every hostname to loopback, which the SSRF
 * guard (correctly) rejects, so tests that must reach "the network" skip DNS
 * by using an address literal.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  candidatesFromUrl,
  discoverDoi,
  doiFromUrl,
  htmlDoi,
  isDoiLink,
  normalizeDoi,
} from "./open-access.js";

describe("normalizeDoi", () => {
  it("accepts a bare DOI", () => {
    expect(normalizeDoi("10.1038/s41586-023-06792-0")).toBe("10.1038/s41586-023-06792-0");
  });

  it("strips doi.org and doi: prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.1101/2023.01.01.522000")).toBe(
      "10.1101/2023.01.01.522000"
    );
    expect(normalizeDoi("https://dx.doi.org/10.1234/abc")).toBe("10.1234/abc");
    expect(normalizeDoi("doi:10.1234/abc")).toBe("10.1234/abc");
  });

  it("drops trailing prose punctuation", () => {
    expect(normalizeDoi("see 10.1234/abc.")).toBe("10.1234/abc");
    expect(normalizeDoi("(10.1234/abc)")).toBe("10.1234/abc");
  });

  it("returns null when there is no DOI", () => {
    expect(normalizeDoi("https://example.com/paper.pdf")).toBeNull();
    expect(normalizeDoi("")).toBeNull();
  });
});

describe("isDoiLink", () => {
  it("recognises DOI resolver hosts", () => {
    expect(isDoiLink("https://doi.org/10.1234/abc")).toBe(true);
    expect(isDoiLink("https://dx.doi.org/10.1234/abc")).toBe(true);
  });

  it("does not treat a publisher URL containing a DOI as a resolver link", () => {
    expect(isDoiLink("https://journals.plos.org/plosone/article?id=10.1371/x")).toBe(false);
    expect(isDoiLink("not a url")).toBe(false);
  });
});

describe("doiFromUrl", () => {
  it("strips the preprint version suffix that is part of the URL, not the DOI", () => {
    expect(doiFromUrl("https://www.biorxiv.org/content/10.1101/2020.03.30.015008v1")).toBe(
      "10.1101/2020.03.30.015008"
    );
    expect(
      doiFromUrl("https://www.biorxiv.org/content/10.1101/2020.03.30.015008v2.full")
    ).toBe("10.1101/2020.03.30.015008");
  });

  it("leaves a plain DOI untouched", () => {
    expect(
      doiFromUrl("https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266462")
    ).toBe("10.1371/journal.pone.0266462");
  });

  it("returns null for URLs with no DOI", () => {
    expect(doiFromUrl("https://arxiv.org/abs/1706.03762")).toBeNull();
  });
});

describe("candidatesFromUrl", () => {
  it("maps any arXiv URL to the PDF", () => {
    expect(candidatesFromUrl("https://arxiv.org/abs/2401.12345")[0].url).toBe(
      "https://arxiv.org/pdf/2401.12345"
    );
    expect(candidatesFromUrl("https://arxiv.org/pdf/2401.12345v2")[0].url).toBe(
      "https://arxiv.org/pdf/2401.12345v2"
    );
    expect(candidatesFromUrl("https://arxiv.org/abs/math.GT/0309136")[0].url).toBe(
      "https://arxiv.org/pdf/math.GT/0309136"
    );
  });

  it("prefers Europe PMC XML for PubMed Central links, keeping the original as fallback", () => {
    const candidates = candidatesFromUrl(
      "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7212802/"
    );
    expect(candidates[0].url).toBe(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7212802/fullTextXML"
    );
    expect(candidates[1].url).toContain("ncbi.nlm.nih.gov");
  });

  it("accepts the bare numeric PMC id that OpenAlex hands back", () => {
    expect(candidatesFromUrl("https://www.ncbi.nlm.nih.gov/pmc/articles/7102627")[0].url).toBe(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7102627/fullTextXML"
    );
  });

  it("appends .full.pdf for bioRxiv/medRxiv content links", () => {
    const candidates = candidatesFromUrl(
      "https://www.biorxiv.org/content/10.1101/2023.01.01.522000v1"
    );
    expect(candidates[0].url).toBe(
      "https://www.biorxiv.org/content/10.1101/2023.01.01.522000v1.full.pdf"
    );
  });

  it("passes other URLs through unchanged", () => {
    const candidates = candidatesFromUrl("https://journals.plos.org/plosone/article?id=10.1371/x");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].url).toContain("journals.plos.org");
  });

  it("rejects non-http schemes and malformed input", () => {
    expect(candidatesFromUrl("file:///etc/passwd")).toEqual([]);
    expect(candidatesFromUrl("not a url")).toEqual([]);
  });
});

describe("htmlDoi", () => {
  it("reads the citation_doi meta tag publishers emit for Google Scholar", () => {
    expect(
      htmlDoi(`<head><meta name="citation_doi" content="10.1038/nature12373"></head>`)
    ).toBe("10.1038/nature12373");
  });

  it("handles reversed attribute order and dc.identifier", () => {
    expect(htmlDoi(`<meta content="doi:10.1234/abc" name="DC.identifier">`)).toBe("10.1234/abc");
  });

  it("returns undefined when the page advertises no DOI", () => {
    expect(htmlDoi("<head><title>No DOI here</title></head>")).toBeUndefined();
  });
});

describe("discoverDoi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the DOI from a landing page with a bounded request", async () => {
    const fetchMock = vi.fn(
      async (..._args: any[]) =>
        new Response(`<head><meta name="citation_doi" content="10.1038/nature12373"></head>`, {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await discoverDoi("http://93.184.216.34/articles/nature12373")).toBe(
      "10.1038/nature12373"
    );
    expect((fetchMock.mock.calls[0][1] as any).headers.Range).toMatch(/^bytes=0-\d+$/);
  });

  it("does not try to parse a PDF for metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } })
      )
    );
    expect(await discoverDoi("http://93.184.216.34/paper.pdf")).toBeNull();
  });

  it("returns null instead of throwing when the page is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
    expect(await discoverDoi("http://93.184.216.34/blocked")).toBeNull();
  });

  it("refuses private and loopback addresses", async () => {
    const fetchMock = vi.fn(async () => new Response("secret"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await discoverDoi("http://127.0.0.1:8080/admin")).toBeNull();
    expect(await discoverDoi("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(await discoverDoi("http://localhost/secret")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates every hop of a redirect chain", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/internal" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await discoverDoi("http://93.184.216.34/redirector")).toBeNull();
    // The first hop was fetched; the loopback redirect target was not.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

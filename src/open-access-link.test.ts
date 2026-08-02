/**
 * Tests for the link-only resolver.
 *
 * The point of this tool is that it does NOT download the paper, so the
 * assertions here care as much about which URLs are *not* fetched as about
 * the links returned.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { findOpenAccessLink, findOpenAccessLinkSchema } from "./tools/open-access-link.js";

const OPENALEX_WORK = {
  display_name: "Nanometre-scale thermometry in a living cell",
  publication_year: 2013,
  authorships: [{ author: { display_name: "G. Kucsko" } }],
  primary_location: { source: { display_name: "Nature" } },
  open_access: { is_oa: true, oa_status: "green", oa_url: "https://arxiv.org/pdf/1304.1068" },
  best_oa_location: {
    is_oa: true,
    pdf_url: "https://arxiv.org/pdf/1304.1068",
    landing_page_url: "https://arxiv.org/abs/1304.1068",
    source: { display_name: "arXiv" },
    license: "other-oa",
  },
  locations: [],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const run = (input: Record<string, unknown>) =>
  findOpenAccessLink(findOpenAccessLinkSchema.parse(input));

describe("findOpenAccessLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a DOI to its open-access copy without downloading anything", async () => {
    const fetchMock = vi.fn(async (..._args: any[]) => json(OPENALEX_WORK));
    vi.stubGlobal("fetch", fetchMock);

    const res: any = await run({ doi: "10.1038/nature12373" });
    const text = res.content[0].text;

    expect(text).toContain("Best link: https://arxiv.org/pdf/1304.1068");
    expect(text).toContain("Open access: green");
    // Exactly one request, and it went to the metadata API — not the PDF.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.openalex.org");
  });

  it("maps a known source without any network call at all", async () => {
    const fetchMock = vi.fn(async () => json({}));
    vi.stubGlobal("fetch", fetchMock);

    const res: any = await run({ url: "https://arxiv.org/abs/1706.03762" });

    expect(res.content[0].text).toContain("Best link: https://arxiv.org/pdf/1706.03762");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ranks the open-access copy above the publisher page the user pasted", async () => {
    const landingPage = `<html><head><meta name="citation_doi" content="10.1038/nature12373"></head>
      <body>Paywalled abstract</body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes("api.openalex.org")) return json(OPENALEX_WORK);
        return new Response(landingPage, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      })
    );

    const res: any = await run({ url: "https://www.nature.com/articles/nature12373" });
    const text = res.content[0].text;

    expect(text).toContain("Best link: https://arxiv.org/pdf/1304.1068");
    // The pasted link is still offered, just not as the recommendation.
    expect(text).toContain("https://www.nature.com/articles/nature12373");
    expect(text.indexOf("arxiv.org/pdf")).toBeLessThan(
      text.indexOf("nature.com/articles")
    );
  });

  it("reports closed access rather than inventing a link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          display_name: "A Closed Paper",
          open_access: { is_oa: false },
          locations: [],
        })
      )
    );

    const res: any = await run({ doi: "10.1016/j.cell.2020.02.052" });
    const text = res.content[0].text;

    expect(text).toContain("No open-access copy found");
    expect(text).toContain("closed access");
    expect(text).toContain("https://doi.org/10.1016/j.cell.2020.02.052");
  });

  it("rejects an unparseable DOI when there is no link to fall back on", async () => {
    const res: any = await run({ doi: "not-a-doi" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("not a recognisable DOI");
  });

  it("requires at least one of doi or url", async () => {
    const res: any = await run({});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Provide `doi` or `url`");
  });
});

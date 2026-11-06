/**
 * Tests for the retraction check.
 *
 * The answer that matters most is the one it must never give: "no notice" when
 * the lookup failed. So the failure paths assert isError and that wording's absence.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRetractions, checkRetractionsSchema } from "./tools/check-retractions.js";

const RETRACTED = {
  doi: "10.1038/s41586-021-04096-9",
  status: "retracted",
  notice_date: "2022-05-30",
  notice_doi: "10.1038/s41586-022-04869-w",
  reasons: ["Error in Analyses"],
  reinstated_on: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const answer = (flagged: unknown[]) =>
  json({ ok: true, flagged, data: { notices_snapshot: "2026-11-05", source: "Retraction Watch database, via Crossref" } });

const run = (dois: string[]) => checkRetractions(checkRetractionsSchema.parse({ dois }));
const textOf = (res: any): string => res.content[0].text;

describe("checkRetractions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a notice with its date, link and reasons", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer([RETRACTED])));

    const res: any = await run(["10.1038/s41586-021-04096-9", "10.1000/fine"]);

    expect(res.isError).toBeUndefined();
    expect(textOf(res)).toContain("Checked 2 DOIs.");
    expect(textOf(res)).toContain("10.1038/s41586-021-04096-9: Retracted (2022-05-30)");
    expect(textOf(res)).toContain("https://doi.org/10.1038/s41586-022-04869-w");
    expect(textOf(res)).toContain("Error in Analyses");
    expect(textOf(res)).toContain("No notice found for the other 1.");
    expect(textOf(res)).toContain("Data as of 2026-11-05.");
  });

  it("labels an expression of concern as one, not as a retraction", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer([{ doi: "10.1000/a", status: "concern" }])));

    const res = await run(["10.1000/a"]);

    expect(textOf(res)).toContain("Expression of concern");
    expect(textOf(res)).not.toContain("Retracted");
  });

  it("never calls an unflagged DOI sound", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer([])));

    const res = await run(["10.1000/a"]);

    expect(textOf(res)).toContain("none is on record, not that a paper is sound or that the DOI exists");
  });

  it("sends only normalised, de-duplicated DOIs, and names what it skipped", async () => {
    const fetchMock = vi.fn(async (..._args: any[]) => answer([]));
    vi.stubGlobal("fetch", fetchMock);

    const res = await run(["https://doi.org/10.1000/A", "10.1000/a", "doi:10.1000/b.", "not a doi"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sanecite.com/api/check-list");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ ids: ["10.1000/A", "10.1000/b"] });
    expect(textOf(res)).toContain("Checked 2 DOIs.");
    expect(textOf(res)).toContain("Not checked, not recognisable as DOIs: not a doi");
  });

  it("makes no request when nothing is a DOI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res: any = await run(["hello"]);

    expect(res.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["rate limit", async () => json({ ok: false }, 429), "rate limited"],
    ["server error", async () => json({ ok: false }, 500), "HTTP 500"],
    ["network failure", async () => { throw new Error("boom"); }, "could not be reached"],
    ["not JSON", async () => new Response("<html>", { status: 200 }), "could not be reached"],
    ["ok false", async () => json({ ok: false, flagged: [] }), "unexpected answer"],
    ["missing list", async () => json({ ok: true }), "unexpected answer"],
  ])("treats %s as an error, never as no notice", async (_name, impl, expected) => {
    vi.stubGlobal("fetch", vi.fn(impl));

    const res: any = await run(["10.1000/a"]);

    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain(expected);
    expect(textOf(res)).toContain("nothing was checked");
    expect(textOf(res)).not.toContain("No notice found");
  });

  it("enforces the list size the API accepts", () => {
    expect(() => checkRetractionsSchema.parse({ dois: [] })).toThrow();
    expect(() => checkRetractionsSchema.parse({ dois: Array(301).fill("10.1000/a") })).toThrow();
    expect(checkRetractionsSchema.parse({ dois: Array(300).fill("10.1000/a") }).dois).toHaveLength(300);
  });
});

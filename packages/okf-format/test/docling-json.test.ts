import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderDoclingDocumentToMarkdown, type DoclingDocument } from "../src/docling-json.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// This fixture is REAL docling output (docling 2.129.0, verified
// 2026-09-18), not synthetic: the first 3 pages of
// fixtures/doctrine/afdp-3-0.1-command-and-control.pdf run through
// `docling convert --to json --image-export-mode placeholder`, with
// only the (large, irrelevant to this renderer) `pages` thumbnail data
// and embedded picture bytes stripped to keep the fixture small. See
// ingest.ts's doclingExtractor doc comment for the full verification
// account.
function loadRealFixture(): DoclingDocument {
  return JSON.parse(
    readFileSync(join(__dirname, "fixtures", "docling-json", "afdp-3-0.1-pages-1-3.json"), "utf8"),
  ) as DoclingDocument;
}

describe("renderDoclingDocumentToMarkdown against real docling output", () => {
  it("inserts a page anchor on every page transition, in document order", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    const anchors = [...md.matchAll(/<!-- page:(\d+) -->/g)].map((m) => m[1]);
    expect(anchors).toEqual(["1", "2", "3"]);
  });

  it("renders section headers as Markdown headings", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    expect(md).toContain("# FOREWORD");
  });

  it("renders body paragraph text legibly (real doctrine prose, not mangled)", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    expect(md).toContain("The most pressing objective for the United States Air Force (USAF) doctrine");
  });

  it("renders a table whose docling `label` is NOT literally \"table\" (this fixture's TOC table is labeled document_index) — dispatches on shape, not label", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    expect(md).toContain("| Foreword");
    expect(md).toContain("Chapter 1: COMMAND AND CONTROL OVERVIEW");
  });

  it("renders a picture item as a plain placeholder, never embedding image bytes", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    expect(md).toContain("<!-- image -->");
    expect(md).not.toContain("data:image");
  });

  it("renders a footnote item as a distinguishable paragraph, not a fabricated [^n] link back to a marker docling never gave it", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    expect(md).toContain("> 1  Throughout this publication, 'Distributed Control' is capitalized");
    expect(md).not.toMatch(/\[\^/);
  });

  it("drops page_footer items (running page numbers, not body content)", () => {
    const md = renderDoclingDocumentToMarkdown(loadRealFixture());
    // The real fixture's page_footer text items are bare Roman numerals
    // ("i") — assert none appear as a standalone rendered line.
    const lines = md.split("\n").map((l) => l.trim());
    expect(lines).not.toContain("i");
  });
});

describe("renderDoclingDocumentToMarkdown on minimal synthetic documents (edge cases the real fixture doesn't exercise)", () => {
  function doc(overrides: Partial<DoclingDocument>): DoclingDocument {
    return {
      body: { self_ref: "#/body", label: "unspecified", children: [] },
      texts: [],
      tables: [],
      pictures: [],
      groups: [],
      ...overrides,
    };
  }

  it("produces empty-ish output for a document with no body children", () => {
    const md = renderDoclingDocumentToMarkdown(doc({}));
    expect(md.trim()).toBe("");
  });

  it("recurses into a group's children in order", () => {
    const d = doc({
      body: { self_ref: "#/body", label: "unspecified", children: [{ $ref: "#/groups/0" }] },
      groups: [
        {
          self_ref: "#/groups/0",
          label: "group",
          children: [{ $ref: "#/texts/0" }, { $ref: "#/texts/1" }],
        },
      ],
      texts: [
        { self_ref: "#/texts/0", label: "text", text: "first", prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 0, b: 0 } }] },
        { self_ref: "#/texts/1", label: "text", text: "second", prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 0, b: 0 } }] },
      ],
    });
    const md = renderDoclingDocumentToMarkdown(d);
    expect(md.indexOf("first")).toBeLessThan(md.indexOf("second"));
  });

  it("does not insert a page anchor for an item with no prov (page unknown)", () => {
    const d = doc({
      body: { self_ref: "#/body", label: "unspecified", children: [{ $ref: "#/texts/0" }] },
      texts: [{ self_ref: "#/texts/0", label: "text", text: "no page info" }],
    });
    const md = renderDoclingDocumentToMarkdown(d);
    expect(md).not.toContain("<!-- page:");
    expect(md).toContain("no page info");
  });
});

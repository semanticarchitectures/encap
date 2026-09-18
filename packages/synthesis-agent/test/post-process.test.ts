import { extractFootnoteDefinitions, resolveFootnotes } from "@encap/okf-format";
import { describe, expect, it } from "vitest";
import { ensureFootnoteDefinitions, setGeneratedMetadata } from "../src/post-process.js";
import type { Concept } from "@encap/okf-format";

function concept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: "x",
    path: "x.md",
    frontmatter: {
      type: "Doctrine Reference",
      sources: [
        { id: "doc-p1", resource: "https://example.com/doc.pdf#page=1", title: "Doc, page 1" },
        { id: "doc-p2", resource: "https://example.com/doc.pdf#page=2", title: "Doc, page 2" },
      ],
    },
    body: "",
    ...overrides,
  };
}

describe("ensureFootnoteDefinitions", () => {
  it("appends a definition line for a referenced id that has no definition (the real bug found running synthesis against a real PDF)", () => {
    const c = concept({ body: "A claim.[^doc-p1] Another claim.[^doc-p2]\n" });
    const result = ensureFootnoteDefinitions(c);
    const res = resolveFootnotes(result.body, result.frontmatter.sources);
    expect(res.referencesMissingDefinition).toEqual([]);
    expect(result.body).toContain("[^doc-p1]: Doc, page 1");
    expect(result.body).toContain("[^doc-p2]: Doc, page 2");
  });

  it("does not duplicate a definition that's already present", () => {
    const c = concept({ body: "A claim.[^doc-p1]\n\n[^doc-p1]: Doc, page 1\n" });
    const result = ensureFootnoteDefinitions(c);
    const defs = extractFootnoteDefinitions(result.body).filter((d) => d.id === "doc-p1");
    expect(defs).toHaveLength(1);
  });

  it("leaves a reference with no matching sources[] entry undefined — that's a real defect, not a formatting gap", () => {
    const c = concept({ body: "A claim.[^ghost]\n" });
    const result = ensureFootnoteDefinitions(c);
    const res = resolveFootnotes(result.body, result.frontmatter.sources);
    expect(res.unresolvedReferences.map((r) => r.id)).toEqual(["ghost"]);
    expect(result.body).not.toContain("[^ghost]:");
  });

  it("is a no-op when every reference already has a definition", () => {
    const body = "A claim.[^doc-p1]\n\n[^doc-p1]: Doc, page 1\n";
    const c = concept({ body });
    const result = ensureFootnoteDefinitions(c);
    expect(result.body).toBe(body);
  });

  it("deduplicates repeated references to the same id into one definition", () => {
    const c = concept({ body: "First.[^doc-p1] Second.[^doc-p1]\n" });
    const result = ensureFootnoteDefinitions(c);
    const defs = extractFootnoteDefinitions(result.body).filter((d) => d.id === "doc-p1");
    expect(defs).toHaveLength(1);
  });
});

describe("setGeneratedMetadata", () => {
  it("overwrites generated with the real model id and timestamp, ignoring whatever the model wrote", () => {
    const c = concept({
      frontmatter: { type: "x", generated: { by: "synthesis-agent/some-hallucinated-model", at: "1999-01-01T00:00:00Z" } },
    });
    const now = new Date("2026-09-18T12:00:00Z");
    const result = setGeneratedMetadata(c, "claude-opus-5", now);
    expect(result.frontmatter.generated).toEqual({ by: "synthesis-agent/claude-opus-5", at: "2026-09-18T12:00:00.000Z" });
  });

  it("sets generated even when the model omitted it entirely", () => {
    const c = concept({ frontmatter: { type: "x" } });
    const result = setGeneratedMetadata(c, "claude-opus-5", new Date("2026-01-01T00:00:00Z"));
    expect(result.frontmatter.generated?.by).toBe("synthesis-agent/claude-opus-5");
  });
});

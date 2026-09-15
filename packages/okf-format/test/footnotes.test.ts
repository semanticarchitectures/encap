import { describe, expect, it } from "vitest";
import { extractFootnoteDefinitions, extractFootnoteReferences, resolveFootnotes } from "../src/footnotes.js";

describe("footnote extraction", () => {
  const body = [
    "A claim about revenue.[^rev-policy]",
    "",
    "Another claim.[^rev-policy] And a second source.[^orders]",
    "",
    "[^rev-policy]: Revenue Recognition Policy (FY2026)",
    "[^orders]: Customer Orders table",
  ].join("\n");

  it("extracts every reference, excluding definition lines", () => {
    const refs = extractFootnoteReferences(body);
    expect(refs.map((r) => r.id)).toEqual(["rev-policy", "rev-policy", "orders"]);
  });

  it("extracts every definition", () => {
    const defs = extractFootnoteDefinitions(body);
    expect(defs).toEqual([
      { id: "rev-policy", text: "Revenue Recognition Policy (FY2026)" },
      { id: "orders", text: "Customer Orders table" },
    ]);
  });
});

describe("resolveFootnotes", () => {
  it("flags a footnote reference with no matching sources[].id", () => {
    const body = "A claim.[^ghost]\n\n[^ghost]: some text";
    const res = resolveFootnotes(body, [{ id: "real", resource: "x.md" }]);
    expect(res.unresolvedReferences).toHaveLength(1);
    expect(res.unresolvedReferences[0]!.id).toBe("ghost");
  });

  it("flags a footnote reference with no matching definition line", () => {
    const body = "A claim.[^rev-policy]";
    const res = resolveFootnotes(body, [{ id: "rev-policy", resource: "policy.md" }]);
    expect(res.referencesMissingDefinition).toHaveLength(1);
    expect(res.referencesMissingDefinition[0]!.id).toBe("rev-policy");
  });

  it("does NOT flag a declared source that is never cited by a footnote (real bundles do this, e.g. acme_retail's revenue-ytd.md cites revenue-policy but not orders-table)", () => {
    const body = "A claim.[^rev-policy]\n\n[^rev-policy]: Revenue Recognition Policy";
    const res = resolveFootnotes(body, [
      { id: "rev-policy", resource: "policy.md" },
      { id: "orders-table", resource: "orders.md" },
    ]);
    expect(res.unresolvedReferences).toHaveLength(0);
    expect(res.referencesMissingDefinition).toHaveLength(0);
  });

  it("handles a body with zero footnotes and zero sources cleanly", () => {
    const res = resolveFootnotes("No claims here.", undefined);
    expect(res.references).toHaveLength(0);
    expect(res.unresolvedReferences).toHaveLength(0);
    expect(res.referencesMissingDefinition).toHaveLength(0);
  });
});

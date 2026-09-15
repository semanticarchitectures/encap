import { describe, expect, it } from "vitest";
import { extractLinks, resolveLinkPath } from "../src/links.js";

describe("extractLinks", () => {
  const existing = new Set(["tables/orders.md", "metrics/revenue.md", "sub/index.md"]);

  it("classifies a bundle-absolute link and resolves it", () => {
    const [edge] = extractLinks("See [orders](/tables/orders.md) for detail.", "metrics/revenue.md", existing);
    expect(edge).toMatchObject({
      kind: "bundle-absolute",
      href: "/tables/orders.md",
      resolvedPath: "tables/orders.md",
      exists: true,
    });
  });

  it("classifies a relative link and resolves it against the linking document's directory", () => {
    const [edge] = extractLinks("See [revenue](../metrics/revenue.md).", "tables/orders.md", existing);
    expect(edge).toMatchObject({
      kind: "relative",
      resolvedPath: "metrics/revenue.md",
      exists: true,
    });
  });

  it("classifies a same-directory relative link", () => {
    const [edge] = extractLinks("See [orders](orders.md).", "tables/index.md", existing);
    expect(edge.resolvedPath).toBe("tables/orders.md");
  });

  it("classifies an external link and never checks its existence", () => {
    const [edge] = extractLinks("See [source](https://example.com/x).", "tables/orders.md", existing);
    expect(edge).toMatchObject({ kind: "external", exists: true, resolvedPath: undefined });
  });

  it("tolerates a broken link rather than rejecting it (spec §6.1, §11)", () => {
    const [edge] = extractLinks("See [ghost](/nowhere.md).", "tables/orders.md", existing);
    expect(edge.exists).toBe(false);
    expect(edge.resolvedPath).toBe("nowhere.md");
  });

  it("resolves a bare-subdirectory link to that directory's index.md", () => {
    const [edge] = extractLinks("See [sub](sub/).", "index.md", existing);
    expect(edge.exists).toBe(true);
  });

  it("does not extract an image as a concept link", () => {
    const edges = extractLinks("![alt](image.png) and [real](/tables/orders.md)", "x.md", existing);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.href).toBe("/tables/orders.md");
  });

  it("does not mistake a bare footnote marker for a link", () => {
    const edges = extractLinks("A claim.[^src]\n\n[^src]: Some source", "x.md", existing);
    expect(edges).toHaveLength(0);
  });

  it("strips a #fragment before resolving", () => {
    const [edge] = extractLinks("See [orders](/tables/orders.md#schema).", "x.md", existing);
    expect(edge.resolvedPath).toBe("tables/orders.md");
    expect(edge.exists).toBe(true);
  });
});

describe("resolveLinkPath", () => {
  it("normalizes a relative parent-directory traversal", () => {
    expect(resolveLinkPath("../foo.md", "a/b/c.md", "relative")).toBe("a/foo.md");
  });
});

import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLinkGraph, readBundle } from "../src/bundle.js";
import { resolveFootnotes } from "../src/footnotes.js";
import { validateStrictProvenance } from "../src/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesRoot = join(__dirname, "fixtures", "okf-samples");
const sampleBundles = readdirSync(samplesRoot).filter((name) => statSync(join(samplesRoot, name)).isDirectory());

describe("link graph over real bundles", () => {
  for (const name of sampleBundles) {
    it(`${name}: every internal link resolves to a real file (no broken links in Google's own samples)`, () => {
      const { bundle } = readBundle(join(samplesRoot, name));
      const edges = buildLinkGraph(bundle);
      expect(edges.length).toBeGreaterThan(0);
      const broken = edges.filter((e) => e.kind !== "external" && !e.exists);
      expect(broken, JSON.stringify(broken)).toEqual([]);
    });
  }
});

describe("footnote resolution over real bundles", () => {
  it("acme_retail/metrics/revenue.md: every footnote resolves cleanly (frontmatter sources[].id join)", () => {
    const { bundle } = readBundle(join(samplesRoot, "acme_retail"));
    const concept = bundle.concepts.find((c) => c.path === "metrics/revenue.md")!;
    const res = resolveFootnotes(concept.body, concept.frontmatter.sources);
    expect(res.unresolvedReferences).toEqual([]);
    expect(res.referencesMissingDefinition).toEqual([]);
  });

  it("stackoverflow/tables/votes.md: [^1] has a definition but no matching sources[].id — a real, common pattern this package must not mistake for a parse error", () => {
    const { bundle } = readBundle(join(samplesRoot, "stackoverflow"));
    const concept = bundle.concepts.find((c) => c.path === "tables/votes.md")!;
    const res = resolveFootnotes(concept.body, concept.frontmatter.sources);
    expect(res.referencesMissingDefinition).toEqual([]);
    expect(res.unresolvedReferences.length).toBeGreaterThan(0);
  });
});

describe("validateStrictProvenance over real bundles (ENCAP's own bar, stricter than bare OKF conformance)", () => {
  it("acme_retail/metrics/revenue.md passes: generated.by set, footnote joins to a declared source", () => {
    const { bundle } = readBundle(join(samplesRoot, "acme_retail"));
    const concept = bundle.concepts.find((c) => c.path === "metrics/revenue.md")!;
    expect(validateStrictProvenance(concept).valid).toBe(true);
  });

  it("stackoverflow/tables/votes.md fails: its footnotes never join to a sources[].id, which bare OKF conformance allows but AGENTS.md Section 4's mandatory-citation rule does not", () => {
    const { bundle } = readBundle(join(samplesRoot, "stackoverflow"));
    const concept = bundle.concepts.find((c) => c.path === "tables/votes.md")!;
    const result = validateStrictProvenance(concept);
    expect(result.valid).toBe(false);
    expect(result.danglingFootnoteReferences).toContain("1");
  });
});

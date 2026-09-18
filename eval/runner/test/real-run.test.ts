import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConcept, validateStrictProvenance } from "@encap/okf-format";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

// A REAL synthesis-agent output, not synthetic: @encap/synthesis-agent run
// against the real fixtures/doctrine/afdp-3-0-1-command-and-control.pdf via
// a real Claude API call and a real docling ingest (2026-09-18), after the
// two post-processing fixes described in @encap/synthesis-agent's README
// (missing footnote definitions, fabricated generated metadata). Frozen
// here as a fixture so this evidence stays checked without another live
// API call — see that README, and eval/runner/scripts/run-fixture-gate.mjs
// for how to produce a fresh one.
describe("real synthesis-agent output (afdp-3-0-1-command-and-control, 2026-09-18)", () => {
  const raw = readFileSync(join(__dirname, "fixtures", "real-runs", "afdp-3-0-1-command-and-control.md"), "utf8");
  const concept = parseConcept(raw, "afdp-3-0-1-command-and-control.md");

  it("parses as a conformant OKF concept", () => {
    expect(concept.frontmatter.type).toBe("Doctrine Reference");
  });

  it("passes strict-provenance validation cleanly — every footnote resolves to a source AND a definition", () => {
    const result = validateStrictProvenance(concept);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("has real (not fabricated) generated metadata", () => {
    expect(concept.frontmatter.generated?.by).toMatch(/^synthesis-agent\/claude-/);
    expect(concept.frontmatter.generated?.at).toMatch(/^2026-09-18T/);
  });

  it("cites real pages of the source document across a substantial span (not a handful of claims)", () => {
    const pageRefs = [...new Set([...concept.body.matchAll(/\[\^afdp-3-0-1-p(\d+)\]/g)].map((m) => Number(m[1])))];
    expect(pageRefs.length).toBeGreaterThan(10);
  });
});

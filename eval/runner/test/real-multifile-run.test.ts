import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConcept, validateStrictProvenance } from "@encap/okf-format";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

// A REAL @encap/synthesis-agent multi-file output (synthesizeMultiFile),
// not synthetic: run for real against excerpts of two real doctrine PDFs
// (AFDP 3-0.1 and AFDP 3-36) via a real Claude API call (2026-09-20). See
// eval/runner/scripts/run-multifile-demo.mjs for how to reproduce, and
// its header comment for why this uses an excerpt of each document
// rather than the full PDFs (a real network-timeout constraint on very
// long-duration requests, documented there — not a shortcut taken for
// convenience).
describe("real synthesis-agent multi-file output (afdp-3-0-1 + afdp-3-36 excerpts, 2026-09-20)", () => {
  const raw = readFileSync(join(__dirname, "fixtures", "real-runs", "multi-file-afdp-3-0-1-and-3-36-excerpt.md"), "utf8");
  const concept = parseConcept(raw, "multi-file-demo.md");

  it("parses as a conformant OKF concept", () => {
    expect(concept.frontmatter.type).toBe("Doctrine Reference");
  });

  it("passes strict-provenance validation cleanly", () => {
    const result = validateStrictProvenance(concept);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("cites BOTH source documents — real cross-document synthesis, not one-file's-worth of content with a second document ignored", () => {
    const doc1Refs = new Set([...concept.body.matchAll(/\[\^afdp-3-0-1-p\d+\]/g)].map((m) => m[0]));
    const doc2Refs = new Set([...concept.body.matchAll(/\[\^afdp-3-36-p\d+\]/g)].map((m) => m[0]));
    expect(doc1Refs.size).toBeGreaterThan(3);
    expect(doc2Refs.size).toBeGreaterThan(3);
  });

  it("is not a concatenation — it explicitly relates the two documents rather than presenting them as separate sections", () => {
    // A genuine synthesis distinguishes what the two sources actually
    // share from what merely echoes thematically; a concatenation
    // wouldn't make this kind of comparative claim at all.
    expect(concept.body).toMatch(/thematic echo|do not cite each other|both publications|two publications/i);
  });

  it("honestly flags its own excerpt-only scope rather than presenting partial coverage as complete (AGENTS.md Section 2)", () => {
    expect(concept.body).toMatch(/caveat|excerpt|not available|beyond the excerpt/i);
  });
});

#!/usr/bin/env node
// Demonstrates @encap/synthesis-agent's multi-file case for real (docs/PLAN.md
// Section 5, Phase 2: "several documents in, one bundle that is a synthesis,
// not a concatenation") — real docling ingest, real Claude API calls.
//
// Uses the first ~15000 chars of each document (roughly its front matter and
// opening chapter) rather than the full PDFs. This is a real, documented
// constraint, not an arbitrary shortcut: synthesizing across BOTH full
// documents (a combined ~100K input tokens, high thinking effort) crashed
// this session's sandbox network path three times in a row with an
// uncaught `AnthropicError: terminated` / `ETIMEDOUT` from the underlying
// TLS stream — a long-duration streaming HTTP connection getting killed
// mid-flight, not a bug in this package's code (@encap/synthesis-agent
// already retries retryable connection errors; this failure mode is an
// uncaught exception from the SDK's stream handling, not a promise
// rejection, so it isn't retryable at that layer — see synthesize.ts's
// isRetryableConnectionError doc comment). A run at this reduced size
// completes in under two minutes and produces genuine cross-document
// synthesis: see test/fixtures/real-runs/multi-file-afdp-3-0-1-and-3-36-excerpt.md
// for the real output this script produced, including the model
// correctly flagging its own excerpt-only scope rather than presenting
// partial coverage as complete (AGENTS.md Section 2).
//
// Usage:
//   export ENCAP_PDF_EXTRACTOR_CMD=$(pwd)/.venv-docling/bin/docling
//   node eval/runner/scripts/run-multifile-demo.mjs

import { ingestDocument, validateStrictProvenance, writeConcept } from "@encap/okf-format";
import { synthesizeMultiFile } from "@encap/synthesis-agent";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

const EXCERPT_CHARS = 15000;
const FIXTURE_IDS = ["afdp-3-0-1-command-and-control", "afdp-3-36-air-mobility-operations"];

async function main() {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "fixtures", "doctrine", "manifest.json"), "utf8"));
  const entries = FIXTURE_IDS.map((id) => {
    const entry = manifest.documents.find((d) => d.id === id);
    if (!entry) throw new Error(`no fixtures/doctrine/manifest.json entry with id "${id}"`);
    return entry;
  });

  console.log(`=== Ingesting both documents fully, then using the first ${EXCERPT_CHARS} chars of each ===`);
  const docs = [];
  for (const entry of entries) {
    const pdfPath = join(repoRoot, "fixtures", "doctrine", entry.localPath);
    const result = await ingestDocument(pdfPath);
    const excerpt = result.markdown.slice(0, EXCERPT_CHARS);
    console.log(`  -> ${entry.id}: full ${result.markdown.length} chars, using first ${excerpt.length}`);
    docs.push({ id: entry.id, title: entry.title, resource: entry.sourceUrl, markdown: excerpt });
  }

  console.log("\n=== Synthesizing across both documents ===");
  const start = Date.now();
  const result = await synthesizeMultiFile(docs, "multi-file-demo.md");
  console.log(`Took ${((Date.now() - start) / 1000).toFixed(1)}s, ${result.usage.inputTokens} input / ${result.usage.outputTokens} output tokens`);

  const outDir = join(__dirname, "..", ".gate-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "multi-file-demo.md");
  const content = writeConcept(result.concept);
  writeFileSync(outPath, content);
  console.log(`Wrote to ${outPath}`);

  const prov = validateStrictProvenance(result.concept);
  console.log(`\nstrict-provenance valid: ${prov.valid}`);
  if (!prov.valid) console.log("errors:", prov.errors);

  for (const entry of entries) {
    const refs = [...new Set([...content.matchAll(new RegExp(`\\[\\^${entry.id}-p\\d+\\]`, "g"))].map((m) => m[0]))];
    console.log(`Distinct ${entry.id} citations: ${refs.length}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

#!/usr/bin/env node
// Runs the Phase 2 competency-question gate (docs/PLAN.md Section 5)
// end-to-end for one fixture: ingest the doctrine PDF (@encap/okf-format),
// synthesize an OKF concept from it (@encap/synthesis-agent), then grade
// it against the fixture's competency-question set (this package).
//
// This makes real, billed Anthropic API calls (ingest is free/local;
// synthesis + per-question answering + judging are not). Requires
// ANTHROPIC_API_KEY and a working docling install (see
// packages/okf-format/README.md — `just setup-docling`).
//
// Usage:
//   node scripts/run-fixture-gate.mjs <fixtureId>
//   node scripts/run-fixture-gate.mjs afdp-3-0-1-command-and-control

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDocument, writeConcept } from "@encap/okf-format";
import { synthesizeSingleFile } from "@encap/synthesis-agent";
import { loadQuestionSet } from "../dist/question-set.js";
import { runCompetencyGate } from "../dist/run-gate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

const fixtureId = process.argv[2];
if (!fixtureId) {
  console.error("Usage: node scripts/run-fixture-gate.mjs <fixtureId>");
  process.exit(1);
}

function findQuestionSetFile() {
  const dir = join(repoRoot, "fixtures", "competency-questions");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".question-set.json")) continue;
    const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (data.fixtureId === fixtureId) return join(dir, file);
  }
  throw new Error(`no question set in fixtures/competency-questions/ with fixtureId "${fixtureId}"`);
}

function findManifestEntry() {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "fixtures", "doctrine", "manifest.json"), "utf8"));
  const entry = manifest.documents.find((d) => d.id === fixtureId);
  if (!entry) throw new Error(`no fixtures/doctrine/manifest.json entry with id "${fixtureId}"`);
  return entry;
}

async function main() {
  const manifestEntry = findManifestEntry();
  const questionSet = loadQuestionSet(findQuestionSetFile());

  console.log(`=== Ingesting ${manifestEntry.localPath} via docling ===`);
  const pdfPath = join(repoRoot, "fixtures", "doctrine", manifestEntry.localPath);
  const ingestResult = await ingestDocument(pdfPath);
  console.log(`Ingested ${ingestResult.markdown.length} chars of Markdown (extractor: ${ingestResult.extractor}, pageAnchorsVerified: ${ingestResult.pageAnchorsVerified})`);

  console.log(`\n=== Synthesizing an OKF concept ===`);
  const synthesisResult = await synthesizeSingleFile(
    {
      id: manifestEntry.id,
      title: manifestEntry.title,
      resource: manifestEntry.sourceUrl,
      markdown: ingestResult.markdown,
    },
    `${manifestEntry.id}.md`,
  );
  console.log(`Synthesis usage: ${synthesisResult.usage.inputTokens} input tokens, ${synthesisResult.usage.outputTokens} output tokens`);

  const outDir = join(__dirname, "..", ".gate-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${manifestEntry.id}.md`);
  const bundleContent = writeConcept(synthesisResult.concept);
  writeFileSync(outPath, bundleContent);
  console.log(`Wrote synthesized concept to ${outPath}`);

  console.log(`\n=== Running the competency-question gate (${questionSet.questions.length} questions) ===`);
  const gateResult = await runCompetencyGate({
    questionSet,
    sourceContext: ingestResult.markdown,
    bundleContext: bundleContent,
  });

  console.log("");
  for (const r of gateResult.results) {
    console.log(`[${r.pass ? "PASS" : "FAIL"}] ${r.question.id}`);
    console.log(`  asGoodAsSource: ${r.verdict.asGoodAsSource}, cites: ${r.verdict.cites}`);
    console.log(`  judge reasoning: ${r.verdict.reasoning}`);
    if (!r.pass) {
      console.log(`  source answer:  ${r.sourceAnswer}`);
      console.log(`  bundle answer:  ${r.bundleAnswer}`);
    }
    console.log("");
  }

  console.log(`=== Result: ${gateResult.passed ? "PASSED" : "FAILED"} ===`);
  console.log(`Fixture: ${gateResult.fixtureId}`);
  console.log(`Questions passed: ${gateResult.results.filter((r) => r.pass).length}/${gateResult.results.length}`);
  console.log(`Compression ratio (bundle/source, chars): ${gateResult.compressionRatio.toFixed(3)} (reported, not gating)`);

  process.exit(gateResult.passed ? 0 : 1);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

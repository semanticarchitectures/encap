#!/usr/bin/env node
// A stand-in for a real PDF extractor (docling or otherwise), used to
// prove ingest.ts's process-boundary contract without depending on a
// real extractor install or a real PDF fixture (see ingest.ts's doc
// comment on doclingExtractor for why gate (b) can't run yet).
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , inputPath, outputDir, mode] = process.argv;

if (mode === "fail") {
  console.error("simulated extractor failure");
  process.exit(1);
}

writeFileSync(
  join(outputDir, "result.md"),
  `# Ingested\n\nFrom: ${inputPath}\n\n<!-- page:1 -->\nPage one content.\n<!-- page:2 -->\nPage two content.\n`,
);

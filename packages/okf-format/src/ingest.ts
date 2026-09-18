// The ingest process-boundary (docs/PLAN.md Section 3.4): PDF-to-Markdown
// extraction happens as a subprocess with a Markdown-in/Markdown-out
// contract, the same way ENSIM treats Portico as a contained boundary.
// No Python leaks past this module — everything else in the repo only
// ever sees the resulting Markdown string.

import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, extname } from "node:path";
import { promisify } from "node:util";
import { renderDoclingDocumentToMarkdown, type DoclingDocument } from "./docling-json.js";

const execFileAsync = promisify(execFile);

export interface ExtractorConfig {
  /** A human-readable name recorded in `IngestResult.extractor`. */
  name: string;
  /** The executable to run. */
  command: string;
  /** Builds the argv (excluding `command`) for one input file, given a scratch output directory. */
  buildArgs: (inputPath: string, outputDir: string) => string[];
  /** Finds the produced output file inside `outputDir` after the command exits. */
  findOutput: (inputPath: string, outputDir: string) => string;
  /** Transforms the raw content of `findOutput`'s file into final Markdown. Defaults to identity (the extractor already emits Markdown directly). */
  parseOutput?: (rawContent: string) => string;
  /** Whether this config's output is known, by an actual verified run, to carry correct page anchors. */
  pageAnchorsVerified: boolean;
}

/**
 * Docling (docs/PLAN.md Section 3.4 names it as the first candidate).
 *
 * Verified 2026-09-18 against docling 2.129.0, run against real files in
 * fixtures/doctrine/ (not just the CLI reference docs, which turned out
 * to be for an older CLI shape — the installed version requires a
 * `convert` subcommand, e.g. `docling convert <source> --output <dir>
 * --to json`, not the bare `docling <source> -o <dir> --to md` the
 * published reference described):
 *
 * - `docling convert --to md` produces good, citable prose (headings,
 *   tables, paragraph structure all survive) but embeds NO page
 *   information whatsoever — confirmed by full-text inspection of a
 *   real run, not assumed.
 * - `docling convert --to json` (docling's native "DoclingDocument"
 *   schema) DOES carry `prov[].page_no` on every text/table/picture
 *   item. So this config asks for JSON and `docling-json.ts` renders it
 *   to Markdown with `<!-- page:N -->` anchors synthesized from that
 *   field — docling itself never produces page-anchored Markdown, this
 *   package does, from data docling does provide.
 * - `--image-export-mode placeholder` is required in practice, not just
 *   preferred: the default (`embedded`) inlines every figure as a
 *   base64 data URI directly in the JSON/Markdown, which blew a 5-page
 *   test document up to 236KB for 3 images. `docling-json.ts` renders
 *   pictures as a plain `<!-- image -->` marker either way, matching
 *   docling's own `--to md` convention for non-embedded images.
 *
 * See `docling-json.ts`'s module doc comment for exactly which document
 * item types this renderer handles and which it doesn't.
 */
export const doclingExtractor: ExtractorConfig = {
  name: "docling",
  command: process.env.ENCAP_PDF_EXTRACTOR_CMD ?? "docling",
  buildArgs: (inputPath, outputDir) => [
    "convert",
    inputPath,
    "--output",
    outputDir,
    "--to",
    "json",
    "--image-export-mode",
    "placeholder",
  ],
  findOutput: (inputPath, outputDir) => {
    const stem = basename(inputPath, extname(inputPath));
    const expected = join(outputDir, `${stem}.json`);
    try {
      readFileSync(expected, "utf8");
      return expected;
    } catch {
      const jsonFiles = readdirSync(outputDir).filter((f) => f.endsWith(".json"));
      if (jsonFiles.length === 1) return join(outputDir, jsonFiles[0]!);
      throw new Error(
        `could not locate docling's output JSON file in ${outputDir} (expected ${expected}, found: ${jsonFiles.join(", ") || "none"})`,
      );
    }
  },
  parseOutput: (rawContent) => renderDoclingDocumentToMarkdown(JSON.parse(rawContent) as DoclingDocument),
  pageAnchorsVerified: true,
};

export interface IngestResult {
  markdown: string;
  extractor: string;
  pageAnchorsVerified: boolean;
}

/**
 * Runs a PDF (or other document) through an extractor subprocess and
 * returns the resulting Markdown. `extractor` defaults to
 * `doclingExtractor` but is fully swappable — pass a different
 * `ExtractorConfig` to use `marker`, a hosted API wrapper script, or
 * anything else with the same input-path-in/Markdown-out shape.
 */
export async function ingestDocument(inputPath: string, extractor: ExtractorConfig = doclingExtractor): Promise<IngestResult> {
  const outputDir = mkdtempSync(join(tmpdir(), "encap-ingest-"));
  try {
    await execFileAsync(extractor.command, extractor.buildArgs(inputPath, outputDir));
    const outputPath = extractor.findOutput(inputPath, outputDir);
    const raw = readFileSync(outputPath, "utf8");
    const markdown = extractor.parseOutput ? extractor.parseOutput(raw) : raw;
    return { markdown, extractor: extractor.name, pageAnchorsVerified: extractor.pageAnchorsVerified };
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

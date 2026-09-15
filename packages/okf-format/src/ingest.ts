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

const execFileAsync = promisify(execFile);

export interface ExtractorConfig {
  /** A human-readable name recorded in `IngestResult.extractor`. */
  name: string;
  /** The executable to run. */
  command: string;
  /** Builds the argv (excluding `command`) for one input file, given a scratch output directory. */
  buildArgs: (inputPath: string, outputDir: string) => string[];
  /** Finds the produced Markdown file inside `outputDir` after the command exits. */
  findOutput: (inputPath: string, outputDir: string) => string;
}

/**
 * Docling (docs/PLAN.md Section 3.4 names it as the first candidate).
 * Flags confirmed against the docling CLI reference
 * (docling-project.github.io/docling/reference/cli/, fetched 2026-09-15):
 * `-o/--output <dir>` (default `.`) and `--to md` (the default export
 * format). NOT confirmed by that reference, and NOT independently
 * verified here (no docling install, no PDF fixture yet — Phase 1 gate
 * (b) is blocked on both): whether docling's Markdown export emits
 * page-anchor markers at all, and if so in what form. Flagging this
 * explicitly per AGENTS.md Section 11 rather than inventing a page-anchor
 * format — resolve it against a real docling run before relying on gate
 * (b), and adjust `findOutput`/post-processing here if page anchors need
 * to be synthesized from `--page-range` batching instead of being native
 * to a single run.
 */
export const doclingExtractor: ExtractorConfig = {
  name: "docling",
  command: process.env.ENCAP_PDF_EXTRACTOR_CMD ?? "docling",
  buildArgs: (inputPath, outputDir) => [inputPath, "-o", outputDir, "--to", "md"],
  findOutput: (inputPath, outputDir) => {
    const stem = basename(inputPath, extname(inputPath));
    const expected = join(outputDir, `${stem}.md`);
    try {
      readFileSync(expected, "utf8");
      return expected;
    } catch {
      // Fall back to "whatever single .md file docling produced" in case
      // its naming convention differs from the expected stem match.
      const mdFiles = readdirSync(outputDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 1) return join(outputDir, mdFiles[0]!);
      throw new Error(
        `could not locate docling's output Markdown file in ${outputDir} (expected ${expected}, found: ${mdFiles.join(", ") || "none"})`,
      );
    }
  },
};

export interface IngestResult {
  markdown: string;
  extractor: string;
  /**
   * Always false until a real run against a real docling install and a
   * real PDF confirms the page-anchor format (see doclingExtractor's
   * doc comment). Downstream citation code MUST check this rather than
   * assuming page anchors are present and correct.
   */
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
    const markdown = readFileSync(outputPath, "utf8");
    return { markdown, extractor: extractor.name, pageAnchorsVerified: false };
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

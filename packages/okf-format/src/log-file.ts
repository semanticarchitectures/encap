import { dumpFrontmatter, parseFrontmatter, splitFrontmatter } from "./frontmatter.js";
import type { LogFile } from "./types.js";

/**
 * Parses a `log.md` file (spec §9): a flat, date-grouped change history.
 * Spec §9 doesn't require frontmatter, but doesn't forbid it either —
 * unlike index.md, and real bundles do carry it (e.g. okf/bundles'
 * `acme_retail/log.md` has `type: Log`). Preserved when present, not
 * required.
 */
export function parseLogFile(raw: string, bundleRelativePath: string): LogFile {
  const { frontmatterText, body } = splitFrontmatter(raw);
  if (frontmatterText === null) {
    return { path: bundleRelativePath, body: raw };
  }
  return { path: bundleRelativePath, frontmatter: parseFrontmatter(frontmatterText), body };
}

export function writeLogFile(logFile: LogFile): string {
  if (!logFile.frontmatter) return logFile.body;
  return `---\n${dumpFrontmatter(logFile.frontmatter)}---\n${logFile.body}`;
}

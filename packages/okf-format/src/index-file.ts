import { dumpFrontmatter, parseFrontmatter, splitFrontmatter } from "./frontmatter.js";
import type { IndexFile } from "./types.js";

/**
 * Parses an `index.md` file (spec §8). Per spec, index files carry no
 * frontmatter except that a bundle-root `index.md` MAY carry
 * `okf_version` (§12) — but this parser is lenient about *where* that
 * shows up (any frontmatter block present is parsed for `okf_version`),
 * and bundle.ts is the one that decides whether to trust it as the
 * bundle's declared version (only true at the root).
 */
export function parseIndexFile(raw: string, bundleRelativePath: string): IndexFile {
  const { frontmatterText, body } = splitFrontmatter(raw);
  if (frontmatterText === null) {
    return { path: bundleRelativePath, body: raw };
  }
  const parsed = parseFrontmatter(frontmatterText);
  const okf_version = typeof parsed.okf_version === "string" ? parsed.okf_version : undefined;
  return { path: bundleRelativePath, okf_version, body };
}

export function writeIndexFile(indexFile: IndexFile): string {
  if (indexFile.okf_version === undefined) return indexFile.body;
  return `---\n${dumpFrontmatter({ okf_version: indexFile.okf_version })}---\n${indexFile.body}`;
}

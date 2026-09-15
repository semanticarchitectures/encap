import { dumpFrontmatter, parseFrontmatter, splitFrontmatter } from "./frontmatter.js";
import { isConformant } from "./validate.js";
import type { Concept, Frontmatter } from "./types.js";

/** `some/path/concept.md` -> `some/path/concept` (spec §2, Concept ID). */
export function pathToConceptId(bundleRelativePath: string): string {
  return bundleRelativePath.replace(/\.md$/, "");
}

export class NotAConceptError extends Error {
  constructor(path: string, reason: string) {
    super(`${path} is not a conformant OKF concept: ${reason}`);
    this.name = "NotAConceptError";
  }
}

/**
 * Parses a concept document's raw file content. Throws `NotAConceptError`
 * if the file has no parseable frontmatter with a non-empty `type` (spec
 * §11) — callers walking a bundle should catch this to classify the file
 * as opaque rather than aborting the whole read.
 */
export function parseConcept(raw: string, bundleRelativePath: string): Concept {
  const { frontmatterText, body } = splitFrontmatter(raw);
  if (frontmatterText === null) {
    throw new NotAConceptError(bundleRelativePath, "no leading --- frontmatter block");
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = parseFrontmatter(frontmatterText);
  } catch (err) {
    throw new NotAConceptError(bundleRelativePath, `malformed YAML frontmatter (${(err as Error).message})`);
  }
  if (!isConformant(parsed)) {
    throw new NotAConceptError(bundleRelativePath, "frontmatter missing a non-empty `type` field");
  }
  return {
    id: pathToConceptId(bundleRelativePath),
    path: bundleRelativePath,
    frontmatter: parsed as Frontmatter,
    body,
  };
}

/** Serializes a Concept back to full markdown file content. */
export function writeConcept(concept: Concept): string {
  return `---\n${dumpFrontmatter(concept.frontmatter as unknown as Record<string, unknown>)}---\n${concept.body}`;
}

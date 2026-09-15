import yaml from "js-yaml";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface SplitFile {
  /** Raw YAML text between the `---` delimiters (not yet parsed). */
  frontmatterText: string;
  /** Everything after the closing delimiter, byte-for-byte as in the source file. */
  body: string;
}

/**
 * Splits a markdown file's raw text into its frontmatter block and body.
 * Returns `frontmatterText: null` when the file has no leading `---`
 * block at all (valid for index.md/log.md per spec §8/§9).
 */
export function splitFrontmatter(raw: string): { frontmatterText: string | null; body: string } {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return { frontmatterText: null, body: raw };
  }
  return { frontmatterText: match[1] ?? "", body: raw.slice(match[0].length) };
}

/**
 * Parses a frontmatter YAML block into a plain object. Throws on
 * malformed YAML. Uses JSON_SCHEMA rather than js-yaml's default
 * (YAML 1.1) schema specifically to disable the implicit `!!timestamp`
 * tag: spec §5 requires every timestamp-valued key to be an ISO 8601
 * *string*, but YAML 1.1 auto-converts an unquoted `2026-06-30T14:00:00Z`
 * into a native JS `Date`, silently violating that contract (and every
 * concept in okf/bundles' real samples writes timestamps unquoted).
 */
export function parseFrontmatter(frontmatterText: string): Record<string, unknown> {
  const parsed = yaml.load(frontmatterText, { schema: yaml.JSON_SCHEMA });
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter must parse to a YAML mapping (object)");
  }
  return parsed as Record<string, unknown>;
}

/** Serializes a frontmatter object back to YAML text (no delimiters). */
export function dumpFrontmatter(frontmatter: Record<string, unknown>): string {
  return yaml.dump(frontmatter, { noRefs: true, lineWidth: -1, schema: yaml.JSON_SCHEMA });
}

/** Reassembles a full markdown file from a frontmatter object and body. */
export function joinFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${dumpFrontmatter(frontmatter)}---\n${body}`;
}

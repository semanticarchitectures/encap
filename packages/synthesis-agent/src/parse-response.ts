import { parseConcept } from "@encap/okf-format";
import type { Concept } from "@encap/okf-format";

const FENCE_RE = /^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```\s*$/;

/**
 * Strips an outer ```markdown fence if the model added one despite the
 * prompt telling it not to — a common LLM habit worth defending against
 * rather than trusting the instruction to always hold.
 */
export function stripOuterFence(raw: string): string {
  const match = FENCE_RE.exec(raw.trim());
  return match ? match[1]! : raw;
}

/** Parses the model's raw output into a Concept at the given bundle-relative path. Throws if the output isn't a conformant OKF concept (spec §11: a parseable frontmatter block with a non-empty `type`). */
export function parseSynthesisOutput(raw: string, path: string): Concept {
  return parseConcept(stripOuterFence(raw), path);
}

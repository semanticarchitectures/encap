import type { Concept, RelationEntry } from "./types.js";

/**
 * The custom `relations:` frontmatter key (docs/PLAN.md Section 3.1):
 * typed edges the OKF link graph doesn't give you (reports-to, commands,
 * informs, authenticates-to, ...). This module only knows the shape
 * (`type`, `target`) — the vocabulary of `type` values and what they
 * mean belongs to @encap/operating-model, not here (AGENTS.md Section
 * 6: nothing outside okf-format parses frontmatter, but the *semantics*
 * of a custom key still live with whichever package owns that
 * vocabulary).
 */
export function relationsOf(concept: Concept): RelationEntry[] {
  return concept.frontmatter.relations ?? [];
}

import type { FootnoteDefinition, FootnoteReference, FootnoteResolution, SourceEntry } from "./types.js";

// A definition line: `[^id]: text...`, anchored to line start.
const DEFINITION_RE = /^\[\^([A-Za-z0-9_-]+)\]:[ \t]?(.*)$/gm;
// Any `[^id]` occurrence not immediately followed by `:` (which would make
// it a definition, not a reference).
const REFERENCE_RE = /\[\^([A-Za-z0-9_-]+)\](?!:)/g;

/** Extracts every `[^id]: text` definition line in `body`. */
export function extractFootnoteDefinitions(body: string): FootnoteDefinition[] {
  const defs: FootnoteDefinition[] = [];
  for (const match of body.matchAll(DEFINITION_RE)) {
    defs.push({ id: match[1]!, text: (match[2] ?? "").trim() });
  }
  return defs;
}

/** Extracts every `[^id]` usage (excluding definition lines themselves). */
export function extractFootnoteReferences(body: string): FootnoteReference[] {
  const definitionLineStarts = new Set<number>();
  for (const match of body.matchAll(DEFINITION_RE)) {
    definitionLineStarts.add(match.index);
  }
  const refs: FootnoteReference[] = [];
  for (const match of body.matchAll(REFERENCE_RE)) {
    // Skip the bracket that opens a definition line itself.
    if (definitionLineStarts.has(match.index)) continue;
    refs.push({ id: match[1]!, offset: match.index });
  }
  return refs;
}

/**
 * Resolves every footnote reference in `body` against a concept's
 * `sources[]` list. A source declared but never cited by a footnote is
 * NOT an error — okf/bundles/acme_retail's own computations carry
 * sources used only to back the computation as a whole, not a specific
 * footnoted sentence. The reverse (a `[^id]` with no matching
 * `sources[].id`, or no matching `[^id]: ...` definition) is what strict
 * provenance mode treats as a defect (see validate.ts).
 */
export function resolveFootnotes(body: string, sources: SourceEntry[] | undefined): FootnoteResolution {
  const references = extractFootnoteReferences(body);
  const definitions = extractFootnoteDefinitions(body);
  const sourceIds = new Set((sources ?? []).map((s) => s.id).filter((id): id is string => Boolean(id)));
  const definitionIds = new Set(definitions.map((d) => d.id));

  const unresolvedReferences = references.filter((r) => !sourceIds.has(r.id));
  const referencesMissingDefinition = references.filter((r) => !definitionIds.has(r.id));

  return { references, definitions, unresolvedReferences, referencesMissingDefinition };
}

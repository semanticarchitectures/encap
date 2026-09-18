import { extractFootnoteDefinitions, extractFootnoteReferences } from "@encap/okf-format";
import type { Concept } from "@encap/okf-format";

/**
 * Guarantees every `[^id]` reference in the body that has a matching
 * `sources[].id` also has a `[^id]: ...` definition line — deterministically,
 * rather than hoping the model wrote them.
 *
 * Found by actually running synthesis against a real doctrine PDF
 * (2026-09-18): the model reliably emits correct `[^id]` references that
 * resolve to real `sources[].id` entries, but reliably OMITS the
 * `[^id]: <label>` definition lines the prompt asks for — despite an
 * explicit instruction to add them. okf-format's `validateStrictProvenance`
 * then fails every single citation on "no matching definition line," even
 * though the citation itself is entirely sound. Since the definition's
 * content is just the matching `sources[].title` — data the response
 * already contains structurally — generating it here is strictly more
 * reliable than re-prompting and hoping.
 *
 * A reference with NO matching `sources[].id` is left alone: that is a
 * real defect (a citation to nothing), not a formatting omission, and
 * should keep failing strict-provenance rather than being papered over.
 */
export function ensureFootnoteDefinitions(concept: Concept): Concept {
  const references = extractFootnoteReferences(concept.body);
  const existingDefinitions = new Set(extractFootnoteDefinitions(concept.body).map((d) => d.id));
  const sourcesById = new Map((concept.frontmatter.sources ?? []).map((s) => [s.id, s] as const));

  const referencedIds = [...new Set(references.map((r) => r.id))];
  const missing = referencedIds.filter((id) => !existingDefinitions.has(id) && sourcesById.has(id));
  if (missing.length === 0) return concept;

  const newDefinitions = missing.map((id) => {
    const source = sourcesById.get(id)!;
    return `[^${id}]: ${source.title ?? source.resource}`;
  });

  const separator = concept.body.endsWith("\n") ? "" : "\n";
  const body = `${concept.body}${separator}\n${newDefinitions.join("\n")}\n`;
  return { ...concept, body };
}

/**
 * Overwrites `generated.by`/`generated.at` with the actual model id used
 * for this call and the actual wall-clock time — never trust the model's
 * own text for these. Found by actually running synthesis (2026-09-18):
 * asked to call itself "synthesis-agent/<model-id>" with the current ISO
 * timestamp, the model wrote a plausible-looking but fabricated model id
 * ("claude-opus-4-6") and a fabricated date nowhere close to the real
 * call time — it does not reliably know either fact about itself.
 */
export function setGeneratedMetadata(concept: Concept, model: string, at: Date = new Date()): Concept {
  return {
    ...concept,
    frontmatter: {
      ...concept.frontmatter,
      generated: { by: `synthesis-agent/${model}`, at: at.toISOString() },
    },
  };
}

import type { SynthesisInputDocument } from "./types.js";

const FRONTMATTER_CONTRACT = `Output exactly one markdown file: a YAML frontmatter block delimited by "---" lines, then a body. Nothing before the opening "---" and nothing after the body (no code fences wrapping the whole file, no commentary).

Frontmatter fields — use ONLY these (this repo's strict-emit schema rejects anything else):
  type: a short descriptive string (e.g. "Doctrine Reference")
  title: string
  description: one sentence
  tags: [ string, ... ]
  sources: a list of { id, resource, title }, one entry PER PAGE you cite, not one per document. id is kebab-case, e.g. "afdp-3-0-1-p12" for page 12 of the afdp-3-0-1 document. resource is the document's given resource URL with "#page=N" appended, e.g. "https://example.com/doc.pdf#page=12".
  generated: { by: "synthesis-agent/<model-id>", at: "<ISO 8601 datetime>" }

Citation contract (mandatory — this is the whole point of this task):
  - Every non-trivial factual claim in the body MUST carry a markdown footnote reference "[^id]" where id matches a sources[].id entry.
  - Add a "[^id]: <short label>" footnote definition line for every reference, grouped at the end of the body.
  - Cite the SPECIFIC page the claim came from — use the nearest preceding "<!-- page:N -->" marker in the source material. Never cite a page the claim didn't actually appear on.
  - Never invent a fact that is not stated in the source material. If something is ambiguous or you are uncertain, say so explicitly in the body rather than asserting it as fact.
  - A claim with no clean page attribution should be left uncited rather than given a fabricated citation — but prefer restructuring the claim to something you CAN cite over dropping it silently.

Do not use any frontmatter field outside the list above (no "author", no "status" unless truly needed, etc.) — the schema is additionalProperties:false.`;

export function singleFileSystemPrompt(): string {
  return `You are the ENCAP synthesis agent (docs/PLAN.md Section 5, Phase 2). Your job: read one source document and produce ONE Open Knowledge Format (OKF) v0.2 concept document that compresses it — capturing what a competent staff officer needs to know, not a shortened restatement of every sentence. This is synthesis, not summarization-by-truncation: organize around the document's real structure and substance, and every claim must be traceable back to a specific page.

${FRONTMATTER_CONTRACT}

The body should use markdown headings to organize the material logically (not necessarily mirroring the source's own heading structure verbatim — synthesize). Prefer structured content (lists, short paragraphs) over long unbroken prose.`;
}

export function multiFileSystemPrompt(): string {
  return `You are the ENCAP synthesis agent (docs/PLAN.md Section 5, Phase 2). Your job: read MULTIPLE source documents and produce ONE Open Knowledge Format (OKF) v0.2 concept document that synthesizes them together — a single coherent account that draws on all of them, cross-references where they relate, and notes where they differ or don't overlap. This is explicitly NOT one section per document concatenated together; organize around the actual subject matter, pulling from whichever source document is relevant to each part.

${FRONTMATTER_CONTRACT}

sources[] entries can come from any of the input documents — use each document's own id as the prefix for its page-level source ids (e.g. "afdp-3-0-1-p12" vs "afdp-3-36-p8"), so a reader can tell which underlying document backs which claim.`;
}

function formatDocument(doc: SynthesisInputDocument): string {
  return `<document id="${doc.id}" title="${doc.title}" resource="${doc.resource}">\n${doc.markdown}\n</document>`;
}

export function singleFileUserMessage(doc: SynthesisInputDocument): string {
  return formatDocument(doc);
}

export function multiFileUserMessage(docs: SynthesisInputDocument[]): string {
  return docs.map(formatDocument).join("\n\n");
}

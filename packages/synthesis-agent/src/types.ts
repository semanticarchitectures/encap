import type Anthropic from "@anthropic-ai/sdk";
import type { Concept } from "@encap/okf-format";

/** One source document fed to the agent: page-anchored Markdown plus enough identity to build real `sources[]` entries. */
export interface SynthesisInputDocument {
  /** Stable id for this source (kebab-case), used as the prefix for per-page `sources[].id` values, e.g. "afdp-3-0-1". */
  id: string;
  title: string;
  /** Canonical URL (or bundle-relative path) identifying this source — becomes `sources[].resource`'s base, with a `#page=N` fragment appended per citation. */
  resource: string;
  /** Page-anchored Markdown, e.g. from @encap/okf-format's `ingestDocument()` (must contain `<!-- page:N -->` markers to cite against). */
  markdown: string;
}

export interface SynthesisOptions {
  /** Defaults to claude-opus-5. */
  model?: string;
  /** Injectable for testing without a real API call. */
  client?: Anthropic;
}

export interface SynthesisResult {
  concept: Concept;
  /** The raw model output before parsing, kept for debugging a failed parse. */
  raw: string;
  usage: { inputTokens: number; outputTokens: number };
}

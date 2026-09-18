import { getDefaultClient, DEFAULT_MODEL } from "./client.js";
import type { RunnerOptions } from "./types.js";

const BASE_INSTRUCTION = `Answer the question using ONLY the information in the context below — no outside knowledge, no assumptions beyond what's written. If the context doesn't actually contain the answer, say so explicitly rather than guessing or inventing one. Be concise: a few sentences, not an essay.`;

const CITATION_INSTRUCTION = `The context is annotated with footnote-style citations ("[^id]" markers that resolve to a sources list within it). When you state a fact drawn from the context, include the same citation marker inline in your answer, e.g. "X is true[^some-id]." Do not invent a citation marker that doesn't appear in the context.`;

function extractText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Answers `question` using only `context` — no outside knowledge. Used
 * both for the "reads only the OKF bundle" run (expectCitations: true)
 * and the "reads the raw source" baseline (expectCitations: false),
 * per docs/PLAN.md Section 5's Phase 2 gate.
 */
export async function answerQuestion(
  question: string,
  context: string,
  expectCitations: boolean,
  opts?: RunnerOptions,
): Promise<string> {
  const client = opts?.client ?? getDefaultClient();
  const model = opts?.model ?? DEFAULT_MODEL;

  const system = expectCitations ? `${BASE_INSTRUCTION}\n\n${CITATION_INSTRUCTION}` : BASE_INSTRUCTION;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: `<context>\n${context}\n</context>\n\n<question>${question}</question>` }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("answerQuestion refused by the model (stop_reason: refusal)");
  }
  return extractText(response.content).trim();
}

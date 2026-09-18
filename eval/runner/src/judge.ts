import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's zodOutputFormat is typed against zod's v4 API surface
// specifically (node_modules/@anthropic-ai/sdk/helpers/zod.d.ts imports
// `zod/v4`) — zod 3.25+ ships that surface at the `zod/v4` subpath, so
// this import must use that subpath, not the plain `zod` v3 API.
import { z } from "zod/v4";
import { getDefaultClient, DEFAULT_MODEL } from "./client.js";
import type { JudgeVerdict, Question, RunnerOptions } from "./types.js";

const VerdictSchema = z.object({
  asGoodAsSource: z
    .boolean()
    .describe("True if the bundle-only answer matches the correctness and completeness of the source-only answer, judged against expectedAnswerNotes."),
  cites: z
    .boolean()
    .describe("True if the bundle-only answer includes at least one citation marker that plausibly supports its claim. False if uncited, or if the citation doesn't actually back the claim made."),
  reasoning: z.string().describe("One or two sentences explaining the verdict."),
});

const JUDGE_SYSTEM = `You are grading a synthesis pipeline's competency-question gate (docs/PLAN.md Section 5, Phase 2). You'll see one question, grading notes for what a competent answer must contain, an answer produced by an agent reading the ORIGINAL raw source, and an answer produced by a different agent reading ONLY a synthesized, cited bundle (never the original source).

Judge two things independently:
1. asGoodAsSource: does the bundle-answer match the source-answer's correctness and completeness against the grading notes? A bundle-answer that is differently worded but equally correct and complete counts as a pass. A bundle-answer that is vague, hedges where the source-answer was specific, or omits something the grading notes call for counts as a fail.
2. cites: does the bundle-answer carry a citation marker, and does that citation actually plausibly support the specific claim it's attached to (not just present anywhere in the answer)?

Be a strict, skeptical grader — the point of this gate is to catch a synthesis that reads fine but quietly lost information or citation discipline.`;

/** Judges one question's bundle-only answer against the source-only baseline. */
export async function judgeAnswer(
  question: Question,
  sourceAnswer: string,
  bundleAnswer: string,
  opts?: RunnerOptions,
): Promise<JudgeVerdict> {
  const client = opts?.client ?? getDefaultClient();
  const model = opts?.model ?? DEFAULT_MODEL;

  const userMessage = [
    `Question: ${question.question}`,
    `Grading notes (what a competent answer must contain): ${question.expectedAnswerNotes}`,
    `Source-reading agent's answer: ${sourceAnswer}`,
    `Bundle-reading agent's answer: ${bundleAnswer}`,
  ].join("\n\n");

  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(VerdictSchema) },
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  if (!response.parsed_output) {
    throw new Error("judge response failed to parse into the expected verdict schema");
  }
  return response.parsed_output;
}

import { answerQuestion } from "./answerer.js";
import { judgeAnswer } from "./judge.js";
import type { GateResult, QuestionResult, QuestionSet, RunnerOptions } from "./types.js";

export interface RunGateInput {
  questionSet: QuestionSet;
  /** The raw source text (e.g. page-anchored ingest Markdown) — the baseline agent's only context. */
  sourceContext: string;
  /** The synthesized OKF bundle's content (frontmatter + body, or however it should be presented to the test agent) — the agent being graded sees ONLY this. */
  bundleContext: string;
}

/**
 * Runs the Phase 2 competency-question gate (docs/PLAN.md Section 5):
 * for each question, an agent reading only `bundleContext` must answer
 * as well as an agent reading only `sourceContext`, and cite. Passes
 * only if every question passes — this gate is not partial credit.
 */
export async function runCompetencyGate(input: RunGateInput, opts?: RunnerOptions): Promise<GateResult> {
  const { questionSet, sourceContext, bundleContext } = input;
  const results: QuestionResult[] = [];

  for (const question of questionSet.questions) {
    const [sourceAnswer, bundleAnswer] = await Promise.all([
      answerQuestion(question.question, sourceContext, false, opts),
      answerQuestion(question.question, bundleContext, true, opts),
    ]);
    const verdict = await judgeAnswer(question, sourceAnswer, bundleAnswer, opts);
    const pass = verdict.asGoodAsSource && verdict.cites;
    results.push({ question, sourceAnswer, bundleAnswer, verdict, pass });
  }

  return {
    fixtureId: questionSet.fixtureId,
    results,
    passed: results.every((r) => r.pass),
    compressionRatio: bundleContext.length / sourceContext.length,
  };
}

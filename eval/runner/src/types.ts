import type Anthropic from "@anthropic-ai/sdk";

/** Mirrors fixtures/competency-questions/question-set.schema.json. */
export interface Question {
  id: string;
  question: string;
  expectedAnswerNotes: string;
  sourceAnchor?: string;
  requiresOperatingModel?: boolean;
}

export interface QuestionSet {
  fixtureId: string;
  description?: string;
  questions: Question[];
}

export interface RunnerOptions {
  model?: string;
  client?: Anthropic;
}

export interface JudgeVerdict {
  /** Does the bundle-only answer match the quality/correctness of the source-only answer? */
  asGoodAsSource: boolean;
  /** Does the bundle-only answer carry a citation that actually resolves to and supports the claim? */
  cites: boolean;
  reasoning: string;
}

export interface QuestionResult {
  question: Question;
  sourceAnswer: string;
  bundleAnswer: string;
  verdict: JudgeVerdict;
  /** asGoodAsSource && cites */
  pass: boolean;
}

export interface GateResult {
  fixtureId: string;
  results: QuestionResult[];
  /** True only if every question passed — docs/PLAN.md Section 5's gate is per-fixture, not partial credit. */
  passed: boolean;
  /** Reported, not gating (docs/PLAN.md Section 5: "Compression ratio is reported but is not the gate"). */
  compressionRatio: number;
}

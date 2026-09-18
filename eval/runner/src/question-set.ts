import { readFileSync } from "node:fs";
import type { QuestionSet } from "./types.js";

/**
 * Loads a competency-question-set JSON file (schema at
 * fixtures/competency-questions/question-set.schema.json). Structural
 * validation against that schema is scripts/validate-fixtures.mjs's job
 * (run by `just validate`); this loader just reads and does a minimal
 * sanity check so a caller gets a clear error instead of `undefined`
 * downstream.
 */
export function loadQuestionSet(path: string): QuestionSet {
  const raw = JSON.parse(readFileSync(path, "utf8")) as QuestionSet;
  if (!raw.fixtureId || !Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new Error(`${path} does not look like a valid question set (missing fixtureId or questions[])`);
  }
  return raw;
}

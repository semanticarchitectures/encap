import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadQuestionSet } from "../src/question-set.js";

const tempDirs: string[] = [];
afterEach(() => {
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function writeTempFile(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "eval-runner-test-"));
  tempDirs.push(dir);
  const path = join(dir, "question-set.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("loadQuestionSet", () => {
  it("loads a well-formed question set", () => {
    const path = writeTempFile({
      fixtureId: "test-fixture",
      questions: [{ id: "q1", question: "What?", expectedAnswerNotes: "Notes." }],
    });
    const qs = loadQuestionSet(path);
    expect(qs.fixtureId).toBe("test-fixture");
    expect(qs.questions).toHaveLength(1);
  });

  it("throws a clear error when fixtureId is missing", () => {
    const path = writeTempFile({ questions: [{ id: "q1", question: "What?", expectedAnswerNotes: "Notes." }] });
    expect(() => loadQuestionSet(path)).toThrow(/fixtureId/);
  });

  it("throws a clear error when questions is empty", () => {
    const path = writeTempFile({ fixtureId: "test", questions: [] });
    expect(() => loadQuestionSet(path)).toThrow();
  });
});

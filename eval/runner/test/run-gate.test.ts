import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { runCompetencyGate } from "../src/run-gate.js";
import type { JudgeVerdict, QuestionSet } from "../src/types.js";

const QUESTION_SET: QuestionSet = {
  fixtureId: "test-fixture",
  questions: [
    { id: "q1", question: "Q1?", expectedAnswerNotes: "Notes 1." },
    { id: "q2", question: "Q2?", expectedAnswerNotes: "Notes 2." },
  ],
};

function fakeClient(verdicts: JudgeVerdict[]): Anthropic {
  let judgeCall = 0;
  return {
    messages: {
      create: async (params: { messages: { content: string }[] }) => {
        const userContent = params.messages[0]?.content ?? "";
        const isSource = userContent.includes("SOURCE_CONTEXT_MARKER");
        return {
          content: [{ type: "text", text: isSource ? "source-side answer" : "bundle-side answer[^cite]" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        } as unknown as Anthropic.Message;
      },
      parse: async () => {
        const verdict = verdicts[judgeCall % verdicts.length]!;
        judgeCall++;
        return { parsed_output: verdict };
      },
    },
  } as unknown as Anthropic;
}

describe("runCompetencyGate", () => {
  it("passes when every question's verdict is asGoodAsSource && cites", async () => {
    const client = fakeClient([{ asGoodAsSource: true, cites: true, reasoning: "ok" }]);
    const result = await runCompetencyGate(
      { questionSet: QUESTION_SET, sourceContext: "SOURCE_CONTEXT_MARKER full source text", bundleContext: "bundle" },
      { client },
    );
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.fixtureId).toBe("test-fixture");
  });

  it("fails the gate if even one question fails (no partial credit)", async () => {
    const client = fakeClient([
      { asGoodAsSource: true, cites: true, reasoning: "ok" },
      { asGoodAsSource: false, cites: true, reasoning: "missed a detail" },
    ]);
    const result = await runCompetencyGate(
      { questionSet: QUESTION_SET, sourceContext: "SOURCE_CONTEXT_MARKER source", bundleContext: "bundle" },
      { client },
    );
    expect(result.passed).toBe(false);
    expect(result.results.filter((r) => r.pass)).toHaveLength(1);
  });

  it("fails a question that is asGoodAsSource but does not cite", async () => {
    const client = fakeClient([{ asGoodAsSource: true, cites: false, reasoning: "no citation" }]);
    const result = await runCompetencyGate(
      { questionSet: { ...QUESTION_SET, questions: [QUESTION_SET.questions[0]!] }, sourceContext: "SOURCE_CONTEXT_MARKER x", bundleContext: "y" },
      { client },
    );
    expect(result.passed).toBe(false);
  });

  it("reports compressionRatio as bundleContext length over sourceContext length", async () => {
    const client = fakeClient([{ asGoodAsSource: true, cites: true, reasoning: "ok" }]);
    const result = await runCompetencyGate(
      {
        questionSet: { ...QUESTION_SET, questions: [QUESTION_SET.questions[0]!] },
        sourceContext: "SOURCE_CONTEXT_MARKER" + "x".repeat(90),
        bundleContext: "y".repeat(50),
      },
      { client },
    );
    expect(result.compressionRatio).toBeCloseTo(50 / 111, 3);
  });
});

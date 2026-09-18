import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { judgeAnswer } from "../src/judge.js";
import type { JudgeVerdict, Question } from "../src/types.js";

const QUESTION: Question = { id: "q1", question: "What?", expectedAnswerNotes: "Must say X." };

function fakeClient(parsed: JudgeVerdict | null): Anthropic {
  return {
    messages: {
      parse: async () => ({ parsed_output: parsed }),
    },
  } as unknown as Anthropic;
}

describe("judgeAnswer", () => {
  it("returns the parsed verdict", async () => {
    const verdict: JudgeVerdict = { asGoodAsSource: true, cites: true, reasoning: "Matches." };
    const result = await judgeAnswer(QUESTION, "source answer", "bundle answer[^id]", { client: fakeClient(verdict) });
    expect(result).toEqual(verdict);
  });

  it("throws if the model's output fails to parse into the verdict schema", async () => {
    await expect(judgeAnswer(QUESTION, "source", "bundle", { client: fakeClient(null) })).rejects.toThrow(/parse/i);
  });
});

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { answerQuestion } from "../src/answerer.js";

function fakeClient(text: string, stopReason: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic {
  let lastSystem: unknown;
  const client = {
    messages: {
      create: async (params: { system?: unknown }) => {
        lastSystem = params.system;
        return {
          content: [{ type: "text", text }],
          stop_reason: stopReason,
          usage: { input_tokens: 10, output_tokens: 5 },
        } as unknown as Anthropic.Message;
      },
    },
  } as unknown as Anthropic;
  return Object.assign(client, { __lastSystem: () => lastSystem });
}

describe("answerQuestion", () => {
  it("returns the model's text answer", async () => {
    const client = fakeClient("The answer is 42.");
    const answer = await answerQuestion("What is the answer?", "some context", false, { client });
    expect(answer).toBe("The answer is 42.");
  });

  it("includes the citation instruction in the system prompt when expectCitations is true", async () => {
    const client = fakeClient("Answer.[^x]") as Anthropic & { __lastSystem: () => unknown };
    await answerQuestion("Q?", "context", true, { client });
    expect(String(client.__lastSystem())).toMatch(/citation/i);
  });

  it("omits the citation instruction when expectCitations is false", async () => {
    const client = fakeClient("Answer.") as Anthropic & { __lastSystem: () => unknown };
    await answerQuestion("Q?", "context", false, { client });
    expect(String(client.__lastSystem())).not.toMatch(/footnote-style citations/i);
  });

  it("throws on stop_reason refusal", async () => {
    const client = fakeClient("I can't help.", "refusal");
    await expect(answerQuestion("Q?", "context", false, { client })).rejects.toThrow(/refus/i);
  });
});

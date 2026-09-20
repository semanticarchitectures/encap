import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { synthesizeMultiFile, synthesizeSingleFile } from "../src/synthesize.js";
import type { SynthesisInputDocument } from "../src/types.js";

const DOC: SynthesisInputDocument = {
  id: "test-doc",
  title: "Test Document",
  resource: "https://example.com/test-doc.pdf",
  markdown: "<!-- page:1 -->\n\n# Heading\n\nSome content on page 1.",
};

const VALID_MODEL_OUTPUT = `---
type: Doctrine Reference
title: Synthesized
description: A synthesis.
sources:
  - id: test-doc-p1
    resource: https://example.com/test-doc.pdf#page=1
    title: Test Document, page 1
generated: { by: synthesis-agent/claude-opus-5, at: 2026-09-18T00:00:00Z }
---

# Summary

Some content.[^test-doc-p1]

[^test-doc-p1]: Test Document, page 1
`;

function fakeClient(text: string, stopReason: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic {
  return {
    messages: {
      stream: () => ({
        finalMessage: async () =>
          ({
            content: [{ type: "text", text }],
            stop_reason: stopReason,
            usage: { input_tokens: 100, output_tokens: 50 },
          }) as unknown as Anthropic.Message,
      }),
    },
  } as unknown as Anthropic;
}

describe("synthesizeSingleFile", () => {
  it("parses a well-formed response into a Concept", async () => {
    const result = await synthesizeSingleFile(DOC, "output.md", { client: fakeClient(VALID_MODEL_OUTPUT) });
    expect(result.concept.frontmatter.type).toBe("Doctrine Reference");
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("strips a fence the model adds despite instructions", async () => {
    const fenced = "```markdown\n" + VALID_MODEL_OUTPUT + "```";
    const result = await synthesizeSingleFile(DOC, "output.md", { client: fakeClient(fenced) });
    expect(result.concept.frontmatter.type).toBe("Doctrine Reference");
  });

  it("throws on stop_reason refusal rather than trying to parse a refusal as a concept", async () => {
    await expect(
      synthesizeSingleFile(DOC, "output.md", { client: fakeClient("I can't help with that.", "refusal") }),
    ).rejects.toThrow(/refus/i);
  });

  it("throws when the model's output isn't a conformant concept (propagated from parseSynthesisOutput)", async () => {
    await expect(
      synthesizeSingleFile(DOC, "output.md", { client: fakeClient("Not a valid OKF document at all.") }),
    ).rejects.toThrow();
  });

  it("throws a clear, diagnosable error on stop_reason max_tokens rather than a bare parse failure — found running a real multi-file synthesis whose output was truncated mid-generation with no frontmatter at all", async () => {
    await expect(
      synthesizeSingleFile(DOC, "output.md", { client: fakeClient("---\ntype: incomple", "max_tokens") }),
    ).rejects.toThrow(/max_tokens/);
  });

  it("includes a snippet of the raw output in a parse-failure error, so a real failure is diagnosable without re-running the (paid) API call", async () => {
    await expect(
      synthesizeSingleFile(DOC, "output.md", { client: fakeClient("This has no frontmatter block whatsoever.") }),
    ).rejects.toThrow(/no frontmatter block whatsoever/);
  });

  it("retries a dropped-connection error (found running a real multi-file synthesis: AnthropicError 'terminated', cause ETIMEDOUT — twice in a row) and succeeds if a later attempt connects", async () => {
    let calls = 0;
    const flakyThenOkClient = {
      messages: {
        stream: () => ({
          finalMessage: async () => {
            calls++;
            if (calls <= 1) {
              const err = new Error("terminated");
              (err as Error & { cause: unknown }).cause = { code: "ETIMEDOUT" };
              throw err;
            }
            return {
              content: [{ type: "text", text: VALID_MODEL_OUTPUT }],
              stop_reason: "end_turn",
              usage: { input_tokens: 100, output_tokens: 50 },
            } as unknown as Anthropic.Message;
          },
        }),
      },
    } as unknown as Anthropic;

    const result = await synthesizeSingleFile(DOC, "output.md", { client: flakyThenOkClient });
    expect(calls).toBe(2);
    expect(result.concept.frontmatter.type).toBe("Doctrine Reference");
  });

  it("gives up after exhausting retries on a persistently dropped connection, rather than retrying forever", async () => {
    const alwaysFlakyClient = {
      messages: {
        stream: () => ({
          finalMessage: async () => {
            const err = new Error("terminated");
            (err as Error & { cause: unknown }).cause = { code: "ETIMEDOUT" };
            throw err;
          },
        }),
      },
    } as unknown as Anthropic;

    await expect(synthesizeSingleFile(DOC, "output.md", { client: alwaysFlakyClient })).rejects.toThrow("terminated");
  });

  it("does NOT retry a non-connection error (e.g. a genuine parse failure) — retrying wouldn't help and would waste API calls", async () => {
    let calls = 0;
    const client = {
      messages: {
        stream: () => ({
          finalMessage: async () => {
            calls++;
            return {
              content: [{ type: "text", text: "no frontmatter here" }],
              stop_reason: "end_turn",
              usage: { input_tokens: 10, output_tokens: 5 },
            } as unknown as Anthropic.Message;
          },
        }),
      },
    } as unknown as Anthropic;

    await expect(synthesizeSingleFile(DOC, "output.md", { client })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe("synthesizeMultiFile", () => {
  it("requires at least 2 documents", async () => {
    await expect(synthesizeMultiFile([DOC], "output.md", { client: fakeClient(VALID_MODEL_OUTPUT) })).rejects.toThrow(
      /at least 2/,
    );
  });

  it("synthesizes across multiple documents", async () => {
    const doc2: SynthesisInputDocument = { ...DOC, id: "test-doc-2", title: "Test Document 2" };
    const result = await synthesizeMultiFile([DOC, doc2], "output.md", { client: fakeClient(VALID_MODEL_OUTPUT) });
    expect(result.concept.frontmatter.type).toBe("Doctrine Reference");
  });
});

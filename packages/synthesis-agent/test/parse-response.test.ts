import { describe, expect, it } from "vitest";
import { parseSynthesisOutput, stripOuterFence } from "../src/parse-response.js";

const VALID_OUTPUT = `---
type: Doctrine Reference
title: Test Concept
description: A test.
sources:
  - id: doc-p1
    resource: https://example.com/doc.pdf#page=1
    title: Doc, page 1
generated: { by: synthesis-agent/claude-opus-5, at: 2026-09-18T00:00:00Z }
---

# Body

A claim.[^doc-p1]

[^doc-p1]: Doc, page 1
`;

describe("stripOuterFence", () => {
  it("removes a ```markdown fence the model added despite instructions", () => {
    const fenced = "```markdown\n" + VALID_OUTPUT + "```";
    expect(stripOuterFence(fenced).trim()).toBe(VALID_OUTPUT.trim());
  });

  it("removes a bare ``` fence with no language tag", () => {
    const fenced = "```\n" + VALID_OUTPUT + "```";
    expect(stripOuterFence(fenced).trim()).toBe(VALID_OUTPUT.trim());
  });

  it("leaves unfenced output untouched", () => {
    expect(stripOuterFence(VALID_OUTPUT)).toBe(VALID_OUTPUT);
  });
});

describe("parseSynthesisOutput", () => {
  it("parses a well-formed synthesis into a Concept", () => {
    const concept = parseSynthesisOutput(VALID_OUTPUT, "output.md");
    expect(concept.frontmatter.type).toBe("Doctrine Reference");
    expect(concept.frontmatter.sources?.[0]?.id).toBe("doc-p1");
    expect(concept.body).toContain("A claim.[^doc-p1]");
  });

  it("throws (not silently accepts) when the model's output has no frontmatter", () => {
    expect(() => parseSynthesisOutput("Just some prose, no frontmatter.", "output.md")).toThrow();
  });

  it("throws when the model's output has frontmatter but no `type`", () => {
    const noType = "---\ntitle: Missing type\n---\n\nBody.";
    expect(() => parseSynthesisOutput(noType, "output.md")).toThrow();
  });
});

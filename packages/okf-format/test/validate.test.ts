import { describe, expect, it } from "vitest";
import {
  isConformant,
  normalizeVerified,
  trustTier,
  validateEmit,
  validateRead,
  validateStrictProvenance,
} from "../src/validate.js";
import type { Concept, Frontmatter } from "../src/types.js";

describe("isConformant (spec §11)", () => {
  it("accepts a bare `type` with nothing else", () => {
    expect(isConformant({ type: "Playbook" })).toBe(true);
  });
  it("rejects a missing type", () => {
    expect(isConformant({})).toBe(false);
  });
  it("rejects an empty-string type", () => {
    expect(isConformant({ type: "" })).toBe(false);
  });
});

describe("validateRead (permissive)", () => {
  it("accepts a minimal concept", () => {
    expect(validateRead({ type: "Metric" }).valid).toBe(true);
  });

  it("tolerates an unknown producer-defined key (spec §4.1: consumers MUST NOT reject for unrecognized fields)", () => {
    const result = validateRead({ type: "Metric", acme_internal_flag: true, nested: { anything: [1, 2, 3] } });
    expect(result.valid).toBe(true);
  });

  it("still requires `type`", () => {
    expect(validateRead({ title: "No type here" }).valid).toBe(false);
  });

  it("accepts a bare `verified` mapping (not just an array) per spec §5.2", () => {
    const result = validateRead({
      type: "Metric",
      verified: { by: "human:kliu@acme", at: "2026-07-01T09:00:00Z" },
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateEmit (strict)", () => {
  const base: Record<string, unknown> = {
    type: "Metric",
    generated: { by: "reference_agent/gemini-2.5-pro", at: "2026-06-20T22:53:05Z" },
  };

  it("accepts a minimal, well-formed emitted concept", () => {
    expect(validateEmit(base).valid).toBe(true);
  });

  it("rejects a missing generated.by (AGENTS.md Section 4: mandatory citation rule)", () => {
    const result = validateEmit({ type: "Metric" });
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown top-level key (additionalProperties: false)", () => {
    const result = validateEmit({ ...base, some_random_key: 1 });
    expect(result.valid).toBe(false);
  });

  it("requires `runtime` when type is Attested Computation", () => {
    const result = validateEmit({ ...base, type: "Attested Computation" });
    expect(result.valid).toBe(false);
  });

  it("accepts an Attested Computation with runtime set", () => {
    const result = validateEmit({ ...base, type: "Attested Computation", runtime: "bigquery" });
    expect(result.valid).toBe(true);
  });

  it("accepts a well-formed relations entry and rejects a malformed one", () => {
    const good = validateEmit({ ...base, relations: [{ type: "reports-to", target: "/roles/dirmobfor.md" }] });
    expect(good.valid).toBe(true);
    const bad = validateEmit({ ...base, relations: [{ type: "reports-to" }] });
    expect(bad.valid).toBe(false);
  });
});

describe("validateStrictProvenance", () => {
  function concept(overrides: Partial<Frontmatter>, body: string): Concept {
    return {
      id: "x",
      path: "x.md",
      frontmatter: {
        type: "Metric",
        generated: { by: "reference_agent/gemini-2.5-pro", at: "2026-06-20T22:53:05Z" },
        ...overrides,
      },
      body,
    };
  }

  it("passes a fully-cited concept", () => {
    const c = concept(
      { sources: [{ id: "rev-policy", resource: "policy.md" }] },
      "Revenue is recognized on delivery.[^rev-policy]\n\n[^rev-policy]: Revenue Recognition Policy",
    );
    const result = validateStrictProvenance(c);
    expect(result.valid).toBe(true);
    expect(result.danglingFootnoteReferences).toEqual([]);
  });

  it("fails when generated.by is absent", () => {
    const c = concept({ generated: undefined }, "No claims.");
    expect(validateStrictProvenance(c).valid).toBe(false);
  });

  it("fails on a footnote with no matching sources[].id", () => {
    const c = concept({ sources: [] }, "A claim.[^ghost]\n\n[^ghost]: text");
    const result = validateStrictProvenance(c);
    expect(result.valid).toBe(false);
    expect(result.danglingFootnoteReferences).toContain("ghost");
  });

  it("fails on a footnote with no matching definition line", () => {
    const c = concept({ sources: [{ id: "rev-policy", resource: "policy.md" }] }, "A claim.[^rev-policy]");
    const result = validateStrictProvenance(c);
    expect(result.valid).toBe(false);
    expect(result.danglingFootnoteReferences).toContain("rev-policy");
  });

  it("does not fail merely because a declared source is uncited (see footnotes.test.ts)", () => {
    const c = concept(
      { sources: [{ id: "rev-policy", resource: "policy.md" }, { id: "orders-table", resource: "orders.md" }] },
      "A claim.[^rev-policy]\n\n[^rev-policy]: text",
    );
    expect(validateStrictProvenance(c).valid).toBe(true);
  });
});

describe("normalizeVerified / trustTier (spec §5.2, §5.3)", () => {
  it("treats absent verified as unverified", () => {
    expect(trustTier({ type: "x" })).toBe("unverified");
    expect(normalizeVerified({ type: "x" })).toEqual([]);
  });

  it("normalizes a bare mapping to a one-element array", () => {
    const fm: Frontmatter = { type: "x", verified: { by: "human:a", at: "2026-01-01T00:00:00Z" } };
    expect(normalizeVerified(fm)).toEqual([{ by: "human:a", at: "2026-01-01T00:00:00Z" }]);
  });

  it("is machine-confirmed when only non-human actors verified", () => {
    const fm: Frontmatter = { type: "x", verified: [{ by: "process:nightly", at: "2026-01-01T00:00:00Z" }] };
    expect(trustTier(fm)).toBe("machine-confirmed");
  });

  it("is human-reviewed when any human: actor verified", () => {
    const fm: Frontmatter = {
      type: "x",
      verified: [
        { by: "process:nightly", at: "2026-01-01T00:00:00Z" },
        { by: "human:kliu@acme", at: "2026-01-02T00:00:00Z" },
      ],
    };
    expect(trustTier(fm)).toBe("human-reviewed");
  });
});

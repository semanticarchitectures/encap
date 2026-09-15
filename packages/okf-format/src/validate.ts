import type { ErrorObject, ValidateFunction } from "ajv";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFootnotes } from "./footnotes.js";
import type { Concept, Frontmatter, VerifiedEntry } from "./types.js";

// ajv and ajv-formats are CommonJS with a plain `export default`, which
// TypeScript's NodeNext resolution (correctly, if inconveniently) treats
// as ambiguous to import as ESM defaults. `require` sidesteps the
// interop question entirely rather than fighting it with `esModuleInterop`
// synthetic-default heuristics.
type AjvInstance = import("ajv").default;

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Ajv2020: new (opts?: object) => AjvInstance = require("ajv/dist/2020.js").default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addFormats: (ajv: AjvInstance) => void = require("ajv-formats").default;

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(join(__dirname, "schema", name), "utf8"));
}

const readSchema = loadSchema("frontmatter.read.schema.json");
const emitSchema = loadSchema("frontmatter.emit.schema.json");

function makeAjv(): AjvInstance {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

const ajvRead = makeAjv();
const validateReadFn: ValidateFunction = ajvRead.compile(readSchema);

const ajvEmit = makeAjv();
const validateEmitFn: ValidateFunction = ajvEmit.compile(emitSchema);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function toResult(valid: boolean, errors: ErrorObject[] | null | undefined): ValidationResult {
  if (valid) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: (errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message}`),
  };
}

/**
 * Conformance per spec §11: parseable frontmatter with a non-empty
 * `type`. This is the ONLY thing readBundle relies on to decide a
 * document is a concept at all — never call this a hard gate beyond
 * that, since consumers MUST NOT reject a document for anything else.
 */
export function isConformant(frontmatter: Record<string, unknown>): boolean {
  return typeof frontmatter.type === "string" && frontmatter.type.length > 0;
}

/**
 * Permissive validation against the full recommended shape (spec §5,
 * §10) — diagnostic only. A failing result here does NOT mean the
 * document should be rejected; only `isConformant` decides that.
 */
export function validateRead(frontmatter: Record<string, unknown>): ValidationResult {
  const valid = validateReadFn(frontmatter);
  return toResult(Boolean(valid), validateReadFn.errors);
}

/**
 * Strict validation against the field vocabulary this project's own
 * tooling emits (AGENTS.md Section 5): additionalProperties: false,
 * `generated.by` always required, `runtime` required for Attested
 * Computation concepts. Callers producing new bundle content (e.g.
 * @encap/synthesis-agent) should call this before writing.
 */
export function validateEmit(frontmatter: Record<string, unknown>): ValidationResult {
  const valid = validateEmitFn(frontmatter);
  return toResult(Boolean(valid), validateEmitFn.errors);
}

export interface StrictProvenanceResult extends ValidationResult {
  /**
   * The syntactically-checkable subset of "every non-trivial claim
   * carries a footnote" (AGENTS.md Section 4): every `[^id]` in the body
   * resolves to both a `sources[].id` and a `[^id]: ...` definition, and
   * `generated.by` is set. It CANNOT verify that every substantive claim
   * actually carries a footnote — a body with zero footnotes and zero
   * claims passes trivially. That judgment belongs to the Phase 2
   * competency-question gate (docs/PLAN.md Section 5), not this
   * function.
   */
  danglingFootnoteReferences: string[];
}

export function validateStrictProvenance(concept: Concept): StrictProvenanceResult {
  const emitResult = validateEmit(concept.frontmatter as unknown as Record<string, unknown>);
  const resolution = resolveFootnotes(concept.body, concept.frontmatter.sources);

  const danglingIds = new Set<string>();
  for (const ref of resolution.unresolvedReferences) danglingIds.add(ref.id);
  for (const ref of resolution.referencesMissingDefinition) danglingIds.add(ref.id);
  const danglingFootnoteReferences = [...danglingIds];

  const errors = [...emitResult.errors];
  if (!(concept.frontmatter.generated && concept.frontmatter.generated.by)) {
    errors.push("generated.by is required in strict-provenance mode");
  }
  for (const ref of resolution.unresolvedReferences) {
    errors.push(`footnote [^${ref.id}] at offset ${ref.offset} has no matching sources[].id`);
  }
  for (const ref of resolution.referencesMissingDefinition) {
    errors.push(`footnote [^${ref.id}] at offset ${ref.offset} has no matching [^${ref.id}]: definition line`);
  }

  return { valid: errors.length === 0, errors, danglingFootnoteReferences };
}

/** Normalizes `verified` to always be an array (spec §5.2: a bare mapping is a one-element list). */
export function normalizeVerified(frontmatter: Frontmatter): VerifiedEntry[] {
  const v = frontmatter.verified;
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export type TrustTier = "unverified" | "machine-confirmed" | "human-reviewed";

/** Derives the trust tier from `verified` per spec §5.3. Advisory, not access control. */
export function trustTier(frontmatter: Frontmatter): TrustTier {
  const entries = normalizeVerified(frontmatter);
  if (entries.length === 0) return "unverified";
  if (entries.some((e) => e.by.startsWith("human:"))) return "human-reviewed";
  return "machine-confirmed";
}

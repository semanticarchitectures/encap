// Core types for OKF v0.2 bundles. Shapes follow okf/SPEC.md; field names
// are copied verbatim from the spec's frontmatter families (§4, §5, §10).

/** `<producer>/<version>`, `human:<id>`, or `process:<id>` (spec §7). */
export type Actor = string;

export interface SourceEntry {
  id?: string;
  resource: string;
  title?: string;
  author?: Actor;
  usage_count?: number;
  last_modified?: string;
  usage_window?: { from: string; to: string };
  [key: string]: unknown;
}

export interface GeneratedInfo {
  by: Actor;
  at?: string;
}

export interface VerifiedEntry {
  by: Actor;
  at: string;
}

export type LifecycleStatus = "draft" | "stable" | "deprecated";

export interface ComputationParameter {
  name: string;
  type: string;
  required?: boolean;
}

export interface ExecutorSpec {
  resource: string;
  receipt?: string[];
  [key: string]: unknown;
}

export interface AttesterSpec {
  resource: string;
  [key: string]: unknown;
}

/**
 * A custom, ENCAP-specific frontmatter key (docs/PLAN.md Section 3.1):
 * typed edges the OKF link graph doesn't give you. Schema lives here;
 * semantics belong to @encap/operating-model.
 */
export interface RelationEntry {
  type: string;
  target: string;
  [key: string]: unknown;
}

/**
 * Frontmatter as parsed from YAML. Deliberately loose (`[key: string]:
 * unknown`) — consumers MUST preserve unknown keys (spec §4.1), so this
 * type is a floor, not a ceiling.
 */
export interface Frontmatter {
  type: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  sources?: SourceEntry[];
  usage_window?: { from: string; to: string };
  generated?: GeneratedInfo;
  verified?: VerifiedEntry | VerifiedEntry[];
  status?: LifecycleStatus;
  stale_after?: string;
  relations?: RelationEntry[];
  okf_version?: string;
  // Attested Computation family (§10.2)
  runtime?: string;
  parameters?: ComputationParameter[];
  computation?: string;
  executor?: ExecutorSpec;
  attester?: AttesterSpec;
  [key: string]: unknown;
}

/** A single concept document: frontmatter plus the verbatim body text. */
export interface Concept {
  /** Concept ID: the file's path within the bundle, `.md` suffix removed. */
  id: string;
  /** Path to the file, relative to the bundle root, including `.md`. */
  path: string;
  frontmatter: Frontmatter;
  /** Everything after the closing frontmatter delimiter, byte-for-byte. */
  body: string;
}

export interface IndexFile {
  path: string;
  /** Only ever present on the bundle-root index.md (spec §8, §12). */
  okf_version?: string;
  body: string;
}

export interface LogFile {
  path: string;
  /** Real bundles sometimes carry frontmatter here even though spec §9 doesn't require it; preserved, not required. */
  frontmatter?: Record<string, unknown>;
  body: string;
}

/** A file present in the bundle that OKF assigns no meaning to (e.g. `viz.html`, executor scripts under `references/`). Copied through verbatim. */
export interface OpaqueFile {
  path: string;
  /** Raw file bytes. */
  content: Buffer;
}

export type LinkKind = "bundle-absolute" | "relative" | "external";

export interface LinkEdge {
  /** The concept (or index.md) this link appears in, as a bundle-relative path. */
  from: string;
  /** The link target exactly as written in the markdown. */
  href: string;
  /** The link's visible text. */
  text: string;
  kind: LinkKind;
  /**
   * For `bundle-absolute`/`relative` links: the href resolved to a
   * bundle-relative path (fragment stripped). Undefined for `external`.
   */
  resolvedPath?: string;
  /** Whether `resolvedPath` names a file that actually exists in the bundle. Always true for `external`. */
  exists: boolean;
}

export interface FootnoteReference {
  id: string;
  /** Character offset in the body where this reference occurs. */
  offset: number;
}

export interface FootnoteDefinition {
  id: string;
  text: string;
}

export interface FootnoteResolution {
  references: FootnoteReference[];
  definitions: FootnoteDefinition[];
  /** Footnote refs with no matching `sources[].id`. */
  unresolvedReferences: FootnoteReference[];
  /** Footnote refs with no matching `[^id]: ...` definition line. */
  referencesMissingDefinition: FootnoteReference[];
}

export interface Bundle {
  /** Absolute path to the bundle root on disk. */
  root: string;
  concepts: Concept[];
  indexFiles: IndexFile[];
  logFiles: LogFile[];
  opaqueFiles: OpaqueFile[];
  /** okf_version declared on the bundle-root index.md, if any. */
  okfVersion?: string;
}

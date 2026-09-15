# @encap/okf-format

Reads, validates, and writes Open Knowledge Format (OKF) v0.2 bundles.
Nothing outside this package parses frontmatter, resolves links, or
handles footnotes (`AGENTS.md` Section 6) — every other package in this
repo goes through this one's API.

## What this implements

- **Bundle read/write** (`bundle.ts`): walks a directory tree, classifies
  every file as a concept, `index.md`, `log.md`, or an opaque pass-through
  file, and can write the whole thing back out. `readBundle` never throws
  on a non-conformant `.md` file — it's reported in `warnings` and the
  file is kept as opaque, per spec §11's "consumers MUST NOT reject a
  bundle" rule.
- **Frontmatter** (`frontmatter.ts`, `concept.ts`): splits a file into its
  YAML frontmatter block and body, byte-for-byte on the body. Uses
  js-yaml's `JSON_SCHEMA` rather than its default schema specifically to
  keep ISO 8601 timestamps as strings — YAML 1.1's default schema
  silently converts an unquoted `2026-06-30T14:00:00Z` into a native
  `Date`, which every real sample bundle's frontmatter would otherwise
  trip over.
- **Two validation levels** (`validate.ts`), matching `AGENTS.md` Section
  5's "reading is permissive, emitting is strict" split:
  - `validateRead` / `isConformant`: the spec §11 bar — a non-empty
    `type` is the only hard requirement. Diagnostic only; never used to
    reject a bundle read.
  - `validateEmit`: the strict schema this project's own tooling must
    satisfy when producing new content — `additionalProperties: false`
    against the known field vocabulary, `generated.by` always required,
    `runtime` required when `type` is `Attested Computation`.
  - `validateStrictProvenance`: `validateEmit` plus the syntactically
    checkable subset of AGENTS.md Section 4's mandatory-citation rule —
    every `[^id]` in the body resolves to both a `sources[].id` and a
    `[^id]: ...` definition, and `generated.by` is set. It **cannot**
    verify that every substantive claim actually carries a footnote
    (that's unenforceable by syntax alone); that judgment belongs to the
    Phase 2 competency-question gate.
- **Links** (`links.ts`): extracts every markdown link as a directed
  edge, classified `bundle-absolute` / `relative` / `external`, resolved
  to a bundle-relative path with broken links flagged (`exists: false`)
  rather than rejected.
- **Footnotes** (`footnotes.ts`): extracts `[^id]` references and
  `[^id]: ...` definitions, and resolves references against a concept's
  `sources[]`. A source declared but never cited is **not** flagged — real
  bundles do this (e.g. `acme_retail`'s `revenue-ytd.md` cites its policy
  source but not its table source, because the source backs the whole
  computation, not one footnoted sentence).
- **`relations:`** (`relations.ts`, `types.ts`): the custom frontmatter
  key from `docs/PLAN.md` Section 3.1. Schema only (`{ type, target,
  note? }`) — the vocabulary of `type` values belongs to
  `@encap/operating-model`.
- **Ingest** (`ingest.ts`): the process-boundary contract from
  `docs/PLAN.md` Section 3.4 — a subprocess extractor turns a PDF into
  Markdown. See "Ingest / extractor swapping" below; **gate (b) is
  blocked** until `fixtures/doctrine/manifest.json` has a real PDF.

## Phase 1 exit gate status

**(a) — done.** Every bundle in Google's `knowledge-catalog` repo's
`okf/bundles/` (not `okf/samples/`, which are seed configs for running
their `reference_agent`, not bundles themselves — a correction to
`docs/KICKOFF.md`'s wording worth noting for whoever reads this next)
round-trips read → write with the body byte-for-byte identical and the
frontmatter structurally equal, across all four real bundles
(`acme_retail`, `crypto_bitcoin`, `ga4`, `stackoverflow` — copied into
`test/fixtures/okf-samples/`, attribution in the repo root `NOTICE`).
Link graph and footnote resolution are covered against both synthetic
cases and this real content (`test/bundle-integration.test.ts` includes
a concrete example of `validateStrictProvenance` correctly passing a
verified `acme_retail` concept and correctly failing a `stackoverflow`
concept whose footnotes never join to a declared source — bare OKF
conformance allows that; `AGENTS.md` Section 4 does not).

**(b) — blocked, not started.** `fixtures/doctrine/manifest.json` is
still empty (Kevin's download step, `docs/PLAN.md` Section 8). Per
`docs/KICKOFF.md`: stopping here rather than substituting a different
document. The ingest module (`ingest.ts`) is implemented and unit-tested
against a fake extractor (`test/ingest.test.ts`) so the process-boundary
contract itself is proven; what's unverified is docling's *actual*
Markdown output against a real PDF — see the doc comment on
`doclingExtractor` for exactly what's confirmed (its CLI flags, via the
published CLI reference) versus not (whether/how it emits page anchors).

## Ingest / extractor swapping

`ingestDocument(inputPath, extractorConfig?)` runs a subprocess and reads
back the Markdown it produces; nothing else in this package or its
callers needs to know what tool actually did the conversion. To swap
extractors, pass a different `ExtractorConfig`:

```ts
import { ingestDocument, type ExtractorConfig } from "@encap/okf-format";

const marker: ExtractorConfig = {
  name: "marker",
  command: "marker_single",
  buildArgs: (inputPath, outputDir) => [inputPath, "--output_dir", outputDir],
  findOutput: (inputPath, outputDir) => /* ... */,
};

await ingestDocument("/path/to/doc.pdf", marker);
```

The default (`doclingExtractor`) can also be redirected to a different
binary on `PATH` via the `ENCAP_PDF_EXTRACTOR_CMD` environment variable
without writing a new config, as long as it accepts docling's own flag
shape (`<input> -o <dir> --to md`).

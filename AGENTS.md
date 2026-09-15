# AGENTS.md — conventions for AI coding tools working in this repo

This repo (ENCAP) is intended to be built entirely by AI coding tools (Claude Code, Cursor, Kiro), the same way its sibling ENSIM was. These conventions exist because that only works reliably if generation is grounded and bounded — read this before generating or editing anything. They are adapted from ENSIM's `AGENTS.md` (github.com/semanticarchitectures/ENSIM); Sections 9–11 are new and specific to what this project does.

## 1. Read the plan first

`docs/PLAN.md` is the source of truth for what this system is, why, and in what order it gets built. If a task seems to conflict with it, stop and flag the conflict rather than silently deviating. Decisions already made and not open for re-litigation without an explicit human request: the OKF bundle on disk is the canonical document graph and `document-graph/` is a derived index over it; typed relations live in a custom `relations:` frontmatter key; the index is embedded SQLite (FTS + vectors) with no graph database; the stack is TypeScript + npm workspaces everywhere, with document extraction isolated behind a process boundary; the license is Apache 2.0; ENSIM data is read from a pinned-commit snapshot; the operating model is an OKF *profile*, not a separate interface; and every claim in synthesis output carries a citation. The plan records, under each decision, what evidence would reopen it — cite that evidence if you think a decision should change, and ask; don't act on it.

## 2. Ground everything in cited sources — never invent to fill a gap

Every fact this repo produces or encodes must be traceable to a real source: a doctrine publication, the OKF specification, ENSIM's `org-doctrine-model` records (which carry their own `doctrineSource` citations), or a document in `fixtures/`. If you can't verify something, say so explicitly where the gap is — a `note` field, a flagged footnote, a TODO with the uncertainty named — rather than filling it with a plausible-sounding invention. This is the single most damaging failure mode for this project, more damaging than incomplete output, because the product *is* an agent that must not do exactly that.

When converting ENSIM's data into an operating-model bundle, every `doctrineSource` note comes across unchanged, including the ones ENSIM flagged as unverified. Never upgrade a source's authority in translation.

## 3. The classification boundary is a hard line, in both directions

Nothing in this repo may require, encode, approximate, or reference classified or CUI information — no real system names presented as authentic, no data or interface details that aren't independently available from a public source. That is ENSIM's rule and it applies here unchanged.

This project adds the input side. ENCAP synthesizes documents, so the documents it is tested on are part of the repo's surface. Only documents marked approved for public release with unlimited distribution may be placed in `fixtures/`, committed, or synthesized. `fixtures/doctrine/manifest.json` records each file's source URL, hash, publication date, and distribution statement; a file with no manifest entry, or a distribution statement that is anything other than unlimited public release, does not get used — flag it to a human. Never write code that fetches documents from `.mil` or any other source at run time to bypass the manifest.

## 4. Per-claim citation is mandatory, not optional

OKF makes `sources[]` and per-claim footnotes optional. In this repo they are not. Every OKF bundle the synthesis agent produces must pass `okf-format/`'s strict-provenance validation: every non-trivial claim in a concept document's body carries a Markdown footnote that resolves to a `sources[].id` in that document's frontmatter, with a page or section anchor where the source has one; `generated.by` and `generated.at` are always set. A bundle that fails strict provenance is a failing test, not a warning. Don't weaken the validator to make a test pass — fix the output, or flag why the source can't support the claim.

## 5. Schema-first, not schema-optional

JSON Schema (2020-12, validated with `ajv`) is canonical for every structured shape in this repo: OKF frontmatter, the operating-model profile, `relations:` entries, access assignments, the persona-driver contract, the fixtures manifest. Don't add fields to data that aren't in the schema (schemas use `additionalProperties: false` on purpose — with one deliberate exception: OKF frontmatter must *preserve* unknown keys, per the spec, so `okf-format/`'s schema for *reading* is permissive and its schema for what *this project emits* is strict). Don't hand-write duplicate type definitions; generate them from the schema. Run the package's validate script after any change to a schema or to data.

## 6. OKF is v0.2 and will change — contain it

Nothing outside `packages/okf-format/` parses frontmatter, resolves links, or handles footnotes. Every other package goes through `okf-format/`'s API. When Google publishes a new OKF version, the change is confined to one package. Pin `okf_version` in every bundle this project writes.

## 7. License provenance

This repo is Apache 2.0. The OKF spec's repository (`GoogleCloudPlatform/knowledge-catalog`) is also Apache 2.0; anything borrowed from it — sample bundles used as test fixtures, validator logic — is attributed in `NOTICE`. ENSIM data snapshots under `eval/ensim-harness/fixtures/` carry ENSIM's license and the commit SHA they came from. Before quoting or adapting anything with a non-OSI or unclear license, flag it to a human first.

## 8. Package boundaries and the one-directional ENSIM dependency

`okf-format/` depends on nothing else in this repo. `operating-model/` depends only on `okf-format/`. Everything else depends on those two, never the reverse. ENCAP depends on ENSIM (as a pinned data snapshot, never as a live import); ENSIM does not depend on ENCAP and must not need to know it exists — never propose a change to ENSIM to make ENCAP's job easier; write it down as an ENSIM-side request for a human to take across. Document extraction (PDF → Markdown) is a process boundary with a Markdown-in/Markdown-out contract; no Python or extractor-specific code leaks past `okf-format/`'s ingest step.

## 9. Build in the order the plan gives, gate by gate

`docs/PLAN.md` Section 5 gives a vertical slice: `okf-format/`, then single-file synthesis with the competency-question gate, then the operating-model profile and ENSIM harness, then the index, then access control, then the apps. Each phase has an exit gate. Don't start the next phase's package because it looks straightforward; the order exists so that the synthesis gate — the only real test of whether "compression that reflects understanding" is happening — is reached as early as possible. If you finish a phase and the gate can't be run (for example, the doctrine PDFs aren't in `fixtures/` yet), stop and say so rather than substituting an easier gate.

## 10. The eval harness is the only place ENSIM's data is touched, and the console is evaluated only against personas

Real enterprise documents and real people never enter this repo. `eval/ensim-harness/` is where ENSIM's operating model is converted and where evaluations run; `apps/personnel-console/` is exercised only by the scripted persona driver (or, later, ENSIM's own T&E agents) acting as a `Role` from the operating model. If a task asks for the console to be pointed at anything else, treat it as out of scope until a human explicitly says otherwise.

## 11. When in doubt

Ask, or leave a clearly marked TODO citing what's uncertain, rather than filling a gap with a plausible-sounding invention. That applies to source facts, to license terms, to the OKF spec's intent where it is ambiguous, and to architectural decisions not already settled in `docs/PLAN.md`.

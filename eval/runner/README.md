# @encap/eval-runner

The competency-question runner used by every phase gate from Phase 2
onward: for a fixture, load its question set (schema at
`fixtures/competency-questions/`), run it against an agent that can see
only the OKF bundle output (never the raw source), and score whether the
answers match what a competent staff officer should know and whether
every answer cites. Phase 4 re-implements this runner on top of
`@encap/document-graph`'s query API with identical results, as that
phase's exit gate.

## How the gate works (`src/run-gate.ts`)

For each question in a question set:

1. `answerQuestion` (`src/answerer.ts`) is called twice with the *same*
   question but different, disjoint context: once with only the raw
   source text, once with only the synthesized OKF bundle's content. Each
   call is told to use *only* the given context — no outside knowledge —
   and the bundle call is additionally told the context carries
   `[^id]`-style citations it should cite back to.
2. `judgeAnswer` (`src/judge.ts`) grades the bundle-answer against the
   source-answer and the question's `expectedAnswerNotes`, using
   structured outputs (`zodOutputFormat`, not free-text parsing) for a
   reliable `{ asGoodAsSource, cites, reasoning }` verdict. Note: this
   package imports Zod from the `zod/v4` subpath, not plain `zod` —
   `@anthropic-ai/sdk`'s `zodOutputFormat` is typed against zod's v4 API
   surface specifically, which zod 3.25+ ships at that subpath.
3. A question passes only if both `asGoodAsSource` and `cites` are true.
   The fixture passes only if every question passes — no partial credit,
   matching `docs/PLAN.md` Section 5's wording.

Compression ratio (bundle length / source length) is computed and
reported on every run but never gates — per the plan, it's a metric, not
a pass condition.

## Running the gate for real (`scripts/run-fixture-gate.mjs`)

```
just setup-docling   # once, if not already done (packages/okf-format)
export ENCAP_PDF_EXTRACTOR_CMD=$(pwd)/.venv-docling/bin/docling
node eval/runner/scripts/run-fixture-gate.mjs <fixtureId>
```

Orchestrates the full pipeline for one fixture end to end: ingests the
doctrine PDF (`@encap/okf-format`), synthesizes an OKF concept from it
(`@encap/synthesis-agent`), runs the gate above, and writes the
synthesized concept to `.gate-output/<fixtureId>.md` (gitignored) for
inspection. Makes real, billed Anthropic API calls — this is not part of
`npm test`, which uses injected fake clients throughout and costs
nothing.

`<fixtureId>` must match both a `fixtures/doctrine/manifest.json` entry's
`id` and a `fixtures/competency-questions/*.question-set.json`'s
`fixtureId`.

### Real result (`afdp-3-0-1-command-and-control`, 2026-09-18)

Run twice end-to-end against the real PDF: first run passed all 7
questions; a second run (after fixing two real defects found along the
way — see `@encap/synthesis-agent`'s README) passed 6 of 7, missing one
specific enumerated detail the synthesis happened to omit that run. Both
runs' synthesized bundles passed `@encap/okf-format`'s
`validateStrictProvenance` cleanly on the second run (the first run
predates the footnote-definition fix and would have failed it). This
gate is inherently probabilistic — it depends on LLM synthesis and LLM
judging on both sides — so a single passing run is evidence the pipeline
works, not a permanent guarantee every future run passes.

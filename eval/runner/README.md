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

## Running the multi-file demo for real (`scripts/run-multifile-demo.mjs`)

```
export ENCAP_PDF_EXTRACTOR_CMD=$(pwd)/.venv-docling/bin/docling
node eval/runner/scripts/run-multifile-demo.mjs
```

Same idea as the fixture gate, but exercises `synthesizeMultiFile`
(several documents in, one synthesized concept out) against excerpts of
two real doctrine PDFs. Uses only the first ~15000 characters of each
document, not the full PDFs — see the script's header comment for why:
synthesizing across both FULL documents (~100K combined input tokens,
high thinking effort) crashed this session's sandbox network path three
times in a row with an uncaught `AnthropicError: terminated` /
`ETIMEDOUT` from the underlying TLS stream — a long-duration streaming
connection getting killed mid-flight, not a bug in the synthesis code
(`@encap/synthesis-agent` already retries retryable connection errors;
this specific failure is an uncaught exception from the SDK's stream
handling, not a promise rejection, so it isn't retryable at that layer).
A run at the reduced size completes in under two minutes.

### Real result (`afdp-3-0-1` + `afdp-3-36` excerpts, 2026-09-20)

Ran for real, produced genuine cross-document synthesis rather than a
concatenation: it explicitly compares the two publications ("AFDP 3-36
does not develop the CC-DC-DE framework, but it does list mission
command first...", correctly distinguishing a real shared concept from
a merely thematic echo it declined to overclaim as a cross-reference),
cites both documents densely (7+ distinct pages each), passes
`validateStrictProvenance` cleanly, and — notably — explicitly flags its
own excerpt-only scope in the body ("Claims below are therefore limited
to what appears in the reviewed pages; the absence of a topic here
should not be read as its absence from the publications") rather than
presenting partial coverage as complete, per `AGENTS.md` Section 2.
Frozen as a fixture in `test/fixtures/real-runs/` with a regression test
that checks these properties without needing another live API call.

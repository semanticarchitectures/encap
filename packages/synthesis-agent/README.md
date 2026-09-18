# @encap/synthesis-agent

One file in, one OKF concept out — every claim footnoted to a source with
a page anchor, `generated.by` always set. Then the multi-file case:
several documents in, one concept that is a synthesis, not a
concatenation. In Phase 3 the agent will also load an operating-model
bundle before synthesizing, so it reasons inside the enterprise's
doctrine, structure, and ontology rather than in a vacuum — not built
yet.

Uses `@anthropic-ai/sdk` directly (`claude-opus-5` by default), not the
Claude Agent SDK — v1 is a single request/response synthesis task, not
an open-ended agentic loop.

## How it works

`synthesizeSingleFile(doc, outputPath, opts?)` and `synthesizeMultiFile(docs, outputPath, opts?)`
(`src/synthesize.ts`) send a source document's page-anchored Markdown
(from `@encap/okf-format`'s `ingestDocument`) to Claude with a system
prompt (`src/prompts.ts`) that spells out the exact frontmatter
vocabulary `@encap/okf-format`'s strict-emit schema requires, the
per-page citation convention (`sources[].id` like `afdp-3-0-1-p12`,
`resource` with a `#page=N` fragment), and the "never invent, say so
when uncertain" rule applied to the model's own output. The raw response
is parsed via `@encap/okf-format`'s `parseConcept` (`src/parse-response.ts`)
— a malformed or non-conformant response fails exactly the same way any
other non-conformant concept would.

### Two real defects found by actually running this against a real PDF, both fixed deterministically rather than by re-prompting and hoping (`src/post-process.ts`)

Running `synthesizeSingleFile` against AFDP 3-0.1's full 64 pages
(2026-09-18) surfaced two real problems no amount of code review would
have caught:

1. **Missing footnote definitions.** The model reliably wrote correct
   `[^id]` references resolving to real `sources[].id` entries, but
   reliably omitted the `[^id]: <label>` definition lines the prompt
   explicitly asks for — despite the instruction. Verified with
   `@encap/okf-format`'s `validateStrictProvenance`: every single
   citation failed with "no matching definition line," even though
   every citation was otherwise sound. Fixed by generating the missing
   definition lines deterministically from `sources[].title` after
   parsing, rather than trusting the model to write them — the content
   already exists structurally, so there's no reason to leave it to
   chance.
2. **Fabricated self-identification.** Asked to set
   `generated: { by: "synthesis-agent/<model-id>", at: "<ISO 8601>" }`,
   the model wrote a plausible-looking but entirely made-up model id
   (`claude-opus-4-6`, when the actual call used `claude-opus-5`) and a
   fabricated date nowhere near the real call time. The model does not
   reliably know either fact about itself. Fixed by overwriting
   `generated` deterministically from the real `model` parameter and
   `Date.now()` after the call, ignoring whatever the model wrote.

Both are covered by `test/post-process.test.ts` against the exact shape
of the real failure, so a regression here would be caught by `npm test`
without needing another live API call.

## Phase 2 gate status

Run for real end-to-end via `eval/runner/scripts/run-fixture-gate.mjs`
(see that package's README) against `afdp-3-0-1-command-and-control`:
first run passed all 7 competency questions cleanly; a second run (after
the two fixes above) passed 6 of 7 — the miss was the synthesis omitting
one specific enumerated detail (the echelon levels Distributed Control
can be delegated to) that the source-reading baseline happened to
include. This is real run-to-run variance in what gets synthesized, not
a bug: LLM-judged gates like this one are not perfectly deterministic,
and a single passing run does not guarantee every future run passes. See
`docs/PLAN.md` Section 5's framing — the competency-question gate exists
precisely because "reflects understanding" needs a real, falsifiable
measurement, and a probabilistic pass rate is part of the honest answer,
not a flaw to paper over.

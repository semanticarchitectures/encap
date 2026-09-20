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

### Two more real defects found running `synthesizeMultiFile` against two full PDFs together

1. **Output truncation at the default token ceiling.** The original
   `MAX_TOKENS = 16000` (fine for single-file synthesis of one ~64-page
   document) produced output with no frontmatter at all when synthesizing
   across two full documents (~100K combined input tokens) — the request
   likely needed more thinking + output budget than the ceiling allowed.
   Fixed by raising `MAX_TOKENS` to 32000 and, more importantly, by
   checking `response.stop_reason === "max_tokens"` explicitly and
   throwing a clear, diagnosable error instead of a bare downstream parse
   failure.
2. **Dropped connections on long-duration requests.** Even after fixing
   (1), synthesizing across both full documents crashed three times in a
   row with an uncaught `AnthropicError: terminated` (`cause: ETIMEDOUT`)
   from the underlying TLS stream — this session's sandbox network path
   killing a long-lived streaming connection mid-flight. `runSynthesis`
   now retries a small, specific set of connection-level errors
   (`isRetryableConnectionError`) up to `MAX_NETWORK_RETRIES` times. This
   specific failure mode is an **uncaught exception from the SDK's stream
   handling, not a promise rejection** — the retry logic does catch and
   retry it correctly (`test/synthesize.test.ts` proves this with an
   injected flaky-then-ok client), but on the real full-document run the
   same failure recurred on every attempt, meaning something about that
   request's duration or size reliably trips the same network limit
   rather than the transient blip application-level retry is meant for.
   Reducing input size (see `eval/runner`'s multi-file demo, which uses
   an excerpt of each document) reliably avoids it. A genuinely robust
   fix for very large multi-file inputs — chunking, a lower effort
   level, or running outside this specific sandboxed network — is future
   work, not yet built.

## Phase 2 gate status

**Single-file.** Run for real end-to-end via
`eval/runner/scripts/run-fixture-gate.mjs` (see that package's README)
against `afdp-3-0-1-command-and-control`: first run passed all 7
competency questions cleanly; a second run (after the two fixes above)
passed 6 of 7 — the miss was the synthesis omitting one specific
enumerated detail (the echelon levels Distributed Control can be
delegated to) that the source-reading baseline happened to include. This
is real run-to-run variance in what gets synthesized, not a bug:
LLM-judged gates like this one are not perfectly deterministic, and a
single passing run does not guarantee every future run passes. See
`docs/PLAN.md` Section 5's framing — the competency-question gate exists
precisely because "reflects understanding" needs a real, falsifiable
measurement, and a probabilistic pass rate is part of the honest answer,
not a flaw to paper over.

**Multi-file.** Run for real via `eval/runner/scripts/run-multifile-demo.mjs`
against excerpts of two documents (full-document synthesis hit the
network-timeout issue above): produced genuine cross-document synthesis
— explicit comparison between the two publications, correctly
distinguishing a real shared concept from a merely thematic parallel,
dense citation of both sources, and an honest note about its own
excerpt-only scope rather than presenting partial coverage as complete.
See `eval/runner`'s README for the full account.

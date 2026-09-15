# @encap/eval-runner

The competency-question runner used by every phase gate from Phase 2
onward: for a fixture, load its question set (schema at
`fixtures/competency-questions/`), run it against an agent that can see
only the OKF bundle output (never the raw source), and score whether the
answers match what a competent staff officer should know and whether
every answer cites. Phase 4 re-implements this runner on top of
`@encap/document-graph`'s query API with identical results, as that
phase's exit gate.

Not yet implemented. Built in Phase 2, alongside `@encap/synthesis-agent`,
since the competency-question suite *is* that phase's gate. See
`docs/PLAN.md` Section 5 (Phase 2) and `fixtures/competency-questions/`.

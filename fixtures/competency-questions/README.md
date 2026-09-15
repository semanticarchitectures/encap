# fixtures/competency-questions/

One question set per fixture, validating against `question-set.schema.json`.
This is the device the Phase 2 and Phase 3 gates run on (`docs/PLAN.md`
Section 5): a synthesized OKF bundle passes only if an agent reading
*only the bundle* answers these as well as an agent reading the raw
source, and every answer carries a citation.

`example.question-set.json` is a template, not a real question set — it
is not graded against anything. Real question sets get added once a
doctrine PDF exists in `fixtures/doctrine/` (Phase 1 gate (b)) and
`@encap/synthesis-agent` can produce a bundle to test against (Phase 2).

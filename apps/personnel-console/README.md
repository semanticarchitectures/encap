# @encap/personnel-console

The governance layer for human-agent interaction: session identity bound
to a `Role` document, every agent action gated by `@encap/access-control`,
every response carrying its citations, and a reliability layer that
refuses unsourced answers. Exercised only by a scripted persona driver
replaying fixed prompts as a role (or, later, ENSIM's own T&E agents) —
never by real people or real enterprise documents (`AGENTS.md` Section
10).

Not yet implemented. Built in Phase 6, last. Its exit gate: an adversarial
script — a persona attempting to reach documents outside its role, and to
get an uncited answer — with every attempt denied and logged. The
persona-driver contract it implements against is published in Phase 3.
See `docs/PLAN.md` Section 5 (Phase 3 and Phase 6).

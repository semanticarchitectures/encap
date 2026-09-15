# @encap/operating-model

The operating model is itself an OKF bundle with a required profile, not a
separate interface: concept documents use a fixed set of `type` values
(Organization, Role, C2Node, DoctrineProcess, System, Interaction,
Decision — ENSIM's seven, generalized) and a required `relations:`
frontmatter list. This package is a *profile* over `@encap/okf-format` —
a schema plus validators — rather than a bespoke API, so the synthesis
agent's context and the document library are the same shape and live in
the same index.

Not yet implemented. Built in Phase 3, after the single-file synthesis
gate (Phase 2) passes. See `docs/PLAN.md` Section 4 and Section 5
(Phase 3) for the full decision and build order, and Section 3.1 for why
typed relations live in a custom `relations:` key instead of a second
graph store.

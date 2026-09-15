# @encap/access-control

Access assignments as data: which `Role` documents (from the operating
model) may reach which documents, document types, and capabilities.
Enforcement happens at `@encap/document-graph`'s query API, so every read
the synthesis agent or the personnel console makes is a read *as* a role,
not an unchecked file read.

Not yet implemented. Built in Phase 5. Its exit gate: a role from the
ENSIM bundle with no assignment to a document cannot retrieve it through
any query path, and the denial is logged with the role and the rule that
denied it. See `docs/PLAN.md` Section 5 (Phase 5).

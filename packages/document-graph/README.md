# @encap/document-graph

The OKF bundle on disk *is* the canonical document graph. This package is
a derived, rebuildable index over it — embedded SQLite with FTS5 for
text, a vector extension for embeddings, and ordinary tables for the link
graph and typed `relations:`. Rebuilt from the bundle by one command, so
it is never the source of truth and can be thrown away when real query
patterns are known. Exposes a query API (find by type, follow relations
to depth *n*, semantic nearest-neighbors, "everything this claim cites")
and hides the store behind it.

Not yet implemented. Built in Phase 4. Its exit gate re-implements the
Phases 2–3 competency-question runner on top of this index instead of
reading files directly, with identical results, and the index rebuild
must be idempotent. See `docs/PLAN.md` Section 3.3 for why SQLite first
and what would overturn that, and Section 5 (Phase 4).

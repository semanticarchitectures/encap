# @encap/ensim-harness

ENSIM's data is read from a pinned-commit snapshot, never a live import
(`AGENTS.md` Section 8, `docs/PLAN.md` Section 3.6). ENSIM does not
depend on ENCAP and must not need to know it exists.

## `fixtures/ensim@<sha>/`

Populated by `just fetch-ensim` (default pinned commit `aa7b714`; pass a
different SHA as `just fetch-ensim <sha>`, or set `ENSIM_PATH=/path/to/a
local ENSIM clone` to copy from disk instead of fetching over the
network — useful for day-to-day work against an unpushed ENSIM change).
Each snapshot directory contains:

- `data/` — copied verbatim from `packages/org-doctrine-model/data/` at
  that commit (JSON records: organizations, roles, c2nodes,
  doctrine-processes, systems, interactions, decisions, missions).
- `schema/` — copied verbatim from `packages/org-doctrine-model/schema/`
  at that commit (the JSON Schema, draft 2020-12, that the data above
  validates against).
- `provenance.json` — the resolved commit SHA, fetch date, source repo
  URL, and ENSIM's license.

The snapshot is committed to this repo so evaluations are reproducible
without a live ENSIM checkout.

## `npm run validate`

Runs `scripts/validate-snapshot.mjs`: validates every JSON record in the
committed snapshot's `data/` against its own `schema/`, using `ajv`
(draft 2020-12). This is the Phase 0 exit-gate check — it proves the
snapshot is internally consistent, not that it matches ENCAP's own
schemas (there are none of those yet; that's `@encap/operating-model`,
Phase 3).

## What this package becomes in Phase 3

The converter from ENSIM's seven record types into an operating-model
OKF bundle (`docs/PLAN.md` Section 4 and Section 5, Phase 3), carrying
every `doctrineSource` note and `commsLink` across unchanged — including
the ones ENSIM flagged as unverified. Never upgrade a source's authority
in translation (`AGENTS.md` Section 2). Also home to the reference
implementation of the persona-driver contract published that phase (a
scripted driver that replays fixed prompts as a `Role`).

# Project Plan — ENCAP

**Status:** v1.0, 2026-09-15 — **decided.** Kevin confirmed the codename (ENCAP) and accepted every position in Sections 3 and 4 on 2026-09-15. Those sections keep their "what would overturn this" notes because they are the conditions under which a decision gets reopened — not because the decisions are still open. Reopening one requires an explicit human request, the same rule ENSIM's `AGENTS.md` Section 1 applies.
**Inputs read directly (not via the brief's summary):** ENSIM at commit `aa7b714` (2026-09-15): `AGENTS.md`, `docs/architecture/ARCHITECTURE.md` (Draft v1.2, dated 2026-09-10), `docs/architecture/tech-stack.md`, `packages/org-doctrine-model/schema/*` and `data/*`; and the OKF spec v0.2 (`GoogleCloudPlatform/knowledge-catalog`, `okf/SPEC.md`).
**Intended location:** `docs/PLAN.md` in the new repo, next to `AGENTS.md` and `docs/architecture/ARCHITECTURE.md` once those exist.

---

## 1. What this project is, in one paragraph

A set of applications that let people work with agents whose behavior is grounded in two things: a structured document library in Google Cloud's Open Knowledge Format (OKF), and the enterprise's *operating model* — its doctrine, organizational structure, and ontologies. The first application is a synthesis app: one file in, an OKF bundle out; many files in, one OKF bundle that compresses them into what they mean together. The synthesis agent reasons inside the operating model rather than in a vacuum. A document graph with a semantic index makes the library queryable, role-based access control decides who and what can reach which documents and capabilities, and a personnel console governs the human-agent interaction for safety, security, and reliability. Everything is evaluated against ENSIM — a simulated USAF enterprise built from unclassified public doctrine — before it is pointed at any real enterprise's documents or people.

## 2. Three things the brief gets slightly wrong, found by reading the sources

The brief itself asked for this check, so here is what turned up.

**ENSIM's `ARCHITECTURE.md` does not describe role-emulating T&E agents.** The brief says to "see its `ARCHITECTURE.md`" for ENSIM's plan to build agents from `Role` records. That document (v1.2, re-checked at commit `aa7b714` after Kevin's 2026-09-15 push) has no such section; the only trace is a `tools/ai-agents` directory named in `tech-stack.md` that does not exist in the repo. The brief already says the capability is "discussed but not yet built" — the correction is that it is also not yet *documented* on the ENSIM side. Consequence for this plan: the personnel console's evaluation depends on ENSIM work that nobody has scheduled, so this repo should publish the interface it expects from those agents (Section 5, Phase 3) rather than wait for them, and the ENSIM side should get a tracked item to build to it.

**ENSIM's repo does not contain the doctrine documents it cites.** `docs/doctrine-sources/` is about 12 KB of cross-references. ENSIM's own architecture doc records that every `.mil` domain returned a network-level block from its AI coding sessions, so the citations were grounded through search synthesis and flagged as such. The brief's "real documents to synthesize" therefore are not sitting in a repo waiting to be used. Decision already taken with Kevin (2026-09-15): Kevin downloads the doctrine PDFs on his own machine into a fixtures folder, and this plan treats that as a Phase 0 prerequisite (Section 5).

**ENSIM's `Role` records are thinner than the brief implies.** The schema has `responsibilities`, `authorities`, `reportsToRoleId`, optional `training`, and `doctrineSource` citations — that is the full field list. "Reporting chain" is a single parent pointer, and there are 14 records. This is enough to seed an operating model and to test the personnel console against, but a role-emulating agent built from a `Role` record alone would be mostly prompt engineering on top of a short list of strings. The `Interaction` and `Decision` records (31 and 7) carry more of the behavioral content and should be part of the operating-model mapping from the start. The 2026-09-15 commit helps here: every comms-bearing `Interaction` and `System` now carries a `commsLink` (verbal/digital/mixed, medium, and protocol/format for digital hops), which is exactly the kind of typed, structured relation the operating-model profile in Section 4 needs to preserve rather than flatten into prose.

## 3. Decisions on the six open items

Each was written as a recommendation and accepted 2026-09-15. The "what would overturn this" note under each is the reopen condition.

### 3.1 Should `document-graph/` just be OKF's own cross-linking? — Yes, for storage; no, for typed relationships

OKF v0.2's linking convention is plain Markdown links, bundle-relative (`[text](/path/to/concept.md)`), untyped, with the relationship carried by surrounding prose; consumers treat every link as a directed edge and must tolerate broken links. Per-claim attribution uses Markdown footnotes keyed to `sources[].id` in the frontmatter. Reserved `index.md` files give per-directory listings and the bundle root's `index.md` may carry `okf_version`.

Decision: the OKF bundle on disk *is* the canonical document graph. `document-graph/` becomes a derived, rebuildable index over the bundle — never a second store that can drift from it. What OKF does not give you is typed edges, and the operating model needs them (reports-to, commands, informs, authenticates-to — exactly the `Interaction.interactionType` vocabulary ENSIM already has). The spec says producers may add custom frontmatter keys and consumers must preserve unknown ones, so typed relations go in a custom `relations:` frontmatter list on the concept document, alongside the untyped body links. The index reads both.

What would overturn this: if OKF's next minor version adds typed links (worth watching — the spec is three months old), drop the custom key and use theirs. If the library needs relationships that are not document-to-document (e.g., a role's access assignment to a *capability*, not a document), those belong in `access-control/`'s data, not in the graph.

Risk to name now: OKF is v0.2 and Google will change it. Contain the churn inside `okf-format/` so that nothing else in the repo parses frontmatter or link syntax directly.

### 3.2 Project name — ENCAP

Decided 2026-09-15: **ENCAP**, a codename in the ENSIM/GMNS/AOC-DFO style rather than a descriptive product name. Repo name `ENCAP`, npm package scope `@encap/*`, schema `$id` base `https://encap.dev/schema/` (mirroring ENSIM's `ensim.dev` convention — a namespace, not a promise of a website).

### 3.3 Semantic database for the document graph — embedded SQLite (FTS + vectors) first; no graph database until a query pattern demands one

The brief is right that this project's query patterns should drive the choice, and the honest state is that they are unknown. Every candidate technology answers a question we cannot yet ask well.

Decision: start with an embedded, zero-operations index — SQLite with FTS5 for text, a vector extension (sqlite-vec or equivalent) for embeddings, and ordinary tables for the link graph and typed relations. It is rebuilt from the OKF bundle by one command, so it is never the source of truth and can be thrown away when the real query patterns are known. The `document-graph/` package exposes a query API (find by type, follow relations to depth *n*, semantic nearest-neighbors, "everything this claim cites") and hides the store behind it.

What would overturn this: a need for multi-hop graph traversal at a depth or scale where SQLite recursive CTEs get slow (then an embedded graph engine such as Kùzu, before a server); a real need to query the library with SPARQL alongside AOC-DFO's BFO/CCO ontology (then an RDF store, and the operating model gets a Turtle export the same way ENSIM decided to handle it — one-way generator, not a second hand-maintained copy); or a multi-user server deployment for the personnel console (then a hosted store, chosen at that point).

### 3.4 Tech stack — TypeScript, decided on this project's needs, which happen to point the same way as ENSIM's

The brief says not to assume ENSIM's stack carries over. Working through what each part actually needs: `okf-format/` is YAML frontmatter, Markdown links, and JSON-Schema validation — schema-first, the case `tech-stack.md` already made for TypeScript + ajv. `document-graph/` is file I/O plus an embedded database — any language. `access-control/` is a policy evaluator over data — any language, and small. `synthesis-agent/` is an LLM agent loop — the Claude Agent SDK is equally available in TypeScript and Python. The two apps are web UIs — TypeScript. The one place Python has a real advantage is document ingestion: PDF-to-Markdown extraction quality for doctrine publications (tables, multi-column layouts, figures) is better served by the Python ecosystem (Docling, marker, and similar) than by anything in npm.

Decision: TypeScript for every package and app, npm workspaces, matching ENSIM. Treat document extraction the way ENSIM treats Portico: one contained boundary. `okf-format/`'s ingest step shells out to an extraction tool as a process with a Markdown-in/Markdown-out contract, so the choice of extractor (a Python tool in a container, a CLI, or a hosted API) is swappable and no Python leaks into the rest of the monorepo. Use ENSIM's `Justfile`-over-npm pattern only if a second toolchain actually appears.

What would overturn this: if Phase 2 shows the synthesis agent needs Python-only libraries in its *reasoning* loop, not just its ingest, then a Python `synthesis-agent/` with a JSON contract to the TypeScript side is the right call — decide it then, with evidence, not now.

### 3.5 License — Apache 2.0, and OKF's licensing is compatible

The `knowledge-catalog` repository is Apache 2.0 (its `LICENSE.md`); the OKF spec document carries no separate license statement, so it falls under the repo license. Implementing a spec is not copying it, but `okf-format/` will likely borrow from Google's sample bundles and any validator code in that repo for tests — those carry attribution obligations under Apache 2.0, so keep a `NOTICE` file from day one, as ENSIM does.

Decision: Apache 2.0, for the same patent-grant reasoning ENSIM settled on. Confirmed rather than assumed: nothing in this project's dependencies (OKF, SQLite, the Claude SDK) conflicts with it.

One additional provenance point the brief did not raise: the doctrine PDFs Kevin will download are U.S. Government works, but each carries its own distribution statement. The fixtures manifest (Phase 0) should record the statement for each file, and only "approved for public release, distribution unlimited" documents should ever be committed or synthesized — this is ENSIM's `AGENTS.md` Section 3 boundary applied to inputs instead of outputs.

### 3.6 How `eval/ensim-harness` reads ENSIM's data — a pinned snapshot of `data/` and `schema/`, fetched by script

ENSIM is at `github.com/semanticarchitectures/ENSIM`. Its `org-doctrine-model` is an unpublished npm workspace package (`@ensim/org-doctrine-model`), so there is no registry to pull from. The harness needs only two directories from it: `packages/org-doctrine-model/data/` (the JSON records) and `packages/org-doctrine-model/schema/` (to validate what it read and to generate types).

Decision: a `just fetch-ensim` script that clones ENSIM at a pinned commit SHA, copies those two directories into `eval/ensim-harness/fixtures/ensim@<sha>/`, and writes a provenance file with the SHA, date, and ENSIM's license. Reproducible evaluations, no submodule friction, and the one-directional dependency stays visible. An `ENSIM_PATH` environment variable overrides the fixture with a local clone for day-to-day work.

What would overturn this: if the personnel console evaluation needs ENSIM's T&E agents *running* (not just its data), a full clone or submodule replaces the snapshot. That is a Phase 6 question.

## 4. Two architectural decisions beyond the open items

Both were proposed separately from the six open items because they change the brief's repo structure; both were accepted 2026-09-15.

**The operating model should itself be an OKF bundle with a required profile, not a separate interface.** The brief proposes `operating-model/` as "a generic interface for enterprise doctrine/structure/ontology" that ENSIM's data can implement. The simpler version: an operating model *is* an OKF bundle whose concept documents use a fixed set of `type` values (Organization, Role, C2Node, DoctrineProcess, System, Interaction, Decision — ENSIM's seven, generalized) and a required `relations:` list. Then `operating-model/` is a profile — a schema over OKF frontmatter plus validators — rather than a bespoke API, the synthesis agent's "context" and the document library are the same shape and live in the same index, and `eval/ensim-harness` is a converter (ENSIM JSON → OKF bundle) rather than an adapter implementing an interface. The `doctrineSource` citations map directly onto OKF `sources[]` plus footnotes. Risk: the profile's typed relations depend on a custom frontmatter key (Section 3.1); if that proves awkward, fall back to the interface design.

**Per-claim citation is mandatory in synthesis output, not optional as OKF has it.** OKF makes `sources[]` and footnotes optional. This project family's rule (`AGENTS.md` Section 2, and the ProvenanceEnvelope pattern from the legal-structure-agent work) is that an agent never presents an unsourced claim as fact. `okf-format/`'s validator gets a "strict provenance" mode that the synthesis agent must pass: every non-trivial claim in the body carries a footnote resolving to a `sources[].id`, and `generated.by` is always set. This also gives Phase 2 its first measurable quality gate.

## 5. Build order and evaluation gates

The brief has five packages, two apps, and a harness. Building them breadth-first is the failure mode. The order below is a vertical slice first — files in, cited OKF out, judged against the sources — and everything else grows from the point where it is actually needed. Each phase ends with a gate that has to pass before the next starts.

**Phase 0 — Decisions and scaffold.** Sections 3 and 4 are decided and `AGENTS.md` is drafted (both 2026-09-15); what remains is the scaffold. Commit `AGENTS.md` (adapted from ENSIM's — same eight rules, plus the input-side distribution-statement rule from Section 3.5 and the mandatory-citation rule from Section 4). Scaffold the npm workspace, `Justfile`, `LICENSE`, `NOTICE`. Kevin downloads the doctrine PDFs (start with the three ENSIM cites most: AFMAN 13-1AOC Vol 3, AFDP 3-0.1, JP 3-17) into `fixtures/doctrine/`, with a manifest of source URL, hash, publication date, and distribution statement. Run `just fetch-ensim` once to populate the ENSIM snapshot. *Gate:* the six open items have written decisions; the fixtures manifest exists and validates.

**Phase 1 — `okf-format/`.** Read, validate, and write OKF v0.2 bundles: frontmatter schema (required `type`, recommended fields, provenance/trust/lifecycle families), link extraction into a directed edge list, footnote-to-source resolution, `index.md` and `log.md` handling, `okf_version` pinning. Strict-provenance validation mode. Ingest step with the swappable extractor boundary (Section 3.4), producing plain Markdown from a PDF. *Gate:* Google's own sample bundles round-trip; a doctrine PDF from the fixtures becomes readable Markdown with page anchors preserved well enough to cite.

**Phase 2 — `synthesis-agent/` v1, single file.** One document in, one OKF bundle out, every claim footnoted to a source with a page or section anchor, `generated.by` set. Then the multi-file case: several documents in, one bundle that is a synthesis, not a concatenation. *Gate — this is the important one:* a competency-question suite, the same device AOC-DFO uses. For each fixture, a set of questions a competent staff officer should be able to answer from the source; the bundle passes if an agent reading *only the OKF output* answers them as well as an agent reading the sources, and every answer cites. Compression ratio is reported but is not the gate. Without this gate "reflects understanding" is unmeasurable.

**Phase 3 — Operating model and the ENSIM harness.** The OKF profile from Section 4; the `ensim-harness` converter from ENSIM's seven record types (at `aa7b714`: 14 roles, 11 organizations, 11 C2 nodes, 2 doctrine processes, 13 systems, 31 interactions, 7 decisions, 3 missions) into an operating-model bundle, carrying every `doctrineSource` note and every `commsLink` — including the ones ENSIM flagged as unverified — into OKF `sources[]` unchanged. Context-aware synthesis: the agent loads the operating-model bundle before synthesizing and the competency questions from Phase 2 gain a second set that can only be answered by combining a source with the operating model ("which C2 node in *this* enterprise owns the step this paragraph describes?"). Also in this phase, so ENSIM has something to build toward: publish the *persona driver* contract — the interface the personnel console will expect a role-emulating agent to satisfy (identity bound to a `Role` document, the actions it may take, the transcript format it emits). *Gate:* the ENSIM bundle validates under the profile with zero silent upgrades of a flagged citation; context-aware synthesis beats context-free on the second question set.

**Phase 4 — `document-graph/`.** The SQLite index from Section 3.3, built from a bundle in one command; the query API. *Gate:* the competency-question runner from Phases 2–3 is re-implemented on top of the index instead of reading files, with identical results, and the index rebuild is idempotent.

**Phase 5 — `access-control/`.** Access assignments as data: which `Role` documents (from the operating model) may reach which documents, document types, and capabilities. Enforcement at the query API, so every read the synthesis agent or console makes is a read *as* a role. *Gate:* a role from the ENSIM bundle that has no assignment to a document cannot retrieve it through any query path, and the denial is logged with the role and the rule that denied it.

**Phase 6 — the two apps.** `synthesis-app/` is thin: files in, bundle out, the Phase 1–2 machinery behind a UI, and should stay thin. `personnel-console/` is the governance layer — session identity bound to a role, every agent action gated by access control, every response carrying its citations, a reliability layer that refuses unsourced answers. Its evaluation needs ENSIM's T&E agents to exist (Section 2); until they do, evaluate with a scripted persona driver that replays fixed prompts as a role, which is also the reference implementation of the Phase 3 contract. *Gate:* the console passes an adversarial script — a persona attempting to reach documents outside its role, and to get an uncited answer — with every attempt denied and logged.

Not in any phase, deliberately: a graph visualization, a live multi-user deployment, any real enterprise's documents, and any BFO/CCO export. Each waits for a concrete trigger, the same discipline ENSIM applied to `entity-gateway`.

## 6. Adjusted repo structure

The brief's structure, with the Section 4 change (operating model as an OKF profile) and the fixtures directory added.

```
ENCAP/
├── AGENTS.md
├── LICENSE  NOTICE  Justfile  package.json
├── docs/
│   ├── PLAN.md                    # this document
│   └── architecture/ARCHITECTURE.md
├── fixtures/
│   ├── doctrine/                  # PDFs Kevin downloads locally + manifest.json (URL, hash, distribution statement)
│   └── competency-questions/      # per-fixture question sets — the Phase 2/3 gate
├── packages/
│   ├── okf-format/                # OKF v0.2 read/validate/write, link graph, strict-provenance mode, ingest boundary
│   ├── operating-model/           # OKF *profile*: required types + relations schema + validators (not a separate API)
│   ├── synthesis-agent/           # file(s) -> cited OKF bundle, reasoning inside an operating-model bundle
│   ├── document-graph/            # derived SQLite index over a bundle + query API
│   └── access-control/            # role -> access assignments; enforced at the query API
├── apps/
│   ├── synthesis-app/
│   └── personnel-console/
└── eval/
    ├── ensim-harness/             # fetch-ensim script, fixtures/ensim@<sha>/, JSON -> OKF converter, persona-driver contract
    └── runner/                    # competency-question runner shared by every phase gate
```

## 7. Risks worth stating now

OKF is three months old and at v0.2; expect breaking changes and keep every parser inside `okf-format/`. Doctrine publications are long, and PDF extraction quality is the single most likely place for the synthesis gate to fail for reasons that have nothing to do with the agent — budget Phase 1 time for it. The personnel console's real evaluation is blocked on ENSIM work that is not yet designed on ENSIM's side; the persona-driver contract in Phase 3 is the mitigation, not a solution. Finally, everything in this repo must stay unclassified in both directions — the inputs it is tested on and the outputs it produces — and the fixtures manifest's distribution-statement field is the mechanism, not a note in a README.

## 8. Immediate next steps, in order

Decisions and codename are done. Claude Code takes the Phase 0 scaffold and Phase 1 (`okf-format/`) from here, per `docs/KICKOFF.md`. In parallel, Kevin downloads the first three doctrine PDFs and records their distribution statements in `fixtures/doctrine/manifest.json` — needed for the Phase 1 exit gate, not its start. Phase 2 does not begin until the Phase 1 gate passes against a real doctrine PDF.

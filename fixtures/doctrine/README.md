# fixtures/doctrine/

Doctrine PDFs are downloaded locally (not committed — see `.gitignore`).
`manifest.json` is the committed record of what was downloaded, from
where, and under what distribution statement; it validates against
`manifest.schema.json`.

**Only documents whose distribution statement reads as unlimited public
release may be added here** (`AGENTS.md` Section 3, `docs/PLAN.md`
Section 3.5). `scripts/validate-fixtures.mjs` checks this mechanically —
run `just validate` after adding an entry.

To add a document:

1. Download the PDF into this directory.
2. Compute its SHA-256 (`shasum -a 256 <file>` on macOS/Linux).
3. Add an entry to `manifest.json` with `id`, `title`, `sourceUrl`,
   `sha256`, `publicationDate`, `distributionStatement` (copied verbatim
   from the document's cover/footer), and `localPath`.
4. Run `just validate`.

Per `docs/PLAN.md` Section 5 (Phase 0), the first three to add are the
ones ENSIM cites most: AFMAN 13-1AOC Vol 3, AFDP 3-0.1, JP 3-17.

#!/usr/bin/env node
// Root `just validate` / `npm run validate` step for repo-level fixtures
// that don't belong to any one workspace package:
//   - fixtures/doctrine/manifest.json against its schema, plus the
//     AGENTS.md Section 3 / docs/PLAN.md Section 3.5 distribution-statement
//     check (only unlimited public release may be committed or synthesized).
//   - fixtures/competency-questions/*.question-set.json against its schema.
// Per-package schema/data validation (OKF bundles, the ENSIM snapshot, and
// eventually operating-model/access-control data) lives in each package's
// own `npm run validate`, invoked first by the root `validate` script.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

let hadErrors = false;
function fail(message) {
  hadErrors = true;
  console.error(`FAIL: ${message}`);
}
function ok(message) {
  console.log(`OK: ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Two real, current phrasings seen on actual DAF publications: the classic
// "Distribution A ... distribution unlimited" statement, and the DAFMAN
// releasability boilerplate ("RELEASABILITY: There are no releasability
// restrictions on this publication.") that newer AFMANs use instead. A
// document with neither — e.g. a LeMay Center AFDP with no printed
// statement at all — must NOT match here; that's a real gap to flag to a
// human (AGENTS.md Section 3), not something this check should paper over.
function looksLikeUnlimitedRelease(statement) {
  return /unlimited/i.test(statement) || /no releasability restrictions/i.test(statement);
}

function validateDoctrineManifest() {
  const dir = join(repoRoot, "fixtures", "doctrine");
  const schema = readJson(join(dir, "manifest.schema.json"));
  const manifest = readJson(join(dir, "manifest.json"));

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(manifest)) {
    fail(`fixtures/doctrine/manifest.json does not match its schema:\n  ${ajv.errorsText(validate.errors, { separator: "\n  " })}`);
    return;
  }
  ok(`fixtures/doctrine/manifest.json validates against manifest.schema.json (${manifest.documents.length} document(s))`);

  for (const doc of manifest.documents) {
    if (!looksLikeUnlimitedRelease(doc.distributionStatement)) {
      fail(
        `fixtures/doctrine/manifest.json: document "${doc.id}" has a distributionStatement that does not read as unlimited public release ("${doc.distributionStatement}") — AGENTS.md Section 3 requires flagging this to a human, not committing or synthesizing it.`,
      );
    }
  }
}

function validateCompetencyQuestionSets() {
  const dir = join(repoRoot, "fixtures", "competency-questions");
  const schema = readJson(join(dir, "question-set.schema.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = readdirSync(dir).filter((f) => f.endsWith(".question-set.json"));
  if (files.length === 0) {
    fail("fixtures/competency-questions/ has no *.question-set.json files");
    return;
  }
  for (const file of files) {
    const data = readJson(join(dir, file));
    if (!validate(data)) {
      fail(`fixtures/competency-questions/${file} does not match its schema:\n  ${ajv.errorsText(validate.errors, { separator: "\n  " })}`);
      continue;
    }
    ok(`fixtures/competency-questions/${file} validates against question-set.schema.json`);
  }
}

function main() {
  validateDoctrineManifest();
  validateCompetencyQuestionSets();

  if (hadErrors) {
    console.error("\nvalidate-fixtures: FAILED");
    process.exit(1);
  }
  console.log("\nvalidate-fixtures: all checks passed");
}

main();

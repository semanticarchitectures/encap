#!/usr/bin/env node
// Validates every committed ENSIM snapshot's data/*.json against its own
// schema/*.schema.json, using ajv (draft 2020-12, matching ENSIM's
// $schema). This is the Phase 0 exit-gate check for the ENSIM snapshot:
// it proves the snapshot is internally consistent against ENSIM's own
// schemas, not against any ENCAP schema (there is none yet).

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

// Maps a data file's basename to the schema file that validates each of
// its array entries. `missions/` is a directory of one-mission-per-file
// records rather than a single array file, so it is walked separately.
const DATA_TO_SCHEMA = {
  "organizations.json": "organization.schema.json",
  "roles.json": "role.schema.json",
  "c2nodes.json": "c2node.schema.json",
  "doctrine-processes.json": "doctrine-process.schema.json",
  "systems.json": "system.schema.json",
  "interactions.json": "interaction.schema.json",
  "decisions.json": "decision.schema.json",
};
const MISSION_SCHEMA = "mission.schema.json";

function isDirectory(path) {
  return statSync(path).isDirectory();
}

function loadAjvForSnapshot(schemaDir) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const file of readdirSync(schemaDir)) {
    if (!file.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(join(schemaDir, file), "utf8"));
    ajv.addSchema(schema);
  }
  return ajv;
}

function validateArrayFile(ajv, dataDir, schemaDir, dataFile, schemaFile, errors) {
  const dataPath = join(dataDir, dataFile);
  const records = JSON.parse(readFileSync(dataPath, "utf8"));
  const schema = JSON.parse(readFileSync(join(schemaDir, schemaFile), "utf8"));
  const validate = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
  if (!Array.isArray(records)) {
    errors.push(`${dataFile}: expected a top-level JSON array, got ${typeof records}`);
    return;
  }
  records.forEach((record, i) => {
    if (!validate(record)) {
      errors.push(
        `${dataFile}[${i}] (id=${record?.id ?? "?"}): ${ajv.errorsText(validate.errors, { separator: "; " })}`,
      );
    }
  });
  console.log(`  ${dataFile}: ${records.length} record(s) validated against ${schemaFile}`);
}

function validateMissions(ajv, dataDir, schemaDir, errors) {
  const missionsDir = join(dataDir, "missions");
  const schema = JSON.parse(readFileSync(join(schemaDir, MISSION_SCHEMA), "utf8"));
  const validate = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
  const files = readdirSync(missionsDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const record = JSON.parse(readFileSync(join(missionsDir, file), "utf8"));
    if (!validate(record)) {
      errors.push(
        `missions/${file}: ${ajv.errorsText(validate.errors, { separator: "; " })}`,
      );
    }
  }
  console.log(`  missions/: ${files.length} record(s) validated against ${MISSION_SCHEMA}`);
}

function main() {
  let snapshotDirs = [];
  try {
    snapshotDirs = readdirSync(fixturesDir).filter(
      (name) => name.startsWith("ensim@") && isDirectory(join(fixturesDir, name)),
    );
  } catch {
    console.log("No fixtures/ensim@<sha>/ snapshot found — run `just fetch-ensim` first.");
    process.exit(1);
  }

  if (snapshotDirs.length === 0) {
    console.log("No fixtures/ensim@<sha>/ snapshot found — run `just fetch-ensim` first.");
    process.exit(1);
  }

  let anyErrors = false;
  for (const snapshot of snapshotDirs) {
    console.log(`Validating ${snapshot}...`);
    const dataDir = join(fixturesDir, snapshot, "data");
    const schemaDir = join(fixturesDir, snapshot, "schema");
    const ajv = loadAjvForSnapshot(schemaDir);
    const errors = [];

    for (const [dataFile, schemaFile] of Object.entries(DATA_TO_SCHEMA)) {
      validateArrayFile(ajv, dataDir, schemaDir, dataFile, schemaFile, errors);
    }
    validateMissions(ajv, dataDir, schemaDir, errors);

    if (errors.length > 0) {
      anyErrors = true;
      console.error(`\n${snapshot}: ${errors.length} validation error(s):`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.log(`${snapshot}: OK`);
    }
  }

  if (anyErrors) process.exit(1);
}

main();

#!/usr/bin/env node
// Fetches a pinned-commit snapshot of ENSIM's org-doctrine-model data and
// schema into fixtures/ensim@<sha>/. See ../README.md and
// docs/PLAN.md Section 3.6 for the decision this implements.
//
// Usage:
//   node fetch-ensim.mjs [sha]              # default sha: aa7b714
//   ENSIM_PATH=/path/to/local/ENSIM node fetch-ensim.mjs [sha]
//     -> copies from the local clone instead of fetching over the network.
//        The local clone's checked-out commit is recorded as-is; if it
//        doesn't match [sha], a note says so rather than silently
//        overwriting the pinned identity.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/semanticarchitectures/ENSIM.git";
const REL_DATA_PATH = "packages/org-doctrine-model/data";
const REL_SCHEMA_PATH = "packages/org-doctrine-model/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessRoot = join(__dirname, "..");
const requestedSha = process.argv[2] ?? "aa7b714";
const ensimPathOverride = process.env.ENSIM_PATH;

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();
}

function fetchViaGit(sha) {
  const tmp = mkdtempSync(join(tmpdir(), "ensim-fetch-"));
  console.log(`Cloning ${REPO_URL} into a temp dir...`);
  run("git", ["clone", REPO_URL, tmp]);
  console.log(`Checking out ${sha}...`);
  run("git", ["checkout", sha], tmp);
  const resolvedSha = run("git", ["rev-parse", "HEAD"], tmp);
  return { root: tmp, resolvedSha, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

function useLocalPath(localPath, requestedShaForNote) {
  if (!existsSync(localPath)) {
    throw new Error(`ENSIM_PATH=${localPath} does not exist`);
  }
  let resolvedSha = "unknown (ENSIM_PATH not a git checkout)";
  let note = `Copied from a local override at ENSIM_PATH=${localPath}, not fetched over the network.`;
  try {
    resolvedSha = run("git", ["rev-parse", "HEAD"], localPath);
    if (resolvedSha !== requestedShaForNote && !resolvedSha.startsWith(requestedShaForNote)) {
      note += ` Requested sha was ${requestedShaForNote}; the local checkout is actually at ${resolvedSha} — using the local checkout's real commit, not the requested one.`;
    }
  } catch {
    // Not a git repo (or git unavailable) — keep the "unknown" placeholder.
  }
  return { root: localPath, resolvedSha, note, cleanup: () => {} };
}

function main() {
  let source;
  let note = null;
  if (ensimPathOverride) {
    const local = useLocalPath(ensimPathOverride, requestedSha);
    source = local;
    note = local.note;
  } else {
    source = fetchViaGit(requestedSha);
  }

  try {
    const shaForDir = ensimPathOverride ? requestedSha : source.resolvedSha.slice(0, 7);
    const snapshotDir = join(harnessRoot, "fixtures", `ensim@${shaForDir}`);
    rmSync(snapshotDir, { recursive: true, force: true });
    mkdirSync(snapshotDir, { recursive: true });

    const dataSrc = join(source.root, REL_DATA_PATH);
    const schemaSrc = join(source.root, REL_SCHEMA_PATH);
    if (!existsSync(dataSrc)) throw new Error(`missing ${REL_DATA_PATH} at the fetched commit`);
    if (!existsSync(schemaSrc)) throw new Error(`missing ${REL_SCHEMA_PATH} at the fetched commit`);

    cpSync(dataSrc, join(snapshotDir, "data"), { recursive: true });
    cpSync(schemaSrc, join(snapshotDir, "schema"), { recursive: true });

    const provenance = {
      sourceRepo: REPO_URL,
      requestedSha,
      resolvedSha: source.resolvedSha,
      fetchedAt: new Date().toISOString(),
      license: "Apache-2.0",
      copiedPaths: [REL_DATA_PATH, REL_SCHEMA_PATH],
      note,
    };
    writeFileSync(join(snapshotDir, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");

    console.log(`Wrote snapshot to ${snapshotDir}`);
    console.log(JSON.stringify(provenance, null, 2));
  } finally {
    source.cleanup();
  }
}

main();

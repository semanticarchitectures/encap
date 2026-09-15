#!/usr/bin/env node
// tsc doesn't copy non-TS assets; validate.ts loads its JSON schema files
// at runtime relative to its own compiled location, so dist/schema/ needs
// a copy of src/schema/ after every build.
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
cpSync(join(pkgRoot, "src", "schema"), join(pkgRoot, "dist", "schema"), { recursive: true });

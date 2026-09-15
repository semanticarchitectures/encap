import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readBundle, writeBundle } from "../src/bundle.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesRoot = join(__dirname, "fixtures", "okf-samples");
const sampleBundles = readdirSync(samplesRoot).filter((name) => statSync(join(samplesRoot, name)).isDirectory());

const tempDirs: string[] = [];
afterEach(() => {
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("round-trip: Google's okf/bundles samples (Phase 1 gate a)", () => {
  it("found at least one bundle to test (sanity)", () => {
    expect(sampleBundles.length).toBeGreaterThan(0);
  });

  for (const name of sampleBundles) {
    describe(name, () => {
      const bundleRoot = join(samplesRoot, name);

      it("reads with zero non-conformant .md files (warnings)", () => {
        const { warnings } = readBundle(bundleRoot);
        expect(warnings).toEqual([]);
      });

      it("round-trips: body byte-for-byte, frontmatter structurally, for every file", () => {
        const { bundle: original } = readBundle(bundleRoot);

        const dest = mkdtempSync(join(tmpdir(), "okf-roundtrip-"));
        tempDirs.push(dest);
        writeBundle(original, dest);

        const { bundle: rewritten, warnings } = readBundle(dest);
        expect(warnings).toEqual([]);

        expect(rewritten.concepts.length).toBe(original.concepts.length);
        const byPath = new Map(original.concepts.map((c) => [c.path, c]));
        for (const c of rewritten.concepts) {
          const orig = byPath.get(c.path);
          expect(orig, `unexpected concept path ${c.path}`).toBeDefined();
          expect(c.body, `body mismatch for ${c.path}`).toBe(orig!.body);
          expect(c.frontmatter, `frontmatter mismatch for ${c.path}`).toEqual(orig!.frontmatter);
        }

        expect(rewritten.indexFiles.length).toBe(original.indexFiles.length);
        const idxByPath = new Map(original.indexFiles.map((f) => [f.path, f]));
        for (const f of rewritten.indexFiles) {
          const orig = idxByPath.get(f.path);
          expect(orig, `unexpected index.md path ${f.path}`).toBeDefined();
          expect(f.body).toBe(orig!.body);
          expect(f.okf_version).toBe(orig!.okf_version);
        }

        expect(rewritten.logFiles.length).toBe(original.logFiles.length);
        const logByPath = new Map(original.logFiles.map((f) => [f.path, f]));
        for (const f of rewritten.logFiles) {
          const orig = logByPath.get(f.path);
          expect(orig, `unexpected log.md path ${f.path}`).toBeDefined();
          expect(f.body).toBe(orig!.body);
          expect(f.frontmatter).toEqual(orig!.frontmatter);
        }

        expect(rewritten.opaqueFiles.length).toBe(original.opaqueFiles.length);
        const opByPath = new Map(original.opaqueFiles.map((f) => [f.path, f]));
        for (const f of rewritten.opaqueFiles) {
          const orig = opByPath.get(f.path);
          expect(orig, `unexpected opaque file path ${f.path}`).toBeDefined();
          expect(Buffer.compare(f.content, orig!.content)).toBe(0);
        }
      });
    });
  }
});

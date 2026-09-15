import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { parseConcept, writeConcept, NotAConceptError } from "./concept.js";
import { parseIndexFile, writeIndexFile } from "./index-file.js";
import { parseLogFile, writeLogFile } from "./log-file.js";
import { extractLinks } from "./links.js";
import type { Bundle, LinkEdge, OpaqueFile } from "./types.js";

const RESERVED_INDEX = "index.md";
const RESERVED_LOG = "log.md";

function toBundleRelative(absPath: string, root: string): string {
  return relative(root, absPath).split(sep).join("/");
}

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue; // .git, .DS_Store, etc.
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, root, out);
    } else if (st.isFile()) {
      out.push(abs);
    }
  }
}

export interface ReadBundleResult {
  bundle: Bundle;
  /** Non-fatal: `.md` files that aren't reserved and aren't conformant concepts (see parseConcept), treated as opaque. */
  warnings: string[];
}

/** Reads an entire OKF bundle from disk. Never throws on a non-conformant concept file — see `warnings`. */
export function readBundle(root: string): ReadBundleResult {
  const files: string[] = [];
  walk(root, root, files);

  const bundle: Bundle = { root, concepts: [], indexFiles: [], logFiles: [], opaqueFiles: [] };
  const warnings: string[] = [];

  for (const absPath of files) {
    const relPath = toBundleRelative(absPath, root);
    const name = basename(absPath);

    if (name === RESERVED_INDEX) {
      const raw = readFileSync(absPath, "utf8");
      bundle.indexFiles.push(parseIndexFile(raw, relPath));
      continue;
    }
    if (name === RESERVED_LOG) {
      const raw = readFileSync(absPath, "utf8");
      bundle.logFiles.push(parseLogFile(raw, relPath));
      continue;
    }
    if (name.endsWith(".md")) {
      const raw = readFileSync(absPath, "utf8");
      try {
        bundle.concepts.push(parseConcept(raw, relPath));
        continue;
      } catch (err) {
        if (err instanceof NotAConceptError) {
          warnings.push(err.message);
          // fall through to opaque handling below
        } else {
          throw err;
        }
      }
    }
    bundle.opaqueFiles.push({ path: relPath, content: readFileSync(absPath) });
  }

  const rootIndex = bundle.indexFiles.find((f) => f.path === RESERVED_INDEX);
  bundle.okfVersion = rootIndex?.okf_version;

  return { bundle, warnings };
}

/** Every bundle-relative path that exists in the bundle, for link-existence checks. */
export function allPaths(bundle: Bundle): Set<string> {
  const paths = new Set<string>();
  for (const c of bundle.concepts) paths.add(c.path);
  for (const f of bundle.indexFiles) paths.add(f.path);
  for (const f of bundle.logFiles) paths.add(f.path);
  for (const f of bundle.opaqueFiles) paths.add(f.path);
  return paths;
}

/** Extracts the full directed link-edge list across every concept and index.md body in the bundle. */
export function buildLinkGraph(bundle: Bundle): LinkEdge[] {
  const existing = allPaths(bundle);
  const edges: LinkEdge[] = [];
  for (const c of bundle.concepts) edges.push(...extractLinks(c.body, c.path, existing));
  for (const f of bundle.indexFiles) edges.push(...extractLinks(f.body, f.path, existing));
  return edges;
}

/** Writes an entire bundle to disk at `destRoot`, recreating the full file set. */
export function writeBundle(bundle: Bundle, destRoot: string): void {
  const write = (relPath: string, content: string | Buffer) => {
    const abs = join(destRoot, ...relPath.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };

  for (const c of bundle.concepts) write(c.path, writeConcept(c));
  for (const f of bundle.indexFiles) write(f.path, writeIndexFile(f));
  for (const f of bundle.logFiles) write(f.path, writeLogFile(f));
  for (const f of bundle.opaqueFiles) write(f.path, f.content);
}

export type { OpaqueFile };

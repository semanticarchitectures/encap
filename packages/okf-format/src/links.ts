import { dirname, join, normalize, sep } from "node:path";
import type { LinkEdge, LinkKind } from "./types.js";

// Matches `[text](href)` or `[text](href "title")`, but not `![alt](...)`
// (image, not a concept link) and not a bare footnote marker `[^id]`
// (no parens follow). Does not special-case fenced code blocks — a link
// written inside a ```-fence is still extracted; none of this package's
// fixtures do that, and OKF's spec has no fenced-code exemption for links.
const LINK_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const EXTERNAL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function classify(href: string): LinkKind {
  if (EXTERNAL_SCHEME_RE.test(href)) return "external";
  if (href.startsWith("/")) return "bundle-absolute";
  return "relative";
}

/**
 * Resolves a link href to a bundle-relative path (posix-style, no leading
 * slash), stripping any `#fragment`. `fromPath` is the linking document's
 * own bundle-relative path (used as the base for relative hrefs).
 */
export function resolveLinkPath(href: string, fromPath: string, kind: LinkKind): string | undefined {
  if (kind === "external") return undefined;
  const withoutFragment = href.split("#")[0]!;
  if (withoutFragment === "") return undefined;
  const resolved =
    kind === "bundle-absolute"
      ? withoutFragment.replace(/^\/+/, "")
      : join(dirname(fromPath), withoutFragment);
  return normalize(resolved).split(sep).join("/");
}

/**
 * Extracts every markdown link in `body` as a directed edge. `fromPath`
 * is the linking document's bundle-relative path. `existingPaths` is the
 * set of bundle-relative paths that actually exist (concepts, index
 * files, opaque files) — used to flag broken links, which are tolerated
 * and reported, never treated as an error (spec §6.1, §11).
 */
export function extractLinks(body: string, fromPath: string, existingPaths: ReadonlySet<string>): LinkEdge[] {
  const edges: LinkEdge[] = [];
  for (const match of body.matchAll(LINK_RE)) {
    const [, bang, text, href] = match;
    if (bang === "!") continue; // image, not a concept-to-concept link
    const kind = classify(href!);
    const resolvedPath = resolveLinkPath(href!, fromPath, kind);
    // A link to a bare subdirectory (e.g. `subdir/`, per spec §8's index.md
    // example) resolves to that directory's index.md.
    const resolvedNoTrailingSlash = resolvedPath?.replace(/\/+$/, "");
    const exists =
      kind === "external"
        ? true
        : resolvedNoTrailingSlash !== undefined &&
          (existingPaths.has(resolvedNoTrailingSlash) || existingPaths.has(`${resolvedNoTrailingSlash}/index.md`));
    edges.push({ from: fromPath, href: href!, text: text!, kind, resolvedPath, exists });
  }
  return edges;
}

// Renders a DoclingDocument JSON export (docling's `--to json`) into
// Markdown with `<!-- page:N -->` anchors on every page transition.
//
// Why this exists rather than using docling's own `--to md`: verified
// empirically (2026-09-18, docling 2.129.0, against the real fixtures
// in fixtures/doctrine/) that `docling convert --to md` produces good,
// citable content but embeds NO page information at all — no anchors,
// no page breaks, nothing. `--to json` DOES carry `prov[].page_no` on
// every text/table/picture item, so this module does the page-anchor
// synthesis docling itself doesn't.
//
// Deliberately partial. Handles the item shapes seen in that empirical
// check: `text`, `section_header` (using its `level`), `footnote`,
// `table` (via `data.table_cells`' row/col offsets), `picture` (as an
// `<!-- image -->` placeholder, matching docling's own convention), and
// `group` (recursed into via `children`). `page_footer` is dropped
// (running page numbers, not body content). NOT handled: `list_item`,
// `key_value_items`, `form_items` — none appeared in the documents this
// was verified against; they render as plain paragraphs via the
// fallback rather than being silently dropped, but their structure
// (list nesting, key/value pairing) is lost. Extend this file's
// `renderItem` if a real doctrine PDF needs one of them.

interface BBox {
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Provenance {
  page_no: number;
  bbox: BBox;
}

interface DocRef {
  $ref: string;
}

interface BaseItem {
  self_ref: string;
  label: string;
  text?: string;
  level?: number;
  prov?: Provenance[];
  children?: DocRef[];
}

interface TableCell {
  text: string;
  start_row_offset_idx: number;
  end_row_offset_idx: number;
  start_col_offset_idx: number;
  end_col_offset_idx: number;
  row_span: number;
  col_span: number;
}

interface TableItem extends BaseItem {
  data?: { num_rows: number; num_cols: number; table_cells: TableCell[] };
}

export interface DoclingDocument {
  body: BaseItem;
  texts: BaseItem[];
  tables: TableItem[];
  pictures: BaseItem[];
  groups: BaseItem[];
  key_value_items?: BaseItem[];
  form_items?: BaseItem[];
}

function buildRefMap(doc: DoclingDocument): Map<string, BaseItem> {
  const map = new Map<string, BaseItem>();
  for (const arr of [doc.texts, doc.tables, doc.pictures, doc.groups, doc.key_value_items ?? [], doc.form_items ?? []]) {
    for (const item of arr) map.set(item.self_ref, item);
  }
  return map;
}

function renderTable(table: TableItem): string {
  const cells = table.data?.table_cells ?? [];
  const numRows = table.data?.num_rows ?? 0;
  const numCols = table.data?.num_cols ?? 0;
  if (numRows === 0 || numCols === 0) return "";

  const grid: string[][] = Array.from({ length: numRows }, () => Array.from({ length: numCols }, () => ""));
  for (const cell of cells) {
    const text = cell.text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
    for (let r = cell.start_row_offset_idx; r < cell.end_row_offset_idx && r < numRows; r++) {
      for (let c = cell.start_col_offset_idx; c < cell.end_col_offset_idx && c < numCols; c++) {
        grid[r]![c] = text;
      }
    }
  }

  const rowToMd = (row: string[]) => `| ${row.join(" | ")} |`;
  const header = grid[0] ?? [];
  const separator = header.map(() => "---");
  const lines = [rowToMd(header), rowToMd(separator), ...grid.slice(1).map(rowToMd)];
  return lines.join("\n");
}

function headingPrefix(level: number | undefined): string {
  const depth = Math.min(Math.max(level ?? 1, 1), 6);
  return "#".repeat(depth);
}

function isTableItem(item: BaseItem): item is TableItem {
  // Dispatch on shape, not `label`: verified empirically that docling
  // labels a table-of-contents-shaped table `document_index` rather than
  // `table` — checking only `label === "table"` silently dropped it
  // (fell through to the text-only default, which returned null since
  // table items have no top-level `.text`).
  return Array.isArray((item as TableItem).data?.table_cells);
}

function renderItem(item: BaseItem, refMap: Map<string, BaseItem>): string | null {
  if (isTableItem(item)) return renderTable(item);
  switch (item.label) {
    case "page_footer":
      return null;
    case "picture":
      return "<!-- image -->";
    case "section_header":
      return item.text ? `${headingPrefix(item.level)} ${item.text}` : null;
    case "footnote":
      // No positional link back to an in-text marker (docling doesn't
      // emit one) — rendered as a distinguishable paragraph rather than
      // fabricating a `[^n]` reference that doesn't actually resolve to
      // anything in the body text.
      return item.text ? `> ${item.text}` : null;
    case "group": {
      const children = (item.children ?? []).map((ref) => refMap.get(ref.$ref)).filter((x): x is BaseItem => Boolean(x));
      return children.map((c) => renderItem(c, refMap)).filter((s): s is string => s !== null).join("\n\n");
    }
    default:
      return item.text ? item.text : null;
  }
}

/** Renders a DoclingDocument to Markdown with `<!-- page:N -->` anchors on every page transition. */
export function renderDoclingDocumentToMarkdown(doc: DoclingDocument): string {
  const refMap = buildRefMap(doc);
  const topLevel = (doc.body.children ?? [])
    .map((ref) => refMap.get(ref.$ref))
    .filter((x): x is BaseItem => Boolean(x));

  const blocks: string[] = [];
  let currentPage: number | null = null;

  for (const item of topLevel) {
    const page = item.prov?.[0]?.page_no ?? null;
    if (page !== null && page !== currentPage) {
      blocks.push(`<!-- page:${page} -->`);
      currentPage = page;
    }
    const rendered = renderItem(item, refMap);
    if (rendered !== null && rendered !== "") blocks.push(rendered);
  }

  return blocks.join("\n\n") + "\n";
}

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ingestDocument, type ExtractorConfig } from "../src/ingest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fakeExtractorScript = join(__dirname, "fixtures", "fake-extractor.mjs");

function fakeExtractor(mode?: "fail"): ExtractorConfig {
  return {
    name: "fake",
    command: process.execPath,
    buildArgs: (inputPath, outputDir) => [fakeExtractorScript, inputPath, outputDir, ...(mode ? [mode] : [])],
    findOutput: (_inputPath, outputDir) => join(outputDir, "result.md"),
    pageAnchorsVerified: false,
  };
}

describe("ingestDocument (process-boundary contract)", () => {
  it("runs the configured extractor and returns its Markdown output", async () => {
    const result = await ingestDocument("/fake/path/doc.pdf", fakeExtractor());
    expect(result.extractor).toBe("fake");
    expect(result.markdown).toContain("From: /fake/path/doc.pdf");
    expect(result.markdown).toContain("<!-- page:1 -->");
    expect(result.markdown).toContain("<!-- page:2 -->");
  });

  it("reports pageAnchorsVerified from the extractor config (false for this fake one; true for doclingExtractor, verified against a real run — see docling-json.test.ts)", async () => {
    const result = await ingestDocument("/fake/path/doc.pdf", fakeExtractor());
    expect(result.pageAnchorsVerified).toBe(false);
  });

  it("propagates an extractor failure rather than swallowing it", async () => {
    await expect(ingestDocument("/fake/path/doc.pdf", fakeExtractor("fail"))).rejects.toThrow();
  });

  it("is extractor-agnostic: swapping the ExtractorConfig changes behavior with no ingest.ts changes", async () => {
    const custom: ExtractorConfig = {
      name: "custom-stub",
      command: process.execPath,
      buildArgs: (inputPath, outputDir) => [
        "-e",
        `require('fs').writeFileSync(require('path').join(process.argv[1], 'custom.md'), '# Custom\\n')`,
        outputDir,
      ],
      findOutput: (_inputPath, outputDir) => join(outputDir, "custom.md"),
      pageAnchorsVerified: false,
    };
    const result = await ingestDocument("/fake/doc.pdf", custom);
    expect(result.extractor).toBe("custom-stub");
    expect(result.markdown).toBe("# Custom\n");
  });
});

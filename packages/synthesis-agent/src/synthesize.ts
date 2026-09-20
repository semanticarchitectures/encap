import type Anthropic from "@anthropic-ai/sdk";
import { getDefaultClient, DEFAULT_MODEL } from "./client.js";
import { multiFileSystemPrompt, multiFileUserMessage, singleFileSystemPrompt, singleFileUserMessage } from "./prompts.js";
import { parseSynthesisOutput } from "./parse-response.js";
import { ensureFootnoteDefinitions, setGeneratedMetadata } from "./post-process.js";
import type { SynthesisInputDocument, SynthesisOptions, SynthesisResult } from "./types.js";
import type { Concept } from "@encap/okf-format";

// Bumped from 16000 after a real multi-file run (two full doctrine PDFs,
// ~100K input tokens combined) produced output with no frontmatter at
// all — parseSynthesisOutput failed with "no leading --- frontmatter
// block". stop_reason is now checked below and logged so this is
// confirmed rather than assumed on the next run; raising the ceiling is
// the direct fix if it turns out to be truncation (single-file synthesis
// of one ~64-page document fit comfortably under 16000; two full
// documents plausibly need more headroom for cross-document synthesis).
const MAX_TOKENS = 32000;

function extractText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// A long-running multi-file synthesis (large input, high effort) can have
// its underlying HTTP stream dropped mid-flight by the network path
// (found running this for real, twice in a row: `AnthropicError:
// terminated`, cause `ETIMEDOUT` at the TCP read). This isn't a 4xx/5xx
// the SDK's own retry-on-request covers — the connection was accepted
// and then died partway through — so retry it ourselves rather than
// surfacing a transient network blip as a synthesis failure.
const MAX_NETWORK_RETRIES = 2;

function isRetryableConnectionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
  return message === "terminated" || cause?.code === "ETIMEDOUT" || cause?.code === "ECONNRESET";
}

async function streamOnce(client: Anthropic, model: string, system: string, userMessage: string): Promise<Anthropic.Message> {
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return stream.finalMessage();
}

async function streamWithRetry(client: Anthropic, model: string, system: string, userMessage: string): Promise<Anthropic.Message> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await streamOnce(client, model, system, userMessage);
    } catch (err) {
      if (!isRetryableConnectionError(err) || attempt >= MAX_NETWORK_RETRIES) throw err;
    }
  }
}

async function runSynthesis(system: string, userMessage: string, outputPath: string, opts: SynthesisOptions | undefined): Promise<SynthesisResult> {
  const client = opts?.client ?? getDefaultClient();
  const model = opts?.model ?? DEFAULT_MODEL;

  const response = await streamWithRetry(client, model, system, userMessage);

  if (response.stop_reason === "refusal") {
    throw new Error(`synthesis refused by the model (stop_reason: refusal)`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `synthesis output was truncated (stop_reason: max_tokens, max_tokens=${MAX_TOKENS}, output_tokens=${response.usage.output_tokens}) — raise MAX_TOKENS or reduce input size`,
    );
  }
  const raw = extractText(response.content);
  let concept: Concept;
  try {
    concept = parseSynthesisOutput(raw, outputPath);
  } catch (err) {
    throw new Error(
      `${(err as Error).message}\nstop_reason: ${response.stop_reason}, output_tokens: ${response.usage.output_tokens}\nraw output (first 2000 chars):\n${raw.slice(0, 2000)}`,
    );
  }
  concept = ensureFootnoteDefinitions(concept);
  concept = setGeneratedMetadata(concept, model);

  return {
    concept,
    raw,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}

/** One document in, one OKF concept out (docs/PLAN.md Section 5, Phase 2 v1). */
export async function synthesizeSingleFile(
  doc: SynthesisInputDocument,
  outputPath: string,
  opts?: SynthesisOptions,
): Promise<SynthesisResult> {
  return runSynthesis(singleFileSystemPrompt(), singleFileUserMessage(doc), outputPath, opts);
}

/** Several documents in, one synthesized OKF concept out — not a concatenation (docs/PLAN.md Section 5, Phase 2). */
export async function synthesizeMultiFile(
  docs: SynthesisInputDocument[],
  outputPath: string,
  opts?: SynthesisOptions,
): Promise<SynthesisResult> {
  if (docs.length < 2) throw new Error("synthesizeMultiFile requires at least 2 documents — use synthesizeSingleFile for one");
  return runSynthesis(multiFileSystemPrompt(), multiFileUserMessage(docs), outputPath, opts);
}

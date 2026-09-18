import { getDefaultClient, DEFAULT_MODEL } from "./client.js";
import { multiFileSystemPrompt, multiFileUserMessage, singleFileSystemPrompt, singleFileUserMessage } from "./prompts.js";
import { parseSynthesisOutput } from "./parse-response.js";
import type { SynthesisInputDocument, SynthesisOptions, SynthesisResult } from "./types.js";

const MAX_TOKENS = 16000;

function extractText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function runSynthesis(system: string, userMessage: string, outputPath: string, opts: SynthesisOptions | undefined): Promise<SynthesisResult> {
  const client = opts?.client ?? getDefaultClient();
  const model = opts?.model ?? DEFAULT_MODEL;

  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error(`synthesis refused by the model (stop_reason: refusal)`);
  }
  const raw = extractText(response.content);
  const concept = parseSynthesisOutput(raw, outputPath);

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

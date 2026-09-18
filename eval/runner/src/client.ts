import Anthropic from "@anthropic-ai/sdk";

/** Per claude-api skill guidance: default to Opus unless told otherwise. */
export const DEFAULT_MODEL = "claude-opus-5";

let sharedClient: Anthropic | undefined;

/** Lazily creates a shared client from environment credentials — never construct one at module load time. */
export function getDefaultClient(): Anthropic {
  if (!sharedClient) sharedClient = new Anthropic();
  return sharedClient;
}

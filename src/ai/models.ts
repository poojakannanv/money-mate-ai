import Anthropic from "@anthropic-ai/sdk";

/**
 * Central place for model choices so a model swap is a one-line change
 * (and can be overridden per environment without a deploy).
 *
 * - CHAT_MODEL: the conversational co-pilot with function calling.
 * - FAST_MODEL: batch categorisation and the weekly digest, where a smaller,
 *   cheaper model is more than good enough.
 */
export const CHAT_MODEL =
  process.env.ANTHROPIC_CHAT_MODEL ?? "claude-sonnet-4-5";

export const FAST_MODEL =
  process.env.ANTHROPIC_FAST_MODEL ?? "claude-3-5-haiku-latest";

let client: Anthropic | null = null;

/** Lazily constructed Anthropic SDK client (reads ANTHROPIC_API_KEY). */
export function anthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/** Pull the concatenated text out of an Anthropic messages response. */
export function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Extract the first JSON array or object from a model reply, tolerating
 * code fences and surrounding prose.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;

  const firstBracket = Math.min(
    ...["[", "{"]
      .map((c) => candidate.indexOf(c))
      .filter((i) => i >= 0)
  );
  if (!Number.isFinite(firstBracket)) {
    throw new Error("No JSON found in model response");
  }
  const lastBracket = Math.max(
    candidate.lastIndexOf("]"),
    candidate.lastIndexOf("}")
  );
  const slice = candidate.slice(firstBracket, lastBracket + 1);
  return JSON.parse(slice);
}

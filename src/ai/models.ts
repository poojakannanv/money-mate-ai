import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Central place for provider and model choices, so swapping either is an
 * environment change rather than a code change.
 *
 * Supported providers:
 * - "groq":   free tier, OpenAI-compatible API (GROQ_API_KEY)
 * - "gemini": free tier, OpenAI-compatible API (GEMINI_API_KEY)
 * - "anthropic": Claude, pay as you go (ANTHROPIC_API_KEY)
 *
 * Set AI_PROVIDER to force one. Otherwise the first provider with a key
 * wins, free tiers first, so adding a free key is enough to switch.
 *
 * Every provider is reached through the Vercel AI SDK, so the chat route,
 * the categoriser and the weekly digest share one code path.
 */

export type AiProvider = "groq" | "gemini" | "anthropic";

interface ProviderPreset {
  keyEnv: string;
  baseURL?: string;
  chatModel: string;
  fastModel: string;
}

const PRESETS: Record<AiProvider, ProviderPreset> = {
  groq: {
    keyEnv: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    chatModel: "openai/gpt-oss-120b",
    fastModel: "openai/gpt-oss-20b",
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    chatModel: "gemini-flash-latest",
    fastModel: "gemini-flash-lite-latest",
  },
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    chatModel: "claude-sonnet-4-5",
    fastModel: "claude-3-5-haiku-latest",
  },
};

const DETECTION_ORDER: AiProvider[] = ["groq", "gemini", "anthropic"];

function isProvider(value: string | undefined): value is AiProvider {
  return value === "groq" || value === "gemini" || value === "anthropic";
}

/** Which provider is active, or null when no API key is configured. */
export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (isProvider(forced)) {
    return process.env[PRESETS[forced].keyEnv] ? forced : null;
  }
  return DETECTION_ORDER.find((p) => !!process.env[PRESETS[p].keyEnv]) ?? null;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider is configured. Set GROQ_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY."
    );
    this.name = "AiNotConfiguredError";
  }
}

function buildModel(kind: "chat" | "fast"): LanguageModel {
  const provider = aiProvider();
  if (!provider) throw new AiNotConfiguredError();

  const preset = PRESETS[provider];
  const apiKey = process.env[preset.keyEnv];

  // AI_CHAT_MODEL / AI_FAST_MODEL override any provider's default. The
  // ANTHROPIC_* names are kept so existing deployments keep working.
  const override =
    kind === "chat"
      ? process.env.AI_CHAT_MODEL ??
        (provider === "anthropic" ? process.env.ANTHROPIC_CHAT_MODEL : undefined)
      : process.env.AI_FAST_MODEL ??
        (provider === "anthropic" ? process.env.ANTHROPIC_FAST_MODEL : undefined);
  const modelId =
    override ?? (kind === "chat" ? preset.chatModel : preset.fastModel);

  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(modelId);
  }
  return createOpenAI({
    apiKey,
    baseURL: preset.baseURL,
    compatibility: "compatible",
  })(modelId);
}

/** The conversational co-pilot model, used with function calling. */
export function chatModel(): LanguageModel {
  return buildModel("chat");
}

/** A smaller model for batch categorisation and the weekly digest. */
export function fastModel(): LanguageModel {
  return buildModel("fast");
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

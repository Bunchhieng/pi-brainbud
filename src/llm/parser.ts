import type { BrainBudTipSuggestion } from "../types";

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseLlmTipResponse(text: string): BrainBudTipSuggestion | undefined {
  try {
    const parsed = JSON.parse(extractJsonBlock(text)) as {
      shouldTip?: unknown;
      title?: unknown;
      body?: unknown;
      category?: unknown;
      code?: unknown;
      learnMoreUrl?: unknown;
    };

    if (parsed.shouldTip !== true) return undefined;
    if (typeof parsed.title !== "string" || typeof parsed.body !== "string") return undefined;

    return {
      title: parsed.title.trim(),
      body: parsed.body.trim(),
      category: typeof parsed.category === "string" ? parsed.category.trim() : "general",
      ...(typeof parsed.code === "string" && parsed.code.trim() ? { code: parsed.code.trim() } : {}),
      ...(typeof parsed.learnMoreUrl === "string" ? { learnMoreUrl: parsed.learnMoreUrl.trim() } : {})
    };
  } catch {
    return undefined;
  }
}

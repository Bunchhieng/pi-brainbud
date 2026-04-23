import { stream } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import type { BrainBudTipSuggestion } from "../types";

const SYSTEM_PROMPT = [
  "You are a code review assistant.",
  "Given a programming tip and a code snippet, decide if the snippet is correct and directly illustrates the tip.",
  "Return JSON only. No markdown fences.",
  'Schema: {"valid":boolean,"reason":string}',
  "valid=true only if: the code is syntactically plausible, it demonstrates exactly what the tip body describes, and it would not mislead the reader.",
  "valid=false if: the code has obvious errors, contradicts the body, is off-topic, or is too generic to add value.",
].join("\n");

function buildPrompt(tip: BrainBudTipSuggestion): string {
  return [
    `Title: ${tip.title}`,
    `Body: ${tip.body}`,
    `Code:\n${tip.code}`,
  ].join("\n");
}

interface ValidationResult {
  valid: boolean;
  reason: string;
}

function parseResult(text: string): ValidationResult {
  try {
    const raw = JSON.parse(text.trim()) as { valid?: unknown; reason?: unknown };
    return {
      valid: raw.valid === true,
      reason: typeof raw.reason === "string" ? raw.reason : "",
    };
  } catch {
    return { valid: true, reason: "parse error — keeping code" };
  }
}

export async function validateTipCode(
  ctx: ExtensionContext,
  tip: BrainBudTipSuggestion
): Promise<BrainBudTipSuggestion> {
  if (!tip.code) return tip;
  if (!ctx.model) return tip;

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
  if (!auth.ok) return tip;

  const eventStream = stream(
    ctx.model,
    {
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: [{ type: "text", text: buildPrompt(tip) }],
        },
      ],
    },
    {
      reasoningEffort: "minimal",
      ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
      ...(auth.headers ? { headers: auth.headers } : {}),
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    }
  );

  let text = "";
  for await (const event of eventStream) {
    if (event.type === "text_delta") text += event.delta;
    if (event.type === "error") return tip;
  }

  const result = parseResult(text.trim());
  if (result.valid) return tip;

  // Strip the code but keep the rest of the tip
  const { code: _dropped, ...rest } = tip;
  return rest;
}

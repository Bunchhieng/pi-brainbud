import { stream } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import { buildConversationSnapshot, buildLlmTipPrompt, SYSTEM_PROMPT } from "./prompt";
import { parseLlmTipResponse } from "./parser";
import { validateTipCode } from "./validator";
import type { BrainBudTipSuggestion, TipContext } from "../types";

export async function generateTipWithLlm(
  ctx: ExtensionContext,
  context: TipContext,
  recentTipTitles: string[]
): Promise<BrainBudTipSuggestion | undefined> {
  if (!ctx.model) return undefined;

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
  if (!auth.ok) return undefined;

  const eventStream = stream(
    ctx.model,
    {
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: [
            {
              type: "text",
              text: buildLlmTipPrompt({
                context,
                recentTipTitles,
                conversationSnapshot: buildConversationSnapshot(ctx)
              })
            }
          ]
        }
      ]
    },
    {
      reasoningEffort: "minimal",
      ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
      ...(auth.headers ? { headers: auth.headers } : {}),
      ...(ctx.signal ? { signal: ctx.signal } : {})
    }
  );

  let text = "";
  for await (const event of eventStream) {
    if (event.type === "text_delta") text += event.delta;
    if (event.type === "error") return undefined;
  }

  const tip = text.trim() ? parseLlmTipResponse(text.trim()) : undefined;
  if (!tip) return undefined;
  return validateTipCode(ctx, tip);
}

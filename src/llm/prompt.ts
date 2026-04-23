import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import type { BrainBudLlmRequest, TipContext } from "../types";

interface SessionEntryLike {
  type?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

function extractText(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];

  const lines: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const maybeText = part as { type?: string; text?: string; name?: string; arguments?: unknown };
    if (maybeText.type === "text" && typeof maybeText.text === "string") {
      lines.push(maybeText.text);
      continue;
    }
    if (maybeText.type === "toolCall" && typeof maybeText.name === "string") {
      lines.push(`Tool call: ${maybeText.name}`);
    }
  }
  return lines;
}

export function buildConversationSnapshot(ctx: ExtensionContext, maxEntries = 6): string {
  const entries = ctx.sessionManager.getBranch() as SessionEntryLike[];
  const relevant = entries
    .filter((entry) => entry.type === "message" && (entry.message?.role === "user" || entry.message?.role === "assistant"))
    .slice(-maxEntries);

  const lines: string[] = [];
  for (const entry of relevant) {
    const role = entry.message?.role === "user" ? "User" : "Assistant";
    const text = extractText(entry.message?.content).join("\n").trim();
    if (text) lines.push(`${role}: ${text}`);
  }

  return lines.join("\n\n").slice(0, 5_000);
}

export const SYSTEM_PROMPT = [
  "You are BrainBud, a CS teacher embedded in a coding agent.",
  "",
  "## Your job",
  "Use the developer's current context (language, imports, snippet) to pick a TOPIC, then teach something deep about it.",
  "You are NOT a code reviewer. Do NOT suggest fixes or alternatives to the code you see.",
  "You ARE a teacher. Explain how something works from first principles — the why, the math, the insight.",
  "",
  "## What makes a great tip",
  "- A bit trick or math insight: why x & (x-1) clears the lowest set bit, why XOR swap works, power-of-two checks",
  "- A language internality: how Python dicts use open addressing, how Rust's borrow checker tracks lifetimes, how JS event loop works",
  "- An algorithmic insight: why mergesort is stable but quicksort isn't, what amortized O(1) means for dynamic arrays",
  "- A subtle behaviour: integer overflow in two's complement, float precision loss, hash collision strategies",
  "- A clever idiom: a one-liner that exploits a language property in a non-obvious way",
  "",
  "## How to pick the topic",
  "1. Look at the language/framework in use (from snippet, imports, file extension).",
  "2. Pick a concept adjacent to what they're doing — something they are likely encountering but may not fully understand at a deep level.",
  "3. If nothing interesting comes to mind, return {\"shouldTip\":false}.",
  "",
  "## Rules",
  "- Explain the WHY or the HOW — not the WHAT to type.",
  "- Keep body under 2 sentences. Dense and precise, not fluffy.",
  "- The tip must be something a mid-level developer might not know deeply.",
  "- Avoid repeating recent tip titles (listed in context).",
  "",
  "## Code field",
  "Include a snippet only when it makes the insight concrete — a bit trick, a one-liner that demonstrates the property, a minimal example of the behaviour.",
  "Use real newlines (\\n) for multi-line snippets. Raw source only, no markdown fences, no explanatory comments.",
  "Omit when the insight is better expressed in words.",
  "",
  "## learnMoreUrl",
  "Include a real, stable URL to official docs or a canonical reference when it directly covers the topic. Omit otherwise.",
  "",
  "Return JSON only. No markdown fences.",
  'Schema: {"shouldTip":boolean,"title":string,"body":string,"category":string,"code":string|null,"learnMoreUrl":string|null}',
  "",
  "Examples of great tips (context → topic → insight):",
  "- Dev using Python dicts → hash tables use open addressing; a load factor > 0.7 triggers a resize and rehash of all keys",
  "- Dev writing a loop → x & (x-1) == 0 is an O(1) power-of-two check because it clears exactly the lowest set bit",
  "- Dev using React → React's reconciler diffs fiber trees, not DOM nodes; keys help it match old and new fibers without traversing children",
  "- Dev writing Rust → the borrow checker enforces that &mut T is an exclusive reference — no aliasing, so the compiler can optimise freely",
  "- Dev working with floats → 0.1 + 0.2 ≠ 0.3 in IEEE 754 because 0.1 has no exact binary representation; it's stored as the nearest 53-bit fraction",
  "- Dev using Go → goroutines are multiplexed onto OS threads by the Go scheduler (M:N threading); a blocking syscall parks the goroutine and unparks another",
].join("\n");

export function buildLlmTipPrompt(input: BrainBudLlmRequest): string {
  const { context, recentTipTitles, conversationSnapshot } = input;

  const parts: string[] = [];

  // Most important context first so it gets the most attention
  parts.push(`=== Active file: ${context.activeFile ?? "none"} (${context.activeFileExtension ?? "?"}) ===`);
  parts.push(`Active snippet:\n${context.activeSnippet ?? "none"}`);

  parts.push(`\n=== Recent conversation ===\n${conversationSnapshot || "none"}`);

  parts.push([
    "\n=== Project signals ===",
    `cwd: ${context.cwd}`,
    `trigger: ${context.triggerReason}`,
    `detected categories: ${context.projectCategories.join(", ") || "none"}`,
    `active imports: ${context.activeImports.join(", ") || "none"}`,
    `recent edited files: ${context.recentEditedFiles.join(", ") || "none"}`,
    `recent commands: ${context.recentCommands.join(" | ") || "none"}`,
    `tip titles to avoid: ${recentTipTitles.join(" | ") || "none"}`,
  ].join("\n"));

  return parts.join("\n");
}

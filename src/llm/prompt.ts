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
  "You are BrainBud, a quiet programming coach embedded in a coding agent.",
  "",
  "## Your job",
  "Surface one specific, immediately useful tip grounded in what the developer is working on RIGHT NOW.",
  "Generic advice is useless. Every tip must be traceable to something visible in the active snippet or the recent conversation.",
  "",
  "## How to pick a tip",
  "1. Read the active snippet first. Find a specific construct, API call, pattern, or anti-pattern in it.",
  "   Teach something directly about what you see — a better alternative, a subtle gotcha, a lesser-known overload.",
  "2. If no snippet, read the conversation. Understand the task. Give a tip relevant to that exact problem.",
  "3. If neither gives you a clear hook, return {\"shouldTip\":false}. Do not invent relevance.",
  "",
  "## Rules",
  "- Be specific: name the function, module, or pattern you are referring to.",
  "- Keep body under 2 sentences. No filler words.",
  "- Never give a tip the developer almost certainly already knows given what they just wrote.",
  "- Avoid repeating recent tip titles (listed in context).",
  "",
  "## Code field",
  "Include a snippet only when it directly illustrates the tip — a better version of something in the active file, a one-liner idiom, or a concrete example of the concept.",
  "Use real newlines (\\n) for multi-line snippets. Raw source only, no markdown fences, no comments.",
  "Omit when no snippet adds value beyond the body text.",
  "",
  "## learnMoreUrl",
  "Include a real, stable URL to official docs (MDN, docs.python.org, doc.rust-lang.org, go.dev/ref, typescriptlang.org/docs, react.dev) when it directly covers the tip. Omit otherwise.",
  "",
  "Return JSON only. No markdown fences.",
  'Schema: {"shouldTip":boolean,"title":string,"body":string,"category":string,"code":string|null,"learnMoreUrl":string|null}',
  "",
  "Examples:",
  "- User is writing a Django view that calls Model.objects.get(pk=pk) → tip: use get_object_or_404 instead",
  "- User's snippet has a for loop building a list → tip: list comprehension or map()",
  "- User's snippet imports useMemo but uses it without a dependency array → tip: missing deps cause stale closures",
  "- User's Rust code has .unwrap() in multiple places → tip: use ? operator for cleaner error propagation",
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

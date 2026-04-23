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
  "You are BrainBud, a quiet programming coach inside pi.",
  "Generate exactly one brief, useful tip for the developer based on the current coding context.",
  "The tip can be a gotcha, concept reminder, bit trick, clever language idiom, debugging nudge, design hint, or fun fact.",
  "Only give a tip if it is contextually relevant and likely useful right now.",
  "Never interrupt flow: be specific, calm, and non-cheesy.",
  "Keep body under 2 sentences.",
  "Prefer practical insight over generic advice.",
  "When the tip has a concrete illustration, include a short code snippet (1-4 lines) in the code field — e.g. a bit trick, one-liner, or idiom that demonstrates the point directly.",
  "The code field must use real newlines (\\n) for multi-line snippets and preserve indentation exactly as it would appear in source.",
  "The code field should be raw source, no markdown fences, no explanatory comments.",
  "Omit the code field when no concise snippet would add value.",
  "For learnMoreUrl: include a real, stable URL to official documentation (MDN, docs.python.org, doc.rust-lang.org, go.dev/ref, typescriptlang.org/docs, react.dev, etc.) when one directly covers the tip topic. Omit if no authoritative link applies.",
  "If you are not confident a tip would help, return {\"shouldTip\":false}.",
  "Return JSON only. No markdown fences.",
  "JSON schema:",
  '{"shouldTip":boolean,"title":string,"body":string,"category":string,"code":string|null,"learnMoreUrl":string|null}',
  "",
  "Good examples (use \\n for newlines in the JSON code field):",
  "- TypeScript satisfies — code: \"const cfg = { port: 3000 } satisfies Config;\", learnMoreUrl: \"https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html\"",
  "- React derived state — code: \"const sorted = useMemo(\\n  () => [...items].sort(),\\n  [items]\\n);\", learnMoreUrl: \"https://react.dev/reference/react/useMemo\"",
  "- Bit trick XOR swap — code: \"a ^= b;\\nb ^= a;\\na ^= b;\", learnMoreUrl: null",
  "- Go power-of-two check — code: \"isPow2 := n > 0 &&\\n  n&(n-1) == 0\", learnMoreUrl: null",
  "- Rust entry API — code: \"map.entry(key)\\n   .or_insert(0);\", learnMoreUrl: \"https://doc.rust-lang.org/std/collections/hash_map/enum.Entry.html\"",
  "- Python walrus operator — code: \"if m := re.match(pattern, s):\\n    print(m.group())\", learnMoreUrl: \"https://docs.python.org/3/whatsnew/3.8.html#assignment-expressions\"",
].join("\n");

export function buildLlmTipPrompt(input: BrainBudLlmRequest): string {
  const { context, recentTipTitles, conversationSnapshot } = input;

  return [
    "Current context:",
    `- cwd: ${context.cwd}`,
    `- trigger: ${context.triggerReason}`,
    `- detected categories: ${context.projectCategories.join(", ") || "none"}`,
    `- active file: ${context.activeFile ?? "none"}`,
    `- active extension: ${context.activeFileExtension ?? "none"}`,
    `- active imports: ${context.activeImports.join(", ") || "none"}`,
    `- recent edited files: ${context.recentEditedFiles.join(", ") || "none"}`,
    `- recent commands: ${context.recentCommands.join(" | ") || "none"}`,
    `- active snippet:\n${context.activeSnippet ?? "none"}`,
    `- recent tip titles to avoid repeating: ${recentTipTitles.join(" | ") || "none"}`,
    `- recent conversation snapshot:\n${conversationSnapshot || "none"}`,
  ].join("\n");
}

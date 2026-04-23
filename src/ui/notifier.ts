import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { BrainBudTipSuggestion } from "../types";

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const AMBER = "\x1b[93m";
const WHITE = "\x1b[97m";

const MSG_TYPE  = "brainbud-tip";
const MIN_INNER = 36;
const MAX_INNER = 72;
const BODY_SOFT_MAX = 60; // wrap body at this width in pass 1 to find natural line lengths

// ── width helpers ────────────────────────────────────────────────────────────

function visibleLen(text: string): number {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  let len = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0) ?? 0;
    // Supplementary code points (emoji, etc.) render as 2 terminal columns
    len += cp > 0xFFFF ? 2 : 1;
  }
  return len;
}

function padTo(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLen(text)));
}

// Uses visibleLen so wrapping is consistent with terminal column width
function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  let currentLen = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const wordLen = visibleLen(word);
    if (current && currentLen + 1 + wordLen > width) {
      lines.push(current);
      current = word;
      currentLen = wordLen;
    } else {
      current = current ? `${current} ${word}` : word;
      currentLen = current === word ? wordLen : currentLen + 1 + wordLen;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ── layout ───────────────────────────────────────────────────────────────────

function terminalWidth(): number {
  return process.stdout.columns ?? 80;
}

/**
 * Two-pass layout:
 *  Pass 1 — wrap body at BODY_SOFT_MAX, measure every content line.
 *  inner  = clamp(max measured width, MIN_INNER, min(MAX_INNER, termWidth−6))
 *  Pass 2 — re-wrap body at inner and draw the box.
 */
function computeInner(tip: BrainBudTipSuggestion): number {
  const hardMax = Math.min(MAX_INNER, terminalWidth() - 6);

  const candidates: number[] = [];

  // Title: "🧠  <title>" — visibleLen handles the emoji columns correctly
  candidates.push(visibleLen(`🧠  ${tip.title}`));

  // Body — wrap at BODY_SOFT_MAX to find natural line widths
  for (const line of wrapWords(tip.body, BODY_SOFT_MAX)) {
    candidates.push(visibleLen(line));
  }

  // Code lines — prefer no wrapping so the meaning is preserved
  if (tip.code) {
    for (const line of tip.code.split("\n")) {
      candidates.push(visibleLen(`  ${line.trimEnd()}`));
    }
  }

  const natural = Math.max(...candidates);
  // +2 gives a small breathing margin so content never hugs the right border
  return Math.max(MIN_INNER, Math.min(hardMax, natural + 2));
}

// ── rendering ────────────────────────────────────────────────────────────────

function makeBox(inner: number) {
  const rule = (l: string, r: string) => `${AMBER}${l}${"─".repeat(inner + 2)}${r}${RESET}`;
  return {
    top:    () => rule("╭", "╮"),
    bottom: () => rule("╰", "╯"),
    div:    () => `${AMBER}├${"─".repeat(inner + 2)}┤${RESET}`,
    row:    (content: string) => `${AMBER}│${RESET} ${padTo(content, inner)} ${AMBER}│${RESET}`,
  };
}

function formatTip(tip: BrainBudTipSuggestion): string {
  const inner = computeInner(tip);
  const box   = makeBox(inner);
  const lines: string[] = [];

  // ── header
  lines.push(box.top());
  lines.push(box.row(`🧠  ${BOLD}${WHITE}${tip.title}${RESET}`));
  lines.push(box.div());

  // ── body (pass 2: wrap at inner so lines never exceed the box width)
  for (const line of wrapWords(tip.body, inner)) {
    lines.push(box.row(line));
  }

  // ── code
  if (tip.code) {
    lines.push(box.div());
    for (const codeLine of tip.code.split("\n")) {
      const trimmed = codeLine.trimEnd();
        let remaining = trimmed;
      let first = true;
      do {
        const indent = first ? "  " : "    ";
        const avail  = inner - visibleLen(indent);
        const chunk  = remaining.slice(0, avail);
        lines.push(box.row(`${CYAN}${indent}${chunk}${RESET}`));
        remaining = remaining.slice(chunk.length);
        first = false;
      } while (remaining.length > 0);
    }
  }

  lines.push(box.bottom());

  // URL outside the box — any length, no alignment math needed
  if (tip.learnMoreUrl) {
    lines.push(`${DIM}↗  ${tip.learnMoreUrl}${RESET}`);
  }

  return lines.join("\n");
}

// ── export ───────────────────────────────────────────────────────────────────

class TipNotifier {
  showTip(pi: ExtensionAPI, tip: BrainBudTipSuggestion): void {
    pi.sendMessage({
      customType: MSG_TYPE,
      content: formatTip(tip),
      display: true
    });
  }
}

export const notifier = new TipNotifier();

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { BrainBudTipSuggestion } from "../types";

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const AMBER = "\x1b[93m";
const WHITE = "\x1b[97m";

const MSG_TYPE   = "brainbud-tip";
const INNER      = 60;           // box content width
const WRAP_WIDTH = INNER - 2;    // body/code wrap — guarantees ≥2 spaces of right margin

function visibleLen(text: string): number {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  let len = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0) ?? 0;
    len += cp > 0xFFFF ? 2 : 1;   // emoji & supplementary = 2 terminal columns
  }
  return len;
}

function padTo(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLen(text)));
}

function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

const topBorder    = () => `${AMBER}╭${"─".repeat(INNER + 2)}╮${RESET}`;
const bottomBorder = () => `${AMBER}╰${"─".repeat(INNER + 2)}╯${RESET}`;
const divider      = () => `${AMBER}├${"─".repeat(INNER + 2)}┤${RESET}`;
const row          = (content: string) =>
  `${AMBER}│${RESET} ${padTo(content, INNER)} ${AMBER}│${RESET}`;

function formatTip(tip: BrainBudTipSuggestion): string {
  const lines: string[] = [];

  lines.push(topBorder());
  lines.push(row(`🧠  ${BOLD}${WHITE}${tip.title}${RESET}`));
  lines.push(divider());

  for (const line of wrapWords(tip.body, WRAP_WIDTH)) {
    lines.push(row(line));
  }

  if (tip.code) {
    lines.push(divider());
    for (const codeLine of tip.code.split("\n")) {
      const trimmed = codeLine.trimEnd();
      // Wrap long code lines at WRAP_WIDTH - 2 (accounts for the 2-space indent)
      let remaining = trimmed;
      let first = true;
      do {
        const indent = first ? "  " : "    ";
        const chunk = remaining.slice(0, WRAP_WIDTH - indent.length);
        lines.push(row(`${CYAN}${indent}${chunk}${RESET}`));
        remaining = remaining.slice(chunk.length);
        first = false;
      } while (remaining.length > 0);
    }
  }

  lines.push(bottomBorder());

  // URL sits outside the box — no alignment constraint, any length is fine
  if (tip.learnMoreUrl) {
    lines.push(`${DIM}↗  ${tip.learnMoreUrl}${RESET}`);
  }

  return lines.join("\n");
}

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

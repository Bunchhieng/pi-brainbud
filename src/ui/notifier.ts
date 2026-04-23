import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import type { BrainBudTipSuggestion } from "../types";

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const WHITE = "\x1b[97m";

const INNER      = 62;
const WIDGET_KEY = "brainbud";
const DISPLAY_MS = 20_000;
const MAX_LINES  = 10;

const CODE_INDENT      = "  ";
const CODE_WRAP_INDENT = "    ";

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function padTo(text: string, width: number): string {
  const visible = stripAnsi(text).length;
  return text + " ".repeat(Math.max(0, width - visible));
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
  return lines;
}

function topBorder(title: string): string {
  const label = ` ${title} `;
  const labelVisible = stripAnsi(label).length;
  const fill = Math.max(0, INNER + 2 - labelVisible);
  return `${DIM}╭${RESET}${BOLD}${WHITE}${label}${RESET}${DIM}${"─".repeat(fill)}╮${RESET}`;
}

function divider(): string {
  return `${DIM}├${"─".repeat(INNER + 2)}┤${RESET}`;
}

function bottomBorder(): string {
  return `${DIM}╰${"─".repeat(INNER + 2)}╯${RESET}`;
}

function row(content: string): string {
  return `${DIM}│${RESET} ${padTo(content, INNER)} ${DIM}│${RESET}`;
}

function renderCode(code: string): string[] {
  const lines: string[] = [];
  for (const codeLine of code.split("\n")) {
    const trimmed = codeLine.trimEnd();
    const maxWidth = INNER - CODE_INDENT.length;
    if (trimmed.length <= maxWidth) {
      lines.push(row(`${CYAN}${CODE_INDENT}${trimmed}${RESET}`));
    } else {
      let remaining = trimmed;
      let first = true;
      while (remaining.length > 0) {
        const indent = first ? CODE_INDENT : CODE_WRAP_INDENT;
        const width = INNER - indent.length;
        lines.push(row(`${CYAN}${indent}${remaining.slice(0, width)}${RESET}`));
        remaining = remaining.slice(width);
        first = false;
      }
    }
  }
  return lines;
}

function buildWidget(tip: BrainBudTipSuggestion): string[] {
  const lines: string[] = [];
  // budget: MAX_LINES total; top + bottom borders = 2; each section may also need a divider
  const budget = () => MAX_LINES - lines.length - 1; // -1 reserved for bottom border

  lines.push(topBorder(`🧠 ${tip.title}`));

  for (const line of wrapWords(tip.body, INNER)) {
    if (budget() <= 0) break;
    lines.push(row(line));
  }

  if (tip.code && budget() >= 2) {
    const codeLines = renderCode(tip.code).slice(0, budget() - 1); // -1 for divider
    lines.push(divider());
    lines.push(...codeLines);
  }

  if (tip.learnMoreUrl && budget() >= 2) {
    lines.push(divider());
    lines.push(row(`${DIM}↗ ${tip.learnMoreUrl}${RESET}`));
  }

  lines.push(bottomBorder());

  return lines;
}

class TipNotifier {
  showTip(ctx: ExtensionContext, tip: BrainBudTipSuggestion): void {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(WIDGET_KEY, buildWidget(tip), { placement: "belowEditor" });
    setTimeout(() => ctx.ui.setWidget(WIDGET_KEY, undefined), DISPLAY_MS);
  }
}

export const notifier = new TipNotifier();

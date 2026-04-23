import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { BrainBudTipSuggestion } from "../types";

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const AMBER = "\x1b[93m";
const WHITE = "\x1b[97m";

const MSG_TYPE    = "brainbud-tip";
const WRAP_WIDTH  = 64;
const BAR         = `${AMBER}│${RESET}`;

function visibleLen(text: string): number {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  let len = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0) ?? 0;
    len += cp > 0xFFFF ? 2 : 1;
  }
  return len;
}

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

function formatTip(tip: BrainBudTipSuggestion): string {
  const wrap = Math.min(WRAP_WIDTH, (process.stdout.columns ?? 80) - 4);
  const lines: string[] = [];

  const bar  = (text: string) => `${BAR} ${text}`;
  const gap  = () => BAR;

  // Header
  lines.push(bar(`🧠  ${BOLD}${WHITE}${tip.title}${RESET}`));
  lines.push(gap());

  // Body
  for (const line of wrapWords(tip.body, wrap)) {
    lines.push(bar(line));
  }

  // Code
  if (tip.code) {
    lines.push(gap());
    for (const codeLine of tip.code.split("\n")) {
      lines.push(bar(`${CYAN}  ${codeLine.trimEnd()}${RESET}`));
    }
  }

  // URL
  if (tip.learnMoreUrl) {
    lines.push(gap());
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

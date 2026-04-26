import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BrainBudTipSuggestion } from "../types";

export interface TipHistoryEntry {
  tip: BrainBudTipSuggestion;
  savedAt: number;
}

const HISTORY_PATH = path.join(os.homedir(), ".pi", "brainbud-history.json");
const MAX_ENTRIES = 100;

async function load(): Promise<TipHistoryEntry[]> {
  try {
    const text = await fs.readFile(HISTORY_PATH, "utf8");
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as TipHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function save(entries: TipHistoryEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function appendTip(tip: BrainBudTipSuggestion): Promise<void> {
  const entries = await load();
  entries.unshift({ tip, savedAt: Date.now() });
  await save(entries.slice(0, MAX_ENTRIES));
}

export async function getLastTip(): Promise<TipHistoryEntry | undefined> {
  const entries = await load();
  return entries[0];
}

export async function getHistory(limit = 10): Promise<TipHistoryEntry[]> {
  const entries = await load();
  return entries.slice(0, limit);
}

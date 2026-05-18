import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BrainBudTipSuggestion, FeedbackSummary } from "../types";

export interface TipHistoryEntry {
  tip: BrainBudTipSuggestion;
  savedAt: number;
  rating?: "up" | "down";
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

export async function rateLastTip(rating: "up" | "down"): Promise<boolean> {
  const entries = await load();
  if (entries.length === 0) return false;
  const first = entries[0];
  if (!first) return false;
  first.rating = rating;
  await save(entries);
  return true;
}

export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const entries = await load();
  const rated = entries.filter((e) => e.rating !== undefined);

  const liked = rated.filter((e) => e.rating === "up");
  const disliked = rated.filter((e) => e.rating === "down");

  const tally = (items: TipHistoryEntry[]) => {
    const counts: Record<string, number> = {};
    for (const e of items) {
      const cat = e.tip.category;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  };

  const likedCounts = tally(liked);
  const dislikedCounts = tally(disliked);

  const preferredCategories = Object.entries(likedCounts)
    .filter(([cat, count]) => count >= 2 && (dislikedCounts[cat] ?? 0) < count)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const avoidedCategories = Object.entries(dislikedCounts)
    .filter(([cat, count]) => count >= 2 && (likedCounts[cat] ?? 0) < count)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  return {
    likedExamples: liked.slice(0, 5).map((e) => ({ title: e.tip.title, category: e.tip.category })),
    dislikedExamples: disliked.slice(0, 5).map((e) => ({ title: e.tip.title, category: e.tip.category })),
    preferredCategories,
    avoidedCategories,
  };
}

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BrainBudCategory, BrainBudConfig } from "../types";

const ALL_CATEGORIES: BrainBudCategory[] = ["python", "django", "react", "typescript", "rust", "go"];

const DEFAULT_CONFIG: BrainBudConfig = {
  frequencyMinutes: 3,
  enabledCategories: ALL_CATEGORIES,
  idleDelayMs: 45_000,
  recentTipMemory: 12,
  maxSnippetChars: 4_000
};

interface RawBrainBudSettings {
  frequencyMinutes?: unknown;
  enabledCategories?: unknown;
  idleDelayMs?: unknown;
  recentTipMemory?: unknown;
  maxSnippetChars?: unknown;
}

interface RawSettingsFile {
  brainbud?: RawBrainBudSettings;
}

async function readJsonIfPresent(filePath: string): Promise<RawSettingsFile | undefined> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as RawSettingsFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asCategories(value: unknown, fallback: BrainBudCategory[]): BrainBudCategory[] {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter((item): item is BrainBudCategory => ALL_CATEGORIES.includes(item as BrainBudCategory));
  return filtered.length > 0 ? filtered : fallback;
}

function mergeBrainBudSettings(base: BrainBudConfig, raw?: RawBrainBudSettings): BrainBudConfig {
  if (!raw) return base;
  return {
    frequencyMinutes: Math.max(1, asNumber(raw.frequencyMinutes, base.frequencyMinutes)),
    enabledCategories: asCategories(raw.enabledCategories, base.enabledCategories),
    idleDelayMs: Math.max(5_000, asNumber(raw.idleDelayMs, base.idleDelayMs)),
    recentTipMemory: Math.max(1, asNumber(raw.recentTipMemory, base.recentTipMemory)),
    maxSnippetChars: Math.max(500, asNumber(raw.maxSnippetChars, base.maxSnippetChars))
  };
}

export async function loadBrainBudConfig(cwd: string): Promise<BrainBudConfig> {
  const globalSettingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  const projectSettingsPath = path.join(cwd, ".pi", "settings.json");

  const [globalSettings, projectSettings] = await Promise.all([
    readJsonIfPresent(globalSettingsPath),
    readJsonIfPresent(projectSettingsPath)
  ]);

  return mergeBrainBudSettings(
    mergeBrainBudSettings(DEFAULT_CONFIG, globalSettings?.brainbud),
    projectSettings?.brainbud
  );
}


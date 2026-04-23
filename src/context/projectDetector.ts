import { promises as fs } from "node:fs";
import path from "node:path";

import type { BrainBudCategory } from "../types";

interface ProjectSignals {
  categories: BrainBudCategory[];
  matchedFiles: string[];
}

const MANIFESTS = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod"
] as const;

async function readText(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function packageJsonSignals(content: string): BrainBudCategory[] {
  const categories = new Set<BrainBudCategory>();
  try {
    const parsed = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    if (deps.react || deps["react-dom"] || deps.next) categories.add("react");
    if (deps.typescript || deps["ts-node"] || deps.vitest) categories.add("typescript");
  } catch {
    // malformed package.json — stay passive
  }
  return [...categories];
}

function detectCategoriesFromManifest(fileName: string, content: string): BrainBudCategory[] {
  const categories = new Set<BrainBudCategory>();
  const lower = content.toLowerCase();

  if (fileName === "package.json") {
    for (const category of packageJsonSignals(content)) categories.add(category);
  }

  if (fileName === "requirements.txt" || fileName === "pyproject.toml") {
    categories.add("python");
    if (lower.includes("django")) categories.add("django");
  }

  if (fileName === "Cargo.toml") categories.add("rust");
  if (fileName === "go.mod") categories.add("go");

  if (lower.includes("typescript") || lower.includes('"tsx"')) categories.add("typescript");
  if (lower.includes("react")) categories.add("react");

  return [...categories];
}

export async function detectProjectSignals(cwd: string): Promise<ProjectSignals> {
  const found = new Set<BrainBudCategory>();
  const matchedFiles: string[] = [];

  for (const manifest of MANIFESTS) {
    const fullPath = path.join(cwd, manifest);
    const content = await readText(fullPath);
    if (!content) continue;

    matchedFiles.push(manifest);
    for (const category of detectCategoriesFromManifest(manifest, content)) {
      found.add(category);
    }
  }

  return {
    categories: [...found],
    matchedFiles
  };
}

export function detectImportsFromText(content: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /require\(["']([^"']+)["']\)/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1]?.trim();
      if (value) imports.add(value);
    }
  }

  return [...imports];
}

export function inferCategoryFromPath(filePath: string): BrainBudCategory[] {
  const lower = filePath.toLowerCase();
  const categories = new Set<BrainBudCategory>();

  if (lower.endsWith(".py")) categories.add("python");
  if (lower.includes("django")) categories.add("django");
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) categories.add("typescript");
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.includes("react")) categories.add("react");
  if (lower.endsWith(".rs")) categories.add("rust");
  if (lower.endsWith(".go")) categories.add("go");

  return [...categories];
}

import path from "node:path";

import { detectImportsFromText, inferCategoryFromPath } from "./projectDetector";
import type { BrainBudCategory, TipContext, TriggerReason } from "../types";

interface RuntimeSnapshot {
  activeFile: string | undefined;
  activeFileExtension: string | undefined;
  activeImports: string[];
  activeSnippet: string | undefined;
  recentEditedFiles: string[];
  recentCommands: string[];
  inferredCategories: BrainBudCategory[];
}

function pushBounded(list: string[], value: string, limit = 12): string[] {
  const next = [value, ...list.filter((item) => item !== value)];
  return next.slice(0, limit);
}

export class RuntimeTracker {
  private activeFile?: string;
  private activeImports: string[] = [];
  private activeSnippet: string | undefined;
  private recentEditedFiles: string[] = [];
  private recentCommands: string[] = [];
  private inferredCategories = new Set<BrainBudCategory>();

  recordFileOpen(filePath: string, content?: string): void {
    this.activeFile = filePath;
    this.activeSnippet = content;
    if (content) this.activeImports = detectImportsFromText(content);
    for (const category of inferCategoryFromPath(filePath)) this.inferredCategories.add(category);
  }

  recordFileEdit(filePath: string): void {
    this.activeFile = filePath;
    this.recentEditedFiles = pushBounded(this.recentEditedFiles, filePath);
    for (const category of inferCategoryFromPath(filePath)) this.inferredCategories.add(category);
  }

  recordCommand(command: string): void {
    this.recentCommands = pushBounded(this.recentCommands, command, 10);
  }

  private fileExtension(): string | undefined {
    return this.activeFile ? path.extname(this.activeFile) : undefined;
  }

  buildContext(cwd: string, projectCategories: BrainBudCategory[], triggerReason: TriggerReason): TipContext {
    const mergedCategories = new Set<BrainBudCategory>([...projectCategories, ...this.inferredCategories]);

    return {
      cwd,
      projectCategories: [...mergedCategories],
      activeFile: this.activeFile,
      activeFileExtension: this.fileExtension(),
      activeImports: [...this.activeImports],
      activeSnippet: this.activeSnippet,
      recentEditedFiles: [...this.recentEditedFiles],
      recentCommands: [...this.recentCommands],
      triggerReason
    };
  }

  snapshot(): RuntimeSnapshot {
    return {
      activeFile: this.activeFile,
      activeFileExtension: this.fileExtension(),
      activeImports: [...this.activeImports],
      activeSnippet: this.activeSnippet,
      recentEditedFiles: [...this.recentEditedFiles],
      recentCommands: [...this.recentCommands],
      inferredCategories: [...this.inferredCategories]
    };
  }
}

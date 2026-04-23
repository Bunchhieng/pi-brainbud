export type BrainBudCategory =
  | "python"
  | "django"
  | "react"
  | "typescript"
  | "rust"
  | "go";

export type TriggerReason = "file_open" | "file_save" | "command" | "idle" | "session_start";

export interface BrainBudConfig {
  frequencyMinutes: number;
  enabledCategories: BrainBudCategory[];
  idleDelayMs: number;
  recentTipMemory: number;
  maxSnippetChars: number;
}

export interface TipContext {
  cwd: string;
  projectCategories: BrainBudCategory[];
  activeFile: string | undefined;
  activeFileExtension: string | undefined;
  activeImports: string[];
  activeSnippet: string | undefined;
  recentEditedFiles: string[];
  recentCommands: string[];
  triggerReason: TriggerReason;
}

export interface BrainBudTipSuggestion {
  title: string;
  body: string;
  category: string;
  code?: string;
  learnMoreUrl?: string;
}

export interface BrainBudLlmRequest {
  context: TipContext;
  recentTipTitles: string[];
  conversationSnapshot: string;
}

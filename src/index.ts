import { promises as fs } from "node:fs";
import path from "node:path";
import { watch, type FSWatcher } from "node:fs";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

import { loadBrainBudConfig } from "./config/settings";
import { detectProjectSignals } from "./context/projectDetector";
import { RuntimeTracker } from "./context/runtimeTracker";
import { generateTipWithLlm } from "./llm/generator";
import type { BrainBudCategory, BrainBudConfig, TriggerReason } from "./types";
import { notifier } from "./ui/notifier";
import { debounce } from "./utils/debounce";
import { logger } from "./utils/logger";

const PROJECT_SIGNAL_FILES = ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"] as const;

async function readSnippet(filePath: string, maxChars: number): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.slice(0, maxChars);
  } catch {
    return undefined;
  }
}

export default function brainBud(pi: ExtensionAPI) {
  let config: BrainBudConfig;
  let tracker = new RuntimeTracker();
  let projectCategories: BrainBudCategory[] = [];
  let matchedProjectFiles: string[] = [];
  let currentCwd = process.cwd();
  let lastTipAt = 0;
  let recentTipTitles: string[] = [];
  let pendingReason: TriggerReason | undefined;
  let idleTimer: NodeJS.Timeout | undefined;
  const watchers: FSWatcher[] = [];

  const clearIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  const stopWatchers = () => {
    while (watchers.length > 0) {
      watchers.pop()?.close();
    }
  };

  const refreshProjectSignals = async () => {
    const signals = await detectProjectSignals(currentCwd);
    projectCategories = signals.categories;
    matchedProjectFiles = signals.matchedFiles;
  };

  const refreshProjectSignalsDebounced = debounce(() => {
    void refreshProjectSignals().catch((error) => logger.error("Failed to refresh project signals", error));
  }, 500);

  const setupWatchers = (cwd: string) => {
    stopWatchers();
    for (const fileName of PROJECT_SIGNAL_FILES) {
      const fullPath = path.join(cwd, fileName);
      try {
        const watcher = watch(fullPath, () => refreshProjectSignalsDebounced());
        watchers.push(watcher);
      } catch {
        // file may not exist
      }
    }
  };

  const canShowTip = (): boolean => {
    if (!config) return false;
    return Date.now() - lastTipAt >= config.frequencyMinutes * 60_000;
  };

  const rememberTip = (title: string) => {
    recentTipTitles = [title, ...recentTipTitles.filter((item) => item !== title)].slice(0, config.recentTipMemory);
    lastTipAt = Date.now();
  };

  const statusIdle = () => `🧠 "A dose of brainbud a day, keeps the brain rot away." - BrainBud`;

  const maybeShowTip = async (ctx: ExtensionContext, reason: TriggerReason, bypassGate = false) => {
    if (!ctx.hasUI || !config) return;
    if (!bypassGate && !canShowTip()) return;

    const context = tracker.buildContext(ctx.cwd, projectCategories, reason);

    ctx.ui.setStatus("brainbud", "🧠 thinking...");
    const tip = await generateTipWithLlm(ctx, context, recentTipTitles);
    ctx.ui.setStatus("brainbud", statusIdle());

    if (!tip) return;

    notifier.showTip(ctx, tip);
    rememberTip(tip.title);
  };

  const safely = async (ctx: ExtensionContext, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      logger.error("BrainBud background task failed", error);
    }
  };

  pi.registerCommand("brainbud-status", {
    description: "Show BrainBud's current context snapshot",
    handler: async (_args, ctx) => {
      const snapshot = tracker.snapshot();
      const lines = [
        `categories: ${projectCategories.join(", ") || "none"}`,
        `signal files: ${matchedProjectFiles.join(", ") || "none"}`,
        `active file: ${snapshot.activeFile ?? "none"}`,
        `recent edits: ${snapshot.recentEditedFiles.join(", ") || "none"}`,
        `recent commands: ${snapshot.recentCommands.join(" | ") || "none"}`,
        `frequency: ${config.frequencyMinutes} min`,
        `snippet chars: ${config.maxSnippetChars}`,
        `tip model: ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "none"}`
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    }
  });

  pi.registerCommand("brainbud-tip", {
    description: "Force a tip right now (bypasses frequency gate)",
    handler: async (_args, ctx) => {
      const context = tracker.buildContext(ctx.cwd, projectCategories, "idle");
      ctx.ui.setStatus("brainbud", "🧠 thinking...");
      try {
        const tip = await generateTipWithLlm(ctx, context, recentTipTitles);
        ctx.ui.setStatus("brainbud", statusIdle());
        if (!tip) { ctx.ui.notify("BrainBud: model returned no tip", "info"); return; }
        notifier.showTip(ctx, tip);
        rememberTip(tip.title);
      } catch (error) {
        ctx.ui.setStatus("brainbud", statusIdle());
        ctx.ui.notify(`BrainBud: error — ${String(error)}`, "warning");
      }
    }
  });

  pi.registerCommand("brainbud-reload-config", {
    description: "Reload BrainBud settings from settings.json",
    handler: async (_args, ctx) => {
      await safely(ctx, async () => {
        config = await loadBrainBudConfig(ctx.cwd);
        await refreshProjectSignals();
        ctx.ui.notify("BrainBud config reloaded", "info");
      });
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    await safely(ctx, async () => {
      tracker = new RuntimeTracker();
      currentCwd = ctx.cwd;
      config = await loadBrainBudConfig(ctx.cwd);
      await refreshProjectSignals();
      setupWatchers(ctx.cwd);
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        void safely(ctx, async () => {
          await maybeShowTip(ctx, "session_start");
        });
      }, config.idleDelayMs);
      ctx.ui.setStatus("brainbud", statusIdle());
    });
  });

  pi.on("session_shutdown", async () => {
    clearIdleTimer();
    stopWatchers();
  });

  pi.on("tool_call", async (event, ctx) => {
    await safely(ctx, async () => {
      if (isToolCallEventType("read", event)) {
        const fullPath = path.resolve(ctx.cwd, event.input.path);
        tracker.recordFileOpen(event.input.path, await readSnippet(fullPath, config.maxSnippetChars));
        pendingReason = "file_open";
        return;
      }

      if (isToolCallEventType("edit", event)) {
        tracker.recordFileEdit(event.input.path);
        pendingReason = "file_save";
        return;
      }

      if (isToolCallEventType("write", event)) {
        tracker.recordFileEdit(event.input.path);
        pendingReason = "file_save";
        return;
      }

      if (isToolCallEventType("bash", event)) {
        tracker.recordCommand(event.input.command);
        pendingReason = "command";
      }
    });
  });

  pi.on("user_bash", async (event, ctx) => {
    await safely(ctx, async () => {
      tracker.recordCommand(event.command);
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        void safely(ctx, async () => {
          await maybeShowTip(ctx, "idle");
        });
      }, config.idleDelayMs);
    });
  });

  pi.on("agent_end", async (_event, ctx) => {
    await safely(ctx, async () => {
      clearIdleTimer();
      const reason = pendingReason ?? "idle";
      pendingReason = undefined;
      await maybeShowTip(ctx, reason, true);
      idleTimer = setTimeout(() => {
        void safely(ctx, async () => {
          await maybeShowTip(ctx, "idle");
        });
      }, config.idleDelayMs);
    });
  });
}

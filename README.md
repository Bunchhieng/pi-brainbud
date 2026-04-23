# pi-brainbud

A [Pi](https://github.com/mariozechner/pi-coding-agent) extension that delivers contextual programming tips while you vibe-code — without interrupting your session.

## Motivation
Vibe coding can cause brain rot. This extension aims to help you stay sharp by delivering contextual programming tips while you vibe-code.
"A dose of brainbud a day, keeps the brain rot away." - BrainBud

## How it works

1. **Context collection** — BrainBud listens to Pi tool calls (`read`, `edit`, `write`, `bash`) and records the active file, recent edits, recent commands, and imports.  
2. **Project detection** — On session start (and on manifest changes), it scans the project root for `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, and `go.mod` to infer languages and frameworks.  
3. **LLM call** — When a tip opportunity arises, BrainBud builds a prompt from the collected context and streams from the Pi-configured LLM with `reasoningEffort: "minimal"` so it stays cheap and non-blocking. A `🧠 thinking...` status indicator appears while the stream runs.  
4. **Notification** — If the model returns a relevant tip (JSON `shouldTip: true`), it renders as a compact ANSI-bordered widget below the editor with title, body, optional code snippet, and optional link. Dismisses automatically after 20 seconds. The session is never paused.

## Architecture

```
pi-brainbud/
├── src/
│   ├── index.ts                  # Extension entry — registers events, commands, timers
│   ├── types.ts                  # Shared types (BrainBudConfig, TipContext, …)
│   ├── config/
│   │   └── settings.ts           # Reads brainbud block from ~/.pi and .pi/settings.json
│   ├── context/
│   │   ├── projectDetector.ts    # Manifest scanning → BrainBudCategory[]
│   │   └── runtimeTracker.ts     # Per-session file/command signal accumulator
│   ├── llm/
│   │   ├── generator.ts          # Streams from pi-ai, accumulates text_delta events
│   │   ├── prompt.ts             # SYSTEM_PROMPT constant + buildLlmTipPrompt() for dynamic context
│   │   └── parser.ts             # Extracts and validates JSON from the model response
│   └── ui/
│       └── notifier.ts           # ANSI-bordered widget via ctx.ui.setWidget()
└── test/
    └── projectDetector.test.ts   # Unit tests for manifest detection and import extraction
```

### Data flow

```
session_start / tool_call / user_bash / agent_end
        │
        ▼
  RuntimeTracker (records file opens, edits, commands)
        │
        ▼
  canShowTip? (frequency gate: default 12 min)
        │ yes
        ▼
  buildContext() → TipContext
        │
        ▼
  generateTipWithLlm() ──► stream() from pi-ai (reasoningEffort: minimal)
        │                        └─► JSON: { shouldTip, title, body, category, code, learnMoreUrl }
        ▼
  parseLlmTipResponse()
        │ valid tip
        ▼
  ctx.ui.setWidget()  ← ANSI-bordered box below editor, auto-dismisses after 20s
```

### Trigger reasons

| Reason | When |
|---|---|
| `session_start` | After `idleDelayMs` on a new session |
| `file_open` | After the agent reads a file and then goes idle |
| `file_save` | After the agent edits/writes a file and then goes idle |
| `command` | After a bash command and then goes idle |
| `idle` | After `idleDelayMs` of no agent activity |

## Installation

```sh
pi install https://github.com/Bunchhieng/pi-brainbud
```

Pi clones the repo, runs `npm install --omit=dev`, then loads `src/index.ts` at runtime via its built-in TypeScript engine (jiti) — no build step needed. To update to the latest commit later:

```sh
pi update https://github.com/Bunchhieng/pi-brainbud
```

## Configuration

Add a `brainbud` block to `~/.pi/agent/settings.json` (global) or `.pi/settings.json` (project). Project settings override global.

```json
{
  "brainbud": {
    "frequencyMinutes": 3,
    "enabledCategories": ["python", "django", "react", "typescript", "rust", "go"],
    "idleDelayMs": 45000,
    "recentTipMemory": 12,
    "maxSnippetChars": 4000
  }
}
```

| Key | Default | Description |
|---|---|---|
| `frequencyMinutes` | `3` | Minimum minutes between tips (min 1) |
| `enabledCategories` | all | Categories to generate tips for |
| `idleDelayMs` | `45000` | Milliseconds of idle time before triggering a tip check |
| `recentTipMemory` | `12` | How many recent tip titles to track (avoids repeats) |
| `maxSnippetChars` | `4000` | Max characters of active file snippet sent to the LLM |

## Commands

| Command | Description |
|---|---|
| `brainbud-tip` | Force a tip immediately, bypassing the frequency gate |
| `brainbud-status` | Shows current context snapshot (categories, active file, recent edits, config) |
| `brainbud-reload-config` | Re-reads settings files and refreshes project signals |

## Development

```sh
npm install
npm run check      # TypeScript type-check
npm test           # Run tests with Vitest
npm run test:watch # Watch mode
```

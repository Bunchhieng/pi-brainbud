# pi-brainbud

A [Pi](https://github.com/mariozechner/pi-coding-agent) extension that delivers contextual programming tips while you vibe-code — without interrupting your session.

## Motivation

Vibe coding can cause brain rot. BrainBud keeps you sharp by surfacing relevant tips, tricks, and idioms as you work.

> "A dose of brainbud a day, keeps the brain rot away." — BrainBud

## How it works

1. **Context collection** — BrainBud listens to Pi tool calls (`read`, `edit`, `write`, `bash`) and records the active file, recent edits, recent commands, and imports.
2. **Project detection** — On session start (and on manifest changes), it scans the project root for `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, and `go.mod` to infer languages and frameworks.
3. **LLM call** — When a tip opportunity arises, BrainBud streams from the Pi-configured LLM with `reasoningEffort: "minimal"`. While streaming, a live preview widget appears below the editor. A `🧠 thinking...` status indicator is shown in the footer.
4. **Tip injection** — If the model returns a relevant tip, it is injected into the conversation via `pi.sendMessage()` as an amber-bordered box. It persists in session history so you can scroll back to it. The session is never paused.

### Streaming preview

While the LLM generates, a live widget appears below the editor showing the raw stream so you know something is happening:

```
{"shouldTip":true,"title":"Use satisfies for prec
ise object types","body":"TypeScript's satisfies
```

Once the stream ends the widget clears and the formatted tip is injected into the conversation.

### Tip in conversation

Tips are rendered as an amber-bordered box directly in the Pi conversation so they persist in session history:

```
╭──────────────────────────────────────────────────────────────╮
│ 🧠  Use satisfies for precise object types                   │
├──────────────────────────────────────────────────────────────┤
│ TypeScript's satisfies operator validates an expression      │
│ against a type without widening its literal types.           │
├──────────────────────────────────────────────────────────────┤
│   const cfg = { port: 3000 } satisfies Config;               │
╰──────────────────────────────────────────────────────────────╯
↗  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
```

A tip with no code snippet:

```
╭──────────────────────────────────────────────────────────────╮
│ 🧠  Prefer timezone-aware datetimes in Django                │
├──────────────────────────────────────────────────────────────┤
│ When USE_TZ = True, use django.utils.timezone.now()          │
│ instead of datetime.now() to avoid naive/aware bugs in       │
│ queries and model comparisons.                               │
╰──────────────────────────────────────────────────────────────╯
↗  https://docs.djangoproject.com/en/stable/topics/i18n/timezones/
```

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
│   │   ├── generator.ts          # Streams from pi-ai; fires onDelta for live preview
│   │   ├── prompt.ts             # SYSTEM_PROMPT constant + buildLlmTipPrompt() for dynamic context
│   │   └── parser.ts             # Extracts and validates JSON from the model response
│   └── ui/
│       └── notifier.ts           # Formats and injects tip via pi.sendMessage()
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
  canShowTip? (frequency gate — bypassed for agent_end)
        │ yes
        ▼
  buildContext() → TipContext
        │
        ▼
  generateTipWithLlm() ──► stream() from pi-ai (reasoningEffort: minimal)
        │    └─ onDelta ──► live preview widget (last 6 lines, clears on done)
        │                        └─► JSON: { shouldTip, title, body, category, code, learnMoreUrl }
        ▼
  parseLlmTipResponse()
        │ valid tip
        ▼
  pi.sendMessage()  ← amber-bordered box injected into conversation, persists in history
```

### Trigger reasons

| Reason | When | Frequency gate |
|---|---|---|
| `agent_end` | After every completed prompt | Bypassed — fires every time |
| `session_start` | After `idleDelayMs` on a new session | Respected |
| `file_open` | After the agent reads a file and goes idle | Respected |
| `file_save` | After the agent edits/writes a file and goes idle | Respected |
| `command` | After a bash command and goes idle | Respected |
| `idle` | After `idleDelayMs` of no agent activity | Respected |

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
| `frequencyMinutes` | `3` | Minimum minutes between tips for idle/session triggers (min 1) |
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

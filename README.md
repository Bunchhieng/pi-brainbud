# pi-brainbud

A [Pi](https://github.com/mariozechner/pi-coding-agent) extension that teaches CS concepts while you code — without interrupting your session.

## Motivation

Vibe coding can cause brain rot. BrainBud keeps you sharp by surfacing programming concepts, math tricks, and language internals as you work.

> "A dose of brainbud a day, keeps the brain rot away." — BrainBud

## How it works

1. **Context collection** — BrainBud listens to Pi tool calls (`read`, `edit`, `write`, `bash`) and records the active file, recent edits, recent commands, and imports.
2. **Project detection** — On session start it scans the project root for `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, and `go.mod` to infer languages and frameworks.
3. **LLM call** — When a tip opportunity arises, BrainBud picks a CS concept adjacent to what you're working on and streams an explanation from the Pi-configured LLM. A `🧠 thinking...` indicator appears in the footer while it generates.
4. **Tip injection** — The tip is injected into the conversation via `pi.sendMessage()` and persists in session history. Your session is never paused.

### What BrainBud teaches

BrainBud is a CS teacher, not a code reviewer. It will never suggest fixes to your code. Instead it explains the *why* and the *how*:

- **Bit tricks & math** — why `x & (x-1)` clears the lowest set bit, why XOR swap works, power-of-two checks
- **Language internals** — how Python dicts use open addressing, how Rust's borrow checker tracks lifetimes, how the JS event loop works
- **Algorithm insights** — why mergesort is stable but quicksort isn't, what amortised O(1) means for dynamic arrays
- **Subtle behaviour** — integer overflow in two's complement, float precision loss, hash collision strategies
- **Clever idioms** — one-liners that exploit a language property in a non-obvious way

### Tip in conversation

Tips appear as an amber left-gutter block directly in the Pi conversation:

```
│ 🧠  XOR swap works without a temporary variable
│
│ x ^= y swaps x and y because XOR is its own inverse: applying
│ it twice returns the original value, so the third XOR cancels
│ the second.
│
│   a ^= b
│   b ^= a
│   a ^= b
│
↗  https://en.wikipedia.org/wiki/XOR_swap_algorithm
```

A tip without a code snippet:

```
│ 🧠  IEEE 754 floats can't represent 0.1 exactly
│
│ 0.1 has no finite binary representation; it's stored as the
│ nearest 53-bit fraction, so 0.1 + 0.2 evaluates to
│ 0.30000000000000004 — not a bug, just the spec.
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
        │                        └─► JSON: { shouldTip, title, body, category, code, learnMoreUrl }
        ▼
  validateTipCode()  ← second LLM pass strips code if it doesn't match the explanation
        │
        ▼
  pi.sendMessage()  ← amber left-gutter tip injected into conversation
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

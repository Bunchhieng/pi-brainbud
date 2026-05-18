# pi-brainbud

A [Pi](https://github.com/mariozechner/pi-coding-agent) extension that teaches CS concepts while you code.

> "A dose of brainbud a day, keeps the brain rot away." — BrainBud

## Install

```sh
pi install https://github.com/Bunchhieng/pi-brainbud
pi update https://github.com/Bunchhieng/pi-brainbud   # update later
```

## What it does

Watches your active file, imports, and commands. After each agent prompt, fires a short CS tip — bit tricks, language internals, algorithm insights — adjacent to what you're working on. Never suggests fixes; only teaches the *why*.

Tips appear as an amber left-gutter block in the conversation:

```
│ 🧠  XOR swap works without a temporary variable
│
│ x ^= y swaps x and y because XOR is its own inverse: applying
│ it twice returns the original value, so the third XOR cancels the second.
│
│   a ^= b; b ^= a; a ^= b
```

## Commands

| Command | Description |
|---|---|
| `brainbud-tip` | Force a tip now |
| `brainbud-like` | 👍 Thumbs up the last tip |
| `brainbud-dislike` | 👎 Thumbs down the last tip |
| `brainbud-last` | Re-show the last tip |
| `brainbud-history` | List last 10 tips |
| `brainbud-status` | Debug snapshot (context, config, model) |
| `brainbud-reload-config` | Reload settings |

Ratings steer future tips — liked examples and preferred categories are fed back into the prompt; disliked ones are avoided.

## Configuration

`~/.pi/agent/settings.json` (global) or `.pi/settings.json` (project overrides global):

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

## Development

```sh
npm install
npm run check
npm test
```

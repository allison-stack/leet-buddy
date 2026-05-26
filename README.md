# Leet Buddy

A Chrome extension that acts as a patient LeetCode tutor: a stuck-timer with progressive hints, an "approach first" prompt that catches you before you type code, spaced-repetition reviews, and a daily problem nudge.

## Install (dev)

```bash
npm install
npm run build
```

In Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Configure

Right-click the extension icon → Options.
- Provider: defaults to **Groq** (free). Get a key at [console.groq.com](https://console.groq.com).
- Daily source: pick one of LC Daily / Blind 75 / NeetCode 150 / LC 75 / Company-tagged.

## Run tests

```bash
npm test
npm run typecheck
```

## Architecture

See [`docs/superpowers/specs/2026-05-24-leet-buddy-design.md`](docs/superpowers/specs/2026-05-24-leet-buddy-design.md).

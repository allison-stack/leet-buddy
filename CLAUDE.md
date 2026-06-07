# leet-buddy — Agent Instructions

A Chrome MV3 extension that lives on `leetcode.com/problems/*`: stuck-timer with progressive hints, "approach first" prompt, SM2 spaced-repetition reviews, daily-problem nudge, and (in progress) a challenger feature for friend-vs-friend solve races.

Personal project. Patience and UX-feel matter more than feature count.

---

## How to work in this repo

Four guardrails. They bias toward caution over speed — for trivial tasks, use judgment, but when in doubt follow them.

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask before implementing.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, ask.

Especially relevant here: a lot of leet-buddy's behavior depends on cross-process invariants (worker as sole `SupabaseClient` owner, multi-step popup flows must persist to `chrome.storage.local`, MV3 worker idles after ~30s, Shadow DOM panel). If you're about to make a change that touches one of those, surface what you're assuming first.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios. Trust internal code and framework guarantees; only validate at system boundaries (user input, external APIs).
- If you write 200 lines and 50 would do, rewrite it.

Senior-engineer test: "Would they say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd write it differently. Prefer editing existing files over creating new ones.
- If you notice unrelated dead code, mention it — don't delete it.

Orphans your changes create (now-unused imports, variables, functions) — yes, clean those up. Pre-existing dead code — leave it unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-driven execution

Define success criteria. Loop until verified.

- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."

For multi-step tasks, state a brief plan up front:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") need constant clarification.

Baseline verification in this repo: `npm run typecheck && npm test`. Add `npm run build` if you touched the manifest, content-script entry, or service-worker entry. For UI changes, load the unpacked extension and click through the affected flow — type checks and tests verify code correctness, not feature correctness.

---

**Working signal:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions before implementation rather than after mistakes.

---

## Commands

```bash
npm test                                 # vitest run
npm run test:watch                       # vitest watch
npm run typecheck                        # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run build                            # vite build → dist/  (load this in chrome://extensions)
npm run dev                              # vite dev (for the popup/options pages)

# Supabase
npx supabase db push                                                                # apply pending migrations to remote
npx supabase migration new <name>                                                   # create timestamped migration file
npx supabase gen types typescript --project-id <ref> --schema public \
  2>/dev/null > src/shared/supabase/database.types.ts                               # regenerate types after any schema change
```

The project ref lives in `.env` (extract with: `grep VITE_SUPABASE_URL .env | sed -E 's|.*https://([^.]+).*|\1|'`).

---

## Where things live

| Path | What |
|---|---|
| `src/background/worker.ts` | MV3 service worker. Sole owner of `SupabaseClient`. Routes all `ContentToWorker` messages. |
| `src/background/challenger/` | Auth (Phase 1 shipped); friends/challenges/race-timer/poll-alarm in later phases. |
| `src/background/{timer-manager,hint-cache,rate-limiter,scheduler}.ts` | Pre-existing tutor singletons. |
| `src/content/index.tsx` → `components/Panel.tsx` | Shadow-DOM React panel injected on LeetCode problem pages. |
| `src/popup/` | Extension-toolbar popup. Forks on auth state into `SignedOutPrompt` vs the signed-in hub. |
| `src/options/Options.tsx` | Settings page + Account section. |
| `src/shared/` | Cross-context types, message contracts, storage helpers, `supabase/` factory + generated types. |
| `supabase/migrations/` | SQL migrations. Use timestamp filenames via `supabase migration new`. |
| `wiki/` | Architectural reference (untracked — on-disk only). |
| `docs/superpowers/specs/` | Design specs (untracked). |
| `docs/superpowers/plans/` | Implementation plans (untracked). |

---

## Storage tiers

The codebase splits state across three tiers. Don't conflate them.

- **`chrome.storage.sync`** — tutor user data that should follow the user across Chrome installs: settings, problems, daily_log.
- **`chrome.storage.local`** — ephemeral / device-local state: timer snapshot, hint cache, selector cache, supabase auth session token, sign-in flow resume state (`signin_state`).
- **Supabase Postgres** — cross-user data: `profiles` (Phase 1). `friendships`, `challenges` arrive in later phases.

---

## Architecture rules

- **Only the background worker holds a `SupabaseClient`.** Popup and content script send messages via `chrome.runtime.sendMessage`; they must not import `getSupabase()` directly. Single auth-session keeper avoids refresh-token races.
- Reach Supabase through `getSupabase()` in `src/shared/supabase/client-factory.ts` (singleton + `chrome.storage.local` session adapter — `localStorage` doesn't exist in MV3 workers).
- Modules that wrap Supabase take a **minimal interface** in their constructor (e.g. `AuthSupabase` in `src/background/challenger/auth.ts`). Real client passed in by the worker; tests pass a hand-rolled stub. No global mocks.
- Cast to the interface at the worker boundary to dodge `TS2589` (deep generic instantiation): `getSupabase() as unknown as AuthSupabase`.
- **Magic links don't work for Chrome extensions.** Email clients don't render `chrome-extension://` URLs and Supabase's default redirect goes to `localhost:3000`. Always use **OTP codes** via `signInWithOtp` + `verifyOtp` (6-digit code in the email body).
- **Multi-step popup flows MUST persist to `chrome.storage.local`.** Chrome closes the popup on focus loss — any wizard the user might leave mid-flow (to check email, copy a code, look something up) needs `chrome.storage.local.set(...)` on advance and `.remove(...)` on terminal success / cancel. Pattern: `src/popup/SignedOutPrompt.tsx` (`signin_state` key).
- No global state lib. `useState` in components, worker-side singletons (`TimerManager`, `HintCache`, `RateLimiter`, `Auth`).
- The challenger feature is being built across **5 sequential plans**, each producing working, testable software. Architectural postures locked during design (don't re-litigate without cause): direct `supabase-js` from worker, **poll-not-realtime** (60s `chrome.alarms`, no WebSockets — MV3 workers fight persistent sockets), trust client-reported solve times (friends-only stakes), email via a single `send-mail` Edge Function in Phase 4.

---

## Conventions

Project-specific rules. (Generic "don't add features beyond the task," "prefer editing over creating," etc. live above under [How to work in this repo](#how-to-work-in-this-repo) — not duplicated here.)

- **Commits**: one line, imperative, no body, no co-author, no AI footer. `git add <specific files>` — never `git add -A` / `.`.
- **Don't commit**: `docs/`, `wiki/`, design specs, implementation plans, `.env`, `~/.claude/plans/`. These are intentionally on-disk but untracked.
- **Credentials**: `.env` + `VITE_*` prefix, never inlined into source. Type new vars in `src/vite-env.d.ts` so `noUncheckedIndexedAccess` doesn't infect callers with `string | undefined`. Server-only secrets (e.g. Resend API key inside the Phase 4 Edge Function) go through Supabase secrets, never `.env`.
- **Comments**: write none unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug, surprising behavior). Don't explain the WHAT — names do that. Don't reference task / PR / issue numbers — they rot.
- **Subagent dispatch**: for mechanical tooling commands (`npm install`, regenerate types, run tests-then-commit), prefer inline execution over spawning a subagent — haiku-tier subagents have hit sandbox permission walls on `npm` in this repo.
- **Wiki updates**: when a change touches anything documented in `wiki/`, update the affected page in the same commit (or note it explicitly if deliberately deferring).

---

## Testing

- **Vitest + happy-dom**, `globals: false`. Tests live in `tests/`, names match `*.test.{ts,tsx}`.
- **`@testing-library/react`** for component tests. Because `globals: false`, you must add `afterEach(() => cleanup())` explicitly — there's no auto-cleanup, so DOM leaks between tests and `getByPlaceholderText` etc. start finding duplicates.
- **`happy-dom` doesn't ship `WebSocket`.** `supabase-js`'s `createClient` eagerly initializes `RealtimeClient`, which crashes the constructor without one. Any test that imports a module that calls `getSupabase()` needs a `WebSocket` stub in `beforeEach`. We don't use realtime in this extension; the stub is no-op. See `tests/client-factory.test.ts`.
- **Mock Supabase via the minimal `AuthSupabase`-style interface**, not by mocking `@supabase/supabase-js`. Stubs are hand-rolled, type-checked, and keep tests honest about what the production code actually depends on. See `tests/auth.test.ts`.
- **Don't hit the real DB in unit tests.** Integration tests against a local Supabase (`npx supabase start` → Docker Postgres) are planned for cases where RLS or Edge Functions matter, but aren't wired up yet.

---

## Supabase project config that lives outside the repo

Several settings are in the Supabase dashboard, not in code or migrations. If you ever migrate the project or someone recreates it from scratch, these must be re-applied or auth/email breaks. (Documented in detail under `wiki/` and reproduced briefly here.)

- **Auth → Providers → Email**: Email provider ON, "Confirm email" OFF, "Enable Email OTP" ON.
- **Auth → Sign In / Up → Email OTP Length**: `6`. The popup UI hardcodes a 6-digit input.
- **Auth → Email Templates → Magic Link**: customized to display `{{ .Token }}` (the code), not `{{ .ConfirmationURL }}` (the link).
- **Project Settings → Authentication → SMTP**: custom SMTP via Resend (`smtp.resend.com:465`, username `resend`, password = Resend API key). Sender `onboarding@resend.dev` for solo testing; replace with a verified domain before adding real users.
- **Project Settings → Auth → Rate Limits → Email per hour**: bumped above the default.
- **Project Settings → API**: Data API enabled, automatic-expose-new-tables enabled, automatic-RLS enabled.

---

## Further reading

- **`wiki/README.md`** — architectural reference (the "why" and "how"). Start here when picking up the project after a gap.
- **`docs/superpowers/specs/`** — design specs (currently: `2026-06-05-challenger-design.md`).
- **`docs/superpowers/plans/`** — implementation plans, one per phase.
- **`README.md`** — install / build / load-unpacked instructions for end-users.

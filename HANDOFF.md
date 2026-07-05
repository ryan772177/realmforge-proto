# Handoff — Realmforge Rivals, end of Day 7 / start of Day 8 planning

Written 2026-07-04, end of session, to carry full context into a new chat.
This is a working file, not a permanent doc — delete or archive it once the
next session has absorbed it. Persistent memory (the stuff worth keeping
forever) already lives in the auto-memory system; see "Memory" section below.

## What this project is

Config-driven 6×6 city-builder greybox prototype, built to test one number
before anything else gets built: **does ≥40% of testers voluntarily
relocate a building nobody told them to move** (the north-star behavior per
`docs/realmforge_reset.md` §23). Everything else — backend, monetization,
art, leagues — is designed and waiting on the other side of that gate.
Read `docs/realmforge_reset.md` in full if you haven't; it's the spec of
record and overrides any assumption not stated here. Key sections: §16
(scoring formula), §23 (event schema + metrics + playtest protocol), §25
(7-day plan), §26 (30-day plan), §27 (kill/continue gate table).

## Where things actually stand vs. the doc's own plan

The doc's §25 plan calls Day 7 "10-tester moderated protocol, metrics
compiled, gate review." **That has not happened.** What's happened instead:

- Days 1–6: full greybox build per the doc (all 12 tasks), deployed live.
- "Day 7" in this project's real history became: git/GitHub/Vercel deployment
  setup, a metrics-compiler script (`playtest/compile-metrics.mjs`) and
  moderator packet built, then **self-administered informal playtesting**
  (the user playing the live app themselves, not 10 recruited strangers).
- That self-testing found **5 real bugs**, all fixed, tested, and deployed
  (see "Bugs found" below). One real analytics export survives as a
  regression reference: `playtest/exports/tester-02.json`.
- Running the compiler against that one export right now:

  ```
  === Realmforge Rivals — §23.2 Playtest Metrics (n=1) ===
  1. Time to first placement (<30s)       100% of 1   PASS
  2. Score comprehension (survey)          no survey.json          N/A
  3. Voluntary relocation (NORTH STAR)     100% of 1   CONTINUE
  4. Rival engagement                      100% of 1   PASS
  5. Improve-score clicks / tester          0 avg      diagnostic only
  6. Session length (median)               no session_end logged   N/A
  7. Quest completion (Q1-Q8, avg)         100%        PASS
  8. Confusion tap clusters (median)        0          PASS
  9. Tutorial drop-off (before reveal)      0% of 1     PASS
  10. Second-session intent (survey)       no survey.json           N/A
  ```

  This is genuinely encouraging (every measurable gate passed, including a
  voluntary relocation that happened *before* the tutorial's own guided
  relocation step) — but **it is n=1, not n=10, and it is not blind**: the
  tester is the person who commissioned the build, not a recruited stranger
  per §23.3's own rules ("No friends/family of the team"). It cannot
  substitute for the real gate decision. Treat it as a very good pilot run
  that de-bugged the instrument, not as data that clears Gate A.

## The actual open decision for "Day 8"

The doc doesn't define a "Day 8" — its own plan ends at the Day 7 gate
review, then §26's Week 2 begins ("Fix what the playtest exposed... NO new
systems"). So the real fork in the road right now is:

1. **Run the real §23.3 protocol** — recruit ~10 actual strangers (mixed
   casual-builder/puzzle/midcore, phones only, no team friends/family),
   moderate silently, compile with the same script, and make the actual
   Continue/Iterate/Pivot/Kill call per §27. This is what the doc says
   should happen before anything else.
2. **Treat the n=1 pilot as "close enough to iterate on for now"** and start
   pulling §26 Week 2 levers (tuning via config only — see
   `playtest/TUNING.md`, already written and mapped to every knob) while
   continuing to collect more real single-tester exports opportunistically.
3. Some blend: keep fixing real bugs as they surface from informal testing,
   but hold off on calling the gate one way or the other until n is bigger.

**Do not decide this silently in the new chat — ask the user which of these
they want**, since it changes what "Day 8" work actually is. Whatever they
pick, the ruthlessness clause in §27 still applies: don't waive a metric
downward, and don't let "it felt fun to us" stand in for data.

## Bugs found this cycle (all fixed, tested, deployed — for context only)

1. `quest_completed`/`rival_revealed` weren't tracked to analytics at all —
   fixed via `foldEvents` reporting derived outcomes.
2. `quest_completed` skipped quests that cascade straight from
   locked→completed in one fold (only checked `prevStatus === "active"`).
3. **Real user-reported bug**: FTUE economy soft-lock — Q1–Q6 gold was
   locked behind a Quest Panel invisible until step 12, but the intended
   path needs exactly 100G with zero margin. Fixed with auto-claim for
   non-chest quest rewards.
4. Start Over button appeared to do nothing — a `pagehide` autosave handler
   raced the reset reload and re-saved stale state. Fixed with an
   `isResettingRef` guard.
5. `ftue_step_done` never fired for the tutorial's final step (12), and
   `freeplay_start` never fired at all — because that transition keeps
   `stepIndex` frozen and only flips `active`, which the tracking effect
   wasn't watching. Fixed by also watching `game.ftue.active`.

Recurring lesson across bugs 3 and 5: reading a real analytics export
line-by-line found things the compiler and unit tests didn't. If more real
exports come in, read them by hand first.

## Working discipline established this cycle (keep doing this)

- **Never fabricate playtest data or pretend to simulate testers.** If real
  data is missing, say so plainly — don't invent findings to fill the gap.
  This constraint was established early and held throughout; don't relax it.
- Verification loop for every fix: `npx tsc --noEmit` → `npm test` → live
  Playwright check against the actual running app (seed `localStorage` via
  `addInitScript`, not post-load `page.evaluate` — the `pagehide` autosave
  handler clobbers post-load seeding) → clean up temp scripts/playwright
  install → commit → push → `npx vercel --prod --yes --scope sentry3` →
  `curl -sI https://realmforge-proto.vercel.app/` to confirm 200.
- Playwright is installed transiently (`npm install -D playwright --no-save`)
  and always removed after use — it's not a project dependency.
- React 18 StrictMode double-invokes things in dev; duplicate-looking
  analytics entries from that are a known dev-only artifact, not a bug.

## Deployment facts

- Live: https://realmforge-proto.vercel.app/
- GitHub: https://github.com/ryan772177/realmforge-proto (user: ryan772177)
- Vercel: `--scope sentry3` required on every deploy command (no personal
  scope works for this project)
- Last commit at handoff time: `6ca7625` ("Fix: ftue_step_done never fired
  for the final step (12 -> freeplay)"), working tree clean, pushed to
  `origin/main`, live deploy confirmed matching.

## Key files if you need to dig in

- `docs/realmforge_reset.md` — the spec of record.
- `src/App.tsx` — central orchestration (event folding, analytics tracking,
  save/reset wiring).
- `src/game/{quests,ftue,rival,save,events,economy}.ts` — game logic modules.
- `src/scoring/score.ts` — the prosperity formula (§16), has a hardcoded
  +50% synergy clamp not exposed in config.
- `playtest/compile-metrics.mjs` — §23.2 metrics compiler, run as
  `node playtest/compile-metrics.mjs playtest/exports [survey.json]`.
- `playtest/exports/tester-02.json` — the one real export on file, kept
  intentionally as a regression reference.
- `playtest/TUNING.md` — map of every tunable config lever, cross-referenced
  to §27's candidate levers ("bigger terrain deltas," "scarcer good tiles,"
  etc.) — written in advance so Week 2 tuning doesn't require code spelunking.
- `playtest/MODERATOR_PACKET.md`, `playtest/README.md` — the real §23.3
  moderated-protocol materials, ready to use if the 10-tester round happens.

## Memory system (persists across chats, already up to date)

`/home/annimber/.claude/projects/-home-annimber-realmforge-proto/memory/`:
- `project_realmforge.md` — full build/bug history, gate rationale, "40%
  gate" framing, Lesson notes per bug (just updated with bug 5 above).
- `project_golden_layouts.md` — recomputed scoring test acceptance values.
- `project_deployment.md` — live URL, repo, CLI auth notes.

These will auto-load as relevant context in the new chat — no need to
re-paste any of this file's content into the first message, just open the
new chat and say what you want to do next (e.g. "let's plan the real 10
person playtest" or "let's start Week 2 tuning off the n=1 pilot").

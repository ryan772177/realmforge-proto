# Handoff — Realmforge Rivals: running the real §23.3 10-tester gate

Written 2026-07-04, end of session, to start a fresh chat focused on **Gate A
(the 10-tester voluntary-relocation gate)**. This is a working file — delete
or archive it once the new session has absorbed it. Permanent context lives in
the auto-memory system (loads automatically); this file is just the "start
here" for the gate.

---

## The one thing this whole gate measures

**Voluntary relocation rate: did ≥40% of 10 testers move a building nobody
told them to move, after the tutorial's one guided move?** That single number
is the entire product bet (docs/realmforge_reset.md §27). Everything else —
score comprehension, rival engagement, session length — is secondary. The
prototype exists only to get a real reading on this number before any art,
backend, or monetization is built.

## Where things stand right now (start-of-session truth)

- **Build is done, hardened, deployed, and clean.** Live at
  https://realmforge-proto.vercel.app (phone, portrait, no login/install).
  Latest commit `814bc0d`, working tree clean, `npx tsc --noEmit` clean,
  `npm test` 152/152 green.
- **The greybox is feature-complete** per the doc's §25 plan (all 12 tasks):
  6×6 board, 12 buildings, live adjacency report, transparent prosperity
  score, fake rival, free-during-FTUE relocation, 10 quests, local save,
  analytics export. Days 1–7 build history + every bug fixed to date is in
  the `project_realmforge.md` memory — read it, don't re-derive it.
- **A Week-2 hardening round just finished** (this session): three parallel
  QA/bug-hunt agents + a "CEO" audit, which found and fixed **a
  north-star-blocking soft-lock** — a fast/decisive drag-and-drop left the
  player permanently stuck at FTUE step 3, unable to ever reach relocation.
  That is exactly the class of bug that would have silently tanked this gate
  for real testers. It's fixed and deployed. No config/tuning numbers were
  touched (correctly — no behavioral signal justifies it yet).
- **Only n=1 real data exists.** `playtest/exports/tester-02.json` is one real
  self-tested run by the project owner (not a recruited stranger). It passed
  every measurable gate, including a voluntary relocation — genuinely
  encouraging, but n=1 and not blind, so it does **not** clear Gate A.

## What "run the 10-tester gate" actually means — read this before planning

**The core of this gate is human work that a chat cannot do and must not
fake.** Recruiting 10 real strangers, handing them phones, moderating silently,
and recording verbatim quotes is a person's job (§23.3 is explicit: *the
moderator must not be the builder*). The single hardest rule on this project,
held across every prior session:

> **Never fabricate playtest data or simulate testers.** If real data is
> missing, say so plainly. Do not invent findings, do not generate synthetic
> "tester" exports and run them through the compiler as if real, do not let
> "it felt fun to us" stand in for data (§27 ruthlessness clause). Metrics may
> only ever be waived *upward*, never downward.

So the new chat's job is **not** to "produce the gate result." It is to do the
parts a chat legitimately can, and to hand the rest to humans:

1. **Prep the human side** so the owner can actually recruit + moderate:
   - The moderator materials already exist and are complete —
     `playtest/MODERATOR_PACKET.md` (recruiting spec, silent-moderation
     script, the single 8-min "What does the score mean?" probe, observer
     checklist, 5-question survey, decision matrix). Review it, and only
     *offer* to improve it if the owner asks — don't rewrite locked microcopy.
   - Things a chat can usefully draft if asked: a recruiting message/screener
     to find the 10 (4 casual-builder / 3 puzzle / 3 midcore, phones only, no
     friends/family), a scheduling/tracking sheet, a per-tester observer
     sheet to print, a `survey.json` template pre-filled with tester ids.
2. **Be the analysis half of the loop as real exports arrive:**
   - Each session ends with the tester tapping **"Export Analytics Log"**;
     that file is saved as `playtest/exports/<tester-id>.json`. Survey answers
     go into `playtest/survey.json` (shape in `survey.example.json`).
   - Compile with:
     `node playtest/compile-metrics.mjs playtest/exports playtest/survey.json`
     → prints the full §23.2 metrics table + the §27 north-star verdict tiers.
     It does **not** make the call; a human does.
   - **Read every real export line-by-line by hand, not just through the
     compiler.** This is a load-bearing lesson: bugs 3, 5, 6 and the analytics
     gaps were all caught by hand-reading exports, never by the compiler or
     unit tests. If a real export looks "impossible," check the actual code
     before assuming the data is fake — the Town Hall ×7 export was a real
     validator bug, not bad data.
3. **Frame the decision, don't pre-empt it.** When enough real sessions are in,
   present the compiled metrics and the §27 four-tier read
   (Continue / Iterate / Iterate-the-loop / Pivot-Kill) with the verbatim
   quotes the moderator recorded — but the kill/continue call is the team's,
   made by whoever moderated (not the builder).

## If the gate passes vs. misses (so the new chat knows the branches)

- **Continue (all 6 gates pass, relocation ≥40%)** → §26 Week 3 is the
  "market-appeal skin": replace greybox with first-pass fantasy art. **This is
  the answer to the owner's recurring question of "when do we add real game
  imagery" — after this gate reads green, not before**, so art isn't built on
  a loop that might still need reshaping.
- **Iterate (relocation 25–40%, or a secondary gate misses)** → tune the loop
  *via config only*, guided by `playtest/TUNING.md` (maps every lever —
  terrain deltas, tile scarcity, rival triggers, relocation cost — to its
  exact file/field). Only tune numbers a *specific* behavioral signal points
  at; blind tuning is forbidden. Then retest n=5.
- **Pivot/Kill (relocation <25% after a loop iteration, or comprehension
  <50%)** → the correct next build is a redesigned core-loop prototype, not
  events/monetization/backend/art. Point anyone proposing production systems
  at §4.O1.

## Materials inventory (all already built, in `playtest/`)

- `MODERATOR_PACKET.md` — standalone §23.3 protocol for whoever moderates.
- `README.md` — how the tooling fits together.
- `compile-metrics.mjs` — §23.2 metrics compiler (plain Node, no deps).
- `TUNING.md` — every config tuning lever mapped to file/field, for the
  Iterate branch. Cross-referenced to §27's candidate levers.
- `survey.example.json` / `exports.example/` — synthetic fixtures for testing
  the compiler only. **Not real data — never treat them as tester results.**
- `exports/tester-02.json` — the one real self-test, kept as a regression
  reference (also useful to eyeball what a real export's event stream looks
  like when hand-reading new ones).
- `explore-paths.mjs` + `exploration/` — the off-path bug-hunting harness from
  this session (QA tool, **not** a playtest tool — produces bug findings, not
  metrics). Re-runnable anytime more informal testing happens; it errors with
  install instructions if Playwright (transient dep) is missing.

## Deployment / repo facts

- Live: https://realmforge-proto.vercel.app/
- GitHub: https://github.com/ryan772177/realmforge-proto (user: ryan772177)
- Deploy loop: commit → `git push origin main` →
  `npx vercel --prod --yes --scope sentry3` (the `--scope sentry3` is
  required, no personal scope works) →
  `curl -sI https://realmforge-proto.vercel.app/` to confirm 200. Playwright
  is installed transiently (`npm install -D playwright --no-save`) and always
  removed after use; it is not a project dependency.
- Two agent definitions were added this session (`.claude/agents/ceo.md`,
  `code-generator.md`) — a newly-created agent type doesn't register until a
  session restart, so in a fresh chat the `ceo` subagent type should now be
  selectable directly (it audits completed work against real repo state and
  issues APPROVE / CONDITIONS / REJECT).

## First message for the new chat

Just open the chat and say what you want to do, e.g. "let's set up the 10
tester playtest — draft the recruiting screener and a per-tester observer
sheet," or, once sessions have happened, "here are the exports, compile and
read them." The memory system loads the full project context automatically;
you don't need to paste any of this file in.

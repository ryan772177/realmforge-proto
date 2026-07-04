# Realmforge Rivals — Day 7 Moderator Packet

Standalone handoff for whoever runs the playtest sessions. Source: §23.3 of
`docs/realmforge_reset.md`. You shouldn't need to read the full reset doc to
run this — everything you need for the session itself is below.

**Live URL to give testers:** https://realmforge-proto.vercel.app (phone,
portrait — no login, no install, just open the link).

**North star:** if you remember one thing, remember this — **voluntary
relocation rate**. Did the tester move a building nobody told them to move,
after the tutorial's one guided move? That single behavior is the entire
product bet. Everything else is secondary.

---

## 1. Recruiting

- **10 mobile gamers**, mixed: 4 casual-builder players, 3 puzzle players, 3
  midcore strategy players.
- **No friends or family of the team.**
- **Phones only** — no desktop/tablet substitutions.

## 2. Running the session (per tester)

- Hand them the phone with the URL already loaded, or send the link and let
  them open it themselves.
- **Say only:** "Play this for 15 minutes. Think out loud the whole time —
  say whatever you're thinking, even if it seems obvious."
- **Then go silent.** Don't explain mechanics. Don't answer "what do I do
  now?" — that's data (write it down as a confusion moment).
- **At 8 minutes**, ask exactly one scripted probe: **"What does the score
  mean?"** Then go silent again.
- **At 15 minutes**, stop them and run the survey (§4 below).
- Start a stopwatch the moment they open the link — you'll need the timestamp
  of their first Town Hall placement for the funnel metric.

## 3. Observer checklist (fill in per tester, during the session)

Use a fresh copy of this list for every tester.

- [ ] **First-placement time** — stopwatch from open to Town Hall committed
- [ ] **Report actually read** — did their eyes/mouth acknowledge the
      adjacency report, or did they place blind and never look?
- [ ] **Unprompted relocation** — the exact moment (timestamp) they moved a
      building nobody told them to move. This is the north star — don't miss
      it. Note what they said, if anything.
- [ ] **Rival reaction quote** — what they said (if anything) when the rival
      card appeared. Write it verbatim, not paraphrased.
- [ ] **Confusion moments** — any point they stalled, asked what to do, or
      tapped around aimlessly. Timestamp each one.
- [ ] **Where they'd stop playing** — if the 15 minutes ended right now,
      would they call this session "over," or did it feel like they wanted
      to keep going? Ask if unclear.

## 4. Survey (5 questions, asked at the 15-minute mark)

Ask these exactly, in order. Record answers verbatim, especially for the
open-ended ones — paraphrasing loses the signal.

1. **Why did your score change?** (open-ended — listen for "terrain" /
   "neighbor" / "forest" / any causal mechanism vs. a shrug)
2. **What would you do differently next time?** (open-ended)
3. **Did the rival matter to you?** (open-ended, then confirm Y/N)
4. **Would you play tomorrow?** (Y/N)
5. **What was confusing?** (open-ended)

After the session, transcribe questions 1 and 4 into `survey.json` (see
`survey.example.json` for the shape) as booleans:
- `score_comprehension`: true if their answer to Q1 named an actual cause
  (terrain/neighbor/synergy/conflict), false if they shrugged or guessed.
- `would_play_tomorrow`: true/false from their Y/N on Q4.

Keep your own notes on Q2/Q3/Q5 verbatim — the compiler doesn't use them, but
the decision discussion (§6 below) needs the quotes, not a summary.

## 5. After each session

1. Have the tester (or you) tap **"Export Analytics Log"** in the app before
   closing the tab.
2. Save that file as `playtest/exports/<tester-id>.json` (e.g.
   `tester-01.json`).
3. Add their survey answers to `playtest/survey.json`.

## 6. Compiling the report (after all 10 sessions)

```
node playtest/compile-metrics.mjs playtest/exports playtest/survey.json
```

This prints every §23.2 metric with a pass/iterate/fail read, plus the north
star's full 4-tier verdict. It does not make the call for you.

## 7. The decision (§23.3 verbatim)

- **All 6 gates pass → Continue.**
- **Relocation ≥40% but 1–2 secondary gates miss → Iterate** (1 week, retest
  n=5).
- **Relocation 25–40% → Iterate the loop itself** (bigger terrain deltas,
  scarcer good tiles, rival-triggered "improve" flows), full retest.
- **Relocation <25%, or comprehension <50% after one iteration → Pivot/Kill
  discussion.**

**Non-negotiable ground rule:** the moderator must not be the builder. The
team grades its own homework only when someone who didn't build it is asking
the questions and someone else is writing down the quotes verbatim. If the
person running this session also wrote the code, get someone else to
moderate before you trust the result.

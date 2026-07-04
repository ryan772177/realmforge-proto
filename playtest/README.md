# Day 7 playtest tooling

This directory holds the tooling to run and analyze the §23.3 moderated
playtest (docs/realmforge_reset.md). It does not contain real playtest data —
`exports.example/` and `survey.example.json` are synthetic fixtures used only
to verify `compile-metrics.mjs` runs correctly.

## Running a real session

1. Give each tester the live URL (see the deployment memory / ask the team).
2. Moderate per `MODERATOR_PACKET.md` in this directory.
3. At the end of each session, have the tester (or you) click "Export
   Analytics Log" in the app. Save that file as `exports/<tester-id>.json`.
4. Fill in `survey.json` (copy `survey.example.json`'s shape) with each
   tester's answers to the two survey questions the analytics log can't see:
   score comprehension and second-session intent.
5. Compile the report:

   ```
   node playtest/compile-metrics.mjs playtest/exports playtest/survey.json
   ```

This prints the full §23.2 metrics table with pass/iterate/fail verdicts per
metric, a per-tester detail line, and the §27 decision-matrix framing for the
voluntary-relocation north star. It does **not** make the kill/continue call
for you — that's a team decision per §23.3, made by a moderator who wasn't the
builder, with quotes from the sessions recorded verbatim.

## Files

- `compile-metrics.mjs` — the metrics compiler (plain Node, no dependencies).
- `MODERATOR_PACKET.md` — standalone handoff doc for whoever runs the sessions.
- `survey.example.json` / `exports.example/` — synthetic fixtures, not real data.

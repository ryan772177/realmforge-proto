#!/usr/bin/env node
// §23.2 metrics compiler for the Day 7 playtest (§23.3 protocol).
//
// Usage:
//   node playtest/compile-metrics.mjs <exports-dir> [survey.json]
//
// <exports-dir> should contain one JSON file per tester, each the exact array
// produced by the app's "Export Analytics Log" button (src/game/analytics.ts).
// Name the files however you like (e.g. tester-01.json) — the filename (minus
// extension) becomes the tester's id in the report.
//
// [survey.json] is optional and covers the two §23.2 metrics analytics can't
// see (they come from the human moderator's post-session survey, §23.3):
//   [
//     { "tester_id": "tester-01", "score_comprehension": true, "would_play_tomorrow": true },
//     ...
//   ]
// See playtest/survey.example.json for the exact shape.
//
// Prints the full §23.2 table with pass/iterate/fail verdicts per metric,
// plus the §27 decision-matrix read on voluntary relocation (the north star).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";

const QUEST_IDS_FOR_COMPLETION = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];

function loadTesterLogs(exportsDir) {
  const files = readdirSync(exportsDir).filter((f) => extname(f) === ".json");
  if (files.length === 0) {
    throw new Error(`No .json files found in ${exportsDir}`);
  }
  return files.map((f) => ({
    testerId: basename(f, ".json"),
    entries: JSON.parse(readFileSync(join(exportsDir, f), "utf-8")),
  }));
}

function loadSurvey(surveyPath) {
  if (!surveyPath || !existsSync(surveyPath)) return null;
  const rows = JSON.parse(readFileSync(surveyPath, "utf-8"));
  return new Map(rows.map((r) => [r.tester_id, r]));
}

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pct(count, total) {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

function computeTesterMetrics(log) {
  const { entries } = log;
  const byEvent = (name) => entries.filter((e) => e.event === name);

  const firstThPlacement = byEvent("building_placed").find((e) => e.payload.building_id === "B01");
  const timeToFirstPlacementMs = firstThPlacement ? firstThPlacement.t : null;

  const voluntaryRelocation = byEvent("building_relocated").some((e) => e.payload.prompted === false);

  const rivalEngaged = byEvent("rival_card_opened").length > 0;
  const improveClicks = byEvent("rival_improve_clicked").length;

  const sessionEnds = byEvent("session_end");
  const sessionLengthMs = sessionEnds.length > 0
    ? Math.max(...sessionEnds.map((e) => e.payload.duration_ms))
    : null;

  const completedQuestIds = new Set(byEvent("quest_completed").map((e) => e.payload.quest_id));
  const questCompletionRate = pct(
    QUEST_IDS_FOR_COMPLETION.filter((id) => completedQuestIds.has(id)).length,
    QUEST_IDS_FOR_COMPLETION.length
  );

  const confusionClusters = byEvent("confusion_cluster").length;

  const rivalRevealed = byEvent("rival_revealed").length > 0;
  const tutorialDropoff = sessionEnds.length > 0 && !rivalRevealed;

  return {
    testerId: log.testerId,
    timeToFirstPlacementMs,
    voluntaryRelocation,
    rivalEngaged,
    improveClicks,
    sessionLengthMs,
    questCompletionRate,
    confusionClusters,
    tutorialDropoff,
  };
}

function verdict(value, { pass, fail, higherIsBetter = true }) {
  const meetsPass = higherIsBetter ? value >= pass : value <= pass;
  const hitsFail = higherIsBetter ? value < fail : value > fail;
  if (meetsPass) return "PASS";
  if (hitsFail) return "FAIL";
  return "ITERATE";
}

// §27's own 4-tier table for the north star, not the generic 3-tier helper.
function relocationGateVerdict(ratePct) {
  if (ratePct >= 40) return "CONTINUE";
  if (ratePct >= 25) return "ITERATE (redesign loop levers, full retest)";
  if (ratePct >= 15) return "PIVOT candidate (<25% after loop redesign)";
  return "KILL signal (<15% — needs two consecutive misses per §27, but flag now)";
}

function main() {
  const exportsDir = process.argv[2];
  const surveyPath = process.argv[3];
  if (!exportsDir) {
    console.error("Usage: node playtest/compile-metrics.mjs <exports-dir> [survey.json]");
    process.exit(1);
  }

  const logs = loadTesterLogs(exportsDir);
  const survey = loadSurvey(surveyPath);
  const perTester = logs.map(computeTesterMetrics);
  const n = perTester.length;

  console.log(`\n=== Realmforge Rivals — §23.2 Playtest Metrics (n=${n}) ===\n`);

  // 1. Time to first placement
  const withPlacement = perTester.filter((t) => t.timeToFirstPlacementMs !== null);
  const under30s = withPlacement.filter((t) => t.timeToFirstPlacementMs < 30000).length;
  const firstPlacementPct = pct(under30s, n);
  report("1. Time to first placement (<30s)", `${firstPlacementPct}% of ${n}`,
    verdict(firstPlacementPct, { pass: 80, fail: 60 }));

  // 2. Score comprehension (survey-only)
  if (survey) {
    const answered = perTester.filter((t) => survey.get(t.testerId)?.score_comprehension === true).length;
    const p = pct(answered, n);
    report("2. Score comprehension (survey)", `${p}% of ${n}`, verdict(p, { pass: 70, fail: 50 }));
  } else {
    report("2. Score comprehension (survey)", "no survey.json provided", "N/A — see moderator packet §5");
  }

  // 3. Voluntary relocation — THE north star
  const voluntary = perTester.filter((t) => t.voluntaryRelocation).length;
  const voluntaryPct = pct(voluntary, n);
  report("3. Voluntary relocation (NORTH STAR)", `${voluntaryPct}% of ${n}`, relocationGateVerdict(voluntaryPct));

  // 4. Rival engagement
  const engaged = perTester.filter((t) => t.rivalEngaged).length;
  const engagedPct = pct(engaged, n);
  report("4. Rival engagement", `${engagedPct}% of ${n}`, verdict(engagedPct, { pass: 50, fail: 30 }));

  // 5. Improve-score clicks (diagnostic only, no gate)
  const avgImprove = Math.round((perTester.reduce((s, t) => s + t.improveClicks, 0) / n) * 100) / 100;
  report("5. Improve-score clicks / tester", `${avgImprove} avg`, "diagnostic only");

  // 6. Session length
  const lengths = perTester.filter((t) => t.sessionLengthMs !== null).map((t) => t.sessionLengthMs);
  const medianMinutes = lengths.length ? Math.round((median(lengths) / 60000) * 10) / 10 : null;
  report("6. Session length (median)", medianMinutes !== null ? `${medianMinutes} min` : "no session_end logged",
    medianMinutes !== null ? verdict(medianMinutes, { pass: 6, fail: 4 }) : "N/A");

  // 7. Quest completion Q1-Q8
  const avgQuestCompletion = Math.round((perTester.reduce((s, t) => s + t.questCompletionRate, 0) / n) * 10) / 10;
  report("7. Quest completion (Q1-Q8, avg)", `${avgQuestCompletion}%`, verdict(avgQuestCompletion, { pass: 80, fail: 60 }));

  // 8. Confusion taps (clusters), median per tester
  const clusterCounts = perTester.map((t) => t.confusionClusters);
  const medianClusters = median(clusterCounts);
  report("8. Confusion tap clusters (median)", `${medianClusters}`,
    verdict(medianClusters, { pass: 2, fail: 5, higherIsBetter: false }));

  // 9. Tutorial drop-off (quit before rival_revealed)
  const droppedOut = perTester.filter((t) => t.tutorialDropoff).length;
  const dropoutPct = pct(droppedOut, n);
  report("9. Tutorial drop-off (before rival reveal)", `${dropoutPct}% of ${n}`,
    verdict(dropoutPct, { pass: 20, fail: 30, higherIsBetter: false }));

  // 10. Second-session intent (survey-only)
  if (survey) {
    const wouldPlay = perTester.filter((t) => survey.get(t.testerId)?.would_play_tomorrow === true).length;
    const p = pct(wouldPlay, n);
    report("10. Second-session intent (survey)", `${p}% of ${n}`, verdict(p, { pass: 50, fail: 35 }));
  } else {
    report("10. Second-session intent (survey)", "no survey.json provided", "N/A — see moderator packet §5");
  }

  console.log("\n--- Per-tester detail ---");
  for (const t of perTester) {
    console.log(
      `${t.testerId}: firstPlacement=${t.timeToFirstPlacementMs ?? "?"}ms` +
      ` voluntaryRelocation=${t.voluntaryRelocation}` +
      ` rivalEngaged=${t.rivalEngaged}` +
      ` sessionLen=${t.sessionLengthMs ?? "?"}ms` +
      ` questCompletion=${t.questCompletionRate}%` +
      ` confusionClusters=${t.confusionClusters}` +
      ` tutorialDropoff=${t.tutorialDropoff}`
    );
  }

  console.log(
    `\nPer §23.3's decision matrix: read the north-star line above first. ` +
    `All 6 gates pass -> Continue. Relocation >=40% with 1-2 secondary misses -> Iterate (1 week, retest n=5). ` +
    `Relocation 25-40% -> iterate the loop itself, full retest. ` +
    `Relocation <25%, or comprehension <50% after one iteration -> Pivot/Kill discussion. ` +
    `This script does not make the call for you — §23.3: "the team grades its own homework" only with a moderator ` +
    `who wasn't the builder, and quotes recorded verbatim from the sessions.\n`
  );
}

function report(label, value, verdictText) {
  console.log(`${label.padEnd(45)} ${String(value).padEnd(20)} ${verdictText}`);
}

main();

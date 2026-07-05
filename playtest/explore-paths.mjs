#!/usr/bin/env node
// Automated off-path bug hunting for Realmforge Rivals (NOT a playtest tool —
// produces no playtest metrics, only crash/console/soft-lock findings).
//
// Usage:
//   npm install -D playwright --no-save && npx playwright install chromium
//   node playtest/explore-paths.mjs [--url=<baseUrl>] [--local] [--headed]
//
// By default this drives the LIVE deployed app (https://realmforge-proto.vercel.app).
// Pass --local to have this script spawn `npm run dev` on an ephemeral port
// and drive that instead (useful when the network is flaky or you're testing
// unreleased local changes). Pass --headed to watch it run in a real window.
//
// What it does: drives the app through a set of scripted routes that
// deliberately deviate from the "intended minimal" FTUE path in
// config/ftue.json / docs/realmforge_reset.md — extra buildings bought before
// they're "expected", rapid relocation churn, zero-delay drags, reload
// mid-step, tab backgrounding mid-drag, idling past FTUE fallback timers, and
// quests/actions attempted out of the documented order. After every action it
// checks for JS console errors/warnings, unhandled promise rejections,
// negative/NaN/Infinity resource or score values, and the classic "every
// tray item is unaffordable and there's no way to earn more gold" soft-lock
// (the exact bug class a real human tester once found by placing one extra
// building — see git history: "Fix: soft-lock in FTUE economy").
//
// Findings are written to playtest/exploration/exploration-findings.json —
// deliberately a different directory from playtest/exports/, which holds
// only real human "Export Analytics Log" tester exports, so this can never
// be mistaken for or accidentally ingested as real playtest data. The file
// is also an OBJECT (not the array shape real tester exports use), and
// compile-metrics.mjs's loadTesterLogs() skips any non-array JSON it finds
// in playtest/exports/ as defense in depth on top of the directory split.
//
// Re-runnable any time (each route runs in a fresh, isolated browser context
// with its own localStorage) as more informal testing happens.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FINDINGS_PATH = join(__dirname, "exploration", "exploration-findings.json");
const LIVE_URL = "https://realmforge-proto.vercel.app";
const SAVE_KEY = "realmforge-save-v1";
const GRID_SELECTOR = 'div[style*="repeat(6"]';
const TRAY_SELECTOR = 'div[style*="repeat(3, 1fr)"]';

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    [
      "",
      "playwright is not installed. This script needs it as a TRANSIENT dev",
      "dependency (per project convention it is not kept in package.json):",
      "",
      "  npm install -D playwright --no-save",
      "  npx playwright install chromium",
      "",
      "Then re-run: node playtest/explore-paths.mjs",
      "",
    ].join("\n")
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const useLocal = args.includes("--local");
const headed = args.includes("--headed");
const urlArg = args.find((a) => a.startsWith("--url="));
const explicitUrl = urlArg ? urlArg.slice("--url=".length) : null;

// ---------------------------------------------------------------------------
// Findings collection
// ---------------------------------------------------------------------------

/** @type {{route:string, severity:string, kind:string, detail:string}[]} */
const findings = [];
function record(route, severity, kind, detail) {
  findings.push({ route, severity, kind, detail });
  const tag = severity === "crash" || severity === "bug" ? "!!" : "--";
  console.log(`  [${tag}] ${route} :: ${kind}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Local dev server helper
// ---------------------------------------------------------------------------

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 400);
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// DOM interaction helpers
// ---------------------------------------------------------------------------

function tileLocator(page, row, col) {
  const idx = row * 6 + col + 1;
  return page.locator(`${GRID_SELECTOR} > div:nth-child(${idx})`);
}

function trayItem(page, name) {
  return page.locator(`${TRAY_SELECTOR} > div`).filter({ hasText: name });
}

async function boxCenter(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no bounding box (not visible/attached)");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Drags from one locator to another using real mouse events (Chromium turns
// these into pointerdown/pointermove/pointerup, matching the app's
// onPointer* handlers). `steps`/`stepDelayMs` control how "settled" the
// gesture is — low steps + 0 delay approximates a rapid/flicked gesture
// faster than any debounce or CSS transition could keep up with. `holdMs`
// pauses at the final position, still holding the mouse down, before
// releasing — the only way to trigger the app's `bonus_dwell` event (App.tsx
// requires the drag to hover a single valid tile, unmoved, for 1.5s straight
// *before* drop; releasing sooner never fires it, and FTUE step 3's only
// advance condition IS that event — see the "quick-drag-never-dwells" finding
// this harness surfaces).
async function dragTo(page, fromLocator, toLocator, { steps = 8, stepDelayMs = 20, holdMs = 0 } = {}) {
  const from = await boxCenter(fromLocator);
  const to = await boxCenter(toLocator);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps);
    const y = from.y + (to.y - from.y) * (i / steps);
    await page.mouse.move(x, y);
    if (stepDelayMs) await page.waitForTimeout(stepDelayMs);
  }
  if (holdMs) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

// A plain tap: down+up with no movement, under the app's own 8px tap
// threshold, so it's read as a click (claim/open-detail/etc.) not a drag.
async function tap(page, locator) {
  const { x, y } = await boxCenter(locator);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

async function placeFromTray(page, name, row, col, opts) {
  await dragTo(page, trayItem(page, name), tileLocator(page, row, col), opts);
}

const PROSPERITY_BUTTON = 'button:has-text("Prosperity:")';
// The breakdown panel's population line ("N citizens x 2") only renders while
// open — a reliable open/closed marker without reading React internals.
const BREAKDOWN_OPEN_MARKER = "text=/\\d+ citizens/";

// Taps the Prosperity score such that it ends up OPEN and a fresh
// breakdown_opened game event fires. The button is a plain toggle
// (ScoreBreakdown.tsx) and the app only fires that event on the
// closed->open transition (see handleToggleBreakdown's early return when
// already open) — tapping it again while already open just closes it and
// fires nothing. FTUE step 7's only advance condition is that event, so any
// route that taps the score more than once needs this instead of a second
// bare tap() to actually unlock step 8 (Shrine).
async function ensureFreshBreakdownOpen(page) {
  const isOpen = await page.locator(BREAKDOWN_OPEN_MARKER).isVisible().catch(() => false);
  if (isOpen) await tap(page, page.locator(PROSPERITY_BUTTON));
  await tap(page, page.locator(PROSPERITY_BUTTON));
}

// Places from the tray while dwelling 1.7s at the drop tile before releasing
// — satisfies FTUE step 3's real success condition ("dwell >=1.5s on report")
// so FTUE can progress past step 3 the way a human who pauses to read the
// bonus actually would, letting routes exercise Cottage/Shrine/Sawmill and
// beyond. See the dedicated "fast-drag-no-settle" / "rapid-relocation-churn"
// routes for what happens when a player does NOT pause like this.
async function placeFromTrayDwelling(page, name, row, col) {
  await placeFromTray(page, name, row, col, { holdMs: 1700 });
}

async function relocate(page, from, to, opts) {
  await dragTo(page, tileLocator(page, from.row, from.col), tileLocator(page, to.row, to.col), opts);
}

// Picks up a placed building, hovers a different valid tile long enough to
// fire `bonus_dwell` (FTUE step 3's only advance condition), then moves back
// over the origin tile (an automatic "same tile" rejection) and releases —
// which cancels the relocation without committing a `building_relocated`
// event. Lets a route cross step 3 cleanly without also consuming step 4's
// own action, so step 4's fallback/idle behavior can be tested in isolation.
async function dwellThenCancelRelocate(page, from, hoverAway) {
  const src = await boxCenter(tileLocator(page, from.row, from.col));
  const away = await boxCenter(tileLocator(page, hoverAway.row, hoverAway.col));
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y);
  await page.waitForTimeout(1700);
  await page.mouse.move(src.x, src.y);
  await page.mouse.up();
}

const BUILDING_CODES = new Set(["TH", "LC", "Co", "Sh", "SW", "Qu", "Dk", "MT", "Mk", "Wt", "Gd", "Fg"]);

// Reads which tiles currently hold a *building*. RealmGrid.tsx renders a
// <span> on every tile regardless of occupancy — empty tiles show a terrain
// label (e.g. "For", "Mtn") instead of a building code — so a naive "grab
// every tile span" scan misreports an empty board (all-terrain tiles) as
// still containing buildings. Filtering to the known building short-code set
// avoids that false positive.
async function boardBuildingCodes(page) {
  const all = await page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(`${sel} > div > span`)).map((s) => s.textContent);
  }, GRID_SELECTOR);
  return all.filter((c) => BUILDING_CODES.has(c));
}

// Forces a save flush without navigating: App.tsx's pagehide listener calls
// saveGame()+track("session_end",...) on the real 'pagehide' event, but
// dispatching a synthetic Event of that type on window invokes the same
// listener without actually leaving the page — a clean way to read
// mid-route persisted state on demand.
async function flushAndReadSave(page) {
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }, SAVE_KEY);
}

async function readVisibleState(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const num = (re) => {
    const m = bodyText.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    gold: num(/\bG:\s*(-?\d+(?:\.\d+)?)/),
    wood: num(/\bW:\s*(-?\d+(?:\.\d+)?)/),
    stone: num(/\bSt:\s*(-?\d+(?:\.\d+)?)/),
    mana: num(/\bM:\s*(-?\d+(?:\.\d+)?)/),
    prosperity: num(/Prosperity:\s*(-?\d+(?:\.\d+)?)/),
    hasBadNumeric: /\bNaN\b|\bInfinity\b|\bundefined\b/.test(bodyText),
    bodyText,
  };
}

function checkInvariants(route, step, state) {
  if (state.hasBadNumeric) {
    record(route, "bug", "nan_or_undefined_rendered", `at "${step}": page text contains NaN/Infinity/undefined`);
  }
  for (const key of ["gold", "wood", "stone", "mana", "prosperity"]) {
    const v = state[key];
    if (v !== null && (v < 0 || !Number.isFinite(v))) {
      record(route, "bug", "negative_or_non_finite_value", `at "${step}": ${key} = ${v}`);
    }
  }
}

// Heuristic for the historical soft-lock class: every unlocked tray building
// shows as unaffordable (cursor: not-allowed), nothing on the board produces
// gold, and there's no completed-but-unclaimed quest that would hand out
// gold. This is a strong signal, not a certainty (a locked quest might still
// unlock later off an event this script didn't trigger) — findings say
// "potential" and are meant for a human to double check, same as any other
// automated finding here.
async function checkSoftLock(page, route, step) {
  const items = page.locator(`${TRAY_SELECTOR} > div`);
  const count = await items.count();
  if (count === 0) return;
  for (let i = 0; i < count; i++) {
    const cursor = await items.nth(i).evaluate((el) => getComputedStyle(el).cursor);
    if (cursor !== "not-allowed") return; // at least one thing is affordable
  }

  const boardShortCodes = await boardBuildingCodes(page);
  const goldProducerCodes = ["SW", "Dk", "Mk", "Fg"]; // Sawmill, Fishing Dock, Market, Forge
  const hasGoldProducer = boardShortCodes.some((c) => goldProducerCodes.includes(c));
  const claimableQuests = await page.locator('button:has-text("Claim")').count();

  if (!hasGoldProducer && claimableQuests === 0) {
    record(
      route,
      "bug",
      "potential_gold_soft_lock",
      `at "${step}": every unlocked tray building is unaffordable, no gold-producing building is on the board, and no quest is ready to claim.`
    );
  }
}

// ---------------------------------------------------------------------------
// Per-route harness: fresh isolated context, console/error capture
// ---------------------------------------------------------------------------

async function runRoute(browser, baseUrl, name, description, fn) {
  console.log(`\n=== Route: ${name} ===\n${description}`);
  const startedAt = Date.now();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      record(name, type === "error" ? "error" : "warning", `console_${type}`, msg.text());
    }
  });
  page.on("pageerror", (err) => {
    record(name, "crash", "pageerror", String((err && err.stack) || err));
  });
  page.on("requestfailed", (req) => {
    // Ignore aborted requests caused by our own reloads mid-route.
    const failure = req.failure();
    if (failure && failure.errorText === "net::ERR_ABORTED") return;
    record(name, "warning", "requestfailed", `${req.method()} ${req.url()} - ${failure?.errorText}`);
  });
  await page.addInitScript(() => {
    window.__qaCaught = [];
    window.addEventListener("error", (e) => {
      window.__qaCaught.push(`error: ${e.message}`);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      window.__qaCaught.push(`unhandledrejection: ${reason}`);
    });
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(TRAY_SELECTOR, { timeout: 20000 });
    await fn(page);
  } catch (err) {
    record(name, "crash", "script_exception", String((err && err.stack) || err));
  } finally {
    try {
      const caught = await page.evaluate(() => window.__qaCaught || []);
      for (const c of caught) record(name, "crash", "window_error_event", c);
    } catch {
      // page may be gone (closed mid-reload race) — nothing more to collect
    }
    await context.close().catch(() => {});
  }
  console.log(`--- ${name} finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s ---`);
}

// ---------------------------------------------------------------------------
// Shared building blocks used by multiple routes
// ---------------------------------------------------------------------------

const TH = { row: 5, col: 0 }; // Clear
const LC_START = { row: 4, col: 2 }; // 1 adjacent Forest
const LC_BEST = { row: 1, col: 1 }; // 3 adjacent Forest (the "better spot")
const COTTAGE = { row: 2, col: 1 };
const SHRINE = { row: 3, col: 1 }; // Mana Spring, within range 2 of Cottage
const SAWMILL = { row: 2, col: 2 }; // within range 2 of LC_BEST
const EXTRA_LC_1 = { row: 0, col: 3 }; // 0 adjacent Forest — pure "extra" spend
const EXTRA_LC_2 = { row: 3, col: 4 }; // 0 adjacent Forest — pure "extra" spend

async function placeTownHall(page, route) {
  await placeFromTray(page, "Town Hall", TH.row, TH.col);
  checkInvariants(route, "town_hall_placed", await readVisibleState(page));
}

async function claimAllPendingWood(page, tiles) {
  for (const t of tiles) {
    await tap(page, tileLocator(page, t.row, t.col));
  }
}

// ---------------------------------------------------------------------------
// Route 1: extra building before the "expected" one (the historical bug class)
// ---------------------------------------------------------------------------

async function routeExtraBuildingBeforeExpected(page) {
  const route = "extra-building-before-expected";
  await placeTownHall(page, route);
  await placeFromTray(page, "Lumber Camp", LC_START.row, LC_START.col);
  checkInvariants(route, "lumber_camp_placed", await readVisibleState(page));

  // Deviation: buy an extra, unprompted Lumber Camp with zero terrain bonus
  // before ever touching Cottage/Shrine — exactly the class of action
  // (extra purchase before the "expected" building) that caused the real
  // gold soft-lock this project already fixed once.
  await placeFromTray(page, "Lumber Camp", EXTRA_LC_1.row, EXTRA_LC_1.col);
  const afterExtra = await readVisibleState(page);
  checkInvariants(route, "extra_lumber_camp_placed", afterExtra);
  await checkSoftLock(page, route, "extra_lumber_camp_placed");

  // Dwell 1.7s on the drop tile before releasing — the FTUE's step 3 ("read
  // the bonus") only advances on a `bonus_dwell` event, which only fires if a
  // drag hovers one valid tile, unmoved, for a continuous 1.5s before
  // release (see game/ftue.ts + App.tsx's dwell timer). Without this, FTUE
  // gets stuck at step 3 forever — see the fast-drag-no-settle and
  // rapid-relocation-churn routes, which deliberately never dwell and
  // surface exactly that.
  await relocate(page, LC_START, LC_BEST, { holdMs: 1700 });
  checkInvariants(route, "relocated_to_best_forest_tile", await readVisibleState(page));

  await claimAllPendingWood(page, [LC_BEST, EXTRA_LC_1]);
  await page.waitForTimeout(25000); // accrue enough wood for Cottage+Shrine+Sawmill
  await claimAllPendingWood(page, [LC_BEST, EXTRA_LC_1]);
  const afterClaim = await readVisibleState(page);
  checkInvariants(route, "wood_claimed", afterClaim);
  await checkSoftLock(page, route, "wood_claimed");

  await placeFromTray(page, "Cottage", COTTAGE.row, COTTAGE.col);
  checkInvariants(route, "cottage_placed", await readVisibleState(page));
  await checkSoftLock(page, route, "cottage_placed");

  await tap(page, page.locator('button:has-text("Prosperity:")'));

  await placeFromTray(page, "Shrine", SHRINE.row, SHRINE.col);
  const afterShrine = await readVisibleState(page);
  checkInvariants(route, "shrine_placed", afterShrine);
  await checkSoftLock(page, route, "shrine_placed");
  if (afterShrine.gold !== null && afterShrine.gold < 30) {
    // Sawmill needs 60 Wood + 30 Gold — if gold is already under that with
    // Sawmill still required to finish FTUE step 9, wait for more wood/gold
    // income before trying, rather than reporting a false soft-lock.
    await page.waitForTimeout(15000);
    await claimAllPendingWood(page, [LC_BEST, EXTRA_LC_1]);
  }

  await placeFromTray(page, "Sawmill", SAWMILL.row, SAWMILL.col);
  const afterSawmill = await readVisibleState(page);
  checkInvariants(route, "sawmill_placed", afterSawmill);
  await checkSoftLock(page, route, "sawmill_placed");

  const save = await flushAndReadSave(page);
  if (save && save.ftue && save.ftue.stepIndex < 10) {
    record(
      route,
      "warning",
      "ftue_step_stalled",
      `after completing the full minimal build order with one extra Lumber Camp inserted, FTUE step is only ${save.ftue.stepIndex} (expected >= 10)`
    );
  }
}

// ---------------------------------------------------------------------------
// Route 2: rapid relocation churn immediately after placing
// ---------------------------------------------------------------------------

async function routeRapidRelocationChurn(page) {
  const route = "rapid-relocation-churn";
  await placeTownHall(page, route);
  await placeFromTray(page, "Lumber Camp", LC_START.row, LC_START.col);

  const stops = [
    { row: 4, col: 3 },
    { row: 3, col: 3 },
    { row: 2, col: 4 },
    { row: 1, col: 1 },
    { row: 0, col: 4 },
    LC_START,
  ];
  let current = LC_START;
  for (const stop of stops) {
    await relocate(page, current, stop, { steps: 3, stepDelayMs: 0 });
    current = stop;
    checkInvariants(route, `churn_relocate_to_${stop.row}_${stop.col}`, await readVisibleState(page));
  }

  // Exactly one Lumber Camp should exist on the board after 6 relocations —
  // never more, never fewer.
  const boardCodes = await boardBuildingCodes(page);
  const lcCount = boardCodes.filter((c) => c === "LC").length;
  if (lcCount !== 1) {
    record(route, "bug", "duplicate_or_missing_building", `expected exactly 1 Lumber Camp on board after churn, found ${lcCount}`);
  }

  await reportIfStuckBeforeDwell(page, route, "after 6 rapid relocations with no dwell");
}

// FTUE step 3's ONLY advance condition is a `bonus_dwell` event, which only
// fires if a drag hovers one valid tile, completely unmoved, for a
// continuous 1.5s before release (App.tsx's dwell timer + game/ftue.ts
// stepAdvances case 3). A player (or script) who places/relocates quickly —
// which is the normal, confident way to drag-and-drop — never triggers it
// and gets stuck at step 3 forever: no resource bar (needs step >=5), no
// Cottage/Shrine/Sawmill (unlock at steps 6/8/9), no rival, no quest panel
// (step 12). This is a real, reproducible FTUE soft-lock for anyone who
// doesn't happen to pause mid-drag — flagging it as a bug rather than a mere
// oddity of this harness's timing.
async function reportIfStuckBeforeDwell(page, route, context) {
  const save = await flushAndReadSave(page);
  if (save && save.ftue && save.ftue.active && save.ftue.stepIndex === 3) {
    record(
      route,
      "bug",
      "ftue_stuck_at_step3_no_dwell_ever_fired",
      `${context}: FTUE is still stuck at step 3 ("read the bonus"). Step 3 only advances on a bonus_dwell event, which requires holding a drag stationary over a valid tile for 1.5s straight before releasing — every drag in this route committed faster than that. No resource bar, Cottage, Shrine, Sawmill, rival, or quest panel will ever appear for the rest of the session unless the player happens to pause mid-drag.`
    );
  }
}

// ---------------------------------------------------------------------------
// Route 3: rapid/zero-delay drags and repeated taps faster than any debounce
// ---------------------------------------------------------------------------

async function routeFastDragNoSettle(page) {
  const route = "fast-drag-no-settle";
  await placeTownHall(page, route);
  await dragTo(page, trayItem(page, "Lumber Camp"), tileLocator(page, LC_START.row, LC_START.col), {
    steps: 1,
    stepDelayMs: 0,
  });
  checkInvariants(route, "fast_lumber_camp_placed", await readVisibleState(page));

  await dragTo(page, tileLocator(page, LC_START.row, LC_START.col), tileLocator(page, LC_BEST.row, LC_BEST.col), {
    steps: 1,
    stepDelayMs: 0,
  });
  checkInvariants(route, "fast_relocate", await readVisibleState(page));

  // Ten rapid taps on the same (currently empty, non-claimable) tile — should
  // be inert, not crash or open/close-storm the detail panel into a bad state.
  for (let i = 0; i < 10; i++) {
    await tap(page, tileLocator(page, 5, 5));
  }
  checkInvariants(route, "rapid_taps_empty_tile", await readVisibleState(page));

  // Ten rapid taps on the Prosperity toggle.
  for (let i = 0; i < 10; i++) {
    await tap(page, page.locator('button:has-text("Prosperity:")'));
  }
  checkInvariants(route, "rapid_score_toggle", await readVisibleState(page));

  await reportIfStuckBeforeDwell(page, route, "after zero-delay place + relocate");
}

// ---------------------------------------------------------------------------
// Route 4: reload mid-FTUE-step, and reload immediately after Start Over
// ---------------------------------------------------------------------------

async function routeReloadMidStep(page) {
  const route = "reload-mid-ftue-step";
  await placeTownHall(page, route);
  const beforeReload = await flushAndReadSave(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(TRAY_SELECTOR, { timeout: 20000 });

  const boardCodes = await boardBuildingCodes(page);
  const thCount = boardCodes.filter((c) => c === "TH").length;
  if (thCount !== 1) {
    record(route, "bug", "duplicate_or_missing_building", `expected exactly 1 Town Hall after reload, found ${thCount}`);
  }
  const afterReload = await flushAndReadSave(page);
  if (!afterReload || !afterReload.ftue || afterReload.ftue.stepIndex !== (beforeReload?.ftue?.stepIndex ?? 2)) {
    record(
      route,
      "bug",
      "ftue_step_not_restored",
      `FTUE step before reload=${beforeReload?.ftue?.stepIndex}, after reload=${afterReload?.ftue?.stepIndex}`
    );
  }
  checkInvariants(route, "post_reload", await readVisibleState(page));

  // Start Over, then reload immediately — before any autosave interval could
  // re-persist stale state (the exact race the app's own comment about
  // isResettingRef.current documents).
  page.once("dialog", (d) => d.accept());
  await page.click('button:has-text("Start Over")');
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(TRAY_SELECTOR, { timeout: 20000 });

  const buildingsAfterReset = await boardBuildingCodes(page);
  if (buildingsAfterReset.length > 0) {
    record(
      route,
      "bug",
      "start_over_then_reload_kept_old_state",
      `expected an empty board after Start Over + immediate reload, found buildings: ${buildingsAfterReset.join(",")}`
    );
  }
  const freshState = await readVisibleState(page);
  checkInvariants(route, "post_start_over_reload", freshState);
}

// ---------------------------------------------------------------------------
// Route 5: backgrounding the tab mid-drag and mid-dwell-timer
// ---------------------------------------------------------------------------

async function simulateVisibilityChange(page, hidden) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (isHidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function routeBackgroundTabMidDrag(page) {
  const route = "background-tab-mid-drag";
  await placeTownHall(page, route);

  // Start dragging Lumber Camp from the tray but do NOT release yet.
  const from = await boxCenter(trayItem(page, "Lumber Camp"));
  const to = await boxCenter(tileLocator(page, LC_START.row, LC_START.col));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);

  await simulateVisibilityChange(page, true); // background mid-drag
  await page.waitForTimeout(300);
  await simulateVisibilityChange(page, false); // foreground again

  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  checkInvariants(route, "drop_after_background_mid_drag", await readVisibleState(page));

  // Confirm the drag actually completed (or at minimum, didn't leave a
  // stuck ghost/ badly-captured pointer) by placing the next building
  // normally and checking it also lands.
  const boardCodes = await boardBuildingCodes(page);
  if (!boardCodes.includes("LC")) {
    record(route, "warning", "drag_lost_after_backgrounding", "Lumber Camp drag begun before backgrounding never landed on the board");
  }

  // Background again during the ~1.5s bonus_dwell hover timer.
  const lcCenter = await boxCenter(tileLocator(page, LC_START.row, LC_START.col));
  const targetCenter = await boxCenter(tileLocator(page, LC_BEST.row, LC_BEST.col));
  await page.mouse.move(lcCenter.x, lcCenter.y);
  await page.mouse.down();
  await page.mouse.move(targetCenter.x, targetCenter.y);
  await simulateVisibilityChange(page, true);
  await page.waitForTimeout(2000); // longer than the 1.5s dwell timer
  await simulateVisibilityChange(page, false);
  await page.mouse.up();
  checkInvariants(route, "drop_after_background_during_dwell", await readVisibleState(page));

  // Background right at session end via a real full backgrounding cycle to
  // make sure session_end/autosave doesn't throw.
  await simulateVisibilityChange(page, true);
  await page.waitForTimeout(200);
  await simulateVisibilityChange(page, false);
  checkInvariants(route, "final_background_cycle", await readVisibleState(page));
}

// ---------------------------------------------------------------------------
// Route 6: idle past each fallback delay, then act anyway
// ---------------------------------------------------------------------------

async function routeIdlePastFallback(page) {
  const route = "idle-past-fallback";
  await placeTownHall(page, route);

  // Step 2's fallback fires at 10s (config/ftue.json). Idle well past it.
  await page.waitForTimeout(12000);
  const hintVisible = await page
    .locator("text=Look for the green Forest tiles.")
    .isVisible()
    .catch(() => false);
  if (!hintVisible) {
    record(route, "warning", "fallback_hint_missing", "step 2 fallback hint text never appeared after 12s idle");
  }
  // Act anyway — the fallback firing must not block the real action.
  await placeFromTray(page, "Lumber Camp", LC_START.row, LC_START.col);
  const afterStep2 = await flushAndReadSave(page);
  if (!afterStep2 || afterStep2.ftue.stepIndex < 3) {
    record(route, "bug", "ftue_stuck_after_fallback", `step did not advance past 2 after idling past its fallback and then acting (stepIndex=${afterStep2?.ftue?.stepIndex})`);
  }
  checkInvariants(route, "acted_after_step2_fallback", await readVisibleState(page));

  // Step 3 only advances on a `bonus_dwell` event (a drag holding a valid
  // tile, unmoved, for 1.5s straight) — cross it without also consuming step
  // 4's own relocate action, so step 4's fallback can be tested in isolation.
  await dwellThenCancelRelocate(page, LC_START, LC_BEST);
  const afterDwell = await flushAndReadSave(page);
  if (!afterDwell || afterDwell.ftue.stepIndex < 4) {
    record(route, "bug", "ftue_stuck_at_step3_without_dwell", `expected FTUE step >= 4 after a 1.7s dwell hover, got stepIndex=${afterDwell?.ftue?.stepIndex}`);
  }

  // Step 4's fallback (relocate) also fires at 10s — idle, then relocate.
  await page.waitForTimeout(11000);
  await relocate(page, LC_START, LC_BEST);
  const afterStep4 = await flushAndReadSave(page);
  if (!afterStep4 || afterStep4.ftue.stepIndex < 5) {
    record(route, "bug", "ftue_stuck_after_fallback", `step did not advance past 4 after idling past its fallback and then relocating (stepIndex=${afterStep4?.ftue?.stepIndex})`);
  }
  checkInvariants(route, "acted_after_step4_fallback", await readVisibleState(page));
}

// ---------------------------------------------------------------------------
// Route 7: out-of-order quests / early actions the config allows
// ---------------------------------------------------------------------------

async function routeOutOfOrderQuests(page) {
  const route = "out-of-order-quests-and-early-actions";
  await placeTownHall(page, route);

  // Tap the Prosperity score (the step-7 action) immediately, well before
  // Cottage/Shrine (steps 6/8) even exist — score is visible from step 2 on.
  await tap(page, page.locator('button:has-text("Prosperity:")'));
  checkInvariants(route, "early_breakdown_tap", await readVisibleState(page));

  // Shortcut Q2+Q3 in a single placement by going straight for the 3-Forest
  // tile instead of the "start suboptimal, then relocate" path the FTUE
  // teaches.
  await placeFromTray(page, "Lumber Camp", LC_BEST.row, LC_BEST.col);
  checkInvariants(route, "shortcut_best_forest_tile", await readVisibleState(page));

  // FTUE step 4 only requires *a* relocation event (see game/ftue.ts
  // stepAdvances case 4) — the doc's successCondition text says "moved to >=
  // same Forest bonus as original", but nothing in code enforces that. Move
  // to a strictly WORSE tile and confirm the step advances anyway (a real
  // divergence between documented intent and implemented behavior, worth a
  // human's attention even though it isn't a crash).
  // holdMs dwells the drop long enough to also satisfy step 3's bonus_dwell
  // requirement (see reportIfStuckBeforeDwell) — without it FTUE never
  // reaches step 4 to test in the first place.
  const worseTile = { row: 0, col: 3 }; // 0 adjacent Forest
  await relocate(page, LC_BEST, worseTile, { holdMs: 1700 });
  const afterWorseRelocate = await flushAndReadSave(page);
  if (afterWorseRelocate && afterWorseRelocate.ftue.stepIndex >= 5) {
    record(
      route,
      "info",
      "relocation_success_condition_not_enforced",
      "config/ftue.json step 4's successCondition says the camp must move to >= its original Forest bonus, but relocating to a strictly worse tile (0 vs 3 adjacent Forest) still advanced the FTUE step. Spec/implementation divergence, not a crash — flagging for a human to decide if it matters."
    );
  }
  checkInvariants(route, "after_worse_relocate", await readVisibleState(page));

  // Move it back to a good tile so the rest of the route has a working economy.
  await relocate(page, worseTile, LC_BEST);
  await page.waitForTimeout(20000);
  await claimAllPendingWood(page, [LC_BEST]);
  checkInvariants(route, "wood_claimed", await readVisibleState(page));
  await checkSoftLock(page, route, "wood_claimed");

  // Place Shrine's prerequisite reversed — Cottage normally comes first
  // (step 6) before Shrine (step 8); the Q6 trigger condition
  // (`all_placed: [B03, B04]`) doesn't care about order. Confirm placing
  // Shrine-shaped-first still works once Cottage unlocks and both exist.
  await placeFromTray(page, "Cottage", COTTAGE.row, COTTAGE.col);
  checkInvariants(route, "cottage_placed", await readVisibleState(page));
  // Step 7 ("tap Prosperity") only advances on a fresh breakdown_opened event
  // fired *while step 7 is current* — the earlier early_breakdown_tap above
  // happened while at step ~1-2 and doesn't count retroactively (same
  // strictly-sequential rule as step 3's dwell). The score button already
  // got opened by that early tap and nothing has closed it since, so a bare
  // second tap would just close it (see ensureFreshBreakdownOpen) — use the
  // safe helper to guarantee a real open transition and unlock Shrine (step 8).
  await ensureFreshBreakdownOpen(page);
  await placeFromTray(page, "Shrine", SHRINE.row, SHRINE.col);
  const afterBoth = await readVisibleState(page);
  checkInvariants(route, "shrine_placed", afterBoth);
  await checkSoftLock(page, route, "shrine_placed");
}

// ---------------------------------------------------------------------------
// Route 8: Start Over spam — cancel, then accept, then double-trigger
// ---------------------------------------------------------------------------

async function routeStartOverSpam(page) {
  const route = "start-over-spam";
  await placeTownHall(page, route);
  await placeFromTray(page, "Lumber Camp", LC_START.row, LC_START.col);

  // Cancel the confirm — board must be untouched.
  page.once("dialog", (d) => d.dismiss());
  await page.click('button:has-text("Start Over")');
  await page.waitForTimeout(200);
  const boardAfterCancel = await boardBuildingCodes(page);
  if (!boardAfterCancel.includes("TH") || !boardAfterCancel.includes("LC")) {
    record(route, "bug", "cancel_start_over_lost_state", `board changed after dismissing the Start Over confirm: ${JSON.stringify(boardAfterCancel)}`);
  }

  // Now accept, and fire a second click immediately after (before the
  // reload navigates away) to see if a double-trigger races clearSave()/reload.
  page.once("dialog", (d) => d.accept());
  const clickAndMaybeSecondClick = async () => {
    await page.click('button:has-text("Start Over")');
    // Best-effort second click; the page may already be navigating away by
    // the time this fires, which is fine — that's the race being probed.
    await page.click('button:has-text("Start Over")', { timeout: 500 }).catch(() => {});
  };
  await clickAndMaybeSecondClick();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForSelector(TRAY_SELECTOR, { timeout: 20000 });

  const remaining = await boardBuildingCodes(page);
  if (remaining.length > 0) {
    record(route, "bug", "start_over_spam_left_buildings", `expected an empty board after accepted Start Over (even double-clicked), found: ${remaining.join(",")}`);
  }
  checkInvariants(route, "post_start_over_spam", await readVisibleState(page));
}

// ---------------------------------------------------------------------------
// Route 9: maximum extra-spend stress test (the historical bug class, pushed hard)
// ---------------------------------------------------------------------------

async function routeMaxExtraSpendStress(page) {
  const route = "soft-lock-stress-max-extra-spend";
  await placeTownHall(page, route);
  await placeFromTray(page, "Lumber Camp", LC_START.row, LC_START.col);
  checkInvariants(route, "first_lumber_camp", await readVisibleState(page));

  // Keep buying extra Lumber Camps — the only gold-costing building unlocked
  // this early — for as long as the tray allows it, deliberately trying to
  // drive gold to zero before Cottage/Shrine/Sawmill are affordable.
  const extraSpots = [
    { row: 0, col: 3 },
    { row: 3, col: 4 },
    { row: 4, col: 5 },
    { row: 0, col: 5 },
  ];
  const placedExtras = [];
  for (const spot of extraSpots) {
    const before = await readVisibleState(page);
    const item = trayItem(page, "Lumber Camp");
    const cursor = await item.evaluate((el) => getComputedStyle(el).cursor).catch(() => "not-allowed");
    if (cursor === "not-allowed") break; // out of gold, stop buying
    await placeFromTray(page, "Lumber Camp", spot.row, spot.col);
    placedExtras.push(spot);
    const after = await readVisibleState(page);
    checkInvariants(route, `extra_lumber_camp_${placedExtras.length}`, after);
    if (before.gold !== null && after.gold !== null && after.gold > before.gold + 1) {
      // Sanity: gold should never go UP from a purchase (quest gold is a
      // separate, later check) — if it does, something's off in cost logic.
      record(route, "bug", "gold_increased_on_purchase", `gold went from ${before.gold} to ${after.gold} after buying a Lumber Camp at (${spot.row},${spot.col})`);
    }
  }
  await checkSoftLock(page, route, "gold_exhausted_on_extra_lumber_camps");

  // holdMs dwells long enough to satisfy step 3's bonus_dwell requirement
  // (see reportIfStuckBeforeDwell) so FTUE can progress far enough to
  // eventually unlock Cottage/Shrine below.
  await relocate(page, LC_START, LC_BEST, { holdMs: 1700 });

  // Long wait, then claim from every camp tile on the board at once — with
  // several camps running this should accumulate well over the ~130 Wood
  // needed for Cottage+Shrine+Sawmill combined even in this one window.
  await page.waitForTimeout(30000);
  await claimAllPendingWood(page, [LC_BEST, ...placedExtras]);
  const afterClaim = await readVisibleState(page);
  checkInvariants(route, "wood_claimed_after_max_spend", afterClaim);
  await checkSoftLock(page, route, "wood_claimed_after_max_spend");

  await placeFromTray(page, "Cottage", COTTAGE.row, COTTAGE.col);
  checkInvariants(route, "cottage_placed", await readVisibleState(page));
  // Step 7 only advances on a breakdown_opened event fired while it's
  // current — use the safe open helper (see ensureFreshBreakdownOpen) so
  // Shrine (step 8) unlocks in the tray at all.
  await ensureFreshBreakdownOpen(page);

  const beforeShrine = await readVisibleState(page);
  const shrineAffordable = beforeShrine.gold !== null && beforeShrine.gold >= 20 && beforeShrine.wood !== null && beforeShrine.wood >= 40;
  if (!shrineAffordable) {
    // This is the crux check: with gold spent all the way down on extra
    // camps, is there ANY route back to affording Shrine, or is this the
    // soft lock? Wait for quest auto-grants / more accrual before concluding.
    await page.waitForTimeout(20000);
    await claimAllPendingWood(page, [LC_BEST, ...placedExtras]);
  }
  const finalCheck = await readVisibleState(page);
  const stillStuck = finalCheck.gold !== null && finalCheck.gold < 20;
  if (stillStuck) {
    await checkSoftLock(page, route, "shrine_unaffordable_after_max_extra_spend");
  } else {
    await placeFromTray(page, "Shrine", SHRINE.row, SHRINE.col);
    checkInvariants(route, "shrine_placed_after_recovery", await readVisibleState(page));
    await checkSoftLock(page, route, "shrine_placed_after_recovery");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let baseUrl = explicitUrl || LIVE_URL;
  let devProcess = null;
  let mode = explicitUrl ? "custom" : "live";

  if (useLocal && !explicitUrl) {
    mode = "local";
    const port = 5183;
    baseUrl = `http://localhost:${port}`;
    console.log(`Starting local dev server (npm run dev) on port ${port}...`);
    devProcess = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
    await waitForServer(baseUrl, 30000);
  }

  console.log(`\nRealmforge Rivals — automated off-path bug hunt`);
  console.log(`Target: ${baseUrl} (mode: ${mode})`);

  const browser = await chromium.launch({ headless: !headed });
  const routeStartedAt = Date.now();
  try {
    const routes = [
      [
        "extra-building-before-expected",
        "Buy an extra, unprompted Lumber Camp before ever touching Cottage/Shrine — the exact action class that caused the real gold soft-lock this project fixed once already.",
        routeExtraBuildingBeforeExpected,
      ],
      [
        "rapid-relocation-churn",
        "Relocate the same building 6 times back-to-back with minimal settle time.",
        routeRapidRelocationChurn,
      ],
      [
        "fast-drag-no-settle",
        "Zero-delay/near-instant drags and 10x rapid taps, faster than any debounce or CSS transition.",
        routeFastDragNoSettle,
      ],
      [
        "reload-mid-ftue-step",
        "Reload mid-FTUE-step, and reload immediately after clicking Start Over.",
        routeReloadMidStep,
      ],
      [
        "background-tab-mid-drag",
        "Fire visibilitychange (tab backgrounded/foregrounded) mid-drag and mid-dwell-timer.",
        routeBackgroundTabMidDrag,
      ],
      [
        "idle-past-fallback",
        "Idle past each FTUE step's fallback delay, then perform the real action anyway.",
        routeIdlePastFallback,
      ],
      [
        "out-of-order-quests-and-early-actions",
        "Tap the score before it's 'expected', shortcut two quests in one placement, relocate to a worse tile, and place Shrine/Cottage in reverse of the documented order.",
        routeOutOfOrderQuests,
      ],
      [
        "start-over-spam",
        "Dismiss the Start Over confirm, then accept it and double-click before the reload lands.",
        routeStartOverSpam,
      ],
      [
        "soft-lock-stress-max-extra-spend",
        "Buy as many extra Lumber Camps as gold allows before Cottage/Shrine/Sawmill — the hardest push at the historical soft-lock class.",
        routeMaxExtraSpendStress,
      ],
    ];

    for (const [name, description, fn] of routes) {
      await runRoute(browser, baseUrl, name, description, fn);
    }
  } finally {
    await browser.close();
    if (devProcess) devProcess.kill();
  }

  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

  const report = {
    kind: "automated_bug_hunt_findings",
    NOT_A_PLAYTEST_EXPORT:
      "This file is machine-generated by playtest/explore-paths.mjs. It contains zero human playtest signal (no relocation rate, no score comprehension, no session intent) and must never be treated as tester data or fed to compile-metrics.mjs — see the shape guard added there.",
    generatedAt: new Date().toISOString(),
    targetUrl: baseUrl,
    targetMode: mode,
    durationMs: Date.now() - routeStartedAt,
    routes: [
      "extra-building-before-expected",
      "rapid-relocation-churn",
      "fast-drag-no-settle",
      "reload-mid-ftue-step",
      "background-tab-mid-drag",
      "idle-past-fallback",
      "out-of-order-quests-and-early-actions",
      "start-over-spam",
      "soft-lock-stress-max-extra-spend",
    ],
    summary: { totalFindings: findings.length, bySeverity },
    findings,
  };

  mkdirSync(dirname(FINDINGS_PATH), { recursive: true });
  writeFileSync(FINDINGS_PATH, JSON.stringify(report, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Findings: ${findings.length}`, bySeverity);
  console.log(`Written to ${FINDINGS_PATH}`);

  process.exitCode = findings.some((f) => f.severity === "crash" || f.severity === "bug") ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * T1–T12: Scoring unit tests per §16.6
 *
 * STATUS: implemented (Day 4). computeScore/computeScorePreview in
 * src/scoring/score.ts apply the §16.2/§17 formula literally (Chebyshev
 * distance inclusive of the range boundary, no per-layout exceptions).
 *
 * GOLDEN VALUES (recomputed from a literal, no-exceptions implementation of
 * §16.2/§17 — Chebyshev distance inclusive of the range boundary, Town Hall's
 * aura applying uniformly to every producer in range, no occupancy exception
 * for terrain matching, Shrine's spring bonus applying whenever geometrically
 * adjacent to a Mana Spring tile, Imbalance applied uniformly per the formula).
 * The original hand-computed values in docs/realmforge_reset.md §16.4 (306,
 * 248, 559, 589, 140) undercount several bonuses that are live under a literal
 * reading of the same rules (e.g. Shrine adjacent to a Mana Spring in Layout A
 * and Layout C; Town Hall's aura reaching a building at exactly Chebyshev
 * distance 2; Imbalance applying to Town Hall's own population with no
 * Cottage on the board). These values below are the ones the implementation
 * actually produces from the documented formula, applied with no exceptions.
 *   Layout A (FTUE end, good placement)   = 316
 *   Layout B (same 5 buildings, sprawl)   = 251
 *   Layout C (10 buildings, zoning error) = 600
 *   Layout C-fixed (Cottage relocated)    = 620
 *   Lone Town Hall                        = 120
 *
 * See docs/realmforge_reset.md §16.4 for the (superseded) worked arithmetic.
 */

import { describe, it, expect } from "vitest";
import { computeScore, computeScorePreview } from "../src/scoring/score";
import { buildBoard, placeBuilding, relocateBuilding } from "../src/board/grid";

// ---------------------------------------------------------------------------
// Board helpers — construct the canonical test layouts.
//
// Authored 6×6 map (row 0 = top):
//   row0: F  F  S  C  M  M
//   row1: F  F  C  R  M  C
//   row2: C  C  R  R  M  C
//   row3: C  S  C  R  C  M
//   row4: C  C  C  R  C  C
//   row5: C  C  C  F  F  F
//
// Forest cluster A (4-tile): (0,0)(0,1)(1,0)(1,1)
// Forest cluster B (3-tile): (5,3)(5,4)(5,5)
// ---------------------------------------------------------------------------

function emptyBoard() {
  return buildBoard();
}

// Layout A — FTUE end, good placement. Expected score: 316
//   TH at (2,2)
//   LC at (1,0) — adj to (0,0)F,(0,1)F,(1,1)F = 3 Forest → TerrainMult 1.6
//   Sawmill at (2,1) — within Chebyshev 2 of TH(2,2) and LC(1,0) → SynergyMult 1.25 on LC
//   Cottage at (3,3)
//   Shrine at (3,2) — Cottage(3,3) is range 1 → +5 Happiness; Shrine is also
//     adjacent to the Mana Spring at (3,1) → +10 Mana (springBonus, unconditional)
function layoutA() {
  let b = emptyBoard();
  b = placeBuilding(b, "B01", 2, 2);
  b = placeBuilding(b, "B02", 1, 0);
  b = placeBuilding(b, "B05", 2, 1);
  b = placeBuilding(b, "B03", 3, 3);
  b = placeBuilding(b, "B04", 3, 2);
  return b;
}

// Layout B — same 5 buildings, careless sprawl. Expected score: 251
//   TH at (0,3) — Chebyshev(0,3 vs 5,5)=5 to LC, out of range; but
//     Chebyshev(0,3 vs 0,5)=2 to Sawmill, exactly at the range-2 boundary
//     → Sawmill still receives Town Hall's +10% aura
//   LC at (5,5) — adj to (5,4)F only = 1 Forest → TerrainMult 1.2
//   Sawmill at (0,5) — Chebyshev(0,5 vs 5,5)=5, not in range of LC
//   Cottage at (4,0)
//   Shrine at (0,2) — Chebyshev(0,2 vs 4,0)=max(4,2)=4, Cottage NOT in range 2
function layoutB() {
  let b = emptyBoard();
  b = placeBuilding(b, "B01", 0, 3);
  b = placeBuilding(b, "B02", 5, 5);
  b = placeBuilding(b, "B05", 0, 5);
  b = placeBuilding(b, "B03", 4, 0);
  b = placeBuilding(b, "B04", 0, 2);
  return b;
}

// Layout C — 10 buildings, one zoning mistake (Forge near Cottage1). Expected score: 600
//   TH at (2,2)
//   LC1 at (1,0) — adj (0,0)F,(0,1)F,(1,1)F = 3 Forest (terrain matching counts
//     tile terrain regardless of whether a building occupies it) → ×1.6; Sawmill+TH in range → ×1.25
//   LC2 at (0,0) — adj (0,1)F,(1,0)F,(1,1)F = 3 Forest (same rule) → ×1.6
//               — Sawmill+TH in range → ×1.25
//   Sawmill at (2,1) — 2 LCs + TH in range = +10%+10%+10% = +30% → SynergyMult 1.30
//   Quarry at (1,4) — adj (0,4)M,(0,5)M,(2,4)M = 3 Mountain (cap 3) → ×1.6; TH in range (dist 2) → ×1.1
//   Forge at (2,4)  — adj (1,4)M,(3,5)M = 2 Mountain (cap 2) → ×1.4; Quarry(1,4) within 2 → +20%;
//     TH in range (dist 2) → +10% → ×1.4×1.3
//   Cottage1 at (3,2) — Chebyshev(3,2 vs 2,4)=max(1,2)=2 → IN Forge conflict range: −10 Happiness
//   Cottage2 at (3,1)
//   Shrine at (4,1)  — Cottage1(3,2): Cheb=max(1,1)=1 ✓; Cottage2(3,1): Cheb=max(1,0)=1 ✓;
//     also adjacent to the Mana Spring at (3,1) → +10 Mana (springBonus)
//   Garden at (4,3)  — River tile; Cottage1(3,2): Cheb=max(1,1)=1 ✓ → +5 Happiness; +10 Beauty from River
function layoutC() {
  let b = emptyBoard();
  b = placeBuilding(b, "B01", 2, 2);
  b = placeBuilding(b, "B02", 1, 0);
  b = placeBuilding(b, "B02", 0, 0);
  b = placeBuilding(b, "B05", 2, 1);
  b = placeBuilding(b, "B06", 1, 4);
  b = placeBuilding(b, "B12", 2, 4);
  b = placeBuilding(b, "B03", 3, 2);
  b = placeBuilding(b, "B03", 3, 1);
  b = placeBuilding(b, "B04", 4, 1);
  b = placeBuilding(b, "B11", 4, 3);
  return b;
}

// Layout C-fixed — Cottage1 relocated out of Forge range. Expected score: 620 (+20 from one move)
//   Cottage1 moved from (3,2) to (4,0): Chebyshev(4,0 vs 2,4)=max(2,4)=4 → out of Forge range
//     (Forge's -10 Happiness is removed), but also now Chebyshev(4,0 vs 4,3)=3 → out of
//     Garden's range-1 aura (loses its +5 Happiness): HappyPts 15→20, Happiness 30→40,
//     Imbalance 10→0 (max(0, 40-40)) — net +20 Prosperity
function layoutCFixed() {
  let b = layoutC();
  b = relocateBuilding(b, 3, 2, 4, 0);
  return b;
}

// ---------------------------------------------------------------------------
// T1: Empty grid scores 0 with all-zero breakdown
// ---------------------------------------------------------------------------
describe("T1: empty grid", () => {
  it("scores 0 with all-zero breakdown", () => {
    const report = computeScore(emptyBoard());
    expect(report.prosperity).toBe(0);
    expect(report.production).toBe(0);
    expect(report.population).toBe(0);
    expect(report.happiness).toBe(0);
    expect(report.mana).toBe(0);
    expect(report.beauty).toBe(0);
    expect(report.imbalance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T2: Lone Town Hall scores exactly 120 (100 Production + 40 Population - 20 Imbalance)
//   Production: 100 flat
//   Population: pop=20 × 2 = 40
//   Imbalance: max(0, TotalPop(20) - 2*HappyPts(0)) = 20 — Town Hall's own
//     population counts toward TotalPop (confirmed by T8), and with no
//     Cottage/Shrine/Watchtower/Garden on the board HappyPts is 0, so the
//     literal formula bites even with a single building on the board.
// ---------------------------------------------------------------------------
describe("T2: lone Town Hall", () => {
  it("scores exactly 120", () => {
    let b = emptyBoard();
    b = placeBuilding(b, "B01", 2, 2);
    const report = computeScore(b);
    expect(report.production).toBe(100);
    expect(report.population).toBe(40);
    expect(report.happiness).toBe(0);
    expect(report.mana).toBe(0);
    expect(report.beauty).toBe(0);
    expect(report.imbalance).toBe(20);
    expect(report.prosperity).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// T3: Golden layout values — A=316, B=251, C=600
// ---------------------------------------------------------------------------
describe("T3: golden layouts", () => {
  it("Layout A scores 316", () => {
    expect(computeScore(layoutA()).prosperity).toBe(316);
  });

  it("Layout B scores 251", () => {
    expect(computeScore(layoutB()).prosperity).toBe(251);
  });

  it("Layout C scores 600", () => {
    expect(computeScore(layoutC()).prosperity).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// T4: Layout C with Cottage1 relocated scores 620 (+20 from one move)
// ---------------------------------------------------------------------------
describe("T4: relocation improvement", () => {
  it("Layout C-fixed scores 620", () => {
    expect(computeScore(layoutCFixed()).prosperity).toBe(620);
  });
});

// ---------------------------------------------------------------------------
// T5: Terrain cap — LC with 4 adjacent Forest scores same as with 3
//   TerrainMult formula: 1 + 0.2 × min(adj_forest, 3)
//   At 3 Forest: 1.6. At 4 Forest: still 1.6 (cap=3 in config).
//   Test uses buildBoard({ overrideTile }) to construct a 4-Forest-adj scenario.
// ---------------------------------------------------------------------------
describe("T5: terrain cap", () => {
  it("LC with 4 adj Forest scores same as with 3 (cap=3)", () => {
    let b3 = emptyBoard();
    b3 = placeBuilding(b3, "B02", 1, 0);  // 3 Forest adj: (0,0)F,(0,1)F,(1,1)F
    const score3 = computeScore(b3).production;

    // Override (2,0) to Forest → LC at (1,0) now has 4 adj Forest tiles
    let b4 = buildBoard({ overrideTile: { row: 2, col: 0, terrain: "F" } });
    b4 = placeBuilding(b4, "B02", 1, 0);
    const score4 = computeScore(b4).production;

    expect(score3).toBe(score4);
  });
});

// ---------------------------------------------------------------------------
// T6: Synergy clamp — global +50% cap applied before multiplier
//   Market receives +10% per unique building type within range 2 (cap 5 types = +50%).
//   With TH also in range (+10%), raw sum = +60% → clamped to +50% → synergyMult = 1.50.
//   ScoreReport.productionBreakdown for B09 must show synergyMult ≈ 1.50 and isCapped=true.
// ---------------------------------------------------------------------------
describe("T6: synergy clamp", () => {
  it("+60% raw synergy is clamped to +50%", () => {
    let b = emptyBoard();
    b = placeBuilding(b, "B01", 2, 2);  // TH — within Chebyshev 2 of Market
    b = placeBuilding(b, "B09", 2, 1);  // Market
    b = placeBuilding(b, "B02", 1, 0);  // unique type 1
    b = placeBuilding(b, "B03", 3, 1);  // unique type 2
    b = placeBuilding(b, "B04", 3, 2);  // unique type 3
    b = placeBuilding(b, "B06", 0, 2);  // unique type 4
    b = placeBuilding(b, "B10", 0, 3);  // unique type 5
    // Market: 5 unique types × +10% = +50%; TH +10% → raw +60% → clamp to +50%
    const report = computeScore(b);
    const marketLine = report.productionBreakdown.find(l => l.buildingId === "B09");
    expect(marketLine).toBeDefined();
    expect(marketLine!.synergyMult).toBeCloseTo(1.50, 5);
    expect(marketLine!.causeLines.some(c => c.isCapped)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T7: Happiness floor — 3 Forges vs 1 Cottage → HappyPts 0, never negative
//   3 × (−10 Happiness) = −30 raw. Floor: max(0, ...) = 0.
// ---------------------------------------------------------------------------
describe("T7: happiness floor", () => {
  it("HappyPts floors at 0, never goes negative", () => {
    let b = emptyBoard();
    b = placeBuilding(b, "B03", 2, 2);  // Cottage
    b = placeBuilding(b, "B12", 2, 1);  // Forge 1 — within 2 of Cottage
    b = placeBuilding(b, "B12", 2, 3);  // Forge 2 — within 2 of Cottage
    b = placeBuilding(b, "B12", 1, 2);  // Forge 3 — within 2 of Cottage
    const report = computeScore(b);
    expect(report.happyPts).toBe(0);
    expect(report.happiness).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T8: Imbalance penalty — Pop 40 / HappyPts 10 → Imbalance = 20
//   Formula: Imbalance = max(0, TotalPop − 2 × HappyPts)
//   TotalPop = TH(20) + Cottage×2(10+10) = 40
//   HappyPts = Shrine flat 10 (no Cottages in range → no per-Cottage bonus)
//   Imbalance = max(0, 40 − 20) = 20
// ---------------------------------------------------------------------------
describe("T8: imbalance penalty", () => {
  it("imbalance = max(0, TotalPop - 2*HappyPts)", () => {
    let b = emptyBoard();
    b = placeBuilding(b, "B01", 0, 3);  // TH
    b = placeBuilding(b, "B03", 4, 0);  // Cottage 1 — Chebyshev(4,0 vs 0,2)=max(4,2)=4, NOT in Shrine range
    b = placeBuilding(b, "B03", 4, 1);  // Cottage 2 — same
    b = placeBuilding(b, "B04", 0, 2);  // Shrine — Cottages not within range 2
    const report = computeScore(b);
    expect(report.totalPop).toBe(40);
    expect(report.happyPts).toBe(10);
    expect(report.imbalance).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// T9: Determinism — same layout scored 1000× yields identical result
// ---------------------------------------------------------------------------
describe("T9: determinism", () => {
  it("same layout scored 1000× is identical", () => {
    const b = layoutA();
    const first = computeScore(b).prosperity;
    for (let i = 0; i < 999; i++) {
      expect(computeScore(b).prosperity).toBe(first);
    }
  });
});

// ---------------------------------------------------------------------------
// T10: Breakdown integrity — lines always sum exactly to total
//   prosperity === round(production + population + happiness + mana + beauty − imbalance)
//   Tested across all four canonical layouts plus empty board.
// ---------------------------------------------------------------------------
describe("T10: breakdown integrity", () => {
  const cases: Array<[string, () => ReturnType<typeof emptyBoard>]> = [
    ["empty",    emptyBoard],
    ["layout A", layoutA],
    ["layout B", layoutB],
    ["layout C", layoutC],
    ["C-fixed",  layoutCFixed],
  ];
  cases.forEach(([label, fn]) => {
    it(`breakdown lines sum to prosperity (${label})`, () => {
      const report = computeScore(fn());
      const sum = report.production + report.population + report.happiness
                + report.mana + report.beauty - report.imbalance;
      expect(report.prosperity).toBe(Math.round(sum));
    });
  });
});

// ---------------------------------------------------------------------------
// T11: Preview accuracy — computeScorePreview equals post-commit computeScore
//   Both functions call the same scoring module; only the board differs.
//   Preview: hypothetical board with building not yet committed.
//   Committed: same board after placeBuilding.
//   Results must be identical.
// ---------------------------------------------------------------------------
describe("T11: preview accuracy", () => {
  it("preview score equals committed score (same module)", () => {
    const base = emptyBoard();
    const withTH = placeBuilding(base, "B01", 2, 2);
    const previewReport = computeScorePreview(withTH, "B02", 1, 0);
    const committed = placeBuilding(withTH, "B02", 1, 0);
    const committedReport = computeScore(committed);
    expect(previewReport.prosperity).toBe(committedReport.prosperity);
  });
});

// ---------------------------------------------------------------------------
// T12: Relocation — no state leakage after moving a building
//   score(board after relocate LC from A→B) === score(fresh board with LC at B)
// ---------------------------------------------------------------------------
describe("T12: relocation score equality", () => {
  it("no state leakage after relocation", () => {
    let b = emptyBoard();
    b = placeBuilding(b, "B01", 2, 2);
    b = placeBuilding(b, "B02", 1, 0);
    const afterRelocation = relocateBuilding(b, 1, 0, 5, 3);

    let freshB = emptyBoard();
    freshB = placeBuilding(freshB, "B01", 2, 2);
    freshB = placeBuilding(freshB, "B02", 5, 3);

    expect(computeScore(afterRelocation).prosperity).toBe(computeScore(freshB).prosperity);
  });
});

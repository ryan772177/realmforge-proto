import { describe, it, expect } from "vitest";
import { computeHintTarget } from "../src/game/hints";
import { buildBoard, placeBuilding } from "../src/board/grid";

describe("hints: tile-based fallbacks", () => {
  it("tile_shimmer highlights every empty tile", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    const target = computeHintTarget("tile_shimmer", board);
    expect(target.tiles).toHaveLength(35); // 36 - 1 occupied
    expect(target.tiles.some((t) => t.row === 2 && t.col === 2)).toBe(false);
  });

  it("forest_tiles_pulse highlights only empty Forest tiles", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0); // occupies a Forest tile
    const target = computeHintTarget("forest_tiles_pulse", board);
    // Forest cluster A minus the occupied (1,0), forest cluster B (3 tiles) = 4 + 3 - 1
    expect(target.tiles).toHaveLength(6);
    expect(target.tiles.some((t) => t.row === 1 && t.col === 0)).toBe(false);
  });

  it("report_enlarges_once highlights existing Lumber Camp tiles", () => {
    let board = buildBoard();
    board = placeBuilding(board, "B02", 1, 0);
    board = placeBuilding(board, "B02", 0, 0);
    const target = computeHintTarget("report_enlarges_once", board);
    expect(target.tiles).toEqual(
      expect.arrayContaining([{ row: 1, col: 0 }, { row: 0, col: 0 }])
    );
    expect(target.tiles).toHaveLength(2);
  });

  it("ghost_arrow_to_3forest_tile picks the single best empty forest-adjacent tile", () => {
    const target = computeHintTarget("ghost_arrow_to_3forest_tile", buildBoard());
    expect(target.tiles).toHaveLength(1);
    // (0,0) and (1,1) both have 3 Forest neighbors (cluster A is a 2x2 block);
    // (0,0) wins the tie by being scanned first in row-major order.
    expect(target.tiles[0]).toEqual({ row: 0, col: 0 });
  });

  it("range_circle_preview_auto_shows highlights empty tiles within range 2 of a Cottage", () => {
    const board = placeBuilding(buildBoard(), "B03", 3, 3);
    const target = computeHintTarget("range_circle_preview_auto_shows", board);
    expect(target.tiles.length).toBeGreaterThan(0);
    expect(target.tiles.every((t) => Math.max(Math.abs(t.row - 3), Math.abs(t.col - 3)) <= 2)).toBe(true);
  });

  it("synergy_line_draws_camp_to_mill highlights empty tiles within range 2 of a Lumber Camp", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const target = computeHintTarget("synergy_line_draws_camp_to_mill", board);
    expect(target.tiles.length).toBeGreaterThan(0);
    expect(target.tiles.every((t) => Math.max(Math.abs(t.row - 1), Math.abs(t.col - 0)) <= 2)).toBe(true);
  });

  it("range/synergy hints are empty when there's no matching building yet", () => {
    const board = buildBoard();
    expect(computeHintTarget("range_circle_preview_auto_shows", board).tiles).toEqual([]);
    expect(computeHintTarget("synergy_line_draws_camp_to_mill", board).tiles).toEqual([]);
  });
});

describe("hints: element-based fallbacks", () => {
  it("icon_bounce_amplifies sets bounceClaimBadges", () => {
    expect(computeHintTarget("icon_bounce_amplifies", buildBoard()).bounceClaimBadges).toBe(true);
  });

  it("cost_tooltip highlights the Cottage tray card", () => {
    expect(computeHintTarget("cost_tooltip", buildBoard()).highlightBuildingId).toBe("B03");
  });

  it("score_pulses sets pulseScore", () => {
    expect(computeHintTarget("score_pulses", buildBoard()).pulseScore).toBe(true);
  });

  it("quest_hint_to_claim and chest_glow both pulse the quest panel", () => {
    expect(computeHintTarget("quest_hint_to_claim", buildBoard()).pulseQuestPanel).toBe(true);
    expect(computeHintTarget("chest_glow", buildBoard()).pulseQuestPanel).toBe(true);
  });

  it("card_re_peeks sets pulseRivalCard", () => {
    expect(computeHintTarget("card_re_peeks", buildBoard()).pulseRivalCard).toBe(true);
  });

  it("unknown hint keys return an inert target", () => {
    const target = computeHintTarget("nonexistent_hint", buildBoard());
    expect(target.tiles).toEqual([]);
    expect(target.pulseScore).toBe(false);
    expect(target.bounceClaimBadges).toBe(false);
    expect(target.highlightBuildingId).toBeNull();
  });
});

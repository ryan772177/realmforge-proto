import type { BoardState, BuildingId, TerrainId } from "../scoring/types";
import { countAdjacentTerrain } from "./events";

// §10's fallback column names bespoke visual effects (tile shimmer, ghost
// arrow to the 3-Forest tile, icon bounce, range-circle preview, ...) —
// this maps each fallback key to a concrete, computed visual target instead
// of a plain-text stand-in.
export interface HintTarget {
  tiles: { row: number; col: number }[];
  pulseScore: boolean;
  pulseQuestPanel: boolean;
  pulseRivalCard: boolean;
  bounceClaimBadges: boolean;
  highlightBuildingId: BuildingId | null;
}

const NONE: HintTarget = {
  tiles: [],
  pulseScore: false,
  pulseQuestPanel: false,
  pulseRivalCard: false,
  bounceClaimBadges: false,
  highlightBuildingId: null,
};

function emptyTiles(board: BoardState): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const row of board.tiles) for (const t of row) if (!t.building) out.push({ row: t.row, col: t.col });
  return out;
}

function emptyTilesOfTerrain(board: BoardState, terrain: TerrainId): { row: number; col: number }[] {
  return emptyTiles(board).filter((t) => board.tiles[t.row]![t.col]!.terrain === terrain);
}

function tilesWithBuilding(board: BoardState, buildingId: BuildingId): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const row of board.tiles) for (const t of row) if (t.building === buildingId) out.push({ row: t.row, col: t.col });
  return out;
}

function chebyshev(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function emptyTilesWithinRangeOf(
  board: BoardState,
  centers: { row: number; col: number }[],
  range: number
): { row: number; col: number }[] {
  if (centers.length === 0) return [];
  return emptyTiles(board).filter((t) => centers.some((c) => chebyshev(c, t) <= range));
}

function bestForestTile(board: BoardState): { row: number; col: number }[] {
  let best: { row: number; col: number } | null = null;
  let bestCount = -1;
  for (const t of emptyTiles(board)) {
    const count = countAdjacentTerrain(board, t.row, t.col, "F");
    if (count > bestCount) {
      bestCount = count;
      best = t;
    }
  }
  return best && bestCount > 0 ? [best] : [];
}

export function computeHintTarget(hint: string, board: BoardState): HintTarget {
  switch (hint) {
    case "tile_shimmer":
      return { ...NONE, tiles: emptyTiles(board) };
    case "forest_tiles_pulse":
      return { ...NONE, tiles: emptyTilesOfTerrain(board, "F") };
    case "report_enlarges_once":
      // The report itself only exists mid-drag; nudge back to the Lumber
      // Camp that was just placed instead.
      return { ...NONE, tiles: tilesWithBuilding(board, "B02") };
    case "ghost_arrow_to_3forest_tile":
      return { ...NONE, tiles: bestForestTile(board) };
    case "icon_bounce_amplifies":
      return { ...NONE, bounceClaimBadges: true };
    case "cost_tooltip":
      return { ...NONE, highlightBuildingId: "B03" };
    case "score_pulses":
      return { ...NONE, pulseScore: true };
    case "range_circle_preview_auto_shows":
      return { ...NONE, tiles: emptyTilesWithinRangeOf(board, tilesWithBuilding(board, "B03"), 2) };
    case "synergy_line_draws_camp_to_mill":
      return { ...NONE, tiles: emptyTilesWithinRangeOf(board, tilesWithBuilding(board, "B02"), 2) };
    case "quest_hint_to_claim":
    case "chest_glow":
      return { ...NONE, pulseQuestPanel: true };
    case "card_re_peeks":
      return { ...NONE, pulseRivalCard: true };
    default:
      return NONE;
  }
}

import type { BoardState, BuildingId, ResourceId, TerrainId, Tile } from "../scoring/types";

// Shared event shape consumed by quests.ts and ftue.ts. Both systems react to
// the same in-game actions; this is the prototype's stand-in for the
// analytics event stream that task 11 (Day 6) will introduce — the event
// names below match the `analyticsEvent`/`triggerEvent` strings in
// config/ftue.json and config/quests.json so the two configs can be wired to
// the same runtime facts without duplicating detection logic per system.
export type GameEvent =
  | {
      type: "building_placed";
      buildingId: BuildingId;
      row: number;
      col: number;
      adjacentForestCount: number;
      terrainMultiplier: number;
      placedIds: ReadonlySet<BuildingId>;
      hasNeighborWithinRange: (buildingId: BuildingId, range: 1 | 2) => boolean;
    }
  | { type: "building_relocated" }
  | { type: "claim"; resource: ResourceId; cumulativeAmount: number }
  | { type: "score_updated"; prosperity: number; rivalRevealed: boolean; beatsRival: boolean }
  | { type: "rival_revealed" }
  | { type: "bonus_dwell" }
  | { type: "rival_dwell_or_open" }
  | { type: "breakdown_opened" }
  | { type: "reward_claimed"; questId: string };

function chebyshev(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function countAdjacentTerrain(
  board: BoardState,
  row: number,
  col: number,
  terrain: TerrainId
): number {
  let count = 0;
  for (const r of board.tiles) {
    for (const t of r) {
      if (t.row === row && t.col === col) continue;
      if (chebyshev({ row, col }, t) <= 1 && t.terrain === terrain) count++;
    }
  }
  return count;
}

export function hasNeighborBuildingWithinRange(
  board: BoardState,
  row: number,
  col: number,
  buildingId: BuildingId,
  range: 1 | 2
): boolean {
  for (const r of board.tiles) {
    for (const t of r) {
      if (t.row === row && t.col === col) continue;
      if (t.building === buildingId && chebyshev({ row, col }, t) <= range) return true;
    }
  }
  return false;
}

export function getPlacedBuildingIds(board: BoardState): Set<BuildingId> {
  const ids = new Set<BuildingId>();
  for (const r of board.tiles) {
    for (const t of r as Tile[]) {
      if (t.building) ids.add(t.building);
    }
  }
  return ids;
}

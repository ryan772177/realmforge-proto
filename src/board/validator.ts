import type { BoardState, BuildingId, ResourceId, Tile } from "../scoring/types";
import buildingsJson from "../../config/buildings.json";

export type RejectionReason = "out_of_bounds" | "occupied" | "needs_river" | "cannot_afford";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: RejectionReason; playerText: string };

interface BuildingCost { [resource: string]: number }
interface TerrainBonusDef { terrain: string; requirement?: boolean }
interface BuildingDef { id: string; cost: BuildingCost; terrainBonus: TerrainBonusDef | null }

const BUILDINGS = buildingsJson.buildings as unknown as BuildingDef[];

function getBuildingDef(id: BuildingId): BuildingDef {
  const def = BUILDINGS.find(b => b.id === id);
  if (!def) throw new Error(`Unknown building id: ${id}`);
  return def;
}

function adjacentTiles(board: BoardState, row: number, col: number): Tile[] {
  const result: Tile[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const tile = board.tiles[row + dr]?.[col + dc];
      if (tile) result.push(tile);
    }
  }
  return result;
}

export function validatePlacement(
  board: BoardState,
  buildingId: BuildingId,
  row: number,
  col: number,
  resources: Partial<Record<ResourceId, number>>
): ValidationResult {
  if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) {
    return { valid: false, reason: "out_of_bounds", playerText: "Out of bounds." };
  }

  const tile = board.tiles[row]![col]!;

  if (tile.building !== null) {
    return { valid: false, reason: "occupied", playerText: "Occupied." };
  }

  const def = getBuildingDef(buildingId);

  if (def.terrainBonus?.requirement) {
    const requiredTerrain = def.terrainBonus.terrain;
    const hasRequired = adjacentTiles(board, row, col).some(t => t.terrain === requiredTerrain);
    if (!hasRequired) {
      const terrainName = requiredTerrain === "R" ? "River" : requiredTerrain;
      return {
        valid: false,
        reason: "needs_river",
        playerText: `Needs a ${terrainName} beside it.`,
      };
    }
  }

  for (const [resource, amount] of Object.entries(def.cost)) {
    const have = resources[resource as ResourceId] ?? 0;
    if (have < (amount as number)) {
      return {
        valid: false,
        reason: "cannot_afford",
        playerText: `Not enough ${resource}.`,
      };
    }
  }

  return { valid: true };
}

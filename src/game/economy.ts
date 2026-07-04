import type { BoardState, BuildingId, ResourceId } from "../scoring/types";
import buildingsJson from "../../config/buildings.json";

export type Resources = Record<ResourceId, number>;
export type PendingAccrual = Record<string, Partial<Resources>>;

export const INITIAL_RESOURCES: Resources = {
  gold: 100, wood: 0, stone: 0, mana: 0, gems: 0,
};

// §D5: relocation costs 10 Gold post-FTUE; free during FTUE
export const RELOCATION_COST: Partial<Resources> = { gold: 10 };

// 10× real-time: 1 game-minute of output accrues in 6 real seconds (tunable)
export const ACCRUAL_SPEED = 10;

interface RawBuilding {
  id: string;
  cost: Partial<Record<string, number>>;
  baseOutput?: Partial<Record<string, number>>;
}

const RAW_BUILDINGS = buildingsJson.buildings as unknown as RawBuilding[];

function getRaw(id: BuildingId): RawBuilding | undefined {
  return RAW_BUILDINGS.find(b => b.id === id);
}

export function getBuildingCost(id: BuildingId): Partial<Resources> {
  const def = getRaw(id);
  if (!def) return {};
  const result: Partial<Resources> = {};
  for (const [k, v] of Object.entries(def.cost)) {
    if (v && v > 0) result[k as ResourceId] = v;
  }
  return result;
}

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return Object.entries(cost).every(
    ([k, v]) => !v || (resources[k as ResourceId] ?? 0) >= v
  );
}

// Returns null when any resource in cost exceeds available amount
export function deductCost(
  resources: Resources,
  cost: Partial<Resources>
): Resources | null {
  if (!canAfford(resources, cost)) return null;
  const result = { ...resources };
  for (const [k, v] of Object.entries(cost)) {
    if (v) result[k as ResourceId] = (result[k as ResourceId] ?? 0) - v;
  }
  return result;
}

// Advance accrual for all buildings on the board by dtMs milliseconds
export function tickAccrual(
  pending: PendingAccrual,
  board: BoardState,
  dtMs: number
): PendingAccrual {
  const result: PendingAccrual = { ...pending };
  for (const row of board.tiles) {
    for (const tile of row) {
      if (!tile.building) continue;
      const output = getRaw(tile.building)?.baseOutput;
      if (!output || Object.keys(output).length === 0) continue;
      const key = `${tile.row},${tile.col}`;
      const current = result[key] ?? {};
      const updated: Partial<Resources> = { ...current };
      for (const [res, perMin] of Object.entries(output)) {
        if (typeof perMin === "number" && perMin > 0) {
          const r = res as ResourceId;
          updated[r] = (updated[r] ?? 0) + (perMin * ACCRUAL_SPEED / 60_000) * dtMs;
        }
      }
      result[key] = updated;
    }
  }
  return result;
}

// True when a tile has ≥1 whole unit of any resource waiting to be claimed
export function hasPendingClaim(pending: PendingAccrual, tileKey: string): boolean {
  const acc = pending[tileKey];
  return acc !== undefined && Object.values(acc).some(v => (v ?? 0) >= 1);
}

// Move pending accrual from one tile key to another (used after relocation)
export function movePendingAccrual(
  pending: PendingAccrual,
  fromKey: string,
  toKey: string
): PendingAccrual {
  if (!pending[fromKey]) return pending;
  const result = { ...pending };
  result[toKey] = result[fromKey]!;
  delete result[fromKey];
  return result;
}

// Collect whole units from a tile; fractional remainder stays pending
export function claimTile(
  resources: Resources,
  pending: PendingAccrual,
  tileKey: string
): { resources: Resources; pending: PendingAccrual } {
  const acc = pending[tileKey];
  if (!acc) return { resources, pending };
  const newRes = { ...resources };
  const fractional: Partial<Resources> = {};
  for (const [k, v] of Object.entries(acc) as [ResourceId, number][]) {
    const whole = Math.floor(v);
    newRes[k] = (newRes[k] ?? 0) + whole;
    const frac = v - whole;
    if (frac > 0) fractional[k] = frac;
  }
  const newPending = { ...pending };
  if (Object.keys(fractional).length > 0) {
    newPending[tileKey] = fractional;
  } else {
    delete newPending[tileKey];
  }
  return { resources: newRes, pending: newPending };
}

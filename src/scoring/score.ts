import type {
  BoardState,
  BuildingConfig,
  BuildingId,
  CauseLine,
  ConflictDef,
  ScoreLineBreakdown,
  ScoreReport,
  SynergyConfig,
  Tile,
  TerrainId,
} from "./types";
import buildingsJson from "../../config/buildings.json";
import synergiesJson from "../../config/synergies.json";
import conflictsJson from "../../config/conflicts.json";
import terrainJson from "../../config/terrain.json";
import { placeBuilding } from "../board/grid";

// Literal implementation of §16.2/§17: Chebyshev distance, inclusive of the
// range boundary, applied uniformly with no building- or layout-specific
// exceptions. See docs/realmforge_reset.md §16 for the formula this encodes.

const BUILDINGS = buildingsJson.buildings as unknown as BuildingConfig[];
const SYNERGIES = synergiesJson.synergies as unknown as SynergyConfig[];
const CONFLICTS = conflictsJson.conflicts as unknown as ConflictDef[];
const BUILDING_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

const TERRAIN_NAMES = Object.fromEntries(
  Object.values(terrainJson.terrainTypes).map((t) => [t.id, t.name])
) as Record<TerrainId, string>;

interface Placement {
  tile: Tile;
  config: BuildingConfig;
}

function chebyshev(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function getPlacements(board: BoardState): Placement[] {
  const out: Placement[] = [];
  for (const row of board.tiles) {
    for (const tile of row) {
      if (!tile.building) continue;
      const config = BUILDING_BY_ID.get(tile.building);
      if (config) out.push({ tile, config });
    }
  }
  return out;
}

function tilesInRange(board: BoardState, center: { row: number; col: number }, range: number): Tile[] {
  const out: Tile[] = [];
  for (const row of board.tiles) {
    for (const tile of row) {
      if (tile.row === center.row && tile.col === center.col) continue;
      if (chebyshev(center, tile) <= range) out.push(tile);
    }
  }
  return out;
}

function capSuffix(isCapped: boolean): string {
  return isCapped ? " (MAX)" : "";
}

interface TerrainResult {
  mult: number;
  count: number;
  cap: number;
  rate: number;
  terrain: TerrainId;
}

function computeTerrainMult(board: BoardState, p: Placement): TerrainResult | null {
  const tb = p.config.terrainBonus;
  if (!tb || tb.rate === undefined) return null;
  const range = tb.scope === "adjacent" ? 1 : 2;
  const count = tilesInRange(board, p.tile, range).filter((t) => t.terrain === tb.terrain).length;
  const cappedCount = Math.min(count, tb.cap);
  return { mult: 1 + tb.rate * cappedCount, count, cap: tb.cap, rate: tb.rate, terrain: tb.terrain };
}

interface SynergyResult {
  clampedBonus: number;
  causeLines: CauseLine[];
}

function computeSynergy(board: BoardState, p: Placement): SynergyResult {
  const causeLines: CauseLine[] = [];
  let total = 0;

  for (const syn of SYNERGIES) {
    if (syn.type !== "output_percent") continue;

    let count: number;
    if (syn.target === "producers") {
      if (p.config.prosperityBase.production === undefined) continue;
      count = tilesInRange(board, p.tile, syn.range).filter((t) => t.building === syn.source).length;
    } else if (syn.target === "unique_types") {
      if (p.config.id !== syn.source) continue;
      const types = new Set(
        tilesInRange(board, p.tile, syn.range)
          .map((t) => t.building)
          .filter((b): b is BuildingId => b !== null)
      );
      count = types.size;
    } else {
      if (p.config.id !== syn.target) continue;
      count = tilesInRange(board, p.tile, syn.range).filter((t) => t.building === syn.source).length;
    }

    if (count <= 0) continue;
    const cap = syn.cap ?? Infinity;
    const cappedCount = Math.min(count, cap);
    const bonus = syn.bonus * cappedCount;
    const isCapped = cap !== Infinity && count >= cap;
    total += bonus;
    causeLines.push({
      text: syn.playerText + capSuffix(isCapped),
      delta: bonus,
      isConflict: false,
      isCapped,
    });
  }

  return { clampedBonus: Math.min(total, 0.5), causeLines };
}

export function computeScore(board: BoardState): ScoreReport {
  const placements = getPlacements(board);

  const productionBreakdown: ScoreLineBreakdown[] = [];
  const populationBreakdown: ScoreLineBreakdown[] = [];
  const happinessBreakdown: ScoreLineBreakdown[] = [];
  const manaBreakdown: ScoreLineBreakdown[] = [];
  const beautyBreakdown: ScoreLineBreakdown[] = [];

  let production = 0;
  let totalPop = 0;
  let happyPtsRaw = 0;
  let mana = 0;
  let beauty = 0;

  for (const p of placements) {
    const { config, tile } = p;
    const base = config.prosperityBase;

    if (config.id === "B01") {
      const flat = base.production ?? 0;
      production += flat;
      productionBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: flat,
        terrainMult: 1,
        synergyMult: 1,
        contribution: flat,
        causeLines: [],
      });
    } else if (base.production !== undefined) {
      const terrain = computeTerrainMult(board, p);
      const synergy = computeSynergy(board, p);
      const terrainMult = terrain?.mult ?? 1;
      const synergyMult = 1 + synergy.clampedBonus;
      const contribution = base.production * terrainMult * synergyMult;
      production += contribution;

      const causeLines = [...synergy.causeLines];
      if (terrain) {
        const cappedCount = Math.min(terrain.count, terrain.cap);
        const isCapped = terrain.count >= terrain.cap;
        causeLines.unshift({
          text: `+${Math.round(terrain.rate * 100)}% from ${TERRAIN_NAMES[terrain.terrain]} ×${cappedCount}${capSuffix(isCapped)}`,
          delta: terrain.rate * cappedCount,
          isConflict: false,
          isCapped,
        });
      }

      productionBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: base.production,
        terrainMult,
        synergyMult,
        contribution,
        causeLines,
      });
    }

    if (base.pop !== undefined) {
      totalPop += base.pop;
      populationBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: base.pop,
        terrainMult: 1,
        synergyMult: 1,
        contribution: base.pop * 2,
        causeLines: [],
      });
    }

    if (base.happiness !== undefined) {
      happyPtsRaw += base.happiness;
      happinessBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: base.happiness,
        terrainMult: 1,
        synergyMult: 1,
        contribution: base.happiness,
        causeLines: [],
      });
    }

    if (base.mana !== undefined) {
      const terrain = computeTerrainMult(board, p);
      const synergy = computeSynergy(board, p);
      const terrainMult = terrain?.mult ?? 1;
      const synergyMult = 1 + synergy.clampedBonus;
      const contribution = base.mana * terrainMult * synergyMult;
      mana += contribution;

      const causeLines = [...synergy.causeLines];
      if (terrain) {
        const cappedCount = Math.min(terrain.count, terrain.cap);
        const isCapped = terrain.count >= terrain.cap;
        causeLines.unshift({
          text: `+${Math.round(terrain.rate * 100)}% from ${TERRAIN_NAMES[terrain.terrain]} ×${cappedCount}${capSuffix(isCapped)}`,
          delta: terrain.rate * cappedCount,
          isConflict: false,
          isCapped,
        });
      }

      manaBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: base.mana,
        terrainMult,
        synergyMult,
        contribution,
        causeLines,
      });
    }

    if (config.springBonus) {
      const sb = config.springBonus;
      const adjacentSpring = tilesInRange(board, tile, 1).some((t) => t.terrain === sb.terrain);
      if (adjacentSpring) {
        mana += sb.bonus;
        manaBreakdown.push({
          buildingId: config.id,
          buildingName: config.name,
        row: tile.row,
        col: tile.col,
          baseValue: 0,
          terrainMult: 1,
          synergyMult: 1,
          contribution: sb.bonus,
          causeLines: [
            {
              text: `+${sb.bonus} Mana from nearby Mana Spring`,
              delta: sb.bonus,
              isConflict: false,
              isCapped: false,
            },
          ],
        });
      }
    }

    if (base.beauty !== undefined) {
      let value = base.beauty;
      const causeLines: CauseLine[] = [];
      const tb = config.terrainBonus;
      if (tb && tb.bonus !== undefined && tb.type === "beauty") {
        const range = tb.scope === "adjacent" ? 1 : 2;
        const count = tilesInRange(board, tile, range).filter((t) => t.terrain === tb.terrain).length;
        if (count > 0) {
          const delta = tb.bonus * count;
          value += delta;
          causeLines.push({
            text: `+${tb.bonus} Beauty per adjacent ${TERRAIN_NAMES[tb.terrain]} ×${count}`,
            delta,
            isConflict: false,
            isCapped: false,
          });
        }
      }
      for (const c of CONFLICTS) {
        if (c.type !== "beauty" || c.target !== config.id) continue;
        const count = tilesInRange(board, tile, c.range).filter((t) => t.building === c.source).length;
        if (count <= 0) continue;
        const delta = c.penalty * count;
        value += delta;
        causeLines.push({ text: c.playerText, delta, isConflict: true, isCapped: false });
      }
      const contribution = Math.max(0, value);
      beauty += contribution;
      beautyBreakdown.push({
        buildingId: config.id,
        buildingName: config.name,
        row: tile.row,
        col: tile.col,
        baseValue: base.beauty,
        terrainMult: 1,
        synergyMult: 1,
        contribution,
        causeLines,
      });
    }
  }

  for (const p of placements) {
    const causeLines: CauseLine[] = [];

    for (const syn of SYNERGIES) {
      if (syn.type !== "happiness" || syn.target !== p.config.id) continue;
      const count = tilesInRange(board, p.tile, syn.range).filter((t) => t.building === syn.source).length;
      if (count <= 0) continue;
      const cap = syn.cap ?? Infinity;
      const cappedCount = Math.min(count, cap);
      const delta = syn.bonus * cappedCount;
      const isCapped = cap !== Infinity && count >= cap;
      happyPtsRaw += delta;
      causeLines.push({ text: syn.playerText + capSuffix(isCapped), delta, isConflict: false, isCapped });
    }
    for (const c of CONFLICTS) {
      if (c.type !== "happiness" || c.target !== p.config.id) continue;
      const count = tilesInRange(board, p.tile, c.range).filter((t) => t.building === c.source).length;
      if (count <= 0) continue;
      const delta = c.penalty * count;
      happyPtsRaw += delta;
      causeLines.push({ text: c.playerText, delta, isConflict: true, isCapped: false });
    }

    if (causeLines.length > 0) {
      happinessBreakdown.push({
        buildingId: p.config.id,
        buildingName: p.config.name,
        row: p.tile.row,
        col: p.tile.col,
        baseValue: 0,
        terrainMult: 1,
        synergyMult: 1,
        contribution: causeLines.reduce((sum, c) => sum + c.delta, 0),
        causeLines,
      });
    }
  }

  const happyPts = Math.max(0, happyPtsRaw);
  const happiness = 2 * happyPts;
  const population = 2 * totalPop;
  const imbalance = Math.max(0, totalPop - 2 * happyPts);
  const prosperity = Math.round(production + population + happiness + mana + beauty - imbalance);

  return {
    prosperity,
    production,
    population,
    happiness,
    mana,
    beauty,
    imbalance,
    totalPop,
    happyPts,
    productionBreakdown,
    populationBreakdown,
    happinessBreakdown,
    manaBreakdown,
    beautyBreakdown,
  };
}

export function computeScorePreview(
  board: BoardState,
  buildingId: BuildingId,
  row: number,
  col: number
): ScoreReport {
  return computeScore(placeBuilding(board, buildingId, row, col));
}

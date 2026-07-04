export type TerrainId = "F" | "M" | "R" | "S" | "C";

export type BuildingId =
  | "B01" | "B02" | "B03" | "B04" | "B05" | "B06"
  | "B07" | "B08" | "B09" | "B10" | "B11" | "B12";

export interface Tile {
  row: number;
  col: number;
  terrain: TerrainId;
  building: BuildingId | null;
}

export interface BoardState {
  tiles: Tile[][];
  rows: number;
  cols: number;
}

export interface ScoreLineBreakdown {
  buildingId: BuildingId;
  buildingName: string;
  row: number;
  col: number;
  baseValue: number;
  terrainMult: number;
  synergyMult: number;
  contribution: number;
  causeLines: CauseLine[];
}

export interface CauseLine {
  text: string;
  delta: number;
  isConflict: boolean;
  isCapped: boolean;
}

export interface ScoreReport {
  prosperity: number;

  production: number;
  population: number;
  happiness: number;
  mana: number;
  beauty: number;
  imbalance: number;

  totalPop: number;
  happyPts: number;

  productionBreakdown: ScoreLineBreakdown[];
  populationBreakdown: ScoreLineBreakdown[];
  happinessBreakdown:  ScoreLineBreakdown[];
  manaBreakdown:       ScoreLineBreakdown[];
  beautyBreakdown:     ScoreLineBreakdown[];
}

export interface BuildingConfig {
  id: BuildingId;
  name: string;
  category: string;
  cost: Partial<Record<ResourceId, number>>;
  maxCount: number | null;
  baseOutput: Partial<Record<ResourceId, number>>;
  prosperityBase: {
    production?: number;
    pop?: number;
    happiness?: number;
    mana?: number;
    beauty?: number;
  };
  terrainBonus: TerrainBonusConfig | null;
  aura?: AuraConfig;
  springBonus?: SpringBonusConfig;
  neighborBonus: NeighborBonusConfig | null;
  neighborConflict: ConflictConfig[] | null;
  unlockStep: string;
  explanation: string;
}

export interface TerrainBonusConfig {
  terrain: TerrainId;
  rate?: number;
  bonus?: number;
  type?: string;
  cap: number;
  scope: "adjacent" | "range2";
  requirement?: boolean;
}

export interface AuraConfig {
  type: "output_percent" | "happiness";
  bonus: number;
  range: 1 | 2;
  cap: number | null;
  targets: BuildingId | "producers";
}

export interface SpringBonusConfig {
  terrain: TerrainId;
  bonus: number;
  type: string;
  scope: "adjacent";
}

export interface NeighborBonusConfig {
  source?: BuildingId | "unique_types";
  type?: string;
  bonus: number;
  range: 1 | 2;
  cap: number;
  direction: "received";
}

export interface ConflictConfig {
  source?: BuildingId;
  target?: BuildingId;
  penalty: number;
  type: "happiness" | "beauty";
  range: 1 | 2;
}

export type ResourceId = "gold" | "wood" | "stone" | "mana" | "gems";

export interface GameConfig {
  buildings: BuildingConfig[];
  terrainMap: TerrainId[][];
  synergies: SynergyConfig[];
  conflicts: ConflictDef[];
}

export interface SynergyConfig {
  id: string;
  source: string;
  target: string;
  type: "output_percent" | "happiness";
  bonus: number;
  range: 1 | 2;
  cap: number | null;
  playerText: string;
}

export interface ConflictDef {
  id: string;
  source: BuildingId;
  target: BuildingId;
  range: 1 | 2;
  penalty: number;
  type: "happiness" | "beauty";
  playerText: string;
}

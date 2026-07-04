import type { BoardState, BuildingId, TerrainId, Tile } from "../scoring/types";
import terrainConfig from "../../config/terrain.json";

export interface BuildBoardOptions {
  overrideTile?: { row: number; col: number; terrain: TerrainId };
}

const SOURCE_MAP = terrainConfig.map.tiles as TerrainId[][];
const ROWS = terrainConfig.map.rows;
const COLS = terrainConfig.map.cols;

function getTile(tiles: Tile[][], row: number, col: number): Tile {
  const tile = tiles[row]?.[col];
  if (!tile) throw new Error(`Tile (${row},${col}) out of range`);
  return tile;
}

export function buildBoard(options?: BuildBoardOptions): BoardState {
  const override = options?.overrideTile;
  const tiles: Tile[][] = SOURCE_MAP.map((rowTiles, r) =>
    rowTiles.map((terrain, c): Tile => ({
      row: r,
      col: c,
      terrain: (override && override.row === r && override.col === c)
        ? override.terrain
        : terrain,
      building: null,
    }))
  );
  return { tiles, rows: ROWS, cols: COLS };
}

export function placeBuilding(
  board: BoardState,
  buildingId: BuildingId,
  row: number,
  col: number
): BoardState {
  const tiles = board.tiles.map(r => r.map(t => ({ ...t })));
  getTile(tiles, row, col).building = buildingId;
  return { ...board, tiles };
}

export function relocateBuilding(
  board: BoardState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): BoardState {
  const buildingId = getTile(board.tiles, fromRow, fromCol).building;
  if (!buildingId) throw new Error(`No building at (${fromRow},${fromCol})`);
  const tiles = board.tiles.map(r => r.map(t => ({ ...t })));
  getTile(tiles, fromRow, fromCol).building = null;
  getTile(tiles, toRow, toCol).building = buildingId;
  return { ...board, tiles };
}

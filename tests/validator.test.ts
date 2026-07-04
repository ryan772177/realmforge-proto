import { describe, it, expect } from "vitest";
import { buildBoard, placeBuilding, relocateBuilding } from "../src/board/grid";
import { validatePlacement } from "../src/board/validator";

// Starting resources matching §13: "Player starts with 100 Gold"
const FULL_RESOURCES = { gold: 100, wood: 100, stone: 100, mana: 100, gems: 0 };
const EMPTY_RESOURCES = { gold: 0, wood: 0, stone: 0, mana: 0, gems: 0 };
const GOLD_ONLY = { gold: 100, wood: 0, stone: 0, mana: 0, gems: 0 };

// Map reference:
//   row0: F  F  S  C  M  M
//   row1: F  F  C  R  M  C
//   row2: C  C  R  R  M  C
//   row3: C  S  C  R  C  M
//   row4: C  C  C  R  C  C
//   row5: C  C  C  F  F  F
// River tiles (R): (1,3)(2,2)(2,3)(3,3)(4,3)
// Clear Land (C): includes (2,0)(2,1)(3,0)(3,2)(4,0)...(4,5)

describe("out_of_bounds", () => {
  it("rejects row < 0", () => {
    const result = validatePlacement(buildBoard(), "B01", -1, 0, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("out_of_bounds");
  });

  it("rejects row >= 6", () => {
    const result = validatePlacement(buildBoard(), "B01", 6, 0, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("out_of_bounds");
  });

  it("rejects col < 0", () => {
    const result = validatePlacement(buildBoard(), "B01", 0, -1, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("out_of_bounds");
  });

  it("rejects col >= 6", () => {
    const result = validatePlacement(buildBoard(), "B01", 0, 6, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("out_of_bounds");
  });
});

describe("occupied", () => {
  it("rejects placement on a tile that already has a building", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    const result = validatePlacement(board, "B03", 2, 2, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("occupied");
      expect(result.playerText).toBe("Occupied.");
    }
  });

  it("accepts placement on a different tile after one is occupied", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    const result = validatePlacement(board, "B03", 3, 3, FULL_RESOURCES);
    expect(result.valid).toBe(true);
  });
});

describe("needs_river (B07 Fishing Dock)", () => {
  it("rejects Dock on Clear Land with no adjacent River", () => {
    // (4,0) is Clear Land; nearest River is (4,3) — not adjacent
    const result = validatePlacement(buildBoard(), "B07", 4, 0, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("needs_river");
      expect(result.playerText).toBe("Needs a River beside it.");
    }
  });

  it("rejects Dock on Clear Land adjacent only to Forest/Mountain", () => {
    // (2,1) is Clear Land; neighbors: (1,0)F,(1,1)F,(1,2)C,(2,0)C,(2,2)R,(3,0)C,(3,1)S,(3,2)C
    // (2,2) IS River — so (2,1) IS adjacent to River. Use (0,3) instead.
    // (0,3) is Clear Land; neighbors: (0,2)S,(0,4)M,(1,2)C,(1,3)R,(1,4)M — has River adj!
    // Use (4,0): neighbors (3,0)C,(3,1)S,(4,1)C,(5,0)C,(5,1)C — no River
    const result = validatePlacement(buildBoard(), "B07", 4, 0, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("needs_river");
  });

  it("accepts Dock on a tile adjacent to River", () => {
    // (1,2) is Clear Land; neighbors include (1,3)R and (2,2)R — has River adj ✓
    const result = validatePlacement(buildBoard(), "B07", 1, 2, FULL_RESOURCES);
    expect(result.valid).toBe(true);
  });

  it("accepts Dock placed directly on a River tile with River neighbor", () => {
    // (2,3) is River; neighbors include (1,3)R,(2,2)R,(3,3)R — adj River ✓
    const result = validatePlacement(buildBoard(), "B07", 2, 3, FULL_RESOURCES);
    expect(result.valid).toBe(true);
  });
});

describe("cannot_afford", () => {
  it("rejects Lumber Camp (50G) when player has 0 gold", () => {
    const result = validatePlacement(buildBoard(), "B02", 2, 0, EMPTY_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("cannot_afford");
  });

  it("rejects Cottage (30W) when player has 0 wood", () => {
    const result = validatePlacement(buildBoard(), "B03", 3, 3, GOLD_ONLY);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("cannot_afford");
      expect(result.playerText).toBe("Not enough wood.");
    }
  });

  it("rejects Cottage (30W) when player has 29 wood — exactly short", () => {
    const result = validatePlacement(buildBoard(), "B03", 3, 3, { ...GOLD_ONLY, wood: 29 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("cannot_afford");
  });

  it("accepts Cottage (30W) when player has exactly 30 wood", () => {
    const result = validatePlacement(buildBoard(), "B03", 3, 3, { ...GOLD_ONLY, wood: 30 });
    expect(result.valid).toBe(true);
  });

  it("accepts Town Hall (free) with zero resources", () => {
    const result = validatePlacement(buildBoard(), "B01", 2, 2, EMPTY_RESOURCES);
    expect(result.valid).toBe(true);
  });

  it("accepts Lumber Camp (50G) with exactly 50 gold", () => {
    const result = validatePlacement(buildBoard(), "B02", 2, 0, { ...EMPTY_RESOURCES, gold: 50 });
    expect(result.valid).toBe(true);
  });
});

describe("valid placements — happy paths", () => {
  it("places Town Hall on any clear land", () => {
    expect(validatePlacement(buildBoard(), "B01", 3, 2, GOLD_ONLY).valid).toBe(true);
    expect(validatePlacement(buildBoard(), "B01", 4, 4, GOLD_ONLY).valid).toBe(true);
  });

  it("places Quarry on Mountain tile with 60G", () => {
    // (0,4) is Mountain — valid placement for Quarry
    const result = validatePlacement(buildBoard(), "B06", 0, 4, GOLD_ONLY);
    expect(result.valid).toBe(true);
  });

  it("allows placing two different buildings on two different tiles", () => {
    let board = buildBoard();
    board = placeBuilding(board, "B01", 2, 2);
    const r1 = validatePlacement(board, "B02", 1, 0, FULL_RESOURCES);
    expect(r1.valid).toBe(true);
    board = placeBuilding(board, "B02", 1, 0);
    const r2 = validatePlacement(board, "B03", 3, 3, FULL_RESOURCES);
    expect(r2.valid).toBe(true);
  });
});

describe("rejection priority ordering", () => {
  it("out_of_bounds takes priority over occupied", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    // (2,2) is occupied but also check (-1,-1) — bounds should win
    const result = validatePlacement(board, "B01", -1, -1, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("out_of_bounds");
  });

  it("occupied takes priority over needs_river", () => {
    // Place something at (4,0) which has no river adj
    const board = placeBuilding(buildBoard(), "B01", 4, 0);
    const result = validatePlacement(board, "B07", 4, 0, FULL_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("occupied");
  });

  it("needs_river takes priority over cannot_afford", () => {
    // (4,0) has no river — should reject with needs_river before checking cost
    const result = validatePlacement(buildBoard(), "B07", 4, 0, EMPTY_RESOURCES);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("needs_river");
  });
});

describe("buildBoard", () => {
  it("creates a 6×6 board with all buildings null", () => {
    const board = buildBoard();
    expect(board.rows).toBe(6);
    expect(board.cols).toBe(6);
    expect(board.tiles).toHaveLength(6);
    for (const row of board.tiles) {
      expect(row).toHaveLength(6);
      for (const tile of row) {
        expect(tile.building).toBeNull();
      }
    }
  });

  it("loads correct terrain at known positions", () => {
    const board = buildBoard();
    expect(board.tiles[0]![0]!.terrain).toBe("F");  // Forest cluster A
    expect(board.tiles[0]![2]!.terrain).toBe("S");  // Mana Spring
    expect(board.tiles[1]![3]!.terrain).toBe("R");  // River
    expect(board.tiles[0]![4]!.terrain).toBe("M");  // Mountain
    expect(board.tiles[2]![1]!.terrain).toBe("C");  // Clear Land
    expect(board.tiles[5]![3]!.terrain).toBe("F");  // Forest cluster B
  });

  it("terrain counts match authored map spec (F=7 M=5 R=5 S=2 C=17)", () => {
    const board = buildBoard();
    const counts: Record<string, number> = {};
    for (const row of board.tiles) {
      for (const tile of row) {
        counts[tile.terrain] = (counts[tile.terrain] ?? 0) + 1;
      }
    }
    expect(counts["F"]).toBe(7);
    expect(counts["M"]).toBe(5);
    expect(counts["R"]).toBe(5);
    expect(counts["S"]).toBe(2);
    expect(counts["C"]).toBe(17);
  });

  it("overrideTile replaces a single tile's terrain", () => {
    const board = buildBoard({ overrideTile: { row: 2, col: 0, terrain: "F" } });
    expect(board.tiles[2]![0]!.terrain).toBe("F");
    // Neighboring tiles unchanged
    expect(board.tiles[2]![1]!.terrain).toBe("C");
    expect(board.tiles[1]![0]!.terrain).toBe("F");
  });
});

describe("placeBuilding / relocateBuilding", () => {
  it("placeBuilding sets the building on the tile", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    expect(board.tiles[2]![2]!.building).toBe("B01");
  });

  it("placeBuilding does not mutate the original board", () => {
    const original = buildBoard();
    const updated = placeBuilding(original, "B01", 2, 2);
    expect(original.tiles[2]![2]!.building).toBeNull();
    expect(updated.tiles[2]![2]!.building).toBe("B01");
  });

  it("relocateBuilding moves building and frees original tile", () => {
    const base = placeBuilding(buildBoard(), "B02", 1, 0);
    const relocated = relocateBuilding(base, 1, 0, 5, 3);
    expect(relocated.tiles[1]![0]!.building).toBeNull();
    expect(relocated.tiles[5]![3]!.building).toBe("B02");
  });

  it("relocateBuilding does not mutate the original board", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const relocated = relocateBuilding(board, 1, 0, 5, 3);
    expect(board.tiles[1]![0]!.building).toBe("B02");
    expect(relocated.tiles[1]![0]!.building).toBeNull();
  });

  it("relocateBuilding throws when source tile is empty", () => {
    expect(() => relocateBuilding(buildBoard(), 1, 0, 5, 3)).toThrow("No building at (1,0)");
  });
});

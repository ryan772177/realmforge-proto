import { describe, it, expect } from "vitest";
import {
  canAfford, deductCost, tickAccrual, hasPendingClaim, claimTile,
  movePendingAccrual, getBuildingCost, INITIAL_RESOURCES, RELOCATION_COST,
} from "../src/game/economy";
import { buildBoard, placeBuilding } from "../src/board/grid";

describe("canAfford", () => {
  it("true when all resources sufficient", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 100 }, { gold: 50 })).toBe(true);
  });
  it("true when exactly enough", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 50 }, { gold: 50 })).toBe(true);
  });
  it("false when short by one", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 49 }, { gold: 50 })).toBe(false);
  });
  it("true for empty cost", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 0 }, {})).toBe(true);
  });
  it("handles multi-resource cost", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 30, wood: 40 }, { gold: 30, wood: 40 })).toBe(true);
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 30, wood: 39 }, { gold: 30, wood: 40 })).toBe(false);
  });
});

describe("deductCost", () => {
  it("returns updated resources when affordable", () => {
    const result = deductCost({ ...INITIAL_RESOURCES, gold: 100 }, { gold: 50 });
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(50);
  });
  it("returns null when cannot afford", () => {
    expect(deductCost({ ...INITIAL_RESOURCES, gold: 30 }, { gold: 50 })).toBeNull();
  });
  it("returns null exactly short", () => {
    expect(deductCost({ ...INITIAL_RESOURCES, gold: 49 }, { gold: 50 })).toBeNull();
  });
  it("deducts to zero when exactly enough", () => {
    expect(deductCost({ ...INITIAL_RESOURCES, gold: 50 }, { gold: 50 })!.gold).toBe(0);
  });
  it("deducts multi-resource cost", () => {
    const r = deductCost({ ...INITIAL_RESOURCES, wood: 60, gold: 30 }, { wood: 60, gold: 30 });
    expect(r!.wood).toBe(0);
    expect(r!.gold).toBe(0);
  });
  it("returns null when one of multi is short", () => {
    expect(deductCost({ ...INITIAL_RESOURCES, wood: 60, gold: 20 }, { wood: 60, gold: 30 })).toBeNull();
  });
  it("does not mutate original resources", () => {
    const original = { ...INITIAL_RESOURCES, gold: 100 };
    deductCost(original, { gold: 50 });
    expect(original.gold).toBe(100);
  });
});

describe("getBuildingCost", () => {
  it("Town Hall costs nothing", () => {
    const cost = getBuildingCost("B01");
    expect(Object.values(cost).every(v => !v || v === 0)).toBe(true);
  });
  it("Lumber Camp costs 50 gold", () => {
    expect(getBuildingCost("B02").gold).toBe(50);
  });
  it("Cottage costs 30 wood", () => {
    expect(getBuildingCost("B03").wood).toBe(30);
  });
});

describe("RELOCATION_COST", () => {
  it("is 10 gold", () => {
    expect(RELOCATION_COST.gold).toBe(10);
  });
  it("player with 10 gold can afford relocation", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 10 }, RELOCATION_COST)).toBe(true);
  });
  it("player with 9 gold cannot afford relocation", () => {
    expect(canAfford({ ...INITIAL_RESOURCES, gold: 9 }, RELOCATION_COST)).toBe(false);
  });
});

describe("tickAccrual", () => {
  it("Lumber Camp accrues wood at 10x speed", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    // 6000ms = 6 real seconds = 1 game-minute at 10x → should accrue 10 wood
    const pending = tickAccrual({}, board, 6000);
    expect(pending["1,0"]).toBeDefined();
    expect(pending["1,0"]!.wood ?? 0).toBeCloseTo(10, 1);
  });

  it("Town Hall accrues nothing (no baseOutput)", () => {
    const board = placeBuilding(buildBoard(), "B01", 2, 2);
    const pending = tickAccrual({}, board, 6000);
    expect(pending["2,2"]).toBeUndefined();
  });

  it("Sawmill accrues gold", () => {
    const board = placeBuilding(buildBoard(), "B05", 2, 1);
    // B05 baseOutput: 5 gold/min → at 10x: 5 gold in 6 real seconds
    const pending = tickAccrual({}, board, 6000);
    expect((pending["2,1"]?.gold ?? 0)).toBeCloseTo(5, 1);
  });

  it("accumulates across multiple ticks", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const p1 = tickAccrual({}, board, 3000);
    const p2 = tickAccrual(p1, board, 3000);
    expect((p2["1,0"]?.wood ?? 0)).toBeCloseTo(10, 1);
  });

  it("empty board produces no accrual", () => {
    const pending = tickAccrual({}, buildBoard(), 60000);
    expect(Object.keys(pending)).toHaveLength(0);
  });
});

describe("hasPendingClaim", () => {
  it("false when nothing accrued", () => {
    expect(hasPendingClaim({}, "1,0")).toBe(false);
  });
  it("false when accrued < 1 unit", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 100); // tiny tick
    expect(hasPendingClaim(pending, "1,0")).toBe(false);
  });
  it("true when ≥ 1 unit accrued", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 6000);
    expect(hasPendingClaim(pending, "1,0")).toBe(true);
  });
});

describe("claimTile", () => {
  it("adds whole units to resources", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 6000); // ~10 wood
    const { resources } = claimTile(INITIAL_RESOURCES, pending, "1,0");
    expect(resources.wood).toBe(10);
  });

  it("clears claimed tile from pending", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 6000);
    const { pending: newPending } = claimTile(INITIAL_RESOURCES, pending, "1,0");
    expect(hasPendingClaim(newPending, "1,0")).toBe(false);
  });

  it("preserves fractional remainder after claim", () => {
    // 600ms → LC: 10*10/60000*600 = 1.0 wood exactly... use 650ms for fraction
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 650); // ≈ 1.083 wood
    const { resources, pending: p2 } = claimTile(INITIAL_RESOURCES, pending, "1,0");
    expect(resources.wood).toBe(1);
    expect((p2["1,0"]?.wood ?? 0)).toBeGreaterThan(0);
    expect((p2["1,0"]?.wood ?? 0)).toBeLessThan(1);
  });

  it("no-op when nothing pending", () => {
    const { resources, pending } = claimTile(INITIAL_RESOURCES, {}, "1,0");
    expect(resources).toEqual(INITIAL_RESOURCES);
    expect(pending).toEqual({});
  });

  it("does not mutate original resources", () => {
    const board = placeBuilding(buildBoard(), "B02", 1, 0);
    const pending = tickAccrual({}, board, 6000);
    const original = { ...INITIAL_RESOURCES };
    claimTile(original, pending, "1,0");
    expect(original.wood).toBe(0);
  });
});

describe("movePendingAccrual", () => {
  it("moves accrual from source key to dest key", () => {
    const pending = { "1,0": { wood: 5 } };
    const result = movePendingAccrual(pending, "1,0", "5,3");
    expect(result["5,3"]).toEqual({ wood: 5 });
    expect(result["1,0"]).toBeUndefined();
  });

  it("no-op when source key is absent", () => {
    const pending = { "2,2": { gold: 3 } };
    const result = movePendingAccrual(pending, "1,0", "5,3");
    expect(result).toBe(pending); // same reference
  });
});

import { describe, it, expect } from "vitest";
import {
  initialQuestsState,
  applyGameEvent,
  claimQuest,
} from "../src/game/quests";
import type { GameEvent } from "../src/game/events";

function placed(
  buildingId: string,
  overrides: Partial<Extract<GameEvent, { type: "building_placed" }>> = {}
): GameEvent {
  return {
    type: "building_placed",
    buildingId: buildingId as never,
    row: 0,
    col: 0,
    adjacentForestCount: 0,
    terrainMultiplier: 1,
    placedIds: new Set([buildingId as never]),
    hasNeighborWithinRange: () => false,
    ...overrides,
  };
}

describe("quests: initial state", () => {
  it("only Q1 starts active, everything else locked", () => {
    const s = initialQuestsState();
    expect(s.status.Q1).toBe("active");
    expect(s.status.Q2).toBe("locked");
    expect(s.status.Q9).toBe("locked");
  });
});

describe("quests: Q1 -> Q2 chain", () => {
  it("Q1 completes on Town Hall placement, unlocking Q2", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    expect(s.status.Q1).toBe("completed");
    expect(s.status.Q2).toBe("active");
  });

  it("Q2 requires Lumber Camp adjacent to >=1 Forest", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 0 }));
    expect(s.status.Q2).toBe("active"); // not yet — no forest adjacency
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 1 }));
    expect(s.status.Q2).toBe("completed");
    expect(s.status.Q3).toBe("active");
  });
});

describe("quests: same event can cascade through a chain", () => {
  it("a single building_placed event can complete Q2 and Q3 together when it satisfies both", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01")); // Q1 -> completed, Q2 unlocked
    s = applyGameEvent(
      s,
      placed("B02", { adjacentForestCount: 3, terrainMultiplier: 1.6 }) // satisfies both Q2 and Q3 at once
    );
    expect(s.status.Q2).toBe("completed");
    expect(s.status.Q3).toBe("completed");
    expect(s.status.Q4).toBe("active");
  });
});

describe("quests: Q3 bonus stacking", () => {
  it("requires a terrain multiplier of at least 1.40 on a Lumber Camp", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 1 }));
    expect(s.status.Q3).toBe("active");
    s = applyGameEvent(s, placed("B02", { terrainMultiplier: 1.2 }));
    expect(s.status.Q3).toBe("active"); // below threshold
    s = applyGameEvent(s, placed("B02", { terrainMultiplier: 1.4 }));
    expect(s.status.Q3).toBe("completed");
    expect(s.status.Q4).toBe("active");
  });
});

describe("quests: Q4 relocation", () => {
  it("completes on any building_relocated event", () => {
    let s = initialQuestsState();
    s.status.Q4 = "active"; // simulate having reached this point in the chain
    s = applyGameEvent(s, { type: "building_relocated" });
    expect(s.status.Q4).toBe("completed");
    expect(s.status.Q5).toBe("active");
  });
});

describe("quests: Q5 auto-claims (null reward)", () => {
  it("collecting 30 Wood completes and auto-claims Q5", () => {
    let s = initialQuestsState();
    s.status.Q5 = "active";
    s = applyGameEvent(s, { type: "claim", resource: "wood", cumulativeAmount: 10 });
    expect(s.status.Q5).toBe("active");
    s = applyGameEvent(s, { type: "claim", resource: "wood", cumulativeAmount: 30 });
    expect(s.status.Q5).toBe("claimed");
    expect(s.status.Q6).toBe("active");
  });
});

describe("quests: Q6 all_placed", () => {
  it("requires both Cottage and Shrine to have been placed", () => {
    let s = initialQuestsState();
    s.status.Q6 = "active";
    s = applyGameEvent(s, placed("B03", { placedIds: new Set(["B03"] as never[]) }));
    expect(s.status.Q6).toBe("active");
    s = applyGameEvent(s, placed("B04", { placedIds: new Set(["B01", "B02", "B03", "B04"] as never[]) }));
    expect(s.status.Q6).toBe("completed");
    expect(s.status.Q7).toBe("active");
  });
});

describe("quests: Q7/Q10 score thresholds", () => {
  it("Q7 completes at prosperity >= 250", () => {
    let s = initialQuestsState();
    s.status.Q7 = "active";
    s = applyGameEvent(s, { type: "score_updated", prosperity: 200, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q7).toBe("active");
    s = applyGameEvent(s, { type: "score_updated", prosperity: 250, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q7).toBe("completed");
    expect(s.status.Q8).toBe("active");
  });

  it("Q10 completes at prosperity >= 500", () => {
    let s = initialQuestsState();
    s.status.Q10 = "active";
    s = applyGameEvent(s, { type: "score_updated", prosperity: 499, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q10).toBe("active");
    s = applyGameEvent(s, { type: "score_updated", prosperity: 500, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q10).toBe("completed");
  });
});

describe("quests: Q8 synergy neighbor", () => {
  it("requires a Lumber Camp within range 2 of the placed Sawmill", () => {
    let s = initialQuestsState();
    s.status.Q8 = "active";
    s = applyGameEvent(s, placed("B05", { hasNeighborWithinRange: () => false }));
    expect(s.status.Q8).toBe("active");
    s = applyGameEvent(s, placed("B05", { hasNeighborWithinRange: (id, range) => id === "B02" && range === 2 }));
    expect(s.status.Q8).toBe("completed");
  });
});

describe("quests: Q9 rival_revealed special unlock", () => {
  it("Q9 stays locked until a rival_revealed event fires, independent of the Q1-Q8 chain", () => {
    let s = initialQuestsState();
    expect(s.status.Q9).toBe("locked");
    s = applyGameEvent(s, { type: "score_updated", prosperity: 9999, rivalRevealed: false, beatsRival: true });
    expect(s.status.Q9).toBe("locked"); // still locked, no reveal yet
    s = applyGameEvent(s, { type: "rival_revealed" });
    expect(s.status.Q9).toBe("active");
    s = applyGameEvent(s, { type: "score_updated", prosperity: 500, rivalRevealed: true, beatsRival: true });
    expect(s.status.Q9).toBe("completed");
  });
});

describe("quests: claim flow", () => {
  it("claiming a completed quest transitions it to claimed and returns its reward", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    expect(s.status.Q1).toBe("completed");
    const { state, reward } = claimQuest(s, "Q1");
    expect(state.status.Q1).toBe("claimed");
    expect(reward).toEqual({ gold: 50 });
  });

  it("claiming a quest that isn't completed yet is a no-op", () => {
    const s = initialQuestsState();
    const { state, reward } = claimQuest(s, "Q2");
    expect(state).toBe(s);
    expect(reward).toBeNull();
  });
});

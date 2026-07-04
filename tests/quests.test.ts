import { describe, it, expect } from "vitest";
import {
  initialQuestsState,
  applyGameEvent,
  claimQuest,
  newlyEnteredCompletedOrClaimed,
  newlyAutoClaimedGold,
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
  it("Q1 completes (and auto-claims — plain gold reward, not a chest) on Town Hall placement, unlocking Q2", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    expect(s.status.Q1).toBe("claimed");
    expect(s.status.Q2).toBe("active");
  });

  it("Q2 requires Lumber Camp adjacent to >=1 Forest, and auto-claims on completion", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 0 }));
    expect(s.status.Q2).toBe("active"); // not yet — no forest adjacency
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 1 }));
    expect(s.status.Q2).toBe("claimed");
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
    expect(s.status.Q2).toBe("claimed");
    expect(s.status.Q3).toBe("claimed");
    expect(s.status.Q4).toBe("active");
  });

  it("newlyEnteredCompletedOrClaimed catches a quest that cascades straight from locked to completed", () => {
    // Regression: a diff that only checked `before === "active"` missed Q3
    // here, since Q3's *before* status was "locked" (it only became "active"
    // and immediately "completed" within this same fold) — found live via a
    // real analytics export where quest_completed never fired for Q3.
    let s = initialQuestsState();
    const before = s.status;
    s = applyGameEvent(s, placed("B01"));
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 3, terrainMultiplier: 1.6 }));
    const newlyCompleted = newlyEnteredCompletedOrClaimed(before, s.status);
    expect(newlyCompleted).toEqual(expect.arrayContaining(["Q1", "Q2", "Q3"]));
  });

  it("does not re-flag a quest that was already completed/claimed before this diff", () => {
    let s = initialQuestsState();
    s = applyGameEvent(s, placed("B01"));
    const afterQ1 = s.status;
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 1 }));
    const newlyCompleted = newlyEnteredCompletedOrClaimed(afterQ1, s.status);
    expect(newlyCompleted).toEqual(["Q2"]);
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
    expect(s.status.Q3).toBe("claimed");
    expect(s.status.Q4).toBe("active");
  });
});

describe("quests: Q4 relocation", () => {
  it("completes (and auto-claims) on any building_relocated event", () => {
    let s = initialQuestsState();
    s.status.Q4 = "active"; // simulate having reached this point in the chain
    s = applyGameEvent(s, { type: "building_relocated" });
    expect(s.status.Q4).toBe("claimed");
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
  it("requires both Cottage and Shrine to have been placed, and auto-claims", () => {
    let s = initialQuestsState();
    s.status.Q6 = "active";
    s = applyGameEvent(s, placed("B03", { placedIds: new Set(["B03"] as never[]) }));
    expect(s.status.Q6).toBe("active");
    s = applyGameEvent(s, placed("B04", { placedIds: new Set(["B01", "B02", "B03", "B04"] as never[]) }));
    expect(s.status.Q6).toBe("claimed");
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
  it("requires a Lumber Camp within range 2 of the placed Sawmill, and auto-claims", () => {
    let s = initialQuestsState();
    s.status.Q8 = "active";
    s = applyGameEvent(s, placed("B05", { hasNeighborWithinRange: () => false }));
    expect(s.status.Q8).toBe("active");
    s = applyGameEvent(s, placed("B05", { hasNeighborWithinRange: (id, range) => id === "B02" && range === 2 }));
    expect(s.status.Q8).toBe("claimed");
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

describe("quests: claim flow (chest quests only — Q1/Q2/etc. now auto-claim)", () => {
  it("a chest quest (Q7) stays 'completed' until manually claimed, then returns its reward", () => {
    let s = initialQuestsState();
    s.status.Q7 = "active";
    s = applyGameEvent(s, { type: "score_updated", prosperity: 250, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q7).toBe("completed"); // chest reward — not auto-claimed
    const { state, reward } = claimQuest(s, "Q7");
    expect(state.status.Q7).toBe("claimed");
    expect(reward).toEqual({ gold: 100 });
  });

  it("claiming a quest that isn't completed yet is a no-op", () => {
    const s = initialQuestsState();
    const { state, reward } = claimQuest(s, "Q2");
    expect(state).toBe(s);
    expect(reward).toBeNull();
  });
});

describe("quests: newlyAutoClaimedGold", () => {
  it("sums gold from quests that auto-claimed between two snapshots", () => {
    let s = initialQuestsState();
    const before = s.status;
    s = applyGameEvent(s, placed("B01")); // Q1 auto-claims: 50 gold
    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 3, terrainMultiplier: 1.6 })); // Q2 (20) + Q3 (30)
    expect(newlyAutoClaimedGold(before, s.status)).toBe(100);
  });

  it("does not count chest quests (manual claim path handles those separately)", () => {
    let s = initialQuestsState();
    s.status.Q7 = "active";
    const before = s.status;
    s = applyGameEvent(s, { type: "score_updated", prosperity: 250, rivalRevealed: false, beatsRival: false });
    expect(s.status.Q7).toBe("completed");
    expect(newlyAutoClaimedGold(before, s.status)).toBe(0);
  });

  it("returns 0 when nothing newly auto-claimed", () => {
    const s = initialQuestsState();
    expect(newlyAutoClaimedGold(s.status, s.status)).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  initialFtueState,
  applyGameEvent,
  isBuildingUnlocked,
  isScoreVisible,
  isResourceBarVisible,
  isRivalVisible,
  isQuestPanelVisible,
  isFreeRelocation,
  markFallbackShown,
} from "../src/game/ftue";
import type { GameEvent } from "../src/game/events";

function placed(buildingId: string, extra: Partial<Extract<GameEvent, { type: "building_placed" }>> = {}): GameEvent {
  return {
    type: "building_placed",
    buildingId: buildingId as never,
    row: 0,
    col: 0,
    adjacentForestCount: 0,
    terrainMultiplier: 1,
    placedIds: new Set([buildingId as never]),
    hasNeighborWithinRange: () => false,
    ...extra,
  };
}

describe("ftue: full 12-step sequence", () => {
  it("advances through every step in order given the matching event for each, then goes inactive", () => {
    let s = initialFtueState();
    expect(s.stepIndex).toBe(1);
    expect(s.active).toBe(true);

    s = applyGameEvent(s, placed("B01"));
    expect(s.stepIndex).toBe(2);

    s = applyGameEvent(s, placed("B02", { adjacentForestCount: 1 }));
    expect(s.stepIndex).toBe(3);

    s = applyGameEvent(s, { type: "bonus_dwell" });
    expect(s.stepIndex).toBe(4);

    s = applyGameEvent(s, { type: "building_relocated" });
    expect(s.stepIndex).toBe(5);

    s = applyGameEvent(s, { type: "claim", resource: "wood", cumulativeAmount: 30 });
    expect(s.stepIndex).toBe(6);

    s = applyGameEvent(s, placed("B03"));
    expect(s.stepIndex).toBe(7);

    s = applyGameEvent(s, { type: "breakdown_opened" });
    expect(s.stepIndex).toBe(8);

    s = applyGameEvent(s, placed("B04", { hasNeighborWithinRange: (id, r) => id === "B03" && r === 2 }));
    expect(s.stepIndex).toBe(9);

    s = applyGameEvent(s, placed("B05", { hasNeighborWithinRange: (id, r) => id === "B02" && r === 2 }));
    expect(s.stepIndex).toBe(10);

    s = applyGameEvent(s, { type: "score_updated", prosperity: 250, rivalRevealed: false, beatsRival: false });
    expect(s.stepIndex).toBe(11);

    s = applyGameEvent(s, { type: "rival_dwell_or_open" });
    expect(s.stepIndex).toBe(12);
    expect(s.active).toBe(true);

    s = applyGameEvent(s, { type: "reward_claimed", questId: "Q7" });
    expect(s.active).toBe(false);
    expect(s.stepIndex).toBe(12);
  });

  it("does not advance on an event that doesn't match the current step", () => {
    let s = initialFtueState();
    s = applyGameEvent(s, placed("B02")); // wrong building for step 1
    expect(s.stepIndex).toBe(1);
    s = applyGameEvent(s, { type: "score_updated", prosperity: 9999, rivalRevealed: false, beatsRival: false });
    expect(s.stepIndex).toBe(1);
  });

  it("ignores events entirely once inactive", () => {
    let s = { active: false, stepIndex: 12, fallbackShown: false };
    s = applyGameEvent(s, placed("B01"));
    expect(s).toEqual({ active: false, stepIndex: 12, fallbackShown: false });
  });
});

describe("ftue: fallback flag", () => {
  it("markFallbackShown is idempotent and only flips once", () => {
    let s = initialFtueState();
    expect(s.fallbackShown).toBe(false);
    s = markFallbackShown(s);
    expect(s.fallbackShown).toBe(true);
    const again = markFallbackShown(s);
    expect(again).toBe(s); // same reference, no-op
  });

  it("resets on step advance", () => {
    let s = initialFtueState();
    s = markFallbackShown(s);
    s = applyGameEvent(s, placed("B01"));
    expect(s.fallbackShown).toBe(false);
  });
});

describe("ftue: building unlock gating", () => {
  it("gates ftue_N buildings by step index while active", () => {
    const s = { active: true, stepIndex: 5, fallbackShown: false };
    expect(isBuildingUnlocked("ftue_1", s)).toBe(true);
    expect(isBuildingUnlocked("ftue_6", s)).toBe(false);
    expect(isBuildingUnlocked("post_ftue", s)).toBe(false);
  });

  it("unlocks everything once FTUE is inactive", () => {
    const s = { active: false, stepIndex: 12, fallbackShown: false };
    expect(isBuildingUnlocked("ftue_9", s)).toBe(true);
    expect(isBuildingUnlocked("post_ftue", s)).toBe(true);
  });
});

describe("ftue: staged visibility", () => {
  it("score appears at step 2, resources at step 5, rival at step 11, quests at step 12", () => {
    const at = (stepIndex: number) => ({ active: true, stepIndex, fallbackShown: false });
    expect(isScoreVisible(at(1))).toBe(false);
    expect(isScoreVisible(at(2))).toBe(true);
    expect(isResourceBarVisible(at(4))).toBe(false);
    expect(isResourceBarVisible(at(5))).toBe(true);
    expect(isRivalVisible(at(10))).toBe(false);
    expect(isRivalVisible(at(11))).toBe(true);
    expect(isQuestPanelVisible(at(11))).toBe(false);
    expect(isQuestPanelVisible(at(12))).toBe(true);
  });
});

describe("ftue: free relocation window", () => {
  it("relocation is free through step 12 while active, and after FTUE ends it's no longer 'free' via this flag", () => {
    expect(isFreeRelocation({ active: true, stepIndex: 4, fallbackShown: false })).toBe(true);
    expect(isFreeRelocation({ active: true, stepIndex: 12, fallbackShown: false })).toBe(true);
    expect(isFreeRelocation({ active: false, stepIndex: 12, fallbackShown: false })).toBe(false);
  });
});

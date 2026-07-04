import type { BuildingId, ResourceId } from "../scoring/types";
import type { GameEvent } from "./events";
import questsJson from "../../config/quests.json";

export type QuestId = string;
export type QuestStatus = "locked" | "active" | "completed" | "claimed";

export interface QuestDef {
  id: QuestId;
  objective: string;
  reward: Partial<Record<ResourceId, number> & { type: string }> | null;
  systemTaught: string;
  triggerEvent: string;
  triggerCondition: Record<string, unknown>;
  completionEvent: string;
  unlocksAfter: string | null;
  note?: string;
}

const QUESTS = questsJson.quests as unknown as QuestDef[];
const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export interface QuestsState {
  status: Record<QuestId, QuestStatus>;
}

export function initialQuestsState(): QuestsState {
  const status: Record<QuestId, QuestStatus> = {};
  for (const q of QUESTS) {
    status[q.id] = q.unlocksAfter === null ? "active" : "locked";
  }
  return { status };
}

export function allQuestDefs(): QuestDef[] {
  return QUESTS;
}

export function getQuestDef(id: QuestId): QuestDef | undefined {
  return QUEST_BY_ID.get(id);
}

function matchesCondition(q: QuestDef, event: GameEvent): boolean {
  if (event.type !== q.triggerEvent) return false;
  const cond = q.triggerCondition;

  switch (event.type) {
    case "building_placed": {
      const buildingId = cond.building_id as BuildingId | undefined;
      if (buildingId && event.buildingId !== buildingId) return false;

      const adjacency = cond.adjacency as { terrain: string; min: number } | undefined;
      if (adjacency && adjacency.terrain === "F" && event.adjacentForestCount < adjacency.min) return false;

      const terrainMultiplierMin = cond.terrain_multiplier_min as number | undefined;
      if (terrainMultiplierMin !== undefined && event.terrainMultiplier < terrainMultiplierMin) return false;

      const allPlaced = cond.all_placed as BuildingId[] | undefined;
      if (allPlaced && !allPlaced.every((id) => event.placedIds.has(id))) return false;

      const neighbor = cond.neighbor as { building_id: BuildingId; range: 1 | 2 } | undefined;
      if (neighbor && !event.hasNeighborWithinRange(neighbor.building_id, neighbor.range)) return false;

      return true;
    }
    case "building_relocated":
      return true;
    case "claim": {
      const resource = cond.resource as ResourceId | undefined;
      if (resource && event.resource !== resource) return false;
      const cumulativeMin = cond.cumulative_min as number | undefined;
      if (cumulativeMin !== undefined && event.cumulativeAmount < cumulativeMin) return false;
      return true;
    }
    case "score_updated": {
      const prosperityMin = cond.prosperity_min as number | undefined;
      if (prosperityMin !== undefined && event.prosperity < prosperityMin) return false;
      const beatsRival = cond.beats_rival as boolean | undefined;
      if (beatsRival && !event.beatsRival) return false;
      return true;
    }
    default:
      return false;
  }
}

function unlockDependents(status: Record<QuestId, QuestStatus>): void {
  for (const q of QUESTS) {
    if (!q.unlocksAfter || q.unlocksAfter === "rival_revealed") continue;
    if (status[q.id] !== "locked") continue;
    const prereq = status[q.unlocksAfter];
    if (prereq === "completed" || prereq === "claimed") {
      status[q.id] = "active";
    }
  }
}

// Pure reducer: applies one GameEvent to quest state, completing any active
// quest whose trigger matches, then unlocking dependents.
//
// Reward auto-claim: a quest auto-claims immediately on completion unless its
// reward is a "chest" (Q7/Q9/Q10) — those stay a deliberate manual tap. This
// matters because the Quest Panel (the only UI that shows a "Claim" button)
// doesn't render until FTUE step 12, but Q1-Q4/Q6/Q8 routinely complete well
// before that. Without auto-claim, a player who explores even slightly off
// the exact minimal-spend path (starting gold is spent to the exact gold
// down to Lumber Camp + Shrine + Sawmill = 100G, zero margin) can get soft-
// locked: gold earned, no way to reach it, no way to afford the next
// building. Found via a real playtest session. Chest quests still require
// the player's tap — Q7's claim is also the specific event that ends FTUE
// step 12, so it can't auto-fire without breaking that transition.
export function applyGameEvent(state: QuestsState, event: GameEvent): QuestsState {
  const status = { ...state.status };
  let anyChanged = false;

  if (event.type === "rival_revealed") {
    for (const q of QUESTS) {
      if (q.unlocksAfter === "rival_revealed" && status[q.id] === "locked") {
        status[q.id] = "active";
        anyChanged = true;
      }
    }
  }

  // Fixed-point pass: a single event can complete a quest whose completion
  // unlocks the *next* quest in the same chain (e.g. Q2's placement event
  // also satisfies Q3's stricter condition) — keep unlocking + matching
  // against this same event until a full pass makes no further change.
  let changedThisPass = true;
  while (changedThisPass) {
    changedThisPass = false;
    unlockDependents(status);

    for (const q of QUESTS) {
      if (status[q.id] !== "active") continue;
      if (matchesCondition(q, event)) {
        const isChest = q.reward?.type === "chest";
        status[q.id] = q.reward === null || !isChest ? "claimed" : "completed";
        changedThisPass = true;
      }
    }

    if (changedThisPass) anyChanged = true;
  }

  return anyChanged ? { status } : state;
}

// Sum of gold from quests that just auto-claimed (transitioned straight to
// "claimed" between two status snapshots) — App.tsx grants this to the
// player's resources in the same update, since there's no manual claim step
// for these to hook the reward-grant into.
export function newlyAutoClaimedGold(
  before: Record<QuestId, QuestStatus>,
  after: Record<QuestId, QuestStatus>
): number {
  let total = 0;
  for (const id of Object.keys(after)) {
    if (before[id] !== "claimed" && after[id] === "claimed") {
      total += QUEST_BY_ID.get(id)?.reward?.gold ?? 0;
    }
  }
  return total;
}

// For analytics: which quests newly entered completed/claimed between two
// status snapshots. NOT just "was active" — the fixed-point loop above can
// cascade a quest straight from "locked" to "completed" within one event
// (Q2's completion unlocking Q3 in the same pass, which then also matches),
// so anything that wasn't already completed/claimed counts as "newly" so.
export function newlyEnteredCompletedOrClaimed(
  before: Record<QuestId, QuestStatus>,
  after: Record<QuestId, QuestStatus>
): QuestId[] {
  return Object.keys(after).filter((id) => {
    const was = before[id];
    const now = after[id];
    return was !== "completed" && was !== "claimed" && (now === "completed" || now === "claimed");
  });
}

export interface ClaimResult {
  state: QuestsState;
  reward: Partial<Record<ResourceId, number>> | null;
}

export function claimQuest(state: QuestsState, questId: QuestId): ClaimResult {
  if (state.status[questId] !== "completed") return { state, reward: null };
  const q = QUEST_BY_ID.get(questId);
  if (!q) return { state, reward: null };

  const status = { ...state.status, [questId]: "claimed" as QuestStatus };
  unlockDependents(status);

  const reward: Partial<Record<ResourceId, number>> | null = q.reward
    ? Object.fromEntries(Object.entries(q.reward).filter(([k]) => k !== "type")) as Partial<Record<ResourceId, number>>
    : null;

  return { state: { status }, reward };
}

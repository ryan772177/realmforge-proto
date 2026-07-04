import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { buildBoard, placeBuilding, relocateBuilding } from "../src/board/grid";
import { initialFtueState } from "../src/game/ftue";
import { initialQuestsState } from "../src/game/quests";
import { revealRival } from "../src/game/rival";
import { INITIAL_RESOURCES } from "../src/game/economy";
import {
  serializeSave, deserializeSave, saveGame, loadGame, clearSave,
} from "../src/game/save";
import type { SaveState } from "../src/game/save";

function sampleState(): SaveState {
  let board = buildBoard();
  board = placeBuilding(board, "B01", 2, 2);
  board = placeBuilding(board, "B02", 1, 0);
  board = relocateBuilding(board, 1, 0, 1, 1);

  return {
    board,
    resources: { ...INITIAL_RESOURCES, gold: 42, wood: 17 },
    pendingAccrual: { "1,1": { wood: 3.25 } },
    ftue: { ...initialFtueState(), stepIndex: 6 },
    quests: initialQuestsState(),
    rival: revealRival("seed-save", 306),
    totalWoodClaimed: 33,
    relocationCount: 1,
    seed: "seed-save",
    savedAt: 1700000000000,
    sessionCount: 2,
    rivalBeatenPendingComeback: false,
  };
}

describe("save: pure round-trip", () => {
  it("deserialize(serialize(state)) is deep-equal to the original state", () => {
    const state = sampleState();
    const roundTripped = deserializeSave(serializeSave(state));
    expect(roundTripped).toEqual(state);
  });

  it("returns null for garbage input instead of throwing", () => {
    expect(deserializeSave("{not valid json")).toBeNull();
    expect(deserializeSave("")).toBeNull();
  });
});

// The project's vitest config runs in a plain Node environment (no DOM), so
// there's no real localStorage global — provide a minimal in-memory stand-in
// rather than pulling in jsdom for one test file.
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    } as Storage;
  }
});

describe("save: localStorage round-trip", () => {
  beforeEach(() => {
    clearSave();
  });

  it("saveGame then loadGame produces a byte-identical realm", () => {
    const state = sampleState();
    saveGame(state);
    const loaded = loadGame();
    expect(loaded).toEqual(state);
  });

  it("loadGame returns null when nothing has been saved", () => {
    expect(loadGame()).toBeNull();
  });

  it("clearSave removes the saved state", () => {
    saveGame(sampleState());
    clearSave();
    expect(loadGame()).toBeNull();
  });
});

import type { BoardState } from "../scoring/types";
import type { PendingAccrual, Resources } from "./economy";
import type { FtueState } from "./ftue";
import type { QuestsState } from "./quests";
import type { RivalState } from "./rival";

// §22 interface contract: SaveStore.load()/save(state). Task 11: "localStorage
// save/load byte-identical realm." Every field here is plain JSON-serializable
// data (no functions/Sets/Maps) so a JSON round-trip is lossless.
export interface SaveState {
  board: BoardState;
  resources: Resources;
  pendingAccrual: PendingAccrual;
  ftue: FtueState;
  quests: QuestsState;
  rival: RivalState | null;
  totalWoodClaimed: number;
  relocationCount: number;
  seed: string;
  savedAt: number;
  sessionCount: number;
  // Set true the moment the player first beats the rival; cleared once the
  // §19.1 "comeback" (+8-12% next session) has been applied on a later load.
  rivalBeatenPendingComeback: boolean;
}

const SAVE_KEY = "realmforge-save-v1";

export function serializeSave(state: SaveState): string {
  return JSON.stringify(state);
}

export function deserializeSave(json: string): SaveState | null {
  try {
    return JSON.parse(json) as SaveState;
  } catch {
    return null;
  }
}

export function saveGame(state: SaveState): void {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(state));
  } catch {
    // Storage unavailable or full — non-fatal for a prototype; the session
    // just won't persist across reloads.
  }
}

export function loadGame(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeSave(raw);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

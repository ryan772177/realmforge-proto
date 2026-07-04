import ftueJson from "../../config/ftue.json";
import type { GameEvent } from "./events";

export interface FtueStepDef {
  id: number;
  time: string;
  uiElement: string;
  playerAction: string;
  microcopy: string;
  systemTaught: string;
  analyticsEvent: string;
  successCondition: string;
  fallback: { delaySeconds: number; hint: string };
  notShownYet: string[];
  note?: string;
}

interface FtueConfig {
  freeRelocationUntilStep: number;
  steps: FtueStepDef[];
  ftueExitState: Record<string, unknown>;
}

const CONFIG = ftueJson as FtueConfig;
const STEP_COUNT = CONFIG.steps.length;

export function getStep(stepIndex: number): FtueStepDef {
  const step = CONFIG.steps.find((s) => s.id === stepIndex);
  if (!step) throw new Error(`No FTUE step ${stepIndex}`);
  return step;
}

export interface FtueState {
  active: boolean;
  stepIndex: number; // 1-based
  fallbackShown: boolean;
}

export function initialFtueState(): FtueState {
  return { active: true, stepIndex: 1, fallbackShown: false };
}

// Maps each step's real-world success condition (§10) to the GameEvent that
// satisfies it. ftue.json's `successCondition` is free text (not structured
// like quests.json's triggerCondition), so the mapping lives in code here —
// it mirrors quests.ts's condition matching for the steps that overlap with
// quest triggers (2/8/9 <-> Q2/Q8, 10 <-> Q7).
function stepAdvances(stepIndex: number, event: GameEvent): boolean {
  switch (stepIndex) {
    case 1:
      return event.type === "building_placed" && event.buildingId === "B01";
    case 2:
      return event.type === "building_placed" && event.buildingId === "B02" && event.adjacentForestCount >= 1;
    case 3:
      return event.type === "bonus_dwell";
    case 4:
      return event.type === "building_relocated";
    case 5:
      return event.type === "claim" && event.resource === "wood" && event.cumulativeAmount >= 30;
    case 6:
      return event.type === "building_placed" && event.buildingId === "B03";
    case 7:
      return event.type === "breakdown_opened";
    case 8:
      return (
        event.type === "building_placed" &&
        event.buildingId === "B04" &&
        event.hasNeighborWithinRange("B03", 2)
      );
    case 9:
      return (
        event.type === "building_placed" &&
        event.buildingId === "B05" &&
        event.hasNeighborWithinRange("B02", 2)
      );
    case 10:
      return event.type === "score_updated" && event.prosperity >= 250;
    case 11:
      return event.type === "rival_dwell_or_open";
    case 12:
      return event.type === "reward_claimed" && event.questId === "Q7";
    default:
      return false;
  }
}

export function applyGameEvent(state: FtueState, event: GameEvent): FtueState {
  if (!state.active) return state;
  if (!stepAdvances(state.stepIndex, event)) return state;

  if (state.stepIndex >= STEP_COUNT) {
    return { active: false, stepIndex: state.stepIndex, fallbackShown: false };
  }
  return { active: true, stepIndex: state.stepIndex + 1, fallbackShown: false };
}

export function markFallbackShown(state: FtueState): FtueState {
  if (state.fallbackShown) return state;
  return { ...state, fallbackShown: true };
}

export function isBuildingUnlocked(unlockStep: string, ftue: FtueState): boolean {
  if (!ftue.active) return true;
  if (unlockStep === "post_ftue") return false;
  const n = Number(unlockStep.replace("ftue_", ""));
  return Number.isFinite(n) && ftue.stepIndex >= n;
}

// Staged UI reveal thresholds (§8/§10's "not shown yet" columns don't give a
// single strict per-widget cutoff; these are reasonable greybox defaults —
// score appears right after Town Hall placement, the resource bar appears at
// first claim, the rival card at its reveal step, and the quest panel only
// once the FTUE chest (step 12) makes quests visible for the first time).
export function isScoreVisible(ftue: FtueState): boolean {
  return !ftue.active || ftue.stepIndex >= 2;
}
export function isResourceBarVisible(ftue: FtueState): boolean {
  return !ftue.active || ftue.stepIndex >= 5;
}
export function isRivalVisible(ftue: FtueState): boolean {
  return !ftue.active || ftue.stepIndex >= 11;
}
export function isQuestPanelVisible(ftue: FtueState): boolean {
  return !ftue.active || ftue.stepIndex >= 12;
}

export function isFreeRelocation(ftue: FtueState): boolean {
  return ftue.active && ftue.stepIndex <= CONFIG.freeRelocationUntilStep;
}

export function getFtueExitState(): Record<string, unknown> {
  return CONFIG.ftueExitState;
}

import { useState, useRef, useEffect, useMemo } from "react";
import { buildBoard, placeBuilding, relocateBuilding } from "./board/grid";
import { validatePlacement } from "./board/validator";
import {
  INITIAL_RESOURCES, RELOCATION_COST,
  getBuildingCost, canAfford, deductCost,
  tickAccrual, hasPendingClaim, movePendingAccrual, claimTile,
} from "./game/economy";
import type { PendingAccrual, Resources } from "./game/economy";
import { computeScore, computeScorePreview } from "./scoring/score";
import type { BoardState, BuildingId, CauseLine, ScoreLineBreakdown, ScoreReport } from "./scoring/types";
import type { GameEvent } from "./game/events";
import { countAdjacentTerrain, hasNeighborBuildingWithinRange, getPlacedBuildingIds } from "./game/events";
import {
  initialQuestsState, applyGameEvent as applyQuestEvent, claimQuest, allQuestDefs,
} from "./game/quests";
import type { QuestsState, QuestId } from "./game/quests";
import {
  revealRival, recordPlayerAction, beatsRival, applyBetweenSessionGrowth, applyComeback,
} from "./game/rival";
import type { RivalState } from "./game/rival";
import {
  initialFtueState, applyGameEvent as applyFtueEvent, markFallbackShown,
  isBuildingUnlocked, isScoreVisible, isResourceBarVisible, isRivalVisible,
  isQuestPanelVisible, isFreeRelocation, getStep,
} from "./game/ftue";
import type { FtueState } from "./game/ftue";
import { loadGame, saveGame } from "./game/save";
import { track, trackConfusionTap, downloadLogAsFile } from "./game/analytics";
import RealmGrid from "./ui/RealmGrid";
import BuildingTray from "./ui/BuildingTray";
import AdjacencyReport from "./ui/AdjacencyReport";
import ScoreBreakdown from "./ui/ScoreBreakdown";
import RivalCard from "./ui/RivalCard";
import QuestPanel from "./ui/QuestPanel";
import FtueDirector from "./ui/FtueDirector";
import type { DragUI } from "./ui/types";
import buildingsJson from "../config/buildings.json";

const TILE = 56;
const GAP = 2;
const TAP_THRESHOLD = 8;
const TICK_MS = 250;
const AUTOSAVE_MS = 5000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const GRID_ROWS = 6;
const GRID_COLS = 6;

type DragSource =
  | { type: "tray" }
  | { type: "board"; fromRow: number; fromCol: number };

interface DragOp {
  buildingId: BuildingId;
  source: DragSource;
  startX: number;
  startY: number;
  pointerId: number;
  hasMoved: boolean;
}

interface GameState {
  board: BoardState;
  resources: Resources;
  pendingAccrual: PendingAccrual;
  ftue: FtueState;
  quests: QuestsState;
  rival: RivalState | null;
  totalWoodClaimed: number;
  relocationCount: number;
  breakdownOpen: boolean;
  seed: string;
  sessionCount: number;
  rivalBeatenPendingComeback: boolean;
}

const BUILDING_SHORT: Record<string, string> = {
  B01: "TH", B02: "LC", B03: "Co", B04: "Sh",
  B05: "SW", B06: "Qu", B07: "Dk", B08: "MT",
  B09: "Mk", B10: "Wt", B11: "Gd", B12: "Fg",
};

const BUILDING_NAME: Record<string, string> = Object.fromEntries(
  buildingsJson.buildings.map((b) => [b.id, b.name])
);
const BUILDING_UNLOCK_STEP: Record<string, string> = Object.fromEntries(
  buildingsJson.buildings.map((b) => [b.id, b.unlockStep])
);

function causeLinesForTile(
  breakdowns: ScoreLineBreakdown[][],
  row: number,
  col: number
): CauseLine[] {
  return breakdowns
    .flat()
    .filter((line) => line.row === row && line.col === col)
    .flatMap((line) => line.causeLines);
}

function isPlayerAction(event: GameEvent): boolean {
  return event.type === "building_placed" || event.type === "building_relocated" || event.type === "claim";
}

interface FoldResult {
  quests: QuestsState;
  ftue: FtueState;
  rival: RivalState | null;
  newlyCompletedQuestIds: QuestId[];
  rivalJustRevealed: boolean;
}

// Folds one or more GameEvents through quests + FTUE, revealing the rival the
// moment FTUE crosses into step 11 (matching §10 step 11's "Rival card
// slides in") and growing the rival on every player action once revealed.
// Pure — no analytics/side effects here; callers track() the returned
// newlyCompletedQuestIds/rivalJustRevealed themselves before calling setGame.
function foldEvents(
  g: Pick<GameState, "quests" | "ftue" | "rival" | "seed">,
  events: GameEvent[],
  prosperity: number
): FoldResult {
  const prevQuestStatus = g.quests.status;
  let quests = g.quests;
  let ftue = g.ftue;
  let rival = g.rival;
  let rivalJustRevealed = false;
  const queue = [...events];

  for (let i = 0; i < queue.length; i++) {
    const event = queue[i]!;
    const prevStep = ftue.stepIndex;
    const prevActive = ftue.active;

    quests = applyQuestEvent(quests, event);
    ftue = applyFtueEvent(ftue, event);

    if (prevActive && ftue.active && prevStep === 10 && ftue.stepIndex === 11 && !rival) {
      rival = revealRival(g.seed, prosperity);
      rivalJustRevealed = true;
      queue.push({ type: "rival_revealed" });
    }

    if (isPlayerAction(event) && rival) {
      rival = recordPlayerAction(rival, prosperity);
    }
  }

  const newlyCompletedQuestIds = Object.keys(quests.status).filter(
    (id) => prevQuestStatus[id] === "active" && (quests.status[id] === "completed" || quests.status[id] === "claimed")
  );

  return { quests, ftue, rival, newlyCompletedQuestIds, rivalJustRevealed };
}

function freshGameState(): GameState {
  return {
    board: buildBoard(),
    resources: INITIAL_RESOURCES,
    pendingAccrual: {},
    ftue: initialFtueState(),
    quests: initialQuestsState(),
    rival: null,
    totalWoodClaimed: 0,
    relocationCount: 0,
    breakdownOpen: false,
    seed: Math.random().toString(36).slice(2),
    sessionCount: 1,
    rivalBeatenPendingComeback: false,
  };
}

// Task 11: hydrate from localStorage on load. Applies §19.1's between-session
// growth (>=2h elapsed) and the post-overtake "comeback" (+8-12%, applied the
// *next* session after the player first beat the rival) as pure functions.
function hydrateGameState(): { game: GameState; isNewGame: boolean } {
  const saved = loadGame();
  if (!saved) return { game: freshGameState(), isNewGame: true };

  const sessionCount = saved.sessionCount + 1;
  let rival = saved.rival;
  let rivalBeatenPendingComeback = saved.rivalBeatenPendingComeback;

  if (rival && rivalBeatenPendingComeback) {
    rival = applyComeback(rival, sessionCount);
    rivalBeatenPendingComeback = false;
    track("rival_comeback_shown", { player_score: null, rival_score: rival.score });
  }
  if (rival && Date.now() - saved.savedAt >= TWO_HOURS_MS) {
    rival = applyBetweenSessionGrowth(rival, sessionCount);
  }

  return {
    game: {
      board: saved.board,
      resources: saved.resources,
      pendingAccrual: saved.pendingAccrual,
      ftue: saved.ftue,
      quests: saved.quests,
      rival,
      totalWoodClaimed: saved.totalWoodClaimed,
      relocationCount: saved.relocationCount,
      breakdownOpen: false,
      seed: saved.seed,
      sessionCount,
      rivalBeatenPendingComeback,
    },
    isNewGame: false,
  };
}

function toSaveState(g: GameState) {
  return {
    board: g.board,
    resources: g.resources,
    pendingAccrual: g.pendingAccrual,
    ftue: g.ftue,
    quests: g.quests,
    rival: g.rival,
    totalWoodClaimed: g.totalWoodClaimed,
    relocationCount: g.relocationCount,
    seed: g.seed,
    savedAt: Date.now(),
    sessionCount: g.sessionCount,
    rivalBeatenPendingComeback: g.rivalBeatenPendingComeback,
  };
}

function countBuildings(board: BoardState): number {
  let n = 0;
  for (const row of board.tiles) for (const t of row) if (t.building) n++;
  return n;
}

export default function App() {
  const [initialHydration] = useState(hydrateGameState);
  const [game, setGame] = useState<GameState>(initialHydration.game);
  const [dragUI, setDragUI] = useState<DragUI | null>(null);
  const [rejectionText, setRejectionText] = useState<string | null>(null);

  const dragRef = useRef<DragOp | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>(game);
  const sessionStartRef = useRef<number>(Date.now());
  const wasRivalBeatenRef = useRef(false);

  useEffect(() => { gameRef.current = game; }, [game]);

  useEffect(() => {
    if (initialHydration.isNewGame) track("ftue_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires the two analytics events that are *derived* from a fold outcome
  // rather than known up front by the caller (unlike building_placed etc.,
  // which the caller already knows is happening).
  function trackFoldOutcome(next: FoldResult, prosperity: number) {
    for (const questId of next.newlyCompletedQuestIds) {
      track("quest_completed", { quest_id: questId, t_ms: Date.now() - sessionStartRef.current });
    }
    if (next.rivalJustRevealed && next.rival) {
      track("rival_revealed", { player_score: prosperity, rival_score: next.rival.score });
    }
  }

  const currentReport = useMemo(() => computeScore(game.board), [game.board]);
  const currentReportRef = useRef<ScoreReport>(currentReport);
  useEffect(() => { currentReportRef.current = currentReport; }, [currentReport]);

  const previewReport = useMemo(() => {
    if (!dragUI || dragUI.hoverRow == null || dragUI.hoverCol == null || !dragUI.hoverValid) return null;
    const drag = dragRef.current;
    if (!drag) return null;
    if (drag.source.type === "board") {
      const { fromRow, fromCol } = drag.source;
      if (fromRow === dragUI.hoverRow && fromCol === dragUI.hoverCol) return null;
      return computeScore(relocateBuilding(game.board, fromRow, fromCol, dragUI.hoverRow, dragUI.hoverCol));
    }
    return computeScorePreview(game.board, dragUI.buildingId, dragUI.hoverRow, dragUI.hoverCol);
  }, [game.board, dragUI]);

  const unlockedBuildingIds = useMemo(() => {
    const ids = new Set<BuildingId>();
    for (const [id, unlockStep] of Object.entries(BUILDING_UNLOCK_STEP)) {
      if (isBuildingUnlocked(unlockStep, game.ftue)) ids.add(id as BuildingId);
    }
    return ids;
  }, [game.ftue]);

  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setGame(g => ({ ...g, pendingAccrual: tickAccrual(g.pendingAccrual, g.board, dt) }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Autosave + session_end (task 11: "kill app mid-session, reopen -> identical realm").
  useEffect(() => {
    const id = setInterval(() => {
      saveGame(toSaveState(gameRef.current));
    }, AUTOSAVE_MS);

    function persistAndEndSession() {
      const g = gameRef.current;
      saveGame(toSaveState(g));
      track("session_end", {
        duration_ms: Date.now() - sessionStartRef.current,
        buildings: countBuildings(g.board),
        relocations: g.relocationCount,
        final_score: currentReportRef.current.prosperity,
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistAndEndSession();
    });
    window.addEventListener("pagehide", persistAndEndSession);

    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", persistAndEndSession);
    };
  }, []);

  // Score-driven step/quest advancement (Q7/Q10, FTUE step 10) fires whenever
  // the board's prosperity changes, independent of which action caused it.
  // Rival-beaten detection happens here (outside setGame) so track() only
  // fires once per real transition, not once per StrictMode double-invoke.
  useEffect(() => {
    const g = gameRef.current;
    const rivalBeatenNow = g.rival ? beatsRival(g.rival, currentReport.prosperity) : false;
    if (rivalBeatenNow && !wasRivalBeatenRef.current) {
      track("rival_beaten", { player_score: currentReport.prosperity, rival_score: g.rival?.score ?? null });
    }
    wasRivalBeatenRef.current = rivalBeatenNow;

    const event: GameEvent = {
      type: "score_updated",
      prosperity: currentReport.prosperity,
      rivalRevealed: g.rival !== null,
      beatsRival: rivalBeatenNow,
    };
    const next = foldEvents(g, [event], currentReport.prosperity);
    trackFoldOutcome(next, currentReport.prosperity);
    setGame(g2 => ({
      ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival,
      rivalBeatenPendingComeback: g2.rivalBeatenPendingComeback || rivalBeatenNow,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReport.prosperity]);

  // FTUE fallback nudge: after fallback.delaySeconds of no progress on the
  // current step, surface the hint line.
  useEffect(() => {
    if (!game.ftue.active) return;
    const step = getStep(game.ftue.stepIndex);
    const id = setTimeout(() => {
      setGame(g => ({ ...g, ftue: markFallbackShown(g.ftue) }));
    }, step.fallback.delaySeconds * 1000);
    return () => clearTimeout(id);
  }, [game.ftue.active, game.ftue.stepIndex]);

  // FTUE step transitions -> ftue_step_done analytics event.
  const prevFtueStepRef = useRef(game.ftue.stepIndex);
  useEffect(() => {
    if (game.ftue.stepIndex !== prevFtueStepRef.current) {
      track("ftue_step_done", { step_id: prevFtueStepRef.current, t_ms: Date.now() - sessionStartRef.current });
      prevFtueStepRef.current = game.ftue.stepIndex;
    }
  }, [game.ftue.stepIndex]);

  // §10 step 3: "bonus_viewed" fires after dwelling on a valid adjacency
  // report for >=1.5s while dragging.
  useEffect(() => {
    if (!dragUI || dragUI.hoverRow == null || !dragUI.hoverValid) return;
    const id = setTimeout(() => {
      track("report_viewed", { context: "preview", dwell_ms: 1500 });
      const g = gameRef.current;
      const prosperity = currentReportRef.current.prosperity;
      const next = foldEvents(g, [{ type: "bonus_dwell" }], prosperity);
      trackFoldOutcome(next, prosperity);
      setGame(g2 => ({ ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival }));
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragUI?.hoverRow, dragUI?.hoverCol, dragUI?.hoverValid]);

  function tileFromClient(clientX: number, clientY: number): { row: number; col: number } | null {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / (TILE + GAP));
    const row = Math.floor((clientY - rect.top) / (TILE + GAP));
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
    return { row, col };
  }

  function updateGhost(x: number, y: number, label: string) {
    const el = ghostRef.current;
    if (!el) return;
    el.style.display = "flex";
    el.style.left = `${x - TILE / 2}px`;
    el.style.top = `${y - TILE / 2}px`;
    el.textContent = label;
  }

  function hideGhost() {
    const el = ghostRef.current;
    if (el) el.style.display = "none";
  }

  function handlePointerDown(
    e: React.PointerEvent,
    buildingId: BuildingId,
    source: DragSource,
  ) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      buildingId, source,
      startX: e.clientX, startY: e.clientY,
      pointerId: e.pointerId, hasMoved: false,
    };
    updateGhost(e.clientX, e.clientY, BUILDING_SHORT[buildingId] ?? buildingId);
    setDragUI({ buildingId, hoverRow: null, hoverCol: null, hoverValid: false, hoverText: null });
    setRejectionText(null);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();

    updateGhost(e.clientX, e.clientY, BUILDING_SHORT[drag.buildingId] ?? drag.buildingId);

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.hasMoved && Math.hypot(dx, dy) >= TAP_THRESHOLD) {
      drag.hasMoved = true;
    }
    if (!drag.hasMoved) return;

    const pos = tileFromClient(e.clientX, e.clientY);
    if (!pos) {
      setDragUI(ui => ui
        ? { ...ui, hoverRow: null, hoverCol: null, hoverValid: false, hoverText: null }
        : null);
      return;
    }

    const g = gameRef.current;
    const { row, col } = pos;
    let valid: boolean;
    let text: string | null = null;

    if (drag.source.type === "board") {
      const src = drag.source;
      if (src.fromRow === row && src.fromCol === col) {
        valid = false;
        text = "Same tile.";
      } else {
        const unlimited = { gold: 999999, wood: 999999, stone: 999999, mana: 999999, gems: 999999 };
        const vr = validatePlacement(g.board, drag.buildingId, row, col, unlimited);
        valid = vr.valid;
        if (!valid && !vr.valid) text = vr.playerText;
        if (valid && !isFreeRelocation(g.ftue) && !canAfford(g.resources, RELOCATION_COST)) {
          valid = false;
          text = "Need 10G to relocate.";
        }
      }
    } else {
      const vr = validatePlacement(g.board, drag.buildingId, row, col, g.resources);
      valid = vr.valid;
      if (!valid && !vr.valid) text = vr.playerText;
    }

    setDragUI({ buildingId: drag.buildingId, hoverRow: row, hoverCol: col, hoverValid: valid, hoverText: text });
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    hideGhost();
    setDragUI(null);

    const g = gameRef.current;

    if (!drag.hasMoved) {
      if (drag.source.type === "board") {
        const key = `${drag.source.fromRow},${drag.source.fromCol}`;
        if (hasPendingClaim(g.pendingAccrual, key)) {
          const { resources, pending } = claimTile(g.resources, g.pendingAccrual, key);
          const woodClaimed = resources.wood - g.resources.wood;
          for (const [resource, before] of Object.entries(g.resources) as [keyof Resources, number][]) {
            const after = resources[resource];
            if (after > before) track("claim", { resource, amount: after - before });
          }
          if (woodClaimed <= 0) {
            setGame(g2 => ({ ...g2, resources, pendingAccrual: pending }));
            return;
          }
          const totalWoodClaimed = g.totalWoodClaimed + woodClaimed;
          const event: GameEvent = { type: "claim", resource: "wood", cumulativeAmount: totalWoodClaimed };
          const next = foldEvents(g, [event], currentReport.prosperity);
          trackFoldOutcome(next, currentReport.prosperity);
          setGame(g2 => ({
            ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival,
            resources, pendingAccrual: pending, totalWoodClaimed,
          }));
        } else {
          trackConfusionTap("grid_tap_no_claim");
        }
      }
      return;
    }

    const pos = tileFromClient(e.clientX, e.clientY);
    if (!pos) return;
    const { row, col } = pos;

    if (drag.source.type === "tray") {
      const cost = getBuildingCost(drag.buildingId);
      const vr = validatePlacement(g.board, drag.buildingId, row, col, g.resources);
      if (!vr.valid) { setRejectionText(vr.playerText); return; }
      const newRes = deductCost(g.resources, cost);
      if (!newRes) { setRejectionText("Not enough resources."); return; }

      const newBoard = placeBuilding(g.board, drag.buildingId, row, col);
      const report = computeScore(newBoard);
      const line = report.productionBreakdown.find(l => l.row === row && l.col === col);
      const event: GameEvent = {
        type: "building_placed",
        buildingId: drag.buildingId,
        row, col,
        adjacentForestCount: countAdjacentTerrain(newBoard, row, col, "F"),
        terrainMultiplier: line?.terrainMult ?? 1,
        placedIds: getPlacedBuildingIds(newBoard),
        hasNeighborWithinRange: (buildingId, range) =>
          hasNeighborBuildingWithinRange(newBoard, row, col, buildingId, range),
      };
      track("building_placed", {
        building_id: drag.buildingId,
        tile: { row, col },
        adjacency_summary: { terrainMultiplier: event.terrainMultiplier, adjacentForestCount: event.adjacentForestCount },
        score_before: currentReport.prosperity,
        score_after: report.prosperity,
      });
      const next = foldEvents(g, [event], report.prosperity);
      trackFoldOutcome(next, report.prosperity);
      setGame(g2 => ({
        ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival,
        board: newBoard,
        resources: newRes,
      }));
    } else {
      const { fromRow, fromCol } = drag.source;
      if (fromRow === row && fromCol === col) return;
      const fromKey = `${fromRow},${fromCol}`;
      const toKey = `${row},${col}`;

      const unlimited = { gold: 999999, wood: 999999, stone: 999999, mana: 999999, gems: 999999 };
      const vr = validatePlacement(g.board, drag.buildingId, row, col, unlimited);
      if (!vr.valid) { setRejectionText(vr.playerText); return; }

      if (!isFreeRelocation(g.ftue) && !canAfford(g.resources, RELOCATION_COST)) {
        setRejectionText("Need 10G to relocate.");
        return;
      }

      const newRes = isFreeRelocation(g.ftue)
        ? g.resources
        : (deductCost(g.resources, RELOCATION_COST) ?? g.resources);
      const newBoard = relocateBuilding(g.board, fromRow, fromCol, row, col);
      const report = computeScore(newBoard);
      const event: GameEvent = { type: "building_relocated" };
      track("building_relocated", {
        building_id: drag.buildingId,
        from: { row: fromRow, col: fromCol },
        to: { row, col },
        score_before: currentReport.prosperity,
        score_after: report.prosperity,
        prompted: g.ftue.active && g.ftue.stepIndex === 4,
        ftue: g.ftue.active,
      });
      const next = foldEvents(g, [event], report.prosperity);
      trackFoldOutcome(next, report.prosperity);
      setGame(g2 => ({
        ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival,
        board: newBoard,
        resources: newRes,
        relocationCount: g2.relocationCount + 1,
        pendingAccrual: movePendingAccrual(g2.pendingAccrual, fromKey, toKey),
      }));
    }
  }

  function handlePointerCancel(e: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    hideGhost();
    setDragUI(null);
  }

  function handleToggleBreakdown() {
    const g = gameRef.current;
    const opening = !g.breakdownOpen;
    if (!opening) { setGame(g2 => ({ ...g2, breakdownOpen: false })); return; }
    track("breakdown_opened", { score: currentReport.prosperity, dwell_ms: 0 });
    const next = foldEvents(g, [{ type: "breakdown_opened" }], currentReport.prosperity);
    trackFoldOutcome(next, currentReport.prosperity);
    setGame(g2 => ({ ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival, breakdownOpen: true }));
  }

  function handleClaimQuest(questId: QuestId) {
    const g = gameRef.current;
    const { state: quests, reward } = claimQuest(g.quests, questId);
    if (!reward && quests === g.quests) return;
    track("reward_claimed", { quest_id: questId, t_ms: Date.now() - sessionStartRef.current });
    const resources = reward?.gold ? { ...g.resources, gold: g.resources.gold + reward.gold } : g.resources;
    const next = foldEvents({ ...g, quests }, [{ type: "reward_claimed", questId }], currentReport.prosperity);
    trackFoldOutcome(next, currentReport.prosperity);
    setGame(g2 => ({ ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival, resources }));
  }

  function handleRivalViewedOrOpened() {
    track("rival_card_opened", { player_score: currentReport.prosperity, rival_score: gameRef.current.rival?.score ?? null });
    const g = gameRef.current;
    const next = foldEvents(g, [{ type: "rival_dwell_or_open" }], currentReport.prosperity);
    trackFoldOutcome(next, currentReport.prosperity);
    setGame(g2 => ({ ...g2, quests: next.quests, ftue: next.ftue, rival: next.rival }));
  }

  function handleImproveMyScore() {
    track("rival_improve_clicked", { player_score: currentReport.prosperity, rival_score: gameRef.current.rival?.score ?? null });
    setGame(g => ({ ...g, breakdownOpen: true }));
  }

  function handleRootPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // §23.1 confusion_tap: only counts taps that land on dead space (the root
    // background itself), not any interactive child — a deliberately minimal
    // interpretation of "non-interactive UI" for this greybox pass.
    if (e.target === e.currentTarget) {
      trackConfusionTap("app_background");
    }
  }

  return (
    <div
      onPointerDown={handleRootPointerDown}
      style={{
        maxWidth: 390,
        margin: "0 auto",
        padding: "12px 8px 24px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Realmforge Rivals</span>
        {isScoreVisible(game.ftue) && (
          <ScoreBreakdown report={currentReport} open={game.breakdownOpen} onToggle={handleToggleBreakdown} />
        )}
      </div>

      {isRivalVisible(game.ftue) && game.rival && (
        <RivalCard
          rival={game.rival}
          playerScore={currentReport.prosperity}
          onImproveMyScore={handleImproveMyScore}
          onViewedOrOpened={handleRivalViewedOrOpened}
        />
      )}

      <FtueDirector ftue={game.ftue} />

      {isResourceBarVisible(game.ftue) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10, padding: "0 4px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          <span>G: {game.resources.gold}</span>
          <span>W: {game.resources.wood}</span>
          <span>St: {game.resources.stone}</span>
          <span>M: {game.resources.mana}</span>
        </div>
      )}

      {rejectionText && (
        <div style={{ background: "#8b1a1a", border: "1px solid #c0392b", borderRadius: 6, padding: "6px 12px", marginBottom: 10, textAlign: "center", fontSize: 13, color: "#ffcccc" }}>
          {rejectionText}
        </div>
      )}

      <RealmGrid
        board={game.board}
        dragUI={dragUI}
        pendingAccrual={game.pendingAccrual}
        gridRef={gridRef}
        onTilePointerDown={(e, row, col) => {
          const tile = game.board.tiles[row]?.[col];
          if (tile?.building) {
            handlePointerDown(e, tile.building, { type: "board", fromRow: row, fromCol: col });
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {dragUI && dragUI.hoverRow != null && dragUI.hoverCol != null && (
        <AdjacencyReport
          buildingName={BUILDING_NAME[dragUI.buildingId] ?? dragUI.buildingId}
          rejectionText={!dragUI.hoverValid ? (dragUI.hoverText ?? "Can't place here.") : null}
          causeLines={
            dragUI.hoverValid && previewReport
              ? causeLinesForTile(
                  [
                    previewReport.productionBreakdown,
                    previewReport.manaBreakdown,
                    previewReport.happinessBreakdown,
                    previewReport.beautyBreakdown,
                  ],
                  dragUI.hoverRow,
                  dragUI.hoverCol
                )
              : undefined
          }
          prosperityBefore={currentReport.prosperity}
          prosperityAfter={previewReport?.prosperity}
        />
      )}

      {isQuestPanelVisible(game.ftue) && (
        <QuestPanel quests={allQuestDefs()} status={game.quests.status} onClaim={handleClaimQuest} />
      )}

      <BuildingTray
        resources={game.resources}
        unlockedIds={unlockedBuildingIds}
        onBuildingPointerDown={(e, buildingId) =>
          handlePointerDown(e, buildingId, { type: "tray" })
        }
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {isFreeRelocation(game.ftue) && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          Free relocation active (FTUE)
        </div>
      )}

      <button
        onClick={() => downloadLogAsFile()}
        style={{
          marginTop: 16,
          alignSelf: "center",
          background: "none",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
        }}
      >
        Export Analytics Log
      </button>

      {/* Drag ghost: positioned imperatively on every pointermove, no re-render */}
      <div
        ref={ghostRef}
        style={{
          display: "none",
          position: "fixed",
          width: TILE,
          height: TILE,
          background: "rgba(255,215,0,0.85)",
          border: "2px solid #ffd700",
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#000",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </div>
  );
}
